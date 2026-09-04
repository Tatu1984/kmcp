import * as Sentry from "@sentry/nextjs";
import { redactUrl, scrubBreadcrumb, scrubEvent } from "./scrub";

/**
 * Error reporting for the portal.
 *
 * Until this existed, a failure in the browser was visible to nobody: the
 * officer saw a red toast, closed it, and tried again. Nothing reached anyone
 * who could fix it.
 *
 * Two things make this more than an install.
 *
 * Every reported event carries the API's correlation id as a tag. The proxy
 * stamps `x-request-id` on the way in, the API echoes it in `meta.requestId`,
 * `ApiError` carries it, and it is written against every audit row the request
 * produced — so `request_id:<value>` in Sentry and the same value in the audit
 * trail land on the same request. Without that a report says "a settlement
 * approval failed"; with it, it says which one.
 *
 * And every event is stripped of citizen data before it leaves — see `scrub.ts`
 * for exactly which fields and why.
 *
 * With no `NEXT_PUBLIC_SENTRY_DSN` (browser) or `SENTRY_DSN` (server) this is
 * inert. The demo build, which runs on bundled mock data with no backend at
 * all, must not need a Sentry account to start.
 */

/**
 * Options shared by the browser, Node and Edge initialisations.
 *
 * They are shared deliberately: the scrubbing rules are a promise about what
 * this platform sends to a third party, and a promise kept in one runtime and
 * forgotten in another is not kept.
 */
export function sentryOptions(dsn: string) {
  return {
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
      process.env.NEXT_PUBLIC_VERCEL_ENV ??
      process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

    /**
     * The SDK's own idea of "personally identifiable information" is IP
     * addresses and headers. Ours is wider and is enforced in `beforeSend`;
     * this switch is the coarse half of the same decision, and off is the only
     * defensible default for a portal onto citizen records.
     */
    sendDefaultPii: false,

    // Errors only. Tracing would sample spans whose names and attributes carry
    // the very identifiers `beforeSend` exists to remove.
    tracesSampleRate: 0,

    /**
     * Session Replay stays off, and not for cost reasons. It records the DOM,
     * and the DOM of this portal is a table of registration numbers next to the
     * phone numbers of the people who own them. There is no masking
     * configuration that makes shipping a video of that acceptable.
     */
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    beforeSend: (event: Sentry.ErrorEvent) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb: Sentry.Breadcrumb) => scrubBreadcrumb(breadcrumb),
  };
}

let enabled = false;

/** True once a DSN has been configured and the SDK started. */
export const isErrorReportingEnabled = (): boolean => enabled;

/**
 * Starts the SDK for whichever runtime is calling, or does nothing at all when
 * no DSN is configured. Returns whether reporting is on.
 *
 * "Does nothing" is load-bearing rather than incidental: the SDK is not
 * initialised, no handlers are installed, and `reportApiError` returns before
 * it touches Sentry. A local run and the demo deployment behave as though this
 * module were not here.
 */
export function initSentry(dsn: string | undefined): boolean {
  const configured = dsn?.trim();
  if (!configured) return false;
  Sentry.init(sentryOptions(configured));
  enabled = true;
  return true;
}

/**
 * The parts of `ApiError` this module needs.
 *
 * Structural rather than an import of `ApiError` itself, because
 * `frontend/api/client.ts` imports *this* module — taking the class back the
 * other way would make the two files a cycle, and a cycle in the module that
 * has to work while everything else is failing is not worth the tidiness.
 */
export interface ReportableError extends Error {
  code: string;
  status: number;
  requestId?: string;
}

/**
 * Whether an API failure is an incident or just an answer.
 *
 * Ordinary 4xx are answers. A 403 is the authorisation layer doing its job, a
 * 404 is a stale bookmark, a 409 is two officers editing the same tariff, a 422
 * is a form that needs correcting, a 429 is the rate limiter working. Reporting
 * those would bury the ones that matter and teach everyone to ignore the inbox.
 *
 * Three cases are exceptions to that rule:
 *
 * `TIMEOUT` and any 5xx mean the API failed to answer. Neither is a decision
 * anybody made, and both are invisible from the server side when the cause is
 * that the server never got there.
 *
 * `TOKEN_REUSED` is a 401, and it is reported anyway, because it is almost
 * never the user's doing. A refresh token is single-use and presenting one
 * twice revokes the whole family — so this arriving usually means the portal
 * raced itself into it, which is the bug `refreshTokens()` is written to
 * prevent. A silent regression there signs people out for no reason, and the
 * only way anyone would find out is this.
 *
 * `NETWORK_ERROR` is deliberately *not* reported. It is raised for everything
 * from a tunnel to a dead backend, and the browser cannot tell those apart. On
 * a handheld on a municipal connection it would arrive constantly and mean
 * nothing; the portal already explains a persistently unreachable API on the
 * screen itself (see `emptyReason`).
 */
export function isReportable(error: ReportableError): boolean {
  if (error.status >= 500) return true;
  if (error.code === "TIMEOUT") return true;
  if (error.code === "TOKEN_REUSED") return true;
  return false;
}

/**
 * Reports one API failure, tagged so it can be found again.
 *
 * `request_id`, `error_code` and `http_status` are tags rather than context
 * because Sentry only indexes tags for search — context is readable but not
 * queryable, and an id nobody can search for correlates with nothing.
 *
 * The fingerprint groups by code and status rather than by stack. Every
 * `ApiError` in the portal is thrown from the same line of `client.ts`, so the
 * default grouping would file a database outage and a failed PDF render as one
 * issue and show a single unhelpful stack for both.
 */
export function reportApiError(
  error: ReportableError,
  context?: { method?: string; url?: string },
): void {
  if (!enabled || !isReportable(error)) return;

  Sentry.withScope((scope) => {
    if (error.requestId) scope.setTag("request_id", error.requestId);
    scope.setTag("error_code", error.code);
    scope.setTag("http_status", String(error.status));
    if (context?.method) scope.setTag("http_method", context.method);
    // Redacted here rather than in `beforeSend`: this lands in `contexts`,
    // which `scrubEvent` does not walk, and a list screen's URL is where a
    // plate most reliably turns up (`GET /sessions?plate=…`).
    if (context?.url) {
      scope.setContext("api_request", { method: context.method, url: redactUrl(context.url) });
    }
    scope.setFingerprint(["api-error", error.code, String(error.status)]);
    Sentry.captureException(error);
  });
}
