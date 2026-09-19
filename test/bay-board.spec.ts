import { describe, expect, it } from "vitest";
import { buildBayBoard } from "@/frontend/lib/bay-board";
import {
  elapsedMinutesSince,
  isSessionLive,
  overstayingNow,
  runningNow,
} from "@/frontend/lib/live";
import type { ParkingSession, Slot, SlotStatus } from "@/shared/types/domain.types";

/**
 * Joining a bay to the vehicle standing in it.
 *
 * The field copying is not what is worth testing — a rename shows up as a type
 * error. What is worth testing is what happens when the two sources disagree,
 * because they routinely do and the disagreements are worth money.
 *
 * The API keeps a bay's status as a side effect of the session lifecycle:
 * starting a session marks the bay OCCUPIED, ending or cancelling it marks the
 * bay AVAILABLE. Nothing reconciles the two afterwards, the overstay sweep does
 * not touch bays at all, and the start endpoint does not check the bay it is
 * given — so every one of the states below is reachable in production. The
 * backend's own slot `summary()` reports its session count from a separate
 * query to its status counts precisely because the two are known to drift.
 *
 * These are the assertions a future "just trust slot.status" simplification
 * would have to argue with.
 */

function bay(code: string, status: SlotStatus, over: Partial<Slot> = {}): Slot {
  return {
    id: `slot-${code}`,
    zoneId: "zone-1",
    zoneName: "MG Road",
    code,
    type: "CAR",
    status,
    isReserved: status === "RESERVED",
    ...over,
  };
}

function parked(id: string, slotId: string | undefined, over: Partial<ParkingSession> = {}): ParkingSession {
  return {
    id,
    code: `S-${id}`,
    plateNumber: `WB01AB${id}`,
    vehicleType: "CAR",
    zoneId: "zone-1",
    zoneName: "MG Road",
    slotId,
    vendorName: "Sunrise Parking",
    attendantName: "R. Rao",
    status: "ACTIVE",
    source: "ATTENDANT_APP",
    startAt: "2026-02-01T05:00:00.000Z",
    discountAmount: 0,
    taxAmount: 0,
    penaltyAmount: 0,
    paid: false,
    isOverstay: false,
    ...over,
  };
}

