"use client";

import { Pencil, Plus, QrCode, Landmark } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormField, NativeSelect } from "@/components/admin/form-field";
import { ImagePicker } from "@/components/admin/image-picker";
import { emptyLoc, errorFor, type Loc, LocalizedField } from "@/components/admin/localized-field";
import { StatusBadge } from "@/components/admin/status-badge";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCY_CODES, paymentMethodSchema } from "@/features/content/schemas";
import type { ImageRef } from "@/lib/storage";
import { savePaymentMethodAction } from "@/server/actions/interaction.actions";
import { fieldErrorsFromIssues } from "../content/zod-errors";

type PM = {
  id?: string;
  method: "KHQR" | "BANK_TRANSFER";
  label: Loc;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  currencies: ("USD" | "KHR")[];
  qrAssetId: string | null;
  qr: ImageRef | null;
  instructions: Loc;
  isActive: boolean;
};

const blank = (): PM => ({ method: "KHQR", label: emptyLoc(), bankName: "", accountHolder: "", accountNumber: "", currencies: ["USD", "KHR"], qrAssetId: null, qr: null, instructions: emptyLoc(), isActive: true });

export function PaymentMethodManager({ items }: { items: (PM & { id: string })[] }) {
  const t = useTranslations("Admin.payments");
  const tc = useTranslations("Admin.common");
  const [editing, setEditing] = useState<PM | null>(null);

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{t("verifyNote")}</p>
      {items.length === 0 && !editing && <p className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-muted-foreground">{t("empty")}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((m) => (
          <li key={m.id}>
            <Card>
              <CardContent className="flex items-center gap-4 pt-6">
                {m.qr ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                  <img src={m.qr.src} alt="" className="size-16 rounded-lg border border-border object-contain" />
                ) : (
                  <span className="flex size-16 items-center justify-center rounded-lg bg-lavender text-primary">
                    {m.method === "KHQR" ? <QrCode aria-hidden /> : <Landmark aria-hidden />}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-purple-deep">{m.label.kh || m.label.en}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`method.${m.method}`)} · {m.currencies.join(", ")}
                    {m.accountNumber && ` · ${m.accountNumber}`}
                  </p>
                  <StatusBadge tone={m.isActive ? "success" : "neutral"} className="mt-1">{m.isActive ? t("active") : t("inactive")}</StatusBadge>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label={tc("edit")} onClick={() => setEditing(m)}><Pencil /></Button>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
      {editing ? (
        <PaymentMethodForm key={editing.id ?? "new"} initial={editing} onDone={() => setEditing(null)} />
      ) : (
        <Button onClick={() => setEditing(blank())}><Plus aria-hidden /> {t("add")}</Button>
      )}
    </div>
  );
}

function PaymentMethodForm({ initial, onDone }: { initial: PM; onDone: () => void }) {
  const t = useTranslations("Admin.payments");
  const tc = useTranslations("Admin.common");
  const tv = useTranslations("Validation");
  const { run, pending } = useAction();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof PM>(k: K, value: PM[K]) => setV((s) => ({ ...s, [k]: value }));
  const errText = (k: string) => (errors[k] ? (tv.has(errors[k] as never) ? tv(errors[k] as never) : tv("invalid")) : undefined);

  async function save() {
    const { qr: _qr, ...input } = v;
    const parsed = paymentMethodSchema.safeParse(input);
    if (!parsed.success) return setErrors(fieldErrorsFromIssues(parsed.error.issues));
    setErrors({});
    const res = await run(() => savePaymentMethodAction(input), { success: tc("saved") });
    if (res.ok) onDone();
  }

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="pm-method" label={t("type")}>
            <NativeSelect id="pm-method" value={v.method} onChange={(e) => set("method", e.target.value as PM["method"])}>
              <option value="KHQR">{t("method.KHQR")}</option>
              <option value="BANK_TRANSFER">{t("method.BANK_TRANSFER")}</option>
            </NativeSelect>
          </FormField>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">{t("currencies")}</legend>
            <div className="flex gap-4 pt-2">
              {CURRENCY_CODES.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={v.currencies.includes(c)} onCheckedChange={(on) => set("currencies", on === true ? [...new Set([...v.currencies, c])] : v.currencies.filter((x) => x !== c))} />
                  {c}
                </label>
              ))}
            </div>
            {errors.currencies && <p className="text-xs text-destructive">{errText("currencies")}</p>}
          </fieldset>
        </div>
        <LocalizedField id="pm-label" label={t("label")} required hint={t("labelHint")} value={v.label} onChange={(x) => set("label", x)} error={errorFor(errors, "label")} maxLength={80} />
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="pm-bank" label={t("bankName")} optional error={errors.bankName}>
            <Input id="pm-bank" value={v.bankName} placeholder="ABA Bank" onChange={(e) => set("bankName", e.target.value)} />
          </FormField>
          <FormField id="pm-holder" label={t("accountHolder")} optional error={errors.accountHolder}>
            <Input id="pm-holder" value={v.accountHolder} onChange={(e) => set("accountHolder", e.target.value)} />
          </FormField>
          <FormField id="pm-number" label={t("accountNumber")} optional={v.method === "KHQR"} error={errors.accountNumber}>
            <Input id="pm-number" value={v.accountNumber} inputMode="numeric" onChange={(e) => set("accountNumber", e.target.value)} />
          </FormField>
        </div>
        <div>
          <ImagePicker label={t("qrImage")} purpose="KHQR_IMAGE" aspect="aspect-square" assetId={v.qrAssetId} preview={v.qr} onChange={(id, p) => setV((s) => ({ ...s, qrAssetId: id, qr: p }))} />
          {errors.qrAssetId && <p className="mt-1 text-xs text-destructive">{errText("qrAssetId")}</p>}
        </div>
        <LocalizedField id="pm-instr" label={t("instructions")} hint={t("instructionsHint")} multiline rows={2} value={v.instructions} onChange={(x) => set("instructions", x)} error={errorFor(errors, "instructions")} maxLength={600} />
        <div className="flex items-center gap-3">
          <Checkbox id="pm-active" checked={v.isActive} onCheckedChange={(c) => set("isActive", c === true)} />
          <Label htmlFor="pm-active">{t("showToGuests")}</Label>
        </div>
        <div className="flex gap-2">
          <Button disabled={pending} onClick={save}>{pending ? tc("saving") : tc("save")}</Button>
          <Button variant="ghost" onClick={onDone}>{tc("cancel")}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
