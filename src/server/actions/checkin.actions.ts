"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { optionalText, uuid } from "@/features/shared/schemas";
import type { ActionResult } from "@/server/action-result";
import * as checkin from "@/server/services/checkin.service";
import { adminAction } from "./admin-action";

export async function lookupScanAction(scanned: unknown): Promise<ActionResult<checkin.CheckInParty>> {
  return adminAction("checkin.scan", z.string().max(500), scanned, (ctx, s) => checkin.lookupScan(ctx, s));
}

export async function lookupInvitationAction(id: unknown): Promise<ActionResult<checkin.CheckInParty>> {
  return adminAction("checkin.lookup", uuid, id, (ctx, i) => checkin.lookupInvitation(ctx, i));
}

export async function searchPartiesAction(q: unknown) {
  return adminAction("checkin.search", z.string().max(100), q, (ctx, s) => checkin.searchParties(ctx, s));
}

export async function confirmCheckInAction(input: unknown): Promise<ActionResult> {
  return adminAction(
    "checkin.confirm",
    z.object({ invitationId: uuid, arrivedCount: z.number().int().min(1).max(50), override: z.boolean(), reason: optionalText(300), note: optionalText(300) }),
    input,
    async (ctx, d) => {
      await checkin.confirmCheckIn(ctx, d);
      revalidatePath("/admin/check-in");
      revalidatePath("/admin/dashboard");
    },
  );
}

export async function voidCheckInAction(input: unknown): Promise<ActionResult> {
  return adminAction("checkin.void", z.object({ id: uuid, reason: z.string().trim().min(3).max(300) }), input, async (ctx, d) => {
    await checkin.voidCheckIn(ctx, d.id, d.reason);
    revalidatePath("/admin/check-in");
  });
}
