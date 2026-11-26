"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { FormField, NativeSelect } from "@/components/admin/form-field";
import { ImagePicker } from "@/components/admin/image-picker";
import { emptyLoc, errorFor, type Loc, LocalizedField } from "@/components/admin/localized-field";
import { StatusBadge } from "@/components/admin/status-badge";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { milestoneSchema, PUBLISH, storySchema } from "@/features/content/schemas";
import type { ImageRef } from "@/lib/storage";
import { deleteMilestoneAction, moveContentAction, saveMilestoneAction, updateStoryAction } from "@/server/actions/content.actions";
import { fieldErrorsFromIssues } from "../zod-errors";

type Story = {
  groomIntro: Loc;
  brideIntro: Loc;
  howWeMet: Loc;
  journey: Loc;
  engagement: Loc;
  groomPortraitAssetId: string | null;
  bridePortraitAssetId: string | null;
};

export function StoryForm({ defaults, previews }: { defaults: Story; previews: { groom: ImageRef | null; bride: ImageRef | null } }) {
  const t = useTranslations("Admin.content");
  const tc = useTranslations("Admin.common");
  const { run, pending } = useAction();
  const [v, setV] = useState(defaults);
  const [pv, setPv] = useState(previews);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof Story>(k: K, value: Story[K]) => setV((s) => ({ ...s, [k]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = storySchema.safeParse(v);
    if (!parsed.success) return setErrors(fieldErrorsFromIssues(parsed.error.issues));
    setErrors({});
    await run(() => updateStoryAction(v), { success: tc("saved") });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl text-purple-deep">{t("coupleStory")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <ImagePicker label={t("groomPortrait")} aspect="aspect-[3/4]" assetId={v.groomPortraitAssetId} preview={pv.groom} onChange={(id, p) => { set("groomPortraitAssetId", id); setPv((x) => ({ ...x, groom: p })); }} />
            <ImagePicker label={t("bridePortrait")} aspect="aspect-[3/4]" assetId={v.bridePortraitAssetId} preview={pv.bride} onChange={(id, p) => { set("bridePortraitAssetId", id); setPv((x) => ({ ...x, bride: p })); }} />
          </div>
          {(["groomIntro", "brideIntro", "howWeMet", "journey", "engagement"] as const).map((k) => (
            <LocalizedField key={k} id={k} label={t(k)} multiline rows={k.endsWith("Intro") ? 3 : 5} value={v[k]} onChange={(x) => set(k, x)} error={errorFor(errors, k)} maxLength={k.endsWith("Intro") ? 2000 : 3000} />
          ))}
          <Button type="submit" disabled={pending}>{pending ? tc("saving") : tc("save")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

type Milestone = { id?: string; occurredOn: string; title: Loc; body: Loc; imageAssetId: string | null; preview: ImageRef | null; status: (typeof PUBLISH)[number] };

export function MilestoneManager({ items }: { items: (Milestone & { id: string })[] }) {
  const t = useTranslations("Admin.content");
  const tc = useTranslations("Admin.common");
  const { run, pending } = useAction();
  const [editing, setEditing] = useState<Milestone | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl text-purple-deep">{t("milestones")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("milestonesHint")}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y divide-border rounded-xl border border-border">
          {items.length === 0 && <li className="p-4 text-sm text-muted-foreground">{tc("noResults")}</li>}
          {items.map((m, i) => (
            <li key={m.id} className="flex items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.title.kh || m.title.en}</p>
                <p className="text-xs text-muted-foreground">{m.occurredOn || "—"}</p>
              </div>
              <StatusBadge tone={m.status === "PUBLISHED" ? "success" : "neutral"}>{t(`publish.${m.status}`)}</StatusBadge>
              <Button variant="ghost" size="icon-sm" aria-label={t("moveUp")} disabled={pending || i === 0} onClick={() => run(() => moveContentAction({ model: "storyMilestone", id: m.id, direction: "up" }))}><ArrowUp /></Button>
              <Button variant="ghost" size="icon-sm" aria-label={t("moveDown")} disabled={pending || i === items.length - 1} onClick={() => run(() => moveContentAction({ model: "storyMilestone", id: m.id, direction: "down" }))}><ArrowDown /></Button>
              <Button variant="ghost" size="icon-sm" aria-label={tc("edit")} onClick={() => setEditing(m)}><Pencil /></Button>
              <ConfirmAction
                trigger={<Button variant="ghost" size="icon-sm" aria-label={t("delete")}><Trash2 /></Button>}
                title={t("delete")}
                description={t("deleteConfirm")}
                confirmLabel={t("delete")}
                destructive
                action={() => deleteMilestoneAction(m.id)}
              />
            </li>
          ))}
        </ul>
        {editing ? (
          <MilestoneForm key={editing.id ?? "new"} initial={editing} onDone={() => setEditing(null)} />
        ) : (
          <Button variant="outline" onClick={() => setEditing({ occurredOn: "", title: emptyLoc(), body: emptyLoc(), imageAssetId: null, preview: null, status: "PUBLISHED" })}>
            <Plus aria-hidden /> {t("addMilestone")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function MilestoneForm({ initial, onDone }: { initial: Milestone; onDone: () => void }) {
  const t = useTranslations("Admin.content");
  const tc = useTranslations("Admin.common");
  const { run, pending } = useAction();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save() {
    const input = { id: v.id, occurredOn: v.occurredOn, title: v.title, body: v.body, imageAssetId: v.imageAssetId, status: v.status };
    const parsed = milestoneSchema.safeParse(input);
    if (!parsed.success) return setErrors(fieldErrorsFromIssues(parsed.error.issues));
    const res = await run(() => saveMilestoneAction(input), { success: tc("saved") });
    if (res.ok) onDone();
  }

  return (
    <div className="space-y-4 rounded-xl border border-soft-purple bg-lavender/30 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="ms-date" label={t("date")} optional error={errors.occurredOn}>
          <Input id="ms-date" type="date" value={v.occurredOn} onChange={(e) => setV({ ...v, occurredOn: e.target.value })} />
        </FormField>
        <FormField id="ms-status" label={tc("status")}>
          <NativeSelect id="ms-status" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as Milestone["status"] })}>
            {PUBLISH.map((p) => <option key={p} value={p}>{t(`publish.${p}`)}</option>)}
          </NativeSelect>
        </FormField>
      </div>
      <LocalizedField id="ms-title" label={t("milestoneTitle")} required value={v.title} onChange={(x) => setV({ ...v, title: x })} error={errorFor(errors, "title")} maxLength={120} />
      <LocalizedField id="ms-body" label={t("milestoneBody")} multiline rows={3} value={v.body} onChange={(x) => setV({ ...v, body: x })} error={errorFor(errors, "body")} maxLength={1000} />
      <ImagePicker label={t("image")} assetId={v.imageAssetId} preview={v.preview} onChange={(id, p) => setV({ ...v, imageAssetId: id, preview: p })} />
      <div className="flex gap-2">
        <Button disabled={pending} onClick={save}>{pending ? tc("saving") : tc("save")}</Button>
        <Button variant="ghost" onClick={onDone}>{tc("cancel")}</Button>
      </div>
    </div>
  );
}
