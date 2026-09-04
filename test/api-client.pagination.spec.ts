import { describe, expect, it, vi } from "vitest";
import { listAll } from "@/frontend/api/client";
import { API_CONFIG } from "@/config/api.config";
import type { ApiResult } from "@/frontend/api/client";

vi.mock("@/observability/sentry", () => ({ reportApiError: vi.fn() }));

/**
 * The pagination walker, which exists because of a bug that looked like data
 * loss.
 *
 * The API refuses a `pageSize` above `API_CONFIG.maxPageSize` by rejecting the
 * whole request rather than by returning fewer rows, so a screen that asked for
 * two hundred rows in one call got nothing — the create returned 201, the
 * reload 400, and the new row was simply not in the table. Nobody reads that as
 * a pagination bug; they read it as a save that did not save.
 *
 * So the case that matters most is the page size, and it matters for arguments
 * that look harmless: a caller asking for a `limit` far above the cap. The rest
 * of these are the walker's stopping conditions, each of which fails in its own
 * quiet way — one short of the data, or in an infinite loop against a live API.
 */

/** A page source with `total` rows, recording exactly what it was asked for. */
function pageSource(total: number, options: { reportTotal?: boolean } = {}) {
  const asked: { page: number; pageSize: number }[] = [];
  const fetchPage = async (page: number, pageSize: number): Promise<ApiResult<number[]>> => {
    asked.push({ page, pageSize });
    const start = (page - 1) * pageSize;
    return {
      data: Array.from({ length: Math.max(0, Math.min(pageSize, total - start)) }, (_, i) => start + i),
      meta: { requestId: "req-1", ...(options.reportTotal ? { total } : {}) },
    };
  };
  return { fetchPage, asked };
}

describe("walking every page of a list endpoint", () => {
  it("never asks for a page larger than the API will serve", async () => {
    // The bug. `limit` is how many rows the screen wants in total; it is not a
    // page size, and passing it through as one is what produced the 400.
    const { fetchPage, asked } = pageSource(250);

    await listAll(fetchPage, 100_000);

    expect(asked.every((call) => call.pageSize <= API_CONFIG.maxPageSize)).toBe(true);
  });

  it("asks for no more than the caller wants when that is under the cap", async () => {
    // The other direction: a screen that wants ten rows should cost one small
    // request, not a full hundred-row page thrown mostly away.
    const { fetchPage, asked } = pageSource(500);

    const rows = await listAll(fetchPage, 10);

    expect(asked).toEqual([{ page: 1, pageSize: 10 }]);
    expect(rows).toHaveLength(10);
  });

  it("stops on a short page", async () => {
    // The only signal available from an endpoint that reports no total. Getting
    // this wrong means either one wasted request per list or an endless loop.
    const { fetchPage, asked } = pageSource(150);

    const rows = await listAll(fetchPage, 1000);

    expect(rows).toHaveLength(150);
    expect(asked.map((call) => call.page)).toEqual([1, 2]);
  });

  it("stops one request earlier when the endpoint reports a total", async () => {
    // 200 rows in pages of 100: without `total` the walker cannot know page 2
    // was the last, and asks for an empty page 3 to find out.
    const { fetchPage, asked } = pageSource(200, { reportTotal: true });

    const rows = await listAll(fetchPage, 1000);

    expect(rows).toHaveLength(200);
    expect(asked.map((call) => call.page)).toEqual([1, 2]);
  });

  it("truncates to the limit rather than returning a page too many", async () => {
    // 150 wanted, served in pages of 100, so the second page overshoots. The
    // caller asked for a bound and has to get one — a table sized to 150 rows
    // must not silently render 200.
    const { fetchPage } = pageSource(1000);

    const rows = await listAll(fetchPage, 150);

    expect(rows).toHaveLength(150);
    expect(rows[149]).toBe(149);
  });

  it("returns nothing, and asks nothing, for an empty collection", async () => {
    const { fetchPage, asked } = pageSource(0);

    expect(await listAll(fetchPage)).toEqual([]);
    expect(asked).toHaveLength(1);
  });
});
