"use client";

import { Eye, Printer, QrCode, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { CopyButton } from "@/components/admin/copy-button";
import { FormField, NativeSelect } from "@/components/admin/form-field";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  revealInvitationLinkAction,
  revokeInvitationAction,
  rotateInvitationTokenAction,
  setInvitationActiveAction,
  updateInvitationAction,
} from "@/server/actions/invitation.actions";

/** The link is hidden by default; revealing it decrypts the token server-side and is audited. */
export function LinkPanel({ invitationId, autoReveal = false }: { invitationId: string; autoReveal?: boolean }) {
  const t = useTranslations("Admin.invitations");
  const { run, pending } = useAction();
  const [url, setUrl] = useState<string | null>(null);
  const revealedOnce = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  // Right after creation, show the new link immediately (still audited server-side).
  useEffect(() => {
    if (!autoReveal || revealedOnce.current) return;
    revealedOnce.current = true;
    void run(() => revealInvitationLinkAction(invitationId), {
      refresh: false,
      onSuccess: (d) => {
        setUrl(d.url);
        // Drop ?new=1 so a reload does not reveal (and audit) again.
        router.replace(pathname, { scroll: false });
      },
    });
  }, [autoReveal, invitationId, run, router, pathname]);

  return (
    <Card className="border-soft-purple bg-lavender/40">
      <CardHeader>
        <CardTitle className="font-serif text-xl text-purple-deep">{autoReveal ? t("newLinkReady") : t("link")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {url ? (
          <>
            <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label={t("link")} className="bg-background font-mono text-xs" />
            <p className="text-xs text-muted-foreground">{t("shareHint")}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("linkHidden")}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {url ? (
            <CopyButton value={url} label={t("copyLink")} />
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => revealInvitationLinkAction(invitationId), { refresh: false, success: t("revealed"), onSuccess: (d) => setUrl(d.url) })}
            >
              <Eye aria-hidden /> {t("reveal")}
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <a href={`/api/admin/invitations/${invitationId}/qr?format=png`} download>
              <QrCode aria-hidden /> {t("qr")} · {t("downloadPng")}
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/admin/invitations/${invitationId}/qr?format=svg`} download>
              <QrCode aria-hidden /> {t("downloadSvg")}
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/admin/invitations/${invitationId}/print`} target="_blank" rel="noopener">
              <Printer aria-hidden /> {t("print")}
            </a>
          </Button>
          <ConfirmAction
            trigger={
              <Button variant="ghost" size="sm">
                <RefreshCw aria-hidden /> {t("rotate")}
              </Button>
            }
            title={t("rotate")}
            description={t("rotateConfirm")}
            confirmLabel={t("rotate")}
            destructive
            action={() => rotateInvitationTokenAction(invitationId)}
            success={t("rotated")}
            onSuccess={(d) => setUrl(d.url)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function InvitationActions({ invitationId, status }: { invitationId: string; status: "ACTIVE" | "INACTIVE" | "REVOKED" }) {
  const t = useTranslations("Admin.invitations");
  const tc = useTranslations("Admin.common");
  const { run, pending } = useAction();
  const [reason, setReason] = useState("");
  if (status === "REVOKED") return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl text-purple-deep">{tc("actions")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {status === "ACTIVE" ? (
          <ConfirmAction
            trigger={<Button variant="outline">{t("deactivate")}</Button>}
            title={t("deactivate")}
            description={t("deactivateConfirm")}
            confirmLabel={t("deactivate")}
            action={() => setInvitationActiveAction(invitationId, false)}
            success={t("deactivated")}
          />
        ) : (
          <Button variant="outline" disabled={pending} onClick={() => run(() => setInvitationActiveAction(invitationId, true), { success: t("activated") })}>
            {t("activate")}
          </Button>
        )}
        <ConfirmAction
          trigger={<Button variant="destructive">{t("revoke")}</Button>}
          title={t("revoke")}
          description={t("revokeConfirm")}
          confirmLabel={t("revoke")}
          destructive
          action={() => revokeInvitationAction(invitationId, reason)}
          success={t("revoked")}
        >
          <FormField id="revoke-reason" label={t("revokeReason")}>
            <Input id="revoke-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </FormField>
        </ConfirmAction>
      </CardContent>
    </Card>
  );
}

type SettingsDefaults = {
  id: string;
  capacity: string;
  allowUnnamedGuests: boolean;
  preferredLocale: "kh" | "en" | "";
  internalLabel: string;
  notes: string;
  rsvpDeadlineOverride: string;
};

export function InvitationSettingsForm({ defaults }: { defaults: SettingsDefaults }) {
  const t = useTranslations("Admin.invitations");
  const tc = useTranslations("Admin.common");
  const { run, pending } = useAction();
  const [v, setV] = useState(defaults);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof SettingsDefaults>(k: K, value: SettingsDefaults[K]) => setV((s) => ({ ...s, [k]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const res = await run(() => updateInvitationAction(v), { success: tc("saved") });
    if (!res.ok && res.fieldErrors) setErrors(res.fieldErrors);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl text-purple-deep">{t("settings")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <FormField id="capacity" label={t("capacity")} hint={t("capacityHint")} error={errors.capacity}>
            <Input id="capacity" type="number" min={1} max={50} value={v.capacity} onChange={(e) => set("capacity", e.target.value)} aria-invalid={!!errors.capacity} />
          </FormField>
          <FormField id="preferredLocale" label={t("preferredLocale")} optional>
            <NativeSelect id="preferredLocale" value={v.preferredLocale} onChange={(e) => set("preferredLocale", e.target.value as SettingsDefaults["preferredLocale"])}>
              <option value="">{t("defaultLocale")}</option>
              <option value="kh">ខ្មែរ</option>
              <option value="en">English</option>
            </NativeSelect>
          </FormField>
          <div className="flex items-start gap-3 sm:col-span-2">
            <Checkbox id="allowUnnamedGuests" checked={v.allowUnnamedGuests} onCheckedChange={(c) => set("allowUnnamedGuests", c === true)} />
            <div>
              <Label htmlFor="allowUnnamedGuests">{t("allowUnnamed")}</Label>
              <p className="text-xs text-muted-foreground">{t("allowUnnamedHint")}</p>
            </div>
          </div>
          <FormField id="rsvpDeadlineOverride" label={t("rsvpDeadline")} optional hint={t("rsvpDeadlineHint")} error={errors.rsvpDeadlineOverride}>
            <Input id="rsvpDeadlineOverride" type="datetime-local" value={v.rsvpDeadlineOverride} onChange={(e) => set("rsvpDeadlineOverride", e.target.value)} />
          </FormField>
          <FormField id="internalLabel" label={t("internalLabel")} optional hint={t("internalLabelHint")} error={errors.internalLabel}>
            <Input id="internalLabel" value={v.internalLabel} onChange={(e) => set("internalLabel", e.target.value)} />
          </FormField>
          <FormField id="notes" label={tc("notes")} optional hint={tc("notesHint")} className="sm:col-span-2">
            <Textarea id="notes" rows={2} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
          </FormField>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>{pending ? tc("saving") : tc("save")}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
