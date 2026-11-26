import type { PrismaClient } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import type { AdminContext } from "@/server/context";

export const ADMIN_PASSWORD = "correct horse battery staple";

export async function createAdmin(prisma: PrismaClient, username = "couple") {
  return prisma.adminUser.create({
    data: { username, displayName: "Sila & Kimsour", role: "OWNER", passwordHash: await hashPassword(ADMIN_PASSWORD) },
  });
}

export async function adminCtx(prisma: PrismaClient): Promise<AdminContext> {
  const admin = await createAdmin(prisma, `admin-${Math.random().toString(36).slice(2, 8)}`);
  const session = await prisma.adminSession.create({
    data: { adminUserId: admin.id, tokenHash: `test-${admin.id}`, expiresAt: new Date(Date.now() + 3_600_000) },
  });
  return { adminUserId: admin.id, sessionId: session.id, role: "OWNER", displayName: admin.displayName, ipHash: "test-ip" };
}

export function tokenFromUrl(url: string): string {
  const token = url.split("/invitation/")[1];
  if (!token) throw new Error(`No token in ${url}`);
  return token;
}
