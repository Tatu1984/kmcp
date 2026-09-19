import { isSessionLive } from "./live";
import type { ParkingSession, Slot, SlotStatus } from "@/shared/types/domain.types";

/**
 * Joining a bay to the vehicle standing in it.
 *
 * Nothing in the portal did this. `GET /slots` answers with a bay's status and
 * nothing else — `{id, zoneId, code, type, status, isReserved}` — so the bay map
 * could colour a tile "occupied" without being able to say by what, for how
 * long, or against which session. `GET /sessions` has carried `slotId` all
 * along. The join is one line of code and it had simply never been written.
 *
 * It is done here, as a pure function over two lists, for two reasons. It is
 * the part worth testing — the interesting behaviour is entirely in what
 * happens when the two lists disagree — and it has to be done in the browser
 * regardless: there is no endpoint that returns bays with their occupants.
 */

/**
 * A bay and its status disagreeing with the sessions.
 *
 * These are not display quirks, they are data faults with money attached, and
 * the portal's job is to show them rather than to pick whichever source makes
 * the screen look tidy.
 *
 * The API maintains bay status as a side effect of the session lifecycle:
 * starting a session flips its bay to OCCUPIED, ending or cancelling it flips
 * the bay back. Nothing reconciles the two afterwards and the overstay sweep
 * does not touch bays at all, so a session abandoned rather than ended leaves a
 * bay marked OCCUPIED indefinitely — a space the city cannot sell and, until
 * this screen, could not see. The backend's own slot `summary()` reports
 * `activeSessions` from a query separate to `byStatus` precisely because the
 * two are known to drift.
 *
 * `POST /sessions/start` does now validate the bay it is handed — wrong zone,
 * wrong vehicle type, already taken — so the portal is no longer the only thing
 * standing between an officer and a double-booked bay. That narrows how these
 * states arise; it does not remove them. Rows written before those checks
 * existed are still in the table, releasing a bay is deliberately conditional
 * on the session having held it, and nothing at all sweeps up after a session
 * that simply stopped.
 */
export type BayMismatch =
  /** Marked OCCUPIED, but no live session claims it. A space nobody can sell. */
  | "OCCUPIED_WITHOUT_SESSION"
  /** A vehicle is parked in it, but the bay is not marked OCCUPIED. */
  | "SESSION_ON_FREE_BAY"
  /** Two live sessions claim the same bay. One of them is wrong. */
  | "DOUBLE_BOOKED";

export interface Bay {
  slot: Slot;
  /** The live session standing in it, when one claims it. */
  session?: ParkingSession;
  /** Any other live sessions claiming the same bay. Empty unless double-booked. */
  alsoClaimedBy: ParkingSession[];
  mismatch?: BayMismatch;
}

export interface BayBoard {
  /** Every bay in the zone, in kerb order. */
  bays: Bay[];
  /**
   * Live sessions in this zone with no bay recorded against them.
   *
   * Ordinary, and not a fault. Plenty of zones are priced for a capacity well
   * above the number of bays anybody has mapped, and `slotId` is optional on
   * `POST /sessions/start` — a vehicle parked on an unnumbered stretch of kerb
   * is a real session that belongs to no tile. Reported as its own figure so
   * the board does not look like it has lost them.
   */
  withoutBay: ParkingSession[];
  /**
   * Live sessions naming a bay that is not in this zone's list.
   *
   * A fault. The start endpoint now refuses a bay from another zone, so a new
   * session cannot create one — which leaves two ways to see it: a session
   * started before that check existed, and a bay deleted or moved out from
   * under a session that is still running.
   */
  unknownBay: ParkingSession[];
  /** The bays in `bays` that carry a mismatch, for the reconciliation panel. */
  mismatches: Bay[];
  counts: {
    bays: number;
    free: number;
    occupied: number;
    reserved: number;
    outOfService: number;
    /** Occupied bays whose session has been running past the overstay threshold. */
    overstaying: number;
    /** Live sessions in the zone, however they are recorded. */
    liveSessions: number;
  };
}

