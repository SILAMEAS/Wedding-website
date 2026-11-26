import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { RsvpData } from "@/features/guest-actions/schemas";
import { prisma } from "@/lib/prisma/client";
import type { AdminContext, Db } from "@/server/context";
import { AppError } from "@/server/errors";
import { recordAudit } from "./audit.service";

/*
 * RSVP rules (Phase 1 §6):
 *  - The invitation (and therefore who may be named) comes from the validated
 *    token, never from the client. Client guest ids are only selections.
 *  - Capacity: named attending + unnamed seats <= invitation.capacity.
 *  - One current RSVP per invitation; every change appends an RsvpHistory row.
 *  - Concurrency: the invitation row is locked (SELECT … FOR UPDATE) for the
 *    whole transaction; DB triggers re-check capacity and membership.
 *  - After the deadline only an admin override (with reason) may change it.
 */

export type RsvpRules = { deadline: Date | null; allowMaybe: boolean; isOpen: boolean };

export async function getRsvpRules(invitationId: string, now = new Date()): Promise<RsvpRules> {
  const [inv, settings] = await Promise.all([
    prisma.invitation.findUnique({ where: { id: invitationId }, select: { rsvpDeadlineOverride: true } }),
    prisma.weddingSettings.findUnique({ where: { id: 1 }, select: { rsvpDeadline: true, rsvpAllowMaybe: true } }),
  ]);
  const deadline = inv?.rsvpDeadlineOverride ?? settings?.rsvpDeadline ?? null;
  return { deadline, allowMaybe: settings?.rsvpAllowMaybe ?? false, isOpen: !deadline || now <= deadline };
}

export async function getCurrentRsvp(invitationId: string) {
  return prisma.rsvp.findUnique({
    where: { invitationId },
    select: {
      status: true,
      unnamedGuests: true,
      attendingCount: true,
      dietary: true,
      accessibility: true,
      note: true,
      submittedAt: true,
      updatedAt: true,
      participants: { select: { guestId: true, attending: true } },
    },
  });
}

type Actor = { kind: "GUEST" } | { kind: "ADMIN"; ctx: AdminContext; reason: string };

async function writeRsvp(tx: Db, invitationId: string, input: RsvpData, actor: Actor) {
  // Serialize every write for this invitation.
  await tx.$queryRaw`SELECT id FROM invitations WHERE id = ${invitationId}::uuid FOR UPDATE`;
  const inv = await tx.invitation.findUnique({
    where: { id: invitationId },
    select: {
      status: true,
      type: true,
      capacity: true,
      allowUnnamedGuests: true,
      guest: { select: { id: true, nameEn: true, nameKh: true, archivedAt: true } },
      group: { select: { members: { where: { archivedAt: null }, select: { id: true, nameEn: true, nameKh: true } } } },
    },
  });
  if (!inv || inv.status !== "ACTIVE") throw new AppError("invitationInvalid");

  const allowed = inv.type === "INDIVIDUAL" ? (inv.guest && !inv.guest.archivedAt ? [inv.guest] : []) : (inv.group?.members ?? []);
  const allowedIds = new Set(allowed.map((g) => g.id));
  const selected = [...new Set(input.attendees)];
  if (selected.some((id) => !allowedIds.has(id))) throw new AppError("participantNotAllowed");

  const declined = input.status === "DECLINED";
  const unnamed = declined ? 0 : input.unnamedGuests;
  if (unnamed > 0 && !inv.allowUnnamedGuests) throw new AppError("participantNotAllowed");
  const attendingIds = declined ? new Set<string>() : new Set(selected);
  const attendingCount = attendingIds.size + unnamed;
  if (!declined && attendingCount === 0) throw new AppError("noAttendees");
  if (attendingCount > inv.capacity) throw new AppError("capacityExceeded", { capacity: inv.capacity });

  const existing = await tx.rsvp.findUnique({ where: { invitationId }, select: { id: true, version: true } });
  const lastActor = actor.kind;
  const data = {
    status: input.status,
    unnamedGuests: unnamed,
    attendingCount,
    dietary: input.dietary ?? null,
    accessibility: input.accessibility ?? null,
    note: input.note ?? null,
    lastActor,
  };
  const rsvp = existing
    ? await tx.rsvp.update({ where: { id: existing.id }, data: { ...data, version: existing.version + 1 } })
    : await tx.rsvp.create({ data: { ...data, invitationId } });

  await tx.rsvpGuest.deleteMany({ where: { rsvpId: rsvp.id } });
  if (allowed.length > 0) {
    await tx.rsvpGuest.createMany({ data: allowed.map((g) => ({ rsvpId: rsvp.id, guestId: g.id, attending: attendingIds.has(g.id) })) });
  }

  // History keeps names as they were at submission time.
  const snapshot = {
    status: rsvp.status,
    attendingCount,
    unnamedGuests: unnamed,
    participants: allowed.map((g) => ({ guestId: g.id, nameEn: g.nameEn, nameKh: g.nameKh, attending: attendingIds.has(g.id) })),
    dietary: data.dietary,
    accessibility: data.accessibility,
    note: data.note,
  } satisfies Prisma.InputJsonValue;
  await tx.rsvpHistory.create({
    data: {
      rsvpId: rsvp.id,
      version: rsvp.version,
      actor: lastActor,
      adminUserId: actor.kind === "ADMIN" ? actor.ctx.adminUserId : null,
      reason: actor.kind === "ADMIN" ? actor.reason : null,
      snapshot,
    },
  });
  if (actor.kind === "ADMIN") {
    await recordAudit(tx, actor.ctx, {
      action: "rsvp.override",
      entityType: "Invitation",
      entityId: invitationId,
      metadata: { status: rsvp.status, attendingCount, version: rsvp.version, reason: actor.reason },
    });
  }
  return { status: rsvp.status, attendingCount, version: rsvp.version };
}

/** Guest submission (token already resolved to invitationId by the caller). */
export async function submitGuestRsvp(invitationId: string, input: RsvpData) {
  const rules = await getRsvpRules(invitationId);
  if (!rules.isOpen) throw new AppError("rsvpClosed");
  if (input.status === "MAYBE" && !rules.allowMaybe) throw new AppError("maybeNotAllowed");
  return prisma.$transaction((tx) => writeRsvp(tx, invitationId, input, { kind: "GUEST" }));
}

/** Admin correction: allowed after the deadline and for MAYBE; reason required and audited. */
export async function overrideRsvp(ctx: AdminContext, invitationId: string, input: RsvpData, reason: string) {
  if (!reason.trim()) throw new AppError("invalidInput");
  return prisma.$transaction((tx) => writeRsvp(tx, invitationId, input, { kind: "ADMIN", ctx, reason: reason.trim() }));
}

export async function getRsvpHistory(_ctx: AdminContext, invitationId: string) {
  return prisma.rsvpHistory.findMany({
    where: { rsvp: { invitationId } },
    orderBy: { version: "desc" },
    select: { version: true, actor: true, reason: true, snapshot: true, createdAt: true },
  });
}
