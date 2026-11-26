"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { FormField, NativeSelect } from "@/components/admin/form-field";
import { errorFor, type Loc, LocalizedField } from "@/components/admin/localized-field";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { eventSchema, PUBLISH } from "@/features/content/schemas";
import { deleteEventAction, saveEventAction } from "@/server/actions/content.actions";
import { fieldErrorsFromIssues } from "../content/zod-errors";

export type EventFormValues = {
  id?: string;
  title: Loc;
  description: Loc;
  startsAt: string;
  endsAt: string;
  locationId: string;
  dressCode: Loc;
  instructions: Loc;
  status: (typeof PUBLISH)[number];
};

export function EventForm({ initial, locations }: { initial: EventFormValues; locations: { id: string; label: string }[] }) {
  const t = useTranslations("Admin.events");
  const tc = useTranslations("Admin.common");
  const tcon = useTranslations("Admin.content");
  const router = useRouter();
  const { run, pending } = useAction();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof EventFormValues>(k: K, value: EventFormValues[K]) => setV((s) => ({ ...s, [k]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = eventSchema.safeParse(v);
    if (!parsed.success) return setErrors(fieldErrorsFromIssues(parsed.error.issues));
    setErrors({});
    const res = await run(() => saveEventAction(v), { success: tc("saved") });
    if (res.ok) router.push("/admin/events");
    else if (res.fieldErrors) setErrors(res.fieldErrors);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6 rounded-xl border border-border bg-background p-5">
      <LocalizedField id="title" label={t("eventTitle")} required hint={t("eventTitleHint")} value={v.title} onChange={(x) => set("title", x)} error={errorFor(errors, "title")} maxLength={120} />
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="startsAt" label={t("startsAt")} hint={t("timezoneHint")} error={errors.startsAt}>
          <Input id="startsAt" type="datetime-local" value={v.startsAt} onChange={(e) => set("startsAt", e.target.value)} aria-invalid={!!errors.startsAt} />
        </FormField>
        <FormField id="endsAt" label={t("endsAt")} optional error={errors.endsAt}>
          <Input id="endsAt" type="datetime-local" value={v.endsAt} onChange={(e) => set("endsAt", e.target.value)} aria-invalid={!!errors.endsAt} />
        </FormField>
        <FormField id="status" label={tc("status")}>
          <NativeSelect id="status" value={v.status} onChange={(e) => set("status", e.target.value as EventFormValues["status"])}>
            {PUBLISH.map((p) => <option key={p} value={p}>{tcon(`publish.${p}`)}</option>)}
          </NativeSelect>
        </FormField>
      </div>
      <FormField id="locationId" label={t("venue")} optional hint={locations.length === 0 ? t("noVenues") : undefined}>
        <NativeSelect id="locationId" value={v.locationId} onChange={(e) => set("locationId", e.target.value)}>
          <option value="">—</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </NativeSelect>
      </FormField>
      <LocalizedField id="description" label={t("description")} multiline rows={3} value={v.description} onChange={(x) => set("description", x)} error={errorFor(errors, "description")} maxLength={1000} />
      <LocalizedField id="dressCode" label={t("dressCode")} hint={t("dressCodeHint")} value={v.dressCode} onChange={(x) => set("dressCode", x)} error={errorFor(errors, "dressCode")} maxLength={200} />
      <LocalizedField id="instructions" label={t("instructions")} hint={t("instructionsHint")} multiline rows={2} value={v.instructions} onChange={(x) => set("instructions", x)} error={errorFor(errors, "instructions")} maxLength={600} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>{pending ? tc("saving") : tc("save")}</Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/events")}>{tc("cancel")}</Button>
        {v.id && (
          <ConfirmAction
            trigger={<Button type="button" variant="destructive" className="ml-auto">{tcon("delete")}</Button>}
            title={tcon("delete")}
            description={tcon("deleteConfirm")}
            confirmLabel={tcon("delete")}
            destructive
            action={() => deleteEventAction(v.id)}
            onSuccess={() => router.push("/admin/events")}
          />
        )}
      </div>
    </form>
  );
}
