// Run with tsx from global-setup: resets the TEST database and creates the e2e admin.
import "dotenv/config";
import { hashPassword } from "../../src/lib/auth/password";
import { createTestPrisma, resetDatabase } from "../support/test-db";
import { E2E_ADMIN } from "./e2e-admin";

async function main() {
  const prisma = createTestPrisma();
  try {
    await resetDatabase(prisma);
    await prisma.weddingSettings.create({ data: { id: 1, groomName: { kh: "មាស សិលា", en: "" }, brideName: { kh: "មឿក គឹមសួ", en: "" } } });
    await prisma.adminUser.create({
      data: { username: E2E_ADMIN.username, displayName: "E2E", role: "OWNER", passwordHash: await hashPassword(E2E_ADMIN.password) },
    });
    console.log("e2e database ready");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
