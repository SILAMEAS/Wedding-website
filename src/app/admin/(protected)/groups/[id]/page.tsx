import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { PageHeader } from "@/components/admin/page-header";
import { invitationTone, StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { bilingualName } from "@/lib/names";
import { AppError } from "@/server/errors";
import { requireAdmin } from "@/server/policies/admin";
import { getGroup } from "@/server/services/group.service";
import { listAvailableGuests } from "@/server/services/guest.service";
import { GroupForm } from "../group-form";
import { GroupArchiveButton, MemberManager } from "./member-manager";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.groups"))("edit") };
}

export default async function GroupDetailPage({ params }: PageProps<"/admin/groups/[id]">) {
  const ctx = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const group = await getGroup(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === "notFound") notFound();
    throw e;
  });
  const [t, ti, available] = await Promise.all([getTranslations("Admin.groups"), getTranslations("Admin.invitations"), listAvailableGuests(ctx)]);
  const live = group.invitations.find((i) => i.status !== "REVOKED");
  const members = group.members.filter((m) => !m.archivedAt);

  return (
    <>
      <PageHeader
        title={bilingualName(group)}
        description={t("memberCount", { count: members.length })}
        actions={
          <>
            {live ? (
              <Button asChild variant="outline">
                <Link href={`/admin/invitations/${live.id}`}>
                  {t("invitation")} · <StatusBadge tone={invitationTone(live.status)}>{ti(`statuses.${live.status}`)}</StatusBadge>
                </Link>
              </Button>
            ) : (
              !group.archivedAt && members.length > 0 && (
                <Button asChild>
                  <Link href={`/admin/invitations/new?groupId=${group.id}`}>{t("createInvitation")}</Link>
                </Button>
              )
            )}
            <GroupArchiveButton id={group.id} archived={!!group.archivedAt} />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        {!group.archivedAt ? (
          <GroupForm
            groupId={group.id}
            defaults={{
              nameKh: group.nameKh ?? "",
              nameEn: group.nameEn ?? "",
              category: group.category,
              side: group.side ?? "",
              notes: group.notes ?? "",
            }}
          />
        ) : (
          <div />
        )}
        <MemberManager
          groupId={group.id}
          archived={!!group.archivedAt}
          primaryContactId={group.primaryContactGuestId}
          members={members.map((m) => ({ id: m.id, label: bilingualName(m), relationship: m.relationship }))}
          available={available.map((g) => ({ id: g.id, label: bilingualName(g) }))}
        />
      </div>
    </>
  );
}
