import { api, type ApiResult } from "../client";
import type { SessionStatus, SessionSource, SlotType } from "@/shared/types/domain.types";

type Query = Record<string, string | number | boolean | undefined>;

export interface ApiSession {
  id: string;
  code: string;
  clientEventId?: string | null;
  zoneId: string;
  slotId?: string | null;
  plateNumber: string;
  vehicleTypeId: string;
  vendorId: string;
  attendantId?: string | null;
  shiftId?: string | null;
  tariffId?: string | null;
  status: SessionStatus;
  source: SessionSource;
  startAt: string;
  endAt?: string | null;
  durationMinutes?: number | null;
  evidenceStartMediaId?: string | null;
  evidenceEndMediaId?: string | null;
  grossAmount?: number | null;
  discountAmount: number;
  taxAmount: number;
  penaltyAmount: number;
  payableAmount?: number | null;
  fareBreakdown?: unknown;
  cancelledReason?: string | null;
  createdAt: string;
  zone?: { id: string; code: string; name: string } | null;
  slot?: { id: string; code: string } | null;
  vehicleType?: { id: string; code: SlotType; label: string } | null;
  vendor?: { id: string; orgName: string } | null;
  attendant?: { id: string; employeeCode: string; user: { name: string } } | null;
  /** Server-computed: running time for a live session, final for a closed one. */
  elapsedMinutes?: number | null;
  isOverstay?: boolean;
}

export interface PlateLookup {
  plateNumber: string;
  known: boolean;
  vehicle: {
    id: string;
    plateNumber: string;
    makeModel?: string | null;
    colour?: string | null;
    isBlacklisted: boolean;
    vehicleType: { code: SlotType; label: string };
  } | null;
  active: ApiSession | null;
  recent: {
    id: string;
    code: string;
    startAt: string;
    endAt?: string | null;
    payableAmount?: number | null;
    zone: { name: string };
  }[];
}

export const sessionsApi = {
  list: (query: Query = {}): Promise<ApiResult<ApiSession[]>> =>
    api.get<ApiSession[]>("/sessions", { query }),

  get: (idOrCode: string) => api.get<ApiSession>(`/sessions/${idOrCode}`),

  live: () =>
    api.get<{
      activeSessions: number;
      overstaying: number;
      overstayAfterMinutes: number;
      byZone: { zoneId: string; count: number }[];
    }>("/sessions/live"),

  lookupPlate: (plateNumber: string) =>
    api.get<PlateLookup>(`/sessions/plate/${encodeURIComponent(plateNumber)}`),

  /**
   * `clientEventId` makes this safe to retry — the same id always resolves to
   * the same session, which is what lets the vendor app flush an offline queue
   * more than once without charging twice.
   */
  start: (body: {
    clientEventId?: string;
    zoneId: string;
    slotId?: string;
    plateNumber: string;
    vehicleType: SlotType;
    location?: { lat: number; lng: number };
    evidenceMediaId?: string;
    startedAt?: string;
    source?: SessionSource;
  }) => api.post<ApiSession & { replayed: boolean }>("/sessions/start", body),

  end: (
    idOrCode: string,
    body: {
      clientEventId?: string;
      location?: { lat: number; lng: number };
      evidenceMediaId?: string;
      endedAt?: string;
      discountCode?: string;
    } = {},
  ) => api.post<ApiSession & { replayed: boolean }>(`/sessions/${idOrCode}/end`, body),

  cancel: (idOrCode: string, reason: string) =>
    api.post<ApiSession>(`/sessions/${idOrCode}/cancel`, { reason }),
};
