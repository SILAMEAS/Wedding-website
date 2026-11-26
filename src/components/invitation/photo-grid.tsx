"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import "yet-another-react-lightbox/plugins/captions.css";
import "yet-another-react-lightbox/styles.css";
import type { ImageRef } from "@/lib/storage";

type Photo = { id: string; thumb: ImageRef; full: ImageRef; caption: string; alt: string };

/** Masonry-style grid + fullscreen lightbox (keyboard, swipe, captions). */
export function PhotoGrid({ photos }: { photos: Photo[] }) {
  const t = useTranslations("Gallery");
  const [index, setIndex] = useState(-1);

  return (
    <>
      <ul className="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4">
        {photos.map((p, i) => (
          <li key={p.id} className="mb-3 break-inside-avoid sm:mb-4">
            <button
              type="button"
              onClick={() => setIndex(i)}
              className="group block w-full overflow-hidden rounded-2xl bg-lavender focus-visible:ring-4 focus-visible:ring-ring/40"
              aria-label={t("openPhoto", { n: i + 1, total: photos.length })}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary-optimized srcset */}
              <img
                src={p.thumb.src}
                srcSet={p.thumb.srcSet}
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                width={p.thumb.width ?? undefined}
                height={p.thumb.height ?? undefined}
                alt={p.alt}
                loading={i < 6 ? "eager" : "lazy"}
                decoding="async"
                className="h-auto w-full transition-transform duration-700 group-hover:scale-105"
              />
            </button>
            {p.caption && <p className="mt-1.5 px-1 text-xs text-muted-foreground">{p.caption}</p>}
          </li>
        ))}
      </ul>
      <Lightbox
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        plugins={[Captions]}
        captions={{ descriptionTextAlign: "center" }}
        labels={{ Previous: t("previous"), Next: t("next"), Close: t("close"), Lightbox: t("title") }}
        slides={photos.map((p) => ({
          src: p.full.src,
          alt: p.alt,
          width: p.full.width ?? undefined,
          height: p.full.height ?? undefined,
          description: p.caption || undefined,
        }))}
        styles={{ container: { backgroundColor: "rgba(41, 35, 50, 0.94)" } }}
      />
    </>
  );
}
