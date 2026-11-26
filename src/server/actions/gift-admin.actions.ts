"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { optionalText, uuid } from "@/features/shared/schemas";
import type { ActionResult } from "@/server/action-result";
import * as gifts from "@/server/services/gift-admin.service";
import { adminAction } from "./admin-action";

const currency = z.enum(["USD", "KHR"]);
const method = z.enum(["KHQR", "BANK_TRANSFER", "CASH", "OTHER"]);
const version = z.number().int().min(1);
const reason = z.string().trim().min(3, { message: "reasonRequired" }).max(300);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined));
const amount = z.string().trim().min(1, { message: "required" }).max(24);

function refresh(id?: string) {
  revalidatePath("/admin/gifts");
  revalidatePath("/admin/dashboard");
  if (id) revalidatePath(`/admin/gifts/${id}`);
}

export async function verifyGiftAction(input: unknown): Promise<ActionResult> {
  return adminAction("gift.verify", z.object({ id: uuid, version, receivedAmount: amount, receivedOn: date, adminNote: optionalText(500) }), input, async (ctx, d) => {
    await gifts.verifyGift(ctx, d.id, d);
    refresh(d.id);
  });
}

export async function rejectGiftAction(input: unknown): Promise<ActionResult> {
  return adminAction("gift.reject", z.object({ id: uuid, version, reason }), input, async (ctx, d) => {
    await gifts.rejectGift(ctx, d.id, d.version, d.reason);
    refresh(d.id);
  });
}

export async function cancelGiftAction(input: unknown): Promise<ActionResult> {
  return adminAction("gift.cancel", z.object({ id: uuid, version, reason }), input, async (ctx, d) => {
    await gifts.cancelGift(ctx, d.id, d.version, d.reason);
    refresh(d.id);
  });
}

export async function reopenGiftAction(input: unknown): Promise<ActionResult> {
  return adminAction("gift.reopen", z.object({ id: uuid, version, reason }), input, async (ctx, d) => {
    await gifts.reopenGift(ctx, d.id, d.version, d.reason);
    refresh(d.id);
  });
}

export async function correctGiftAction(input: unknown): Promise<ActionResult> {
  return adminAction(
    "gift.correct",
    z.object({ id: uuid, version, reason, currency, receivedAmount: amount, method, donorName: z.string().trim().min(1).max(120), transactionRef: optionalText(80) }),
    input,
    async (ctx, d) => {
      await gifts.correctGift(ctx, d.id, d);
      refresh(d.id);
    },
  );
}

export async function recordGiftAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminAction(
    "gift.record",
    z.object({
      donorName: z.string().trim().min(1, { message: "required" }).max(120),
      invitationId: uuid.optional().or(z.literal("").transform(() => undefined)),
      method,
      currency,
      amount,
      receivedOn: date,
      transactionRef: optionalText(80),
      adminNote: optionalText(500),
      confirmed: z.boolean(),
    }),
    input,
    async (ctx, d) => {
      const r = await gifts.recordGift(ctx, d);
      refresh();
      return r;
    },
  );
}
