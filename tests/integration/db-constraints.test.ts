import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createTestPrisma, resetDatabase } from "../support/test-db";

/**
 * Proves the database itself enforces the invariants from Phase 1 §3/§6/§8,
 * independent of any application code.
 */
const prisma: PrismaClient = createTestPrisma();

afterAll(() => prisma.$disconnect());
beforeEach(() => resetDatabase(prisma));

/** Flattens a Prisma/driver error so we can match on the underlying Postgres message or constraint name. */
async function dbError(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    const err = e as { message?: string; meta?: unknown; cause?: unknown };
    return [err.message, JSON.stringify(err.meta ?? {}), String(err.cause ?? "")].join(" | ");
  }
  throw new Error("Expected the database to reject this operation, but it succeeded");
}

const guest = (nameKh = "សុខ") => prisma.guest.create({ data: { nameKh } });
const group = (nameEn = "Sok Family") => prisma.guestGroup.create({ data: { nameEn } });

async function individualInvitation(capacity = 1, allowUnnamedGuests = false) {
  const g = await guest();
  const inv = await prisma.invitation.create({ data: { type: "INDIVIDUAL", guestId: g.id, capacity, allowUnnamedGuests } });
  return { guest: g, inv };
}

async function familyInvitation(memberCount: number, capacity = memberCount) {
  const grp = await group();
  const members = [];
  for (let i = 0; i < memberCount; i++) {
    members.push(await prisma.guest.create({ data: { nameEn: `Member ${i}`, groupId: grp.id } }));
  }
  const inv = await prisma.invitation.create({ data: { type: "FAMILY", groupId: grp.id, capacity } });
  return { group: grp, members, inv };
}

describe("guests & groups", () => {
  it("requires at least one non-blank name", async () => {
    expect(await dbError(prisma.guest.create({ data: { nameEn: "  ", nameKh: "" } }))).toMatch(/guests_has_name/);
    expect(await dbError(prisma.guestGroup.create({ data: {} }))).toMatch(/guest_groups_has_name/);
  });

  it("primary contact must be a member of the group", async () => {
    const grp = await group();
    const outsider = await guest();
    expect(
      await dbError(prisma.guestGroup.update({ where: { id: grp.id }, data: { primaryContactGuestId: outsider.id } })),
    ).toMatch(/primary contact must belong to group/);

    const member = await prisma.guest.create({ data: { nameEn: "Dara", groupId: grp.id } });
    await expect(
      prisma.guestGroup.update({ where: { id: grp.id }, data: { primaryContactGuestId: member.id } }),
    ).resolves.toBeTruthy();
  });
});

describe("invitation owner XOR", () => {
  it("rejects an invitation with both a guest and a group", async () => {
    const g = await guest();
    const grp = await group();
    expect(
      await dbError(prisma.invitation.create({ data: { type: "INDIVIDUAL", guestId: g.id, groupId: grp.id } })),
    ).toMatch(/invitations_owner_xor/);
  });

  it("rejects an invitation with no owner", async () => {
    expect(await dbError(prisma.invitation.create({ data: { type: "FAMILY" } }))).toMatch(/invitations_owner_xor/);
  });

  it("rejects an owner that does not match the type", async () => {
    const g = await guest();
    expect(await dbError(prisma.invitation.create({ data: { type: "FAMILY", guestId: g.id } }))).toMatch(
      /invitations_owner_xor/,
    );
  });

  it("rejects capacity below 1", async () => {
    const g = await guest();
    expect(
      await dbError(prisma.invitation.create({ data: { type: "INDIVIDUAL", guestId: g.id, capacity: 0 } })),
    ).toMatch(/invitations_capacity_positive/);
  });
});

describe("one live invitation per owner", () => {
  it("blocks a second non-revoked invitation for the same guest, but allows one after revocation", async () => {
    const { guest: g, inv } = await individualInvitation();
    expect(await dbError(prisma.invitation.create({ data: { type: "INDIVIDUAL", guestId: g.id } }))).toMatch(
      /invitations_one_live_per_guest|Unique constraint/i,
    );
    await prisma.invitation.update({ where: { id: inv.id }, data: { status: "REVOKED", revokedAt: new Date() } });
    await expect(prisma.invitation.create({ data: { type: "INDIVIDUAL", guestId: g.id } })).resolves.toBeTruthy();
  });

  it("blocks a second non-revoked invitation for the same group", async () => {
    const { group: grp } = await familyInvitation(2);
    expect(await dbError(prisma.invitation.create({ data: { type: "FAMILY", groupId: grp.id } }))).toMatch(
      /invitations_one_live_per_group|Unique constraint/i,
    );
  });
});

