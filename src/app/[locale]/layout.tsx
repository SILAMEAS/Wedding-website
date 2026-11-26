import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { fontVariables } from "@/app/fonts";
import { htmlLang } from "@/i18n/locales";
import { routing } from "@/i18n/routing";
import "../globals.css";

// Per-request rendering everywhere (CSP nonce, invitation tokens). See README "Rendering model".
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return {
    title: { default: t("siteTitle"), template: `%s · ${t("siteTitle")}` },
    description: t("siteDescription"),
    // Private family event: keep every page out of search engines.
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#7651A8",
  width: "device-width",
  initialScale: 1,
};

export default async function PublicRootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Common" });

  return (
    <html lang={htmlLang(locale)} className={fontVariables}>
      <body className="min-h-dvh bg-background">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
