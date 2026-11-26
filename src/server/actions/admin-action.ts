import "server-only";
import type { z } from "zod";
import { type ActionResult, runAction, toActionResult } from "@/server/action-result";
import type { AdminContext } from "@/server/context";
import { requireAdminOrThrow } from "@/server/policies/admin";

/**
 * Every admin Server Action goes through here:
 *   1. authenticate (server-side session check — never trust the UI)
 *   2. validate input with Zod
 *   3. run the use case with an explicit AdminContext
 *   4. return a typed, safe result (no raw error text)
 */
export async function adminAction<S extends z.ZodType, T>(
  context: string,
  schema: S,
  input: unknown,
  fn: (ctx: AdminContext, data: z.infer<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const ctx = await requireAdminOrThrow();
    return await runAction(context, schema, input, (data) => fn(ctx, data));
  } catch (error) {
    return toActionResult(error, context);
  }
}
