import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Currency, GiftMethod } from "@/generated/prisma/enums";
import type { AppLocale } from "@/i18n/locales";
import { env } from "@/lib/env";
import { parseAmount } from "@/lib/money";
import { prisma } from "@/lib/prisma/client";
import { hmacSha256, safeEqual } from "@/lib/security/crypto";
import type { ImageRef } from "@/lib/storage";
import { pickLocalized } from "@/lib/validation/localized";
import type { AdminContext } from "@/server/context";
import { AppError } from "@/server/errors";
import { recordAudit } from "./audit.service";
import { attachAsset, imageRefs, releaseAsset } from "./media.service";
import { hitRateLimit, LIMITS } from "./rate-limit.service";

/*
 * Monetary gifts — guest side + payment-method configuration.
 *  - Showing a KHQR code proves nothing: every guest notification is
 *    PENDING_VERIFICATION until an admin checks the bank (Phase 6).
 *  - Amounts are parsed as exact Decimals per currency (KHR = whole riel).
 *  - Totals are never exposed publicly.
 */

type Loc = { kh: string; en: string };
const json = (v: unknown) => v as Prisma.InputJsonValue;

// -------------------------------------------------------------- public

export type PublicPaymentMethod = {
  id: string;
  method: GiftMethod;
  label: string;
  bankName: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
  currencies: Currency[];
  qr: ImageRef | null;
  instructions: string;
};

export async function getPublicPaymentMethods(locale: AppLocale): Promise<PublicPaymentMethod[]> {
  const methods = await prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const qrs = await imageRefs(methods.map((m) => m.qrAssetId), 1200);
  return methods.map((m) => ({
    id: m.id,
    method: m.method,
    label: pickLocalized(m.label, locale).text,
    bankName: m.bankName,
    accountHolder: m.accountHolder,
    accountNumber: m.accountNumber,
    currencies: m.currencies,
    qr: (m.qrAssetId && qrs.get(m.qrAssetId)) || null,
    instructions: pickLocalized(m.instructions, locale).text,
  }));
}

export async function getGiftPageSettings(locale: AppLocale) {
  const s = await prisma.weddingSettings.findUnique({ where: { id: 1 }, select: { giftThankYou: true, giftEvidenceEnabled: true, sectionVisibility: true } });
  const sections = (s?.sectionVisibility ?? {}) as Record<string, boolean>;
  return {
    enabled: sections.gifts !== false,
    thankYou: pickLocalized(s?.giftThankYou, locale).text,
    evidenceEnabled: s?.giftEvidenceEnabled ?? true,
  };
}

/** Receipt binding an uploaded evidence file to one invitation (prevents attaching someone else's upload). */
export function evidenceReceipt(assetId: string, invitationId: string): string {
  return `${assetId}.${hmacSha256(env().AUTH_SECRET, `evidence:${assetId}:${invitationId}`)}`;
}

function verifyReceipt(receipt: string, invitationId: string): string | null {
  const [assetId, sig] = receipt.split(".");
  if (!assetId || !sig) return null;
  return safeEqual(evidenceReceipt(assetId, invitationId), receipt) ? assetId : null;
}

type NotificationInput = {
  donorName: string;
  amount: string;
  currency: Currency;
  method: "KHQR" | "BANK_TRANSFER" | "OTHER";
  paymentMethodId?: string;
  transactionRef?: string;
  transferredOn?: string;
  message?: string;
  evidenceReceipt?: string;
};

