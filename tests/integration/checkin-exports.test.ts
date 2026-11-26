import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminContext } from "@/server/context";
import { AppError } from "@/server/errors";
import { getAnalytics } from "@/server/services/analytics.service";
import { checkInStats, confirmCheckIn, extractToken, lookupScan, searchParties, voidCheckIn } from "@/server/services/checkin.service";
import { exportResource } from "@/server/services/export.service";
import { verifyGift } from "@/server/services/gift-admin.service";
import { createGiftNotification } from "@/server/services/gift.service";
import { createIndividualInvitation } from "@/server/services/invitation.service";
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

async function invitation(name = "Dara", capacity = 2) {
  const g = await prisma.guest.create({ data: { nameEn: name, phone: "012 345 678" } });
  return createIndividualInvitation(ctx, { guestId: g.id, capacity, allowUnnamedGuests: false }, "kh");
}

const text = (b: Uint8Array) => new TextDecoder().decode(b);

describe("check-in", () => {
  it("extracts the token from a scanned URL or a bare token, rejecting junk", async () => {
    const { url } = await invitation();
    const token = tokenFromUrl(url);
    expect(extractToken(url)).toBe(token);
    expect(extractToken(`${url}?utm=qr`)).toBe(token);
    expect(extractToken(`  ${token}  `)).toBe(token);
    expect(extractToken("https://evil.example/hello")).toBeNull();
    expect(extractToken("")).toBeNull();
  });

  it("looks up a party from the scanned QR and by name", async () => {
    const { url, invitationId } = await invitation("Sokha Chan");
    const party = await lookupScan(ctx, url);
    expect(party).toMatchObject({ invitationId, capacity: 2, tokenStatus: "ACTIVE", arrivedTotal: 0 });
    await expectCode(lookupScan(ctx, "not a token"), "notFound");

    const found = await searchParties(ctx, "sokha");
    expect(found).toEqual([expect.objectContaining({ invitationId, arrived: 0 })]);
    expect(await searchParties(ctx, "s")).toEqual([]);
  });

  it("blocks a second check-in unless overridden with a reason, and audits both", async () => {
    const { invitationId } = await invitation();
    await confirmCheckIn(ctx, { invitationId, arrivedCount: 2, override: false });
    await expectCode(confirmCheckIn(ctx, { invitationId, arrivedCount: 1, override: false }), "alreadyCheckedIn");
    await expectCode(confirmCheckIn(ctx, { invitationId, arrivedCount: 1, override: true, reason: "  " }), "invalidInput");
    await confirmCheckIn(ctx, { invitationId, arrivedCount: 1, override: true, reason: "Late car" });

    const stats = await checkInStats(ctx);
    expect(stats).toMatchObject({ guestsArrived: 3, partiesArrived: 1 });
    const actions = (await prisma.auditLog.findMany({ where: { entityId: invitationId }, select: { action: true } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["checkin.confirm", "checkin.override"]));
  });

  it("serializes simultaneous scans of the same QR: only one wins without override", async () => {
    const { invitationId } = await invitation();
    const results = await Promise.allSettled([
      confirmCheckIn(ctx, { invitationId, arrivedCount: 1, override: false }),
      confirmCheckIn(ctx, { invitationId, arrivedCount: 1, override: false }),
      confirmCheckIn(ctx, { invitationId, arrivedCount: 1, override: false }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.guestCheckIn.count({ where: { invitationId } })).toBe(1);
  });

  it("needs an override for an inactive invitation", async () => {
    const { invitationId } = await invitation();
    await prisma.invitation.update({ where: { id: invitationId }, data: { status: "INACTIVE" } });
    await expectCode(confirmCheckIn(ctx, { invitationId, arrivedCount: 1, override: false }), "invitationInvalid");
    await confirmCheckIn(ctx, { invitationId, arrivedCount: 1, override: true, reason: "Couple approved at the door" });
  });

  it("voids a check-in (kept for history) so the party can be checked in again", async () => {
    const { invitationId } = await invitation();
    const c = await confirmCheckIn(ctx, { invitationId, arrivedCount: 2, override: false });
    await expectCode(voidCheckIn(ctx, c.id, ""), "invalidInput");
    await voidCheckIn(ctx, c.id, "Wrong family");
    await expectCode(voidCheckIn(ctx, c.id, "again"), "notFound");
    expect((await checkInStats(ctx)).guestsArrived).toBe(0);
    expect(await prisma.guestCheckIn.count({ where: { invitationId } })).toBe(1);
    await confirmCheckIn(ctx, { invitationId, arrivedCount: 2, override: false });
  });

  it("rejects silly arrival counts", async () => {
    const { invitationId } = await invitation();
    await expectCode(confirmCheckIn(ctx, { invitationId, arrivedCount: 0, override: false }), "invalidInput");
    await expectCode(confirmCheckIn(ctx, { invitationId, arrivedCount: 51, override: false }), "invalidInput");
  });
});

describe("exports", () => {
  it("exports guests as CSV with a formula-injection guard, and audits the download", async () => {
    await prisma.guest.create({ data: { nameEn: "=HYPERLINK(\"x\")", category: "FRIEND" } });
    await prisma.guest.create({ data: { nameEn: "Vanna", category: "VIP" } });
    const all = await exportResource(ctx, "guests", "csv", {}, "en");
    expect(all.rows).toBe(2);
    expect(all.contentType).toMatch(/text\/csv/);
    expect(all.filename).toMatch(/^wedding-guests-[0-9-]+\.csv$/);
    expect(text(all.body)).toContain("'=HYPERLINK");

    const vip = await exportResource(ctx, "guests", "csv", { category: "VIP" }, "en");
    expect(vip.rows).toBe(1);
    expect(text(vip.body)).toContain("Vanna");

    const audit = await prisma.auditLog.findMany({ where: { action: "export.download" } });
    expect(audit).toHaveLength(2);
  });

  it("never exports invitation tokens", async () => {
    const { url } = await invitation();
    const token = tokenFromUrl(url);
    for (const format of ["csv", "xlsx"] as const) {
      const out = await exportResource(ctx, "invitations", format, {}, "en");
      expect(out.rows).toBe(1);
      if (format === "csv") expect(text(out.body)).not.toContain(token);
    }
    const csv = text((await exportResource(ctx, "invitations", "csv", {}, "en")).body);
    expect(csv).not.toMatch(/token/i);
  });

  it("keeps USD and KHR in separate columns and writes a valid XLSX", async () => {
    const { invitationId } = await invitation();
    const usd = await createGiftNotification(invitationId, { donorName: "Dara", amount: "50", currency: "USD", method: "KHQR" });
    await createGiftNotification(invitationId, { donorName: "Dara", amount: "100000", currency: "KHR", method: "KHQR" });
    const g = await prisma.gift.findUniqueOrThrow({ where: { id: usd.id } });
    await verifyGift(ctx, g.id, { version: g.version, receivedAmount: "50.00" });

    const csv = text((await exportResource(ctx, "gifts", "csv", {}, "en")).body);
    const [header, ...lines] = csv.trim().split(/\r?\n/);
    expect(header).toContain("Received USD");
    expect(header).toContain("Received KHR");
    expect(lines).toHaveLength(2);
    expect(csv).not.toContain("100050");

    const xlsx = await exportResource(ctx, "gifts", "xlsx", { currency: "KHR" }, "en");
    expect(xlsx.rows).toBe(1);
    // XLSX is a zip: starts with "PK".
    expect(xlsx.body[0]).toBe(0x50);
    expect(xlsx.body[1]).toBe(0x4b);
  });

  it("exports every resource without error on an empty database", async () => {
    for (const r of ["guests", "groups", "invitations", "rsvps", "checkins", "wishes", "gifts"] as const) {
      const out = await exportResource(ctx, r, "csv", {}, "kh");
      expect(out.rows).toBe(0);
    }
  });
});

describe("analytics", () => {
  it("returns per-day series in Phnom Penh time with currencies separate", async () => {
    const { invitationId } = await invitation();
    const n = await createGiftNotification(invitationId, { donorName: "Dara", amount: "20", currency: "USD", method: "KHQR" });
    const g = await prisma.gift.findUniqueOrThrow({ where: { id: n.id } });
    await verifyGift(ctx, g.id, { version: g.version, receivedAmount: "20" });

    const a = await getAnalytics(ctx);
    expect(a.giftsUsd.at(-1)?.value).toBe(20);
    expect(a.giftsKhr).toEqual([]);
    expect(a.rsvpDistribution.find((d) => d.key === "AWAITING")?.value).toBe(1);
    expect(a.categories.reduce((n, c) => n + c.value, 0)).toBe(1);
  });
});
