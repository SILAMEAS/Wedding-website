"use client";

import { Check, Paperclip } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { submitGiftAction } from "@/server/actions/guest.actions.public";

const field = "w-full rounded-xl border border-border bg-background px-4 py-3 text-base outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20";

type Method = { id: string; label: string; method: "KHQR" | "BANK_TRANSFER" | "CASH" | "OTHER" };

/** "I sent a gift" notification. It is only a notification: the couple verify it against their bank. */
export function GiftNotifyForm({ token, defaultName, methods, evidenceEnabled }: { token: string; defaultName: string; methods: Method[]; evidenceEnabled: boolean }) {
  const t = useTranslations("Gifts");
  const tErr = useTranslations("Errors");
  const [donorName, setDonor] = useState(defaultName);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USD" | "KHR">("USD");
  const [paymentMethodId, setPm] = useState(methods[0]?.id ?? "");
  const [transactionRef, setRef] = useState("");
  const [transferredOn, setDate] = useState("");
  const [message, setMessage] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  const errText = (code: string, values?: Record<string, string | number>) =>
    tErr.has(code as never) ? (tErr as unknown as (k: string, v?: object) => string)(code, values) : tErr("unexpected");

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > 5 * 1024 * 1024) return setError(errText("fileTooLarge", { maxMb: 5 }));
    setUploading(true);
    try {
      const body = new FormData();
      body.append("token", token);
      body.append("file", file);
      const res = await fetch("/api/public/gift-evidence", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { receipt?: string; error?: string; details?: Record<string, number> };
      if (!res.ok || !json.receipt) throw new Error(json.error ?? "unexpected");
      setReceipt(json.receipt);
      setFileName(file.name);
    } catch (e) {
      setError(errText((e as Error).message, { maxMb: 5 }));
    } finally {
      setUploading(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const pm = methods.find((m) => m.id === paymentMethodId);
    start(async () => {
      const res = await submitGiftAction(token, {
        donorName,
        amount,
        currency,
        method: pm ? pm.method : "OTHER",
        paymentMethodId: pm?.id ?? "",
        transactionRef,
        transferredOn,
        message,
        evidenceReceipt: receipt ?? "",
      });
      if (res.ok) setSent(true);
      else setError(res.fieldErrors ? errText(Object.keys(res.fieldErrors).includes("amount") ? "invalidAmount" : "invalidInput") : errText(res.error, res.details));
    });
  }

  if (sent) {
    return (
      <div role="status" className="rounded-3xl border border-border bg-background p-8 text-center shadow-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-lavender text-primary">
          <Check className="size-7" aria-hidden />
        </span>
        <p className="mt-4 font-serif text-2xl text-purple-deep">{t("notifyThanks")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("notifyPending")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-3xl border border-border bg-background p-6 shadow-sm sm:p-8">
      <h2 className="font-serif text-2xl text-purple-deep">{t("notifyTitle")}</h2>
      <p className="text-sm text-muted-foreground">{t("notifyIntro")}</p>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">{t("donorName")}</span>
        <input className={field} value={donorName} maxLength={120} onChange={(e) => setDonor(e.target.value)} />
      </label>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">{t("amount")}</span>
          <input className={field} inputMode={currency === "KHR" ? "numeric" : "decimal"} value={amount} placeholder={currency === "KHR" ? "100000" : "50.00"} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <fieldset className="space-y-1.5 text-sm">
          <legend className="font-medium">{t("currency")}</legend>
          <div className="inline-flex rounded-xl border border-border p-1">
            {(["USD", "KHR"] as const).map((c) => (
              <label key={c} className={cn("cursor-pointer rounded-lg px-4 py-2 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/30", currency === c ? "bg-primary text-primary-foreground" : "")}>
                <input type="radio" name="currency" value={c} checked={currency === c} onChange={() => setCurrency(c)} className="sr-only" />
                {c === "USD" ? "USD $" : "KHR ៛"}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      {methods.length > 0 && (
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">{t("method")}</span>
          <select className={field} value={paymentMethodId} onChange={(e) => setPm(e.target.value)}>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            <option value="">{t("otherMethod")}</option>
          </select>
        </label>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">{t("reference")} <span className="font-normal text-muted-foreground">({t("optional")})</span></span>
          <input className={field} value={transactionRef} maxLength={80} onChange={(e) => setRef(e.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">{t("date")} <span className="font-normal text-muted-foreground">({t("optional")})</span></span>
          <input className={field} type="date" value={transferredOn} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">{t("message")} <span className="font-normal text-muted-foreground">({t("optional")})</span></span>
        <textarea className={cn(field, "min-h-20")} value={message} maxLength={500} onChange={(e) => setMessage(e.target.value)} />
      </label>
      {evidenceEnabled && (
        <div className="text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 hover:bg-lavender has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-primary/30">
            <Paperclip className="size-4" aria-hidden />
            {uploading ? t("uploading") : receipt ? fileName : t("attachProof")}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          <p className="mt-1 text-xs text-muted-foreground">{t("proofHint")}</p>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending || uploading || !amount.trim() || !donorName.trim()} className="h-12 w-full rounded-full bg-primary text-base font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-purple-deep disabled:opacity-60">
        {pending ? t("sending") : t("notifySend")}
      </button>
    </form>
  );
}
