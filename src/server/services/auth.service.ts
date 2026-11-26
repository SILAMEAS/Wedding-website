import "server-only";
import { dummyHash, hashPassword, needsRehash, verifyPassword } from "@/lib/auth/password";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma/client";
import type { RequestMeta } from "@/lib/request-meta";
import { generateToken, sha256 } from "@/lib/security/crypto";
import type { AdminContext } from "@/server/context";
import { AppError } from "@/server/errors";
import { recordAudit } from "./audit.service";
import { hitRateLimit, LIMITS, resetRateLimit } from "./rate-limit.service";

export const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const SESSION_IDLE_MS = 12 * 60 * 60 * 1000; // 12 hours
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const MAX_FAILED_LOGINS = 10;
const LOCK_MS = 15 * 60 * 1000;

export type LoginResult = { sessionToken: string; expiresAt: Date };

/**
 * Verifies credentials and creates a session. Always fails with the same
 * generic error for unknown user / wrong password, so the response does not
 * reveal which usernames exist.
 */
export async function login(usernameInput: string, password: string, meta: RequestMeta): Promise<LoginResult> {
  const username = usernameInput.trim().toLowerCase();

  const [ipLimit, userLimit] = await Promise.all([
    hitRateLimit(`login:ip:${meta.ipHash}`, LIMITS.loginPerIp.limit, LIMITS.loginPerIp.windowSeconds),
    hitRateLimit(`login:user:${sha256(username)}`, LIMITS.loginPerUser.limit, LIMITS.loginPerUser.windowSeconds),
  ]);
  if (!ipLimit.allowed || !userLimit.allowed) {
    throw new AppError("rateLimited", { seconds: Math.max(ipLimit.retryAfterSeconds, userLimit.retryAfterSeconds) });
  }

  const user = await prisma.adminUser.findUnique({ where: { username } });
  if (!user || !user.isActive) {
    await verifyPassword(await dummyHash(), password); // equalize timing
    await recordAudit(prisma, null, { action: "auth.login_failed", entityType: "AdminUser", metadata: { reason: "unknown_or_inactive" } });
    throw new AppError("invalidCredentials");
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError("accountLocked", { seconds: Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000) });
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    const failed = user.failedLoginCount + 1;
    await prisma.adminUser.update({
      where: { id: user.id },
      data: failed >= MAX_FAILED_LOGINS ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } : { failedLoginCount: failed },
    });
    await recordAudit(prisma, null, { action: "auth.login_failed", entityType: "AdminUser", entityId: user.id, metadata: { reason: "bad_password" } });
    throw new AppError("invalidCredentials");
  }

  const sessionToken = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_ABSOLUTE_MS);
  const rehash = needsRehash(user.passwordHash) ? await hashPassword(password) : null;

  const session = await prisma.$transaction(async (tx) => {
    await tx.adminUser.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date(), ...(rehash ? { passwordHash: rehash } : {}) },
    });
    const s = await tx.adminSession.create({
      data: { adminUserId: user.id, tokenHash: sha256(sessionToken), expiresAt, userAgent: meta.userAgent, ipHash: meta.ipHash },
    });
    await recordAudit(tx, { adminUserId: user.id, sessionId: s.id, role: user.role, displayName: user.displayName, ipHash: meta.ipHash }, {
      action: "auth.login",
      entityType: "AdminSession",
      entityId: s.id,
    });
    return s;
  });

  await resetRateLimit(`login:user:${sha256(username)}`);
  logger.info("auth.login", { adminUserId: user.id, sessionId: session.id });
  return { sessionToken, expiresAt };
}

/** Resolves a raw session cookie value to an AdminContext, or null if invalid/expired/revoked. */
export async function validateSession(rawToken: string | undefined, ipHash: string | null): Promise<AdminContext | null> {
  if (!rawToken || rawToken.length > 100) return null;
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: sha256(rawToken) },
    include: { adminUser: { select: { id: true, role: true, displayName: true, isActive: true, passwordChangedAt: true } } },
  });
  const now = Date.now();
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt.getTime() <= now ||
    session.lastSeenAt.getTime() + SESSION_IDLE_MS <= now ||
    !session.adminUser.isActive ||
    // Sessions created before a password change are invalid.
    session.createdAt < session.adminUser.passwordChangedAt
  ) {
    return null;
  }
  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } });
  }
  return {
    adminUserId: session.adminUser.id,
    sessionId: session.id,
    role: session.adminUser.role,
    displayName: session.adminUser.displayName,
    ipHash,
  };
}

export async function logout(ctx: AdminContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.adminSession.updateMany({ where: { id: ctx.sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
    await recordAudit(tx, ctx, { action: "auth.logout", entityType: "AdminSession", entityId: ctx.sessionId });
  });
}

export async function changePassword(ctx: AdminContext, currentPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: ctx.adminUserId } });
  if (!(await verifyPassword(user.passwordHash, currentPassword))) throw new AppError("wrongCurrentPassword");
  if (await verifyPassword(user.passwordHash, newPassword)) throw new AppError("passwordReused");
  const passwordHash = await hashPassword(newPassword);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // passwordChangedAt invalidates every older session; the current one is
    // re-dated so the person changing the password stays signed in.
    await tx.adminUser.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: now } });
    await tx.adminSession.updateMany({
      where: { adminUserId: user.id, id: { not: ctx.sessionId }, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.adminSession.update({ where: { id: ctx.sessionId }, data: { createdAt: now } });
    await recordAudit(tx, ctx, { action: "auth.password_change", entityType: "AdminUser", entityId: user.id });
  });
}

export async function listSessions(ctx: AdminContext) {
  const sessions = await prisma.adminSession.findMany({
    where: { adminUserId: ctx.adminUserId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, createdAt: true, lastSeenAt: true, expiresAt: true, userAgent: true },
  });
  const idleCutoff = Date.now() - SESSION_IDLE_MS;
  return sessions
    .filter((s) => s.lastSeenAt.getTime() > idleCutoff)
    .map((s) => ({ ...s, isCurrent: s.id === ctx.sessionId }));
}

export async function revokeSession(ctx: AdminContext, sessionId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const res = await tx.adminSession.updateMany({
      where: { id: sessionId, adminUserId: ctx.adminUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (res.count === 0) throw new AppError("notFound");
    await recordAudit(tx, ctx, { action: "auth.session_revoke", entityType: "AdminSession", entityId: sessionId });
  });
}

export async function revokeOtherSessions(ctx: AdminContext): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const res = await tx.adminSession.updateMany({
      where: { adminUserId: ctx.adminUserId, id: { not: ctx.sessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await recordAudit(tx, ctx, { action: "auth.sessions_revoke_all", entityType: "AdminSession", metadata: { count: res.count } });
    return res.count;
  });
}
