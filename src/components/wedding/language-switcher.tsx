"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { type AppLocale, locales } from "@/i18n/locales";
import { cn } from "@/lib/utils";

/** Segmented EN / ខ្មែរ toggle. Keeps the current path; next-intl persists the choice in a cookie. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("Common");
  const current = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  function select(next: AppLocale) {
    if (next === current) return;
    startTransition(() => {
      // @ts-expect-error -- pathname/params come from the current route and are valid together.
      router.replace({ pathname, params }, { locale: next, scroll: false });
    });
  }

  return (
    <div
      role="group"
      aria-label={t("switchLanguage")}
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-background/80 p-0.5 text-sm shadow-xs backdrop-blur",
        isPending && "opacity-70",
        className,
      )}
    >
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => select(l)}
          aria-pressed={l === current}
          lang={l === "kh" ? "km" : "en"}
          className={cn(
            "rounded-full px-3 py-1 transition-colors",
            l === current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(`localeName.${l}`)}
        </button>
      ))}
    </div>
  );
}
