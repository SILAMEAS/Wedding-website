"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormField, NativeSelect } from "@/components/admin/form-field";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordGiftAction } from "@/server/actions/gift-admin.actions";

/** Record cash received at the wedding, or a transfer already seen in the bank. */
export function RecordGiftForm({ invitations }: { invitations: { id: string; label: string }[] }) {
  const t = useTranslations("Admin.gifts");
  const tc = useTranslations("Admin.common");
  const router = useRouter();
  const { run, pending } = useAction();
  const [v, setV] = useState({
    donorName: "",
    invitationId: "",
    method: "CASH" as "CASH" | "BANK_TRANSFER" | "KHQR" | "OTHER",
    currency: "USD" as "USD" | "KHR",
    amount: "",
    receivedOn: "",
    transactionRef: "",
    adminNote: "",
    confirmed: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((s) => ({ ...s, [k]: value }));

  function pickInvitation(id: string) {
    set("invitationId", id);
    const label = invitations.find((i) => i.id === id)?.label;
    if (label && !v.donorName) set("donorName", label.split(" · ").pop() ?? label);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run(() => recordGiftAction(v), { success: t("recordedToast"), onSuccess: (d) => router.push(`/admin/gifts/${d.id}`) });
    if (!res.ok && res.fieldErrors) setErrors(res.fieldErrors);
  }

  return (
    <form onSubmit={submit} noValidate className="grid max-w-2xl gap-5 rounded-xl border border-border bg-background p-5 sm:grid-cols-2">
      <FormField id="invitationId" label={t("invitation")} optional className="sm:col-span-2">
        <NativeSelect id="invitationId" value={v.invitationId} onChange={(e) => pickInvitation(e.target.value)}>
          <option value="">—</option>
          {invitations.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
        </NativeSelect>
      </FormField>
      <FormField id="donorName" label={t("donor")} error={errors.donorName} className="sm:col-span-2">
        <Input id="donorName" value={v.donorName} maxLength={120} onChange={(e) => set("donorName", e.target.value)} />
      </FormField>
      <FormField id="amount" label={t("amount")} hint={v.currency === "KHR" ? t("khrHint") : undefined} error={errors.amount}>
        <Input id="amount" inputMode="decimal" value={v.amount} onChange={(e) => set("amount", e.target.value)} />
      </FormField>
      <FormField id="currency" label={t("currency")}>
        <NativeSelect id="currency" value={v.currency} onChange={(e) => set("currency", e.target.value as "USD" | "KHR")}>
          <option value="USD">USD $</option>
          <option value="KHR">KHR ៛</option>
        </NativeSelect>
      </FormField>
      <FormField id="method" label={t("methodLabel")}>
        <NativeSelect id="method" value={v.method} onChange={(e) => set("method", e.target.value as typeof v.method)}>
          {(["CASH", "BANK_TRANSFER", "KHQR", "OTHER"] as const).map((m) => <option key={m} value={m}>{t(`method.${m}`)}</option>)}
        </NativeSelect>
      </FormField>
      <FormField id="receivedOn" label={t("receivedDate")} optional>
        <Input id="receivedOn" type="date" value={v.receivedOn} onChange={(e) => set("receivedOn", e.target.value)} />
      </FormField>
      <FormField id="transactionRef" label={t("reference")} optional>
        <Input id="transactionRef" value={v.transactionRef} onChange={(e) => set("transactionRef", e.target.value)} />
      </FormField>
      <FormField id="adminNote" label={t("adminNote")} optional>
        <Input id="adminNote" value={v.adminNote} onChange={(e) => set("adminNote", e.target.value)} />
      </FormField>
      <div className="flex items-start gap-3 sm:col-span-2">
        <Checkbox id="confirmed" checked={v.confirmed} onCheckedChange={(c) => set("confirmed", c === true)} />
        <div>
          <Label htmlFor="confirmed">{t("confirmedNow")}</Label>
          <p className="text-xs text-muted-foreground">{t("confirmedNowHint")}</p>
        </div>
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? tc("saving") : t("record")}</Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>{tc("cancel")}</Button>
      </div>
    </form>
  );
}
