import { Gift, MailCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/locales";
import { formatDateTime } from "@/lib/dates";
import type { PublicWish } from "@/server/services/wish.service";
import { Reveal } from "./reveal";
import { Section } from "./section";
import { WishForm } from "./wish-form";
import { WishList } from "./wish-list";

const cta = "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-8 text-base font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-purple-deep";

export async function RsvpSection({
  locale,
  token,
  current,
  deadline,
  isOpen,
}: {
  locale: AppLocale;
  token: string;
  current: { status: "ATTENDING" | "DECLINED" | "MAYBE"; attendingCount: number } | null;
  deadline: Date | null;
  isOpen: boolean;
}) {
  const t = await getTranslations({ locale, namespace: "Rsvp" });
  const statusLabel = current ? t(current.status === "ATTENDING" ? "attending" : current.status === "MAYBE" ? "maybe" : "declined") : null;
  return (
    <Section id="rsvp" eyebrow={t("eyebrow")} title={t("title")} tone="lavender">
      <Reveal className="mx-auto max-w-xl rounded-3xl border border-border bg-background p-8 text-center shadow-sm">
        <MailCheck className="mx-auto size-8 text-primary" aria-hidden />
        {current ? (
          <p className="mt-4 text-lg">
            {t("yourReply")}: <strong className="text-purple-deep">{statusLabel}</strong>
            {current.status !== "DECLINED" && <span className="text-muted-foreground"> · {t("people", { count: current.attendingCount })}</span>}
          </p>
        ) : (
          <p className="mt-4 text-lg text-foreground/80">{t("prompt")}</p>
        )}
        {deadline && (
          <p className="mt-2 text-sm text-muted-foreground">{t(isOpen ? "deadline" : "closedOn", { date: formatDateTime(deadline, locale) })}</p>
        )}
        {isOpen && (
          <Link href={`/rsvp/${token}`} className={`${cta} mt-6`}>
            {current ? t("change") : t("replyNow")}
          </Link>
        )}
      </Reveal>
    </Section>
  );
}

export async function WishesSection({ locale, token, defaultName, wishes }: { locale: AppLocale; token: string; defaultName: string; wishes: PublicWish[] }) {
  const t = await getTranslations({ locale, namespace: "Wishes" });
  return (
    <Section id="wishes" eyebrow={t("eyebrow")} title={t("title")}>
      <div className="mx-auto mb-14 max-w-2xl">
        <WishForm defaultName={defaultName} token={token} />
      </div>
      <WishList locale={locale} wishes={wishes} />
      {wishes.length >= 6 && (
        <p className="mt-8 text-center">
          <Link href="/wishes" className="text-primary underline underline-offset-4">{t("seeAll")}</Link>
        </p>
      )}
    </Section>
  );
}

export async function GiftsSection({ locale, token, thankYou }: { locale: AppLocale; token: string; thankYou: string }) {
  const t = await getTranslations({ locale, namespace: "Gifts" });
  return (
    <Section id="gifts" eyebrow={t("eyebrow")} title={t("title")} tone="ivory">
      <Reveal className="mx-auto max-w-xl text-center">
        <Gift className="mx-auto size-8 text-gold" aria-hidden />
        <p className="mt-4 whitespace-pre-line text-foreground/80">{thankYou || t("defaultThankYou")}</p>
        <Link href={`/gift/${token}`} className={`${cta} mt-6`}>
          {t("viewDetails")}
        </Link>
      </Reveal>
    </Section>
  );
}