export async function createGiftNotification(invitationId: string, input: NotificationInput) {
  const limit = await hitRateLimit(`gift:inv:${invitationId}`, LIMITS.giftPerInvitation.limit, LIMITS.giftPerInvitation.windowSeconds);
  if (!limit.allowed) throw new AppError("rateLimited", { seconds: limit.retryAfterSeconds });

  const amount = parseAmount(input.amount, input.currency);
  if (!amount.ok) throw new AppError("invalidAmount");

  const settings = await getGiftPageSettings("en");
  if (!settings.enabled) throw new AppError("forbidden");

  if (input.paymentMethodId) {
    const pm = await prisma.paymentMethod.findFirst({ where: { id: input.paymentMethodId, isActive: true }, select: { id: true } });
    if (!pm) throw new AppError("paymentMethodInvalid");
  }

  let evidenceAssetId: string | null = null;
  if (input.evidenceReceipt) {
    if (!settings.evidenceEnabled) throw new AppError("evidenceInvalid");
    evidenceAssetId = verifyReceipt(input.evidenceReceipt, invitationId);
    if (!evidenceAssetId) throw new AppError("evidenceInvalid");
  }

  const transferredAt = input.transferredOn ? new Date(`${input.transferredOn}T00:00:00+07:00`) : null;
  if (transferredAt && (Number.isNaN(transferredAt.getTime()) || transferredAt.getTime() > Date.now() + 86400_000)) {
    throw new AppError("invalidInput");
  }

  return prisma.$transaction(async (tx) => {
    const inv = await tx.invitation.findUnique({ where: { id: invitationId }, select: { status: true, type: true, guestId: true } });
    if (!inv || inv.status !== "ACTIVE") throw new AppError("invitationInvalid");
    if (evidenceAssetId) {
      const asset = await tx.mediaAsset.findUnique({ where: { id: evidenceAssetId }, select: { status: true } });
      if (asset?.status !== "PENDING") throw new AppError("evidenceInvalid"); // single use
      await attachAsset(tx, evidenceAssetId, ["GIFT_EVIDENCE"]);
    }
    const gift = await tx.gift.create({
      data: {
        source: "GUEST_NOTIFICATION",
        method: input.method,
        status: "PENDING_VERIFICATION",
        currency: input.currency,
        notifiedAmount: amount.value.toFixed(2),
        donorName: input.donorName,
        invitationId,
        guestId: inv.type === "INDIVIDUAL" ? inv.guestId : null,
        paymentMethodId: input.paymentMethodId ?? null,
        transactionRef: input.transactionRef ?? null,
        transferredAt,
        message: input.message ?? null,
        evidenceAssetId,
      },
    });
    await tx.giftEvent.create({
      data: {
        giftId: gift.id,
        type: "CREATED",
        actor: "GUEST",
        after: { status: gift.status, currency: gift.currency, notifiedAmount: amount.value.toFixed(2), method: gift.method },
      },
    });
    return { id: gift.id };
  });
}

// -------------------------------------------------------------- admin: payment methods

type PaymentMethodData = {
  id?: string;
  method: "KHQR" | "BANK_TRANSFER";
  label: Loc;
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  currencies: Currency[];
  qrAssetId: string | null;
  instructions: Loc;
  isActive: boolean;
};

export async function listPaymentMethods(_ctx: AdminContext) {
  const methods = await prisma.paymentMethod.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const qrs = await imageRefs(methods.map((m) => m.qrAssetId), 480);
  return methods.map((m) => ({ ...m, qr: (m.qrAssetId && qrs.get(m.qrAssetId)) || null }));
}

export async function savePaymentMethod(ctx: AdminContext, input: PaymentMethodData) {
  const data = {
    method: input.method,
    label: json(input.label),
    bankName: input.bankName ?? null,
    accountHolder: input.accountHolder ?? null,
    accountNumber: input.accountNumber ?? null,
    currencies: input.currencies,
    qrAssetId: input.qrAssetId,
    instructions: json(input.instructions),
    isActive: input.isActive,
  };
  const released = await prisma.$transaction(async (tx) => {
    let old: string | null = null;
    if (input.id) {
      const before = await tx.paymentMethod.findUnique({ where: { id: input.id } });
      if (!before) throw new AppError("notFound");
      if (input.qrAssetId && input.qrAssetId !== before.qrAssetId) await attachAsset(tx, input.qrAssetId, ["KHQR_IMAGE"]);
      if (before.qrAssetId !== input.qrAssetId) old = before.qrAssetId;
      await tx.paymentMethod.update({ where: { id: input.id }, data });
      await recordAudit(tx, ctx, { action: "payment_method.update", entityType: "PaymentMethod", entityId: input.id, metadata: { isActive: input.isActive } });
    } else {
      if (input.qrAssetId) await attachAsset(tx, input.qrAssetId, ["KHQR_IMAGE"]);
      const agg = await tx.paymentMethod.aggregate({ _max: { sortOrder: true } });
      const pm = await tx.paymentMethod.create({ data: { ...data, sortOrder: (agg._max.sortOrder ?? -1) + 1 } });
      await recordAudit(tx, ctx, { action: "payment_method.create", entityType: "PaymentMethod", entityId: pm.id });
    }
    return old;
  });
  // A replaced QR is only deleted when no gift references it (gifts never reference QR images, but be safe).
  await releaseAsset(released);
}
