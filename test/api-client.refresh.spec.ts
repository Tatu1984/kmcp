import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The one piece of the portal that can sign a working session out.
 *
 * `send()` refreshes transparently on a 401 and retries once. Every failure
 * mode of that is silent from the user's side and identical from the outside —
 * they are simply back at the login screen, mid-task, with no explanation. So
 * the cases here are the ways it can go wrong rather than the way it goes
 * right:
 *
 *  - refreshing more than once, or not at all, on a single 401;
 *  - two requests failing at the same moment and racing each other into the
 *    self-inflicted TOKEN_REUSED the file's own comment warns about, which
 *    revokes the whole token family and is not recoverable by retrying;
 *  - retrying forever when the session is genuinely gone;
 *  - leaving dead tokens in localStorage after a refusal, so the next page load
 *    starts authenticated-looking and immediately is not.
 *
 * The error envelope and the two synthetic failures — timeout and network —
 * are here too, because every screen branches on `code` and a code that stops
 * being produced turns a specific message into "something went wrong".
 */

// Reporting is exercised in error-reporting.spec.ts. Here it is stubbed so a
// test never depends on the SDK being loadable, and so a report can be asserted
// on without the SDK's own filtering getting in the way.
const reportApiError = vi.fn();
vi.mock("@/observability/sentry", () => ({ reportApiError }));

type Client = typeof import("@/frontend/api/client");

const TOKENS = { accessToken: "access-1", refreshToken: "refresh-1" };
const REFRESHED = { accessToken: "access-2", refreshToken: "refresh-2" };

const ok = (data: unknown, meta: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ success: true, data, meta: { requestId: "req-ok", ...meta } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const failure = (
  status: number,
  error: { code: string; message?: string; details?: { field: string; issue: string }[] },
  meta: Record<string, unknown> = {},
) =>
  new Response(
    JSON.stringify({
      success: false,
      error: { message: "no", ...error },
      meta: { requestId: "req-fail", ...meta },
    }),
    { status, headers: { "content-type": "application/json" } },
  );

const isRefresh = (input: RequestInfo | URL) => String(input).includes("/auth/refresh");

/**
 * A fresh copy of the module for every test.
 *
 * `tokens` and `refreshInFlight` are module-level state by design — one refresh
 * per browser tab is the point — which means a test that did not reset the
 * registry would inherit the previous test's in-flight promise.
 */
async function loadClient(): Promise<Client> {
  vi.resetModules();
  const client = await import("@/frontend/api/client");
  client.setTokens(TOKENS);
  return client;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  reportApiError.mockClear();
  window.localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("refreshing an expired access token", () => {
  it("refreshes once and replays the original request", async () => {
    fetchMock
      .mockResolvedValueOnce(failure(401, { code: "UNAUTHENTICATED" }))
      .mockResolvedValueOnce(ok(REFRESHED))
      .mockResolvedValueOnce(ok([{ id: "zone-1" }]));

    const { api, getTokens } = await loadClient();
    const result = await api.get<{ id: string }[]>("/zones");

    expect(result.data).toEqual([{ id: "zone-1" }]);
    expect(fetchMock.mock.calls.filter(([input]) => isRefresh(input))).toHaveLength(1);
    // The replay must carry the new token, not the one that was just refused.
    const replayHeaders = fetchMock.mock.calls[2][1].headers as Headers;
    expect(replayHeaders.get("authorization")).toBe(`Bearer ${REFRESHED.accessToken}`);
    expect(getTokens()).toEqual(REFRESHED);
  });

  it("shares one refresh between two requests that expire together", async () => {
    /**
     * The case the file's comment is about. A refresh token is single-use, so a
     * second refresh presented while the first is still in flight revokes the
     * family server-side and signs the officer out for no reason at all. Two
     * dashboard widgets loading at once is enough to cause it.
     */
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (isRefresh(input)) {
        // Resolve on a later tick so both callers are genuinely concurrent.
        return new Promise<Response>((resolve) => setTimeout(() => resolve(ok(REFRESHED)), 0));
      }
      const authorized =
        (fetchMock.mock.calls.filter(([i]) => isRefresh(i)).length ?? 0) > 0;
      return Promise.resolve(authorized ? ok([]) : failure(401, { code: "UNAUTHENTICATED" }));
    });

    const { api } = await loadClient();
    await Promise.all([api.get("/zones"), api.get("/vendors")]);

    expect(fetchMock.mock.calls.filter(([input]) => isRefresh(input))).toHaveLength(1);
  });

  it("gives up when the replayed request is refused too", async () => {
    // A second 401 means the session is gone, not stale. Retrying again would
    // loop, and each loop burns another single-use refresh token.
    fetchMock.mockImplementation((input: RequestInfo | URL) =>
      Promise.resolve(isRefresh(input) ? ok(REFRESHED) : failure(401, { code: "UNAUTHENTICATED" })),
    );

    const { api, ApiError } = await loadClient();

    await expect(api.get("/zones")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock.mock.calls.filter(([input]) => isRefresh(input))).toHaveLength(1);
  });

  it("clears the stored tokens when the refresh is refused", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) =>
      Promise.resolve(
        isRefresh(input)
          ? failure(401, { code: "TOKEN_REUSED" })
          : failure(401, { code: "UNAUTHENTICATED" }),
      ),
    );

    const { api, getTokens } = await loadClient();

    await expect(api.get("/zones")).rejects.toThrow();
    // Tokens the server has already rejected must not survive a page reload:
    // the next load would render a signed-in shell whose every request 401s.
    expect(getTokens()).toBeNull();
    expect(window.localStorage.getItem("kmcp.tokens")).toBeNull();
  });

  it("does not refresh for an anonymous request", async () => {
    // Login and OTP are the requests that produce tokens. A 401 from one of
    // them is a wrong password, and spending the refresh token on it would
    // sign out whoever was already signed in on this browser.
    fetchMock.mockResolvedValue(failure(401, { code: "INVALID_CREDENTIALS" }));

    const { api } = await loadClient();

    await expect(api.post("/auth/login", { phone: "x" }, { anonymous: true })).rejects.toThrow();
    expect(fetchMock.mock.calls.filter(([input]) => isRefresh(input))).toHaveLength(0);
  });
});

