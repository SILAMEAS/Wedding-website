import type { ReactNode } from "react";
import { Ornament } from "@/components/wedding/ornament";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

/** Consistent section wrapper: anchor id, eyebrow, serif heading, gold ornament. */
export function Section({
  id,
  eyebrow,
  title,
  children,
  className,
  tone = "white",
}: {
  id: string;
  eyebrow?: string;
  title: string;
  children: ReactNode;
  className?: string;
  tone?: "white" | "ivory" | "lavender";
}) {
  const bg = tone === "lavender" ? "bg-lavender/60" : tone === "ivory" ? "bg-ivory" : "bg-background";
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-20 px-5 py-20 sm:py-28", bg, className)}>
      <div className="mx-auto max-w-5xl">
        <Reveal className="mb-12 text-center">
          {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
          <h2 id={`${id}-title`} className="font-serif text-4xl text-purple-deep sm:text-5xl">
            {title}
          </h2>
          <Ornament className="mt-6" />
        </Reveal>
        {children}
      </div>
    </section>
  );
}
