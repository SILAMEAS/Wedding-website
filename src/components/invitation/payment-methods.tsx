import { Download, Landmark, QrCode } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SiteImage } from "@/components/wedding/site-image";
import type { AppLocale } from "@/i18n/locales";
import type { PublicPaymentMethod } from "@/server/services/gift.service";
import { CopyText } from "./copy-text";

/** Configured payment instructions only — never any gift records or totals. */
export async function PaymentMethods({ locale, methods }: { locale: AppLocale; methods: PublicPaymentMethod[] }) {
  const t = await getTranslations({ locale, namespace: "Gifts" });
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {methods.map((m) => (
        <article key={m.id} className="rounded-3xl border border-border bg-background p-6 text-center shadow-sm">
          <p className="flex items-center justify-center gap-2 text-sm text-gold-ink">
            {m.method === "KHQR" ? <QrCode className="size-4" aria-hidden /> : <Landmark className="size-4" aria-hidden />}
            {m.method === "KHQR" ? "KHQR" : t("bankTransfer")}
          </p>
          <h3 className="mt-1 font-serif text-2xl text-purple-deep">{m.label}</h3>
          {m.qr && (
            <div className="mx-auto mt-4 w-full max-w-64">
              <SiteImage image={m.qr} alt={t("qrAlt", { label: m.label })} sizes="256px" className="w-full rounded-2xl border border-border bg-white p-2" />
              <a href={m.qr.src} download className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline">
                <Download className="size-4" aria-hidden /> {t("saveQr")}
              </a>
            </div>
          )}
          <dl className="mt-4 space-y-2 text-sm">
            {m.bankName && (
              <div><dt className="text-muted-foreground">{t("bank")}</dt><dd className="font-medium">{m.bankName}</dd></div>
            )}
            {m.accountHolder && (
              <div><dt className="text-muted-foreground">{t("holder")}</dt><dd className="font-medium">{m.accountHolder}</dd></div>
            )}
            {m.accountNumber && (
              <div>
                <dt className="text-muted-foreground">{t("accountNumber")}</dt>
                <dd className="flex items-center justify-center gap-2 font-mono text-base tracking-wide">
                  {m.accountNumber} <CopyText value={m.accountNumber} label={t("copy")} copied={t("copied")} />
                </dd>
              </div>
            )}
            <div><dt className="text-muted-foreground">{t("currencies")}</dt><dd>{m.currencies.join(" · ")}</dd></div>
          </dl>
          {m.instructions && <p className="mt-4 rounded-xl bg-lavender/60 p-3 text-sm whitespace-pre-line text-purple-deep">{m.instructions}</p>}
        </article>
      ))}
    </div>
  );
}
