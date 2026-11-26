import { ArrowLeft, Lock } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PhotoGrid } from "@/components/invitation/photo-grid";
import { PublicHeader } from "@/components/invitation/public-header";
import { Ornament } from "@/components/wedding/ornament";
import { Link } from "@/i18n/navigation";
import { getGuestAccess } from "@/server/policies/guest";
import { getPublicAlbum } from "@/server/services/public-content.service";

const SLUG = /^[a-z0-9-]{1,60}$/;

export async function generateMetadata({ params }: PageProps<"/[locale]/gallery/[slug]">): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: (await getTranslations({ locale, namespace: "Gallery" }))("title") };
}

export default async function AlbumPage({ params }: PageProps<"/[locale]/gallery/[slug]">) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  setRequestLocale(locale);
  if (!SLUG.test(slug)) notFound();
  const access = await getGuestAccess();
  const album = await getPublicAlbum(locale, slug, !!access);
  if (!album) notFound();
  const [t, tn] = await Promise.all([getTranslations({ locale, namespace: "Gallery" }), getTranslations({ locale, namespace: "Invitation.nav" })]);

  return (
    <>
      <PublicHeader items={[{ href: "/gallery", label: tn("gallery") }, { href: "/location", label: tn("locations") }]} />
      <main id="main" className="min-h-dvh bg-ivory px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Link href="/gallery" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-purple-deep">
            <ArrowLeft className="size-4" aria-hidden /> {t("back")}
          </Link>
          {album.restricted ? (
            <div className="mx-auto mt-16 max-w-md rounded-3xl border border-border bg-background p-8 text-center">
              <Lock className="mx-auto size-8 text-gold" aria-hidden />
              <h1 className="mt-4 font-serif text-3xl text-purple-deep">{t("privateTitle")}</h1>
              <p className="mt-3 text-muted-foreground">{t("privateBody")}</p>
            </div>
          ) : (
            <>
              <header className="my-10 text-center">
                <h1 className="font-serif text-4xl text-purple-deep sm:text-5xl">{album.title}</h1>
                {album.description && <p className="mx-auto mt-4 max-w-2xl whitespace-pre-line text-muted-foreground">{album.description}</p>}
                <Ornament className="mt-6" />
              </header>
              <PhotoGrid photos={album.photos} />
            </>
          )}
        </div>
      </main>
    </>
  );
}
