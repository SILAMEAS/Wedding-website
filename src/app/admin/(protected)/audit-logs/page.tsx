import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { NativeSelect } from "@/components/admin/form-field";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { pageParam } from "@/features/shared/schemas";
import type { AppLocale } from "@/i18n/locales";
import { formatDate } from "@/lib/dates";
import { requireAdmin } from "@/server/policies/admin";
import { listAuditLogs } from "@/server/services/audit.service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.audit"))("title") };
}

const PREFIXES = ["auth", "guest", "group", "invitation"] as const;
const filtersSchema = z.object({ action: z.enum(PREFIXES).optional().catch(undefined), page: pageParam });
const PAGE_SIZE = 50;

const entityHref: Record<string, (id: string) => string> = {
  Guest: (id) => `/admin/guests/${id}`,
  GuestGroup: (id) => `/admin/groups/${id}`,
  Invitation: (id) => `/admin/invitations/${id}`,
};

export default async function AuditLogsPage({ searchParams }: PageProps<"/admin/audit-logs">) {
  const ctx = await requireAdmin();
  const f = filtersSchema.parse(await searchParams);
  const [t, tc, tnav, locale, data] = await Promise.all([
    getTranslations("Admin.audit"),
    getTranslations("Admin.common"),
    getTranslations("Admin.nav"),
    getLocale() as Promise<AppLocale>,
    listAuditLogs(ctx, { action: f.action ? `${f.action}.` : undefined, page: f.page, pageSize: PAGE_SIZE }),
  ]);
  const prefixLabel: Record<(typeof PREFIXES)[number], string> = {
    auth: tnav("security"),
    guest: tnav("guests"),
    group: tnav("groups"),
    invitation: tnav("invitations"),
  };

  return (
    <>
      <PageHeader title={t("title")} description={t("sharedNote")} />
      <form method="get" className="mb-4 flex gap-2 rounded-xl border border-border bg-background p-3">
        <NativeSelect name="action" aria-label={t("action")} defaultValue={f.action ?? ""} className="max-w-xs">
          <option value="">{t("allActions")}</option>
          {PREFIXES.map((p) => <option key={p} value={p}>{prefixLabel[p]}</option>)}
        </NativeSelect>
        <Button type="submit" variant="secondary">{tc("apply")}</Button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("when")}</TableHead>
              <TableHead>{t("who")}</TableHead>
              <TableHead>{t("action")}</TableHead>
              <TableHead>{t("entity")}</TableHead>
              <TableHead>{t("details")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">{tc("noResults")}</TableCell>
              </TableRow>
            )}
            {data.rows.map((r) => {
              const href = r.entityId ? entityHref[r.entityType]?.(r.entityId) : undefined;
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-sm whitespace-nowrap">{formatDate(r.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}</TableCell>
                  <TableCell className="text-sm">{r.actorLabel}</TableCell>
                  <TableCell><code className="text-xs text-purple-deep">{r.action}</code></TableCell>
                  <TableCell className="text-sm">
                    {href ? <Link href={href} className="hover:underline">{r.entityType}</Link> : r.entityType}
                  </TableCell>
                  <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground" title={r.metadata ? JSON.stringify(r.metadata) : ""}>
                    {r.metadata ? JSON.stringify(r.metadata) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Pagination basePath="/admin/audit-logs" params={{ action: f.action }} page={f.page} total={data.total} pageSize={PAGE_SIZE} />
    </>
  );
}
