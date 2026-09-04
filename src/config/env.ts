import { z } from "zod";
import { API_CONFIG } from "@/config/api.config";

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

  /**
   * Where browser errors are reported.
   *
   * Separate from the server's `SENTRY_DSN` above, and necessarily so: only
   * NEXT_PUBLIC_ variables are compiled into the bundle, and the failures worth
   * hearing about — a table that will not load, a save that returns a 500 —
   * happen in the browser. A DSN is a write-only ingest endpoint and is meant
   * to be public, so this leaks nothing that setting it does not already imply.
   *
   * Unset means no reporting at all rather than a degraded one. The demo build
   * runs on bundled data with no backend and must not need a Sentry account.
   */
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

/**
 * Repairs the two ways an API address is habitually mistyped, and leaves
 * anything else for the schema to reject.
 *
 * A Vercel project settings field is filled by pasting a domain, so the value
 * arrives as a bare host with no scheme — which is unambiguous, and not worth
 * failing a deploy over. A missing version prefix is the same paste one step
 * later: an origin with no path cannot be the base of an API that serves every
 * route under /api/v1, so the prefix is supplied rather than left to become a
 * building deployment where every request 404s.
 *
 * A value that already carries a path is never touched — that is a deliberate
 * choice about where the API lives, and guessing over it would be worse than
 * either mistake this repairs.
 *
 * Returns null when the value cannot be read as a URL at all, so the caller
 * reports it against what was actually set rather than against a repair.
 */
function normalizeApiUrl(value: string): string | null {
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
  let url: URL;
  try {
    url = new URL(hasScheme ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;

  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path === "" ? API_CONFIG.basePath : path}`;
}

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

function parseClientEnv(): ClientEnv {
  // Next.js inlines NEXT_PUBLIC_* at build time, so these must be referenced
  // as literal property accesses rather than looked up dynamically.
  const configured = {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  };

  // An empty string is how an unset variable reaches a build on most hosts.
  const apiUrl = configured.NEXT_PUBLIC_API_URL?.trim() || undefined;
  const normalizedApiUrl = apiUrl === undefined ? undefined : (normalizeApiUrl(apiUrl) ?? apiUrl);

  if (typeof window === "undefined" && normalizedApiUrl !== undefined && normalizedApiUrl !== apiUrl) {
    console.info(
      `NEXT_PUBLIC_API_URL: read "${apiUrl}" as "${normalizedApiUrl}". ` +
        "Set the full address to silence this.",
    );
  }

  const raw = { ...configured, NEXT_PUBLIC_API_URL: normalizedApiUrl };

  const parsed = clientSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  /**
   * Failing the build here is deliberate — a bad API address must not reach
   * production — but the message has to say what was wrong with it.
   *
   * A bare ZodError names the variable and not its value, which sends whoever
   * is reading the build log to the code rather than to the setting. These are
   * NEXT_PUBLIC_ variables, so echoing them leaks nothing: they are compiled
   * into the bundle every browser downloads.
   */
  const issues = parsed.error.issues
    .map((issue) => {
      const key = String(issue.path[0]);
      // Report what is set in the dashboard, not what normalizing made of it.
      const received = configured[key as keyof typeof configured];
      return `  ${key}: ${issue.message}\n    received: ${JSON.stringify(received)}`;
    })
    .join("\n");

  throw new Error(
    `Invalid public environment configuration:\n${issues}\n\n` +
      "An API address needs its scheme and version prefix, for example:\n" +
      "  NEXT_PUBLIC_API_URL=https://kmcp-backend.vercel.app/api/v1\n" +
      "Leave it unset entirely to run the portal on its bundled demonstration data.",
  );
}

export const clientEnv: ClientEnv = parseClientEnv();

/** True when the portal is pointed at a live backend rather than mock data. */
export const isLiveApi = Boolean(clientEnv.NEXT_PUBLIC_API_URL);
