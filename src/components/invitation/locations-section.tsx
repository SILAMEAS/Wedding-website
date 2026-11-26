import { Car, Accessibility, MapPin, Navigation } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SiteImage } from "@/components/wedding/site-image";
import type { AppLocale } from "@/i18n/locales";
import { formatDate } from "@/lib/dates";
import type { PublicLocation } from "@/server/services/public-content.service";
import { Reveal } from "./reveal";
import { Section } from "./section";

export async function LocationCards({ locale, locations }: { locale: AppLocale; locations: PublicLocation[] }) {
  const t = await getTranslations({ locale, namespace: "Locations" });
  return (
    <div className="grid gap-8">
      {locations.map((l) => (
        <Reveal key={l.id}>
          <article className="overflow-hidden rounded-3xl border border-border bg-background shadow-sm lg:grid lg:grid-cols-2">
            <div className="p-6 sm:p-8">
              {l.image && <SiteImage image={l.image} alt={l.name} sizes="(min-width: 1024px) 480px, 90vw" className="mb-6 aspect-video w-full rounded-2xl object-cover" />}
              <h3 className="font-serif text-2xl text-purple-deep sm:text-3xl">{l.name}</h3>
              <p className="mt-2 flex gap-2 text-foreground/80">
                <MapPin className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
                <span className="whitespace-pre-line">{l.address}</span>
              </p>
              {l.events.length > 0 && (
                <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
                  {l.events.map((e) => (
                    <li key={e.id}>
                      <span className="text-gold-ink">◆</span> {e.title} · {formatDate(e.startsAt, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    </li>
                  ))}
                </ul>
              )}
              {l.parking && (
                <p className="mt-4 flex gap-2 text-sm text-foreground/80">
                  <Car className="mt-0.5 size-4 shrink-0 text-primary" aria-label={t("parking")} />
                  <span className="whitespace-pre-line">{l.parking}</span>
                </p>
              )}
              {l.access && (
                <p className="mt-2 flex gap-2 text-sm text-foreground/80">
                  <Accessibility className="mt-0.5 size-4 shrink-0 text-primary" aria-label={t("access")} />
                  <span className="whitespace-pre-line">{l.access}</span>
                </p>
              )}
              {l.latitude && l.longitude && (
                <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                  {t("coordinates")}: {l.latitude}, {l.longitude}
                </p>
              )}
              {l.directions && (
                <a href={l.directions} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-primary-foreground shadow-sm hover:bg-purple-deep">
                  <Navigation className="size-4" aria-hidden /> {t("directions")}
                </a>
              )}
            </div>
            {l.mapEmbedUrl && (
              <iframe
                src={l.mapEmbedUrl}
                title={t("mapOf", { name: l.name })}
                loading="lazy"
                // Never send the page URL (it contains the private invitation token) to Google.
                referrerPolicy="no-referrer"
                className="h-72 w-full border-0 lg:h-full lg:min-h-96"
                allowFullScreen
              />
            )}
          </article>
        </Reveal>
      ))}
    </div>
  );
}

export async function LocationsSection({ locale, locations }: { locale: AppLocale; locations: PublicLocation[] }) {
  const t = await getTranslations({ locale, namespace: "Locations" });
  return (
    <Section id="locations" eyebrow={t("eyebrow")} title={t("title")} tone="ivory">
      <LocationCards locale={locale} locations={locations} />
    </Section>
  );
}
