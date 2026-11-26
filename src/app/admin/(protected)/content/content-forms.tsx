"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormField } from "@/components/admin/form-field";
import { ImagePicker } from "@/components/admin/image-picker";
import { MusicPicker } from "@/components/admin/music-picker";
import { emptyLoc, errorFor, type Loc, LocalizedField } from "@/components/admin/localized-field";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { basicsSchema, contactsSchema, guestSettingsSchema, SECTION_KEYS, type SectionsInput } from "@/features/content/schemas";
import type { ImageRef } from "@/lib/storage";
import { updateBasicsAction, updateContactsAction, updateSectionsAction } from "@/server/actions/content.actions";
import { updateGuestSettingsAction } from "@/server/actions/interaction.actions";
import { fieldErrorsFromIssues } from "./zod-errors";

type Basics = { groomName: Loc; brideName: Loc; weddingDate: string; invitationMessage: Loc; postWeddingMessage: Loc; heroAssetId: string | null; musicAssetId: string | null };

export function BasicsForm({ defaults, heroPreview, musicPreview }: { defaults: Basics; heroPreview: ImageRef | null; musicPreview: string | null }) {
  const t = useTranslations("Admin.content");
  const tc = useTranslations("Admin.common");
  const { run, pending } = useAction();
  const [v, setV] = useState(defaults);
  const [preview, setPreview] = useState(heroPreview);
  const [music, setMusic] = useState(musicPreview);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof Basics>(k: K, value: Basics[K]) => setV((s) => ({ ...s, [k]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = basicsSchema.safeParse(v);
    if (!parsed.success) return setErrors(fieldErrorsFromIssues(parsed.error.issues));
    setErrors({});
    const res = await run(() => updateBasicsAction(v), { success: tc("saved") });
    if (!res.ok && res.fieldErrors) setErrors(res.fieldErrors);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl text-purple-deep">{t("basics")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <LocalizedField id="groomName" label={t("groomName")} required value={v.groomName} onChange={(x) => set("groomName", x)} error={errorFor(errors, "groomName")} maxLength={80} />
            <LocalizedField id="brideName" label={t("brideName")} required value={v.brideName} onChange={(x) => set("brideName", x)} error={errorFor(errors, "brideName")} maxLength={80} />
          </div>
          <FormField id="weddingDate" label={t("weddingDate")} optional hint={t("weddingDateHint")} error={errors.weddingDate}>
            <Input id="weddingDate" type="datetime-local" value={v.weddingDate} onChange={(e) => set("weddingDate", e.target.value)} className="max-w-xs" />
          </FormField>
          <LocalizedField id="invitationMessage" label={t("invitationMessage")} hint={t("invitationMessageHint")} multiline rows={3} value={v.invitationMessage} onChange={(x) => set("invitationMessage", x)} error={errorFor(errors, "invitationMessage")} maxLength={600} />
          <LocalizedField id="postWeddingMessage" label={t("postWeddingMessage")} hint={t("postWeddingMessageHint")} multiline rows={2} value={v.postWeddingMessage} onChange={(x) => set("postWeddingMessage", x)} error={errorFor(errors, "postWeddingMessage")} maxLength={600} />
          <ImagePicker
            label={t("heroImage")}
            assetId={v.heroAssetId}
            preview={preview}
            onChange={(id, p) => {
              set("heroAssetId", id);
              setPreview(p);
            }}
          />
          <MusicPicker assetId={v.musicAssetId} src={music} onChange={(id, src) => { set("musicAssetId", id); setMusic(src); }} />
          <Button type="submit" disabled={pending}>{pending ? tc("saving") : tc("save")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function SectionsForm({ defaults }: { defaults: SectionsInput }) {
  const t = useTranslations("Admin.content");
  const tc = useTranslations("Admin.common");
  const { run, pending } = useAction();
  const [v, setV] = useState(defaults);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl text-purple-deep">{t("sections")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("sectionsHint")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {SECTION_KEYS.map((k) => (
            <div key={k} className="flex items-center gap-3">
              <Checkbox id={`sec-${k}`} checked={v[k]} onCheckedChange={(c) => setV((s) => ({ ...s, [k]: c === true }))} />
              <Label htmlFor={`sec-${k}`}>{t(`section.${k}`)}</Label>
            </div>
          ))}
        </div>
        <Button disabled={pending} onClick={() => run(() => updateSectionsAction(v), { success: tc("saved") })}>
          {pending ? tc("saving") : tc("save")}
        </Button>
      </CardContent>
    </Card>
  );
}

type Contact = { label: Loc; phone: string; telegram: string };

export function ContactsForm({ defaults }: { defaults: Contact[] }) {
  const t = useTranslations("Admin.content");
  const tc = useTranslations("Admin.common");
  const tv = useTranslations("Validation");
  const { run, pending } = useAction();
  const [list, setList] = useState<Contact[]>(defaults);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = (i: number, c: Partial<Contact>) => setList((l) => l.map((x, j) => (j === i ? { ...x, ...c } : x)));

  async function save() {
    const input = { contacts: list };
    const parsed = contactsSchema.safeParse(input);
    if (!parsed.success) return setErrors(fieldErrorsFromIssues(parsed.error.issues));
    setErrors({});
    await run(() => updateContactsAction(input), { success: tc("saved") });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl text-purple-deep">{t("contacts")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("contactsHint")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {list.map((c, i) => (
          <div key={i} className="grid gap-3 rounded-xl border border-border p-4 lg:grid-cols-[2fr_1fr_1fr_auto]">
            <LocalizedField id={`contact-${i}-label`} label={t("contactLabel")} required value={c.label} onChange={(x) => update(i, { label: x })} error={errorFor(errors, `contacts.${i}.label`)} maxLength={60} />
            <FormField id={`contact-${i}-phone`} label={t("phone")} error={errors[`contacts.${i}.phone`]}>
              <Input id={`contact-${i}-phone`} type="tel" value={c.phone} onChange={(e) => update(i, { phone: e.target.value })} />
            </FormField>
            <FormField id={`contact-${i}-tg`} label="Telegram" optional>
              <Input id={`contact-${i}-tg`} value={c.telegram} placeholder="@username" onChange={(e) => update(i, { telegram: e.target.value })} />
            </FormField>
            <Button type="button" variant="ghost" size="icon" aria-label={t("removeContact")} className="self-end" onClick={() => setList((l) => l.filter((_, j) => j !== i))}>
              <Trash2 />
            </Button>
          </div>
        ))}
        {errors.contacts && <p className="text-xs text-destructive">{tv("invalid")}</p>}
        <div className="flex gap-2">
          {list.length < 6 && (
            <Button type="button" variant="outline" onClick={() => setList((l) => [...l, { label: emptyLoc(), phone: "", telegram: "" }])}>
              <Plus aria-hidden /> {t("addContact")}
            </Button>
          )}
          <Button disabled={pending} onClick={save}>{pending ? tc("saving") : tc("save")}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

