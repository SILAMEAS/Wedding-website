import type { z } from "zod";
import { logger } from "@/lib/logger";
import { AppError, type ErrorCode } from "./errors";

/**
 * Uniform, serializable result for every Server Action.
 * `error` and `fieldErrors` values are message keys ("Errors.x" / "Validation.y"),
 * never raw exception text.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorCode; fieldErrors?: Record<string, string>; details?: Record<string, string | number> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}

/** Converts thrown errors into a safe ActionResult. Next.js control-flow errors (redirect/notFound) are re-thrown. */
export function toActionResult(error: unknown, context: string): ActionResult<never> {
  if (error instanceof AppError) {
    return { ok: false, error: error.code, details: error.details };
  }
  const digest = (error as { digest?: string })?.digest;
  if (typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR"))) {
    throw error;
  }
  logger.error("action.unexpected", { context, error });
  return { ok: false, error: "unexpected" };
}

/** Validate input, run the use case, map failures. */
export async function runAction<S extends z.ZodType, T>(
  context: string,
  schema: S,
  input: unknown,
  fn: (data: z.infer<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalidInput", fieldErrors: fieldErrorsFrom(parsed.error) };
  try {
    return ok(await fn(parsed.data));
  } catch (error) {
    return toActionResult(error, context);
  }
}
