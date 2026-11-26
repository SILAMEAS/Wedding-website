import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DataTable } from "@/components/admin/data-table";
import { ExportButtons } from "@/components/admin/export-buttons";
import { NativeSelect } from "@/components/admin/form-field";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { guestListFiltersSchema } from "@/features/guests/schemas";
import { GUEST_CATEGORIES } from "@/features/shared/schemas";
import { bilingualName } from "@/lib/names";
import { requireAdmin } from "@/server/policies/admin";
import { listGuests } from "@/server/services/guest.service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.guests"))("title") };
}

export default async function GuestsPage({ searchParams }: PageProps<"/admin/guests">) {
  const ctx = await requireAdmin();
  const filters = guestListFiltersSchema.parse(await searchParams);
  const [t, tc, tcat, data] = await Promise.all([
    getTranslations("Admin.guests"),
    getTranslations("Admin.common"),
    getTranslations("Admin.categories"),
    listGuests(ctx, filters),
  ]);
  const archived = filters.archived === "1";

  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <>
            <ExportButtons resource="guests" filters={{ q: filters.q, category: filters.category, archived: filters.archived }} />
            <Button asChild variant="outline">
              <Link href="/admin/guests/import">{t("import")}</Link>
            </Button>
            <Button asChild>
              <Link href="/admin/guests/new">{t("new")}</Link>
            </Button>
          </>
        }
      />

      <form method="get" className="mb-4 grid gap-2 rounded-xl border border-border bg-background p-3 sm:grid-cols-[1fr_12rem_auto_auto]">
        <label className="sr-only" htmlFor="q">{tc("search")}</label>
        <Input id="q" name="q" defaultValue={filters.q} placeholder={tc("searchPlaceholder")} />
        <label className="sr-only" htmlFor="category">{t("category")}</label>
        <NativeSelect id="category" name="category" defaultValue={filters.category ?? ""}>
          <option value="">{t("allCategories")}</option>
          {GUEST_CATEGORIES.map((c) => (
            <option key={c} value={c}>{tcat(c)}</option>
          ))}
        </NativeSelect>
        {archived && <input type="hidden" name="archived" value="1" />}
        <Button type="submit" variant="secondary">{tc("apply")}</Button>
        <Button asChild variant="ghost">
          <Link href={archived ? "/admin/guests" : "/admin/guests?archived=1"}>{archived ? tc("showActive") : tc("showArchived")}</Link>
        </Button>
      </form>

      <DataTable
        emptyText={tc("noResults")}
        columns={[
          { id: "name", header: tc("name"), sortable: true },
          { id: "category", header: t("category"), sortable: true },
          { id: "group", header: t("group") },
          { id: "phone", header: t("phone") },
          { id: "invitation", header: t("invitation") },
        ]}
        rows={data.rows.map((g) => ({
          id: g.id,
          cells: {
            name: (
              <>
                <Link href={`/admin/guests/${g.id}`} className="font-medium text-purple-deep hover:underline">{bilingualName(g)}</Link>
                {g.relationship && <p className="text-xs text-muted-foreground">{g.relationship}</p>}
              </>
            ),
            category: tcat(g.category),
            group: g.group ? (
              <Link href={`/admin/groups/${g.group.id}`} className="hover:underline">{bilingualName(g.group)}</Link>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
            phone: <span className="tabular-nums">{g.phone ?? "—"}</span>,
            invitation:
              g.invitations.length > 0 ? (
                <StatusBadge tone="success">{t("hasInvitation")}</StatusBadge>
              ) : g.group ? (
                <StatusBadge tone="brand">{t("viaGroup")}</StatusBadge>
              ) : (
                <StatusBadge tone="neutral">{t("notInvited")}</StatusBadge>
              ),
          },
        }))}
      />
      <Pagination
        basePath="/admin/guests"
        params={{ q: filters.q, category: filters.category, archived: filters.archived, sort: filters.sort, dir: filters.dir }}
        page={filters.page}
        total={data.total}
        pageSize={data.pageSize}
      />
    </>
  );
}
