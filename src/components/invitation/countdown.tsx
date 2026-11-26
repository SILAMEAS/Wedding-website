"use client";

import { useTranslations } from "next-intl";
import { countdownTo } from "@/lib/dates";
import { useNow } from "@/lib/use-now";

/** Live countdown to the wedding. Shows placeholders until hydrated (no SSR/clock mismatch). */
export function Countdown({ target, numberLocale }: { target: string; numberLocale: string }) {
  const t = useTranslations("Invitation.countdown");
  const now = useNow();
  const targetDate = new Date(target);
  const parts = countdownTo(targetDate, now === null ? targetDate : new Date(now));
  if (now !== null && parts.isPast) return <p className="font-serif text-2xl text-purple-deep">{t("today")}</p>;

  const fmt = new Intl.NumberFormat(numberLocale, { minimumIntegerDigits: 2, useGrouping: false });
  const units = [
    { key: "days", value: parts.days },
    { key: "hours", value: parts.hours },
    { key: "minutes", value: parts.minutes },
    { key: "seconds", value: parts.seconds },
  ] as const;

  return (
    <div role="timer" aria-label={t("label")} className="grid grid-cols-4 gap-2 sm:gap-4">
      {units.map((u) => (
        <div key={u.key} className="min-w-16 rounded-2xl border border-white/40 bg-white/70 px-2 py-3 text-center shadow-sm backdrop-blur sm:min-w-20 sm:px-4">
          <span className={`block font-serif text-purple-deep tabular-nums ${u.value > 999 ? "text-xl sm:text-2xl" : "text-3xl sm:text-4xl"}`}>
            {now === null ? "––" : fmt.format(u.value)}
          </span>
          <span className="mt-1 block text-[0.7rem] tracking-wide text-muted-foreground uppercase">{t(u.key)}</span>
        </div>
      ))}
    </div>
  );
}
