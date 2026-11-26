/**
 * Minimal structured (JSON-lines) logger.
 * Sensitive keys are redacted recursively so tokens, passwords, cookies and
 * contact details never reach log storage, even if passed by mistake.
 */

type Level = "debug" | "info" | "warn" | "error";
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SENSITIVE_KEY = /pass(word)?|secret|token|cookie|authorization|session|pepper|api[_-]?key|phone|email|evidence/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1),
      ]),
    );
  }
  return value;
}

function threshold(): number {
  const lvl = (process.env.LOG_LEVEL ?? "info") as Level;
  return order[lvl] ?? order.info;
}

function write(level: Level, msg: string, ctx?: Record<string, unknown>) {
  if (order[level] < threshold()) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...(ctx ? (redact(ctx) as object) : {}) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => write("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => write("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => write("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => write("error", msg, ctx),
};
