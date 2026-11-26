import "server-only";
import { prisma } from "@/lib/prisma/client";
import { isWellFormedToken } from "@/lib/security/crypto";
import { hashInvitationToken } from "@/lib/security/tokens";
import { bilingualName } from "@/lib/names";
import type { AdminContext } from "@/server/context";
import { AppError } from "@/server/errors";
import { recordAudit } from "./audit.service";

/*
 * Venue check-in (admin only).
 *  - Scanning only LOOKS UP the invitation; nothing is recorded until the admin confirms.
 *  - A second check-in for the same invitation is blocked unless the admin
 *    explicitly overrides with a reason (e.g. family arriving in two cars).
 *  - Mistakes are voided (with reason), never deleted.
 */

/** Accepts a full invitation URL (from the QR code) or a bare token. */
export function extractToken(scanned: string): string | null {
  const text = scanned.trim();
  const fromUrl = text.split("/invitation/")[1]?.split(/[?#/]/)[0];
  const candidate = fromUrl ?? text;
  return isWellFormedToken(candidate) ? candidate : null;
}

export type CheckInParty = {
  invitationId: string;
  name: string;
  type: "INDIVIDUAL" | "FAMILY";
  invitationStatus: "ACTIVE" | "INACTIVE" | "REVOKED";
  tokenStatus: "ACTIVE" | "ROTATED" | "REVOKED" | null;
  members: string[];
  capacity: number;
  rsvp: { status: "ATTENDING" | "DECLINED" | "MAYBE"; attendingCount: number } | null;
  checkIns: { id: string; arrivedCount: number; checkedInAt: Date; isOverride: boolean; note: string | null }[];
  arrivedTotal: number;
};

async function loadParty(invitationId: string, tokenStatus: CheckInParty["tokenStatus"]): Promise<CheckInParty> {
  const inv = await prisma.invitation.findUnique({
    where: { id: invitationId },
    select: {
      id: true,
      type: true,
      status: true,
      capacity: true,
      guest: { select: { nameEn: true, nameKh: true } },
      group: { select: { nameEn: true, nameKh: true, members: { where: { archivedAt: null }, select: { nameEn: true, nameKh: true } } } },
      rsvp: { select: { status: true, attendingCount: true } },
      checkIns: { where: { voidedAt: null }, orderBy: { checkedInAt: "asc" }, select: { id: true, arrivedCount: true, checkedInAt: true, isOverride: true, note: true } },
    },
  });
  if (!inv) throw new AppError("notFound");
  const owner = inv.guest ?? inv.group!;
  const members = inv.type === "INDIVIDUAL" ? [bilingualName(inv.guest!)] : inv.group!.members.map(bilingualName);
  return {
    invitationId: inv.id,
    name: bilingualName(owner),
    type: inv.type,
    invitationStatus: inv.status,
    tokenStatus,
    members,
    capacity: inv.capacity,
    rsvp: inv.rsvp,
    checkIns: inv.checkIns,
    arrivedTotal: inv.checkIns.reduce((n, c) => n + c.arrivedCount, 0),
  };
}

/** Scanned QR → party summary. Shows rotated/revoked links too (with a warning) so staff can decide. */
export async function lookupScan(_ctx: AdminContext, scanned: string): Promise<CheckInParty> {
  const token = extractToken(scanned);
  if (!token) throw new AppError("notFound");
  const t = await prisma.invitationToken.findUnique({ where: { tokenHash: hashInvitationToken(token) }, select: { invitationId: true, status: true } });
  if (!t) throw new AppError("notFound");
  return loadParty(t.invitationId, t.status);
}

export async function lookupInvitation(_ctx: AdminContext, invitationId: string): Promise<CheckInParty> {
  return loadParty(invitationId, null);
}

/** Manual fallback when the camera is unavailable: search by guest/family name. */
export async function searchParties(_ctx: AdminContext, q: string) {
  const term = q.trim();
  if (term.length < 2) return [];
  const rows = await prisma.invitation.findMany({
    where: {
      status: { not: "REVOKED" },
      OR: [
        { guest: { OR: [{ nameEn: { contains: term, mode: "insensitive" } }, { nameKh: { contains: term } }] } },
        { group: { OR: [{ nameEn: { contains: term, mode: "insensitive" } }, { nameKh: { contains: term } }] } },
        { group: { members: { some: { OR: [{ nameEn: { contains: term, mode: "insensitive" } }, { nameKh: { contains: term } }] } } } },
      ],
    },
    take: 10,
    select: {
      id: true,
      capacity: true,
      guest: { select: { nameEn: true, nameKh: true } },
      group: { select: { nameEn: true, nameKh: true } },
      checkIns: { where: { voidedAt: null }, select: { arrivedCount: true } },
    },
  });
  return rows.map((r) => ({
    invitationId: r.id,
    name: bilingualName((r.guest ?? r.group)!),
    capacity: r.capacity,
    arrived: r.checkIns.reduce((n, c) => n + c.arrivedCount, 0),
  }));
}

export async function confirmCheckIn(
  ctx: AdminContext,
  input: { invitationId: string; arrivedCount: number; override: boolean; reason?: string; note?: string },
) {
  if (input.arrivedCount < 1 || input.arrivedCount > 50) throw new AppError("invalidInput");
  return prisma.$transaction(async (tx) => {
    // Serialize concurrent scans of the same QR at two entrances.
    await tx.$queryRaw`SELECT id FROM invitations WHERE id = ${input.invitationId}::uuid FOR UPDATE`;
    const inv = await tx.invitation.findUnique({
      where: { id: input.invitationId },
      select: { status: true, guest: { select: { nameEn: true, nameKh: true } }, group: { select: { nameEn: true, nameKh: true } } },
    });
    if (!inv) throw new AppError("notFound");
    const prior = await tx.guestCheckIn.count({ where: { invitationId: input.invitationId, voidedAt: null } });
    const needsOverride = prior > 0 || inv.status !== "ACTIVE";
    if (needsOverride && !input.override) throw new AppError(prior > 0 ? "alreadyCheckedIn" : "invitationInvalid");
    if (input.override && !input.reason?.trim()) throw new AppError("invalidInput");

    const checkIn = await tx.guestCheckIn.create({
      data: {
        invitationId: input.invitationId,
        displayNameSnapshot: bilingualName((inv.guest ?? inv.group)!),
        arrivedCount: input.arrivedCount,
        isOverride: input.override,
        overrideReason: input.override ? input.reason!.trim() : null,
        note: input.note ?? null,
        checkedInById: ctx.adminUserId,
      },
    });
    await recordAudit(tx, ctx, {
      action: input.override ? "checkin.override" : "checkin.confirm",
      entityType: "Invitation",
      entityId: input.invitationId,
      metadata: { arrivedCount: input.arrivedCount, prior, reason: input.reason ?? null },
    });
    return checkIn;
  });
}

export async function voidCheckIn(ctx: AdminContext, checkInId: string, reason: string) {
  if (!reason.trim()) throw new AppError("invalidInput");
  await prisma.$transaction(async (tx) => {
    const res = await tx.guestCheckIn.updateMany({
      where: { id: checkInId, voidedAt: null },
      data: { voidedAt: new Date(), voidReason: reason.trim(), voidedById: ctx.adminUserId },
    });
    if (res.count === 0) throw new AppError("notFound");
    await recordAudit(tx, ctx, { action: "checkin.void", entityType: "GuestCheckIn", entityId: checkInId, metadata: { reason } });
  });
}

export async function checkInStats(_ctx: AdminContext) {
  const [agg, parties, recent] = await Promise.all([
    prisma.guestCheckIn.aggregate({ where: { voidedAt: null }, _sum: { arrivedCount: true } }),
    prisma.guestCheckIn.groupBy({ by: ["invitationId"], where: { voidedAt: null } }),
    prisma.guestCheckIn.findMany({
      where: { voidedAt: null },
      orderBy: { checkedInAt: "desc" },
      take: 15,
      select: { id: true, displayNameSnapshot: true, arrivedCount: true, checkedInAt: true, isOverride: true, invitationId: true },
    }),
  ]);
  return { guestsArrived: agg._sum.arrivedCount ?? 0, partiesArrived: parties.length, recent };
}
