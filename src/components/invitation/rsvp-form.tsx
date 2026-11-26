"use client";

import { Check, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { submitRsvpAction } from "@/server/actions/guest.actions.public";

type Status = "ATTENDING" | "DECLINED" | "MAYBE";
type Member = { id: string; name: string };
type Current = { status: Status; attendees: string[]; unnamedGuests: number; dietary: string; accessibility: string; note: string } | null;

const field = "w-full rounded-xl border border-border bg-background px-4 py-3 text-base outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20";

export function RsvpForm({
  token,
  members,
  capacity,
  allowUnnamed,
  allowMaybe,
  current,
}: {
  token: string;
  members: Member[];
  capacity: number;
  allowUnnamed: boolean;
  allowMaybe: boolean;
  current: Current;
}) {
  const t = useTranslations("Rsvp");
  const tErr = useTranslations("Errors");
  const single = members.length === 1;
  const [status, setStatus] = useState<Status | null>(current?.status ?? null);
  const [attendees, setAttendees] = useState<string[]>(current?.attendees.length ? current.attendees : members.map((m) => m.id).slice(0, capacity));
  const [unnamed, setUnnamed] = useState(current?.unnamedGuests ?? 0);
  const [dietary, setDietary] = useState(current?.dietary ?? "");
  const [accessibility, setAccessibility] = useState(current?.accessibility ?? "");
  const [note, setNote] = useState(current?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ status: string; count: number } | null>(null);
  const [pending, start] = useTransition();

  const attending = status === "ATTENDING" || status === "MAYBE";
  const total = (attending ? attendees.length : 0) + (attending ? unnamed : 0);
  const maxUnnamed = Math.max(0, capacity - attendees.length);
  const overCapacity = total > capacity;

  function toggle(id: string) {
    setAttendees((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!status) return setError(t("chooseStatus"));
    setError(null);
    start(async () => {
      const res = await submitRsvpAction(token, {
        status,
        attendees: attending ? attendees : [],
        unnamedGuests: attending ? unnamed : 0,
        dietary,
        accessibility,
        note,
      });
      if (res.ok) setDone({ status: res.data.status, count: res.data.attendingCount });
      else setError(tErr(res.error, { ...res.details }));
    });
  }

  if (done) {
    return (
      <div role="status" className="rounded-3xl border border-border bg-background p-8 text-center shadow-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-lavender text-primary">
          <Check className="size-7" aria-hidden />
        </span>
        <h2 className="mt-4 font-serif text-3xl text-purple-deep">{t("thanks")}</h2>
        <p className="mt-2 text-muted-foreground">
          {done.status === "DECLINED" ? t("thanksDeclined") : t("thanksAttending", { count: done.count })}
        </p>
        <button type="button" onClick={() => setDone(null)} className="mt-6 text-sm text-primary underline underline-offset-4">
          {t("change")}
        </button>
      </div>
    );
  }

  const options: { value: Status; label: string }[] = [
    { value: "ATTENDING", label: t("attending") },
    { value: "DECLINED", label: t("declined") },
    ...(allowMaybe ? [{ value: "MAYBE" as const, label: t("maybe") }] : []),
  ];

  return (
    <form onSubmit={submit} noValidate className="space-y-8 rounded-3xl border border-border bg-background p-6 shadow-sm sm:p-8">
      <fieldset>
        <legend className="mb-3 font-serif text-xl text-purple-deep">{t("question")}</legend>
        <div className={cn("grid gap-3", options.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          {options.map((o) => (
            <label
              key={o.value}
              className={cn(
                "flex cursor-pointer items-center justify-center rounded-2xl border px-4 py-4 text-center transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/30",
                status === o.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-lavender",
              )}
            >
              <input type="radio" name="status" value={o.value} checked={status === o.value} onChange={() => setStatus(o.value)} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      {attending && (
        <>
          {!single && (
            <fieldset>
              <legend className="mb-1 font-serif text-xl text-purple-deep">{t("whoIsComing")}</legend>
              <p className="mb-3 text-sm text-muted-foreground">{t("capacity", { capacity })}</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {members.map((m) => {
                  const checked = attendees.includes(m.id);
                  return (
                    <li key={m.id}>
                      <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/30", checked ? "border-primary bg-lavender" : "border-border")}>
                        <input type="checkbox" checked={checked} onChange={() => toggle(m.id)} className="size-5 accent-[var(--wedding-purple)]" />
                        {m.name}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          )}

          {allowUnnamed && (
            <div>
              <p id="unnamed-label" className="font-serif text-xl text-purple-deep">{t("additionalGuests")}</p>
              <p className="mb-3 text-sm text-muted-foreground">{t("additionalHint")}</p>
              <div className="inline-flex items-center gap-4 rounded-full border border-border p-1" role="group" aria-labelledby="unnamed-label">
                <button type="button" aria-label={t("fewer")} disabled={unnamed === 0} onClick={() => setUnnamed((n) => Math.max(0, n - 1))} className="flex size-10 items-center justify-center rounded-full hover:bg-lavender disabled:opacity-40">
                  <Minus className="size-4" aria-hidden />
                </button>
                <output aria-live="polite" className="min-w-6 text-center text-lg tabular-nums">{unnamed}</output>
                <button type="button" aria-label={t("more")} disabled={unnamed >= maxUnnamed} onClick={() => setUnnamed((n) => Math.min(maxUnnamed, n + 1))} className="flex size-10 items-center justify-center rounded-full hover:bg-lavender disabled:opacity-40">
                  <Plus className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          )}

          <p className={cn("text-sm", overCapacity ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
            {t("total", { count: total, capacity })}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">{t("dietary")}</span>
              <input className={field} value={dietary} maxLength={300} onChange={(e) => setDietary(e.target.value)} placeholder={t("dietaryHint")} />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">{t("accessibility")}</span>
              <input className={field} value={accessibility} maxLength={300} onChange={(e) => setAccessibility(e.target.value)} placeholder={t("accessibilityHint")} />
            </label>
          </div>
        </>
      )}

      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">{t("note")}</span>
        <textarea className={cn(field, "min-h-24")} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </label>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || overCapacity}
        className="h-12 w-full rounded-full bg-primary text-base font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-purple-deep disabled:opacity-60"
      >
        {pending ? t("sending") : current ? t("update") : t("send")}
      </button>
    </form>
  );
}
