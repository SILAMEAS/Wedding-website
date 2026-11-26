"use client";

import { ArrowLeft, ArrowRight, Pencil, Star, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { useErrorText } from "@/components/admin/error-text";
import { ACCEPTED_IMAGES, MAX_UPLOAD_MB, uploadImageFile } from "@/components/admin/image-picker";
import { type Loc, LocalizedField } from "@/components/admin/localized-field";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addPhotosAction, deletePhotoAction, movePhotoAction, setCoverAction, updatePhotoAction } from "@/server/actions/gallery.actions";

type Photo = { id: string; src: string; caption: Loc; alt: Loc };

export function PhotoManager({ albumId, coverPhotoId, photos }: { albumId: string; coverPhotoId: string | null; photos: Photo[] }) {
  const t = useTranslations("Admin.gallery");
  const errorText = useErrorText();
  const router = useRouter();
  const inputId = useId();
  const { run, pending } = useAction();
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [editing, setEditing] = useState<Photo | null>(null);

  /** Upload files one by one (keeps memory low on phones), then attach them in one action. */
  async function uploadMany(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, 50);
    const ids: string[] = [];
    let failed = 0;
    setProgress({ done: 0, total: list.length, failed: 0 });
    for (const file of list) {
      try {
        ids.push((await uploadImageFile(file, "GALLERY_PHOTO")).assetId);
      } catch (e) {
        failed++;
        toast.error(`${file.name}: ${errorText((e as Error).message, { maxMb: MAX_UPLOAD_MB })}`);
      }
      setProgress({ done: ids.length + failed, total: list.length, failed });
    }
    if (ids.length) await run(() => addPhotosAction(albumId, ids), { success: t("uploaded", { count: ids.length }) });
    setProgress(null);
  }

  const busy = pending || progress !== null;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="font-serif text-xl text-purple-deep">{t("photos")}</CardTitle>
        <label htmlFor={inputId} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90 focus-within:ring-3 focus-within:ring-ring/40 aria-disabled:opacity-50" aria-disabled={busy}>
          <Upload className="size-4" aria-hidden />
          {t("uploadPhotos")}
          <input id={inputId} type="file" accept={ACCEPTED_IMAGES} multiple className="sr-only" disabled={busy} onChange={(e) => { void uploadMany(e.target.files); e.target.value = ""; }} />
        </label>
      </CardHeader>
      <CardContent>
        {progress && (
          <div className="mb-4" role="status">
            <p className="mb-1 text-sm text-muted-foreground">{t("uploading", { done: progress.done, total: progress.total })}</p>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
          </div>
        )}
        <p className="mb-4 text-xs text-muted-foreground">{t("uploadHint", { maxMb: MAX_UPLOAD_MB })}</p>
        {photos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">{t("noPhotos")}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((p, i) => (
              <li key={p.id} className="overflow-hidden rounded-xl border border-border bg-background">
                <div className="relative aspect-square bg-lavender">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
                  <img src={p.src} alt={p.alt.kh || p.alt.en || p.caption.kh || p.caption.en || ""} className="h-full w-full object-cover" loading="lazy" />
                  {p.id === coverPhotoId && (
                    <span className="absolute top-2 left-2 rounded-full bg-gold px-2 py-0.5 text-xs text-white">{t("cover")}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-0.5 p-1">
                  <Button variant="ghost" size="icon-sm" aria-label={t("moveEarlier")} disabled={busy || i === 0} onClick={() => run(() => movePhotoAction({ id: p.id, direction: "up" }))}><ArrowLeft /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={t("moveLater")} disabled={busy || i === photos.length - 1} onClick={() => run(() => movePhotoAction({ id: p.id, direction: "down" }))}><ArrowRight /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={t("setCover")} aria-pressed={p.id === coverPhotoId} disabled={busy} onClick={() => run(() => setCoverAction(p.id), { success: t("coverSet") })}>
                    <Star className={p.id === coverPhotoId ? "fill-gold text-gold" : ""} />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={t("editCaption")} onClick={() => setEditing(p)}><Pencil /></Button>
                  <ConfirmAction
                    trigger={<Button variant="ghost" size="icon-sm" aria-label={t("deletePhoto")}><Trash2 /></Button>}
                    title={t("deletePhoto")}
                    description={t("deletePhotoConfirm")}
                    confirmLabel={t("deletePhoto")}
                    destructive
                    action={() => deletePhotoAction(p.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("editCaption")}</DialogTitle>
          </DialogHeader>
          {editing && (
            <CaptionForm
              photo={editing}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CaptionForm({ photo, onDone }: { photo: Photo; onDone: () => void }) {
  const t = useTranslations("Admin.gallery");
  const tc = useTranslations("Admin.common");
  const { run, pending } = useAction();
  const [caption, setCaption] = useState(photo.caption);
  const [alt, setAlt] = useState(photo.alt);
  return (
    <div className="space-y-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
      <img src={photo.src} alt="" className="max-h-48 rounded-lg" />
      <LocalizedField id="caption" label={t("caption")} value={caption} onChange={setCaption} maxLength={300} />
      <LocalizedField id="alt" label={t("altText")} hint={t("altTextHint")} value={alt} onChange={setAlt} maxLength={200} />
      <Button disabled={pending} onClick={() => run(() => updatePhotoAction({ photoId: photo.id, caption, alt }), { success: tc("saved"), onSuccess: onDone })}>
        {pending ? tc("saving") : tc("save")}
      </Button>
    </div>
  );
}
