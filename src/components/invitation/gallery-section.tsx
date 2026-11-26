import { Images, Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SiteImage } from "@/components/wedding/site-image";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/locales";
import type { PublicAlbum } from "@/server/services/public-content.service";
import { Reveal } from "./reveal";
import { Section } from "./section";

export async function AlbumGrid({ locale, albums }: { locale: AppLocale; albums: PublicAlbum[] }) {
  const t = await getTranslations({ locale, namespace: "Gallery" });
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {albums.map((a, i) => (
        <li key={a.id}>
          <Reveal delay={i * 0.05}>
            <Link href={`/gallery/${a.slug}`} className="group block overflow-hidden rounded-3xl border border-border bg-background shadow-sm transition-shadow hover:shadow-md">
              <div className="aspect-[4/3] overflow-hidden bg-lavender">
                {a.cover ? (
                  <SiteImage image={a.cover} alt="" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center text-primary/40"><Images className="size-10" aria-hidden /></div>
                )}
              </div>
              <div className="p-5">
                <h3 className="font-serif text-xl text-purple-deep">{a.title}</h3>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  {t("photos", { count: a.photoCount })}
                  {a.invitationOnly && (
                    <span className="inline-flex items-center gap-1 text-gold-ink"><Lock className="size-3" aria-hidden />{t("guestsOnly")}</span>
                  )}
                </p>
              </div>
            </Link>
          </Reveal>
        </li>
      ))}
    </ul>
  );
}

export async function GallerySection({ locale, albums }: { locale: AppLocale; albums: PublicAlbum[] }) {
  const t = await getTranslations({ locale, namespace: "Gallery" });
  return (
    <Section id="gallery" eyebrow={t("eyebrow")} title={t("title")} tone="lavender">
      <AlbumGrid locale={locale} albums={albums} />
    </Section>
  );
}
