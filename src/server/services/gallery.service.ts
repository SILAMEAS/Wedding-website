import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { AlbumVisibility } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma/client";
import { imageRef } from "@/lib/storage";
import type { AdminContext } from "@/server/context";
import { AppError, isUniqueViolation } from "@/server/errors";
import { recordAudit } from "./audit.service";
import { attachAsset, releaseAsset } from "./media.service";

type Loc = { kh: string; en: string };
const json = (v: unknown) => v as Prisma.InputJsonValue;
export const MAX_PHOTOS_PER_BATCH = 50;

/** URL slug from the English title (or random when the title is Khmer only). */
export function slugify(title: Loc): string {
  const base = title.en
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return base || `album-${randomBytes(3).toString("hex")}`;
}

export async function listAlbums(_ctx: AdminContext) {
  const albums = await prisma.photoAlbum.findMany({
    where: { archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { photos: true } }, coverPhoto: { include: { asset: true } } },
  });
  return albums.map((a) => ({ ...a, cover: a.coverPhoto ? imageRef(a.coverPhoto.asset, 480) : null }));
}

export async function getAlbum(_ctx: AdminContext, id: string) {
  const album = await prisma.photoAlbum.findUnique({
    where: { id },
    include: { photos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { asset: true } } },
  });
  if (!album || album.archivedAt) throw new AppError("notFound");
  return { ...album, photos: album.photos.map((p) => ({ ...p, image: imageRef(p.asset, 480) })) };
}

export async function saveAlbum(ctx: AdminContext, input: { id?: string; title: Loc; description: Loc; visibility: AlbumVisibility }) {
  const data = { title: json(input.title), description: json(input.description), visibility: input.visibility };
  if (input.id) {
    await prisma.$transaction(async (tx) => {
      const res = await tx.photoAlbum.updateMany({ where: { id: input.id, archivedAt: null }, data });
      if (res.count === 0) throw new AppError("notFound");
      await recordAudit(tx, ctx, { action: "gallery.album_update", entityType: "PhotoAlbum", entityId: input.id, metadata: { visibility: input.visibility } });
    });
    return input.id;
  }
  const agg = await prisma.photoAlbum.aggregate({ _max: { sortOrder: true } });
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = attempt === 0 ? slugify(input.title) : `${slugify(input.title)}-${randomBytes(2).toString("hex")}`;
    try {
      return await prisma.$transaction(async (tx) => {
        const album = await tx.photoAlbum.create({ data: { ...data, slug, sortOrder: (agg._max.sortOrder ?? -1) + 1 } });
        await recordAudit(tx, ctx, { action: "gallery.album_create", entityType: "PhotoAlbum", entityId: album.id });
        return album.id;
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new AppError("slugTaken");
}

/** Albums are archived (photos kept) rather than deleted. */
export async function archiveAlbum(ctx: AdminContext, id: string) {
  await prisma.$transaction(async (tx) => {
    const res = await tx.photoAlbum.updateMany({ where: { id, archivedAt: null }, data: { archivedAt: new Date(), visibility: "UNPUBLISHED" } });
    if (res.count === 0) throw new AppError("notFound");
    await recordAudit(tx, ctx, { action: "gallery.album_archive", entityType: "PhotoAlbum", entityId: id });
  });
}

/** Attach already-uploaded assets as photos (appended in the given order). First photo becomes cover if none. */
export async function addPhotos(ctx: AdminContext, albumId: string, assetIds: string[]) {
  if (assetIds.length === 0 || assetIds.length > MAX_PHOTOS_PER_BATCH) throw new AppError("invalidInput");
  await prisma.$transaction(async (tx) => {
    const album = await tx.photoAlbum.findUnique({ where: { id: albumId }, select: { archivedAt: true, coverPhotoId: true } });
    if (!album || album.archivedAt) throw new AppError("notFound");
    const agg = await tx.photo.aggregate({ where: { albumId }, _max: { sortOrder: true } });
    let order = (agg._max.sortOrder ?? -1) + 1;
    let firstId: string | null = null;
    for (const assetId of assetIds) {
      await attachAsset(tx, assetId, ["GALLERY_PHOTO"]);
      const photo = await tx.photo.create({ data: { albumId, assetId, sortOrder: order++, caption: { kh: "", en: "" }, alt: { kh: "", en: "" } } });
      firstId ??= photo.id;
    }
    if (!album.coverPhotoId && firstId) await tx.photoAlbum.update({ where: { id: albumId }, data: { coverPhotoId: firstId } });
    await recordAudit(tx, ctx, { action: "gallery.photos_add", entityType: "PhotoAlbum", entityId: albumId, metadata: { count: assetIds.length } });
  });
}

export async function updatePhoto(ctx: AdminContext, photoId: string, caption: Loc, alt: Loc) {
  await prisma.$transaction(async (tx) => {
    const res = await tx.photo.updateMany({ where: { id: photoId }, data: { caption: json(caption), alt: json(alt) } });
    if (res.count === 0) throw new AppError("notFound");
    await recordAudit(tx, ctx, { action: "gallery.photo_update", entityType: "Photo", entityId: photoId });
  });
}

export async function setCover(ctx: AdminContext, photoId: string) {
  await prisma.$transaction(async (tx) => {
    const photo = await tx.photo.findUnique({ where: { id: photoId }, select: { albumId: true } });
    if (!photo) throw new AppError("notFound");
    await tx.photoAlbum.update({ where: { id: photo.albumId }, data: { coverPhotoId: photoId } });
    await recordAudit(tx, ctx, { action: "gallery.cover_set", entityType: "PhotoAlbum", entityId: photo.albumId, metadata: { photoId } });
  });
}

export async function movePhoto(ctx: AdminContext, photoId: string, direction: "up" | "down") {
  await prisma.$transaction(async (tx) => {
    const photo = await tx.photo.findUnique({ where: { id: photoId }, select: { albumId: true } });
    if (!photo) throw new AppError("notFound");
    const all = await tx.photo.findMany({ where: { albumId: photo.albumId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, sortOrder: true } });
    const i = all.findIndex((p) => p.id === photoId);
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= all.length) return;
    const order = all.map((p) => p.id);
    [order[i], order[j]] = [order[j]!, order[i]!];
    for (let k = 0; k < order.length; k++) {
      if (all.find((p) => p.id === order[k])!.sortOrder !== k) await tx.photo.update({ where: { id: order[k] }, data: { sortOrder: k } });
    }
  });
}

/** Deletes the photo row, then the stored file. Cover moves to the next photo if needed. */
export async function deletePhoto(ctx: AdminContext, photoId: string) {
  const assetId = await prisma.$transaction(async (tx) => {
    const photo = await tx.photo.findUnique({ where: { id: photoId }, include: { coverOf: { select: { id: true } } } });
    if (!photo) throw new AppError("notFound");
    if (photo.coverOf) {
      const next = await tx.photo.findFirst({ where: { albumId: photo.albumId, id: { not: photoId } }, orderBy: { sortOrder: "asc" }, select: { id: true } });
      await tx.photoAlbum.update({ where: { id: photo.albumId }, data: { coverPhotoId: next?.id ?? null } });
    }
    await tx.photo.delete({ where: { id: photoId } });
    await recordAudit(tx, ctx, { action: "gallery.photo_delete", entityType: "PhotoAlbum", entityId: photo.albumId, metadata: { photoId } });
    return photo.assetId;
  });
  await releaseAsset(assetId);
}
