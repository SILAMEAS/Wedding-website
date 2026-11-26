import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/server/policies/admin";
import { LocationForm } from "../location-form";
import { emptyLocServer } from "../loc-utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.locations"))("new") };
}

export default async function NewLocationPage() {
  await requireAdmin();
  const t = await getTranslations("Admin.locations");
  return (
    <>
      <PageHeader title={t("new")} />
      <LocationForm
        preview={null}
        initial={{
          name: emptyLocServer(),
          address: emptyLocServer(),
          mapUrl: "",
          mapEmbed: "",
          latitude: "",
          longitude: "",
          parking: emptyLocServer(),
          access: emptyLocServer(),
          imageAssetId: null,
          status: "PUBLISHED",
        }}
      />
    </>
  );
}
