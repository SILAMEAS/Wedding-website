import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { fontVariables } from "@/app/fonts";
import { Toaster } from "@/components/ui/sonner";
import { htmlLang, isAppLocale } from "@/i18n/locales";
import "../globals.css";

// Private, per-request admin pages. Never cached, never indexed.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: { default: t("brand"), template: `%s · ${t("brand")}` }, robots: { index: false, follow: false } };
}

export default async function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  const locale = await getLocale();
  return (
    <html lang={isAppLocale(locale) ? htmlLang(locale) : "km"} className={fontVariables}>
      <body className="min-h-dvh bg-ivory">
        <NextIntlClientProvider>
          {children}
          <Toaster position="top-center" richColors />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
