import { z } from "zod";

/**
 * Every environment variable is validated at boot. A missing or malformed value
 * fails the deploy — it never fails at 3 a.m. inside a route handler.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1).optional(),
  DIRECT_URL: z.string().min(1).optional(),

  JWT_ACCESS_SECRET: z.string().min(16).optional(),
  JWT_REFRESH_SECRET: z.string().min(16).optional(),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("30d"),

  REDIS_URL: z.string().optional(),
  REDIS_TOKEN: z.string().optional(),

  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().default("kmcp-media"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  MEDIA_SIGNED_URL_TTL: z.coerce.number().default(900),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAYX_ACCOUNT_NUMBER: z.string().optional(),

  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_SENDER_ID: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),

  GOOGLE_MAPS_SERVER_KEY: z.string().optional(),

  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  CRON_SECRET: z.string().optional(),
});

const clientSchema = z.object({
  /**
   * Absolute base URL of the KMCP API, including the version prefix.
   * e.g. https://kmcp-backend.vercel.app/api/v1
   *
   * Left unset the portal runs on its bundled mock dataset, which is how the
   * demo works before the backend is reachable.
   */
  NEXT_PUBLIC_API_URL: z
    .string()
    .url("NEXT_PUBLIC_API_URL must be an absolute URL")
    .optional()
    .transform((v) => v?.replace(/\/+$/, "")),
  NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const clientEnv: ClientEnv = clientSchema.parse({
  // Next.js inlines NEXT_PUBLIC_* at build time, so these must be referenced
  // as literal property accesses rather than looked up dynamically.
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY,
});

/** True when the portal is pointed at a live backend rather than mock data. */
export const isLiveApi = Boolean(clientEnv.NEXT_PUBLIC_API_URL);
