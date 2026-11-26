import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import "dotenv/config";

/**
 * Fresh, migrated TEST database with one known admin account.
 * Seeding runs through tsx because the generated Prisma 7 client is ESM-only,
 * while Playwright loads this file as CommonJS.
 */
export default function globalSetup() {
  const url = process.env.TEST_DATABASE_URL!;
  if (!new URL(url).pathname.includes("test")) throw new Error("Refusing to run e2e against a non-test database");
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  execSync("npx tsx tests/e2e/seed-e2e.ts", { stdio: "inherit", env });
  // Test uploads live in their own folder; start each run clean.
  rmSync(".uploads-e2e", { recursive: true, force: true });
}
