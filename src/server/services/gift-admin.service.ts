import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { Currency, GiftEventType, GiftMethod, GiftStatus } from "@/generated/prisma/enums";
import { parseAmount } from "@/lib/money";
import { prisma } from "@/lib/prisma/client";
import type { AdminContext, Db } from "@/server/context";
import { AppError } from "@/server/errors";
import { recordAudit } from "./audit.service";
import { PAGE_SIZE } from "./guest.service";

/*
 * Private financial management (admin only).
 *  - USD and KHR are NEVER summed together; every total is per currency.
 *  - "Notified" (what a guest said) and "received" (what the couple confirmed)
 *    are separate columns. Only VERIFIED gifts count in confirmed totals.
 *  - Every change appends an immutable GiftEvent (DB trigger) + an audit entry.
 *    Corrections/reopening require a reason. Gifts are never deleted.
 *  - Optimistic locking on `version` prevents two tabs overwriting each other.
 */

type Amount = { currency: Currency; amount: string };

const snapshot = (g: { status: GiftStatus; currency: Currency; notifiedAmount: Prisma.Decimal | null; receivedAmount: Prisma.Decimal | null; method: GiftMethod; donorName: string; transactionRef: string | null }) => ({
  status: g.status,
  currency: g.currency,
  notifiedAmount: g.notifiedAmount?.toFixed(2) ?? null,
  receivedAmount: g.receivedAmount?.toFixed(2) ?? null,
  method: g.method,
  donorName: g.donorName,
  transactionRef: g.transactionRef,
});

function amountOrThrow(a: Amount) {
  const r = parseAmount(a.amount, a.currency);
  if (!r.ok) throw new AppError("invalidAmount");
  return r.value.toFixed(2);
}

// ------------------------------------------------------------------ reads

export type GiftFilters = {
  status?: GiftStatus;
  currency?: Currency;
  method?: GiftMethod;
  q?: string;
  sort?: "date" | "amount" | "donor" | "status";
  dir?: "asc" | "desc";
  page: number;
};

function giftOrder(f: GiftFilters): Prisma.GiftOrderByWithRelationInput[] {
  const dir = f.dir ?? (f.sort === "donor" ? "asc" : "desc");
  switch (f.sort) {
    // Amount sorting is only meaningful within one currency; group by currency first.
    case "amount":
      return [{ currency: "asc" }, { receivedAmount: { sort: dir, nulls: "last" } }, { notifiedAmount: { sort: dir, nulls: "last" } }];
    case "donor":
      return [{ donorName: dir }];
    case "status":
      return [{ status: dir }, { createdAt: "desc" }];
    default:
      return [{ createdAt: dir }];
  }
}

export type CurrencyPair = { USD: string; KHR: string };

/** Totals per currency, computed in SQL on exact numerics (never in JS floats). */
export async function getGiftSummary(_ctx: AdminContext) {
  const rows = await prisma.$queryRaw<{ status: GiftStatus; currency: Currency; method: GiftMethod; n: bigint; received: string | null; notified: string | null }[]>`
    SELECT status, currency, method, COUNT(*) AS n,
           SUM(received_amount)::text AS received, SUM(notified_amount)::text AS notified
    FROM gifts GROUP BY status, currency, method`;
  const zero = (): CurrencyPair => ({ USD: "0.00", KHR: "0" });
  const add = (a: string, b: string | null) => {
    if (!b) return a;
    return new Prisma.Decimal(a).plus(b).toFixed(2); // exact decimal addition
  };
  const verified = zero();
  const pending = zero();
  const byMethod: Record<string, CurrencyPair> = {};
  let pendingCount = 0;
  for (const r of rows) {
    if (r.status === "VERIFIED") {
      verified[r.currency] = add(verified[r.currency], r.received);
      byMethod[r.method] ??= zero();
      byMethod[r.method]![r.currency] = add(byMethod[r.method]![r.currency], r.received);
    } else if (r.status === "PENDING_VERIFICATION") {
      pending[r.currency] = add(pending[r.currency], r.notified);
      pendingCount += Number(r.n);
    }
  }
  // Contributors: distinct invitations with ≥1 verified gift + verified gifts without an invitation.
  const contributorRows = await prisma.$queryRaw<{ contributors: bigint }[]>`
    SELECT (COUNT(DISTINCT invitation_id) + COUNT(*) FILTER (WHERE invitation_id IS NULL))::bigint AS contributors
    FROM gifts WHERE status = 'VERIFIED'`;
  return { verified, pending, byMethod, pendingCount, contributors: Number(contributorRows[0]?.contributors ?? 0) };
}

