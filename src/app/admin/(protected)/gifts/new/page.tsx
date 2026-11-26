import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { bilingualName } from "@/lib/names";
import { requireAdmin } from "@/server/policies/admin";
import { listInvitationOptions } from "@/server/services/invitation.service";
import { RecordGiftForm } from "./record-gift-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.gifts"))("record") };
}

export default async function RecordGiftPage() {
  const ctx = await requireAdmin();
  const [t, invitations] = await Promise.all([getTranslations("Admin.gifts"), listInvitationOptions(ctx)]);
  return (
    <>
      <PageHeader title={t("record")} description={t("recordIntro")} />
      <RecordGiftForm invitations={invitations.map((i) => ({ id: i.id, label: bilingualName((i.guest ?? i.group)!) }))} />
    </>
  );
}
