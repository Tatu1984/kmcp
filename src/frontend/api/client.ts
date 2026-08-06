import { clientEnv } from "@/config/env";
import { API_CONFIG } from "@/config/api.config";
import type { ApiMeta } from "@/shared/types/common.types";

/** Thrown for every non-2xx response. Branch on `code`, never on `message`. */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: { field: string; issue: string }[],
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** True when re-authenticating would plausibly fix it. */
  get isAuthError(): boolean {
    return this.status === 401 || this.code === "TOKEN_REUSED";
  }

  get isValidationError(): boolean {
    return this.code === "VALIDATION_FAILED";
  }

  /** Field-keyed messages, ready to hand to react-hook-form. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.details ?? []).map((d) => [d.field, d.issue]));
  }
}

export interface ApiResult<T> {
  data: T;
  meta: ApiMeta;
}

type TokenPair = { accessToken: string; refreshToken: string };

const STORAGE_KEY = "kmcp.tokens";
const DEVICE_KEY = "kmcp.device";

/** Tokens live in memory; the copy in storage survives a page reload. */
let tokens: TokenPair | null = null;
let refreshInFlight: Promise<TokenPair | null> | null = null;

function readStoredTokens(): TokenPair | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TokenPair) : null;
  } catch {
    return null;
  }
}

export function setTokens(next: TokenPair | null): void {
  tokens = next;
  if (typeof window === "undefined") return;
  if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  else window.localStorage.removeItem(STORAGE_KEY);
}

export function getTokens(): TokenPair | null {
  return tokens ?? (tokens = readStoredTokens());
}

/** Stable per-browser id. The API requires it for device-bound accounts. */
export function deviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `web_${crypto.randomUUID()}`;
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export const apiBaseUrl = (): string =>
  clientEnv.NEXT_PUBLIC_API_URL ?? API_CONFIG.basePath;

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Required by the API on anything that creates money or a session. */
  idempotencyKey?: string;
  /** Skip the bearer token — used by login, OTP and the public surface. */
  anonymous?: boolean;
  timeoutMs?: number;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const base = apiBaseUrl();
  const url = new URL(
    `${base}${path.startsWith("/") ? path : `/${path}`}`,
    typeof window === "undefined" ? "http://localhost" : window.location.origin,
  );
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Exchanges the refresh token for a new pair.
 *
 * Refresh tokens are single-use — presenting one twice revokes the whole family
 * server-side. Concurrent 401s must therefore share one refresh, not race each
 * other into a self-inflicted TOKEN_REUSED.
 */
async function refreshTokens(): Promise<TokenPair | null> {
  const current = getTokens();
  if (!current?.refreshToken) return null;

  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(buildUrl("/auth/refresh"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!response.ok) {
        setTokens(null);
        return null;
      }
      const payload = (await response.json()) as { data: TokenPair };
      setTokens(payload.data);
      return payload.data;
    } catch {
      setTokens(null);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function send<T>(path: string, options: RequestOptions, retrying = false): Promise<ApiResult<T>> {
  const { body, query, idempotencyKey, anonymous, timeoutMs, headers, ...rest } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? API_CONFIG.timeoutMs);

  const requestHeaders = new Headers(headers);
  requestHeaders.set("accept", "application/json");
  if (body !== undefined) requestHeaders.set("content-type", "application/json");
  requestHeaders.set(API_CONFIG.headers.deviceId, deviceId());
  if (idempotencyKey) requestHeaders.set(API_CONFIG.headers.idempotencyKey, idempotencyKey);

  const auth = anonymous ? null : getTokens();
  if (auth?.accessToken) requestHeaders.set("authorization", `Bearer ${auth.accessToken}`);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      ...rest,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("TIMEOUT", "The request took too long. Please try again.", 408);
    }
    throw new ApiError("NETWORK_ERROR", "Could not reach the server. Check your connection.", 0);
  }
  clearTimeout(timer);

  // One transparent refresh, then give up — a second 401 means the session is
  // genuinely gone rather than merely expired.
  if (response.status === 401 && !anonymous && !retrying) {
    const refreshed = await refreshTokens();
    if (refreshed) return send<T>(path, options, true);
  }

  const payload = (await response.json().catch(() => null)) as
    | { success: boolean; data?: T; meta?: ApiMeta; error?: { code: string; message: string; details?: { field: string; issue: string }[] } }
    | null;

  if (!response.ok || !payload?.success) {
    throw new ApiError(
      payload?.error?.code ?? "INTERNAL_ERROR",
      payload?.error?.message ?? "Something went wrong on our side.",
      response.status,
      payload?.error?.details,
      payload?.meta?.requestId,
    );
  }

  return { data: payload.data as T, meta: payload.meta ?? { requestId: "unknown" } };
}

export const api = {
  get: <T>(path: string, options: RequestOptions = {}) =>
    send<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options: RequestOptions = {}) =>
    send<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options: RequestOptions = {}) =>
    send<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options: RequestOptions = {}) =>
    send<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, body?: unknown, options: RequestOptions = {}) =>
    send<T>(path, { ...options, method: "DELETE", body }),

  /** Unwraps the envelope for callers that do not need pagination meta. */
  data: async <T>(promise: Promise<ApiResult<T>>): Promise<T> => (await promise).data,
};
