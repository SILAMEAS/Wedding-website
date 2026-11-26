import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/i18n/locales";
import { pickLocalized } from "@/lib/validation/localized";
import { requireAdmin } from "@/server/policies/admin";
import { listLocations } from "@/server/services/content.service";
import { MoveButtons } from "./move-buttons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.locations"))("title") };
}

export default async function LocationsAdminPage() {
  const ctx = await requireAdmin();
  const [t, tc, locale, locations] = await Promise.all([getTranslations("Admin.locations"), getTranslations("Admin.content"), getLocale() as Promise<AppLocale>, listLocations(ctx)]);
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={
          <Button asChild>
            <Link href="/admin/locations/new">{t("new")}</Link>
          </Button>
        }
      />
      <ul className="space-y-3">
        {locations.length === 0 && <li className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-muted-foreground">{t("empty")}</li>}
        {locations.map((l, i) => (
          <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-4">
            <Link href={`/admin/locations/${l.id}`} className="min-w-0 flex-1 hover:underline">
              <p className="font-serif text-lg text-purple-deep">{pickLocalized(l.name, locale).text}</p>
              <p className="truncate text-sm text-muted-foreground">{pickLocalized(l.address, locale).text}</p>
            </Link>
            <span className="text-xs text-muted-foreground">{t("eventCount", { count: l._count.events })}</span>
            <StatusBadge tone={l.status === "PUBLISHED" ? "success" : "neutral"}>{tc(`publish.${l.status}`)}</StatusBadge>
            <MoveButtons model="weddingLocation" id={l.id} first={i === 0} last={i === locations.length - 1} />
          </li>
        ))}
      </ul>
    </>
  );
}
