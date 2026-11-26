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
import { listGroupOptions } from "@/server/services/group.service";
import { getGuest } from "@/server/services/guest.service";
import { GuestForm } from "../guest-form";
import { GuestArchiveButton } from "./guest-archive-button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.guests"))("edit") };
}

export default async function EditGuestPage({ params }: PageProps<"/admin/guests/[id]">) {
  const ctx = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const guest = await getGuest(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === "notFound") notFound();
    throw e;
  });
  const [t, ti, groups] = await Promise.all([getTranslations("Admin.guests"), getTranslations("Admin.invitations"), listGroupOptions(ctx)]);
  const live = guest.invitations.find((i) => i.status !== "REVOKED");

  return (
    <>
      <PageHeader
        title={bilingualName(guest)}
        description={guest.archivedAt ? t("archivedToast") : undefined}
        actions={
          <>
            {live ? (
              <Button asChild variant="outline">
                <Link href={`/admin/invitations/${live.id}`}>
                  {ti("title")} · <StatusBadge tone={invitationTone(live.status)}>{ti(`statuses.${live.status}`)}</StatusBadge>
                </Link>
              </Button>
            ) : guest.group ? (
              <Button asChild variant="outline">
                <Link href={`/admin/groups/${guest.group.id}`}>{t("viaGroup")}</Link>
              </Button>
            ) : (
              !guest.archivedAt && (
                <Button asChild>
                  <Link href={`/admin/invitations/new?guestId=${guest.id}`}>{t("inviteThisGuest")}</Link>
                </Button>
              )
            )}
            <GuestArchiveButton id={guest.id} archived={!!guest.archivedAt} />
          </>
        }
      />
      {!guest.archivedAt && (
        <GuestForm
          guestId={guest.id}
          groups={groups.map((g) => ({ id: g.id, label: bilingualName(g) }))}
          defaults={{
            nameKh: guest.nameKh ?? "",
            nameEn: guest.nameEn ?? "",
            phone: guest.phone ?? "",
            email: guest.email ?? "",
            category: guest.category,
            side: guest.side ?? "",
            relationship: guest.relationship ?? "",
            groupId: guest.groupId ?? "",
            notes: guest.notes ?? "",
          }}
        />
      )}
    </>
  );
}