describe("invitation tokens", () => {
  it("allows only one ACTIVE token per invitation, any number of rotated ones", async () => {
    const { inv } = await individualInvitation();
    await prisma.invitationToken.create({ data: { invitationId: inv.id, tokenHash: "h1", status: "ROTATED" } });
    await prisma.invitationToken.create({ data: { invitationId: inv.id, tokenHash: "h2", status: "ROTATED" } });
    await prisma.invitationToken.create({ data: { invitationId: inv.id, tokenHash: "h3", status: "ACTIVE" } });
    expect(
      await dbError(prisma.invitationToken.create({ data: { invitationId: inv.id, tokenHash: "h4", status: "ACTIVE" } })),
    ).toMatch(/invitation_tokens_one_active|Unique constraint/i);
  });

  it("token hashes are globally unique", async () => {
    const a = await individualInvitation();
    const b = await individualInvitation();
    await prisma.invitationToken.create({ data: { invitationId: a.inv.id, tokenHash: "same" } });
    expect(await dbError(prisma.invitationToken.create({ data: { invitationId: b.inv.id, tokenHash: "same" } }))).toMatch(
      /Unique constraint|token_hash/i,
    );
  });
});

describe("RSVP", () => {
  it("allows only one current RSVP per invitation", async () => {
    const { inv } = await individualInvitation();
    await prisma.rsvp.create({ data: { invitationId: inv.id, status: "ATTENDING", attendingCount: 1, lastActor: "GUEST" } });
    expect(
      await dbError(
        prisma.rsvp.create({ data: { invitationId: inv.id, status: "DECLINED", attendingCount: 0, lastActor: "GUEST" } }),
      ),
    ).toMatch(/Unique constraint|invitation_id/i);
  });

  it("rejects attendance above invitation capacity", async () => {
    const { inv } = await familyInvitation(3, 2);
    expect(
      await dbError(
        prisma.rsvp.create({ data: { invitationId: inv.id, status: "ATTENDING", attendingCount: 3, lastActor: "GUEST" } }),
      ),
    ).toMatch(/exceeds invitation capacity/);
  });

  it("rejects unnamed guests unless the invitation allows them", async () => {
    const { inv } = await individualInvitation(2, false);
    expect(
      await dbError(
        prisma.rsvp.create({
          data: { invitationId: inv.id, status: "ATTENDING", unnamedGuests: 1, attendingCount: 2, lastActor: "GUEST" },
        }),
      ),
    ).toMatch(/unnamed guests not allowed/);

    const allowed = await individualInvitation(2, true);
    await expect(
      prisma.rsvp.create({
        data: { invitationId: allowed.inv.id, status: "ATTENDING", unnamedGuests: 1, attendingCount: 2, lastActor: "GUEST" },
      }),
    ).resolves.toBeTruthy();
  });

  it("a declined RSVP cannot have attendees", async () => {
    const { inv } = await individualInvitation();
    expect(
      await dbError(
        prisma.rsvp.create({ data: { invitationId: inv.id, status: "DECLINED", attendingCount: 1, lastActor: "GUEST" } }),
      ),
    ).toMatch(/rsvps_declined_zero/);
  });

  it("family RSVP participants must belong to the invitation's group", async () => {
    const fam = await familyInvitation(2);
    const otherFam = await familyInvitation(1);
    const rsvp = await prisma.rsvp.create({
      data: { invitationId: fam.inv.id, status: "ATTENDING", attendingCount: 1, lastActor: "GUEST" },
    });
    await expect(
      prisma.rsvpGuest.create({ data: { rsvpId: rsvp.id, guestId: fam.members[0]!.id, attending: true } }),
    ).resolves.toBeTruthy();
    expect(
      await dbError(prisma.rsvpGuest.create({ data: { rsvpId: rsvp.id, guestId: otherFam.members[0]!.id, attending: true } })),
    ).toMatch(/participant not in invitation group/);
  });

  it("individual RSVP participant must be the invited guest", async () => {
    const a = await individualInvitation();
    const stranger = await guest("ផ្សេង");
    const rsvp = await prisma.rsvp.create({
      data: { invitationId: a.inv.id, status: "ATTENDING", attendingCount: 1, lastActor: "GUEST" },
    });
    expect(
      await dbError(prisma.rsvpGuest.create({ data: { rsvpId: rsvp.id, guestId: stranger.id, attending: true } })),
    ).toMatch(/participant not on invitation/);
  });

  it("the same guest cannot be listed twice on one RSVP", async () => {
    const a = await individualInvitation();
    const rsvp = await prisma.rsvp.create({
      data: { invitationId: a.inv.id, status: "ATTENDING", attendingCount: 1, lastActor: "GUEST" },
    });
    await prisma.rsvpGuest.create({ data: { rsvpId: rsvp.id, guestId: a.guest.id, attending: true } });
    expect(await dbError(prisma.rsvpGuest.create({ data: { rsvpId: rsvp.id, guestId: a.guest.id, attending: true } }))).toMatch(
      /Unique constraint/i,
    );
  });

  it("RSVP history is append-only", async () => {
    const a = await individualInvitation();
    const rsvp = await prisma.rsvp.create({
      data: { invitationId: a.inv.id, status: "ATTENDING", attendingCount: 1, lastActor: "GUEST" },
    });
    const h = await prisma.rsvpHistory.create({ data: { rsvpId: rsvp.id, version: 1, actor: "GUEST", snapshot: {} } });
    expect(await dbError(prisma.rsvpHistory.update({ where: { id: h.id }, data: { reason: "x" } }))).toMatch(/append-only/);
    expect(await dbError(prisma.rsvpHistory.delete({ where: { id: h.id } }))).toMatch(/append-only/);
  });
});

