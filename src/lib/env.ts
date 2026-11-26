import { z } from "zod";

/**
 * Server environment, validated once with Zod.
 * Called at server start from src/instrumentation.ts, so a misconfigured
 * deployment fails immediately instead of on the first request.
 * Never import this from a Client Component — it contains secrets.
 */

const secret = (name: string) =>
  z
    .string({ error: `${name} is required` })
    .min(32, `${name} must be at least 32 characters (use 32+ random bytes)`);

const base64Key32 = z
  .string({ error: "TOKEN_ENCRYPTION_KEY is required" })
  .refine((v) => {
    try {
      return Buffer.from(v, "base64").length === 32;
    } catch {
      return false;
    }
  }, "TOKEN_ENCRYPTION_KEY must be 32 random bytes encoded as base64");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: "DATABASE_URL must be a postgresql:// URL" }),
    DIRECT_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
    APP_URL: z.url({ protocol: /^https?$/, error: "APP_URL must be an http(s) URL" }),
    AUTH_SECRET: secret("AUTH_SECRET"),
    TOKEN_HASH_PEPPER: secret("TOKEN_HASH_PEPPER"),
    TOKEN_ENCRYPTION_KEY: base64Key32,
    CRON_SECRET: secret("CRON_SECRET"),
    NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(["kh", "en"]).default("kh"),
    TIME_ZONE: z.literal("Asia/Phnom_Penh").default("Asia/Phnom_Penh"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    MEDIA_STORAGE: z.enum(["cloudinary", "local"]).default("local"),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    CLOUDINARY_FOLDER: z.string().default("sila-kimsour"),
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.MEDIA_STORAGE === "cloudinary") {
      for (const key of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required when MEDIA_STORAGE=cloudinary` });
      }
    }
    if (env.NODE_ENV === "production") {
      if (env.MEDIA_STORAGE !== "cloudinary") {
        ctx.addIssue({ code: "custom", path: ["MEDIA_STORAGE"], message: "MEDIA_STORAGE must be 'cloudinary' in production" });
      }
      if (!env.APP_URL.startsWith("https://")) {
        ctx.addIssue({ code: "custom", path: ["APP_URL"], message: "APP_URL must use https in production" });
      }
    }
  });

export type ServerEnv = z.infer<typeof envSchema>;

let cached: ServerEnv | undefined;

export function parseEnv(source: Record<string, string | undefined>): ServerEnv {
  // Treat empty strings as "unset" so blank lines in .env behave like missing values.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ""));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const details = result.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}

export function env(): ServerEnv {
  cached ??= parseEnv(process.env);
  return cached;
}
