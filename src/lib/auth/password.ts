import { hash, verify } from "@node-rs/argon2";

// `Algorithm` is a const enum (not importable under isolatedModules). Argon2id = 2.
const ARGON2ID = 2;

/**
 * Argon2id with OWASP-recommended parameters (19 MiB, t=2, p=1).
 * The encoded hash string carries its parameters, so they can be raised later
 * without breaking existing hashes (see needsRehash).
 */
const OPTIONS = { algorithm: ARGON2ID, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export { PASSWORD_MAX, PASSWORD_MIN } from "./password-policy";

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(encoded: string, password: string): Promise<boolean> {
  try {
    return await verify(encoded, password);
  } catch {
    return false;
  }
}

export function needsRehash(encoded: string): boolean {
  return !encoded.startsWith(`$argon2id$v=19$m=${OPTIONS.memoryCost},t=${OPTIONS.timeCost},p=${OPTIONS.parallelism}$`);
}

// Pre-computed hash of a random string. Verifying against it when the username
// does not exist keeps response timing similar for unknown vs known accounts.
let dummy: Promise<string> | undefined;
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(`dummy-${Math.random()}-${Date.now()}`);
  return dummy;
}
