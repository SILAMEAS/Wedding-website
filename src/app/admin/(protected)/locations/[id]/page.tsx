import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { PageHeader } from "@/components/admin/page-header";
import { parseLocalized } from "@/lib/validation/localized";
import { requireAdmin } from "@/server/policies/admin";
import { listLocations } from "@/server/services/content.service";
import { imageRefs } from "@/server/services/media.service";
import { LocationForm } from "../location-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.locations"))("edit") };
}

export default async function EditLocationPage({ params }: PageProps<"/admin/locations/[id]">) {
  const ctx = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [t, locations] = await Promise.all([getTranslations("Admin.locations"), listLocations(ctx)]);
  const l = locations.find((x) => x.id === id);
  if (!l) notFound();
  const images = await imageRefs([l.imageAssetId], 828);
  return (
    <>
      <PageHeader title={t("edit")} />
      <LocationForm
        preview={(l.imageAssetId && images.get(l.imageAssetId)) || null}
        initial={{
          id: l.id,
          name: parseLocalized(l.name),
          address: parseLocalized(l.address),
          mapUrl: l.mapUrl ?? "",
          mapEmbed: l.mapEmbedUrl ?? "",
          latitude: l.latitude?.toString() ?? "",
          longitude: l.longitude?.toString() ?? "",
          parking: parseLocalized(l.parking),
          access: parseLocalized(l.access),
          imageAssetId: l.imageAssetId,
          status: l.status,
        }}
      />
    </>
  );
}
