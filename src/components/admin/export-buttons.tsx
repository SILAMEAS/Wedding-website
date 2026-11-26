import { Download } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

/** CSV / Excel download links that carry the list page's current filters. */
export async function ExportButtons({ resource, filters = {} }: { resource: string; filters?: Record<string, string | undefined> }) {
  const t = await getTranslations("Admin.downloads");
  const href = (format: "csv" | "xlsx") => {
    const sp = new URLSearchParams({ format });
    for (const [k, v] of Object.entries(filters)) if (v) sp.set(k, v);
    return `/api/admin/exports/${resource}?${sp.toString()}`;
  };
  return (
    <>
      <Button asChild variant="outline" size="sm">
        <a href={href("xlsx")} download>
          <Download aria-hidden /> Excel
        </a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={href("csv")} download aria-label={t("csvLabel")}>
          <Download aria-hidden /> CSV
        </a>
      </Button>
    </>
  );
}
