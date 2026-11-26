"use client";

import { Loader2, Music, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useErrorText } from "./error-text";

/** Optional background music (mp3/m4a). Plays on the invitation only after the guest taps "Open". */
export function MusicPicker({ assetId, src, onChange }: { assetId: string | null; src: string | null; onChange: (assetId: string | null, src: string | null) => void }) {
  const t = useTranslations("Admin.content");
  const errorText = useErrorText();
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [savedId] = useState(assetId);

  async function pick(file: File | undefined) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return toast.error(errorText("fileTooLarge", { maxMb: 15 }));
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("purpose", "MUSIC");
      const res = await fetch("/api/admin/uploads", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { assetId?: string; preview?: { src: string }; error?: string };
      if (!res.ok || !json.assetId) throw new Error(json.error ?? "unexpected");
      onChange(json.assetId, json.preview?.src ?? null);
    } catch (e) {
      toast.error(errorText((e as Error).message, { maxMb: 15 }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("music")}</p>
      {assetId && src && <audio controls preload="none" src={src} className="w-full max-w-sm" />}
      <div className="flex gap-2">
        <label htmlFor={inputId} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm hover:bg-muted focus-within:ring-3 focus-within:ring-ring/40">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Music className="size-4" aria-hidden />}
          {assetId ? t("replaceMusic") : t("chooseMusic")}
          <input id={inputId} type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,.mp3,.m4a" className="sr-only" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
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
        <p className="text-xs text-muted-foreground">{t("musicHint")}</p>
      )}
    </div>
  );
}
