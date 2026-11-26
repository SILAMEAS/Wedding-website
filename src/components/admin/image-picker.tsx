"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ImageRef } from "@/lib/storage";
import { useErrorText } from "./error-text";

// HEIC/HEIF accepted where the browser can convert it (prepareImage → JPEG).
export const ACCEPTED_IMAGES = "image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif";
export const MAX_UPLOAD_MB = 10;

export type UploadResult = { assetId: string; preview: ImageRef };

const MAX_EDGE = 2560;

/**
 * Phone photos are often 5–15 MB (and HEIC on iPhone). Resize to at most
 * 2560 px and re-encode as JPEG in the browser before uploading: faster on
 * mobile data and well under the size limit. KHQR images are never touched
 * (lossy compression can make a QR code unreadable). If the browser cannot
 * decode the file, the original is uploaded and the server validates it.
 */
async function prepareImage(file: File, purpose: string): Promise<File> {
  if (purpose === "KHQR_IMAGE" || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const webSafe = ["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type);
    const needsWork = scale < 1 || file.size > 2.5 * 1024 * 1024 || !webSafe;
    if (!needsWork) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) return file;
    const dot = file.name.lastIndexOf(".");
    const base = dot > 0 ? file.name.slice(0, dot) : file.name;
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Upload one image to /api/admin/uploads. Throws a localized-ready error code. */
export async function uploadImageFile(original: File, purpose: "SITE_IMAGE" | "GALLERY_PHOTO" | "KHQR_IMAGE"): Promise<UploadResult> {
  const file = await prepareImage(original, purpose);
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error("fileTooLarge");
  const body = new FormData();
  body.append("file", file);
  body.append("purpose", purpose);
  const res = await fetch("/api/admin/uploads", { method: "POST", body });
  const json = (await res.json().catch(() => ({}))) as Partial<UploadResult> & { error?: string };
  if (!res.ok || !json.assetId || !json.preview) throw new Error(json.error ?? "unexpected");
  return { assetId: json.assetId, preview: json.preview };
}

/** Single image field (hero, portraits, venue, milestone). Value is an asset id. */
export function ImagePicker({
  label,
  assetId,
  preview,
  onChange,
  aspect = "aspect-video",
  purpose = "SITE_IMAGE",
}: {
  label: string;
  assetId: string | null;
  preview: ImageRef | null;
  onChange: (assetId: string | null, preview: ImageRef | null) => void;
  aspect?: string;
  purpose?: "SITE_IMAGE" | "KHQR_IMAGE";
}) {
  const t = useTranslations("Admin.content");
  const errorText = useErrorText();
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [savedId] = useState(assetId); // value when the form loaded

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const r = await uploadImageFile(file, purpose);
      onChange(r.assetId, r.preview);
    } catch (e) {
      toast.error(errorText((e as Error).message, { maxMb: MAX_UPLOAD_MB }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className={`relative ${aspect} w-full max-w-sm overflow-hidden rounded-xl border border-dashed border-border bg-lavender/40`}>
        {preview && assetId ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview
          <img src={preview.src} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-primary/40">
            <ImagePlus className="size-8" aria-hidden />
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="size-6 animate-spin text-primary" aria-label={t("uploading")} />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <label htmlFor={inputId} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm hover:bg-muted focus-within:ring-3 focus-within:ring-ring/40">
          <ImagePlus className="size-4" aria-hidden />
          {assetId ? t("replaceImage") : t("chooseImage")}
          <input id={inputId} type="file" accept={ACCEPTED_IMAGES} className="sr-only" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {assetId && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null, null)}>
            <X aria-hidden /> {t("removeImage")}
          </Button>
        )}
      </div>
      {assetId !== savedId ? (
        <p role="status" className="text-xs font-medium text-amber-700">{t("unsavedImage")}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("imageHint", { maxMb: MAX_UPLOAD_MB })}</p>
      )}
    </div>
  );
}
