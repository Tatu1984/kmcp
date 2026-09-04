import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import { initSentry, isReportable, reportApiError, type ReportableError } from "@/observability/sentry";
import { REDACTED, redact, redactQueryString, scrubBreadcrumb, scrubEvent } from "@/observability/scrub";

/**
 * The two promises this platform's error reporting makes.
 *
 * The first is that an event can be tied back to the request that caused it.
 * The correlation id is the only thing linking a Sentry issue to the audit rows
 * for the same request; if it stops being attached, reporting still "works" and
 * is worth considerably less.
 *
 * The second is that nothing personal leaves. That one is not a debugging
 * convenience — it is the reason the authority can allow error reporting at
 * all. It fails silently and invisibly: a field added to a request body ships
 * to a third party and nothing anywhere goes red. These tests are the only
 * thing that would notice.
 *
 * And in between: what counts as an incident. Reporting a 403 is not a bug that
 * loses data, but it is the bug that makes everyone stop reading the alerts.
 */

const scope = {
  setTag: vi.fn(),
  setContext: vi.fn(),
  setFingerprint: vi.fn(),
  setUser: vi.fn(),
};
const captureException = vi.fn();
const init = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  init: (...args: unknown[]) => init(...args),
  addBreadcrumb: vi.fn(),
  captureException: (...args: unknown[]) => captureException(...args),
  withScope: (callback: (s: typeof scope) => void) => callback(scope),
}));

const DSN = "https://publickey@o0.ingest.sentry.io/1";

const apiError = (
  code: string,
  status: number,
  requestId?: string,
): ReportableError => Object.assign(new Error(code), { code, status, requestId });

const tags = () => Object.fromEntries(scope.setTag.mock.calls);

beforeAll(() => {
  initSentry(DSN);
});

beforeEach(() => {
  scope.setTag.mockClear();
  scope.setContext.mockClear();
  scope.setFingerprint.mockClear();
  captureException.mockClear();
});

describe("starting up", () => {
  it("never starts the SDK, and reports nothing, with no DSN configured", async () => {
    /**
     * The condition on which every other decision here rests. A local run and
     * the demo build — bundled data, no backend — must not need a Sentry
     * account, and "no DSN" has to mean nothing is collected rather than
     * something is collected and quietly discarded.
     *
     * A fresh copy of the module, because the rest of this file deliberately
     * initialises the SDK.
     */
    vi.resetModules();
    init.mockClear();
    captureException.mockClear();
    const fresh = await import("@/observability/sentry");

    expect(fresh.initSentry(undefined)).toBe(false);
    // An unset variable reaches a build as an empty string on most hosts.
    expect(fresh.initSentry("   ")).toBe(false);
    expect(init).not.toHaveBeenCalled();
    expect(fresh.isErrorReportingEnabled()).toBe(false);

    fresh.reportApiError(apiError("INTERNAL_ERROR", 500, "req-1"));
    expect(captureException).not.toHaveBeenCalled();
  });

  it("keeps the privacy defaults that make reporting permissible at all", async () => {
    // Read off the options actually handed to the SDK, because each of these is
    // one config line away from being switched back on by someone following a
    // quickstart guide.
    vi.resetModules();
    init.mockClear();
    const fresh = await import("@/observability/sentry");

    expect(fresh.initSentry(DSN)).toBe(true);
    const options = init.mock.calls[0][0] as Record<string, unknown>;

    expect(options.sendDefaultPii).toBe(false);
    // Session Replay records the DOM, and the DOM here is a table of
    // registration numbers beside the phone numbers of their owners.
    expect(options.replaysSessionSampleRate).toBe(0);
    expect(options.replaysOnErrorSampleRate).toBe(0);
    // Span names and attributes carry the identifiers beforeSend removes.
    expect(options.tracesSampleRate).toBe(0);
    expect(typeof options.beforeSend).toBe("function");
    expect(typeof options.beforeBreadcrumb).toBe("function");
  });
});