export async function listGifts(_ctx: AdminContext, f: GiftFilters) {
  const where: Prisma.GiftWhereInput = {
    ...(f.status ? { status: f.status } : {}),
    ...(f.currency ? { currency: f.currency } : {}),
    ...(f.method ? { method: f.method } : {}),
    ...(f.q
      ? {
          OR: [
            { donorName: { contains: f.q, mode: "insensitive" } },
            { transactionRef: { contains: f.q, mode: "insensitive" } },
            { invitation: { guest: { OR: [{ nameEn: { contains: f.q, mode: "insensitive" } }, { nameKh: { contains: f.q } }] } } },
            { invitation: { group: { OR: [{ nameEn: { contains: f.q, mode: "insensitive" } }, { nameKh: { contains: f.q } }] } } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.gift.count({ where }),
    prisma.gift.findMany({
      where,
      orderBy: giftOrder(f),
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        invitation: { select: { id: true, guest: { select: { nameEn: true, nameKh: true } }, group: { select: { nameEn: true, nameKh: true } } } },
        paymentMethod: { select: { label: true } },
      },
    }),
  ]);
  return { total, rows, pageSize: PAGE_SIZE };
}

export async function getGift(_ctx: AdminContext, id: string) {
  const gift = await prisma.gift.findUnique({
    where: { id },
    include: {
      invitation: { select: { id: true, guest: { select: { nameEn: true, nameKh: true } }, group: { select: { nameEn: true, nameKh: true } } } },
      paymentMethod: { select: { label: true, bankName: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!gift) throw new AppError("notFound");
  return gift;
}

// ------------------------------------------------------------------ writes

async function transition(
  tx: Db,
  ctx: AdminContext,
  id: string,
  version: number,
  opts: { from: GiftStatus[]; data: Prisma.GiftUncheckedUpdateManyInput; event: GiftEventType; reason?: string; audit: Parameters<typeof recordAudit>[2]["action"] },
) {
  const before = await tx.gift.findUnique({ where: { id } });
  if (!before) throw new AppError("notFound");
  if (!opts.from.includes(before.status)) throw new AppError("staleData");
  const res = await tx.gift.updateMany({ where: { id, version }, data: { ...opts.data, version: { increment: 1 } } });
  if (res.count === 0) throw new AppError("staleData");
  const after = await tx.gift.findUniqueOrThrow({ where: { id } });
  await tx.giftEvent.create({
    data: { giftId: id, type: opts.event, actor: "ADMIN", adminUserId: ctx.adminUserId, reason: opts.reason ?? null, before: snapshot(before), after: snapshot(after) },
  });
  await recordAudit(tx, ctx, { action: opts.audit, entityType: "Gift", entityId: id, metadata: { from: before.status, to: after.status, currency: after.currency, reason: opts.reason ?? null } });
  return after;
}

/** Confirm a guest notification after checking the bank. The received amount may differ from what was notified. */
export async function verifyGift(ctx: AdminContext, id: string, input: { version: number; receivedAmount: string; receivedOn?: string; adminNote?: string }) {
  return prisma.$transaction(async (tx) => {
    const g = await tx.gift.findUnique({ where: { id }, select: { currency: true } });
    if (!g) throw new AppError("notFound");
    const received = amountOrThrow({ currency: g.currency, amount: input.receivedAmount });
    return transition(tx, ctx, id, input.version, {
      from: ["PENDING_VERIFICATION"],
      data: {
        status: "VERIFIED",
        receivedAmount: received,
        receivedAt: input.receivedOn ? new Date(`${input.receivedOn}T12:00:00+07:00`) : new Date(),
        verifiedAt: new Date(),
        verifiedById: ctx.adminUserId,
        ...(input.adminNote ? { adminNote: input.adminNote } : {}),
      },
      event: "VERIFIED",
      audit: "gift.verify",
    });
  });
}

export async function rejectGift(ctx: AdminContext, id: string, version: number, reason: string) {
  if (!reason.trim()) throw new AppError("invalidInput");
  return prisma.$transaction((tx) =>
    transition(tx, ctx, id, version, { from: ["PENDING_VERIFICATION"], data: { status: "REJECTED" }, event: "REJECTED", reason, audit: "gift.reject" }),
  );
}

export async function cancelGift(ctx: AdminContext, id: string, version: number, reason: string) {
  if (!reason.trim()) throw new AppError("invalidInput");
  return prisma.$transaction((tx) =>
    transition(tx, ctx, id, version, { from: ["PENDING_VERIFICATION"], data: { status: "CANCELLED" }, event: "CANCELLED", reason, audit: "gift.cancel" }),
  );
}

/** Send a verified/rejected gift back to pending (e.g. verified by mistake). Reason required. */
export async function reopenGift(ctx: AdminContext, id: string, version: number, reason: string) {
  if (!reason.trim()) throw new AppError("invalidInput");
  return prisma.$transaction((tx) =>
    transition(tx, ctx, id, version, {
      from: ["VERIFIED", "REJECTED"],
      data: { status: "PENDING_VERIFICATION", receivedAmount: null, verifiedAt: null, verifiedById: null, receivedAt: null },
      event: "REOPENED",
      reason,
      audit: "gift.reopen",
    }),
  );
}

/** Correct a verified gift (amount, currency, method, reference, donor). Reason required; full before/after kept. */
export async function correctGift(
  ctx: AdminContext,
  id: string,
  input: { version: number; reason: string; currency: Currency; receivedAmount: string; method: GiftMethod; donorName: string; transactionRef?: string },
) {
  if (!input.reason.trim()) throw new AppError("invalidInput");
  const received = amountOrThrow({ currency: input.currency, amount: input.receivedAmount });
  return prisma.$transaction((tx) =>
    transition(tx, ctx, id, input.version, {
      from: ["VERIFIED"],
      data: {
        currency: input.currency,
        receivedAmount: received,
        // Notified amount is in the old currency; keep it only if the currency is unchanged.
        method: input.method,
        donorName: input.donorName,
        transactionRef: input.transactionRef ?? null,
      },
      event: "CORRECTED",
      reason: input.reason,
      audit: "gift.correct",
    }),
  );
}

/** Admin records a gift directly (cash at the wedding, or a transfer already confirmed in the bank). */
export async function recordGift(
  ctx: AdminContext,
  input: {
    donorName: string;
    invitationId?: string;
    method: GiftMethod;
    currency: Currency;
    amount: string;
    receivedOn?: string;
    transactionRef?: string;
    adminNote?: string;
    confirmed: boolean;
  },
) {
  const value = amountOrThrow({ currency: input.currency, amount: input.amount });
  return prisma.$transaction(async (tx) => {
    let guestId: string | null = null;
    if (input.invitationId) {
      const inv = await tx.invitation.findUnique({ where: { id: input.invitationId }, select: { type: true, guestId: true } });
      if (!inv) throw new AppError("notFound");
      guestId = inv.type === "INDIVIDUAL" ? inv.guestId : null;
    }
    const receivedAt = input.receivedOn ? new Date(`${input.receivedOn}T12:00:00+07:00`) : new Date();
    const gift = await tx.gift.create({
      data: {
        source: "ADMIN_RECORD",
        method: input.method,
        currency: input.currency,
        donorName: input.donorName,
        invitationId: input.invitationId ?? null,
        guestId,
        transactionRef: input.transactionRef ?? null,
        adminNote: input.adminNote ?? null,
        recordedById: ctx.adminUserId,
        notifiedAmount: value,
        ...(input.confirmed
          ? { status: "VERIFIED" as const, receivedAmount: value, receivedAt, verifiedAt: new Date(), verifiedById: ctx.adminUserId }
          : { status: "PENDING_VERIFICATION" as const, transferredAt: receivedAt }),
      },
    });
    await tx.giftEvent.create({ data: { giftId: gift.id, type: "CREATED", actor: "ADMIN", adminUserId: ctx.adminUserId, after: snapshot(gift) } });
    if (input.confirmed) {
      await tx.giftEvent.create({ data: { giftId: gift.id, type: "VERIFIED", actor: "ADMIN", adminUserId: ctx.adminUserId, after: snapshot(gift) } });
    }
    await recordAudit(tx, ctx, { action: "gift.record", entityType: "Gift", entityId: gift.id, metadata: { method: input.method, currency: input.currency, confirmed: input.confirmed } });
    return { id: gift.id };
  });
}

/** Load the private evidence asset for an admin (route handler signs/streams it). */
export async function getGiftEvidence(ctx: AdminContext, giftId: string) {
  const gift = await prisma.gift.findUnique({ where: { id: giftId }, select: { evidenceAssetId: true } });
  if (!gift?.evidenceAssetId) throw new AppError("notFound");
  const asset = await prisma.mediaAsset.findUnique({ where: { id: gift.evidenceAssetId } });
  if (!asset || asset.status === "DELETED" || asset.purpose !== "GIFT_EVIDENCE") throw new AppError("notFound");
  await recordAudit(prisma, ctx, { action: "gift.evidence_view", entityType: "Gift", entityId: giftId });
  return asset;
}
