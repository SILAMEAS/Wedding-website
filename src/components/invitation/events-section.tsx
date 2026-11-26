import { CalendarPlus, Clock, MapPin, Shirt } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/locales";
import { googleCalendarUrl } from "@/lib/calendar";
import { formatDate, formatTime } from "@/lib/dates";
import type { PublicEvent } from "@/server/services/public-content.service";
import { Reveal } from "./reveal";
import { Section } from "./section";

export async function EventsSection({ locale, events }: { locale: AppLocale; events: PublicEvent[] }) {
  const t = await getTranslations({ locale, namespace: "Events" });
  return (
    <Section id="events" eyebrow={t("eyebrow")} title={t("title")}>
      <ol className="mx-auto grid max-w-3xl gap-6">
        {events.map((e, i) => (
          <li key={e.id}>
            <Reveal delay={i * 0.05}>
              <article className="rounded-3xl border border-border bg-background p-6 shadow-sm sm:p-8">
                <p className="text-sm text-gold-ink">{formatDate(e.startsAt, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
                <h3 className="mt-1 font-serif text-2xl text-purple-deep sm:text-3xl">{e.title}</h3>
                <dl className="mt-4 space-y-2 text-sm text-foreground/80">
                  <div className="flex gap-2">
                    <dt><Clock className="size-4 text-primary" aria-label={t("time")} /></dt>
                    <dd>
                      {formatTime(e.startsAt, locale)}
                      {e.endsAt && ` – ${formatTime(e.endsAt, locale)}`}
                    </dd>
                  </div>
                  {e.location && (
                    <div className="flex gap-2">
                      <dt><MapPin className="size-4 text-primary" aria-label={t("venue")} /></dt>
                      <dd>
                        <span className="font-medium">{e.location.name}</span>
                        <span className="block text-muted-foreground">{e.location.address}</span>
                      </dd>
                    </div>
                  )}
                  {e.dressCode && (
                    <div className="flex gap-2">
                      <dt><Shirt className="size-4 text-primary" aria-label={t("dressCode")} /></dt>
                      <dd>{t("dressCode")}: {e.dressCode}</dd>
                    </div>
                  )}
                </dl>
                {e.description && <p className="mt-4 whitespace-pre-line text-foreground/80">{e.description}</p>}
                {e.instructions && <p className="mt-3 rounded-xl bg-lavender/60 p-3 text-sm whitespace-pre-line text-purple-deep">{e.instructions}</p>}
                <div className="mt-5 flex flex-wrap gap-2 text-sm">
                  <a
                    href={googleCalendarUrl({ id: e.id, title: e.title, description: e.description, startsAt: e.startsAt, endsAt: e.endsAt, location: e.location ? `${e.location.name}, ${e.location.address}` : "" })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 hover:bg-lavender"
                  >
                    <CalendarPlus className="size-4" aria-hidden /> {t("addToGoogle")}
                  </a>
                  <a href={`/api/public/calendar?locale=${locale}&event=${e.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 hover:bg-lavender">
                    <CalendarPlus className="size-4" aria-hidden /> {t("downloadIcs")}
                  </a>
                  {e.location?.directions && (
                    <a href={e.location.directions} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-primary-foreground hover:bg-purple-deep">
                      <MapPin className="size-4" aria-hidden /> {t("directions")}
                    </a>
                  )}
                </div>
              </article>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  );
}
