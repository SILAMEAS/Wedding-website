import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { PageHeader } from "@/components/admin/page-header";
import type { AppLocale } from "@/i18n/locales";
import { toPhnomPenhLocalInput } from "@/lib/dates";
import { parseLocalized, pickLocalized } from "@/lib/validation/localized";
import { requireAdmin } from "@/server/policies/admin";
import { listEvents, listLocations } from "@/server/services/content.service";
import { EventForm } from "../event-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.events"))("edit") };
}

export default async function EditEventPage({ params }: PageProps<"/admin/events/[id]">) {
  const ctx = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [t, locale, events, locations] = await Promise.all([getTranslations("Admin.events"), getLocale() as Promise<AppLocale>, listEvents(ctx), listLocations(ctx)]);
  const e = events.find((x) => x.id === id);
  if (!e) notFound();
  return (
    <>
      <PageHeader title={t("edit")} />
      <EventForm
        locations={locations.filter((l) => l.status !== "ARCHIVED" || l.id === e.locationId).map((l) => ({ id: l.id, label: pickLocalized(l.name, locale).text }))}
        initial={{
          id: e.id,
          title: parseLocalized(e.title),
          description: parseLocalized(e.description),
          startsAt: toPhnomPenhLocalInput(e.startsAt),
          endsAt: e.endsAt ? toPhnomPenhLocalInput(e.endsAt) : "",
          locationId: e.locationId ?? "",
          dressCode: parseLocalized(e.dressCode),
          instructions: parseLocalized(e.instructions),
          status: e.status,
        }}
      />
    </>
  );
}
