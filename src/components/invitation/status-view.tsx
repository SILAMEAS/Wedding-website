import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/wedding/language-switcher";
import { Ornament } from "@/components/wedding/ornament";
import type { AppLocale } from "@/i18n/locales";

type Contact = { label: string; phone: string };

/** Friendly full-page state for invalid / inactive / rate-limited invitation links. Reveals nothing about other invitations. */
export async function StatusView({ locale, kind, contacts }: { locale: AppLocale; kind: "invalid" | "inactive" | "tooMany"; contacts: Contact[] }) {
  const t = await getTranslations({ locale, namespace: "Invitation.status" });
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-ivory to-lavender">
      <header className="flex justify-end p-4">
        <LanguageSwitcher />
      </header>
      <main id="main" className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md rounded-3xl border border-border bg-background p-8 text-center shadow-sm">
          <h1 className="font-serif text-3xl text-purple-deep">{t(`${kind}Title`)}</h1>
          <Ornament className="my-5" />
          <p className="text-muted-foreground">{t(`${kind}Body`)}</p>
          {kind !== "tooMany" && contacts.length > 0 && (
            <div className="mt-6 space-y-2 text-sm">
              <p className="font-medium">{t("contact")}</p>
              {contacts.map((c) => (
                <p key={c.phone}>
                  {c.label}:{" "}
                  <a href={`tel:${c.phone.replace(/[^+\d]/g, "")}`} className="text-primary underline underline-offset-4">
                    {c.phone}
                  </a>
                </p>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
