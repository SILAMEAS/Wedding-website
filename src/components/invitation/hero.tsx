import { ChevronDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SiteImage } from "@/components/wedding/site-image";
import { Ornament } from "@/components/wedding/ornament";
import { type AppLocale, intlLocale } from "@/i18n/locales";
import { formatDate, formatTime } from "@/lib/dates";
import type { ImageRef } from "@/lib/storage";
import { Countdown } from "./countdown";

type Names = { kh: string; en: string };

export async function Hero({
  locale,
  groom,
  bride,
  weddingDate,
  isPast,
  message,
  postWeddingMessage,
  hero,
  greeting,
  nextId,
}: {
  locale: AppLocale;
  groom: Names;
  bride: Names;
  weddingDate: Date | null;
  isPast: boolean;
  message: string;
  postWeddingMessage: string;
  hero: ImageRef | null;
  greeting: string;
  nextId: string | null;
}) {
  const t = await getTranslations({ locale, namespace: "Invitation" });
  // Primary names in the page language, the other language underneath (spec: names in both languages).
  const primary = locale === "kh" ? { g: groom.kh || groom.en, b: bride.kh || bride.en } : { g: groom.en || groom.kh, b: bride.en || bride.kh };
  const secondary = locale === "kh" ? { g: groom.en, b: bride.en } : { g: groom.kh, b: bride.kh };

  return (
    <section id="home" aria-labelledby="hero-title" className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-5 pt-10 pb-24 text-center">
      {hero ? (
        <>
          <SiteImage image={hero} alt="" priority sizes="100vw" className="absolute inset-0 -z-20 h-full w-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white/75 via-white/60 to-ivory" />
        </>
      ) : (
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--wedding-soft-purple),transparent_60%),linear-gradient(to_bottom,var(--wedding-ivory),var(--wedding-lavender))]" />
      )}

      <p className="font-serif text-lg text-purple-deep/80 italic">{greeting}</p>
      <p className="eyebrow mt-4">{t("weddingOf")}</p>

      <h1 id="hero-title" className="mt-6 font-display text-4xl leading-snug text-purple-deep sm:text-6xl">
        <span className="block">{primary.g}</span>
        <span className="my-3 block font-serif text-3xl text-gold-ink italic sm:text-4xl">&amp;</span>
        <span className="block">{primary.b}</span>
      </h1>
      {(secondary.g || secondary.b) && (
        <p className="mt-4 font-serif text-xl text-muted-foreground sm:text-2xl" lang={locale === "kh" ? "en" : "km"}>
          {[secondary.g, secondary.b].filter(Boolean).join(" & ")}
        </p>
      )}

      <Ornament className="my-8" />

      {message && <p className="max-w-xl text-base leading-relaxed text-foreground/80 sm:text-lg">{message}</p>}

      {weddingDate ? (
        <div className="mt-8 space-y-6">
          <p className="font-serif text-2xl text-primary sm:text-3xl">
            {formatDate(weddingDate, locale)}
            <span className="mt-1 block text-lg text-muted-foreground">{formatTime(weddingDate, locale)}</span>
          </p>
          {isPast ? (
            <p className="mx-auto max-w-xl font-serif text-xl text-purple-deep">{postWeddingMessage || t("postWedding")}</p>
          ) : (
            <Countdown target={weddingDate.toISOString()} numberLocale={intlLocale(locale)} />
          )}
        </div>
      ) : (
        <p className="mt-8 font-serif text-xl text-primary">{t("dateTba")}</p>
      )}

      {nextId && (
      <a href={`#${nextId}`} className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-xs text-muted-foreground motion-safe:animate-bounce" data-scroll-cue>
        {t("scroll")}
        <ChevronDown className="size-5" aria-hidden />
      </a>
      )}
    </section>
  );
}
