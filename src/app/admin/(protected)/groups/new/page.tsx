import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/server/policies/admin";
import { GroupForm } from "../group-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.groups"))("new") };
}

export default async function NewGroupPage() {
  await requireAdmin();
  const t = await getTranslations("Admin.groups");
  return (
    <>
      <PageHeader title={t("new")} />
      <GroupForm />
    </>
  );
}
