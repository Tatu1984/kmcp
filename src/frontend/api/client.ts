import { clientEnv } from "@/config/env";
import { API_CONFIG } from "@/config/api.config";
import { reportApiError } from "@/observability/sentry";
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

/**
 * Reports the error, then hands it back to be thrown.
 *
 * Every failure in this file leaves through here, so nothing can be added later
 * that fails silently. `reportApiError` decides what is worth reporting —
 * ordinary 4xx are not; see the note on `isReportable` — and carries
 * `ApiError.requestId` through as a tag so the event and the API's own audit
 * rows for the same request can be found from one another.
 *
 * The URL carries its query string, because which filters a screen had applied
 * is most of what distinguishes one failing list from another. It is redacted
 * before it is sent — a search box here is routinely a registration number.
 *
 * Reporting must never be the reason a request fails, so it is best-effort:
 * whatever happens in there, the caller still gets the ApiError it expected.
 */
function fail(error: ApiError, method: string | undefined, url: string): ApiError {
  try {
    reportApiError(error, { method, url });
  } catch {
    // An error-reporting failure is not worth replacing the real error with.
  }
  return error;
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

  const url = buildUrl(path, query);

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw fail(
        new ApiError("TIMEOUT", "The request took too long. Please try again.", 408),
        options.method,
        url,
      );
    }
    throw fail(
      new ApiError("NETWORK_ERROR", "Could not reach the server. Check your connection.", 0),
      options.method,
      url,
    );
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
    throw fail(
      new ApiError(
        payload?.error?.code ?? "INTERNAL_ERROR",
        payload?.error?.message ?? "Something went wrong on our side.",
        response.status,
        payload?.error?.details,
        payload?.meta?.requestId,
      ),
      options.method,
      url,
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

/**
 * Every row of a list endpoint, fetched a page at a time.
 *
 * The API refuses a `pageSize` above `API_CONFIG.maxPageSize` — and refuses it
 * by rejecting the whole request, not by returning fewer rows. A screen that
 * asked for 200 in one go therefore showed nothing at all, which read as a lost
 * write: the create returned 201, the reload 400, and the new row never
 * appeared. Ask for pages the API will actually serve instead.
 *
 * `limit` is the point at which a screen stops asking. It exists so a table
 * that is only ever scanned by eye cannot walk a hundred thousand rows.
 */
export async function listAll<T>(
  fetchPage: (page: number, pageSize: number) => Promise<ApiResult<T[]>>,
  limit = 1000,
): Promise<T[]> {
  const pageSize = Math.min(API_CONFIG.maxPageSize, limit);
  const rows: T[] = [];

  for (let page = 1; rows.length < limit; page++) {
    const result = await fetchPage(page, pageSize);
    rows.push(...result.data);
    // A short page is the last page. `total` ends it one request earlier when
    // the endpoint reports one.
    if (result.data.length < pageSize) break;
    if (result.meta.total !== undefined && rows.length >= result.meta.total) break;
  }

  return rows.length > limit ? rows.slice(0, limit) : rows;
}
