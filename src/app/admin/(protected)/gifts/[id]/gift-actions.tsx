"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormField, NativeSelect } from "@/components/admin/form-field";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cancelGiftAction, correctGiftAction, rejectGiftAction, reopenGiftAction, verifyGiftAction } from "@/server/actions/gift-admin.actions";

type Gift = {
  id: string;
  version: number;
  status: "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED" | "CANCELLED";
  currency: "USD" | "KHR";
  method: "KHQR" | "BANK_TRANSFER" | "CASH" | "OTHER";
  donorName: string;
  transactionRef: string;
  notifiedAmount: string;
  receivedAmount: string;
};

/** Status-dependent actions. Every change is recorded in the gift's permanent history. */
export function GiftActions({ gift }: { gift: Gift }) {
  const t = useTranslations("Admin.gifts");
  const tc = useTranslations("Admin.common");
  const { run, pending } = useAction();
  const [received, setReceived] = useState(gift.notifiedAmount);
  const [receivedOn, setReceivedOn] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"none" | "reject" | "cancel" | "reopen" | "correct">("none");
  const [fix, setFix] = useState({ currency: gift.currency, receivedAmount: gift.receivedAmount, method: gift.method, donorName: gift.donorName, transactionRef: gift.transactionRef });

  const base = { id: gift.id, version: gift.version };
  const reasonBox = (
    <FormField id="reason" label={t("reason")} hint={t("reasonHint")}>
      <Textarea id="reason" rows={2} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
    </FormField>
  );

  return (
    <Card className="h-fit">
      <CardHeader><CardTitle className="font-serif text-xl text-purple-deep">{tc("actions")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {gift.status === "PENDING_VERIFICATION" && mode === "none" && (
          <>
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{t("checkBankFirst")}</p>
            <FormField id="received" label={t("receivedAmountLabel", { currency: gift.currency })}>
              <Input id="received" inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value)} />
            </FormField>
            <FormField id="receivedOn" label={t("receivedDate")} optional>
              <Input id="receivedOn" type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} />
            </FormField>
            <FormField id="note" label={t("adminNote")} optional>
              <Input id="note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
            </FormField>
            <Button className="w-full" disabled={pending || !received.trim()} onClick={() => run(() => verifyGiftAction({ ...base, receivedAmount: received, receivedOn, adminNote: note }), { success: t("verified") })}>
              {t("verify")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setMode("reject")}>{t("reject")}</Button>
              <Button variant="ghost" className="flex-1" onClick={() => setMode("cancel")}>{t("cancelGift")}</Button>
            </div>
          </>
        )}

        {(mode === "reject" || mode === "cancel" || mode === "reopen") && (
          <>
            <p className="text-sm">{t(`${mode}Explain`)}</p>
            {reasonBox}
            <div className="flex gap-2">
              <Button
                variant={mode === "reopen" ? "default" : "destructive"}
                disabled={pending || reason.trim().length < 3}
                onClick={() => {
                  const action = mode === "reject" ? rejectGiftAction : mode === "cancel" ? cancelGiftAction : reopenGiftAction;
                  return run(() => action({ ...base, reason }), { success: tc("saved"), onSuccess: () => { setMode("none"); setReason(""); } });
                }}
              >
                {t(mode === "cancel" ? "cancelGift" : mode)}
              </Button>
              <Button variant="ghost" onClick={() => setMode("none")}>{tc("cancel")}</Button>
            </div>
          </>
        )}

        {gift.status === "VERIFIED" && mode === "none" && (
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => setMode("correct")}>{t("correct")}</Button>
            <Button variant="ghost" onClick={() => setMode("reopen")}>{t("reopen")}</Button>
          </div>
        )}
        {gift.status === "REJECTED" && mode === "none" && <Button variant="outline" className="w-full" onClick={() => setMode("reopen")}>{t("reopen")}</Button>}
        {gift.status === "CANCELLED" && <p className="text-sm text-muted-foreground">{t("cancelledNote")}</p>}

        {mode === "correct" && (
          <>
            <p className="text-sm">{t("correctExplain")}</p>
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <FormField id="fix-amount" label={t("received")}>
                <Input id="fix-amount" inputMode="decimal" value={fix.receivedAmount} onChange={(e) => setFix({ ...fix, receivedAmount: e.target.value })} />
              </FormField>
              <FormField id="fix-currency" label={t("currency")}>
                <NativeSelect id="fix-currency" value={fix.currency} onChange={(e) => setFix({ ...fix, currency: e.target.value as Gift["currency"] })}>
                  <option value="USD">USD</option>
                  <option value="KHR">KHR</option>
                </NativeSelect>
              </FormField>
            </div>
            <FormField id="fix-method" label={t("methodLabel")}>
              <NativeSelect id="fix-method" value={fix.method} onChange={(e) => setFix({ ...fix, method: e.target.value as Gift["method"] })}>
                {(["KHQR", "BANK_TRANSFER", "CASH", "OTHER"] as const).map((m) => <option key={m} value={m}>{t(`method.${m}`)}</option>)}
              </NativeSelect>
            </FormField>
            <FormField id="fix-donor" label={t("donor")}>
              <Input id="fix-donor" value={fix.donorName} onChange={(e) => setFix({ ...fix, donorName: e.target.value })} />
            </FormField>
            <FormField id="fix-ref" label={t("reference")} optional>
              <Input id="fix-ref" value={fix.transactionRef} onChange={(e) => setFix({ ...fix, transactionRef: e.target.value })} />
            </FormField>
            {reasonBox}
            <div className="flex gap-2">
              <Button disabled={pending || reason.trim().length < 3} onClick={() => run(() => correctGiftAction({ ...base, ...fix, reason }), { success: tc("saved"), onSuccess: () => { setMode("none"); setReason(""); } })}>
                {t("saveCorrection")}
              </Button>
              <Button variant="ghost" onClick={() => setMode("none")}>{tc("cancel")}</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
