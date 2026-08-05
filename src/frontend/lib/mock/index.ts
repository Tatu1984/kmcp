export * from "./rng";
export * from "./geography";
export * from "./partners";
export * from "./operations";
export * from "./pricing";
export * from "./money";
export * from "./governance";

import { ZONES, TOTAL_CAPACITY, TOTAL_OCCUPIED } from "./geography";
import { SESSIONS, ACTIVE_SESSIONS, PAYMENTS, INCIDENTS } from "./operations";
import { VENDORS, ATTENDANTS, SHIFTS } from "./partners";
import { SETTLEMENTS } from "./money";
import { CITIZENS } from "./governance";

const capturedPayments = PAYMENTS.filter((p) => p.status === "CAPTURED");
const cash = capturedPayments.filter((p) => p.mode === "CASH");
const digital = capturedPayments.filter((p) => p.mode !== "CASH");

export const DASHBOARD = {
  activeVehicles: ACTIVE_SESSIONS.length,
  totalCapacity: TOTAL_CAPACITY,
  totalOccupied: TOTAL_OCCUPIED,
  availableSlots: TOTAL_CAPACITY - TOTAL_OCCUPIED,
  occupancyPct: Math.round((TOTAL_OCCUPIED / TOTAL_CAPACITY) * 100),

  revenueToday: ZONES.reduce((s, z) => s + z.revenueToday, 0),
  revenueMonth: ZONES.reduce((s, z) => s + z.revenueMonth, 0),
  revenueYesterday: Math.round(ZONES.reduce((s, z) => s + z.revenueToday, 0) * 0.91),

  cashCollection: cash.reduce((s, p) => s + p.amount, 0),
  digitalCollection: digital.reduce((s, p) => s + p.amount, 0),
  upiCollection: capturedPayments
    .filter((p) => p.mode === "UPI_QR" || p.mode === "UPI_INTENT")
    .reduce((s, p) => s + p.amount, 0),

  vendorCollection: VENDORS.reduce((s, v) => s + v.revenueMonth, 0),
  pendingVendorPayments: VENDORS.reduce((s, v) => s + v.pendingSettlement, 0),

  sessionsToday: SESSIONS.length,
  overstayCount: SESSIONS.filter((s) => s.isOverstay).length,
  openIncidents: INCIDENTS.filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS").length,
  openShifts: SHIFTS.filter((s) => s.status === "OPEN").length,
  varianceShifts: SHIFTS.filter((s) => s.status === "VARIANCE_FLAGGED").length,
  pendingSettlements: SETTLEMENTS.filter((s) => s.status === "PENDING_APPROVAL").length,
  pendingVendorApprovals: VENDORS.filter((v) => v.status === "PENDING").length,

  activeVendors: VENDORS.filter((v) => v.status === "APPROVED").length,
  attendantsOnShift: ATTENDANTS.filter((a) => a.onShift).length,
  totalAttendants: ATTENDANTS.length,
  registeredCitizens: CITIZENS.length * 412,
  zonesOpen: ZONES.filter((z) => z.status === "OPEN").length,
  zonesTotal: ZONES.length,
};

export const TOP_ZONES = [...ZONES]
  .sort((a, b) => b.revenueToday - a.revenueToday)
  .slice(0, 6);

export const LOW_OCCUPANCY_ZONES = [...ZONES]
  .filter((z) => z.status === "OPEN")
  .sort((a, b) => a.occupied / a.capacity - b.occupied / b.capacity)
  .slice(0, 5);
