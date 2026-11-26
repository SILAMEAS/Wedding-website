"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { FormField, NativeSelect } from "@/components/admin/form-field";
import { emptyLoc, errorFor, type Loc, LocalizedField } from "@/components/admin/localized-field";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ALBUM_VISIBILITY, albumSchema } from "@/features/content/schemas";
import { archiveAlbumAction, saveAlbumAction } from "@/server/actions/gallery.actions";
import { fieldErrorsFromIssues } from "../content/zod-errors";

type Album = { id?: string; title: Loc; description: Loc; visibility: (typeof ALBUM_VISIBILITY)[number] };

export function AlbumForm({ initial, onSaved }: { initial: Album; onSaved?: (id: string) => void }) {
  const t = useTranslations("Admin.gallery");
  const tc = useTranslations("Admin.common");
  const { run, pending } = useAction();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = albumSchema.safeParse(v);
    if (!parsed.success) return setErrors(fieldErrorsFromIssues(parsed.error.issues));
    setErrors({});
    await run(() => saveAlbumAction(v), { success: tc("saved"), onSuccess: (d) => onSaved?.(d.id) });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <LocalizedField id="album-title" label={t("albumTitle")} required value={v.title} onChange={(x) => setV({ ...v, title: x })} error={errorFor(errors, "title")} maxLength={120} />
      <LocalizedField id="album-desc" label={t("albumDescription")} multiline rows={2} value={v.description} onChange={(x) => setV({ ...v, description: x })} error={errorFor(errors, "description")} maxLength={600} />
      <FormField id="album-vis" label={t("visibilityLabel")} hint={t(`visibilityHint.${v.visibility}`)}>
        <NativeSelect id="album-vis" value={v.visibility} onChange={(e) => setV({ ...v, visibility: e.target.value as Album["visibility"] })} className="max-w-xs">
          {ALBUM_VISIBILITY.map((x) => <option key={x} value={x}>{t(`visibility.${x}`)}</option>)}
        </NativeSelect>
      </FormField>
      <Button type="submit" disabled={pending}>{pending ? tc("saving") : tc("save")}</Button>
    </form>
  );
}

export function NewAlbumButton() {
  const t = useTranslations("Admin.gallery");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus aria-hidden /> {t("newAlbum")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("newAlbum")}</DialogTitle>
        </DialogHeader>
        <AlbumForm
          initial={{ title: emptyLoc(), description: emptyLoc(), visibility: "UNPUBLISHED" }}
          onSaved={(id) => {
            setOpen(false);
            router.push(`/admin/gallery/${id}`);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export function ArchiveAlbumButton({ id }: { id: string }) {
  const t = useTranslations("Admin.gallery");
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={<Button variant="ghost">{t("archiveAlbum")}</Button>}
      title={t("archiveAlbum")}
      description={t("archiveConfirm")}
      confirmLabel={t("archiveAlbum")}
      destructive
      action={() => archiveAlbumAction(id)}
      onSuccess={() => router.push("/admin/gallery")}
    />
  );
}
