import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { generateToken } from "@/lib/security/crypto";
import type { AdminContext } from "@/server/context";
import { AppError } from "@/server/errors";
import {
  createFamilyInvitation,
  createIndividualInvitation,
  getInvitation,
  isLikelyBot,
  recordInvitationAccess,
  resolveInvitationToken,
  revealInvitationLink,
  revokeInvitation,
  rotateInvitationToken,
  setInvitationActive,
  updateInvitation,
} from "@/server/services/invitation.service";
import { adminCtx, tokenFromUrl } from "../support/fixtures";
import { createTestPrisma, resetDatabase } from "../support/test-db";

const prisma = createTestPrisma();
let ctx: AdminContext;

afterAll(() => prisma.$disconnect());
beforeEach(async () => {
  await resetDatabase(prisma);
  ctx = await adminCtx(prisma);
});

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}

const base = { allowUnnamedGuests: false };

async function newGuest(nameKh = "សុខ ដារ៉ា", extra: Record<string, unknown> = {}) {
  return prisma.guest.create({ data: { nameKh, nameEn: "Sok Dara", phone: "012 345 678", notes: "secret note", ...extra } });
}

async function newFamily(memberNames: string[]) {
  const group = await prisma.guestGroup.create({ data: { nameKh: "គ្រួសារ លោក ចាន់", nameEn: "Chan Family" } });
  for (const n of memberNames) await prisma.guest.create({ data: { nameEn: n, groupId: group.id, phone: "099 999 999" } });
  return group;
}

describe("individual invitations", () => {
  it("creates an invitation whose link resolves to that guest only", async () => {
    const guest = await newGuest();
    const { invitationId, url } = await createIndividualInvitation(ctx, { ...base, guestId: guest.id }, "kh");
    const origin = new URL(process.env.APP_URL!).origin;
    expect(url.startsWith(`${origin}/kh/invitation/`)).toBe(true);
    expect(url.slice(`${origin}/kh/invitation/`.length)).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const res = await resolveInvitationToken(tokenFromUrl(url));
    expect(res.status).toBe("valid");
    if (res.status !== "valid") return;
    expect(res.invitation.invitationId).toBe(invitationId);
    expect(res.invitation.members).toEqual([{ id: guest.id, nameEn: "Sok Dara", nameKh: "សុខ ដារ៉ា" }]);
    // Public DTO never carries private fields.
    const json = JSON.stringify(res);
    expect(json).not.toContain("012 345 678");
    expect(json).not.toContain("secret note");
  });

  it("stores only a hash and an encrypted copy of the token, never the raw token", async () => {
    const guest = await newGuest();
    const { url } = await createIndividualInvitation(ctx, { ...base, guestId: guest.id }, "en");
    const raw = tokenFromUrl(url);
    const row = await prisma.invitationToken.findFirstOrThrow();
    expect(row.tokenHash).not.toContain(raw);
    expect(row.tokenCiphertext).not.toContain(raw);
    const audits = await prisma.auditLog.findMany();
    expect(JSON.stringify(audits)).not.toContain(raw);
  });

  it("rejects a guest who belongs to a family group", async () => {
    const group = await newFamily(["A"]);
    const member = await prisma.guest.findFirstOrThrow({ where: { groupId: group.id } });
    await expectCode(createIndividualInvitation(ctx, { ...base, guestId: member.id }, "kh"), "guestInGroup");
  });

  it("rejects a second live invitation for the same guest", async () => {
    const guest = await newGuest();
    await createIndividualInvitation(ctx, { ...base, guestId: guest.id }, "kh");
    await expectCode(createIndividualInvitation(ctx, { ...base, guestId: guest.id }, "kh"), "invitationExists");
  });

  it("extra individual seats are always unnamed (+1)", async () => {
    const guest = await newGuest();
    const { invitationId } = await createIndividualInvitation(ctx, { ...base, guestId: guest.id, capacity: 2 }, "kh");
    const inv = await prisma.invitation.findUniqueOrThrow({ where: { id: invitationId } });
    expect(inv.capacity).toBe(2);
    expect(inv.allowUnnamedGuests).toBe(true);
  });
});

