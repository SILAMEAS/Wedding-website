import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Pure crypto primitives. Keys are passed in explicitly so the functions are
 * unit-testable; app code uses the env-bound wrappers in ./tokens.ts.
 */

/** 256-bit random token, base64url (43 chars, no padding). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isWellFormedToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

/** Keyed hash for lookups of high-entropy secrets (invitation tokens, IPs). */
export function hmacSha256(key: string, value: string): string {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

/** Unkeyed hash for random session ids (already 256-bit; no pepper needed). */
export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const VERSION = "v1";

/** AES-256-GCM. Output: v1.<iv>.<tag>.<ciphertext> (base64url parts). */
export function encryptSecret(plaintext: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) throw new Error("Encryption key must be 32 bytes");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(payload: string, keyBase64: string): string {
  const [version, iv, tag, ct] = payload.split(".");
  if (version !== VERSION || !iv || !tag || !ct) throw new Error("Unsupported ciphertext format");
  const key = Buffer.from(keyBase64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
