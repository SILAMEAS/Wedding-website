import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminContext } from "@/server/context";
import { AppError } from "@/server/errors";
import { correctGift, getGiftSummary, recordGift, rejectGift, reopenGift, verifyGift } from "@/server/services/gift-admin.service";
import { createGiftNotification } from "@/server/services/gift.service";
import { createIndividualInvitation } from "@/server/services/invitation.service";
import { resolveTokenGuarded } from "@/server/services/token-guard.service";
import { generateToken } from "@/lib/security/crypto";
import { adminCtx, tokenFromUrl } from "../support/fixtures";
import { createTestPrisma, resetDatabase } from "../support/test-db";

const prisma = createTestPrisma();
let ctx: AdminContext;

afterAll(() => prisma.$disconnect());
beforeEach(async () => {
  await resetDatabase(prisma);
  ctx = await adminCtx(prisma);
  await prisma.weddingSettings.create({ data: { id: 1, groomName: {}, brideName: {} } });
});

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}

async function invitation(name = "Dara") {
  const g = await prisma.guest.create({ data: { nameEn: name } });
  return createIndividualInvitation(ctx, { guestId: g.id, allowUnnamedGuests: false }, "kh");
}

async function notify(invitationId: string, amount: string, currency: "USD" | "KHR") {
  const { id } = await createGiftNotification(invitationId, { donorName: "Dara", amount, currency, method: "KHQR" });
  return prisma.gift.findUniqueOrThrow({ where: { id } });
}

describe("gift verification", () => {
  it("only verified gifts count; USD and KHR totals stay separate; received may differ from notified", async () => {
    const { invitationId } = await invitation();
    const a = await notify(invitationId, "100", "USD");
    const b = await notify(invitationId, "200000", "KHR");
    await notify(invitationId, "50", "USD"); // stays pending

    await verifyGift(ctx, a.id, { version: a.version, receivedAmount: "99.50" });
    await verifyGift(ctx, b.id, { version: b.version, receivedAmount: "200000" });

    const s = await getGiftSummary(ctx);
    expect(s.verified).toEqual({ USD: "99.50", KHR: "200000.00" });
    expect(s.pending).toEqual({ USD: "50.00", KHR: "0" });
    expect(s.pendingCount).toBe(1);
    expect(s.contributors).toBe(1); // same invitation counted once

    const verifiedA = await prisma.gift.findUniqueOrThrow({ where: { id: a.id } });
    expect(verifiedA.notifiedAmount?.toFixed(2)).toBe("100.00");
    expect(verifiedA.receivedAmount?.toFixed(2)).toBe("99.50");
  });

  it("sums many gifts exactly (no floating-point drift)", async () => {
    for (let i = 0; i < 30; i++) await recordGift(ctx, { donorName: `G${i}`, method: "CASH", currency: "USD", amount: "0.10", confirmed: true });
    expect((await getGiftSummary(ctx)).verified.USD).toBe("3.00");
  });

  it("rejects stale updates (optimistic locking)", async () => {
    const { invitationId } = await invitation();
    const g = await notify(invitationId, "20", "USD");
    await verifyGift(ctx, g.id, { version: g.version, receivedAmount: "20" });
    await expectCode(rejectGift(ctx, g.id, g.version, "dup"), "staleData");
  });

  it("corrections and reopening require a reason and keep full immutable history", async () => {
    const { invitationId } = await invitation();
    let g = await notify(invitationId, "40", "USD");
    g = await verifyGift(ctx, g.id, { version: g.version, receivedAmount: "40" });
    await expectCode(correctGift(ctx, g.id, { version: g.version, reason: " ", currency: "USD", receivedAmount: "45", method: "KHQR", donorName: "Dara" }), "invalidInput");
    g = await correctGift(ctx, g.id, { version: g.version, reason: "Bank showed $45", currency: "USD", receivedAmount: "45", method: "KHQR", donorName: "Dara" });
    expect(g.receivedAmount?.toFixed(2)).toBe("45.00");

    g = await reopenGift(ctx, g.id, g.version, "Verified the wrong transfer");
    expect(g.status).toBe("PENDING_VERIFICATION");
    expect(g.receivedAmount).toBeNull();

    const events = await prisma.giftEvent.findMany({ where: { giftId: g.id }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.type)).toEqual(["CREATED", "VERIFIED", "CORRECTED", "REOPENED"]);
    expect(events[2]!.before).toMatchObject({ receivedAmount: "40.00" });
    expect(events[2]!.after).toMatchObject({ receivedAmount: "45.00" });
    expect(events[2]!.reason).toBe("Bank showed $45");
    expect(await prisma.auditLog.count({ where: { action: { startsWith: "gift." } } })).toBe(3);
  });

  it("cash recorded by the couple counts immediately; KHR must be whole riel", async () => {
    await recordGift(ctx, { donorName: "Aunt", method: "CASH", currency: "KHR", amount: "100000", confirmed: true });
    await expectCode(recordGift(ctx, { donorName: "X", method: "CASH", currency: "KHR", amount: "10.5", confirmed: true }), "invalidAmount");
    const s = await getGiftSummary(ctx);
    expect(s.verified.KHR).toBe("100000.00");
    expect(s.byMethod.CASH?.KHR).toBe("100000.00");
  });

  it("rejected gifts never count", async () => {
    const { invitationId } = await invitation();
    const g = await notify(invitationId, "10", "USD");
    await rejectGift(ctx, g.id, g.version, "Not in bank");
    const s = await getGiftSummary(ctx);
    expect(s.verified.USD).toBe("0.00");
    expect(s.pendingCount).toBe(0);
  });
});

describe("token lookup limits", () => {
  it("many valid lookups from one IP (venue Wi-Fi) are fine; repeated invalid guesses get blocked", async () => {
    const { url } = await invitation();
    const token = tokenFromUrl(url);
    for (let i = 0; i < 50; i++) expect((await resolveTokenGuarded(token, "venue-wifi")).status).toBe("valid");

    for (let i = 0; i < 30; i++) await resolveTokenGuarded(generateToken(), "attacker");
    expect((await resolveTokenGuarded(token, "attacker")).status).toBe("tooMany");
    expect((await resolveTokenGuarded(token, "venue-wifi")).status).toBe("valid");
  });
});
