import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { createPrismaClient } from "./create-client";

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { __weddingPrisma?: PrismaClient };

function getClient(): PrismaClient {
  if (!globalForPrisma.__weddingPrisma) {
    globalForPrisma.__weddingPrisma = createPrismaClient(env().DATABASE_URL);
  }
  return globalForPrisma.__weddingPrisma;
}

/**
 * Lazily-created client. Importing this module has no side effects, so
 * `next build` (which imports route modules to collect config) does not need
 * runtime secrets or a database. The environment is validated on first use
 * and at server start (src/instrumentation.ts).
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client) as unknown;
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});