describe("family invitations", () => {
  it("one invitation covers several members; capacity defaults to member count", async () => {
    const group = await newFamily(["Chan Bopha", "Chan Vichea", "Chan Sophea"]);
    const { invitationId, url } = await createFamilyInvitation(ctx, { ...base, groupId: group.id }, "kh");
    expect(await prisma.invitation.count()).toBe(1);
    const res = await resolveInvitationToken(tokenFromUrl(url));
    expect(res.status === "valid" && res.invitation.members.map((m) => m.nameEn)).toEqual(["Chan Bopha", "Chan Vichea", "Chan Sophea"]);
    expect(res.status === "valid" && res.invitation.owner.nameEn).toBe("Chan Family");
    expect((await prisma.invitation.findUniqueOrThrow({ where: { id: invitationId } })).capacity).toBe(3);
    expect(JSON.stringify(res)).not.toContain("099 999 999");
  });

  it("refuses an empty group and seats beyond members without +guests", async () => {
    const empty = await prisma.guestGroup.create({ data: { nameEn: "Empty" } });
    await expectCode(createFamilyInvitation(ctx, { ...base, groupId: empty.id }, "kh"), "groupEmpty");
    const group = await newFamily(["A", "B"]);
    await expectCode(createFamilyInvitation(ctx, { ...base, groupId: group.id, capacity: 3 }, "kh"), "capacityBelowMembers");
    await expect(createFamilyInvitation(ctx, { groupId: group.id, capacity: 3, allowUnnamedGuests: true }, "kh")).resolves.toBeTruthy();
  });

  it("a token cannot see another invitation's members", async () => {
    const famA = await newFamily(["A1", "A2"]);
    const famB = await prisma.guestGroup.create({ data: { nameEn: "B Family" } });
    await prisma.guest.create({ data: { nameEn: "B1", groupId: famB.id } });
    const a = await createFamilyInvitation(ctx, { ...base, groupId: famA.id }, "kh");
    await createFamilyInvitation(ctx, { ...base, groupId: famB.id }, "kh");
    const res = await resolveInvitationToken(tokenFromUrl(a.url));
    expect(res.status === "valid" && res.invitation.members.map((m) => m.nameEn)).toEqual(["A1", "A2"]);
  });
});

describe("token lifecycle", () => {
  it("unknown and malformed tokens are 'invalid' (reveals nothing)", async () => {
    expect(await resolveInvitationToken(generateToken())).toEqual({ status: "invalid" });
    expect(await resolveInvitationToken("short")).toEqual({ status: "invalid" });
    expect(await resolveInvitationToken("../../etc/passwd" + "x".repeat(30))).toEqual({ status: "invalid" });
  });

  it("rotation invalidates the previous link immediately", async () => {
    const guest = await newGuest();
    const { invitationId, url: oldUrl } = await createIndividualInvitation(ctx, { ...base, guestId: guest.id }, "kh");
    const newUrl = await rotateInvitationToken(ctx, invitationId, "kh");
    expect(newUrl).not.toBe(oldUrl);
    expect((await resolveInvitationToken(tokenFromUrl(oldUrl))).status).toBe("inactive");
    expect((await resolveInvitationToken(tokenFromUrl(newUrl))).status).toBe("valid");

    const tokens = await prisma.invitationToken.findMany({ where: { invitationId }, orderBy: { createdAt: "asc" } });
    expect(tokens.map((t) => t.status)).toEqual(["ROTATED", "ACTIVE"]);
    expect(tokens[0]!.tokenCiphertext).toBeNull(); // old secret erased
  });

  it("deactivation is reversible; revocation is permanent", async () => {
    const guest = await newGuest();
    const { invitationId, url } = await createIndividualInvitation(ctx, { ...base, guestId: guest.id }, "kh");
    const token = tokenFromUrl(url);

    await setInvitationActive(ctx, invitationId, false);
    expect((await resolveInvitationToken(token)).status).toBe("inactive");
    await setInvitationActive(ctx, invitationId, true);
    expect((await resolveInvitationToken(token)).status).toBe("valid");

    await revokeInvitation(ctx, invitationId, "duplicate");
    expect((await resolveInvitationToken(token)).status).toBe("inactive");
    await expectCode(rotateInvitationToken(ctx, invitationId, "kh"), "invitationRevoked");
    await expectCode(setInvitationActive(ctx, invitationId, true), "invitationRevoked");
    await expectCode(revealInvitationLink(ctx, invitationId, "kh"), "invitationRevoked");

    // After revocation the guest may receive a fresh invitation.
    await expect(createIndividualInvitation(ctx, { ...base, guestId: guest.id }, "kh")).resolves.toBeTruthy();
  });

  it("archived owners make the link inactive", async () => {
    const guest = await newGuest();
    const { url } = await createIndividualInvitation(ctx, { ...base, guestId: guest.id }, "kh");
    await prisma.guest.update({ where: { id: guest.id }, data: { archivedAt: new Date() } });
    expect((await resolveInvitationToken(tokenFromUrl(url))).status).toBe("inactive");
  });

  it("reveal returns the same working link and is audited", async () => {
    const guest = await newGuest();
    const { invitationId, url } = await createIndividualInvitation(ctx, { ...base, guestId: guest.id, preferredLocale: "en" }, "kh");
    const revealed = await revealInvitationLink(ctx, invitationId, "kh");
    expect(revealed.url).toBe(url);
    expect(revealed.locale).toBe("en");
    expect(await prisma.auditLog.count({ where: { action: "invitation.link_reveal", entityId: invitationId } })).toBe(1);
  });

  it("concurrent rotations leave exactly one active token", async () => {
    const guest = await newGuest();
    const { invitationId } = await createIndividualInvitation(ctx, { ...base, guestId: guest.id }, "kh");
    await Promise.all(Array.from({ length: 5 }, () => rotateInvitationToken(ctx, invitationId, "kh")));
    expect(await prisma.invitationToken.count({ where: { invitationId, status: "ACTIVE" } })).toBe(1);
    expect(await prisma.invitationToken.count({ where: { invitationId, status: "ROTATED" } })).toBe(5);
  });
});

