import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { env } from "@/lib/env";

/**
 * Media storage adapters.
 *  - cloudinary: production. Images are delivered through Cloudinary's CDN with
 *    automatic format/quality and width-limited transformations.
 *  - local: development only (refused in production by env validation). Files
 *    live in ./.uploads and are served by /api/media/[id] without resizing.
 */
export type StoredFile = { publicId: string; deliveryType: "upload" | "authenticated" };
export type StoredAsset = { id: string; publicId: string; deliveryType: string; width: number | null; height: number | null };

export interface MediaStorage {
  put(data: Buffer, opts: { key: string; ext: string; mime: string; private: boolean }): Promise<StoredFile>;
  remove(file: StoredFile): Promise<void>;
  /** Public delivery URL, optionally width-limited. */
  url(asset: StoredAsset, width?: number): string;
  /** Whether url(..., width) actually resizes (enables srcset). */
  readonly resizes: boolean;
}

// Overridable so the e2e server keeps its files apart from your development uploads.
export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), process.env.LOCAL_UPLOAD_DIR || ".uploads");
const LOCAL_ID = /^local\/[A-Za-z0-9-]+\.(jpg|png|webp|avif|mp3|m4a)$/;
const AUDIO_EXT = new Set(["mp3", "m4a"]);
// Cloudinary stores audio under the "video" resource type.
const resourceTypeFor = (publicIdOrExt: string) => (AUDIO_EXT.has(publicIdOrExt.split(".").pop() ?? "") ? "video" : "image");
const stripExt = (publicId: string) => publicId.slice(0, publicId.lastIndexOf(".") > 0 ? publicId.lastIndexOf(".") : undefined);

const local: MediaStorage = {
  resizes: false,
  async put(data, { key, ext }) {
    await mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
    const name = `${key}.${ext}`;
    await writeFile(path.join(LOCAL_UPLOAD_DIR, name), data);
    return { publicId: `local/${name}`, deliveryType: "upload" };
  },
  async remove({ publicId }) {
    if (!LOCAL_ID.test(publicId)) return;
    await unlink(path.join(LOCAL_UPLOAD_DIR, publicId.slice("local/".length))).catch(() => undefined);
  },
  url(asset) {
    return `/api/media/${asset.id}`;
  },
};

export async function readLocalFile(publicId: string): Promise<Buffer | null> {
  if (!LOCAL_ID.test(publicId)) return null;
  return readFile(path.join(LOCAL_UPLOAD_DIR, publicId.slice("local/".length))).catch(() => null);
}

let configured = false;
function cld() {
  if (!configured) {
    const e = env();
    cloudinary.config({ cloud_name: e.CLOUDINARY_CLOUD_NAME, api_key: e.CLOUDINARY_API_KEY, api_secret: e.CLOUDINARY_API_SECRET, secure: true });
    configured = true;
  }
  return cloudinary;
}

const cloud: MediaStorage = {
  resizes: true,
  async put(data, { key, ext, mime, private: isPrivate }) {
    const res = await cld().uploader.upload(`data:${mime};base64,${data.toString("base64")}`, {
      folder: env().CLOUDINARY_FOLDER,
      public_id: key,
      resource_type: resourceTypeFor(ext),
      type: isPrivate ? "authenticated" : "upload",
      overwrite: false,
    });
    // Keep the extension on audio ids so the resource type can be derived later.
    return { publicId: AUDIO_EXT.has(ext) ? `${res.public_id}.${ext}` : res.public_id, deliveryType: isPrivate ? "authenticated" : "upload" };
  },
  async remove({ publicId, deliveryType }) {
    const rt = resourceTypeFor(publicId);
    await cld().uploader.destroy(rt === "video" ? stripExt(publicId) : publicId, { resource_type: rt, type: deliveryType, invalidate: true });
  },
  url(asset, width) {
    if (resourceTypeFor(asset.publicId) === "video") {
      return cld().url(stripExt(asset.publicId), { secure: true, resource_type: "video", format: asset.publicId.split(".").pop() });
    }
    const transformation = [{ fetch_format: "auto", quality: "auto", ...(width ? { crop: "limit", width } : {}) }];
    return cld().url(asset.publicId, { secure: true, type: asset.deliveryType, transformation, sign_url: asset.deliveryType !== "upload" });
  },
};

export function storage(): MediaStorage {
  return env().MEDIA_STORAGE === "cloudinary" ? cloud : local;
}

export type ImageRef = { src: string; srcSet?: string; width: number | null; height: number | null };

const WIDTHS = [480, 828, 1200, 1920];

/** Responsive image reference for <img>. */
export function imageRef(asset: StoredAsset, maxWidth = 1920): ImageRef {
  const s = storage();
  if (!s.resizes) return { src: s.url(asset), width: asset.width, height: asset.height };
  const widths = WIDTHS.filter((w) => w <= maxWidth && (!asset.width || w <= asset.width));
  const list = widths.length ? widths : [Math.min(maxWidth, asset.width ?? maxWidth)];
  return {
    src: s.url(asset, list[list.length - 1]),
    srcSet: list.map((w) => `${s.url(asset, w)} ${w}w`).join(", "),
    width: asset.width,
    height: asset.height,
  };
}
