import "server-only";
import type { InvitationStatus, Prisma } from "@/generated/prisma/client";
import type { InvitationListFilters } from "@/features/invitations/schemas";
import type { AppLocale } from "@/i18n/locales";
import { parsePhnomPenhLocal } from "@/lib/dates";
import { prisma } from "@/lib/prisma/client";
import { isWellFormedToken } from "@/lib/security/crypto";
import { decryptInvitationToken, hashInvitationToken, invitationUrl, newInvitationToken } from "@/lib/security/tokens";
import type { AdminContext, Db } from "@/server/context";
import { AppError, isUniqueViolation } from "@/server/errors";
import { recordAudit } from "./audit.service";
import { PAGE_SIZE } from "./guest.service";

/*
 * Token strategy (Phase 1 §7):
 *  - lookup by HMAC-SHA256(pepper, token); the raw token is never stored in plaintext
 *  - AES-256-GCM ciphertext kept ONLY for the ACTIVE token so admins can re-copy the link (audited)
 *  - rotation marks the old token ROTATED (ciphertext erased) and issues a new one in one transaction
 */

type CommonOptions = {
  capacity?: number;
  allowUnnamedGuests: boolean;
  preferredLocale?: "kh" | "en";
  internalLabel?: string;
  notes?: string;
};

export type CreatedInvitation = { invitationId: string; url: string };

async function issueToken(tx: Db, invitationId: string, locale: AppLocale): Promise<string> {
  const token = newInvitationToken();
  await tx.invitationToken.create({ data: { invitationId, tokenHash: token.hash, tokenCiphertext: token.ciphertext } });
  return invitationUrl(token.raw, locale);
}

function mapUnique(error: unknown): never {
  if (isUniqueViolation(error, "invitations_one_live_per_guest") || isUniqueViolation(error, "invitations_one_live_per_group")) {
    throw new AppError("invitationExists");
  }
  throw error;
}

export async function createIndividualInvitation(
  ctx: AdminContext,
  input: CommonOptions & { guestId: string },
  defaultLocale: AppLocale,
): Promise<CreatedInvitation> {
  try {
    return await prisma.$transaction(async (tx) => {
      const guest = await tx.guest.findUnique({ where: { id: input.guestId }, select: { archivedAt: true, groupId: true } });
      if (!guest) throw new AppError("notFound");
      if (guest.archivedAt) throw new AppError("guestArchived");
      // A grouped guest is invited through the family invitation (Phase 1 §5).
      if (guest.groupId) throw new AppError("guestInGroup");

      const capacity = input.capacity ?? (input.allowUnnamedGuests ? 2 : 1);
      const inv = await tx.invitation.create({
        data: {
          type: "INDIVIDUAL",
          guestId: input.guestId,
          capacity,
          allowUnnamedGuests: input.allowUnnamedGuests || capacity > 1,
          preferredLocale: input.preferredLocale ?? null,
          internalLabel: input.internalLabel ?? null,
          notes: input.notes ?? null,
        },
      });
      const url = await issueToken(tx, inv.id, input.preferredLocale ?? defaultLocale);
      await recordAudit(tx, ctx, { action: "invitation.create", entityType: "Invitation", entityId: inv.id, metadata: { type: "INDIVIDUAL", capacity } });
      return { invitationId: inv.id, url };
    });
  } catch (error) {
    mapUnique(error);
  }
}

