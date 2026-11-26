import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

/** Server-rendered pagination that preserves the current filters. */
export async function Pagination({
  basePath,
  params,
  page,
  total,
  pageSize,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  total: number;
  pageSize: number;
}) {
  const t = await getTranslations("Admin.common");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>{t("results", { count: total })}</span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href(page - 1)}>{t("previous")}</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            {t("previous")}
          </Button>
        )}
        <span>{t("pageOf", { page: Math.min(page, pages), pages })}</span>
        {page < pages ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href(page + 1)}>{t("next")}</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            {t("next")}
          </Button>
        )}
      </div>
    </nav>
  );
}
