import { env } from "@/lib/env";
import { decryptSecret, encryptSecret, generateToken, hmacSha256 } from "./crypto";

/** Invitation token helpers bound to the configured secrets. */

export function newInvitationToken(): { raw: string; hash: string; ciphertext: string } {
  const raw = generateToken();
  return { raw, hash: hashInvitationToken(raw), ciphertext: encryptSecret(raw, env().TOKEN_ENCRYPTION_KEY) };
}

export function hashInvitationToken(raw: string): string {
  return hmacSha256(env().TOKEN_HASH_PEPPER, raw);
}

export function decryptInvitationToken(ciphertext: string): string {
  return decryptSecret(ciphertext, env().TOKEN_ENCRYPTION_KEY);
}

/** Privacy-preserving IP fingerprint for rate limiting (never store raw IPs). */
export function hashIp(ip: string): string {
  return hmacSha256(env().AUTH_SECRET, `ip:${ip}`).slice(0, 32);
}

export function invitationUrl(rawToken: string, locale: "kh" | "en"): string {
  return new URL(`/${locale}/invitation/${rawToken}`, env().APP_URL).toString();
}
