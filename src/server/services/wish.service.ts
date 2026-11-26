import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { WishStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma/client";
import { sha256 } from "@/lib/security/crypto";
import type { AdminContext } from "@/server/context";
import { AppError } from "@/server/errors";
import { recordAudit } from "./audit.service";
import { PAGE_SIZE } from "./guest.service";
import { hitRateLimit, LIMITS } from "./rate-limit.service";

/*
 * Wishes / guestbook.
 *  - Every new wish is PENDING. Only APPROVED + PUBLIC wishes are ever shown publicly.
 *  - PRIVATE wishes are visible to the couple only.
 *  - Spam: honeypot, per-invitation and per-IP rate limits, duplicate detection.
 *  - Text is stored and rendered as plain text (React escapes it; no HTML).
 */

type GuestWishInput = { authorName: string; relationship?: string; message: string; visibility: "PUBLIC" | "PRIVATE"; website?: string };

function normalize(message: string): string {
  return message.toLowerCase().replace(/\s+/g, " ").trim();
}

export async function wishesEnabled(): Promise<boolean> {
  const s = await prisma.weddingSettings.findUnique({ where: { id: 1 }, select: { wishesPublicEnabled: true, sectionVisibility: true } });
  const sections = (s?.sectionVisibility ?? {}) as Record<string, boolean>;
  return (s?.wishesPublicEnabled ?? true) && sections.wishes !== false;
}

/** Returns "accepted" even for silently dropped spam so bots learn nothing. */
export async function submitWish(
  access: { invitationId: string },
  input: GuestWishInput,
  ipHash: string,
): Promise<"accepted"> {
  if (input.website) return "accepted"; // honeypot tripped: pretend success, store nothing
  if (!(await wishesEnabled())) throw new AppError("wishesClosed");

  const [perInv, perIp] = await Promise.all([
    hitRateLimit(`wish:inv:${access.invitationId}`, LIMITS.wishPerInvitation.limit, LIMITS.wishPerInvitation.windowSeconds),
    hitRateLimit(`wish:ip:${ipHash}`, LIMITS.wishPerIp.limit, LIMITS.wishPerIp.windowSeconds),
  ]);
  if (!perInv.allowed || !perIp.allowed) throw new AppError("rateLimited", { seconds: Math.max(perInv.retryAfterSeconds, perIp.retryAfterSeconds) });

  const contentHash = sha256(`${access.invitationId}:${normalize(input.message)}`);
  const duplicate = await prisma.wish.count({ where: { contentHash, createdAt: { gt: new Date(Date.now() - 7 * 86400_000) } } });
  if (duplicate > 0) throw new AppError("duplicateWish");

  const inv = await prisma.invitation.findUnique({ where: { id: access.invitationId }, select: { type: true, guestId: true } });
  await prisma.wish.create({
    data: {
      invitationId: access.invitationId,
      guestId: inv?.type === "INDIVIDUAL" ? inv.guestId : null,
      authorName: input.authorName,
      relationship: input.relationship ?? null,
      message: input.message,
      visibility: input.visibility,
      status: "PENDING",
      contentHash,
    },
  });
  return "accepted";
}

export type PublicWish = { id: string; authorName: string; relationship: string | null; message: string; createdAt: Date };

/** Approved, public wishes only — never pending, rejected, hidden, archived or private ones. */
export async function listPublicWishes(take = 50): Promise<PublicWish[]> {
  if (!(await wishesEnabled())) return [];
  return prisma.wish.findMany({
    where: { status: "APPROVED", visibility: "PUBLIC" },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, authorName: true, relationship: true, message: true, createdAt: true },
  });
}

// ------------------------------------------------------------------ admin

export const WISH_FILTERS = ["PENDING", "APPROVED", "PRIVATE", "REJECTED", "HIDDEN", "ARCHIVED"] as const;
export type WishFilter = (typeof WISH_FILTERS)[number];

export async function listWishesForAdmin(_ctx: AdminContext, filter: WishFilter, page: number, q?: string) {
  const where: Prisma.WishWhereInput = {
    ...(filter === "PRIVATE" ? { visibility: "PRIVATE", status: { notIn: ["ARCHIVED", "REJECTED"] } } : { status: filter }),
    ...(q ? { OR: [{ authorName: { contains: q, mode: "insensitive" } }, { message: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [total, rows, counts] = await Promise.all([
    prisma.wish.count({ where }),
    prisma.wish.findMany({
      where,
      orderBy: { createdAt: filter === "PENDING" ? "asc" : "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        invitation: { select: { id: true, guest: { select: { nameEn: true, nameKh: true } }, group: { select: { nameEn: true, nameKh: true } } } },
      },
    }),
    prisma.wish.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<WishStatus, number>>;
  return { total, rows, pageSize: PAGE_SIZE, byStatus };
}

const TRANSITIONS: Record<"approve" | "reject" | "hide" | "archive", { to: WishStatus; from: WishStatus[] }> = {
  approve: { to: "APPROVED", from: ["PENDING", "REJECTED", "HIDDEN"] },
  reject: { to: "REJECTED", from: ["PENDING", "APPROVED", "HIDDEN"] },
  hide: { to: "HIDDEN", from: ["APPROVED"] },
  archive: { to: "ARCHIVED", from: ["PENDING", "APPROVED", "REJECTED", "HIDDEN"] },
};

export async function moderateWish(ctx: AdminContext, id: string, action: keyof typeof TRANSITIONS) {
  const t = TRANSITIONS[action];
  await prisma.$transaction(async (tx) => {
    const res = await tx.wish.updateMany({
      where: { id, status: { in: t.from } },
      data: { status: t.to, moderatedAt: new Date(), moderatedById: ctx.adminUserId },
    });
    if (res.count === 0) throw new AppError("staleData");
    await recordAudit(tx, ctx, { action: `wish.${action}`, entityType: "Wish", entityId: id });
  });
}

/** Admin edit (e.g. fix a typo). The guest's original text is preserved once. */
export async function editWish(ctx: AdminContext, id: string, input: { authorName: string; message: string }) {
  await prisma.$transaction(async (tx) => {
    const w = await tx.wish.findUnique({ where: { id } });
    if (!w) throw new AppError("notFound");
    await tx.wish.update({
      where: { id },
      data: { authorName: input.authorName, message: input.message, originalMessage: w.originalMessage ?? w.message, moderatedById: ctx.adminUserId },
    });
    await recordAudit(tx, ctx, { action: "wish.edit", entityType: "Wish", entityId: id });
  });
}
