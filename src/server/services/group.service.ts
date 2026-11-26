import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { GroupData, GroupListFilters } from "@/features/groups/schemas";
import { prisma } from "@/lib/prisma/client";
import type { AdminContext } from "@/server/context";
import { AppError } from "@/server/errors";
import { recordAudit } from "./audit.service";
import { assertCanJoinGroup, changedKeys, PAGE_SIZE } from "./guest.service";

export async function listGroups(_ctx: AdminContext, f: GroupListFilters) {
  const where: Prisma.GuestGroupWhereInput = {
    archivedAt: f.archived === "1" ? { not: null } : null,
    ...(f.q ? { OR: [{ nameEn: { contains: f.q, mode: "insensitive" } }, { nameKh: { contains: f.q } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.guestGroup.count({ where }),
    prisma.guestGroup.findMany({
      where,
      orderBy: [{ nameKh: "asc" }, { nameEn: "asc" }],
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        nameEn: true,
        nameKh: true,
        category: true,
        side: true,
        archivedAt: true,
        _count: { select: { members: { where: { archivedAt: null } } } },
        invitations: { where: { status: { not: "REVOKED" } }, select: { id: true, status: true, capacity: true } },
      },
    }),
  ]);
  return { total, rows, pageSize: PAGE_SIZE };
}

export async function getGroup(_ctx: AdminContext, id: string) {
  const group = await prisma.guestGroup.findUnique({
    where: { id },
    include: {
      members: {
        orderBy: [{ archivedAt: "asc" }, { nameKh: "asc" }],
        select: { id: true, nameEn: true, nameKh: true, relationship: true, archivedAt: true },
      },
      invitations: { orderBy: { createdAt: "desc" }, select: { id: true, status: true, capacity: true, createdAt: true } },
    },
  });
  if (!group) throw new AppError("notFound");
  return group;
}

/** All active groups, for select inputs. */
export async function listGroupOptions(_ctx: AdminContext) {
  return prisma.guestGroup.findMany({
    where: { archivedAt: null },
    select: { id: true, nameEn: true, nameKh: true },
    orderBy: [{ nameKh: "asc" }, { nameEn: "asc" }],
    take: 2000,
  });
}

/** Groups that can receive a new family invitation. */
export async function listAvailableGroups(_ctx: AdminContext) {
  return prisma.guestGroup.findMany({
    where: { archivedAt: null, invitations: { none: { status: { not: "REVOKED" } } } },
    select: { id: true, nameEn: true, nameKh: true, _count: { select: { members: { where: { archivedAt: null } } } } },
    orderBy: [{ nameKh: "asc" }, { nameEn: "asc" }],
  });
}

function toData(input: GroupData) {
  return {
    nameEn: input.nameEn || null,
    nameKh: input.nameKh || null,
    category: input.category,
    side: input.side ?? null,
    notes: input.notes ?? null,
  };
}

export async function createGroup(ctx: AdminContext, input: GroupData) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.guestGroup.create({ data: toData(input) });
    await recordAudit(tx, ctx, { action: "group.create", entityType: "GuestGroup", entityId: group.id });
    return group;
  });
}

export async function updateGroup(ctx: AdminContext, id: string, input: GroupData) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.guestGroup.findUnique({ where: { id } });
    if (!before) throw new AppError("notFound");
    if (before.archivedAt) throw new AppError("groupArchived");
    const group = await tx.guestGroup.update({ where: { id }, data: toData(input) });
    await recordAudit(tx, ctx, { action: "group.update", entityType: "GuestGroup", entityId: id, metadata: { changed: changedKeys(before, group) } });
    return group;
  });
}

/** Add an existing ungrouped guest, or create a new guest directly in the group. */
export async function addMember(
  ctx: AdminContext,
  input: { groupId: string; existingGuestId?: string; nameEn: string; nameKh: string; relationship?: string },
) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.guestGroup.findUnique({ where: { id: input.groupId }, select: { category: true, side: true } });
    if (!group) throw new AppError("notFound");
    await assertCanJoinGroup(tx, input.existingGuestId ?? null, input.groupId);

    let guestId: string;
    if (input.existingGuestId) {
      const guest = await tx.guest.findUnique({ where: { id: input.existingGuestId }, select: { groupId: true, archivedAt: true } });
      if (!guest) throw new AppError("notFound");
      if (guest.archivedAt) throw new AppError("guestArchived");
      if (guest.groupId) throw new AppError("guestInGroup");
      await tx.guest.update({ where: { id: input.existingGuestId }, data: { groupId: input.groupId } });
      guestId = input.existingGuestId;
    } else {
      const created = await tx.guest.create({
        data: {
          nameEn: input.nameEn || null,
          nameKh: input.nameKh || null,
          relationship: input.relationship ?? null,
          category: group.category,
          side: group.side,
          groupId: input.groupId,
        },
      });
      guestId = created.id;
    }
    await recordAudit(tx, ctx, {
      action: "group.members_change",
      entityType: "GuestGroup",
      entityId: input.groupId,
      metadata: { added: guestId, newGuest: !input.existingGuestId },
    });
    return guestId;
  });
}

export async function removeMember(ctx: AdminContext, groupId: string, guestId: string) {
  await prisma.$transaction(async (tx) => {
    const guest = await tx.guest.findUnique({ where: { id: guestId }, select: { groupId: true } });
    if (!guest || guest.groupId !== groupId) throw new AppError("notFound");
    if ((await tx.rsvpGuest.count({ where: { guestId } })) > 0) throw new AppError("guestIsRsvpParticipant");
    await tx.guestGroup.updateMany({ where: { id: groupId, primaryContactGuestId: guestId }, data: { primaryContactGuestId: null } });
    await tx.guest.update({ where: { id: guestId }, data: { groupId: null } });
    await recordAudit(tx, ctx, { action: "group.members_change", entityType: "GuestGroup", entityId: groupId, metadata: { removed: guestId } });
  });
}

export async function setPrimaryContact(ctx: AdminContext, groupId: string, guestId: string | null) {
  await prisma.$transaction(async (tx) => {
    // The DB trigger also rejects a contact who is not a member.
    await tx.guestGroup.update({ where: { id: groupId }, data: { primaryContactGuestId: guestId } });
    await recordAudit(tx, ctx, { action: "group.update", entityType: "GuestGroup", entityId: groupId, metadata: { primaryContact: guestId } });
  });
}

export async function archiveGroup(ctx: AdminContext, id: string) {
  await prisma.$transaction(async (tx) => {
    const live = await tx.invitation.count({ where: { groupId: id, status: { not: "REVOKED" } } });
    if (live > 0) throw new AppError("groupHasLiveInvitation");
    const res = await tx.guestGroup.updateMany({ where: { id, archivedAt: null }, data: { archivedAt: new Date() } });
    if (res.count === 0) throw new AppError("notFound");
    await recordAudit(tx, ctx, { action: "group.archive", entityType: "GuestGroup", entityId: id });
  });
}

export async function restoreGroup(ctx: AdminContext, id: string) {
  await prisma.$transaction(async (tx) => {
    const res = await tx.guestGroup.updateMany({ where: { id, archivedAt: { not: null } }, data: { archivedAt: null } });
    if (res.count === 0) throw new AppError("notFound");
    await recordAudit(tx, ctx, { action: "group.restore", entityType: "GuestGroup", entityId: id });
  });
}
