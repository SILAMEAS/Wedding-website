import { Phone, Send } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Ornament } from "@/components/wedding/ornament";
import type { AppLocale } from "@/i18n/locales";

type Contact = { label: string; phone: string; telegram: string | null };

export async function SiteFooter({ locale, groomName, brideName, contacts }: { locale: AppLocale; groomName: string; brideName: string; contacts: Contact[] }) {
  const t = await getTranslations({ locale, namespace: "Invitation" });
  return (
    <footer className="bg-purple-deep px-5 py-16 text-center text-white/90">
      <p className="font-display text-2xl text-white">
        {groomName} <span className="font-serif text-gold italic">&amp;</span> {brideName}
      </p>
      <Ornament className="my-6 text-gold" />
      <p className="font-serif text-lg italic">{t("thankYou")}</p>
      {contacts.length > 0 && (
        <div className="mt-10">
          <p className="eyebrow text-gold">{t("contacts")}</p>
          <ul className="mt-4 flex flex-wrap justify-center gap-3">
            {contacts.map((c) => (
              <li key={`${c.label}-${c.phone}`} className="rounded-2xl border border-white/15 px-4 py-3 text-sm">
                <p className="font-medium text-white">{c.label}</p>
                <div className="mt-1 flex items-center justify-center gap-3">
                  <a href={`tel:${c.phone.replace(/[^+\d]/g, "")}`} className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                    <Phone className="size-3.5" aria-hidden /> {c.phone}
                  </a>
                  {c.telegram && (
                    <a href={`https://t.me/${c.telegram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                      <Send className="size-3.5" aria-hidden /> Telegram
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </footer>
  );
}