describe("the error envelope", () => {
  it("carries the code, the field details and the request id", async () => {
    fetchMock.mockResolvedValueOnce(
      failure(
        422,
        {
          code: "VALIDATION_FAILED",
          message: "Some fields need attention.",
          details: [{ field: "capacity", issue: "must be positive" }],
        },
        { requestId: "req-abc-123" },
      ),
    );

    const { api, ApiError } = await loadClient();
    const error = await api.post("/zones", {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as InstanceType<Client["ApiError"]>;
    expect(apiError.code).toBe("VALIDATION_FAILED");
    expect(apiError.isValidationError).toBe(true);
    // The id support quotes back to a citizen, and the one every report is
    // tagged with. Losing it here loses the only link to the audit trail.
    expect(apiError.requestId).toBe("req-abc-123");
    expect(apiError.fieldErrors()).toEqual({ capacity: "must be positive" });
  });

  it("falls back to INTERNAL_ERROR when the body is not the envelope at all", async () => {
    // A gateway 502 or an HTML error page from the host: `code` still has to be
    // something the screens can branch on.
    fetchMock.mockResolvedValueOnce(
      new Response("<html>Bad Gateway</html>", { status: 502, headers: { "content-type": "text/html" } }),
    );

    const { api } = await loadClient();
    const error = await api.get("/zones").catch((e: unknown) => e);

    expect(error).toMatchObject({ code: "INTERNAL_ERROR", status: 502 });
  });
});

describe("failing before an answer arrives", () => {
  it("reports an aborted request as TIMEOUT", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("The operation was aborted.", "AbortError"));

    const { api } = await loadClient();
    const error = await api.get("/zones").catch((e: unknown) => e);

    // 408 rather than 0: a screen tells someone to try again, and a network
    // failure tells them to check their connection. The codes are how it knows.
    expect(error).toMatchObject({ code: "TIMEOUT", status: 408 });
  });

  it("reports an unreachable server as NETWORK_ERROR", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const { api } = await loadClient();
    const error = await api.get("/zones").catch((e: unknown) => e);

    expect(error).toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });

  it("hands every failure to the reporter on its way out", async () => {
    // Whether an event is actually sent is `isReportable`'s decision, not this
    // file's. What matters here is that no failure path leaves without asking.
    fetchMock.mockResolvedValueOnce(failure(500, { code: "INTERNAL_ERROR" }, { requestId: "req-500" }));

    const { api } = await loadClient();
    await api.get("/zones").catch(() => undefined);

    expect(reportApiError).toHaveBeenCalledTimes(1);
    expect(reportApiError.mock.calls[0][0]).toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
      requestId: "req-500",
    });
  });
});
