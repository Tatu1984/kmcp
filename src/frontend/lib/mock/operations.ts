import type {
  ParkingSession,
  Payment,
  Incident,
  ActivityItem,
  Quote,
  QuoteLine,
  Slot,
  SlotType,
  PaymentMode,
} from "@/shared/types/domain.types";
import { SLOTS, ZONES } from "./geography";
import { ATTENDANTS } from "./partners";
import { makeRng, minutesAgo, daysAgo } from "./rng";

const rng = makeRng(559021);

const PLATE_SERIES = ["WB", "WB", "WB", "WB", "JH", "OD", "BR", "AS"];
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

function plate(): string {
  const s = rng.pick(PLATE_SERIES);
  const d = String(rng.int(1, 99)).padStart(2, "0");
  const a = LETTERS[rng.int(0, LETTERS.length - 1)] + LETTERS[rng.int(0, LETTERS.length - 1)];
  const n = String(rng.int(1, 9999)).padStart(4, "0");
  return `${s}${d}${a}${n}`;
}

const CITIZEN_NAMES = ["Ananya Bose", "Rohit Sharma", "Priya Nandi", "Imtiaz Ali", "Sneha Kar", "Vikram Sinha", "Meghna Roy", "Arjun Pillai", "Farhan Qureshi", "Deepa Iyer"];

const VEHICLE_MIX: [SlotType, number][] = [
  ["CAR", 46],
  ["TWO_WHEELER", 32],
  ["THREE_WHEELER", 7],
  ["COMMERCIAL", 8],
  ["EV", 4],
  ["BUS", 1],
  ["TRUCK", 1],
  ["VIP", 1],
];

const MODE_MIX: [PaymentMode, number][] = [
  ["CASH", 34],
  ["UPI_QR", 38],
  ["UPI_INTENT", 12],
  ["CARD", 6],
  ["WALLET", 4],
  ["PASS", 4],
  ["NETBANKING", 1],
  ["CORPORATE", 1],
];

const HOURLY_RATE: Record<string, number> = {
  TWO_WHEELER: 1000,
  THREE_WHEELER: 1500,
  CAR: 2000,
  EV: 1500,
  COMMERCIAL: 4000,
  BUS: 6000,
  TRUCK: 6000,
  VIP: 5000,
  GOVERNMENT: 0,
  ACCESSIBLE: 1000,
};

/** The grace period the demo rate cards in `pricing.ts` all carry. */
const GRACE_MIN = 10;

/**
 * A fare and the arithmetic behind it, the way the server would answer.
 *
 * This used to return a single number, which was all the sessions table needed.
 * The Fare tab now shows the calculation — every line, the grace period, the
 * real tax rate — and a demonstration with no breakdown to show would leave
 * that screen permanently on its "not itemised" fallback, which is precisely
 * the state it exists to replace.
 *
 * The totals are derived here and copied onto the session, rather than computed
 * twice: a breakdown whose lines do not add up to the total printed beside it
 * is the one bug a fare screen must never have, even in a demonstration.
 */
function quoteFor(
  type: SlotType,
  minutes: number,
  opts: { penalty: number; discounted: boolean },
): Quote {
  const rate = HOURLY_RATE[type] ?? 2000;
  const chargeableMinutes = Math.max(0, minutes - GRACE_MIN);
  const blocks = Math.ceil(chargeableMinutes / 60);

  const lines: QuoteLine[] = [];
  if (blocks > 0) {
    lines.push({ label: "First hour", code: "BASE", amount: rate });
  }
  if (blocks > 1) {
    lines.push({
      label: `Each additional hour × ${blocks - 1}`,
      code: "INCREMENT",
      amount: rate * (blocks - 1),
    });
  }

  const grossAmount = lines.reduce((sum, line) => sum + line.amount, 0);
  const discountAmount = opts.discounted ? Math.round(grossAmount * 0.1) : 0;
  const taxPercent = 18;
  const taxable = grossAmount - discountAmount + opts.penalty;
  const taxAmount = Math.round((taxable * taxPercent) / 100);

  return {
    tariffId: "trf_001",
    tariffName: type === "CAR" ? "City Standard — Car" : `City Standard — ${type}`,
    tariffVersion: 3,
    durationMinutes: minutes,
    chargeableMinutes,
    gracePeriodMin: GRACE_MIN,
    lines,
    grossAmount,
    discountAmount,
    penaltyAmount: opts.penalty,
    taxAmount,
    taxPercent,
    payableAmount: taxable + taxAmount,
    // A long stay would hit the daily cap in `pricing.ts`; the demo durations
    // stay under it, so claiming otherwise would be a figure with no working.
    cappedByDailyLimit: false,
    waivedByPass: false,
  };
}

