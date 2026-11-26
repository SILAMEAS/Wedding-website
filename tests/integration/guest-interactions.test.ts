import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { rsvpSchema } from "@/features/guest-actions/schemas";
import type { AdminContext } from "@/server/context";
import { AppError } from "@/server/errors";
import { createGiftNotification, evidenceReceipt, getPublicPaymentMethods } from "@/server/services/gift.service";
import { createFamilyInvitation, createIndividualInvitation } from "@/server/services/invitation.service";
import { uploadImage } from "@/server/services/media.service";
import { getCurrentRsvp, overrideRsvp, submitGuestRsvp } from "@/server/services/rsvp.service";
import { listPublicWishes, moderateWish, submitWish } from "@/server/services/wish.service";
import { storage } from "@/lib/storage";
import { adminCtx } from "../support/fixtures";
import { createTestPrisma, resetDatabase } from "../support/test-db";

process.env.MEDIA_STORAGE = "local";
const prisma = createTestPrisma();
let ctx: AdminContext;
const files: string[] = [];

afterAll(async () => {
  for (const publicId of files) await storage().remove({ publicId, deliveryType: "upload" });
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetDatabase(prisma);
  ctx = await adminCtx(prisma);
  await prisma.weddingSettings.create({ data: { id: 1, groomName: {}, brideName: {} } });
});

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}
const rsvp = (v: Record<string, unknown>) => rsvpSchema.parse(v);

async function family(n: number, opts: { capacity?: number; allowUnnamedGuests?: boolean } = {}) {
  const group = await prisma.guestGroup.create({ data: { nameEn: "Family" } });
  const members = [];
  for (let i = 0; i < n; i++) members.push(await prisma.guest.create({ data: { nameEn: `M${i}`, groupId: group.id } }));
  const { invitationId } = await createFamilyInvitation(ctx, { groupId: group.id, capacity: opts.capacity, allowUnnamedGuests: opts.allowUnnamedGuests ?? false }, "kh");
  return { invitationId, members };
}

async function individual(capacity = 1) {
  const g = await prisma.guest.create({ data: { nameEn: "Solo" } });
  const { invitationId } = await createIndividualInvitation(ctx, { guestId: g.id, capacity, allowUnnamedGuests: capacity > 1 }, "kh");
  return { invitationId, guest: g };
}

