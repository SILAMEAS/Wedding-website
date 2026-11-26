import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/i18n/locales";
import { formatDate } from "@/lib/dates";
import { pickLocalized } from "@/lib/validation/localized";
import { requireAdmin } from "@/server/policies/admin";
import { listEvents } from "@/server/services/content.service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.events"))("title") };
}

export default async function EventsAdminPage() {
  const ctx = await requireAdmin();
  const [t, tc, locale, events] = await Promise.all([getTranslations("Admin.events"), getTranslations("Admin.content"), getLocale() as Promise<AppLocale>, listEvents(ctx)]);
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={
          <Button asChild>
            <Link href="/admin/events/new">{t("new")}</Link>
          </Button>
        }
      />
      <ul className="space-y-3">
        {events.length === 0 && <li className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-muted-foreground">{t("empty")}</li>}
        {events.map((e) => (
          <li key={e.id}>
            <Link href={`/admin/events/${e.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-4 hover:shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="font-serif text-lg text-purple-deep">{pickLocalized(e.title, locale).text}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(e.startsAt, locale, { dateStyle: "full", timeStyle: "short" })}
                  {e.location && ` · ${pickLocalized(e.location.name, locale).text}`}
                </p>
              </div>
              <StatusBadge tone={e.status === "PUBLISHED" ? "success" : "neutral"}>{tc(`publish.${e.status}`)}</StatusBadge>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
