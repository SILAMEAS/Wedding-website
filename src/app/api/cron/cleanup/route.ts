import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma/client";
import { safeEqual } from "@/lib/security/crypto";
import { cleanupPendingAssets } from "@/server/services/media.service";

/**
 * Housekeeping (call hourly or daily from a scheduler, e.g. Vercel Cron):
 *  - deletes uploads never attached to a record (older than 24 h)
 *  - deletes expired/revoked admin sessions and expired rate-limit buckets
 * Auth: `Authorization: Bearer <CRON_SECRET>`.
 */
async function run(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${env().CRON_SECRET}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  const [assets, sessions, buckets] = await Promise.all([
    cleanupPendingAssets(24),
    prisma.adminSession.deleteMany({
      where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: new Date(now.getTime() - 30 * 86400_000) } }] },
    }),
    prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  const result = { assetsRemoved: assets, sessionsRemoved: sessions.count, bucketsRemoved: buckets.count };
  logger.info("cron.cleanup", result);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export const GET = run; // Vercel Cron uses GET
export const POST = run;
