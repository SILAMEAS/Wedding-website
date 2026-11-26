import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { DataTable } from "@/components/admin/data-table";
import { ExportButtons } from "@/components/admin/export-buttons";
import { NativeSelect } from "@/components/admin/form-field";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { invitationTone, rsvpTone, StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INVITATION_STATUSES, invitationListFiltersSchema } from "@/features/invitations/schemas";
import { type AppLocale } from "@/i18n/locales";
import { formatDate } from "@/lib/dates";
import { bilingualName } from "@/lib/names";
import { requireAdmin } from "@/server/policies/admin";
import { listInvitations } from "@/server/services/invitation.service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.invitations"))("title") };
}

export default async function InvitationsPage({ searchParams }: PageProps<"/admin/invitations">) {
  const ctx = await requireAdmin();
  const filters = invitationListFiltersSchema.parse(await searchParams);
  const [t, tc, locale, data] = await Promise.all([
    getTranslations("Admin.invitations"),
    getTranslations("Admin.common"),
    getLocale() as Promise<AppLocale>,
    listInvitations(ctx, filters),
  ]);

  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <>
            <ExportButtons resource="invitations" filters={{ type: filters.type, status: filters.status, rsvp: filters.rsvp, opened: filters.opened }} />
            <Button asChild>
              <Link href="/admin/invitations/new">{t("new")}</Link>
            </Button>
          </>
        }
      />
      <form method="get" className="mb-4 grid gap-2 rounded-xl border border-border bg-background p-3 sm:grid-cols-2 lg:grid-cols-[1fr_9rem_10rem_9rem_9rem_auto]">
        <label className="sr-only" htmlFor="q">{tc("search")}</label>
        <Input id="q" name="q" defaultValue={filters.q} placeholder={tc("searchPlaceholder")} />
        <NativeSelect name="type" aria-label={t("type")} defaultValue={filters.type ?? ""}>
          <option value="">{t("allTypes")}</option>
          <option value="INDIVIDUAL">{t("INDIVIDUAL")}</option>
          <option value="FAMILY">{t("FAMILY")}</option>
        </NativeSelect>
        <NativeSelect name="status" aria-label={tc("status")} defaultValue={filters.status ?? ""}>
          <option value="">{t("allStatuses")}</option>
          {INVITATION_STATUSES.map((s) => <option key={s} value={s}>{t(`statuses.${s}`)}</option>)}
        </NativeSelect>
        <NativeSelect name="rsvp" aria-label={t("rsvp")} defaultValue={filters.rsvp ?? ""}>
          <option value="">{t("anyRsvp")}</option>
          <option value="none">{t("rsvpNone")}</option>
          <option value="ATTENDING">{t("rsvpStatus.ATTENDING")}</option>
          <option value="DECLINED">{t("rsvpStatus.DECLINED")}</option>
          <option value="MAYBE">{t("rsvpStatus.MAYBE")}</option>
        </NativeSelect>
        <NativeSelect name="opened" aria-label={t("opened")} defaultValue={filters.opened ?? ""}>
          <option value="">{t("anyOpened")}</option>
          <option value="1">{t("opened")}</option>
          <option value="0">{t("notOpened")}</option>
        </NativeSelect>
        <Button type="submit" variant="secondary">{tc("apply")}</Button>
      </form>

      <DataTable
        emptyText={tc("noResults")}
        columns={[
          { id: "owner", header: t("owner") },
          { id: "type", header: t("type"), sortable: true },
          { id: "capacity", header: t("capacity"), sortable: true, align: "right" },
          { id: "status", header: tc("status"), sortable: true },
          { id: "rsvp", header: t("rsvp") },
          { id: "opened", header: t("opened"), sortable: true },
        ]}
        rows={data.rows.map((inv) => {
          const owner = inv.type === "INDIVIDUAL" ? inv.guest : inv.group;
          return {
            id: inv.id,
            cells: {
              owner: (
                <>
                  <Link href={`/admin/invitations/${inv.id}`} className="font-medium text-purple-deep hover:underline">{owner ? bilingualName(owner) : "—"}</Link>
                  {inv.internalLabel && <p className="text-xs text-muted-foreground">{inv.internalLabel}</p>}
                </>
              ),
              type: (
                <>
                  {t(inv.type)}
                  {inv.type === "FAMILY" && inv.group && <span className="text-xs text-muted-foreground"> · {inv.group._count.members}</span>}
                </>
              ),
              capacity: inv.capacity,
              status: <StatusBadge tone={invitationTone(inv.status)}>{t(`statuses.${inv.status}`)}</StatusBadge>,
              rsvp: (
                <StatusBadge tone={rsvpTone(inv.rsvp?.status)}>
                  {inv.rsvp ? `${t(`rsvpStatus.${inv.rsvp.status}`)} · ${inv.rsvp.attendingCount}` : t("rsvpNone")}
                </StatusBadge>
              ),
              opened: (
                <span className="text-sm text-muted-foreground">
                  {inv.firstOpenedAt ? formatDate(inv.firstOpenedAt, locale, { dateStyle: "medium" }) : t("notOpened")}
                </span>
              ),
            },
          };
        })}
      />
      <Pagination
        basePath="/admin/invitations"
        params={{ q: filters.q, type: filters.type, status: filters.status, rsvp: filters.rsvp, opened: filters.opened, sort: filters.sort, dir: filters.dir }}
        page={filters.page}
        total={data.total}
        pageSize={data.pageSize}
      />
    </>
  );
}
