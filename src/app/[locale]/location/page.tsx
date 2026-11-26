import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocationCards } from "@/components/invitation/locations-section";
import { PublicHeader } from "@/components/invitation/public-header";
import { Ornament } from "@/components/wedding/ornament";
import { getPublicLocations } from "@/server/services/public-content.service";

export async function generateMetadata({ params }: PageProps<"/[locale]/location">): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: (await getTranslations({ locale, namespace: "Locations" }))("title") };
}

export default async function LocationPage({ params }: PageProps<"/[locale]/location">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const [t, tn, locations] = await Promise.all([
    getTranslations({ locale, namespace: "Locations" }),
    getTranslations({ locale, namespace: "Invitation.nav" }),
    getPublicLocations(locale),
  ]);
  return (
    <>
      <PublicHeader items={[{ href: "/gallery", label: tn("gallery") }, { href: "/location", label: tn("locations") }]} />
      <main id="main" className="min-h-dvh bg-ivory px-5 py-16">
        <div className="mx-auto max-w-5xl">
          <header className="mb-12 text-center">
            <p className="eyebrow mb-3">{t("eyebrow")}</p>
            <h1 className="font-serif text-4xl text-purple-deep sm:text-5xl">{t("title")}</h1>
            <Ornament className="mt-6" />
          </header>
          {locations.length > 0 ? <LocationCards locale={locale} locations={locations} /> : <p className="text-center text-muted-foreground">{t("empty")}</p>}
        </div>
      </main>
    </>
  );
}
