"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { type AppLocale, locales } from "@/i18n/locales";
import { cn } from "@/lib/utils";
import { setAdminLocaleAction } from "@/server/actions/locale.actions";

/** Admin URLs carry no locale; switching sets the cookie and re-renders. */
export function AdminLanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("Common");
  const current = useLocale() as AppLocale;
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="group" aria-label={t("switchLanguage")} className={cn("inline-flex rounded-full border border-border bg-background p-0.5 text-xs", pending && "opacity-60", className)}>
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={l === current}
          lang={l === "kh" ? "km" : "en"}
          onClick={() =>
            start(async () => {
              await setAdminLocaleAction(l);
              router.refresh();
            })
          }
          className={cn("rounded-full px-2.5 py-1", l === current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {t(`localeName.${l}`)}
        </button>
      ))}
    </div>
  );
}
