"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/server/action-result";

/**
 * Runs a Server Action with consistent UX: pending state, localized error
 * toast, optional success toast and router refresh. Returns the result so
 * forms can map field errors.
 */
export function useAction() {
  const tErr = useTranslations("Errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    <T,>(
      action: () => Promise<ActionResult<T>>,
      opts: { success?: string; refresh?: boolean; onSuccess?: (data: T) => void; onError?: (r: Extract<ActionResult<T>, { ok: false }>) => void } = {},
    ) =>
      new Promise<ActionResult<T>>((resolve) => {
        startTransition(async () => {
          let result: ActionResult<T>;
          try {
            result = await action();
          } catch {
            result = { ok: false, error: "unexpected" };
          }
          if (result.ok) {
            if (opts.success) toast.success(opts.success);
            opts.onSuccess?.(result.data);
            if (opts.refresh !== false) router.refresh();
          } else {
            if (result.error === "unauthorized") router.push("/admin/login");
            toast.error(tErr(result.error, result.details ?? {}));
            opts.onError?.(result);
          }
          resolve(result);
        });
      }),
    [router, tErr],
  );

  return { run, pending };
}
