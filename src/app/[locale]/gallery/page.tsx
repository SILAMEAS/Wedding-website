import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AlbumGrid } from "@/components/invitation/gallery-section";
import { PublicHeader } from "@/components/invitation/public-header";
import { Ornament } from "@/components/wedding/ornament";
import { getGuestAccess } from "@/server/policies/guest";
import { getPublicAlbums } from "@/server/services/public-content.service";

export async function generateMetadata({ params }: PageProps<"/[locale]/gallery">): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: (await getTranslations({ locale, namespace: "Gallery" }))("title") };
}

export default async function GalleryPage({ params }: PageProps<"/[locale]/gallery">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const access = await getGuestAccess();
  const [t, tn, albums] = await Promise.all([
    getTranslations({ locale, namespace: "Gallery" }),
    getTranslations({ locale, namespace: "Invitation.nav" }),
    getPublicAlbums(locale, !!access),
  ]);
  return (
    <>
      <PublicHeader items={[{ href: "/gallery", label: tn("gallery") }, { href: "/location", label: tn("locations") }]} />
      <main id="main" className="min-h-dvh bg-ivory px-5 py-16">
        <div className="mx-auto max-w-5xl">
          <header className="mb-12 text-center">
            <p className="eyebrow mb-3">{t("eyebrow")}</p>
            <h1 className="font-serif text-4xl text-purple-deep sm:text-5xl">{t("title")}</h1>
            <Ornament className="mt-6" />
          </header>
          {albums.length > 0 ? <AlbumGrid locale={locale} albums={albums} /> : <p className="text-center text-muted-foreground">{t("empty")}</p>}
          {!access && <p className="mt-10 text-center text-sm text-muted-foreground">{t("moreForGuests")}</p>}
        </div>
      </main>
    </>
  );
}
