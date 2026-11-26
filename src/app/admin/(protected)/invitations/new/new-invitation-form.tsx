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
import { Textarea } from "@/components/ui/textarea";
import { createInvitationAction } from "@/server/actions/invitation.actions";

type Option = { id: string; label: string };

export function NewInvitationForm({
  guests,
  groups,
  initialType,
  initialGuestId,
  initialGroupId,
}: {
  guests: Option[];
  groups: (Option & { members: number })[];
  initialType: "INDIVIDUAL" | "FAMILY";
  initialGuestId?: string;
  initialGroupId?: string;
}) {
  const t = useTranslations("Admin.invitations");
  const tc = useTranslations("Admin.common");
  const router = useRouter();
  const { run, pending } = useAction();
  const [type, setType] = useState(initialType);
  const [guestId, setGuestId] = useState(initialGuestId ?? "");
  const [groupId, setGroupId] = useState(initialGroupId ?? "");
  const selectedGroup = groups.find((g) => g.id === groupId);
  const [capacity, setCapacity] = useState<string>(initialGroupId ? String(selectedGroup?.members ?? 1) : "1");
  const [allowUnnamed, setAllowUnnamed] = useState(false);
  const [preferredLocale, setPreferredLocale] = useState("");
  const [internalLabel, setInternalLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function pickGroup(id: string) {
    setGroupId(id);
    const g = groups.find((x) => x.id === id);
    if (g) setCapacity(String(g.members));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const common = { capacity, allowUnnamedGuests: allowUnnamed, preferredLocale, internalLabel, notes };
    const input = type === "INDIVIDUAL" ? { type, guestId, ...common } : { type, groupId, ...common };
    const res = await run(() => createInvitationAction(input), {
      success: t("created"),
      onSuccess: (d) => router.push(`/admin/invitations/${d.invitationId}?new=1`),
    });
    if (!res.ok && res.fieldErrors) setErrors(res.fieldErrors);
  }

  const owners = type === "INDIVIDUAL" ? guests : groups;

  return (
    <form onSubmit={submit} noValidate className="grid max-w-2xl gap-5 rounded-xl border border-border bg-background p-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("type")}</legend>
        <div className="inline-flex rounded-lg bg-muted p-0.5 text-sm">
          {(["INDIVIDUAL", "FAMILY"] as const).map((v) => (
            <label key={v} className={type === v ? "cursor-pointer rounded-md bg-background px-4 py-1.5 shadow-xs" : "cursor-pointer px-4 py-1.5 text-muted-foreground"}>
              <input type="radio" name="type" value={v} checked={type === v} onChange={() => setType(v)} className="sr-only" />
              {t(v)}
            </label>
          ))}
        </div>
      </fieldset>

      {owners.length === 0 ? (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{type === "INDIVIDUAL" ? t("noGuests") : t("noGroups")}</p>
      ) : type === "INDIVIDUAL" ? (
        <FormField id="guestId" label={t("chooseGuest")} error={errors.guestId}>
          <NativeSelect id="guestId" value={guestId} onChange={(e) => setGuestId(e.target.value)} aria-invalid={!!errors.guestId}>
            <option value="">—</option>
            {guests.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </NativeSelect>
        </FormField>
      ) : (
        <FormField id="groupId" label={t("chooseGroup")} error={errors.groupId}>
          <NativeSelect id="groupId" value={groupId} onChange={(e) => pickGroup(e.target.value)} aria-invalid={!!errors.groupId}>
            <option value="">—</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.label} ({g.members})</option>)}
          </NativeSelect>
        </FormField>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="capacity" label={t("capacity")} hint={t("capacityHint")} error={errors.capacity}>
          <Input id="capacity" type="number" min={1} max={50} inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} aria-invalid={!!errors.capacity} />
        </FormField>
        <FormField id="preferredLocale" label={t("preferredLocale")} optional>
          <NativeSelect id="preferredLocale" value={preferredLocale} onChange={(e) => setPreferredLocale(e.target.value)}>
            <option value="">{t("defaultLocale")}</option>
            <option value="kh">ខ្មែរ</option>
            <option value="en">English</option>
          </NativeSelect>
        </FormField>
      </div>

      <div className="flex items-start gap-3">
        <Checkbox id="allowUnnamed" checked={allowUnnamed} onCheckedChange={(v) => setAllowUnnamed(v === true)} />
        <div>
          <Label htmlFor="allowUnnamed">{t("allowUnnamed")}</Label>
          <p className="text-xs text-muted-foreground">{t("allowUnnamedHint")}</p>
        </div>
      </div>

      <FormField id="internalLabel" label={t("internalLabel")} optional hint={t("internalLabelHint")} error={errors.internalLabel}>
        <Input id="internalLabel" value={internalLabel} onChange={(e) => setInternalLabel(e.target.value)} />
      </FormField>
      <FormField id="notes" label={tc("notes")} optional hint={tc("notesHint")} error={errors.notes}>
        <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormField>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || owners.length === 0 || (type === "INDIVIDUAL" ? !guestId : !groupId)}>
          {pending ? tc("saving") : tc("create")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>{tc("cancel")}</Button>
      </div>
    </form>
  );
}