describe("the bay board", () => {
  it("puts each vehicle in the bay its session names", () => {
    const board = buildBayBoard(
      [bay("C01", "OCCUPIED"), bay("C02", "AVAILABLE")],
      [parked("1", "slot-C01")],
    );

    expect(board.bays.map((b) => b.slot.code)).toEqual(["C01", "C02"]);
    expect(board.bays[0].session?.plateNumber).toBe("WB01AB1");
    expect(board.bays[1].session).toBeUndefined();
    expect(board.mismatches).toHaveLength(0);
  });

  it("orders bays the way they are numbered on the kerb", () => {
    // C10 after C2, which a plain string comparison gets backwards — and a bay
    // board an officer cannot scan in order is a board they will not use.
    const board = buildBayBoard([bay("C10", "AVAILABLE"), bay("C2", "AVAILABLE"), bay("C1", "AVAILABLE")], []);

    expect(board.bays.map((b) => b.slot.code)).toEqual(["C1", "C2", "C10"]);
  });

  it("includes a vehicle the sweep has promoted to overstay", () => {
    /**
     * The failure this whole join was nearly built with. A background job
     * rewrites a long-running session's status from ACTIVE to OVERSTAY, so a
     * board that filtered on ACTIVE would show an empty bay for exactly the
     * car that had been there longest — the one an officer is looking for.
     */
    const board = buildBayBoard(
      [bay("C01", "OCCUPIED")],
      [parked("1", "slot-C01", { status: "OVERSTAY", isOverstay: true })],
    );

    expect(board.bays[0].session?.status).toBe("OVERSTAY");
    expect(board.counts.overstaying).toBe(1);
    expect(board.counts.liveSessions).toBe(1);
  });

  it("drops a session that has already ended", () => {
    // The caller fetches two statuses in two requests because the API takes one
    // at a time. A single missed filter would put a departed vehicle back into
    // a bay and show it still accruing time.
    const board = buildBayBoard(
      [bay("C01", "AVAILABLE")],
      [parked("1", "slot-C01", { status: "COMPLETED" })],
    );

    expect(board.bays[0].session).toBeUndefined();
    expect(board.counts.liveSessions).toBe(0);
  });

  it("reports a bay marked occupied that nothing is parked in", () => {
    /**
     * A session abandoned rather than ended leaves the bay OCCUPIED for ever:
     * nothing in the API reconciles it. That is a space the city cannot sell
     * and, until now, could not see — the old bay map would have drawn this
     * tile in exactly the same blue as a bay earning money.
     */
    const board = buildBayBoard([bay("C01", "OCCUPIED")], []);

    expect(board.bays[0].mismatch).toBe("OCCUPIED_WITHOUT_SESSION");
    expect(board.mismatches).toHaveLength(1);
  });

  it("reports a vehicle parked in a bay that reads as free", () => {
    // The dangerous direction of the same drift: the bay is still on offer, so
    // an attendant can allocate it to a second vehicle.
    const board = buildBayBoard([bay("C01", "AVAILABLE")], [parked("1", "slot-C01")]);

    expect(board.bays[0].mismatch).toBe("SESSION_ON_FREE_BAY");
    expect(board.bays[0].session?.id).toBe("1");
  });

  it("reports two vehicles claiming one bay, and shows the earlier arrival", () => {
    /**
     * The start endpoint now refuses a bay that is already taken, and closes
     * the race with a conditional update, so this should stop arising. "Should
     * stop" is not "cannot be in the table": rows written before those checks
     * existed are still there, and both vehicles are being charged, so neither
     * may be hidden — the tile shows the one that has been there longest, and
     * the other is carried beside it for the panel.
     *
     * Longest-standing first also makes the choice deterministic. Picking
     * whichever came back first would depend on the order two paginated
     * requests happened to resolve in.
     */
    const board = buildBayBoard(
      [bay("C01", "OCCUPIED")],
      [
        parked("late", "slot-C01", { startAt: "2026-02-01T09:00:00.000Z" }),
        parked("early", "slot-C01", { startAt: "2026-02-01T05:00:00.000Z" }),
      ],
    );

    expect(board.bays[0].mismatch).toBe("DOUBLE_BOOKED");
    expect(board.bays[0].session?.id).toBe("early");
    expect(board.bays[0].alsoClaimedBy.map((s) => s.id)).toEqual(["late"]);
  });

  it("reports a double booking ahead of the status disagreement beside it", () => {
    // Two vehicles in one space is the more serious of the two facts, and a
    // double-booked bay is usually also not marked occupied.
    const board = buildBayBoard(
      [bay("C01", "AVAILABLE")],
      [parked("a", "slot-C01"), parked("b", "slot-C01", { startAt: "2026-02-01T06:00:00.000Z" })],
    );

    expect(board.bays[0].mismatch).toBe("DOUBLE_BOOKED");
  });

  it("counts a vehicle with no bay without losing it", () => {
    /**
     * Not a fault, and the distinction matters: `slotId` is optional when a
     * session starts, and a zone priced for more vehicles than it has
     * marked-out bays produces these all day. They belong to no tile, so a
     * board that simply joined on `slotId` would silently drop them and report
     * an emptier car park than the city has.
     */
    const board = buildBayBoard([bay("C01", "AVAILABLE")], [parked("1", undefined)]);

    expect(board.withoutBay.map((s) => s.id)).toEqual(["1"]);
    expect(board.unknownBay).toHaveLength(0);
    expect(board.mismatches).toHaveLength(0);
    // Still counted as parked, because it is.
    expect(board.counts.liveSessions).toBe(1);
  });

  it("separates a vehicle in a bay this zone does not have from one in no bay at all", () => {
    // A bay belonging to another zone is a fault — the start endpoint does not
    // check — while no bay is ordinary. Collapsing them would bury the first.
    const board = buildBayBoard(
      [bay("C01", "AVAILABLE")],
      [parked("elsewhere", "slot-from-another-zone"), parked("nobay", undefined)],
    );

    expect(board.unknownBay.map((s) => s.id)).toEqual(["elsewhere"]);
    expect(board.withoutBay.map((s) => s.id)).toEqual(["nobay"]);
  });

  it("counts bays by status for the tiles above it", () => {
    const board = buildBayBoard(
      [
        bay("C01", "OCCUPIED"),
        bay("C02", "AVAILABLE"),
        bay("C03", "AVAILABLE"),
        bay("C04", "RESERVED"),
        bay("C05", "OUT_OF_SERVICE"),
      ],
      [parked("1", "slot-C01")],
    );

    expect(board.counts).toMatchObject({
      bays: 5,
      free: 2,
      occupied: 1,
      reserved: 1,
      outOfService: 1,
      liveSessions: 1,
    });
  });

  it("describes a zone with no bays as empty rather than broken", () => {
    // Many zones have none recorded. The board says so and offers to add them;
    // it must not read as a failed request.
    const board = buildBayBoard([], [parked("1", undefined)]);

    expect(board.bays).toHaveLength(0);
    expect(board.counts.bays).toBe(0);
    expect(board.withoutBay).toHaveLength(1);
  });
});

