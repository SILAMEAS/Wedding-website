import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PublicHeader } from "@/components/invitation/public-header";
import { WishForm } from "@/components/invitation/wish-form";
import { WishList } from "@/components/invitation/wish-list";
import { Ornament } from "@/components/wedding/ornament";
import { displayName } from "@/lib/names";
import { getGuestAccess } from "@/server/policies/guest";
import { getInvitationOwnerName } from "@/server/services/invitation.service";
import { listPublicWishes, wishesEnabled } from "@/server/services/wish.service";

export async function generateMetadata({ params }: PageProps<"/[locale]/wishes">): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: (await getTranslations({ locale, namespace: "Wishes" }))("title") };
}

export default async function WishesPage({ params }: PageProps<"/[locale]/wishes">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const [t, tn, access, enabled, wishes] = await Promise.all([
    getTranslations({ locale, namespace: "Wishes" }),
    getTranslations({ locale, namespace: "Invitation.nav" }),
    getGuestAccess(),
    wishesEnabled(),
    listPublicWishes(100),
  ]);
  const owner = access ? await getInvitationOwnerName(access.invitationId) : null;
  const defaultName = owner ? displayName(owner, locale) : "";

  return (
    <>
      <PublicHeader items={[{ href: "/gallery", label: tn("gallery") }, { href: "/wishes", label: tn("wishes") }, { href: "/location", label: tn("locations") }]} />
      <main id="main" className="min-h-dvh bg-ivory px-5 py-16">
        <div className="mx-auto max-w-4xl">
          <header className="mb-12 text-center">
            <p className="eyebrow mb-3">{t("eyebrow")}</p>
            <h1 className="font-serif text-4xl text-purple-deep sm:text-5xl">{t("title")}</h1>
            <Ornament className="mt-6" />
          </header>
          {enabled && access && (
            <div className="mx-auto mb-14 max-w-2xl">
              <WishForm defaultName={defaultName} />
            </div>
          )}
          {enabled && !access && <p className="mb-10 text-center text-sm text-muted-foreground">{t("guestsOnly")}</p>}
          {enabled ? <WishList locale={locale} wishes={wishes} /> : <p className="text-center text-muted-foreground">{t("closed")}</p>}
        </div>
      </main>
    </>
  );
}
