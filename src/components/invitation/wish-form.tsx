"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { submitWishAction } from "@/server/actions/guest.actions.public";

const field = "w-full rounded-xl border border-border bg-background px-4 py-3 text-base outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20";

/** Guestbook form. Every wish goes to the couple for approval first. */
export function WishForm({ defaultName, token }: { defaultName: string; token?: string }) {
  const t = useTranslations("Wishes");
  const tErr = useTranslations("Errors");
  const tv = useTranslations("Validation");
  const [authorName, setName] = useState(defaultName);
  const [relationship, setRelationship] = useState("");
  const [message, setMessage] = useState("");
  const [isPrivate, setPrivate] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const id = useId();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await submitWishAction({ authorName, relationship, message, visibility: isPrivate ? "PRIVATE" : "PUBLIC", website }, token);
      if (res.ok) {
        setSent(true);
        setMessage("");
      } else if (res.fieldErrors) {
        const first = Object.values(res.fieldErrors)[0];
        setError(first && tv.has(first as never) ? tv(first as never) : tErr("invalidInput"));
      } else setError(tErr(res.error, { ...res.details }));
    });
  }

  if (sent) {
    return (
      <div role="status" className="rounded-3xl border border-border bg-background p-8 text-center shadow-sm">
        <Heart className="mx-auto size-8 fill-soft-purple text-primary" aria-hidden />
        <p className="mt-3 font-serif text-2xl text-purple-deep">{t("thanks")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("pendingNote")}</p>
        <button type="button" onClick={() => setSent(false)} className="mt-5 text-sm text-primary underline underline-offset-4">
          {t("another")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-3xl border border-border bg-background p-6 shadow-sm sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">{t("name")}</span>
          <input className={field} value={authorName} required maxLength={80} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">
            {t("relationship")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
          </span>
          <input className={field} value={relationship} maxLength={80} placeholder={t("relationshipHint")} onChange={(e) => setRelationship(e.target.value)} />
        </label>
      </div>
      <div className="space-y-1.5 text-sm">
        <label htmlFor={`${id}-msg`} className="font-medium">{t("message")}</label>
        <textarea id={`${id}-msg`} aria-describedby={`${id}-count`} className={cn(field, "min-h-32")} value={message} required maxLength={1000} onChange={(e) => setMessage(e.target.value)} />
        <span id={`${id}-count`} className="block text-right text-xs text-muted-foreground tabular-nums">{message.length}/1000</span>
      </div>
      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>
      <div className="flex items-start gap-3 text-sm">
        <input id={`${id}-private`} type="checkbox" aria-describedby={`${id}-private-hint`} checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} className="mt-1 size-5 accent-[var(--wedding-purple)]" />
        <div>
          <label htmlFor={`${id}-private`}>{t("private")}</label>
          <p id={`${id}-private-hint`} className="text-xs text-muted-foreground">{t("privateHint")}</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending || message.trim().length < 2 || !authorName.trim()} className="h-12 w-full rounded-full bg-primary text-base font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-purple-deep disabled:opacity-60">
        {pending ? t("sending") : t("send")}
      </button>
      <p className="text-center text-xs text-muted-foreground">{t("moderationNote")}</p>
    </form>
  );
}
