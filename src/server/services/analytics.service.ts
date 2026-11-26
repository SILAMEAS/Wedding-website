import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import type { AdminContext } from "@/server/context";

/*
 * Chart data. Days are Phnom Penh calendar days (computed in SQL).
 * Money sums are exact numerics per currency — USD and KHR never combined.
 * Bots/link previews are excluded from open counts.
 */

export type DayPoint = { day: string; value: number };

function cumulative(points: DayPoint[]): DayPoint[] {
  let total = 0;
  return points.map((p) => ({ day: p.day, value: (total = new Prisma.Decimal(total).plus(p.value).toNumber()) }));
}

export async function getAnalytics(_ctx: AdminContext) {
  const live = { status: { not: "REVOKED" as const } };

  const [opens, replies, rsvpGroups, liveInvitations, categories, giftsByDay, giftsByMethod] = await Promise.all([
    prisma.$queryRaw<{ day: string; n: bigint }[]>`
      SELECT to_char((occurred_at AT TIME ZONE 'Asia/Phnom_Penh')::date, 'YYYY-MM-DD') AS day,
             COUNT(DISTINCT invitation_id) AS n
      FROM invitation_access_logs
      WHERE kind = 'OPENED' AND NOT is_likely_bot
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ day: string; n: bigint }[]>`
      SELECT to_char((submitted_at AT TIME ZONE 'Asia/Phnom_Penh')::date, 'YYYY-MM-DD') AS day, COUNT(*) AS n
      FROM rsvps GROUP BY 1 ORDER BY 1`,
    prisma.rsvp.groupBy({ by: ["status"], where: { invitation: live }, _count: { _all: true }, _sum: { attendingCount: true } }),
    prisma.invitation.count({ where: live }),
    prisma.guest.groupBy({ by: ["category"], where: { archivedAt: null }, _count: { _all: true } }),
    prisma.$queryRaw<{ day: string; currency: "USD" | "KHR"; total: string }[]>`
      SELECT to_char((COALESCE(received_at, verified_at) AT TIME ZONE 'Asia/Phnom_Penh')::date, 'YYYY-MM-DD') AS day,
             currency, SUM(received_amount)::text AS total
      FROM gifts WHERE status = 'VERIFIED'
      GROUP BY 1, 2 ORDER BY 1`,
    prisma.gift.groupBy({ by: ["method", "currency"], where: { status: "VERIFIED" }, _count: { _all: true } }),
  ]);

  const replied = rsvpGroups.reduce((n, g) => n + g._count._all, 0);
  const rsvpCount = (s: "ATTENDING" | "DECLINED" | "MAYBE") => rsvpGroups.find((g) => g.status === s)?._count._all ?? 0;

  const giftSeries = (currency: "USD" | "KHR") =>
    cumulative(giftsByDay.filter((g) => g.currency === currency).map((g) => ({ day: g.day, value: Number(g.total) })));

  const methodCounts = (["KHQR", "BANK_TRANSFER", "CASH", "OTHER"] as const).map((m) => ({
    key: m,
    value: giftsByMethod.filter((g) => g.method === m).reduce((n, g) => n + g._count._all, 0),
  }));

  return {
    rsvpDistribution: [
      { key: "ATTENDING", value: rsvpCount("ATTENDING") },
      { key: "DECLINED", value: rsvpCount("DECLINED") },
      { key: "MAYBE", value: rsvpCount("MAYBE") },
      { key: "AWAITING", value: Math.max(0, liveInvitations - replied) },
    ],
    opensByDay: opens.map((o) => ({ day: o.day, value: Number(o.n) })),
    repliesByDay: cumulative(replies.map((r) => ({ day: r.day, value: Number(r.n) }))),
    categories: categories.map((c) => ({ key: c.category, value: c._count._all })).sort((a, b) => b.value - a.value),
    giftsUsd: giftSeries("USD"),
    giftsKhr: giftSeries("KHR"),
    giftMethods: methodCounts.filter((m) => m.value > 0),
  };
}