/**
 * The bays each zone actually has, so a demonstration session can be parked in
 * one that exists.
 *
 * Sessions used to carry an invented `slotCode` — `C07` whether or not the zone
 * had a bay by that name — and no `slotId` at all. Nothing noticed while no
 * screen joined the two; the bay board is that join, and against invented codes
 * it would show an empty car park beside forty-six parked cars.
 */
const BAYS_BY_ZONE = new Map<string, Slot[]>();
for (const slot of SLOTS) {
  const bays = BAYS_BY_ZONE.get(slot.zoneId);
  if (bays) bays.push(slot);
  else BAYS_BY_ZONE.set(slot.zoneId, [slot]);
}

/** Bays already holding a live demonstration session. */
const claimedBays = new Set<string>();

function bayFor(zoneId: string, live: boolean): Slot | undefined {
  const bays = BAYS_BY_ZONE.get(zoneId) ?? [];
  if (bays.length === 0) return undefined;

  if (!live) {
    // A finished session's bay is history. It may well have been re-let since,
    // so this deliberately does not avoid the bays live sessions are using.
    return rng.pick(bays);
  }

  /**
   * One live session in two dozen is put in a bay the fixture does not call
   * OCCUPIED. That is a real fault this system produces — the API flips a bay
   * to OCCUPIED when a session starts and back when it ends, and nothing
   * reconciles a bay whose session was abandoned — and the bay board's
   * mismatch panel exists to surface it. A demonstration in which the panel is
   * always empty would not show that it works.
   */
  const deliberateMismatch = rng.bool(0.04);
  const candidates = bays.filter(
    (bay) =>
      !claimedBays.has(bay.id) &&
      (deliberateMismatch ? bay.status === "AVAILABLE" : bay.status === "OCCUPIED"),
  );
  // No free bay of the kind wanted: the vehicle is parked in the zone without a
  // numbered bay, which is the ordinary case in a zone with few bays mapped.
  const bay = candidates[0];
  if (!bay) return undefined;
  claimedBays.add(bay.id);
  return bay;
}

export const SESSIONS: ParkingSession[] = Array.from({ length: 180 }).map((_, i) => {
  const zone = rng.pick(ZONES);
  const attendant = rng.pick(ATTENDANTS.filter((a) => a.vendorId === zone.vendorId)) ?? ATTENDANTS[0];
  const type = rng.weighted(VEHICLE_MIX);
  const active = i < 46;
  const startMinsAgo = active ? rng.int(4, 420) : rng.int(300, 4800);
  const duration = active ? startMinsAgo : rng.int(18, 380);
  const overstay = active && startMinsAgo > 330;
  const penalty = overstay ? 5000 : 0;
  const discounted = rng.bool(0.08);
  const cancelled = !active && rng.bool(0.03);
  /**
   * Only a session that ended has a fare. The API leaves `fareBreakdown` null
   * while a session runs — there is nothing to price yet — and leaves it null
   * on a cancelled one too, which zeroes the amount owed rather than pricing
   * it. Inventing either would put a figure on screen the server never agreed
   * to, which is the thing the Fare tab is being rebuilt to stop doing.
   */
  const priced = active || cancelled ? undefined : quoteFor(type, duration, { penalty, discounted });
  const paid = Boolean(priced) && rng.bool(0.96);
  const isCitizen = rng.bool(0.42);
  const bay = bayFor(zone.id, active);

  return {
    id: `ses_${String(i + 1).padStart(4, "0")}`,
    code: `KMCP-${rng.int(100000, 999999).toString(36).toUpperCase().padStart(6, "0")}`,
    plateNumber: plate(),
    vehicleType: type,
    zoneId: zone.id,
    zoneName: zone.name,
    slotId: bay?.id,
    slotCode: bay?.code,
    vendorName: zone.vendorName ?? "—",
    attendantName: attendant.name,
    vendorId: zone.vendorId,
    attendantId: attendant.id,
    status: active ? (overstay ? "OVERSTAY" : "ACTIVE") : cancelled ? "CANCELLED" : rng.bool(0.02) ? "DISPUTED" : "COMPLETED",
    source: rng.weighted([
      ["ATTENDANT_APP", 82],
      ["OFFLINE_SYNC", 12],
      ["CITIZEN_APP", 5],
      ["ADMIN_PORTAL", 1],
    ]),
    startAt: minutesAgo(startMinsAgo),
    endAt: active ? undefined : minutesAgo(Math.max(1, startMinsAgo - duration)),
    durationMinutes: active ? undefined : duration,
    // The server reports a running time for a live session and nothing for a
    // closed one, which is what lets a screen tell a ticking figure from a
    // final one. Mirrored here so demo mode exercises the same branch.
    elapsedMinutes: active ? startMinsAgo : undefined,
    grossAmount: priced?.grossAmount,
    discountAmount: priced?.discountAmount ?? 0,
    taxAmount: priced?.taxAmount ?? 0,
    penaltyAmount: penalty,
    payableAmount: priced?.payableAmount,
    fareBreakdown: priced,
    paymentMode: paid ? rng.weighted(MODE_MIX) : undefined,
    paid,
    evidenceStart: `evidence/${zone.code.toLowerCase()}/start-${i + 1}.jpg`,
    evidenceEnd: active ? undefined : `evidence/${zone.code.toLowerCase()}/end-${i + 1}.jpg`,
    citizenName: isCitizen ? rng.pick(CITIZEN_NAMES) : undefined,
    citizenPhone: isCitizen ? `+91 9${rng.int(100000, 999999)}${rng.int(10, 99)}` : undefined,
    isOverstay: overstay,
  };
});