export async function createFamilyInvitation(
  ctx: AdminContext,
  input: CommonOptions & { groupId: string },
  defaultLocale: AppLocale,
): Promise<CreatedInvitation> {
  try {
    return await prisma.$transaction(async (tx) => {
      const group = await tx.guestGroup.findUnique({
        where: { id: input.groupId },
        select: { archivedAt: true, _count: { select: { members: { where: { archivedAt: null } } } } },
      });
      if (!group) throw new AppError("notFound");
      if (group.archivedAt) throw new AppError("groupArchived");
      const members = group._count.members;
      if (members === 0) throw new AppError("groupEmpty");

      const capacity = input.capacity ?? members;
      if (capacity > members && !input.allowUnnamedGuests) {
        // Seats beyond the named members can only be filled by unnamed guests.
        throw new AppError("capacityBelowMembers", { members });
      }
      const inv = await tx.invitation.create({
        data: {
          type: "FAMILY",
          groupId: input.groupId,
          capacity,
          allowUnnamedGuests: input.allowUnnamedGuests,
          preferredLocale: input.preferredLocale ?? null,
          internalLabel: input.internalLabel ?? null,
          notes: input.notes ?? null,
        },
      });
      const url = await issueToken(tx, inv.id, input.preferredLocale ?? defaultLocale);
      await recordAudit(tx, ctx, { action: "invitation.create", entityType: "Invitation", entityId: inv.id, metadata: { type: "FAMILY", capacity, members } });
      return { invitationId: inv.id, url };
    });
  } catch (error) {
    mapUnique(error);
  }
}

/** Lock the invitation row for the rest of the transaction (serializes concurrent updates/RSVPs). */
async function lockInvitation(tx: Db, id: string) {
  await tx.$queryRaw`SELECT id FROM invitations WHERE id = ${id}::uuid FOR UPDATE`;
  const inv = await tx.invitation.findUnique({
    where: { id },
    include: { rsvp: { select: { attendingCount: true, unnamedGuests: true } }, group: { select: { _count: { select: { members: { where: { archivedAt: null } } } } } } },
  });
  if (!inv) throw new AppError("notFound");
  return inv;
}

export async function updateInvitation(
  ctx: AdminContext,
  input: CommonOptions & { id: string; capacity: number; rsvpDeadlineOverride?: string },
) {
  await prisma.$transaction(async (tx) => {
    const inv = await lockInvitation(tx, input.id);
    if (inv.status === "REVOKED") throw new AppError("invitationRevoked");
    const attending = inv.rsvp?.attendingCount ?? 0;
    if (input.capacity < attending) throw new AppError("capacityBelowAttending", { attending });
    // Same seat rules as creation: individual extra seats are always unnamed
    // guests; family seats beyond the named members require unnamed guests.
    let allowUnnamedGuests = input.allowUnnamedGuests;
    if (inv.type === "INDIVIDUAL" && input.capacity > 1) allowUnnamedGuests = true;
    const members = inv.group?._count.members ?? 0;
    if (inv.type === "FAMILY" && input.capacity > members && !allowUnnamedGuests) {
      throw new AppError("capacityBelowMembers", { members });
    }
    // Cannot switch off "+ guests" while the current RSVP still uses them.
    if (!allowUnnamedGuests && (inv.rsvp?.unnamedGuests ?? 0) > 0) {
      throw new AppError("capacityBelowAttending", { attending });
    }

    const deadline = input.rsvpDeadlineOverride ? parsePhnomPenhLocal(input.rsvpDeadlineOverride) : null;
    if (input.rsvpDeadlineOverride && !deadline) throw new AppError("invalidInput");

    await tx.invitation.update({
      where: { id: input.id },
      data: {
        capacity: input.capacity,
        allowUnnamedGuests,
        preferredLocale: input.preferredLocale ?? null,
        internalLabel: input.internalLabel ?? null,
        notes: input.notes ?? null,
        rsvpDeadlineOverride: deadline,
      },
    });
    await recordAudit(tx, ctx, {
      action: "invitation.update",
      entityType: "Invitation",
      entityId: input.id,
      metadata: { capacityFrom: inv.capacity, capacityTo: input.capacity, allowUnnamedGuests },
    });
  });
}

