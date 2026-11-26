import { cn } from "@/lib/utils";

/** Thin champagne-gold divider with a small diamond, used between headings and copy. */
export function Ornament({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex items-center justify-center gap-3 text-gold", className)}>
      <span className="h-px w-12 bg-current opacity-60" />
      <svg width="10" height="10" viewBox="0 0 10 10" className="fill-current">
        <path d="M5 0 10 5 5 10 0 5Z" />
      </svg>
      <span className="h-px w-12 bg-current opacity-60" />
    </div>
  );
}
