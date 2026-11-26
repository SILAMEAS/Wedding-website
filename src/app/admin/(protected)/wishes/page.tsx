import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { ExportButtons } from "@/components/admin/export-buttons";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { StatusBadge } from "@/components/admin/status-badge";
import { pageParam } from "@/features/shared/schemas";
import type { AppLocale } from "@/i18n/locales";
import { formatDate } from "@/lib/dates";
import { bilingualName } from "@/lib/names";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/policies/admin";
import { listWishesForAdmin, WISH_FILTERS } from "@/server/services/wish.service";
import { WishActions } from "./wish-actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.wishes"))("title") };
}

const filtersSchema = z.object({ status: z.enum(WISH_FILTERS).catch("PENDING"), q: z.string().trim().max(100).optional().catch(undefined), page: pageParam });

export default async function WishesAdminPage({ searchParams }: PageProps<"/admin/wishes">) {
  const ctx = await requireAdmin();
  const f = filtersSchema.parse({ status: "PENDING", ...(await searchParams) });
  const [t, locale, data] = await Promise.all([getTranslations("Admin.wishes"), getLocale() as Promise<AppLocale>, listWishesForAdmin(ctx, f.status, f.page, f.q)]);

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} actions={<ExportButtons resource="wishes" />} />
      <nav aria-label={t("filters")} className="mb-4 flex flex-wrap gap-2">
        {WISH_FILTERS.map((s) => {
          const count = s === "PRIVATE" ? undefined : data.byStatus[s];
          return (
            <Link
              key={s}
              href={`/admin/wishes?status=${s}`}
              aria-current={f.status === s ? "page" : undefined}
              className={cn("rounded-full border px-3 py-1.5 text-sm", f.status === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-lavender")}
            >
              {t(`filter.${s}`)}
              {count ? <span className="ml-1.5 tabular-nums opacity-80">{count}</span> : null}
            </Link>
          );
        })}
      </nav>

      {data.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background p-10 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {data.rows.map((w) => {
            const owner = w.invitation?.guest ?? w.invitation?.group;
            return (
              <li key={w.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-purple-deep">{w.authorName}</span>
                  {w.relationship && <span className="text-muted-foreground">· {w.relationship}</span>}
                  {w.visibility === "PRIVATE" && <StatusBadge tone="brand">{t("private")}</StatusBadge>}
                  {w.originalMessage && <StatusBadge tone="neutral">{t("edited")}</StatusBadge>}
                  <span className="ml-auto text-xs text-muted-foreground">{formatDate(w.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}</span>
                </div>
                <p className="mt-2 whitespace-pre-line">{w.message}</p>
                {owner && w.invitation && (
                  <Link href={`/admin/invitations/${w.invitation.id}`} className="mt-2 inline-block text-xs text-muted-foreground hover:underline">
                    {t("from")}: {bilingualName(owner)}
                  </Link>
                )}
                <WishActions id={w.id} status={w.status} authorName={w.authorName} message={w.message} />
              </li>
            );
          })}
        </ul>
      )}
      <Pagination basePath="/admin/wishes" params={{ status: f.status, q: f.q }} page={f.page} total={data.total} pageSize={data.pageSize} />
    </>
  );
}
