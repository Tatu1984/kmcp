import { api } from "../client";
import type { ZoneStatus } from "@/shared/types/domain.types";

/** Mirrors the shape the dashboard's mock `DASHBOARD` object had. */
export interface DashboardOverview {
  activeVehicles: number;
  totalCapacity: number;
  totalOccupied: number;
  availableSlots: number;
  occupancyPct: number;

  /** All paise, all net of refunds. */
  revenueToday: number;
  revenueYesterday: number;
  revenueMonth: number;

  cashCollection: number;
  digitalCollection: number;
  upiCollection: number;

  pendingVendorPayments: number;

  sessionsToday: number;
  overstayCount: number;
  openIncidents: number;
  openShifts: number;
  varianceShifts: number;
  awaitingVerification: number;
  pendingSettlements: number;
  pendingVendorApprovals: number;

  activeVendors: number;
  attendantsOnShift: number;
  totalAttendants: number;
  registeredCitizens: number;
  activePasses: number;
  zonesOpen: number;
  zonesTotal: number;
}

export interface HourlyPoint {
  hour: string;
  /** Vehicles parked during that hour — overlap, not arrivals. */
  occupancy: number;
  sessions: number;
}

export interface DailyPoint {
  date: string;
  label: string;
  cash: number;
  digital: number;
  sessions: number;
}

export interface TopZone {
  id: string;
  code: string;
  name: string;
  wardName?: string | null;
  streetName?: string | null;
  vendorName?: string | null;
  capacity: number;
  occupied: number;
  status: ZoneStatus;
  openTime: string;
  closeTime: string;
  revenueToday: number;
}

export interface FeedItem {
  id: string;
  kind: "session_start" | "session_end" | "payment" | "incident" | "shift" | "settlement";
  label: string;
  detail: string;
  zoneName: string;
  amount?: number;
  at: string;
}

export const analyticsApi = {
  overview: () => api.get<DashboardOverview>("/analytics/overview"),

  /** Recent activity across sessions, payments, incidents and shifts. */
  feed: (limit = 40) => api.get<FeedItem[]>("/analytics/feed", { query: { limit } }),

  hourly: (date?: string) => api.get<HourlyPoint[]>("/analytics/series/hourly", { query: { date } }),

  daily: (days = 30) => api.get<DailyPoint[]>("/analytics/series/daily", { query: { days } }),

  topZones: (limit = 6) => api.get<TopZone[]>("/analytics/zones/top", { query: { limit } }),
};
