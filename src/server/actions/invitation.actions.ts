"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createInvitationSchema, updateInvitationSchema } from "@/features/invitations/schemas";
import { optionalText, uuid } from "@/features/shared/schemas";
import { defaultLocale } from "@/i18n/locales";
import type { ActionResult } from "@/server/action-result";
import * as invitations from "@/server/services/invitation.service";
import { adminAction } from "./admin-action";

function refresh(id?: string) {
  revalidatePath("/admin/invitations");
  revalidatePath("/admin/dashboard");
  if (id) revalidatePath(`/admin/invitations/${id}`);
}

export async function createInvitationAction(input: unknown): Promise<ActionResult<invitations.CreatedInvitation>> {
  return adminAction("invitation.create", createInvitationSchema, input, async (ctx, d) => {
    const created =
      d.type === "INDIVIDUAL"
        ? await invitations.createIndividualInvitation(ctx, d, defaultLocale)
        : await invitations.createFamilyInvitation(ctx, d, defaultLocale);
    refresh();
    return created;
  });
}

export async function updateInvitationAction(input: unknown): Promise<ActionResult> {
  return adminAction("invitation.update", updateInvitationSchema, input, async (ctx, d) => {
    await invitations.updateInvitation(ctx, d);
    refresh(d.id);
  });
}

export async function setInvitationActiveAction(id: unknown, active: unknown): Promise<ActionResult> {
  return adminAction("invitation.setActive", z.object({ id: uuid, active: z.boolean() }), { id, active }, async (ctx, v) => {
    await invitations.setInvitationActive(ctx, v.id, v.active);
    refresh(v.id);
  });
}

export async function revokeInvitationAction(id: unknown, reason: unknown): Promise<ActionResult> {
  return adminAction("invitation.revoke", z.object({ id: uuid, reason: optionalText(300) }), { id, reason }, async (ctx, v) => {
    await invitations.revokeInvitation(ctx, v.id, v.reason);
    refresh(v.id);
  });
}

export async function rotateInvitationTokenAction(id: unknown): Promise<ActionResult<{ url: string }>> {
  return adminAction("invitation.rotate", uuid, id, async (ctx, invitationId) => {
    const url = await invitations.rotateInvitationToken(ctx, invitationId, defaultLocale);
    refresh(invitationId);
    return { url };
  });
}

export async function revealInvitationLinkAction(id: unknown): Promise<ActionResult<{ url: string }>> {
  return adminAction("invitation.reveal", uuid, id, async (ctx, invitationId) => {
    const { url } = await invitations.revealInvitationLink(ctx, invitationId, defaultLocale);
    return { url };
  });
}
