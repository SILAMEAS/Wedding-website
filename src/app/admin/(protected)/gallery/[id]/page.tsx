import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppLocale } from "@/i18n/locales";
import { parseLocalized, pickLocalized } from "@/lib/validation/localized";
import { AppError } from "@/server/errors";
import { requireAdmin } from "@/server/policies/admin";
import { getAlbum } from "@/server/services/gallery.service";
import { AlbumForm, ArchiveAlbumButton } from "../album-forms";
import { PhotoManager } from "./photo-manager";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.gallery"))("title") };
}

export default async function AlbumAdminPage({ params }: PageProps<"/admin/gallery/[id]">) {
  const ctx = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const album = await getAlbum(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === "notFound") notFound();
    throw e;
  });
  const [t, locale] = await Promise.all([getTranslations("Admin.gallery"), getLocale() as Promise<AppLocale>]);

  return (
    <>
      <PageHeader title={pickLocalized(album.title, locale).text} description={t("photoCount", { count: album.photos.length })} actions={<ArchiveAlbumButton id={album.id} />} />
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <PhotoManager
          albumId={album.id}
          coverPhotoId={album.coverPhotoId}
          photos={album.photos.map((p) => ({ id: p.id, src: p.image.src, caption: parseLocalized(p.caption), alt: parseLocalized(p.alt) }))}
        />
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="font-serif text-xl text-purple-deep">{t("albumSettings")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AlbumForm initial={{ id: album.id, title: parseLocalized(album.title), description: parseLocalized(album.description), visibility: album.visibility }} />
            <p className="mt-4 text-xs text-muted-foreground">{t("publicUrl", { slug: album.slug })}</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