describe("deciding what is an incident", () => {
  it.each([
    ["VALIDATION_FAILED", 400],
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["SESSION_ALREADY_ACTIVE", 409],
    ["ZONE_CLOSED", 422],
    ["RATE_LIMITED", 429],
  ])("stays quiet about an ordinary %s", (code, status) => {
    // Every one of these is the API answering correctly. A 403 is the
    // authorisation layer working; a 409 is two officers editing one tariff.
    // Alerting on them buries the failures that are actually ours.
    expect(isReportable(apiError(code, status))).toBe(false);
  });

  it.each([
    ["INTERNAL_ERROR", 500],
    ["SERVICE_UNAVAILABLE", 503],
  ])("reports a %s", (code, status) => {
    expect(isReportable(apiError(code, status))).toBe(true);
  });

  it("reports a timeout, because nobody decided anything", () => {
    // The request never got an answer. That is not a refusal, and it is
    // invisible from the server side when the cause is that it never arrived.
    expect(isReportable(apiError("TIMEOUT", 408))).toBe(true);
  });

  it("reports TOKEN_REUSED even though it is a 401", () => {
    /**
     * The deliberate exception. A refresh token is single-use, so this arriving
     * usually means the portal raced itself into revoking its own token
     * family — the bug `refreshTokens()` is written to prevent. It signs an
     * officer out mid-task and nothing else would ever surface it.
     */
    expect(isReportable(apiError("TOKEN_REUSED", 401))).toBe(true);
  });

  it("stays quiet about a network failure", () => {
    // Raised for a tunnel, a lift, a dead backend and a CORS mistake alike, and
    // the browser cannot tell them apart. On a handheld it would arrive
    // constantly; the portal explains a persistently unreachable API on-screen.
    expect(isReportable(apiError("NETWORK_ERROR", 0))).toBe(false);
  });
});

