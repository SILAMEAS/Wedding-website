import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppLocale } from "@/i18n/locales";
import { formatMoney } from "@/lib/money";
import { requireAdmin } from "@/server/policies/admin";
import { checkInStats } from "@/server/services/checkin.service";
import { getOverview } from "@/server/services/dashboard.service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.dashboard"))("title") };
}

function Stat({ label, value, hint, href }: { label: string; value: number | string; hint?: string; href?: string }) {
  const body = (
    <Card className="h-full transition-shadow hover:shadow-md">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-serif text-4xl text-purple-deep tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="rounded-xl focus-visible:outline-2">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function DashboardPage() {
  const ctx = await requireAdmin();
  const [t, o, locale, arrivals] = await Promise.all([getTranslations("Admin.dashboard"), getOverview(ctx), getLocale() as Promise<AppLocale>, checkInStats(ctx)]);
  const money = (v: string, c: "USD" | "KHR") => formatMoney(v, c, locale);
  return (
    <>
      <PageHeader title={t("title")} />
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("invitations")} value={o.invitations.total} hint={`${t("individual")} ${o.invitations.individual} · ${t("family")} ${o.invitations.family}`} href="/admin/invitations" />
        <Stat label={t("invitedGuests")} value={o.invitedGuests} hint={t("invitedGuestsHint")} />
        <Stat label={t("seats")} value={o.invitedSeats} hint={t("seatsHint")} />
        <Stat label={t("opened")} value={`${o.invitations.opened} / ${o.invitations.total}`} hint={t("openedHint")} href="/admin/invitations?opened=1" />
        <Stat label={t("totalGuests")} value={o.totalGuests} href="/admin/guests" />
        <Stat label={t("uninvited")} value={o.uninvitedGuests} href="/admin/guests" />
        <Stat label={t("groups")} value={o.groups} href="/admin/groups" />
        <Stat label={t("inactive")} value={o.invitations.inactive} href="/admin/invitations?status=INACTIVE" />
      </section>
      <h2 className="mt-10 mb-4 font-serif text-2xl text-purple-deep">{t("repliesTitle")}</h2>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("attending")} value={o.rsvp.attendingPeople} hint={t("attendingHint")} href="/admin/invitations?rsvp=ATTENDING" />
        <Stat label={t("declined")} value={o.rsvp.declinedGuests} hint={t("declinedHint")} href="/admin/invitations?rsvp=DECLINED" />
        <Stat label={t("awaiting")} value={o.rsvp.awaiting} hint={t("awaitingHint")} href="/admin/invitations?rsvp=none" />
        {o.rsvp.maybePeople > 0 && <Stat label={t("maybe")} value={o.rsvp.maybePeople} href="/admin/invitations?rsvp=MAYBE" />}
        {arrivals.guestsArrived > 0 && (
          <Stat label={t("arrived")} value={arrivals.guestsArrived} hint={t("arrivedHint", { parties: arrivals.partiesArrived })} href="/admin/check-in" />
        )}
      </section>

      <h2 className="mt-10 mb-4 font-serif text-2xl text-purple-deep">{t("giftsTitle")}</h2>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("verifiedUsd")} value={money(o.gifts.verified.USD, "USD")} hint={t("verifiedHint")} href="/admin/gifts?status=VERIFIED&currency=USD" />
        <Stat label={t("verifiedKhr")} value={money(o.gifts.verified.KHR, "KHR")} hint={t("verifiedHint")} href="/admin/gifts?status=VERIFIED&currency=KHR" />
        <Stat label={t("giftsToCheck")} value={o.gifts.pendingCount} hint={t("giftsToCheckHint")} href="/admin/gifts?status=PENDING_VERIFICATION" />
        <Stat label={t("wishesToApprove")} value={o.wishes.pending} hint={t("wishesApproved", { count: o.wishes.approved })} href="/admin/wishes" />
      </section>
    </>
  );
}
