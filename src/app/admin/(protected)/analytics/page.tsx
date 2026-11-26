import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/server/policies/admin";
import { getAnalytics } from "@/server/services/analytics.service";
import { AnalyticsCharts } from "./analytics-charts";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.analytics"))("title") };
}

export default async function AnalyticsPage() {
  const ctx = await requireAdmin();
  const [t, data] = await Promise.all([getTranslations("Admin.analytics"), getAnalytics(ctx)]);
  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <AnalyticsCharts data={data} />
    </>
  );
}
