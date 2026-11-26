import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { emptyLocServer } from "@/app/admin/(protected)/locations/loc-utils";
import { PageHeader } from "@/components/admin/page-header";
import type { AppLocale } from "@/i18n/locales";
import { pickLocalized } from "@/lib/validation/localized";
import { requireAdmin } from "@/server/policies/admin";
import { listLocations } from "@/server/services/content.service";
import { EventForm } from "../event-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.events"))("new") };
}

export default async function NewEventPage() {
  const ctx = await requireAdmin();
  const [t, locale, locations] = await Promise.all([getTranslations("Admin.events"), getLocale() as Promise<AppLocale>, listLocations(ctx)]);
  return (
    <>
      <PageHeader title={t("new")} />
      <EventForm
        locations={locations.filter((l) => l.status !== "ARCHIVED").map((l) => ({ id: l.id, label: pickLocalized(l.name, locale).text }))}
        initial={{
          title: emptyLocServer(),
          description: emptyLocServer(),
          startsAt: "",
          endsAt: "",
          locationId: "",
          dressCode: emptyLocServer(),
          instructions: emptyLocServer(),
          status: "PUBLISHED",
        }}
      />
    </>
  );
}
