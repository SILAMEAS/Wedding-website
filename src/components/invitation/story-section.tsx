import { getTranslations } from "next-intl/server";
import { SiteImage } from "@/components/wedding/site-image";
import type { AppLocale } from "@/i18n/locales";
import { formatDate } from "@/lib/dates";
import type { InvitationContent } from "@/server/services/public-content.service";
import { Reveal } from "./reveal";
import { Section } from "./section";

function Paragraphs({ text }: { text: string }) {
  // Plain text only (never HTML): split on blank lines into paragraphs.
  return (
    <>
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </>
  );
}

export async function StorySection({ locale, content }: { locale: AppLocale; content: InvitationContent }) {
  const t = await getTranslations({ locale, namespace: "Story" });
  const { story, milestones } = content;
  const people = [
    { key: "groom", label: t("groom"), name: content.groomName, intro: story.groomIntro, portrait: story.groomPortrait },
    { key: "bride", label: t("bride"), name: content.brideName, intro: story.brideIntro, portrait: story.bridePortrait },
  ].filter((p) => p.intro || p.portrait);
  const chapters = [
    { key: "howWeMet", title: t("howWeMet"), text: story.howWeMet },
    { key: "journey", title: t("journey"), text: story.journey },
    { key: "engagement", title: t("engagement"), text: story.engagement },
  ].filter((c) => c.text);

  return (
    <Section id="story" eyebrow={t("eyebrow")} title={t("title")} tone="ivory">
      {people.length > 0 && (
        <div className="grid gap-12 sm:grid-cols-2">
          {people.map((p, i) => (
            <Reveal key={p.key} delay={i * 0.1} className="text-center">
              {p.portrait && (
                <div className="mx-auto mb-6 aspect-[3/4] w-56 overflow-hidden rounded-t-full border-4 border-background shadow-lg ring-1 ring-gold/40">
                  <SiteImage image={p.portrait} alt={p.name} sizes="224px" className="h-full w-full object-cover" />
                </div>
              )}
              <p className="eyebrow">{p.label}</p>
              <h3 className="mt-2 font-display text-2xl text-purple-deep">{p.name}</h3>
              {p.intro && (
                <div className="mx-auto mt-4 max-w-sm space-y-3 text-foreground/80">
                  <Paragraphs text={p.intro} />
                </div>
              )}
            </Reveal>
          ))}
        </div>
      )}

      {chapters.length > 0 && (
        <div className="mx-auto mt-16 max-w-2xl space-y-12">
          {chapters.map((c) => (
            <Reveal key={c.key}>
              <h3 className="mb-3 text-center font-serif text-2xl text-primary">{c.title}</h3>
              <div className="space-y-3 text-center leading-relaxed text-foreground/80">
                <Paragraphs text={c.text} />
              </div>
            </Reveal>
          ))}
        </div>
      )}

      {milestones.length > 0 && (
        <ol className="relative mx-auto mt-20 max-w-2xl border-l border-gold/50 pl-8" aria-label={t("milestones")}>
          {milestones.map((m) => (
            <li key={m.id} className="relative mb-12 last:mb-0">
              <span aria-hidden className="absolute top-1.5 -left-[2.4rem] size-3 rotate-45 bg-gold" />
              <Reveal>
                {m.occurredOn && (
                  <time dateTime={m.occurredOn.toISOString().slice(0, 10)} className="text-sm text-gold-ink">
                    {formatDate(m.occurredOn, locale, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}
                  </time>
                )}
                <h3 className="mt-1 font-serif text-xl text-purple-deep">{m.title}</h3>
                {m.body && <p className="mt-2 whitespace-pre-line text-foreground/80">{m.body}</p>}
                {m.image && <SiteImage image={m.image} alt={m.title} sizes="(min-width: 672px) 640px, 90vw" className="mt-4 rounded-xl shadow-sm" />}
              </Reveal>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
