import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Plain factory (no `server-only`) so the seed script and integration tests can
 * create a client against a specific database. App code imports `prisma`
 * from ./client instead.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