export async function setInvitationActive(ctx: AdminContext, id: string, active: boolean) {
  await prisma.$transaction(async (tx) => {
    const inv = await lockInvitation(tx, id);
    if (inv.status === "REVOKED") throw new AppError("invitationRevoked");
    const status: InvitationStatus = active ? "ACTIVE" : "INACTIVE";
    if (inv.status === status) return;
    await tx.invitation.update({ where: { id }, data: { status } });
    await recordAudit(tx, ctx, { action: active ? "invitation.activate" : "invitation.deactivate", entityType: "Invitation", entityId: id });
  });
}

/** Permanent. Invalidates every token. The owner may then receive a new invitation. */
export async function revokeInvitation(ctx: AdminContext, id: string, reason?: string) {
  await prisma.$transaction(async (tx) => {
    const inv = await lockInvitation(tx, id);
    if (inv.status === "REVOKED") return;
    const now = new Date();
    await tx.invitationToken.updateMany({
      where: { invitationId: id, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: now, tokenCiphertext: null },
    });
    await tx.invitation.update({ where: { id }, data: { status: "REVOKED", revokedAt: now } });
    await recordAudit(tx, ctx, { action: "invitation.revoke", entityType: "Invitation", entityId: id, metadata: { reason: reason ?? null } });
  });
}

/** Issues a new link; the previous link stops working immediately. */
export async function rotateInvitationToken(ctx: AdminContext, id: string, defaultLocale: AppLocale): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const inv = await lockInvitation(tx, id);
    if (inv.status === "REVOKED") throw new AppError("invitationRevoked");
    await tx.invitationToken.updateMany({
      where: { invitationId: id, status: "ACTIVE" },
      data: { status: "ROTATED", rotatedAt: new Date(), tokenCiphertext: null },
    });
    const url = await issueToken(tx, id, (inv.preferredLocale as AppLocale | null) ?? defaultLocale);
    await recordAudit(tx, ctx, { action: "invitation.token_rotate", entityType: "Invitation", entityId: id });
    return url;
  });
}

/** Decrypts the active token to rebuild the link. Every reveal is audited. */
export async function revealInvitationLink(
  ctx: AdminContext,
  id: string,
  defaultLocale: AppLocale,
  purpose: "link_reveal" | "qr_download" = "link_reveal",
): Promise<{ url: string; locale: AppLocale }> {
  const inv = await prisma.invitation.findUnique({
    where: { id },
    select: { status: true, preferredLocale: true, tokens: { where: { status: "ACTIVE" }, select: { tokenCiphertext: true } } },
  });
  if (!inv) throw new AppError("notFound");
  if (inv.status === "REVOKED") throw new AppError("invitationRevoked");
  const ciphertext = inv.tokens[0]?.tokenCiphertext;
  if (!ciphertext) throw new AppError("noActiveToken");
  const locale = (inv.preferredLocale as AppLocale | null) ?? defaultLocale;
  const url = invitationUrl(decryptInvitationToken(ciphertext), locale);
  await recordAudit(prisma, ctx, { action: purpose === "qr_download" ? "invitation.qr_download" : "invitation.link_reveal", entityType: "Invitation", entityId: id });
  return { url, locale };
}

// ------------------------------------------------------------------ queries

const ownerSelect = {
  guest: { select: { id: true, nameEn: true, nameKh: true } },
  group: {
    select: {
      id: true,
      nameEn: true,
      nameKh: true,
      _count: { select: { members: { where: { archivedAt: null } } } },
    },
  },
} satisfies Prisma.InvitationSelect;

function invitationOrder(f: InvitationListFilters): Prisma.InvitationOrderByWithRelationInput[] {
  const dir = f.dir ?? "desc";
  switch (f.sort) {
    case "capacity":
      return [{ capacity: dir }, { createdAt: "desc" }];
    case "opened":
      return [{ firstOpenedAt: { sort: dir, nulls: "last" } }];
    case "status":
      return [{ status: dir }, { createdAt: "desc" }];
    case "type":
      return [{ type: dir }, { createdAt: "desc" }];
    default:
      return [{ createdAt: dir }];
  }
}

