import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { DataTable } from "@/components/admin/data-table";
import { ExportButtons } from "@/components/admin/export-buttons";
import { NativeSelect } from "@/components/admin/form-field";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { pageParam, sortDir } from "@/features/shared/schemas";
import type { AppLocale } from "@/i18n/locales";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { bilingualName } from "@/lib/names";
import { requireAdmin } from "@/server/policies/admin";
import { getGiftSummary, listGifts } from "@/server/services/gift-admin.service";
import { GIFT_STATUSES as STATUSES, statusTone } from "./status";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.gifts"))("title") };
}

const METHODS = ["KHQR", "BANK_TRANSFER", "CASH", "OTHER"] as const;
const filtersSchema = z.object({
  status: z.enum(STATUSES).optional().catch(undefined),
  currency: z.enum(["USD", "KHR"]).optional().catch(undefined),
  method: z.enum(METHODS).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  sort: z.enum(["date", "amount", "donor", "status"]).optional().catch(undefined),
  dir: sortDir,
  page: pageParam,
});

export default async function GiftsPage({ searchParams }: PageProps<"/admin/gifts">) {
  const ctx = await requireAdmin();
  const f = filtersSchema.parse(await searchParams);
  const [t, tc, locale, summary, data] = await Promise.all([
    getTranslations("Admin.gifts"),
    getTranslations("Admin.common"),
    getLocale() as Promise<AppLocale>,
    getGiftSummary(ctx),
    listGifts(ctx, f),
  ]);
  const money = (v: string, c: "USD" | "KHR") => formatMoney(v, c, locale);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={
          <>
            <ExportButtons resource="gifts" filters={{ status: f.status, currency: f.currency, method: f.method, q: f.q }} />
            <Button asChild>
              <Link href="/admin/gifts/new">{t("record")}</Link>
            </Button>
          </>
        }
      />

      <section aria-label={t("totals")} className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["USD", "KHR"] as const).map((c) => (
          <Card key={`v-${c}`}>
            <CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">{t("verifiedTotal", { currency: c })}</CardTitle></CardHeader>
            <CardContent><p className="font-serif text-3xl text-purple-deep tabular-nums">{money(summary.verified[c], c)}</p></CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">{t("pendingTotal")}</CardTitle></CardHeader>
          <CardContent>
            <p className="font-serif text-2xl text-amber-700 tabular-nums">{money(summary.pending.USD, "USD")}</p>
            <p className="font-serif text-2xl text-amber-700 tabular-nums">{money(summary.pending.KHR, "KHR")}</p>
            <Link href="/admin/gifts?status=PENDING_VERIFICATION" className="text-xs text-primary hover:underline">{t("pendingCount", { count: summary.pendingCount })}</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm font-medium text-muted-foreground">{t("contributors")}</CardTitle></CardHeader>
          <CardContent>
            <p className="font-serif text-3xl text-purple-deep tabular-nums">{summary.contributors}</p>
            <p className="text-xs text-muted-foreground">{t("contributorsHint")}</p>
          </CardContent>
        </Card>
      </section>

      {Object.keys(summary.byMethod).length > 0 && (
        <p className="mb-6 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          {Object.entries(summary.byMethod).map(([m, v]) => (
            <span key={m}>
              <strong className="text-foreground">{t(`method.${m as (typeof METHODS)[number]}`)}</strong>: {money(v.USD, "USD")} · {money(v.KHR, "KHR")}
            </span>
          ))}
        </p>
      )}

      <form method="get" className="mb-4 grid gap-2 rounded-xl border border-border bg-background p-3 sm:grid-cols-2 lg:grid-cols-[1fr_11rem_8rem_10rem_auto]">
        <label className="sr-only" htmlFor="q">{tc("search")}</label>
        <Input id="q" name="q" defaultValue={f.q} placeholder={t("searchPlaceholder")} />
        <NativeSelect name="status" aria-label={tc("status")} defaultValue={f.status ?? ""}>
          <option value="">{t("allStatuses")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </NativeSelect>
        <NativeSelect name="currency" aria-label={t("currency")} defaultValue={f.currency ?? ""}>
          <option value="">USD + KHR</option>
          <option value="USD">USD</option>
          <option value="KHR">KHR</option>
        </NativeSelect>
        <NativeSelect name="method" aria-label={t("methodLabel")} defaultValue={f.method ?? ""}>
          <option value="">{t("allMethods")}</option>
          {METHODS.map((m) => <option key={m} value={m}>{t(`method.${m}`)}</option>)}
        </NativeSelect>
        <Button type="submit" variant="secondary">{tc("apply")}</Button>
      </form>

      <DataTable
        emptyText={tc("noResults")}
        columns={[
          { id: "donor", header: t("donor"), sortable: true },
          { id: "amount", header: t("amount"), sortable: true, align: "right" },
          { id: "method", header: t("methodLabel") },
          { id: "status", header: tc("status"), sortable: true },
          { id: "date", header: t("date"), sortable: true },
        ]}
        rows={data.rows.map((g) => {
          const owner = g.invitation?.guest ?? g.invitation?.group;
          const shown = g.receivedAmount ?? g.notifiedAmount;
          return {
            id: g.id,
            cells: {
              donor: (
                <>
                  <Link href={`/admin/gifts/${g.id}`} className="font-medium text-purple-deep hover:underline">{g.donorName}</Link>
                  {owner && <p className="text-xs text-muted-foreground">{bilingualName(owner)}</p>}
                </>
              ),
              amount: (
                <>
                  {shown ? money(shown.toFixed(2), g.currency) : "—"}
                  {g.receivedAmount && g.notifiedAmount && !g.receivedAmount.equals(g.notifiedAmount) && (
                    <p className="text-xs text-muted-foreground">{t("notified")}: {money(g.notifiedAmount.toFixed(2), g.currency)}</p>
                  )}
                </>
              ),
              method: (
                <span className="text-sm">
                  {t(`method.${g.method}`)}
                  <span className="block text-xs text-muted-foreground">{g.source === "GUEST_NOTIFICATION" ? t("fromGuest") : t("recorded")}</span>
                </span>
              ),
              status: <StatusBadge tone={statusTone[g.status]}>{t(`status.${g.status}`)}</StatusBadge>,
              date: (
                <span className="text-sm text-muted-foreground">{formatDate(g.receivedAt ?? g.transferredAt ?? g.createdAt, locale, { dateStyle: "medium" })}</span>
              ),
            },
          };
        })}
      />
      <Pagination basePath="/admin/gifts" params={{ status: f.status, currency: f.currency, method: f.method, q: f.q, sort: f.sort, dir: f.dir }} page={f.page} total={data.total} pageSize={data.pageSize} />
    </>
  );
}
