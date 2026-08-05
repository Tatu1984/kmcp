import type {
  ParkingSession,
  Payment,
  Incident,
  ActivityItem,
  SlotType,
  PaymentMode,
} from "@/shared/types/domain.types";
import { ZONES } from "./geography";
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

function fareFor(type: SlotType, minutes: number) {
  const base: Record<string, number> = {
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
  const b = base[type] ?? 2000;
  const blocks = Math.max(1, Math.ceil(minutes / 60));
  return b * blocks;
}

export const SESSIONS: ParkingSession[] = Array.from({ length: 180 }).map((_, i) => {
  const zone = rng.pick(ZONES);
  const attendant = rng.pick(ATTENDANTS.filter((a) => a.vendorId === zone.vendorId)) ?? ATTENDANTS[0];
  const type = rng.weighted(VEHICLE_MIX);
  const active = i < 46;
  const startMinsAgo = active ? rng.int(4, 420) : rng.int(300, 4800);
  const duration = active ? startMinsAgo : rng.int(18, 380);
  const gross = fareFor(type, duration);
  const overstay = active && startMinsAgo > 330;
  const penalty = overstay ? 5000 : 0;
  const discount = rng.bool(0.08) ? Math.round(gross * 0.1) : 0;
  const tax = Math.round((gross - discount + penalty) * 0.18);
  const payable = gross - discount + penalty + tax;
  const paid = !active && rng.bool(0.96);
  const isCitizen = rng.bool(0.42);

  return {
    id: `ses_${String(i + 1).padStart(4, "0")}`,
    code: `KMCP-${rng.int(100000, 999999).toString(36).toUpperCase().padStart(6, "0")}`,
    plateNumber: plate(),
    vehicleType: type,
    zoneId: zone.id,
    zoneName: zone.name,
    slotCode: rng.bool(0.55) ? `C${String(rng.int(1, 40)).padStart(2, "0")}` : undefined,
    vendorName: zone.vendorName ?? "—",
    attendantName: attendant.name,
    status: active ? (overstay ? "OVERSTAY" : "ACTIVE") : rng.bool(0.03) ? "CANCELLED" : rng.bool(0.02) ? "DISPUTED" : "COMPLETED",
    source: rng.weighted([
      ["ATTENDANT_APP", 82],
      ["OFFLINE_SYNC", 12],
      ["CITIZEN_APP", 5],
      ["ADMIN_PORTAL", 1],
    ]),
    startAt: minutesAgo(startMinsAgo),
    endAt: active ? undefined : minutesAgo(Math.max(1, startMinsAgo - duration)),
    durationMinutes: active ? undefined : duration,
    grossAmount: active ? undefined : gross,
    discountAmount: discount,
    taxAmount: active ? 0 : tax,
    penaltyAmount: penalty,
    payableAmount: active ? undefined : payable,
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