export async function listInvitations(_ctx: AdminContext, f: InvitationListFilters) {
  const where: Prisma.InvitationWhereInput = {
    ...(f.type ? { type: f.type } : {}),
    ...(f.status ? { status: f.status } : { status: { not: "REVOKED" } }),
    ...(f.opened === "1" ? { firstOpenedAt: { not: null } } : f.opened === "0" ? { firstOpenedAt: null } : {}),
    ...(f.rsvp === "none" ? { rsvp: { is: null } } : f.rsvp ? { rsvp: { is: { status: f.rsvp } } } : {}),
    ...(f.q
      ? {
          OR: [
            { guest: { OR: [{ nameEn: { contains: f.q, mode: "insensitive" } }, { nameKh: { contains: f.q } }] } },
            { group: { OR: [{ nameEn: { contains: f.q, mode: "insensitive" } }, { nameKh: { contains: f.q } }] } },
            { internalLabel: { contains: f.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.invitation.count({ where }),
    prisma.invitation.findMany({
      where,
      orderBy: invitationOrder(f),
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        type: true,
        status: true,
        capacity: true,
        internalLabel: true,
        firstOpenedAt: true,
        createdAt: true,
        ...ownerSelect,
        rsvp: { select: { status: true, attendingCount: true } },
        tokens: { where: { status: "ACTIVE" }, select: { id: true } },
      },
    }),
  ]);
  return { total, rows, pageSize: PAGE_SIZE };
}

export async function getInvitation(_ctx: AdminContext, id: string) {
  const inv = await prisma.invitation.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      status: true,
      capacity: true,
      allowUnnamedGuests: true,
      preferredLocale: true,
      internalLabel: true,
      notes: true,
      rsvpDeadlineOverride: true,
      firstOpenedAt: true,
      lastOpenedAt: true,
      revokedAt: true,
      createdAt: true,
      guest: { select: { id: true, nameEn: true, nameKh: true } },
      group: {
        select: {
          id: true,
          nameEn: true,
          nameKh: true,
          members: { where: { archivedAt: null }, select: { id: true, nameEn: true, nameKh: true }, orderBy: { nameKh: "asc" } },
        },
      },
      rsvp: {
        select: {
          status: true,
          attendingCount: true,
          unnamedGuests: true,
          dietary: true,
          accessibility: true,
          note: true,
          version: true,
          submittedAt: true,
          updatedAt: true,
          participants: { select: { attending: true, guest: { select: { id: true, nameEn: true, nameKh: true } } } },
        },
      },
      tokens: { orderBy: { createdAt: "desc" }, select: { id: true, status: true, createdAt: true, rotatedAt: true, revokedAt: true } },
    },
  });
  if (!inv) throw new AppError("notFound");
  const [opens, landings] = await Promise.all([
    prisma.invitationAccessLog.count({ where: { invitationId: id, kind: "OPENED", isLikelyBot: false } }),
    prisma.invitationAccessLog.count({ where: { invitationId: id, kind: "LANDING", isLikelyBot: false } }),
  ]);
  return { ...inv, stats: { opens, landings } };
}

// -------------------------------------------------- public token resolution

export type PublicInvitation = {
  invitationId: string;
  tokenId: string;
  type: "INDIVIDUAL" | "FAMILY";
  /** Display names only — never contact details, notes or internal labels. */
  owner: { nameEn: string | null; nameKh: string | null };
  members: { id: string; nameEn: string | null; nameKh: string | null }[];
  capacity: number;
  allowUnnamedGuests: boolean;
  rsvpDeadlineOverride: Date | null;
};

export type TokenResolution =
  | { status: "valid"; invitation: PublicInvitation }
  | { status: "inactive" } // link known but disabled / rotated / revoked / expired
  | { status: "invalid" }; // unknown or malformed — reveals nothing

/**
 * Validates a guest-supplied token server-side. Returns the minimum data the
 * public invitation needs. Callers must rate-limit (see rate-limit.service).
 */
