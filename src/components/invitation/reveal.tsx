"use client";

import { motion } from "motion/react";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import type { ReactNode } from "react";

/** Gentle fade-up when scrolled into view. Disabled for prefers-reduced-motion. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = usePrefersReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      data-reveal
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
