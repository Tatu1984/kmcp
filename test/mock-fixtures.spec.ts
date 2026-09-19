import { describe, expect, it } from "vitest";
import { SESSIONS, SLOTS, ZONES } from "@/frontend/lib/mock";
import { buildBayBoard } from "@/frontend/lib/bay-board";
import { isSessionLive } from "@/frontend/lib/live";
import { toFareBreakdown } from "@/frontend/lib/adapters";

/**
 * The bundled dataset, checked against the screens that read it.
 *
 * The portal is demonstrated to the authority on a laptop with no backend, so
 * demo mode is a supported mode and not a developer convenience. These
 * assertions are the ones that would otherwise be discovered in front of an
 * audience: a bay board with no occupants because the fixture's bay references
 * were invented, or a fare tab permanently on its fallback because no
 * demonstration session carries a breakdown.
 */

describe("the demonstration dataset", () => {
  const live = SESSIONS.filter((s) => isSessionLive(s.status));

  it("has vehicles parked, and parks them in bays that exist", () => {
    /**
     * Sessions used to carry an invented `slotCode` — `C07`, whether or not the
     * zone had a bay by that name — and no `slotId` at all. Nothing noticed
     * while no screen joined the two. The bay board is that join, and against
     * invented references it would draw an empty car park beside forty-six
     * parked cars.
     */
    expect(live.length).toBeGreaterThan(0);

    const bayIds = new Set(SLOTS.map((s) => s.id));
    const placed = live.filter((s) => s.slotId !== undefined);

    expect(placed.length).toBeGreaterThan(0);
    for (const session of placed) {
      expect(bayIds.has(session.slotId!)).toBe(true);
    }
  });

  it("parks each vehicle in a bay belonging to its own zone", () => {
    const zoneOfBay = new Map(SLOTS.map((s) => [s.id, s.zoneId]));

    for (const session of live) {
      if (!session.slotId) continue;
      expect(zoneOfBay.get(session.slotId)).toBe(session.zoneId);
    }
  });

  it("never puts two live vehicles in one bay", () => {
    // The deliberate faults seeded into the fixture are status disagreements,
    // not double bookings — a bay is claimed at most once, so the board's
    // DOUBLE_BOOKED branch stays a real signal rather than demo noise.
    const claimed = live.map((s) => s.slotId).filter(Boolean);

    expect(new Set(claimed).size).toBe(claimed.length);
  });

  it("prices every session that ended, and nothing that did not", () => {
    /**
     * The API writes `fareBreakdown` in `end()` and nowhere else, so a running
     * session has none and neither does a cancelled one — cancelling voids the
     * charge rather than pricing it. A fixture that priced them anyway would
     * put a total on screen that no server ever agreed to, which is the exact
     * habit the Fare tab was rebuilt to break.
     */
    for (const session of SESSIONS) {
      if (isSessionLive(session.status) || session.status === "CANCELLED") {
        expect(session.fareBreakdown).toBeUndefined();
        expect(session.payableAmount).toBeUndefined();
      } else {
        expect(session.fareBreakdown).toBeDefined();
      }
    }
  });

  it("writes breakdowns the adapter's guard accepts", () => {
    // If the fixture drifted out of shape, demo mode would silently fall back
    // to the flat summary and the itemised card would never be seen.
    const priced = SESSIONS.filter((s) => s.fareBreakdown);

    expect(priced.length).toBeGreaterThan(0);
    for (const session of priced) {
      expect(toFareBreakdown(session.fareBreakdown)).toBeDefined();
    }
  });

  it("makes the breakdown add up to the total printed beside it", () => {
    /**
     * The one bug a fare screen must never have, demonstration or not: lines
     * that do not reconcile with the figure underneath them. The totals on the
     * session row and the totals inside its breakdown come from one
     * calculation, so they cannot disagree.
     */
    for (const session of SESSIONS) {
      const quote = session.fareBreakdown;
      if (!quote) continue;

      const lines = quote.lines.reduce((sum, line) => sum + line.amount, 0);
      expect(lines).toBe(quote.grossAmount);

      const expected =
        quote.grossAmount - quote.discountAmount + quote.penaltyAmount + quote.taxAmount;
      expect(quote.payableAmount).toBe(expected);

      // And the row agrees with its own breakdown.
      expect(session.payableAmount).toBe(quote.payableAmount);
      expect(session.grossAmount).toBe(quote.grossAmount);
      expect(session.taxAmount).toBe(quote.taxAmount);
    }
  });

  it("charges only for time outside the grace period", () => {
    // What a citizen disputing a charge is usually disputing. The card derives
    // the free minutes by subtraction, so the two durations have to be ordered.
    for (const session of SESSIONS) {
      const quote = session.fareBreakdown;
      if (!quote) continue;

      expect(quote.chargeableMinutes).toBeLessThanOrEqual(quote.durationMinutes);
      expect(quote.durationMinutes).toBe(session.durationMinutes);
    }
  });

  it("builds a board with occupied bays in at least one zone", () => {
    /**
     * The end-to-end check on demo mode: pick the zone the fixture put the most
     * cars in and confirm the join produces a board an officer could read —
     * tiles, occupants, and a ticking figure to count from.
     */
    const busiest = [...ZONES]
      .map((zone) => ({
        zone,
        board: buildBayBoard(
          SLOTS.filter((s) => s.zoneId === zone.id),
          live.filter((s) => s.zoneId === zone.id),
        ),
      }))
      .sort((a, b) => b.board.counts.liveSessions - a.board.counts.liveSessions)[0];

    expect(busiest.board.counts.bays).toBeGreaterThan(0);
    expect(busiest.board.counts.liveSessions).toBeGreaterThan(0);

    const occupied = busiest.board.bays.filter((b) => b.session);
    expect(occupied.length).toBeGreaterThan(0);
    for (const bay of occupied) {
      expect(bay.session!.plateNumber).toMatch(/^[A-Z]{2}\d{2}[A-Z]{2}\d{4}$/);
      expect(Number.isFinite(Date.parse(bay.session!.startAt))).toBe(true);
    }
  });

  it("seeds enough disagreement for the reconciliation panel to be seen", () => {
    /**
     * The panel's whole purpose is to be noticed, and a demonstration in which
     * it is always empty does not show that it works. The faults are real ones
     * this system produces — the API flips a bay to OCCUPIED when a session
     * starts and back when it ends, and nothing reconciles a bay whose session
     * was abandoned.
     */
    const board = buildBayBoard(SLOTS, live);

    expect(board.mismatches.length).toBeGreaterThan(0);
    // And some vehicles parked with no numbered bay at all, which is the
    // ordinary case the board must not report as a fault.
    expect(board.withoutBay.length).toBeGreaterThan(0);
  });
});
