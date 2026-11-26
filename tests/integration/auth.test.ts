import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sha256 } from "@/lib/security/crypto";
import { AppError } from "@/server/errors";
import { changePassword, listSessions, login, logout, revokeOtherSessions, SESSION_IDLE_MS, validateSession } from "@/server/services/auth.service";
import { ADMIN_PASSWORD, createAdmin } from "../support/fixtures";
import { createTestPrisma, resetDatabase } from "../support/test-db";

const prisma = createTestPrisma();
afterAll(() => prisma.$disconnect());
beforeEach(() => resetDatabase(prisma));

const meta = (ip = "ip-1") => ({ ipHash: ip, userAgent: "vitest" });

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}

describe("admin login", () => {
  it("logs in with correct credentials, creates a hashed session and an audit entry", async () => {
    const admin = await createAdmin(prisma);
    const { sessionToken, expiresAt } = await login("  Couple ", ADMIN_PASSWORD, meta());
    expect(sessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const session = await prisma.adminSession.findFirstOrThrow({ where: { adminUserId: admin.id } });
    expect(session.tokenHash).toBe(sha256(sessionToken)); // only the hash is stored
    expect(session.tokenHash).not.toContain(sessionToken);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "auth.login" } });
    expect(audit.actorLabel).toBe("Shared couple account");
    expect(JSON.stringify(audit)).not.toContain(sessionToken);
  });

  it("returns the same generic error for a wrong password and an unknown user", async () => {
    await createAdmin(prisma);
    await expectCode(login("couple", "wrong password!!", meta()), "invalidCredentials");
    await expectCode(login("nobody", "wrong password!!", meta()), "invalidCredentials");
    expect(await prisma.auditLog.count({ where: { action: "auth.login_failed" } })).toBe(2);
  });

  it("locks the account after 10 consecutive failures", async () => {
    await createAdmin(prisma);
    for (let i = 0; i < 10; i++) {
      await expectCode(login("couple", `wrong-${i}-password`, meta(`ip-${i}`)), "invalidCredentials");
    }
    // Even the correct password is refused while locked.
    await expectCode(login("couple", ADMIN_PASSWORD, meta("ip-x")), "accountLocked");
  });

  it("rate-limits repeated attempts from one IP", async () => {
    await createAdmin(prisma);
    for (let i = 0; i < 20; i++) {
      await login(`user${i}`, "whatever-password", meta("same-ip")).catch(() => undefined);
    }
    await expectCode(login("couple", ADMIN_PASSWORD, meta("same-ip")), "rateLimited");
  });

  it("refuses inactive accounts", async () => {
    const admin = await createAdmin(prisma);
    await prisma.adminUser.update({ where: { id: admin.id }, data: { isActive: false } });
    await expectCode(login("couple", ADMIN_PASSWORD, meta()), "invalidCredentials");
  });
});

describe("sessions", () => {
  it("validates a live session and rejects garbage", async () => {
    await createAdmin(prisma);
    const { sessionToken } = await login("couple", ADMIN_PASSWORD, meta());
    const ctx = await validateSession(sessionToken, "ip-1");
    expect(ctx?.role).toBe("OWNER");
    expect(await validateSession("not-a-real-token", null)).toBeNull();
    expect(await validateSession(undefined, null)).toBeNull();
  });

  it("rejects expired, idle and revoked sessions", async () => {
    await createAdmin(prisma);
    const a = await login("couple", ADMIN_PASSWORD, meta());
    const b = await login("couple", ADMIN_PASSWORD, meta());
    const c = await login("couple", ADMIN_PASSWORD, meta());

    await prisma.adminSession.update({ where: { tokenHash: sha256(a.sessionToken) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await prisma.adminSession.update({
      where: { tokenHash: sha256(b.sessionToken) },
      data: { lastSeenAt: new Date(Date.now() - SESSION_IDLE_MS - 1000) },
    });
    const ctxC = (await validateSession(c.sessionToken, null))!;
    await logout(ctxC);

    expect(await validateSession(a.sessionToken, null)).toBeNull();
    expect(await validateSession(b.sessionToken, null)).toBeNull();
    expect(await validateSession(c.sessionToken, null)).toBeNull();
  });

  it("password change keeps the current session and revokes all others", async () => {
    await createAdmin(prisma);
    const current = await login("couple", ADMIN_PASSWORD, meta());
    const other = await login("couple", ADMIN_PASSWORD, meta());
    const ctx = (await validateSession(current.sessionToken, null))!;

    await expectCode(changePassword(ctx, "not my password", "a brand new password"), "wrongCurrentPassword");
    await expectCode(changePassword(ctx, ADMIN_PASSWORD, ADMIN_PASSWORD), "passwordReused");
    await changePassword(ctx, ADMIN_PASSWORD, "a brand new password");

    expect(await validateSession(current.sessionToken, null)).not.toBeNull();
    expect(await validateSession(other.sessionToken, null)).toBeNull();
    await expectCode(login("couple", ADMIN_PASSWORD, meta("ip-2")), "invalidCredentials");
    await expect(login("couple", "a brand new password", meta("ip-3"))).resolves.toBeTruthy();
  });

  it("revoke-others leaves only the current session", async () => {
    await createAdmin(prisma);
    const current = await login("couple", ADMIN_PASSWORD, meta());
    await login("couple", ADMIN_PASSWORD, meta());
    await login("couple", ADMIN_PASSWORD, meta());
    const ctx = (await validateSession(current.sessionToken, null))!;
    expect(await revokeOtherSessions(ctx)).toBe(2);
    const sessions = await listSessions(ctx);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.isCurrent).toBe(true);
  });
});
