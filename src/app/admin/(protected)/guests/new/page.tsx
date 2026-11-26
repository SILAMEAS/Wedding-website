import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { bilingualName } from "@/lib/names";
import { requireAdmin } from "@/server/policies/admin";
import { listGroupOptions } from "@/server/services/group.service";
import { GuestForm } from "../guest-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.guests"))("new") };
}

export default async function NewGuestPage({ searchParams }: PageProps<"/admin/guests/new">) {
  const ctx = await requireAdmin();
  const { groupId } = (await searchParams) as { groupId?: string };
  const [t, groups] = await Promise.all([getTranslations("Admin.guests"), listGroupOptions(ctx)]);
  const options = groups.map((g) => ({ id: g.id, label: bilingualName(g) }));
  return (
    <>
      <PageHeader title={t("new")} />
      <GuestForm
        groups={options}
        defaults={{ nameKh: "", nameEn: "", category: "OTHER", groupId: options.some((o) => o.id === groupId) ? groupId : "" }}
      />
    </>
  );
}
