import "server-only";
import { randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { imageSize } from "image-size";
import type { MediaPurpose } from "@/generated/prisma/enums";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma/client";
import { type ImageRef, imageRef, storage } from "@/lib/storage";
import type { Db } from "@/server/context";
import { AppError } from "@/server/errors";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_PIXELS = 60_000_000; // decompression-bomb guard (~60 MP)
const MAX_SIDE = 12_000;

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export type UploadedAsset = { assetId: string; preview: ImageRef };

/**
 * Validates and stores an image. Trust nothing from the client: the MIME type
 * is detected from the file's magic bytes, dimensions are read from the
 * header, SVG/HTML/anything else is rejected. The asset starts PENDING and
 * becomes ATTACHED when a record references it; abandoned uploads are
 * deleted by the cleanup job.
 */
export async function uploadImage(file: File, purpose: MediaPurpose): Promise<UploadedAsset> {
  // Payment evidence is private (never publicly deliverable) and smaller.
  const isPrivate = purpose === "GIFT_EVIDENCE";
  const maxBytes = isPrivate ? MAX_EVIDENCE_BYTES : MAX_IMAGE_BYTES;
  if (file.size === 0) throw new AppError("invalidInput");
  if (file.size > maxBytes) throw new AppError("fileTooLarge", { maxMb: maxBytes / 1024 / 1024 });

  const data = Buffer.from(await file.arrayBuffer());
  const type = await fileTypeFromBuffer(data);
  const ext = type ? ALLOWED[type.mime] : undefined;
  if (!type || !ext) throw new AppError("fileType");

  let width: number | undefined;
  let height: number | undefined;
  try {
    ({ width, height } = imageSize(data));
  } catch {
    throw new AppError("fileType");
  }
  if (!width || !height || width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_PIXELS) {
    throw new AppError("imageTooLarge");
  }

  const s = storage();
  const stored = await s.put(data, { key: randomUUID(), ext, mime: type.mime, private: isPrivate });
  try {
    const asset = await prisma.mediaAsset.create({
      data: { purpose, publicId: stored.publicId, deliveryType: stored.deliveryType, format: ext, bytes: data.length, width, height },
    });
    // Never hand out a URL for private evidence.
    return { assetId: asset.id, preview: isPrivate ? { src: "", width: width ?? null, height: height ?? null } : imageRef(asset, 828) };
  } catch (error) {
    await s.remove(stored).catch(() => undefined);
    throw error;
  }
}

/** Marks an uploaded asset as used by a record. Rejects wrong purpose or deleted assets. */
export async function attachAsset(tx: Db, assetId: string, purposes: MediaPurpose[]): Promise<void> {
  const asset = await tx.mediaAsset.findUnique({ where: { id: assetId }, select: { purpose: true, status: true } });
  if (!asset || asset.status === "DELETED" || !purposes.includes(asset.purpose)) throw new AppError("invalidInput");
  if (asset.status === "PENDING") await tx.mediaAsset.update({ where: { id: assetId }, data: { status: "ATTACHED" } });
}

/** Removes an asset that is no longer referenced. Best effort on the storage side (logged). */
export async function releaseAsset(assetId: string | null | undefined): Promise<void> {
  if (!assetId) return;
  const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
  if (!asset || asset.status === "DELETED") return;
  await prisma.mediaAsset.update({ where: { id: assetId }, data: { status: "DELETED", deletedAt: new Date() } });
  try {
    await storage().remove({ publicId: asset.publicId, deliveryType: asset.deliveryType as "upload" | "authenticated" });
  } catch (error) {
    logger.error("media.remove_failed", { assetId, error });
  }
}

/** Deletes uploads never attached to a record (e.g. abandoned forms). */
export async function cleanupPendingAssets(olderThanHours = 24): Promise<number> {
  const stale = await prisma.mediaAsset.findMany({
    where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - olderThanHours * 3600_000) } },
    select: { id: true },
    take: 500,
  });
  for (const a of stale) await releaseAsset(a.id);
  return stale.length;
}

/** Resolve many asset ids to image refs in one query. */
export async function imageRefs(ids: (string | null | undefined)[], maxWidth = 1920): Promise<Map<string, ImageRef>> {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (wanted.length === 0) return new Map();
  const assets = await prisma.mediaAsset.findMany({
    where: { id: { in: wanted }, status: { not: "DELETED" }, purpose: { not: "GIFT_EVIDENCE" } },
    select: { id: true, publicId: true, deliveryType: true, width: true, height: true },
  });
  return new Map(assets.map((a) => [a.id, imageRef(a, maxWidth)]));
}

export function isCloudinary(): boolean {
  return env().MEDIA_STORAGE === "cloudinary";
}

export const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // 15 MB (~10 min at 192 kbps)
const AUDIO: Record<string, string> = { "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a" };

/** Background music upload (admin). MIME detected from magic bytes; mp3/m4a only. */
export async function uploadAudio(file: File): Promise<{ assetId: string; url: string }> {
  if (file.size === 0) throw new AppError("invalidInput");
  if (file.size > MAX_AUDIO_BYTES) throw new AppError("fileTooLarge", { maxMb: 15 });
  const data = Buffer.from(await file.arrayBuffer());
  const type = await fileTypeFromBuffer(data);
  const ext = type ? AUDIO[type.mime] : undefined;
  if (!type || !ext) throw new AppError("audioType");
  const s = storage();
  const stored = await s.put(data, { key: randomUUID(), ext, mime: type.mime, private: false });
  try {
    const asset = await prisma.mediaAsset.create({
      data: { purpose: "MUSIC", publicId: stored.publicId, deliveryType: stored.deliveryType, format: ext, bytes: data.length },
    });
    return { assetId: asset.id, url: s.url(asset) };
  } catch (error) {
    await s.remove(stored).catch(() => undefined);
    throw error;
  }
}

/** Public URL for an attached music asset, or null. */
export async function musicUrl(assetId: string | null | undefined): Promise<string | null> {
  if (!assetId) return null;
  const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId }, select: { id: true, publicId: true, deliveryType: true, width: true, height: true, status: true, purpose: true } });
  if (!asset || asset.status === "DELETED" || asset.purpose !== "MUSIC") return null;
  return storage().url(asset);
}
