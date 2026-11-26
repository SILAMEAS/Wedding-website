"use server";

import { giftNotificationSchema, rsvpSchema, wishSchema } from "@/features/guest-actions/schemas";
import { getRequestMeta } from "@/lib/request-meta";
import { type ActionResult, runAction } from "@/server/action-result";
import { AppError } from "@/server/errors";
import { getGuestAccess } from "@/server/policies/guest";
import { createGiftNotification } from "@/server/services/gift.service";
import { hitRateLimit, LIMITS } from "@/server/services/rate-limit.service";
import { submitGuestRsvp } from "@/server/services/rsvp.service";
import { resolveTokenGuarded } from "@/server/services/token-guard.service";
import { submitWish } from "@/server/services/wish.service";

/*
 * Guest-facing actions. The invitation is always resolved server-side from
 * the token (RSVP, gifts) or the signed guest cookie (wishes) — never from
 * ids sent by the browser.
 */

async function invitationFromToken(token: unknown): Promise<string> {
  if (typeof token !== "string" || token.length > 64) throw new AppError("invitationInvalid");
  const meta = await getRequestMeta();
  const res = await resolveTokenGuarded(token, meta.ipHash);
  if (res.status === "tooMany") throw new AppError("rateLimited", { seconds: 600 });
  if (res.status !== "valid") throw new AppError("invitationInvalid");
  return res.invitation.invitationId;
}

export async function submitRsvpAction(token: unknown, input: unknown): Promise<ActionResult<{ status: string; attendingCount: number }>> {
  return runAction("public.rsvp", rsvpSchema, input, async (data) => {
    const invitationId = await invitationFromToken(token);
    const limit = await hitRateLimit(`rsvp:inv:${invitationId}`, LIMITS.rsvpPerInvitation.limit, LIMITS.rsvpPerInvitation.windowSeconds);
    if (!limit.allowed) throw new AppError("rateLimited", { seconds: limit.retryAfterSeconds });
    const r = await submitGuestRsvp(invitationId, data);
    return { status: r.status, attendingCount: r.attendingCount };
  });
}

/** Wishes: from the invitation page (token) or the /wishes page (signed guest cookie). */
export async function submitWishAction(input: unknown, token?: unknown): Promise<ActionResult> {
  return runAction("public.wish", wishSchema, input, async (data) => {
    const access = token ? { invitationId: await invitationFromToken(token) } : await getGuestAccess();
    if (!access) throw new AppError("invitationInvalid");
    const meta = await getRequestMeta();
    await submitWish(access, data, meta.ipHash);
  });
}

export async function submitGiftAction(token: unknown, input: unknown): Promise<ActionResult> {
  return runAction("public.gift", giftNotificationSchema, input, async (data) => {
    const invitationId = await invitationFromToken(token);
    await createGiftNotification(invitationId, data);
  });
}
