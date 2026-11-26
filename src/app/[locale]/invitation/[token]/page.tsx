import type { Metadata } from "next";
import { after } from "next/server";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Envelope } from "@/components/invitation/envelope";
import { EventsSection } from "@/components/invitation/events-section";
import { GallerySection } from "@/components/invitation/gallery-section";
import { Hero } from "@/components/invitation/hero";
import { GiftsSection, RsvpSection, WishesSection } from "@/components/invitation/interaction-sections";
import { LocationsSection } from "@/components/invitation/locations-section";
import { PublicHeader } from "@/components/invitation/public-header";
import { SiteFooter } from "@/components/invitation/site-footer";
import { StatusView } from "@/components/invitation/status-view";
import { StorySection } from "@/components/invitation/story-section";
import { resolveTokenForPage } from "@/components/invitation/token-page";
import { displayName } from "@/lib/names";
import { recordInvitationAccess } from "@/server/services/invitation.service";
import { getGiftPageSettings, getPublicPaymentMethods } from "@/server/services/gift.service";
import { getInvitationContent, getSiteBasics } from "@/server/services/public-content.service";
import { getCurrentRsvp, getRsvpRules } from "@/server/services/rsvp.service";
import { listPublicWishes, wishesEnabled } from "@/server/services/wish.service";

/** Generic metadata only: link previews (Telegram, Facebook…) must never show the guest's name. */
export async function generateMetadata({ params }: PageProps<"/[locale]/invitation/[token]">): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const [t, basics] = await Promise.all([getTranslations({ locale, namespace: "Metadata" }), getSiteBasics(locale)]);
  const names = [basics.groomName, basics.brideName].filter(Boolean).join(" & ");
  return { title: names ? `${names} · ${t("siteTitle")}` : t("siteTitle"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function InvitationPage({ params }: PageProps<"/[locale]/invitation/[token]">) {
  const { locale, token } = (await params) as { locale: Locale; token: string };
  setRequestLocale(locale);

  const { resolution, userAgent } = await resolveTokenForPage(token);
  if (resolution.status === "tooMany") return <StatusView locale={locale} kind="tooMany" contacts={[]} />;
  if (resolution.status !== "valid") {
    const basics = await getSiteBasics(locale);
    return <StatusView locale={locale} kind={resolution.status} contacts={basics.contacts} />;
  }
  const inv = resolution.invitation;
  // Log after the response is sent; previews/bots are flagged inside.
  after(() => recordInvitationAccess(inv.invitationId, inv.tokenId, "LANDING", userAgent));

  const [t, content, rsvpRules, rsvp, wishesOn, wishes, giftSettings, paymentMethods] = await Promise.all([
    getTranslations({ locale, namespace: "Invitation" }),
    getInvitationContent(locale),
    getRsvpRules(inv.invitationId),
    getCurrentRsvp(inv.invitationId),
    wishesEnabled(),
    listPublicWishes(6),
    getGiftPageSettings(locale),
    getPublicPaymentMethods(locale),
  ]);
  const guestName = displayName(inv.owner, locale);
  const s = content.sections;
  const show = {
    story: s.story,
    events: s.events && content.events.length > 0,
    gallery: s.gallery && content.albums.length > 0,
    locations: s.locations && content.locations.length > 0,
    rsvp: s.rsvp,
    wishes: s.wishes && wishesOn,
    gifts: s.gifts && giftSettings.enabled && paymentMethods.length > 0,
  };
  const nav = [
    show.story && { href: "#story", label: t("nav.story") },
    show.events && { href: "#events", label: t("nav.events") },
    show.gallery && { href: "#gallery", label: t("nav.gallery") },
    show.locations && { href: "#locations", label: t("nav.locations") },
    show.rsvp && { href: "#rsvp", label: t("nav.rsvp") },
    show.wishes && { href: "#wishes", label: t("nav.wishes") },
    show.gifts && { href: "#gifts", label: t("nav.gifts") },
  ].filter((x): x is { href: string; label: string } => !!x);
  const coupleLine = [content.groomName, content.brideName].filter(Boolean).join(" & ");
  const monogram = `${(content.groom.en || "S").charAt(0)}&${(content.bride.en || "K").charAt(0)}`;

  return (
    <Envelope
      token={token}
      storageKey={`opened:${inv.invitationId}`}
      greeting={t("dear", { name: guestName })}
      invitedLine={t("invitedLine")}
      coupleLine={coupleLine}
      openLabel={t("open")}
      monogram={monogram}
      musicUrl={content.music}
      musicLabels={{ play: t("musicPlay"), pause: t("musicPause") }}
    >
      <PublicHeader items={nav} homeHref={`/invitation/${token}`} />
      <main id="main">
        <Hero
          locale={locale}
          groom={content.groom}
          bride={content.bride}
          weddingDate={content.weddingDate}
          isPast={content.isPast}
          message={content.invitationMessage}
          postWeddingMessage={content.postWeddingMessage}
          hero={content.hero}
          greeting={t("dear", { name: guestName })}
          nextId={nav[0]?.href.slice(1) ?? null}
        />
        {show.story && <StorySection locale={locale} content={content} />}
        {show.events && <EventsSection locale={locale} events={content.events} />}
        {show.gallery && <GallerySection locale={locale} albums={content.albums} />}
        {show.locations && <LocationsSection locale={locale} locations={content.locations} />}
        {show.rsvp && (
          <RsvpSection
            locale={locale}
            token={token}
            current={rsvp ? { status: rsvp.status, attendingCount: rsvp.attendingCount } : null}
            deadline={rsvpRules.deadline}
            isOpen={rsvpRules.isOpen}
          />
        )}
        {show.wishes && <WishesSection locale={locale} token={token} defaultName={guestName} wishes={wishes} />}
        {show.gifts && <GiftsSection locale={locale} token={token} thankYou={giftSettings.thankYou} />}
      </main>
      <SiteFooter locale={locale} groomName={content.groomName} brideName={content.brideName} contacts={content.contacts} />
    </Envelope>
  );
}
