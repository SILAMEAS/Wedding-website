import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { redact } from "@/lib/logger";
import { prisma } from "@/lib/prisma/client";
import type { AdminContext, Db } from "@/server/context";

/**
 * Append-only audit trail (UPDATE/DELETE blocked by a DB trigger).
 *
 * Limitation: the couple share ONE admin account, so entries identify the
 * shared account — they cannot tell which partner performed an action.
 */
export const SHARED_ACCOUNT_LABEL = "Shared couple account";

export type AuditAction =
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.password_change"
  | "auth.session_revoke"
  | "auth.sessions_revoke_all"
  | "guest.create"
  | "guest.update"
  | "guest.archive"
  | "guest.restore"
  | "guest.import"
  | "group.create"
  | "group.update"
  | "group.members_change"
  | "group.archive"
  | "group.restore"
  | "invitation.create"
  | "invitation.update"
  | "invitation.activate"
  | "invitation.deactivate"
  | "invitation.revoke"
  | "invitation.token_rotate"
  | "invitation.link_reveal"
  | "invitation.qr_download"
  | "settings.update"
  | "content.create"
  | "content.update"
  | "content.delete"
  | "content.archive"
  | "content.reorder"
  | "gallery.album_create"
  | "gallery.album_update"
  | "gallery.album_archive"
  | "gallery.photos_add"
  | "gallery.photo_update"
  | "gallery.photo_delete"
  | "gallery.cover_set"
  | "rsvp.override"
  | "wish.approve"
  | "wish.reject"
  | "wish.hide"
  | "wish.edit"
  | "wish.archive"
  | "payment_method.create"
  | "payment_method.update"
  | "payment_method.archive"
  | "gift.record"
  | "gift.verify"
  | "gift.reject"
  | "gift.cancel"
  | "gift.reopen"
  | "gift.correct"
  | "gift.evidence_view"
  | "checkin.confirm"
  | "checkin.override"
  | "checkin.void"
  | "export.download";

export function actorLabelFor(ctx: Pick<AdminContext, "role" | "displayName">): string {
  return ctx.role === "OWNER" ? SHARED_ACCOUNT_LABEL : ctx.displayName;
}

export async function recordAudit(
  db: Db | typeof prisma,
  ctx: AdminContext | null,
  entry: { action: AuditAction; entityType: string; entityId?: string | null; metadata?: Record<string, unknown> },
): Promise<void> {
  await db.auditLog.create({
    data: {
      adminUserId: ctx?.adminUserId ?? null,
      actorLabel: ctx ? actorLabelFor(ctx) : "Anonymous",
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ? (redact(entry.metadata) as Prisma.InputJsonValue) : undefined,
      ipHash: ctx?.ipHash ?? null,
    },
  });
}

export type AuditListFilters = { action?: string; entityType?: string; page: number; pageSize: number };

export async function listAuditLogs(_ctx: AdminContext, f: AuditListFilters) {
  const where: Prisma.AuditLogWhereInput = {
    ...(f.action ? { action: { startsWith: f.action } } : {}),
    ...(f.entityType ? { entityType: f.entityType } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: { id: true, createdAt: true, actorLabel: true, action: true, entityType: true, entityId: true, metadata: true },
    }),
  ]);
  return { total, rows };
}