/** Kerb order: C2 before C10, which a plain string sort gets backwards. */
function byCode(a: Slot, b: Slot): number {
  return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Longest-standing first.
 *
 * Only reached when two sessions claim one bay, and it makes the choice of
 * which to show on the tile deterministic rather than dependent on the order
 * two paginated requests happened to come back in. The earlier arrival is the
 * one more likely to be the real occupant, and the other is surfaced beside it
 * rather than hidden.
 */
function byArrival(a: ParkingSession, b: ParkingSession): number {
  return Date.parse(a.startAt) - Date.parse(b.startAt);
}

/**
 * Bays joined to the vehicles in them, plus everything that did not line up.
 *
 * Both lists are expected to be for one zone. `sessions` is filtered to live
 * ones here rather than trusted to be: the caller fetches ACTIVE and OVERSTAY
 * separately because the API takes one status at a time, and a single missed
 * filter would put a completed session back into a bay.
 */
export function buildBayBoard(
  slots: readonly Slot[],
  sessions: readonly ParkingSession[],
): BayBoard {
  const liveSessions = sessions.filter((session) => isSessionLive(session.status));

  const claimsBySlot = new Map<string, ParkingSession[]>();
  const withoutBay: ParkingSession[] = [];

  for (const session of liveSessions) {
    if (!session.slotId) {
      withoutBay.push(session);
      continue;
    }
    const claims = claimsBySlot.get(session.slotId);
    if (claims) claims.push(session);
    else claimsBySlot.set(session.slotId, [session]);
  }

  const known = new Set(slots.map((slot) => slot.id));
  const bays: Bay[] = [...slots].sort(byCode).map((slot) => {
    const claims = (claimsBySlot.get(slot.id) ?? []).slice().sort(byArrival);
    const [session, ...alsoClaimedBy] = claims;

    let mismatch: BayMismatch | undefined;
    if (claims.length > 1) {
      // Reported ahead of the status disagreement it usually comes with: two
      // vehicles recorded in one space is the more serious of the two facts.
      mismatch = "DOUBLE_BOOKED";
    } else if (session && slot.status !== "OCCUPIED") {
      mismatch = "SESSION_ON_FREE_BAY";
    } else if (!session && slot.status === "OCCUPIED") {
      mismatch = "OCCUPIED_WITHOUT_SESSION";
    }

    return { slot, session, alsoClaimedBy, mismatch };
  });

  const unknownBay = liveSessions.filter(
    (session) => session.slotId !== undefined && !known.has(session.slotId),
  );

  const countStatus = (status: SlotStatus) =>
    slots.filter((slot) => slot.status === status).length;

  return {
    bays,
    withoutBay,
    unknownBay,
    mismatches: bays.filter((bay) => bay.mismatch !== undefined),
    counts: {
      bays: slots.length,
      free: countStatus("AVAILABLE"),
      occupied: countStatus("OCCUPIED"),
      reserved: countStatus("RESERVED"),
      outOfService: countStatus("OUT_OF_SERVICE"),
      overstaying: bays.filter((bay) => bay.session?.isOverstay).length,
      liveSessions: liveSessions.length,
    },
  };
}

/** What to tell an operator about a mismatch, in words that name the fix. */
export const MISMATCH_COPY: Record<BayMismatch, { label: string; detail: string }> = {
  OCCUPIED_WITHOUT_SESSION: {
    label: "Occupied, but nothing is parked in it",
    detail:
      "No live session names this bay. Usually a session that was never ended — the bay stays unsellable until it is released.",
  },
  SESSION_ON_FREE_BAY: {
    label: "In use, but not marked occupied",
    detail:
      "A vehicle is recorded in this bay while the bay reads as free, so it can be allocated to a second vehicle.",
  },
  DOUBLE_BOOKED: {
    label: "Two vehicles in one bay",
    detail:
      "More than one live session names this bay. At least one is in the wrong place, and both are being charged.",
  },
};
