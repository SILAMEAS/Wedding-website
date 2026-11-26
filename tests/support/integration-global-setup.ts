import { execSync } from "node:child_process";
import "dotenv/config";

/**
 * Brings the dedicated TEST database up to date by applying pending migrations
 * (including the hand-written constraints migration). `migrate deploy` never
 * drops data or the schema; individual tests empty tables via TRUNCATE
 * (tests/support/test-db.ts).
 * Refuses to run against anything that does not look like a test database.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
  const dbName = new URL(url).pathname.replace("/", "");
  if (!dbName.includes("test")) {
    throw new Error(`Refusing to run integration tests against database "${dbName}" (name must contain "test").`);
  }
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
