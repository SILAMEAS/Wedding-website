"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { FormField, NativeSelect } from "@/components/admin/form-field";
import { ImagePicker } from "@/components/admin/image-picker";
import { errorFor, type Loc, LocalizedField } from "@/components/admin/localized-field";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { locationSchema, PUBLISH } from "@/features/content/schemas";
import type { ImageRef } from "@/lib/storage";
import { deleteLocationAction, saveLocationAction } from "@/server/actions/content.actions";
import { fieldErrorsFromIssues } from "../content/zod-errors";

export type LocationFormValues = {
  id?: string;
  name: Loc;
  address: Loc;
  mapUrl: string;
  mapEmbed: string;
  latitude: string;
  longitude: string;
  parking: Loc;
  access: Loc;
  imageAssetId: string | null;
  status: (typeof PUBLISH)[number];
};

export function LocationForm({ initial, preview }: { initial: LocationFormValues; preview: ImageRef | null }) {
  const t = useTranslations("Admin.locations");
  const tc = useTranslations("Admin.common");
  const tcon = useTranslations("Admin.content");
  const tv = useTranslations("Validation");
  const router = useRouter();
  const { run, pending } = useAction();
  const [v, setV] = useState(initial);
  const [pv, setPv] = useState(preview);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof LocationFormValues>(k: K, value: LocationFormValues[K]) => setV((s) => ({ ...s, [k]: value }));
  const err = (k: string) => (errors[k] ? (tv.has(errors[k] as never) ? tv(errors[k] as never) : tv("invalid")) : undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = locationSchema.safeParse(v);
    if (!parsed.success) return setErrors(fieldErrorsFromIssues(parsed.error.issues));
    setErrors({});
    const res = await run(() => saveLocationAction(v), { success: tc("saved") });
    if (res.ok) router.push("/admin/locations");
    else if (res.fieldErrors) setErrors(res.fieldErrors);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6 rounded-xl border border-border bg-background p-5">
      <LocalizedField id="name" label={t("name")} required value={v.name} onChange={(x) => set("name", x)} error={errorFor(errors, "name")} maxLength={120} />
      <LocalizedField id="address" label={t("address")} required multiline rows={2} value={v.address} onChange={(x) => set("address", x)} error={errorFor(errors, "address")} maxLength={400} />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="mapUrl" label={t("mapUrl")} optional hint={t("mapUrlHint")} error={errors.mapUrl}>
          <Input id="mapUrl" type="url" inputMode="url" placeholder="https://maps.app.goo.gl/…" value={v.mapUrl} onChange={(e) => set("mapUrl", e.target.value)} />
        </FormField>
        <FormField id="status" label={tc("status")}>
          <NativeSelect id="status" value={v.status} onChange={(e) => set("status", e.target.value as LocationFormValues["status"])}>
            {PUBLISH.map((p) => <option key={p} value={p}>{tcon(`publish.${p}`)}</option>)}
          </NativeSelect>
        </FormField>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="mapEmbed" className="text-sm font-medium">
          {t("mapEmbed")} <span className="font-normal text-muted-foreground">({tc("optional")})</span>
        </label>
        <Textarea id="mapEmbed" rows={3} className="font-mono text-xs" placeholder='<iframe src="https://www.google.com/maps/embed?pb=…"></iframe>' value={v.mapEmbed} onChange={(e) => set("mapEmbed", e.target.value)} aria-invalid={!!errors.mapEmbed} />
        {errors.mapEmbed ? <p className="text-xs text-destructive">{err("mapEmbed")}</p> : <p className="text-xs text-muted-foreground">{t("mapEmbedHint")}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="latitude" label={t("latitude")} optional error={errors.latitude}>
          <Input id="latitude" inputMode="decimal" placeholder="11.5564" value={v.latitude} onChange={(e) => set("latitude", e.target.value)} />
        </FormField>
        <FormField id="longitude" label={t("longitude")} optional error={errors.longitude}>
          <Input id="longitude" inputMode="decimal" placeholder="104.9282" value={v.longitude} onChange={(e) => set("longitude", e.target.value)} />
        </FormField>
      </div>
      <LocalizedField id="parking" label={t("parking")} multiline rows={2} value={v.parking} onChange={(x) => set("parking", x)} error={errorFor(errors, "parking")} maxLength={600} />
      <LocalizedField id="access" label={t("access")} multiline rows={2} value={v.access} onChange={(x) => set("access", x)} error={errorFor(errors, "access")} maxLength={600} />
      <ImagePicker label={tcon("image")} assetId={v.imageAssetId} preview={pv} onChange={(id, p) => { set("imageAssetId", id); setPv(p); }} />

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>{pending ? tc("saving") : tc("save")}</Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/locations")}>{tc("cancel")}</Button>
        {v.id && (
          <ConfirmAction
            trigger={<Button type="button" variant="destructive" className="ml-auto">{tcon("delete")}</Button>}
            title={tcon("delete")}
            description={t("deleteConfirm")}
            confirmLabel={tcon("delete")}
            destructive
            action={() => deleteLocationAction(v.id)}
            onSuccess={() => router.push("/admin/locations")}
          />
        )}
      </div>
    </form>
  );
}
