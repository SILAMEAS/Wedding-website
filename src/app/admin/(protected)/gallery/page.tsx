import { Images } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import type { AppLocale } from "@/i18n/locales";
import { pickLocalized } from "@/lib/validation/localized";
import { requireAdmin } from "@/server/policies/admin";
import { listAlbums } from "@/server/services/gallery.service";
import { MoveButtons } from "../locations/move-buttons";
import { NewAlbumButton } from "./album-forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Admin.gallery"))("title") };
}

export default async function GalleryAdminPage() {
  const ctx = await requireAdmin();
  const [t, locale, albums] = await Promise.all([getTranslations("Admin.gallery"), getLocale() as Promise<AppLocale>, listAlbums(ctx)]);
  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} actions={<NewAlbumButton />} />
      {albums.length === 0 && <p className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-muted-foreground">{t("empty")}</p>}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {albums.map((a, i) => (
          <li key={a.id} className="overflow-hidden rounded-xl border border-border bg-background">
            <Link href={`/admin/gallery/${a.id}`} className="block">
              <div className="aspect-[4/3] bg-lavender">
                {a.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                  <img src={a.cover.src} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center text-primary/40"><Images className="size-8" aria-hidden /></div>
                )}
              </div>
            </Link>
            <div className="flex items-center gap-2 p-3">
              <Link href={`/admin/gallery/${a.id}`} className="min-w-0 flex-1 hover:underline">
                <p className="truncate font-medium text-purple-deep">{pickLocalized(a.title, locale).text}</p>
                <p className="text-xs text-muted-foreground">{t("photoCount", { count: a._count.photos })}</p>
              </Link>
              <StatusBadge tone={a.visibility === "PUBLIC" ? "success" : a.visibility === "INVITATION_ONLY" ? "brand" : "neutral"}>{t(`visibility.${a.visibility}`)}</StatusBadge>
              <MoveButtons model="photoAlbum" id={a.id} first={i === 0} last={i === albums.length - 1} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