describe("gifts", () => {
  const base = { source: "ADMIN_RECORD" as const, method: "CASH" as const, donorName: "Sok" };

  it("amounts must be positive", async () => {
    expect(await dbError(prisma.gift.create({ data: { ...base, currency: "USD", receivedAmount: "0" } }))).toMatch(
      /gifts_amounts_positive/,
    );
  });

  it("KHR amounts must be whole riel", async () => {
    expect(await dbError(prisma.gift.create({ data: { ...base, currency: "KHR", receivedAmount: "1000.50" } }))).toMatch(
      /gifts_khr_whole/,
    );
  });

  it("a VERIFIED gift must have a received amount and verification time", async () => {
    expect(
      await dbError(prisma.gift.create({ data: { ...base, currency: "USD", notifiedAmount: "20", status: "VERIFIED" } })),
    ).toMatch(/gifts_verified_has_amount/);
  });

  it("a guest notification must state an amount and starts pending", async () => {
    expect(
      await dbError(
        prisma.gift.create({ data: { source: "GUEST_NOTIFICATION", method: "KHQR", donorName: "Dara", currency: "USD" } }),
      ),
    ).toMatch(/gifts_notification_has_amount/);
    const g = await prisma.gift.create({
      data: { source: "GUEST_NOTIFICATION", method: "KHQR", donorName: "Dara", currency: "USD", notifiedAmount: "50" },
    });
    expect(g.status).toBe("PENDING_VERIFICATION");
    expect(g.receivedAmount).toBeNull();
  });

  it("stores Decimal amounts exactly", async () => {
    const g = await prisma.gift.create({
      data: { ...base, currency: "USD", receivedAmount: "1234567890123456.78", status: "VERIFIED", verifiedAt: new Date() },
    });
    expect(g.receivedAmount?.toFixed(2)).toBe("1234567890123456.78");
  });

  it("gifts cannot be deleted; gift events are append-only", async () => {
    const g = await prisma.gift.create({ data: { ...base, currency: "USD", receivedAmount: "10", status: "VERIFIED", verifiedAt: new Date() } });
    expect(await dbError(prisma.gift.delete({ where: { id: g.id } }))).toMatch(/append-only/);
    const ev = await prisma.giftEvent.create({ data: { giftId: g.id, type: "CREATED", actor: "SYSTEM" } });
    expect(await dbError(prisma.giftEvent.update({ where: { id: ev.id }, data: { reason: "edit" } }))).toMatch(/append-only/);
    expect(await dbError(prisma.giftEvent.delete({ where: { id: ev.id } }))).toMatch(/append-only/);
  });
});

describe("audit log, check-ins, content", () => {
  it("audit log is append-only", async () => {
    const log = await prisma.auditLog.create({ data: { actorLabel: "Shared couple account", action: "test", entityType: "x" } });
    expect(await dbError(prisma.auditLog.update({ where: { id: log.id }, data: { action: "tampered" } }))).toMatch(/append-only/);
    expect(await dbError(prisma.auditLog.delete({ where: { id: log.id } }))).toMatch(/append-only/);
  });

  it("check-in overrides require a reason and arrivals are at least 1", async () => {
    const admin = await prisma.adminUser.create({ data: { username: "couple", displayName: "Couple", passwordHash: "x" } });
    const { inv } = await individualInvitation();
    const data = { invitationId: inv.id, displayNameSnapshot: "Sok", checkedInById: admin.id };
    expect(await dbError(prisma.guestCheckIn.create({ data: { ...data, arrivedCount: 0 } }))).toMatch(/check_ins_count/);
    expect(
      await dbError(prisma.guestCheckIn.create({ data: { ...data, arrivedCount: 1, isOverride: true, overrideReason: " " } })),
    ).toMatch(/check_ins_override_reason/);
  });

  it("wedding settings is a singleton", async () => {
    const empty = { groomName: {}, brideName: {} };
    await prisma.weddingSettings.create({ data: { id: 1, ...empty } });
    expect(await dbError(prisma.weddingSettings.create({ data: { id: 2, ...empty } }))).toMatch(/wedding_settings_singleton/);
  });

  it("events cannot end before they start", async () => {
    expect(
      await dbError(
        prisma.weddingEvent.create({
          data: { title: { en: "x", kh: "" }, startsAt: new Date("2027-01-15T10:00:00Z"), endsAt: new Date("2027-01-15T09:00:00Z") },
        }),
      ),
    ).toMatch(/wedding_events_time_order/);
  });

  it("wish text lengths are bounded", async () => {
    expect(await dbError(prisma.wish.create({ data: { authorName: "A", message: "x".repeat(1001), contentHash: "h" } }))).toMatch(
      /wishes_lengths/,
    );
  });
});

describe("referential safety", () => {
  it("cannot delete a guest who owns an invitation", async () => {
    const { guest: g } = await individualInvitation();
    expect(await dbError(prisma.guest.delete({ where: { id: g.id } }))).toMatch(/Foreign key|constraint|invitations_guest_id/i);
  });
});
