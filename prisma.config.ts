import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma CLI configuration (migrations, seed). The app runtime connects via
// src/lib/prisma/client.ts using the pg driver adapter.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations must use the direct (non-pooled) connection.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
