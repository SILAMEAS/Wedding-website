"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { albumSchema, photoCaptionSchema, reorderSchema } from "@/features/content/schemas";
import { uuid } from "@/features/shared/schemas";
import type { ActionResult } from "@/server/action-result";
import * as gallery from "@/server/services/gallery.service";
import { adminAction } from "./admin-action";

function refresh(albumId?: string) {
  revalidatePath("/admin/gallery");
  if (albumId) revalidatePath(`/admin/gallery/${albumId}`);
}

export async function saveAlbumAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminAction("gallery.album", albumSchema, input, async (ctx, d) => {
    const id = await gallery.saveAlbum(ctx, d);
    refresh(id);
    return { id };
  });
}

export async function archiveAlbumAction(id: unknown): Promise<ActionResult> {
  return adminAction("gallery.archive", uuid, id, async (ctx, albumId) => {
    await gallery.archiveAlbum(ctx, albumId);
    refresh();
  });
}

export async function addPhotosAction(albumId: unknown, assetIds: unknown): Promise<ActionResult> {
  return adminAction(
    "gallery.addPhotos",
    z.object({ albumId: uuid, assetIds: z.array(uuid).min(1).max(gallery.MAX_PHOTOS_PER_BATCH) }),
    { albumId, assetIds },
    async (ctx, d) => {
      await gallery.addPhotos(ctx, d.albumId, d.assetIds);
      refresh(d.albumId);
    },
  );
}

export async function updatePhotoAction(input: unknown): Promise<ActionResult> {
  return adminAction("gallery.photo", photoCaptionSchema, input, async (ctx, d) => {
    await gallery.updatePhoto(ctx, d.photoId, d.caption, d.alt);
  });
}

export async function setCoverAction(photoId: unknown): Promise<ActionResult> {
  return adminAction("gallery.cover", uuid, photoId, async (ctx, id) => {
    await gallery.setCover(ctx, id);
    refresh();
  });
}

export async function movePhotoAction(input: unknown): Promise<ActionResult> {
  return adminAction("gallery.movePhoto", reorderSchema, input, async (ctx, d) => {
    await gallery.movePhoto(ctx, d.id, d.direction);
  });
}

export async function deletePhotoAction(photoId: unknown): Promise<ActionResult> {
  return adminAction("gallery.deletePhoto", uuid, photoId, async (ctx, id) => {
    await gallery.deletePhoto(ctx, id);
    refresh();
  });
}