describe("a live session", () => {
  it("counts a vehicle as parked under either live status", () => {
    // Both, always: the sweep rewrites ACTIVE to OVERSTAY in place.
    expect(isSessionLive("ACTIVE")).toBe(true);
    expect(isSessionLive("OVERSTAY")).toBe(true);
    expect(isSessionLive("COMPLETED")).toBe(false);
    expect(isSessionLive("CANCELLED")).toBe(false);
    expect(isSessionLive("DISPUTED")).toBe(false);
  });
});

describe("a ticking duration", () => {
  const startAt = "2026-02-01T05:00:00.000Z";
  const start = Date.parse(startAt);

  it("rounds the way the server does, so the two never disagree", () => {
    /**
     * The API computes `elapsedMinutes` as `round((now - startAt) / 60000)`.
     * Flooring here instead would make every poll look like the clock had
     * jumped backwards a minute: the row arrives with the server's rounded
     * figure, and the next client tick would replace it with a smaller one.
     */
    expect(elapsedMinutesSince(startAt, start + 90_000)).toBe(2);
    expect(elapsedMinutesSince(startAt, start + 29_000)).toBe(0);
    expect(elapsedMinutesSince(startAt, start + 31_000)).toBe(1);
    expect(elapsedMinutesSince(startAt, start + 3_600_000)).toBe(60);
  });

  it("clamps a start time in the future to zero rather than counting down", () => {
    // Clock skew between a handset and the server, not a negative stay. A
    // duration of "-3m" on an officer's screen reads as a broken portal.
    expect(elapsedMinutesSince(startAt, start - 180_000)).toBe(0);
  });

  it("returns zero for a timestamp it cannot read", () => {
    expect(elapsedMinutesSince("not a date", start)).toBe(0);
  });
});

describe("the live figures above the sessions table", () => {
  const rows = [
    { status: "ACTIVE", zoneId: "zone-1", isOverstay: false },
    { status: "OVERSTAY", zoneId: "zone-1", isOverstay: true },
    { status: "ACTIVE", zoneId: "zone-2", isOverstay: false },
    { status: "COMPLETED", zoneId: "zone-1", isOverstay: false },
  ];

  const summary = {
    activeSessions: 412,
    overstaying: 17,
    overstayAfterMinutes: 360,
    byZone: [
      { zoneId: "zone-1", count: 260 },
      { zoneId: "zone-2", count: 152 },
    ],
  };

  it("prefers the server's count to whatever page the table loaded", () => {
    /**
     * The bug these replace. The tiles filtered the rows in hand, so on a
     * network with four hundred cars parked "Running now" read 25 — the page
     * size. Wrong by an order of magnitude, and wrong in the reassuring
     * direction, which is the worst way for an operations figure to be wrong.
     */
    expect(runningNow(summary, rows)).toEqual({ value: 412, fromServer: true });
    expect(overstayingNow(summary, rows)).toEqual({ value: 17, fromServer: true });
  });

  it("narrows the running count to the filtered zone using the server's own split", () => {
    // `byZone` is the same database count, per zone. Showing the network total
    // under a heading that names one zone is the mis-captioning the zone-scope
    // badge exists to prevent.
    expect(runningNow(summary, rows, "zone-2")).toEqual({ value: 152, fromServer: true });
  });

  it("reads a zone missing from the breakdown as none parked", () => {
    // A zone with nothing in it is absent from `byZone` rather than present
    // with a zero.
    expect(runningNow(summary, rows, "zone-9")).toEqual({ value: 0, fromServer: true });
  });

  it("counts overstays locally once a zone filter is on, and says so", () => {
    /**
     * `/sessions/live` breaks the running count down by zone but not the
     * overstay count, so there is no per-zone server answer to use. The rows on
     * screen are the only honest one available, and the flag is what lets the
     * tile caption itself accordingly rather than passing a local count off as
     * the authority's.
     */
    expect(overstayingNow(summary, rows, "zone-1")).toEqual({ value: 1, fromServer: false });
  });

  it("falls back to the rows when the live request has not landed or was refused", () => {
    // A tile is still better than a blank, as long as it admits where the
    // number came from.
    expect(runningNow(undefined, rows)).toEqual({ value: 3, fromServer: false });
    expect(runningNow(undefined, rows, "zone-1")).toEqual({ value: 2, fromServer: false });
    expect(overstayingNow(undefined, rows)).toEqual({ value: 1, fromServer: false });
  });

  it("does not count a finished session as parked in either mode", () => {
    const completedOnly = [{ status: "COMPLETED", zoneId: "zone-1", isOverstay: false }];

    expect(runningNow(undefined, completedOnly)).toEqual({ value: 0, fromServer: false });
  });
});
