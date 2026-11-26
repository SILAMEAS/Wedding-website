import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

type PgConfig = { connectionString: string; ssl?: { ca: string; rejectUnauthorized: true } };

/**
 * Connection config for node-pg.
 *
 * Managed databases with their own certificate authority (Aiven, AWS RDS, …)
 * need that CA to verify the server. Pass it as DATABASE_CA_CERT (the PEM text;
 * literal "\n" sequences are accepted so it fits in a one-line env var). The
 * certificate is always verified — verification is never switched off.
 *
 * node-pg lets ssl* parameters in the URL override the `ssl` option, so they
 * are removed from the URL when a CA is supplied.
 */
export function buildPgConfig(connectionString: string, caCert = process.env.DATABASE_CA_CERT): PgConfig {
  const ca = caCert?.trim().replace(/\\n/g, "\n");
  const url = new URL(connectionString);
  // Only for URLs that ask for TLS — a local database (no sslmode) is left alone.
  const sslmode = url.searchParams.get("sslmode");
  if (!ca || !sslmode || sslmode === "disable") return { connectionString };
  for (const key of ["sslmode", "ssl", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"]) url.searchParams.delete(key);
  return { connectionString: url.toString(), ssl: { ca, rejectUnauthorized: true } };
}

/**
 * Plain factory (no `server-only`) so the seed script and integration tests can
 * create a client against a specific database. App code imports `prisma`
 * from ./client instead.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg(buildPgConfig(connectionString));
  return new PrismaClient({ adapter });
}
