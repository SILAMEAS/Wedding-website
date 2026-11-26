import "server-only";
import { prisma } from "@/lib/prisma/client";

/**
 * Fixed-window rate limiter stored in PostgreSQL (one atomic upsert per hit).
 * Works across serverless instances without Redis; adequate at wedding scale.
 */
export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export const LIMITS = {
  loginPerIp: { limit: 20, windowSeconds: 15 * 60 },
  // Higher than the 10-failure account lockout (auth.service) so the lockout
  // triggers first for real accounts; this mainly throttles unknown usernames.
  loginPerUser: { limit: 30, windowSeconds: 15 * 60 },
  // Many guests may share one IP (venue Wi-Fi, mobile carrier NAT): valid lookups get a
  // generous limit; only INVALID token guesses are tightly limited (enumeration defence).
  tokenLookupPerIp: { limit: 600, windowSeconds: 5 * 60 },
  invalidTokenPerIp: { limit: 30, windowSeconds: 10 * 60 },
  rsvpPerInvitation: { limit: 20, windowSeconds: 60 * 60 },
  wishPerInvitation: { limit: 5, windowSeconds: 60 * 60 },
  wishPerIp: { limit: 10, windowSeconds: 60 * 60 },
  giftPerInvitation: { limit: 10, windowSeconds: 24 * 60 * 60 },
  uploadPerIp: { limit: 20, windowSeconds: 60 * 60 },
} as const;

export async function hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const rows = await prisma.$queryRaw<{ count: number; expires_at: Date }[]>`
    INSERT INTO rate_limit_buckets (key, window_start, count, expires_at)
    VALUES (${key}, now(), 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT (key) DO UPDATE SET
      count        = CASE WHEN rate_limit_buckets.expires_at <= now() THEN 1 ELSE rate_limit_buckets.count + 1 END,
      window_start = CASE WHEN rate_limit_buckets.expires_at <= now() THEN now() ELSE rate_limit_buckets.window_start END,
      expires_at   = CASE WHEN rate_limit_buckets.expires_at <= now()
                          THEN now() + make_interval(secs => ${windowSeconds})
                          ELSE rate_limit_buckets.expires_at END
    RETURNING count, expires_at`;
  const row = rows[0];
  if (!row) return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  const count = Number(row.count);
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: count <= limit ? 0 : Math.max(1, Math.ceil((row.expires_at.getTime() - Date.now()) / 1000)),
  };
}

export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimitBucket.deleteMany({ where: { key } });
}

/** Read a bucket without incrementing it. */
export async function isRateLimited(key: string, limit: number): Promise<boolean> {
  const row = await prisma.rateLimitBucket.findUnique({ where: { key }, select: { count: true, expiresAt: true } });
  return !!row && row.expiresAt > new Date() && row.count >= limit;
}