describe("reporting one", () => {
  it("carries the request id through as a searchable tag", () => {
    reportApiError(apiError("INTERNAL_ERROR", 500, "req-9f3c"), {
      method: "POST",
      url: "/settlements/set-1/approve",
    });

    // A tag, not context: Sentry indexes tags for search, and an id nobody can
    // search for correlates with nothing.
    expect(tags().request_id).toBe("req-9f3c");
    expect(tags().error_code).toBe("INTERNAL_ERROR");
    expect(tags().http_status).toBe("500");
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it("groups by code and status rather than by stack", () => {
    // Every ApiError in the portal is thrown from one line of client.ts, so the
    // default grouping would file a database outage and a failed report render
    // as a single issue with one unhelpful stack.
    reportApiError(apiError("SERVICE_UNAVAILABLE", 503, "req-1"));

    expect(scope.setFingerprint).toHaveBeenCalledWith(["api-error", "SERVICE_UNAVAILABLE", "503"]);
  });

  it("redacts the request path it attaches", () => {
    // `contexts` is not walked by `beforeSend`, and a list URL is where a plate
    // most reliably turns up.
    reportApiError(apiError("INTERNAL_ERROR", 500), {
      method: "GET",
      url: "/sessions?plate=KA01AB1234&status=ACTIVE",
    });

    expect(scope.setContext).toHaveBeenCalledWith("api_request", {
      method: "GET",
      url: `/sessions?plate=${encodeURIComponent(REDACTED)}&status=ACTIVE`,
    });
  });

  it("sends nothing at all for an ordinary refusal", () => {
    reportApiError(apiError("FORBIDDEN", 403, "req-2"));

    expect(captureException).not.toHaveBeenCalled();
    expect(scope.setTag).not.toHaveBeenCalled();
  });
});

describe("stripping citizen data", () => {
  it("redacts a registration number, a phone number and a position", () => {
    const cleaned = redact({
      id: "sess-1",
      plateNumber: "KA01AB1234",
      phone: "9000000000",
      startLat: 12.9716,
      startLng: 77.5946,
      status: "ACTIVE",
    }) as Record<string, unknown>;

    expect(cleaned).toEqual({
      id: "sess-1",
      plateNumber: REDACTED,
      phone: REDACTED,
      startLat: REDACTED,
      startLng: REDACTED,
      // Ids and states are what triage actually reads, and identify nobody.
      status: "ACTIVE",
    });
  });

  it("matches a field name however it is spelled", () => {
    // The API, the Prisma schema and a hand-written form all disagree about
    // casing and underscores. A rule that only caught one of them would leak.
    const cleaned = redact({
      plate_number: "KA01AB1234",
      PhoneNumber: "9000000000",
      "contact-phone": "9000000001",
    }) as Record<string, string>;

    expect(Object.values(cleaned)).toEqual([REDACTED, REDACTED, REDACTED]);
  });

  it("reaches into nested objects and arrays", () => {
    // A settlement detail is lines inside a settlement; a session list is rows.
    // Redacting only the top level would cover almost nothing this API returns.
    const cleaned = redact({
      lines: [{ payment: { session: { plateNumber: "KA01AB1234", code: "S-1" } } }],
    }) as { lines: { payment: { session: Record<string, string> } }[] };

    expect(cleaned.lines[0].payment.session).toEqual({ plateNumber: REDACTED, code: "S-1" });
  });

  it("cleans a query string in each of the three shapes Sentry uses", () => {
    expect(redactQueryString("?plate=KA01AB1234&page=2")).toBe(
      `?plate=${encodeURIComponent(REDACTED)}&page=2`,
    );
    expect(redactQueryString([["phone", "9000000000"], ["page", "2"]])).toEqual([
      ["phone", REDACTED],
      ["page", "2"],
    ]);
    expect(redactQueryString({ lat: "12.97", page: "2" })).toEqual({ lat: REDACTED, page: "2" });
  });

  it("cleans an event's body, query, URL, headers and cookies", () => {
    const event = scrubEvent({
      request: {
        url: "https://portal.kmcp.test/sessions?plate=KA01AB1234",
        query_string: "plate=KA01AB1234",
        data: { plateNumber: "KA01AB1234", zoneId: "zone-1" },
        headers: {
          authorization: "Bearer secret-token",
          "x-request-id": "req-42",
          "content-type": "application/json",
        },
        cookies: { kmcp_session: "admin" },
      },
      user: { id: "user-1", email: "officer@example.gov.in", ip_address: "203.0.113.9" },
    } as unknown as ErrorEvent);

    expect(event.request?.data).toEqual({ plateNumber: REDACTED, zoneId: "zone-1" });
    expect(event.request?.query_string).toBe(`plate=${encodeURIComponent(REDACTED)}`);
    expect(event.request?.url).toContain(encodeURIComponent(REDACTED));
    // The bearer token is a live credential and aids nothing.
    expect(event.request?.headers).not.toHaveProperty("authorization");
    expect(event.request?.cookies).toBeUndefined();
    // The correlation id is the one header that must survive — it is the whole
    // point of the instrumentation.
    expect(event.request?.headers?.["x-request-id"]).toBe("req-42");
    // Which account hit this is most of triage; who they are is not.
    expect(event.user).toEqual({ id: "user-1" });
  });

  it("cleans the URL out of a fetch breadcrumb", () => {
    // A search box writes straight into a query string, and every fetch the
    // portal makes leaves a breadcrumb behind.
    const crumb = scrubBreadcrumb({
      category: "fetch",
      data: { method: "GET", url: "/api/v1/sessions?plate=KA01AB1234", status_code: 500 },
    } as Breadcrumb);

    expect(crumb?.data?.url).toBe(`/api/v1/sessions?plate=${encodeURIComponent(REDACTED)}`);
    expect(crumb?.data?.status_code).toBe(500);
  });

  it("drops a console breadcrumb rather than pretending to clean it", () => {
    // Whatever was passed to console.log, flattened into a message. There are
    // no field names for a name-based rule to match on, and a breadcrumb trail
    // that looks scrubbed and is not would be worse than none.
    expect(scrubBreadcrumb({ category: "console", message: "plate KA01AB1234 not found" })).toBeNull();
  });
});