export const ACTIVE_SESSIONS = SESSIONS.filter((s) => s.status === "ACTIVE" || s.status === "OVERSTAY");

export const PAYMENTS: Payment[] = SESSIONS.filter((s) => s.paid).map((s, i) => {
  const failed = rng.bool(0.04);
  const refunded = !failed && rng.bool(0.03);
  return {
    id: `pay_${String(i + 1).padStart(4, "0")}`,
    sessionCode: s.code,
    plateNumber: s.plateNumber,
    mode: s.paymentMode!,
    amount: s.payableAmount ?? 0,
    status: failed ? "FAILED" : refunded ? "REFUNDED" : "CAPTURED",
    gatewayPaymentId: s.paymentMode === "CASH" ? undefined : `pay_R${rng.int(100000000, 999999999)}`,
    vendorName: s.vendorName,
    attendantName: s.attendantName,
    zoneName: s.zoneName,
    paidAt: s.endAt,
    refundedAmount: refunded ? (s.payableAmount ?? 0) : 0,
    receiptNumber: failed ? undefined : `RCPT/26-27/${String(90000 + i)}`,
    failureReason: failed ? rng.pick(["Customer cancelled the UPI request", "Insufficient balance", "Bank timeout"]) : undefined,
  };
});

const INCIDENT_DESCRIPTIONS: Record<string, string[]> = {
  ILLEGAL_PARKING: [
    "Vehicle parked across two bays blocking the access lane.",
    "Car left on the footpath outside the marked zone boundary.",
    "Truck occupying a two-wheeler bay since morning.",
  ],
  ACCIDENT: [
    "Minor collision while reversing out of bay C12. No injuries.",
    "Two-wheeler skidded on wet surface near the entry ramp.",
  ],
  VEHICLE_DAMAGE: [
    "Scratch reported on the driver-side door after the session ended.",
    "Wing mirror found broken; citizen disputes responsibility.",
  ],
  PARKING_DISPUTE: [
    "Citizen disputes the duration charged; claims the session started later.",
    "Argument over a reserved bay allocated to a monthly pass holder.",
  ],
  WRONG_VEHICLE: [
    "Plate number captured does not match the vehicle in the evidence photo.",
    "Session started against a similar plate from a neighbouring bay.",
  ],
  OTHER: ["Street light outage making night collection unsafe.", "Signage board damaged at the zone entry."],
};

