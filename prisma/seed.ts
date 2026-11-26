import "dotenv/config";
import { hashPassword, PASSWORD_MIN } from "../src/lib/auth/password";
import { createPrismaClient } from "../src/lib/prisma/create-client";

/**
 * Idempotent seed. Safe to run repeatedly; never overwrites values the couple
 * has already edited.
 *  - Phase 2: the WeddingSettings singleton with the couple's Khmer names from
 *    the specification. English transliterations are left blank on purpose.
 *  - Phase 3: the shared admin account, from ADMIN_SEED_USERNAME /
 *    ADMIN_SEED_PASSWORD (only if no admin exists yet).
 * No wedding date, venue, bank or contact data is invented.
 */
async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const prisma = createPrismaClient(url);

  try {
    const settings = await prisma.weddingSettings.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        groomName: { kh: "មាស សិលា", en: "" },
        brideName: { kh: "មឿក គឹមសួ", en: "" },
        sectionVisibility: {
          story: true,
          events: true,
          gallery: true,
          locations: true,
          rsvp: true,
          wishes: true,
          gifts: true,
        },
      },
      select: { id: true, updatedAt: true },
    });
    console.log(`WeddingSettings ready (id=${settings.id}).`);

    // ---- Shared admin account (created once; never overwritten) ----
    const existingAdmins = await prisma.adminUser.count();
    const username = process.env.ADMIN_SEED_USERNAME?.trim().toLowerCase();
    const password = process.env.ADMIN_SEED_PASSWORD;
    if (existingAdmins > 0) {
      console.log("Admin account already exists — skipping (change the password in Admin › Security).");
    } else if (!username || !password) {
      console.log("No admin created: set ADMIN_SEED_USERNAME and ADMIN_SEED_PASSWORD, then run `npm run db:seed` again.");
    } else {
      if (!/^[a-z0-9._-]{3,64}$/.test(username)) throw new Error("ADMIN_SEED_USERNAME: 3-64 chars of a-z, 0-9, . _ -");
      if (password.length < PASSWORD_MIN) throw new Error(`ADMIN_SEED_PASSWORD must be at least ${PASSWORD_MIN} characters`);
      await prisma.adminUser.create({
        data: { username, displayName: "Sila & Kimsour", role: "OWNER", passwordHash: await hashPassword(password) },
      });
      console.log(`Admin account "${username}" created. Remove ADMIN_SEED_PASSWORD from your environment now.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
