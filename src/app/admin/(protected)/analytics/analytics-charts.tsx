"use client";

import { useLocale, useTranslations } from "next-intl";
import { CategoryBars, TimeSeries } from "@/components/admin/charts";
import { type AppLocale, intlLocale } from "@/i18n/locales";

type Point = { day: string; value: number };
type Keyed = { key: string; value: number };

export function AnalyticsCharts({
  data,
}: {
  data: { rsvpDistribution: Keyed[]; opensByDay: Point[]; repliesByDay: Point[]; categories: Keyed[]; giftsUsd: Point[]; giftsKhr: Point[]; giftMethods: Keyed[] };
}) {
  const t = useTranslations("Admin.analytics");
  const tcat = useTranslations("Admin.categories");
  const tg = useTranslations("Admin.gifts");
  const locale = useLocale() as AppLocale;
  const nf = new Intl.NumberFormat(intlLocale(locale));
  const usd = new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const khr = new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "KHR", maximumFractionDigits: 0, notation: "compact" });
  const day = (d: string) => new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CategoryBars
        title={t("rsvpTitle")}
        subtitle={t("rsvpSubtitle")}
        valueHeader={t("invitations")}
        data={data.rsvpDistribution.map((d) => ({ label: t(`rsvp.${d.key as "ATTENDING" | "DECLINED" | "MAYBE" | "AWAITING"}`), value: d.value }))}
        format={(v) => nf.format(v)}
      />
      <TimeSeries title={t("repliesTitle")} subtitle={t("repliesSubtitle")} valueHeader={t("replies")} data={data.repliesByDay} formatDay={day} format={(v) => nf.format(v)} />
      <TimeSeries title={t("opensTitle")} subtitle={t("opensSubtitle")} valueHeader={t("invitations")} data={data.opensByDay} formatDay={day} format={(v) => nf.format(v)} />
      <CategoryBars
        title={t("categoriesTitle")}
        valueHeader={t("guests")}
        data={data.categories.map((c) => ({ label: tcat(c.key as "OTHER"), value: c.value }))}
        format={(v) => nf.format(v)}
      />
      {/* Two currencies → two charts. Never one axis for USD and KHR. */}
      <TimeSeries title={t("giftsUsdTitle")} subtitle={t("giftsSubtitle")} valueHeader="USD" data={data.giftsUsd} formatDay={day} format={(v) => usd.format(v)} />
      <TimeSeries title={t("giftsKhrTitle")} subtitle={t("giftsSubtitle")} valueHeader="KHR" data={data.giftsKhr} formatDay={day} format={(v) => khr.format(v)} />
      <CategoryBars
        title={t("methodsTitle")}
        subtitle={t("methodsSubtitle")}
        valueHeader={t("gifts")}
        data={data.giftMethods.map((m) => ({ label: tg(`method.${m.key as "KHQR"}`), value: m.value }))}
        format={(v) => nf.format(v)}
      />
    </div>
  );
}
