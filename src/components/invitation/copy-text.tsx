"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyText({ value, label, copied }: { value: string; label: string; copied: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={done ? copied : label}
      title={done ? copied : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="inline-flex size-8 items-center justify-center rounded-full border border-border hover:bg-lavender"
    >
      {done ? <Check className="size-4 text-primary" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      <span className="sr-only" aria-live="polite">{done ? copied : ""}</span>
    </button>
  );
}