export async function resolveInvitationToken(rawToken: string): Promise<TokenResolution> {
  if (!isWellFormedToken(rawToken)) return { status: "invalid" };
  const token = await prisma.invitationToken.findUnique({
    where: { tokenHash: hashInvitationToken(rawToken) },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      invitation: {
        select: {
          id: true,
          type: true,
          status: true,
          capacity: true,
          allowUnnamedGuests: true,
          rsvpDeadlineOverride: true,
          guest: { select: { id: true, nameEn: true, nameKh: true, archivedAt: true } },
          group: {
            select: {
              nameEn: true,
              nameKh: true,
              archivedAt: true,
              members: { where: { archivedAt: null }, select: { id: true, nameEn: true, nameKh: true }, orderBy: { createdAt: "asc" } },
            },
          },
        },
      },
    },
  });
  if (!token) return { status: "invalid" };
  const inv = token.invitation;
  const ownerArchived = inv.guest?.archivedAt || inv.group?.archivedAt;
  if (
    token.status !== "ACTIVE" ||
    inv.status !== "ACTIVE" ||
    ownerArchived ||
    (token.expiresAt && token.expiresAt <= new Date())
  ) {
    return { status: "inactive" };
  }
  const owner = inv.type === "INDIVIDUAL" ? inv.guest! : inv.group!;
  const members = inv.type === "INDIVIDUAL" ? [{ id: inv.guest!.id, nameEn: inv.guest!.nameEn, nameKh: inv.guest!.nameKh }] : inv.group!.members;
  return {
    status: "valid",
    invitation: {
      invitationId: inv.id,
      tokenId: token.id,
      type: inv.type,
      owner: { nameEn: owner.nameEn, nameKh: owner.nameKh },
      members,
      capacity: inv.capacity,
      allowUnnamedGuests: inv.allowUnnamedGuests,
      rsvpDeadlineOverride: inv.rsvpDeadlineOverride,
    },
  };
}

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|slack|discord|skype|linkedin|embedly|vkshare|curl|wget|python|httpclient|headless|lighthouse/i;

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  return !userAgent || BOT_UA.test(userAgent);
}

function deviceClass(ua: string): string {
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

/** Privacy-conscious access log: no IP, no full user agent, no token. */
export async function recordInvitationAccess(
  invitationId: string,
  tokenId: string,
  kind: "LANDING" | "OPENED" | "RSVP_VIEW" | "GIFT_VIEW",
  userAgent: string | null,
): Promise<void> {
  const bot = isLikelyBot(userAgent);
  const now = new Date();
  await prisma.$transaction([
    prisma.invitationAccessLog.create({
      data: { invitationId, tokenId, kind, isLikelyBot: bot, deviceClass: userAgent ? deviceClass(userAgent) : null, occurredAt: now },
    }),
    ...(kind === "OPENED" && !bot
      ? [
          prisma.invitation.updateMany({ where: { id: invitationId, firstOpenedAt: null }, data: { firstOpenedAt: now } }),
          prisma.invitation.update({ where: { id: invitationId }, data: { lastOpenedAt: now } }),
        ]
      : []),
  ]);
}

/** Display name of the invitation owner (for prefilling guest forms). */
export async function getInvitationOwnerName(invitationId: string): Promise<{ nameEn: string | null; nameKh: string | null } | null> {
  const inv = await prisma.invitation.findUnique({
    where: { id: invitationId },
    select: { guest: { select: { nameEn: true, nameKh: true } }, group: { select: { nameEn: true, nameKh: true } } },
  });
  return inv?.guest ?? inv?.group ?? null;
}

/** Live invitations for select inputs (e.g. recording a cash gift). */
export async function listInvitationOptions(_ctx: AdminContext) {
  return prisma.invitation.findMany({
    where: { status: { not: "REVOKED" } },
    select: { id: true, guest: { select: { nameEn: true, nameKh: true } }, group: { select: { nameEn: true, nameKh: true } } },
    orderBy: { createdAt: "asc" },
    take: 2000,
  });
}
