import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { invitationTone, StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { groupListFiltersSchema } from "@/features/groups/schemas";
import { bilingualName } from "@/lib/names";
import { requireAdmin } from "@/server/policies/admin";
import { listGroups } from "@/server/services/group.service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.groups"))("title") };
}

export default async function GroupsPage({ searchParams }: PageProps<"/admin/groups">) {
  const ctx = await requireAdmin();
  const filters = groupListFiltersSchema.parse(await searchParams);
  const [t, tc, tcat, ti, data] = await Promise.all([
    getTranslations("Admin.groups"),
    getTranslations("Admin.common"),
    getTranslations("Admin.categories"),
    getTranslations("Admin.invitations"),
    listGroups(ctx, filters),
  ]);
  const archived = filters.archived === "1";

  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <Button asChild>
            <Link href="/admin/groups/new">{t("new")}</Link>
          </Button>
        }
      />
      <form method="get" className="mb-4 grid gap-2 rounded-xl border border-border bg-background p-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="sr-only" htmlFor="q">{tc("search")}</label>
        <Input id="q" name="q" defaultValue={filters.q} placeholder={tc("searchPlaceholder")} />
        {archived && <input type="hidden" name="archived" value="1" />}
        <Button type="submit" variant="secondary">{tc("apply")}</Button>
        <Button asChild variant="ghost">
          <Link href={archived ? "/admin/groups" : "/admin/groups?archived=1"}>{archived ? tc("showActive") : tc("showArchived")}</Link>
        </Button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tc("name")}</TableHead>
              <TableHead>{t("members")}</TableHead>
              <TableHead>{t("invitation")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">{tc("noResults")}</TableCell>
              </TableRow>
            )}
            {data.rows.map((g) => {
              const inv = g.invitations[0];
              return (
                <TableRow key={g.id}>
                  <TableCell>
                    <Link href={`/admin/groups/${g.id}`} className="font-medium text-purple-deep hover:underline">{bilingualName(g)}</Link>
                    <p className="text-xs text-muted-foreground">{tcat(g.category)}</p>
                  </TableCell>
                  <TableCell>{t("memberCount", { count: g._count.members })}</TableCell>
                  <TableCell>
                    {inv ? (
                      <Link href={`/admin/invitations/${inv.id}`}>
                        <StatusBadge tone={invitationTone(inv.status)}>{ti(`statuses.${inv.status}`)} · {inv.capacity}</StatusBadge>
                      </Link>
                    ) : (
                      <StatusBadge tone="neutral">{t("noInvitation")}</StatusBadge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Pagination basePath="/admin/groups" params={{ q: filters.q, archived: filters.archived }} page={filters.page} total={data.total} pageSize={data.pageSize} />
    </>
  );
}
