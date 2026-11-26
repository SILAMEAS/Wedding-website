import type { z } from "zod";

/** Zod issues → { "path.to.field": "validationKey" } (first issue per path). */
export function fieldErrorsFromIssues(issues: z.core.$ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.join(".") || "_form";
    out[key] ??= i.message;
  }
  return out;
}
