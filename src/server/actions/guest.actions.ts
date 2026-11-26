"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guestInputSchema, importCommitSchema } from "@/features/guests/schemas";
import { uuid } from "@/features/shared/schemas";
import type { ActionResult } from "@/server/action-result";
import * as guests from "@/server/services/guest.service";
import * as importer from "@/server/services/guest-import.service";
import { adminAction } from "./admin-action";

export async function createGuestAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminAction("guest.create", guestInputSchema, input, async (ctx, data) => {
    const g = await guests.createGuest(ctx, data);
    revalidatePath("/admin/guests");
    return { id: g.id };
  });
}

export async function updateGuestAction(id: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminAction("guest.update", z.object({ id: uuid, data: guestInputSchema }), { id, data: input }, async (ctx, v) => {
    await guests.updateGuest(ctx, v.id, v.data);
    revalidatePath("/admin/guests");
    return { id: v.id };
  });
}

export async function archiveGuestAction(id: unknown): Promise<ActionResult> {
  return adminAction("guest.archive", uuid, id, async (ctx, guestId) => {
    await guests.archiveGuest(ctx, guestId);
    revalidatePath("/admin/guests");
  });
}

export async function restoreGuestAction(id: unknown): Promise<ActionResult> {
  return adminAction("guest.restore", uuid, id, async (ctx, guestId) => {
    await guests.restoreGuest(ctx, guestId);
    revalidatePath("/admin/guests");
  });
}

export async function previewImportAction(input: unknown): Promise<ActionResult<importer.ImportPreview>> {
  return adminAction("guest.importPreview", importCommitSchema, input, (ctx, d) => importer.previewImport(ctx, d.csv));
}

export async function commitImportAction(input: unknown): Promise<ActionResult<{ created: number; groupsCreated: number }>> {
  return adminAction("guest.importCommit", importCommitSchema, input, async (ctx, d) => {
    const res = await importer.commitImport(ctx, d.csv);
    revalidatePath("/admin/guests");
    revalidatePath("/admin/groups");
    return res;
  });
}
