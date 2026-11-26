import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { bilingualName } from "@/lib/names";
import { requireAdmin } from "@/server/policies/admin";
import { listAvailableGroups } from "@/server/services/group.service";
import { listAvailableGuests } from "@/server/services/guest.service";
import { NewInvitationForm } from "./new-invitation-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.invitations"))("new") };
}

export default async function NewInvitationPage({ searchParams }: PageProps<"/admin/invitations/new">) {
  const ctx = await requireAdmin();
  const sp = (await searchParams) as { guestId?: string; groupId?: string };
  const [t, guests, groups] = await Promise.all([
    getTranslations("Admin.invitations"),
    listAvailableGuests(ctx, { forInvitation: true }),
    listAvailableGroups(ctx),
  ]);
  return (
    <>
      <PageHeader title={t("new")} />
      <NewInvitationForm
        guests={guests.map((g) => ({ id: g.id, label: bilingualName(g) }))}
        groups={groups.map((g) => ({ id: g.id, label: bilingualName(g), members: g._count.members }))}
        initialType={sp.groupId ? "FAMILY" : "INDIVIDUAL"}
        initialGuestId={guests.some((g) => g.id === sp.guestId) ? sp.guestId : undefined}
        initialGroupId={groups.some((g) => g.id === sp.groupId) ? sp.groupId : undefined}
      />
    </>
  );
}
