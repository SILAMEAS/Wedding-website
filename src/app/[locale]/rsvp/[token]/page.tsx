import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { after } from "next/server";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PublicHeader } from "@/components/invitation/public-header";
import { RsvpForm } from "@/components/invitation/rsvp-form";
import { StatusView } from "@/components/invitation/status-view";
import { resolveTokenForPage } from "@/components/invitation/token-page";
import { Ornament } from "@/components/wedding/ornament";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/dates";
import { displayName } from "@/lib/names";
import { recordInvitationAccess } from "@/server/services/invitation.service";
import { getSiteBasics } from "@/server/services/public-content.service";
import { getCurrentRsvp, getRsvpRules } from "@/server/services/rsvp.service";

export async function generateMetadata({ params }: PageProps<"/[locale]/rsvp/[token]">): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: (await getTranslations({ locale, namespace: "Rsvp" }))("title"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function RsvpPage({ params }: PageProps<"/[locale]/rsvp/[token]">) {
  const { locale, token } = (await params) as { locale: Locale; token: string };
  setRequestLocale(locale);
  const { resolution, userAgent } = await resolveTokenForPage(token);
  if (resolution.status !== "valid") {
    const basics = resolution.status === "tooMany" ? { contacts: [] } : await getSiteBasics(locale);
    return <StatusView locale={locale} kind={resolution.status} contacts={basics.contacts} />;
  }
  const inv = resolution.invitation;
  after(() => recordInvitationAccess(inv.invitationId, inv.tokenId, "RSVP_VIEW", userAgent));

  const [t, tn, rules, current] = await Promise.all([
    getTranslations({ locale, namespace: "Rsvp" }),
    getTranslations({ locale, namespace: "Invitation" }),
    getRsvpRules(inv.invitationId),
    getCurrentRsvp(inv.invitationId),
  ]);

  return (
    <>
      <PublicHeader items={[]} homeHref={`/invitation/${token}`} />
      <main id="main" className="min-h-dvh bg-gradient-to-b from-ivory to-lavender px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Link href={`/invitation/${token}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-purple-deep">
            <ArrowLeft className="size-4" aria-hidden /> {tn("backToInvitation")}
          </Link>
          <header className="my-8 text-center">
            <p className="eyebrow mb-3">{t("eyebrow")}</p>
            <h1 className="font-serif text-4xl text-purple-deep sm:text-5xl">{t("title")}</h1>
            <p className="mt-3 text-muted-foreground">{tn("dear", { name: displayName(inv.owner, locale) })}</p>
            <Ornament className="mt-6" />
            {rules.deadline && (
              <p className="mt-4 text-sm text-muted-foreground">{t(rules.isOpen ? "deadline" : "closedOn", { date: formatDateTime(rules.deadline, locale) })}</p>
            )}
          </header>

          {rules.isOpen ? (
            <RsvpForm
              token={token}
              members={inv.members.map((m) => ({ id: m.id, name: displayName(m, locale) }))}
              capacity={inv.capacity}
              allowUnnamed={inv.allowUnnamedGuests}
              allowMaybe={rules.allowMaybe}
              current={
                current
                  ? {
                      status: current.status,
                      attendees: current.participants.filter((p) => p.attending).map((p) => p.guestId),
                      unnamedGuests: current.unnamedGuests,
                      dietary: current.dietary ?? "",
                      accessibility: current.accessibility ?? "",
                      note: current.note ?? "",
                    }
                  : null
              }
            />
          ) : (
            <div className="rounded-3xl border border-border bg-background p-8 text-center shadow-sm">
              <h2 className="font-serif text-2xl text-purple-deep">{t("closedTitle")}</h2>
              <p className="mt-3 text-muted-foreground">
                {current ? t("closedWithReply", { status: t(current.status === "ATTENDING" ? "attending" : current.status === "MAYBE" ? "maybe" : "declined"), count: current.attendingCount }) : t("closedNoReply")}
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
