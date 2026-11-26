"use server";

import { cookies } from "next/headers";
import { guestCookieName, guestCookieOptions, signGuestCookie } from "@/lib/auth/guest-cookie";
import { getRequestMeta } from "@/lib/request-meta";
import { recordInvitationAccess } from "@/server/services/invitation.service";
import { resolveTokenGuarded } from "@/server/services/token-guard.service";

/**
 * Guest pressed "Open invitation": record a meaningful open and set the signed
 * guest cookie (unlocks invitation-only albums). The token is re-validated here;
 * nothing from the client is trusted beyond the token string itself.
 */
export async function openInvitationAction(token: unknown): Promise<{ ok: boolean }> {
  if (typeof token !== "string" || token.length > 64) return { ok: false };
  const meta = await getRequestMeta();
  const res = await resolveTokenGuarded(token, meta.ipHash);
  if (res.status !== "valid") return { ok: false };

  await recordInvitationAccess(res.invitation.invitationId, res.invitation.tokenId, "OPENED", meta.userAgent);
  (await cookies()).set(guestCookieName(), signGuestCookie(res.invitation.invitationId, res.invitation.tokenId), guestCookieOptions());
  return { ok: true };
}
