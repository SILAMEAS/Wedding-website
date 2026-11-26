import "dotenv/config";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/prisma/create-client";

export function createTestPrisma(): PrismaClient {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set");
  return createPrismaClient(url);
}

/**
 * Empty every application table. TRUNCATE does not fire row-level DELETE
 * triggers, so append-only tables can be reset in tests (never in app code).
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}
