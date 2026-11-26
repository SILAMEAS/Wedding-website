"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guestSettingsSchema, paymentMethodSchema } from "@/features/content/schemas";
import { rsvpSchema } from "@/features/guest-actions/schemas";
import { uuid } from "@/features/shared/schemas";
import type { ActionResult } from "@/server/action-result";
import { updateGuestSettings } from "@/server/services/content.service";
import { savePaymentMethod } from "@/server/services/gift.service";
import { overrideRsvp } from "@/server/services/rsvp.service";
import { editWish, moderateWish } from "@/server/services/wish.service";
import { adminAction } from "./admin-action";

export async function updateGuestSettingsAction(input: unknown): Promise<ActionResult> {
  return adminAction("settings.guest", guestSettingsSchema, input, async (ctx, d) => {
    await updateGuestSettings(ctx, d);
    revalidatePath("/admin/content");
  });
}

export async function savePaymentMethodAction(input: unknown): Promise<ActionResult> {
  return adminAction("paymentMethod.save", paymentMethodSchema, input, async (ctx, d) => {
    await savePaymentMethod(ctx, d);
    revalidatePath("/admin/payment-methods");
  });
}

export async function moderateWishAction(id: unknown, action: unknown): Promise<ActionResult> {
  return adminAction(
    "wish.moderate",
    z.object({ id: uuid, action: z.enum(["approve", "reject", "hide", "archive"]) }),
    { id, action },
    async (ctx, d) => {
      await moderateWish(ctx, d.id, d.action);
      revalidatePath("/admin/wishes");
    },
  );
}

export async function editWishAction(input: unknown): Promise<ActionResult> {
  return adminAction(
    "wish.edit",
    z.object({ id: uuid, authorName: z.string().trim().min(1).max(80), message: z.string().trim().min(1).max(1000) }),
    input,
    async (ctx, d) => {
      await editWish(ctx, d.id, d);
      revalidatePath("/admin/wishes");
    },
  );
}

export async function overrideRsvpAction(input: unknown): Promise<ActionResult> {
  return adminAction(
    "rsvp.override",
    z.object({ invitationId: uuid, rsvp: rsvpSchema, reason: z.string().trim().min(3, { message: "reasonRequired" }).max(300) }),
    input,
    async (ctx, d) => {
      await overrideRsvp(ctx, d.invitationId, d.rsvp, d.reason);
      revalidatePath(`/admin/invitations/${d.invitationId}`);
    },
  );
}
