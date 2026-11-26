"use client";

import { useSyncExternalStore } from "react";

/*
 * Hydration-safe prefers-reduced-motion. motion's useReducedMotion() reads the
 * media query during the first client render, so for reduced-motion users the
 * client markup differs from the server HTML (hydration error). Here the server
 * snapshot (also used while hydrating) is `false`; React re-renders with the
 * real value straight after hydration.
 */
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
