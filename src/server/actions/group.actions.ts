"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addMemberSchema, groupInputSchema } from "@/features/groups/schemas";
import { uuid } from "@/features/shared/schemas";
import type { ActionResult } from "@/server/action-result";
import * as groups from "@/server/services/group.service";
import { adminAction } from "./admin-action";

function refresh(id?: string) {
  revalidatePath("/admin/groups");
  revalidatePath("/admin/guests");
  if (id) revalidatePath(`/admin/groups/${id}`);
}

export async function createGroupAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminAction("group.create", groupInputSchema, input, async (ctx, data) => {
    const g = await groups.createGroup(ctx, data);
    refresh();
    return { id: g.id };
  });
}

export async function updateGroupAction(id: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminAction("group.update", z.object({ id: uuid, data: groupInputSchema }), { id, data: input }, async (ctx, v) => {
    await groups.updateGroup(ctx, v.id, v.data);
    refresh(v.id);
    return { id: v.id };
  });
}

export async function addMemberAction(input: unknown): Promise<ActionResult> {
  return adminAction("group.addMember", addMemberSchema, input, async (ctx, d) => {
    await groups.addMember(ctx, d);
    refresh(d.groupId);
  });
}

export async function removeMemberAction(groupId: unknown, guestId: unknown): Promise<ActionResult> {
  return adminAction("group.removeMember", z.object({ groupId: uuid, guestId: uuid }), { groupId, guestId }, async (ctx, v) => {
    await groups.removeMember(ctx, v.groupId, v.guestId);
    refresh(v.groupId);
  });
}

export async function setPrimaryContactAction(groupId: unknown, guestId: unknown): Promise<ActionResult> {
  return adminAction(
    "group.setPrimaryContact",
    z.object({ groupId: uuid, guestId: uuid.nullable() }),
    { groupId, guestId },
    async (ctx, v) => {
      await groups.setPrimaryContact(ctx, v.groupId, v.guestId);
      refresh(v.groupId);
    },
  );
}

export async function archiveGroupAction(id: unknown): Promise<ActionResult> {
  return adminAction("group.archive", uuid, id, async (ctx, groupId) => {
    await groups.archiveGroup(ctx, groupId);
    refresh(groupId);
  });
}

export async function restoreGroupAction(id: unknown): Promise<ActionResult> {
  return adminAction("group.restore", uuid, id, async (ctx, groupId) => {
    await groups.restoreGroup(ctx, groupId);
    refresh(groupId);
  });
}