describe("capacity changes", () => {
  it("cannot lower capacity below the current RSVP attendance", async () => {
    const group = await newFamily(["A", "B", "C"]);
    const { invitationId } = await createFamilyInvitation(ctx, { ...base, groupId: group.id }, "kh");
    await prisma.rsvp.create({ data: { invitationId, status: "ATTENDING", attendingCount: 3, lastActor: "GUEST" } });
    await expectCode(updateInvitation(ctx, { id: invitationId, capacity: 2, allowUnnamedGuests: false }), "capacityBelowAttending");
    await expect(updateInvitation(ctx, { id: invitationId, capacity: 3, allowUnnamedGuests: false })).resolves.toBeUndefined();
  });

  it("stores the RSVP deadline override as Phnom Penh time", async () => {
    const guest = await newGuest();
    const { invitationId } = await createIndividualInvitation(ctx, { ...base, guestId: guest.id }, "kh");
    await updateInvitation(ctx, { id: invitationId, capacity: 1, allowUnnamedGuests: false, rsvpDeadlineOverride: "2027-01-10T18:00" });
    const inv = await prisma.invitation.findUniqueOrThrow({ where: { id: invitationId } });
    expect(inv.rsvpDeadlineOverride?.toISOString()).toBe("2027-01-10T11:00:00.000Z");
  });
});

describe("access logging", () => {
  it("counts real opens, ignores link-preview bots, and stores no IP/user agent", async () => {
    const guest = await newGuest();
    const { invitationId, url } = await createIndividualInvitation(ctx, { ...base, guestId: guest.id }, "kh");
    const res = await resolveInvitationToken(tokenFromUrl(url));
    if (res.status !== "valid") throw new Error("expected valid");

    await recordInvitationAccess(invitationId, res.invitation.tokenId, "OPENED", "TelegramBot (like TwitterBot)");
    let inv = await prisma.invitation.findUniqueOrThrow({ where: { id: invitationId } });
    expect(inv.firstOpenedAt).toBeNull();

    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1";
    await recordInvitationAccess(invitationId, res.invitation.tokenId, "OPENED", ua);
    inv = await prisma.invitation.findUniqueOrThrow({ where: { id: invitationId } });
    expect(inv.firstOpenedAt).not.toBeNull();

    const logs = await prisma.invitationAccessLog.findMany({ where: { invitationId } });
    expect(logs.map((l) => l.isLikelyBot).sort()).toEqual([false, true]);
    expect(logs.find((l) => !l.isLikelyBot)?.deviceClass).toBe("mobile");
    expect(JSON.stringify(logs)).not.toContain("iPhone OS");

    const detail = await getInvitation(ctx, invitationId);
    expect(detail.stats.opens).toBe(1);
  });

  it("bot detection", () => {
    expect(isLikelyBot("facebookexternalhit/1.1")).toBe(true);
    expect(isLikelyBot(null)).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36")).toBe(false);
  });
});
