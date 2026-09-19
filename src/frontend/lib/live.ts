/**
 * How often the portal asks again, and how often it re-reads its own clock.
 *
 * These are three different questions and they deliberately have three
 * different answers. Collapsing them into one "refresh interval" is how a
 * screen ends up either stale or hammering the API.
 */

/**
 * The cheap live counters: `GET /sessions/live`.
 *
 * One request that returns four numbers, so it can afford to be the fastest of
 * the three. Matched to the dashboard's activity feed
 * (`live-feed.tsx`) rather than chosen independently — two live things on the
 * same screen updating on different rhythms reads as one of them being broken.
 */
export const LIVE_COUNTS_POLL_MS = 15_000;

/**
 * A list of sessions or bays: `GET /sessions`, `GET /slots`.
 *
 * Half the rate of the counters above, because this is not one request. The
 * portal has no server-side filtering for the sessions table, so it walks the
 * pages — up to ten round trips of a hundred rows each — and the bay board
 * additionally asks for two statuses separately, the API taking only one at a
 * time. Thirty seconds is also honest about what is being watched: a bay
 * changes hands when a driver walks back to their car, which is a minutes-scale
 * event, not a seconds-scale one. Polling this at fifteen would double the load
 * on the API to show the same information.
 */
export const LIST_POLL_MS = 30_000;

/**
 * How often a running duration re-reads the clock.
 *
 * Every elapsed time in this portal is rendered at minute resolution — a
 * `formatDuration` of "1h 24m" — so the smallest change that can appear on
 * screen is one minute, and a one-second tick would do sixty times the work for
 * the same pixels.
 *
 * Fifteen seconds rather than sixty because a tick is not aligned to the minute
 * boundaries it is trying to show. On a sixty-second tick, a duration that
 * rolls over just after a tick reads a full minute stale — long enough for an
 * officer reading the screen and a citizen reading their phone to disagree.
 * Fifteen bounds that error to a quarter of a minute at a sixteenth of the cost
 * of ticking every second.
 */
export const CLOCK_TICK_MS = 15_000;

/**
 * Minutes a vehicle has been parked, as of `now`.
 *
 * `Math.round` rather than `Math.floor`, to agree with the server: the API
 * computes `elapsedMinutes` as `round((now - startAt) / 60000)`
 * (`sessions.service.ts:579-586`). Both figures appear on the same screen — the
 * server's on a freshly fetched row, this one a moment later as it ticks — and
 * rounding differently would make the number appear to jump backwards by a
 * minute every time a poll landed.
 *
 * Clamped at zero. A session whose `startAt` is slightly in the future is a
 * clock-skew artefact between a handset and the server, not a negative stay.
 */
export function elapsedMinutesSince(startAt: string, now: number): number {
  const started = new Date(startAt).getTime();
  if (!Number.isFinite(started)) return 0;
  return Math.max(0, Math.round((now - started) / 60_000));
}

/**
 * Whether a session still has a vehicle in the bay.
 *
 * Both statuses, always. A background sweep promotes a long-running session
 * from ACTIVE to OVERSTAY (`sessions.service.ts:711-722`), so "ACTIVE" alone
 * means "parked, but not for too long" — which silently excludes exactly the
 * vehicles an operator is looking for. The API's own `/sessions/live` counts
 * both for the same reason.
 */
export function isSessionLive(status: string): boolean {
  return status === "ACTIVE" || status === "OVERSTAY";
}

/**
 * A headline figure, and whether the server or the browser arrived at it.
 *
 * The distinction is the caption. "412 parked right now" means one thing when
 * the API counted every row in the city and quite another when the browser
 * counted the page it happens to be holding, and a tile that reads the same
 * either way is how a partial number gets quoted as a total.
 */
export interface LiveFigure {
  value: number;
  /** False when this was counted from the rows on screen. */
  fromServer: boolean;
}

type CountableRow = { status: string; zoneId: string };

/**
 * How many vehicles are parked right now.
 *
 * Prefers `GET /sessions/live`, which counts in the database across every page
 * and both live statuses. The browser's own count is the fallback for when that
 * request has not landed or was refused — not the primary source, which is what
 * it used to be: the tile filtered whichever page the table had loaded, so a
 * city with four hundred cars parked reported twenty-five.
 *
 * With a zone filter applied it uses `byZone`, which is the same database count
 * narrowed to that zone, rather than the network total under a heading that
 * says one zone.
 */
export function runningNow(
  summary: { activeSessions: number; byZone: { zoneId: string; count: number }[] } | undefined,
  rows: readonly CountableRow[],
  zoneId?: string | null,
): LiveFigure {
  if (summary) {
    if (zoneId) {
      // A zone with nothing parked is absent from `byZone` rather than present
      // with a zero, so a missing entry is genuinely none.
      const zone = summary.byZone.find((entry) => entry.zoneId === zoneId);
      return { value: zone?.count ?? 0, fromServer: true };
    }
    return { value: summary.activeSessions, fromServer: true };
  }

  const counted = rows.filter(
    (row) => isSessionLive(row.status) && (!zoneId || row.zoneId === zoneId),
  ).length;
  return { value: counted, fromServer: false };
}

/**
 * How many of those have been parked longer than the authority allows.
 *
 * The server's figure when the whole network is in view, because it applies the
 * threshold the sweep is actually running on — a `systemConfig` row an
 * administrator can change, which is why the threshold travels with the count
 * rather than being assumed here.
 *
 * Deliberately *not* the server's figure once a zone filter is applied:
 * `/sessions/live` breaks the running count down by zone but not the overstay
 * count, so the only per-zone answer available is the rows on screen. Reporting
 * the city's overstays under a heading that names one zone would be the same
 * mis-captioning the zone-scope badge exists to prevent — an officer could
 * quote it in a meeting as their own.
 */
export function overstayingNow(
  summary: { overstaying: number } | undefined,
  rows: readonly (CountableRow & { isOverstay: boolean })[],
  zoneId?: string | null,
): LiveFigure {
  if (summary && !zoneId) return { value: summary.overstaying, fromServer: true };

  const counted = rows.filter(
    (row) => row.isOverstay && (!zoneId || row.zoneId === zoneId),
  ).length;
  return { value: counted, fromServer: false };
}