type GuestSettings = { rsvpDeadline: string; rsvpAllowMaybe: boolean; wishesPublicEnabled: boolean; giftEvidenceEnabled: boolean; giftThankYou: Loc };

export function GuestSettingsForm({ defaults }: { defaults: GuestSettings }) {
  const t = useTranslations("Admin.content");
  const tc = useTranslations("Admin.common");
  const { run, pending } = useAction();
  const [v, setV] = useState(defaults);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toggle = (k: "rsvpAllowMaybe" | "wishesPublicEnabled" | "giftEvidenceEnabled") => (c: boolean | "indeterminate") => setV((s) => ({ ...s, [k]: c === true }));

  async function save() {
    const parsed = guestSettingsSchema.safeParse(v);
    if (!parsed.success) return setErrors(fieldErrorsFromIssues(parsed.error.issues));
    setErrors({});
    await run(() => updateGuestSettingsAction(v), { success: tc("saved") });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl text-purple-deep">{t("guestInteractions")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <FormField id="rsvpDeadline" label={t("rsvpDeadline")} optional hint={t("rsvpDeadlineHint")} error={errors.rsvpDeadline}>
          <Input id="rsvpDeadline" type="datetime-local" className="max-w-xs" value={v.rsvpDeadline} onChange={(e) => setV({ ...v, rsvpDeadline: e.target.value })} />
        </FormField>
        {(["rsvpAllowMaybe", "wishesPublicEnabled", "giftEvidenceEnabled"] as const).map((k) => (
          <div key={k} className="flex items-start gap-3">
            <Checkbox id={k} checked={v[k]} onCheckedChange={toggle(k)} />
            <div>
              <Label htmlFor={k}>{t(k)}</Label>
              <p className="text-xs text-muted-foreground">{t(`${k}Hint`)}</p>
            </div>
          </div>
        ))}
        <LocalizedField id="giftThankYou" label={t("giftThankYou")} hint={t("giftThankYouHint")} multiline rows={2} value={v.giftThankYou} onChange={(x) => setV({ ...v, giftThankYou: x })} error={errorFor(errors, "giftThankYou")} maxLength={600} />
        <Button disabled={pending} onClick={save}>{pending ? tc("saving") : tc("save")}</Button>
      </CardContent>
    </Card>
  );
}
