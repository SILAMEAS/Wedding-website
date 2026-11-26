import { env } from "@/lib/env";
import { hmacSha256, safeEqual } from "@/lib/security/crypto";

/**
 * Signed guest cookie set after a valid invitation is opened. It carries only
 * ids (never the raw token) and is re-validated against the database on use,
 * so rotating/revoking the link immediately invalidates it.
 */
export const GUEST_COOKIE_MAX_AGE = 90 * 24 * 60 * 60;

export function guestCookieName(): string {
  return process.env.NODE_ENV === "production" ? "__Host-wedding_inv" : "wedding_inv";
}

export type GuestCookiePayload = { i: string; t: string; e: number }; // invitationId, tokenId, expiry (unix s)

export function signGuestCookie(invitationId: string, tokenId: string, now = Date.now()): string {
  const payload: GuestCookiePayload = { i: invitationId, t: tokenId, e: Math.floor(now / 1000) + GUEST_COOKIE_MAX_AGE };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmacSha256(env().AUTH_SECRET, `inv:${body}`)}`;
}

export function verifyGuestCookie(value: string | undefined, now = Date.now()): GuestCookiePayload | null {
  if (!value || value.length > 400) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig || !safeEqual(sig, hmacSha256(env().AUTH_SECRET, `inv:${body}`))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as GuestCookiePayload;
    if (typeof p.i !== "string" || typeof p.t !== "string" || typeof p.e !== "number" || p.e * 1000 < now) return null;
    return p;
  } catch {
    return null;
  }
}

export function guestCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const, // links arrive from Telegram/Messenger: must survive top-level navigation
    path: "/",
    maxAge: GUEST_COOKIE_MAX_AGE,
  };
}
