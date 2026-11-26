import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { guestCookieName, verifyGuestCookie } from "@/lib/auth/guest-cookie";
import { prisma } from "@/lib/prisma/client";

export type GuestAccess = { invitationId: string; tokenId: string };

/** Resolves the guest cookie to a still-valid invitation, or null. Never trusts the cookie alone. */
export const getGuestAccess = cache(async (): Promise<GuestAccess | null> => {
  const payload = verifyGuestCookie((await cookies()).get(guestCookieName())?.value);
  if (!payload) return null;
  const token = await prisma.invitationToken.findFirst({
    where: { id: payload.t, invitationId: payload.i, status: "ACTIVE", invitation: { status: "ACTIVE" } },
    select: { id: true },
  });
  return token ? { invitationId: payload.i, tokenId: payload.t } : null;
});
