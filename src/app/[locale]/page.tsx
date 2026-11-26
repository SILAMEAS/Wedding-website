import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PublicHeader } from "@/components/invitation/public-header";
import { Ornament } from "@/components/wedding/ornament";
import { formatDate } from "@/lib/dates";
import { getPublicBasics } from "@/server/services/wedding-content.service";

/**
 * Generic landing page (no token). Shows only public basics; the full,
 * personalized experience lives at /[locale]/invitation/[token] (Phase 4).
 */
export default async function LandingPage({ params }: PageProps<"/[locale]">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const [t, tc, tn, basics] = await Promise.all([
    getTranslations({ locale, namespace: "Landing" }),
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Invitation.nav" }),
    getPublicBasics(locale),
  ]);

  const hasNames = basics.groomName && basics.brideName;

  return (
    <div className="relative flex min-h-dvh flex-col bg-gradient-to-b from-ivory via-background to-lavender">
      <PublicHeader items={[{ href: "/gallery", label: tn("gallery") }, { href: "/wishes", label: tn("wishes") }, { href: "/location", label: tn("locations") }]} />

      <main id="main" className="flex flex-1 items-center justify-center px-6 py-16">
        <section className="w-full max-w-xl rounded-3xl border border-border bg-background/90 px-6 py-12 text-center shadow-sm sm:px-12">
          <p className="eyebrow">{t("eyebrow")}</p>
          <Ornament className="my-6" />

          {hasNames ? (
            <h1 className="font-display text-3xl leading-relaxed text-purple-deep sm:text-4xl">
              <span className="block">{basics.groomName}</span>
              <span className="my-2 block font-serif text-2xl text-gold-ink italic">{tc("and")}</span>
              <span className="block">{basics.brideName}</span>
            </h1>
          ) : (
            <h1 className="font-serif text-3xl text-purple-deep">{t("setupPending")}</h1>
          )}

          <p className="mt-6 text-muted-foreground">{basics.invitationMessage || t("invitationLine")}</p>

          <p className="mt-6 font-serif text-xl text-primary">
            {basics.weddingDate ? formatDate(basics.weddingDate, locale) : t("dateTba")}
          </p>

          <Ornament className="my-6" />
          <p className="text-sm text-muted-foreground">{t("personalLinkHint")}</p>
        </section>
      </main>
    </div>
  );
}
