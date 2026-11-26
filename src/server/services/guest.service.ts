import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { GuestData, GuestListFilters } from "@/features/guests/schemas";
import { prisma } from "@/lib/prisma/client";
import type { AdminContext, Db } from "@/server/context";
import { AppError } from "@/server/errors";
import { recordAudit } from "./audit.service";

export const PAGE_SIZE = 25;

const listSelect = {
  id: true,
  nameEn: true,
  nameKh: true,
  phone: true,
  category: true,
  side: true,
  relationship: true,
  archivedAt: true,
  group: { select: { id: true, nameEn: true, nameKh: true } },
  invitations: { where: { status: { not: "REVOKED" } }, select: { id: true, status: true } },
} satisfies Prisma.GuestSelect;

export async function listGuests(_ctx: AdminContext, f: GuestListFilters) {
  const where: Prisma.GuestWhereInput = {
    archivedAt: f.archived === "1" ? { not: null } : null,
    ...(f.category ? { category: f.category } : {}),
    ...(f.groupId === "none" ? { groupId: null } : f.groupId ? { groupId: f.groupId } : {}),
    ...(f.q
      ? {
          OR: [
            { nameEn: { contains: f.q, mode: "insensitive" } },
            { nameKh: { contains: f.q } },
            { phone: { contains: f.q } },
            { relationship: { contains: f.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.guest.count({ where }),
    prisma.guest.findMany({
      where,
      select: listSelect,
      orderBy: guestOrder(f),
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return { total, rows, pageSize: PAGE_SIZE };
}

function guestOrder(f: GuestListFilters): Prisma.GuestOrderByWithRelationInput[] {
  const dir = f.dir ?? (f.sort === "created" ? "desc" : "asc");
  switch (f.sort) {
    case "category":
      return [{ category: dir }, { nameKh: "asc" }];
    case "created":
      return [{ createdAt: dir }];
    default:
      return [{ nameKh: { sort: dir, nulls: "last" } }, { nameEn: dir }];
  }
}

export async function getGuest(_ctx: AdminContext, id: string) {
  const guest = await prisma.guest.findUnique({
    where: { id },
    include: {
      group: { select: { id: true, nameEn: true, nameKh: true } },
      invitations: { orderBy: { createdAt: "desc" }, select: { id: true, status: true, createdAt: true } },
    },
  });
  if (!guest) throw new AppError("notFound");
  return guest;
}

/** Ungrouped, active guests with no live individual invitation — candidates for new invitations/groups. */
export async function listAvailableGuests(_ctx: AdminContext, opts: { forInvitation?: boolean } = {}) {
  return prisma.guest.findMany({
    where: {
      archivedAt: null,
      groupId: null,
      ...(opts.forInvitation ? { invitations: { none: { status: { not: "REVOKED" } } } } : {}),
    },
    select: { id: true, nameEn: true, nameKh: true },
    orderBy: [{ nameKh: "asc" }, { nameEn: "asc" }],
    take: 1000,
  });
}

function toData(input: GuestData) {
  return {
    nameEn: input.nameEn || null,
    nameKh: input.nameKh || null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    category: input.category,
    side: input.side ?? null,
    relationship: input.relationship ?? null,
    notes: input.notes ?? null,
  };
}

/** Rules for putting a guest into a group (shared by create/update/group membership). */
export async function assertCanJoinGroup(db: Db, guestId: string | null, groupId: string): Promise<void> {
  const group = await db.guestGroup.findUnique({ where: { id: groupId }, select: { archivedAt: true } });
  if (!group) throw new AppError("notFound");
  if (group.archivedAt) throw new AppError("groupArchived");
  if (guestId) {
    const live = await db.invitation.count({ where: { guestId, status: { not: "REVOKED" } } });
    if (live > 0) throw new AppError("guestHasLiveInvitation");
  }
}

/** A guest who is a named participant on their group's RSVP cannot leave the group. */
async function assertCanLeaveGroup(db: Db, guestId: string): Promise<void> {
  const participations = await db.rsvpGuest.count({ where: { guestId } });
  if (participations > 0) throw new AppError("guestIsRsvpParticipant");
}

export async function createGuest(ctx: AdminContext, input: GuestData) {
  return prisma.$transaction(async (tx) => {
    if (input.groupId) await assertCanJoinGroup(tx, null, input.groupId);
    const guest = await tx.guest.create({ data: { ...toData(input), groupId: input.groupId ?? null } });
    await recordAudit(tx, ctx, { action: "guest.create", entityType: "Guest", entityId: guest.id, metadata: { groupId: guest.groupId } });
    return guest;
  });
}

export async function updateGuest(ctx: AdminContext, id: string, input: GuestData) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.guest.findUnique({ where: { id } });
    if (!before) throw new AppError("notFound");
    if (before.archivedAt) throw new AppError("guestArchived");

    const newGroupId = input.groupId ?? null;
    if (newGroupId !== before.groupId) {
      if (before.groupId) {
        await assertCanLeaveGroup(tx, id);
        // Leaving the group: drop primary-contact status if held.
        await tx.guestGroup.updateMany({ where: { id: before.groupId, primaryContactGuestId: id }, data: { primaryContactGuestId: null } });
      }
      if (newGroupId) await assertCanJoinGroup(tx, id, newGroupId);
    }

    const guest = await tx.guest.update({ where: { id }, data: { ...toData(input), groupId: newGroupId } });
    await recordAudit(tx, ctx, {
      action: "guest.update",
      entityType: "Guest",
      entityId: id,
      metadata: { changed: changedKeys(before, guest), groupFrom: before.groupId, groupTo: guest.groupId },
    });
    return guest;
  });
}

export async function archiveGuest(ctx: AdminContext, id: string) {
  await prisma.$transaction(async (tx) => {
    const guest = await tx.guest.findUnique({ where: { id }, select: { archivedAt: true, groupId: true } });
    if (!guest) throw new AppError("notFound");
    if (guest.archivedAt) return;
    const live = await tx.invitation.count({ where: { guestId: id, status: { not: "REVOKED" } } });
    if (live > 0) throw new AppError("guestHasLiveInvitation");
    if (guest.groupId) {
      await tx.guestGroup.updateMany({ where: { id: guest.groupId, primaryContactGuestId: id }, data: { primaryContactGuestId: null } });
    }
    await tx.guest.update({ where: { id }, data: { archivedAt: new Date() } });
    await recordAudit(tx, ctx, { action: "guest.archive", entityType: "Guest", entityId: id });
  });
}

export async function restoreGuest(ctx: AdminContext, id: string) {
  await prisma.$transaction(async (tx) => {
    const res = await tx.guest.updateMany({ where: { id, archivedAt: { not: null } }, data: { archivedAt: null } });
    if (res.count === 0) throw new AppError("notFound");
    await recordAudit(tx, ctx, { action: "guest.restore", entityType: "Guest", entityId: id });
  });
}

/** Names of changed fields only — values are not logged (personal data). */
export function changedKeys<T extends Record<string, unknown>>(before: T, after: T): string[] {
  return Object.keys(after).filter(
    (k) => !["updatedAt", "createdAt"].includes(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]),
  );
}