export const INCIDENTS: Incident[] = Array.from({ length: 26 }).map((_, i) => {
  const type = rng.weighted<Incident["type"]>([
    ["ILLEGAL_PARKING", 34],
    ["PARKING_DISPUTE", 22],
    ["VEHICLE_DAMAGE", 14],
    ["WRONG_VEHICLE", 12],
    ["ACCIDENT", 10],
    ["OTHER", 8],
  ]);
  const zone = rng.pick(ZONES);
  const attendant = rng.pick(ATTENDANTS);
  const status = rng.weighted<Incident["status"]>([
    ["OPEN", 32],
    ["IN_PROGRESS", 24],
    ["RESOLVED", 38],
    ["REJECTED", 6],
  ]);
  const resolved = status === "RESOLVED" || status === "REJECTED";
  return {
    id: `inc_${String(i + 1).padStart(3, "0")}`,
    reference: `INC-2608-${String(i + 1).padStart(3, "0")}`,
    type,
    zoneName: zone.name,
    sessionCode: rng.bool(0.7) ? rng.pick(SESSIONS).code : undefined,
    plateNumber: rng.bool(0.75) ? plate() : undefined,
    reportedBy: rng.bool(0.7) ? attendant.name : rng.pick(CITIZEN_NAMES),
    reporterRole: rng.bool(0.7) ? "ATTENDANT" : "CITIZEN",
    description: rng.pick(INCIDENT_DESCRIPTIONS[type]),
    photoCount: rng.int(0, 4),
    status,
    assignedTo: status === "IN_PROGRESS" ? rng.pick(["Zone Officer — Park Street", "Zone Officer — Ballygunge", "Enforcement Desk"]) : undefined,
    resolutionNote: resolved ? rng.pick(["Resolved on site with the citizen.", "Evidence reviewed; charge upheld.", "Charge waived as a goodwill gesture.", "Duplicate report — closed."]) : undefined,
    createdAt: minutesAgo(rng.int(20, 9000)),
    resolvedAt: resolved ? minutesAgo(rng.int(5, 3000)) : undefined,
  };
});

export const ACTIVITY_FEED: ActivityItem[] = Array.from({ length: 24 }).map((_, i) => {
  const kind = rng.weighted<ActivityItem["kind"]>([
    ["session_start", 34],
    ["payment", 28],
    ["session_end", 22],
    ["incident", 8],
    ["shift", 6],
    ["settlement", 2],
  ]);
  const zone = rng.pick(ZONES);
  const p = plate();
  const amount = rng.int(20, 480) * 100;
  const labels: Record<ActivityItem["kind"], { label: string; detail: string }> = {
    session_start: { label: "Parking started", detail: `${p} · ${zone.name}` },
    session_end: { label: "Parking ended", detail: `${p} · ${zone.name}` },
    payment: { label: "Payment captured", detail: `${p} · ${rng.pick(["UPI QR", "Cash", "Card", "Wallet"])}` },
    incident: { label: "Incident reported", detail: `${rng.pick(["Illegal parking", "Dispute", "Vehicle damage"])} · ${zone.name}` },
    shift: { label: "Shift closed", detail: `${rng.pick(ATTENDANTS).name} · ${zone.name}` },
    settlement: { label: "Settlement approved", detail: rng.pick(["Metro Parking", "Orbit Kerbside", "Civic Mobility"]) },
  };
  return {
    id: `act_${i}`,
    kind,
    label: labels[kind].label,
    detail: labels[kind].detail,
    zoneName: zone.name,
    amount: kind === "payment" || kind === "settlement" ? amount : undefined,
    at: minutesAgo(i * 3 + rng.int(0, 2)),
  };
});

/** 24 hourly buckets ending at NOW — used by the occupancy and revenue charts. */
export const HOURLY_SERIES = Array.from({ length: 24 }).map((_, i) => {
  const hour = (14 - 23 + i + 48) % 24;
  const daytimeWeight = hour >= 9 && hour <= 20 ? 1 : hour >= 6 && hour < 9 ? 0.6 : 0.22;
  const peak = hour === 11 || hour === 12 || hour === 18 || hour === 19 ? 1.25 : 1;
  const occupancy = Math.round(1400 * daytimeWeight * peak + rng.int(-90, 90));
  return {
    hour: `${String(hour).padStart(2, "0")}:00`,
    occupancy: Math.max(60, occupancy),
    sessions: Math.max(10, Math.round(occupancy / 5 + rng.int(-12, 12))),
    revenue: Math.max(2000, Math.round(occupancy * 34 + rng.int(-900, 900))) * 100,
  };
});

export const DAILY_SERIES = Array.from({ length: 30 }).map((_, i) => {
  const day = 29 - i;
  const weekend = day % 7 === 0 || day % 7 === 6;
  const base = weekend ? 5_10_000 : 6_40_000;
  return {
    date: daysAgo(day).slice(0, 10),
    label: new Date(daysAgo(day)).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    cash: (base * 0.38 + rng.int(-24000, 24000)) * 100,
    digital: (base * 0.62 + rng.int(-24000, 24000)) * 100,
    sessions: Math.round(base / 42 + rng.int(-220, 220)),
  };
});
