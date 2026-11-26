import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { after } from "next/server";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GiftNotifyForm } from "@/components/invitation/gift-notify-form";
import { PaymentMethods } from "@/components/invitation/payment-methods";
import { PublicHeader } from "@/components/invitation/public-header";
import { StatusView } from "@/components/invitation/status-view";
import { resolveTokenForPage } from "@/components/invitation/token-page";
import { Ornament } from "@/components/wedding/ornament";
import { Link } from "@/i18n/navigation";
import { displayName } from "@/lib/names";
import { getGiftPageSettings, getPublicPaymentMethods } from "@/server/services/gift.service";
import { recordInvitationAccess } from "@/server/services/invitation.service";
import { getSiteBasics } from "@/server/services/public-content.service";

export async function generateMetadata({ params }: PageProps<"/[locale]/gift/[token]">): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: (await getTranslations({ locale, namespace: "Gifts" }))("title"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function GiftPage({ params }: PageProps<"/[locale]/gift/[token]">) {
  const { locale, token } = (await params) as { locale: Locale; token: string };
  setRequestLocale(locale);
  const { resolution, userAgent } = await resolveTokenForPage(token);
  if (resolution.status !== "valid") {
    const basics = resolution.status === "tooMany" ? { contacts: [] } : await getSiteBasics(locale);
    return <StatusView locale={locale} kind={resolution.status} contacts={basics.contacts} />;
  }
  const inv = resolution.invitation;
  after(() => recordInvitationAccess(inv.invitationId, inv.tokenId, "GIFT_VIEW", userAgent));

  const [t, tn, settings, methods] = await Promise.all([
    getTranslations({ locale, namespace: "Gifts" }),
    getTranslations({ locale, namespace: "Invitation" }),
    getGiftPageSettings(locale),
    getPublicPaymentMethods(locale),
  ]);

  return (
    <>
      <PublicHeader items={[]} homeHref={`/invitation/${token}`} />
      <main id="main" className="min-h-dvh bg-gradient-to-b from-ivory to-lavender px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <Link href={`/invitation/${token}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-purple-deep">
            <ArrowLeft className="size-4" aria-hidden /> {tn("backToInvitation")}
          </Link>
          <header className="my-8 text-center">
            <p className="eyebrow mb-3">{t("eyebrow")}</p>
            <h1 className="font-serif text-4xl text-purple-deep sm:text-5xl">{t("title")}</h1>
            <Ornament className="mt-6" />
            <p className="mx-auto mt-6 max-w-xl whitespace-pre-line text-foreground/80">{settings.thankYou || t("defaultThankYou")}</p>
          </header>
          {!settings.enabled || methods.length === 0 ? (
            <p className="rounded-3xl border border-border bg-background p-8 text-center text-muted-foreground">{t("notConfigured")}</p>
          ) : (
            <div className="space-y-10">
              <PaymentMethods locale={locale} methods={methods} />
              <GiftNotifyForm
                token={token}
                defaultName={displayName(inv.owner, locale)}
                methods={methods.map((m) => ({ id: m.id, label: m.label, method: m.method }))}
                evidenceEnabled={settings.evidenceEnabled}
              />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
