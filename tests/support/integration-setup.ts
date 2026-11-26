import "dotenv/config";

// Point the app's lazy Prisma client (src/lib/prisma/client.ts) at the TEST database
// before any service module is imported.
if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is not set");
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.LOG_LEVEL = "error";
