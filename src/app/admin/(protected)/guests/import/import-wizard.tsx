"use client";

import { Download, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/admin/status-badge";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IMPORT_MAX_BYTES } from "@/features/guests/schemas";
import { commitImportAction, previewImportAction } from "@/server/actions/guest.actions";
import type { ImportPreview } from "@/server/services/guest-import.service";

const TEMPLATE = "name_en,name_kh,phone,email,category,side,relationship,group,notes\nSok Dara,សុខ ដារ៉ា,012 345 678,,friend,groom,University friend,,\n";

export function ImportWizard() {
  const t = useTranslations("Admin.import");
  const tg = useTranslations("Admin.guests");
  const tv = useTranslations("Validation");
  const tErr = useTranslations("Errors");
  const router = useRouter();
  const { run, pending } = useAction();
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  async function onFile(file: File | undefined) {
    setPreview(null);
    if (!file) return;
    if (file.size > IMPORT_MAX_BYTES) {
      setCsv(null);
      toast.error(tErr("importTooLarge", { max: 2000 }));
      return;
    }
    setFileName(file.name);
    const text = await file.text();
    setCsv(text);
    await run(() => previewImportAction({ csv: text }), { refresh: false, onSuccess: setPreview });
  }

  function downloadTemplate() {
    const blob = new Blob([String.fromCharCode(0xfeff) + TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "guests-template.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }

  const fieldLabel = (key: string) => {
    const map: Record<string, string> = { nameKh: tg("nameKh"), nameEn: tg("nameEn"), phone: tg("phone"), email: tg("email"), category: tg("category"), side: tg("side"), relationship: tg("relationship"), group: tg("group"), notes: "notes" };
    return map[key] ?? key;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 focus-within:ring-3 focus-within:ring-ring/40">
          <Upload className="size-4" aria-hidden />
          {t("chooseFile")}
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
        <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate} className="ml-auto">
          <Download aria-hidden /> {t("downloadTemplate")}
        </Button>
      </div>

      {preview && (
        <div className="space-y-4 rounded-xl border border-border bg-background p-4">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="success">{t("valid", { count: preview.validCount })}</StatusBadge>
            {preview.errorCount > 0 && <StatusBadge tone="danger">{t("errors", { count: preview.errorCount })}</StatusBadge>}
          </div>
          {preview.newGroups.length > 0 && (
            <p className="text-sm"><span className="font-medium">{t("newGroups")}:</span> {preview.newGroups.join(", ")}</p>
          )}
          {preview.existingGroups.length > 0 && (
            <p className="text-sm"><span className="font-medium">{t("existingGroups")}:</span> {preview.existingGroups.join(", ")}</p>
          )}
          {preview.unknownColumns.length > 0 && (
            <p className="text-sm text-muted-foreground">{t("unknownColumns")}: {preview.unknownColumns.join(", ")}</p>
          )}

          {preview.errorCount > 0 ? (
            <>
              <p className="text-sm text-destructive">{t("fixAndRetry")}</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">{t("line")}</TableHead>
                    <TableHead>{t("problem")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.filter((r) => r.errors).slice(0, 200).map((r) => (
                    <TableRow key={r.line}>
                      <TableCell className="tabular-nums">{r.line}</TableCell>
                      <TableCell>
                        {Object.entries(r.errors!).map(([f, m]) => (
                          <span key={f} className="mr-3 inline-block">
                            <strong>{fieldLabel(f)}</strong>: {tv.has(m as never) ? tv(m as never) : tv("invalid")}
                          </span>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : (
            <Button
              disabled={pending || !csv}
              onClick={() =>
                run(() => commitImportAction({ csv }), {
                  onSuccess: (d) => {
                    toast.success(t("done", { created: d.created, groups: d.groupsCreated }));
                    router.push("/admin/guests");
                  },
                })
              }
            >
              {t("commit", { count: preview.validCount })}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
