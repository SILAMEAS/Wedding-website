import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma/client";

// Liveness + database ping. Returns no data beyond up/down.
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "ok" }, { headers });
  } catch (error) {
    logger.error("health.db_unreachable", { error });
    return NextResponse.json({ status: "degraded", db: "unreachable" }, { status: 503, headers });
  }
}