describe("RSVP", () => {
  it("family selects which members attend; declined members are recorded", async () => {
    const { invitationId, members } = await family(3);
    await submitGuestRsvp(invitationId, rsvp({ status: "ATTENDING", attendees: [members[0]!.id, members[2]!.id], dietary: "No pork" }));
    const r = await getCurrentRsvp(invitationId);
    expect(r?.attendingCount).toBe(2);
    expect(r?.dietary).toBe("No pork");
    expect(r?.participants.filter((p) => p.attending).map((p) => p.guestId).sort()).toEqual([members[0]!.id, members[2]!.id].sort());
    expect(r?.participants).toHaveLength(3);
  });

  it("cannot exceed capacity (named + unnamed)", async () => {
    const { invitationId, members } = await family(3, { capacity: 2 });
    await expectCode(submitGuestRsvp(invitationId, rsvp({ status: "ATTENDING", attendees: members.map((m) => m.id) })), "capacityExceeded");
    const solo = await individual(2);
    await expectCode(submitGuestRsvp(solo.invitationId, rsvp({ status: "ATTENDING", attendees: [solo.guest.id], unnamedGuests: 2 })), "capacityExceeded");
    await submitGuestRsvp(solo.invitationId, rsvp({ status: "ATTENDING", attendees: [solo.guest.id], unnamedGuests: 1 }));
    expect((await getCurrentRsvp(solo.invitationId))?.attendingCount).toBe(2);
  });

  it("rejects participants from another invitation and unnamed guests when not allowed", async () => {
    const a = await family(2);
    const b = await family(1);
    await expectCode(submitGuestRsvp(a.invitationId, rsvp({ status: "ATTENDING", attendees: [b.members[0]!.id] })), "participantNotAllowed");
    await expectCode(submitGuestRsvp(a.invitationId, rsvp({ status: "ATTENDING", attendees: [a.members[0]!.id], unnamedGuests: 1 })), "participantNotAllowed");
  });

  it("attending requires at least one person; declining clears attendance", async () => {
    const { invitationId, members } = await family(2);
    await expectCode(submitGuestRsvp(invitationId, rsvp({ status: "ATTENDING", attendees: [] })), "noAttendees");
    await submitGuestRsvp(invitationId, rsvp({ status: "DECLINED", attendees: [members[0]!.id] }));
    const r = await getCurrentRsvp(invitationId);
    expect(r?.attendingCount).toBe(0);
    expect(r?.participants.every((p) => !p.attending)).toBe(true);
  });

  it("updates keep one current RSVP and append history with name snapshots", async () => {
    const { invitationId, members } = await family(2);
    await submitGuestRsvp(invitationId, rsvp({ status: "ATTENDING", attendees: [members[0]!.id] }));
    await submitGuestRsvp(invitationId, rsvp({ status: "ATTENDING", attendees: [members[0]!.id, members[1]!.id] }));
    expect(await prisma.rsvp.count()).toBe(1);
    const history = await prisma.rsvpHistory.findMany({ orderBy: { version: "asc" } });
    expect(history.map((h) => h.version)).toEqual([1, 2]);
    expect(JSON.stringify(history[1]!.snapshot)).toContain("M1");
  });

  it("MAYBE only when enabled", async () => {
    const { invitationId, members } = await family(1);
    await expectCode(submitGuestRsvp(invitationId, rsvp({ status: "MAYBE", attendees: [members[0]!.id] })), "maybeNotAllowed");
    await prisma.weddingSettings.update({ where: { id: 1 }, data: { rsvpAllowMaybe: true } });
    await expect(submitGuestRsvp(invitationId, rsvp({ status: "MAYBE", attendees: [members[0]!.id] }))).resolves.toBeTruthy();
  });

  it("deadline closes guest updates; per-invitation override extends it; admin override always works and is audited", async () => {
    const { invitationId, members } = await family(1);
    await prisma.weddingSettings.update({ where: { id: 1 }, data: { rsvpDeadline: new Date(Date.now() - 60_000) } });
    await expectCode(submitGuestRsvp(invitationId, rsvp({ status: "DECLINED" })), "rsvpClosed");

    await prisma.invitation.update({ where: { id: invitationId }, data: { rsvpDeadlineOverride: new Date(Date.now() + 86400_000) } });
    await expect(submitGuestRsvp(invitationId, rsvp({ status: "DECLINED" }))).resolves.toBeTruthy();
    await prisma.invitation.update({ where: { id: invitationId }, data: { rsvpDeadlineOverride: null } });

    await overrideRsvp(ctx, invitationId, rsvp({ status: "ATTENDING", attendees: [members[0]!.id] }), "Called the couple");
    const last = await prisma.rsvpHistory.findFirstOrThrow({ orderBy: { version: "desc" } });
    expect(last).toMatchObject({ actor: "ADMIN", reason: "Called the couple" });
    expect(await prisma.auditLog.count({ where: { action: "rsvp.override" } })).toBe(1);
  });

  it("revoked or inactive invitations cannot RSVP", async () => {
    const { invitationId } = await family(1);
    await prisma.invitation.update({ where: { id: invitationId }, data: { status: "INACTIVE" } });
    await expectCode(submitGuestRsvp(invitationId, rsvp({ status: "DECLINED" })), "invitationInvalid");
  });

  it("concurrent submissions never exceed capacity and history stays sequential", async () => {
    const { invitationId, members } = await family(4, { capacity: 4 });
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        submitGuestRsvp(invitationId, rsvp({ status: "ATTENDING", attendees: members.slice(0, (i % 4) + 1).map((m) => m.id) })),
      ),
    );
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const r = await getCurrentRsvp(invitationId);
    expect(r!.attendingCount).toBeLessThanOrEqual(4);
    const versions = (await prisma.rsvpHistory.findMany({ orderBy: { version: "asc" } })).map((h) => h.version);
    expect(versions).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("wishes", () => {
  const wish = (message: string, visibility: "PUBLIC" | "PRIVATE" = "PUBLIC") => ({ authorName: "Dara", message, visibility });

  it("new wishes are pending and not public until approved; private ones never are", async () => {
    const { invitationId } = await individual();
    await submitWish({ invitationId }, wish("Congratulations!"), "ip1");
    await submitWish({ invitationId }, wish("A private note", "PRIVATE"), "ip1");
    expect(await listPublicWishes()).toEqual([]);

    const [pub, priv] = await prisma.wish.findMany({ orderBy: { createdAt: "asc" } });
    await moderateWish(ctx, pub!.id, "approve");
    await moderateWish(ctx, priv!.id, "approve");
    expect((await listPublicWishes()).map((w) => w.message)).toEqual(["Congratulations!"]);

    await moderateWish(ctx, pub!.id, "hide");
    expect(await listPublicWishes()).toEqual([]);
  });

  it("blocks duplicates, rate-limits, and silently drops honeypot spam", async () => {
    const { invitationId } = await individual();
    await submitWish({ invitationId }, wish("Best wishes to you both"), "ip1");
    await expectCode(submitWish({ invitationId }, wish("  BEST wishes   to you both "), "ip1"), "duplicateWish");
    await submitWish({ invitationId }, { ...wish("buy pills"), website: "http://spam" }, "ip1");
    expect(await prisma.wish.count()).toBe(1);

    // 5 per invitation per hour: the accepted wish and the rejected duplicate both count; honeypot hits do not.
    for (let i = 0; i < 3; i++) await submitWish({ invitationId }, wish(`Wish number ${i}`), "ip2");
    await expectCode(submitWish({ invitationId }, wish("one too many"), "ip3"), "rateLimited");
  });

  it("can be turned off by the couple", async () => {
    const { invitationId } = await individual();
    await prisma.weddingSettings.update({ where: { id: 1 }, data: { wishesPublicEnabled: false } });
    await expectCode(submitWish({ invitationId }, wish("hello"), "ip"), "wishesClosed");
  });
});

describe("gift notifications", () => {
  const base = { donorName: "Dara", method: "KHQR" as const };
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

  it("are stored as PENDING_VERIFICATION with exact decimals and an immutable event", async () => {
    const { invitationId } = await individual();
    await createGiftNotification(invitationId, { ...base, amount: "1,250.50", currency: "USD" });
    const gift = await prisma.gift.findFirstOrThrow({ include: { events: true } });
    expect(gift.status).toBe("PENDING_VERIFICATION");
    expect(gift.notifiedAmount?.toFixed(2)).toBe("1250.50");
    expect(gift.receivedAmount).toBeNull(); // never auto-verified
    expect(gift.events.map((e) => e.type)).toEqual(["CREATED"]);
  });

  it("validates amounts per currency", async () => {
    const { invitationId } = await individual();
    await expectCode(createGiftNotification(invitationId, { ...base, amount: "100.5", currency: "KHR" }), "invalidAmount");
    await expectCode(createGiftNotification(invitationId, { ...base, amount: "0", currency: "USD" }), "invalidAmount");
    await expectCode(createGiftNotification(invitationId, { ...base, amount: "12.345", currency: "USD" }), "invalidAmount");
    await expect(createGiftNotification(invitationId, { ...base, amount: "400000", currency: "KHR" })).resolves.toBeTruthy();
  });

  it("rejects inactive payment methods", async () => {
    const { invitationId } = await individual();
    const pm = await prisma.paymentMethod.create({ data: { method: "BANK_TRANSFER", label: { en: "ABA" }, currencies: ["USD"], isActive: false } });
    await expectCode(createGiftNotification(invitationId, { ...base, amount: "10", currency: "USD", paymentMethodId: pm.id }), "paymentMethodInvalid");
    expect(await getPublicPaymentMethods("en")).toEqual([]);
  });

  it("evidence receipts are bound to one invitation and single-use", async () => {
    const a = await individual();
    const b = await prisma.guest.create({ data: { nameEn: "Other" } });
    const { invitationId: otherInv } = await createIndividualInvitation(ctx, { guestId: b.id, allowUnnamedGuests: false }, "kh");

    const up = await uploadImage(new File([new Uint8Array(PNG)], "proof.png"), "GIFT_EVIDENCE");
    const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: up.assetId } });
    files.push(asset.publicId);
    expect(asset.deliveryType).toBe("upload"); // local dev; Cloudinary uses "authenticated"
    expect(up.preview.src).toBe(""); // no URL is ever handed out for evidence

    const receipt = evidenceReceipt(up.assetId, a.invitationId);
    await expectCode(createGiftNotification(otherInv, { ...base, amount: "5", currency: "USD", evidenceReceipt: receipt }), "evidenceInvalid");
    await createGiftNotification(a.invitationId, { ...base, amount: "5", currency: "USD", evidenceReceipt: receipt });
    await expectCode(createGiftNotification(a.invitationId, { ...base, amount: "6", currency: "USD", evidenceReceipt: receipt }), "evidenceInvalid");
    expect((await prisma.gift.findFirstOrThrow({ where: { evidenceAssetId: up.assetId } })).invitationId).toBe(a.invitationId);
  });
});
