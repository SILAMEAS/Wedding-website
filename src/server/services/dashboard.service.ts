import "server-only";
import { prisma } from "@/lib/prisma/client";
import type { AdminContext } from "@/server/context";
import { getGiftSummary } from "./gift-admin.service";

/**
 * Dashboard overview (Phase 6 adds charts and check-in).
 * Definitions (Phase 1 §11):
 *  - invitations: status <> REVOKED
 *  - invited guests: distinct non-archived named guests covered by those invitations
 *  - opened: invitations with a non-bot OPENED access
 *  - attending: sum of attending_count over ATTENDING replies (includes unnamed seats)
 *  - declined guests: named guests marked not attending on any reply (each counted once)
 *  - gift totals: VERIFIED received amounts, per currency (never summed across currencies)
 */
export async function getOverview(_ctx: AdminContext) {
  const live = { status: { not: "REVOKED" as const } };
  const [individual, family, inactive, opened, individualGuests, familyGuests, seats, totalGuests, groups] = await Promise.all([
    prisma.invitation.count({ where: { ...live, type: "INDIVIDUAL" } }),
    prisma.invitation.count({ where: { ...live, type: "FAMILY" } }),
    prisma.invitation.count({ where: { status: "INACTIVE" } }),
    prisma.invitation.count({ where: { ...live, firstOpenedAt: { not: null } } }),
    prisma.guest.count({ where: { archivedAt: null, invitations: { some: live } } }),
    prisma.guest.count({ where: { archivedAt: null, group: { invitations: { some: live } } } }),
    prisma.invitation.aggregate({ where: live, _sum: { capacity: true } }),
    prisma.guest.count({ where: { archivedAt: null } }),
    prisma.guestGroup.count({ where: { archivedAt: null } }),
  ]);
  const uninvitedGuests = await prisma.guest.count({
    where: {
      archivedAt: null,
      invitations: { none: live },
      OR: [{ groupId: null }, { group: { invitations: { none: live } } }],
    },
  });
  // Replies (Phase 1 §11): people = attending_count; invitations without a reply = pending.
  const [rsvpGroups, wishGroups, gifts] = await Promise.all([
    prisma.rsvp.groupBy({ by: ["status"], where: { invitation: live }, _sum: { attendingCount: true }, _count: { _all: true } }),
    prisma.wish.groupBy({ by: ["status"], _count: { _all: true } }),
    getGiftSummary(_ctx),
  ]);
  const rsvpOf = (s: "ATTENDING" | "DECLINED" | "MAYBE") => rsvpGroups.find((g) => g.status === s);
  const replied = rsvpGroups.reduce((n, g) => n + g._count._all, 0);
  const declinedGuests = await prisma.rsvpGuest.count({ where: { attending: false, rsvp: { invitation: live } } });
  return {
    rsvp: {
      attendingPeople: rsvpOf("ATTENDING")?._sum.attendingCount ?? 0,
      maybePeople: rsvpOf("MAYBE")?._sum.attendingCount ?? 0,
      declinedGuests,
      replied,
      awaiting: individual + family - replied,
    },
    wishes: {
      pending: wishGroups.find((g) => g.status === "PENDING")?._count._all ?? 0,
      approved: wishGroups.find((g) => g.status === "APPROVED")?._count._all ?? 0,
    },
    gifts,
    invitations: { individual, family, total: individual + family, inactive, opened },
    invitedGuests: individualGuests + familyGuests,
    invitedSeats: seats._sum.capacity ?? 0,
    totalGuests,
    groups,
    uninvitedGuests,
  };
}
