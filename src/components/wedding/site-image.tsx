import type { ImageRef } from "@/lib/storage";
import { cn } from "@/lib/utils";

/** Responsive, lazy-loaded <img> for Cloudinary/local media (srcset when the store can resize). */
export function SiteImage({
  image,
  alt,
  sizes = "100vw",
  className,
  priority = false,
}: {
  image: ImageRef;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- media is already optimized by Cloudinary transformations
    <img
      src={image.src}
      srcSet={image.srcSet}
      sizes={image.srcSet ? sizes : undefined}
      width={image.width ?? undefined}
      height={image.height ?? undefined}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={cn("h-auto max-w-full", className)}
    />
  );
}
