import { Quote } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/locales";
import { formatDate } from "@/lib/dates";
import type { PublicWish } from "@/server/services/wish.service";
import { Reveal } from "./reveal";

/** Approved public wishes. Plain text only (React escapes; no HTML is ever rendered). */
export async function WishList({ locale, wishes }: { locale: AppLocale; wishes: PublicWish[] }) {
  const t = await getTranslations({ locale, namespace: "Wishes" });
  if (wishes.length === 0) return <p className="text-center text-muted-foreground">{t("empty")}</p>;
  return (
    <ul className="columns-1 gap-4 sm:columns-2">
      {wishes.map((w) => (
        <li key={w.id} className="mb-4 break-inside-avoid">
          <Reveal>
            <figure className="rounded-3xl border border-border bg-background p-6 shadow-sm">
              <Quote className="size-5 text-gold" aria-hidden />
              <blockquote className="mt-2 whitespace-pre-line text-foreground/85">{w.message}</blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-medium text-purple-deep">{w.authorName}</span>
                {w.relationship && <span className="text-muted-foreground"> · {w.relationship}</span>}
                <span className="block text-xs text-muted-foreground">{formatDate(w.createdAt, locale, { dateStyle: "medium" })}</span>
              </figcaption>
            </figure>
          </Reveal>
        </li>
      ))}
    </ul>
  );
}
