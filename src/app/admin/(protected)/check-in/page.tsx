import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import type { AppLocale } from "@/i18n/locales";
import { formatTime } from "@/lib/dates";
import { requireAdmin } from "@/server/policies/admin";
import { checkInStats } from "@/server/services/checkin.service";
import { CheckInConsole } from "./check-in-console";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.checkin"))("title") };
}

export default async function CheckInPage() {
  const ctx = await requireAdmin();
  const [t, locale, stats] = await Promise.all([getTranslations("Admin.checkin"), getLocale() as Promise<AppLocale>, checkInStats(ctx)]);
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={
          <p className="rounded-full bg-lavender px-4 py-2 text-sm text-purple-deep">
            {t("arrivedSummary", { guests: stats.guestsArrived, parties: stats.partiesArrived })}
          </p>
        }
      />
      <CheckInConsole
        recent={stats.recent.map((r) => ({ id: r.id, name: r.displayNameSnapshot, arrivedCount: r.arrivedCount, time: formatTime(r.checkedInAt, locale), isOverride: r.isOverride }))}
      />
    </>
  );
}
