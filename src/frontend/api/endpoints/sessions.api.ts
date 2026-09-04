import { api, type ApiResult } from "../client";
import type {
  IncidentStatus,
  IncidentType,
  PaymentMode,
  PaymentStatus,
  SessionStatus,
  SessionSource,
  SlotType,
} from "@/shared/types/domain.types";

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
  /**
   * The captured payment, if there is one. Mode only — a listing has no use
   * for a gateway reference.
   *
   * Carried because its absence was worse than its weight: the portal has a
   * required `paid` flag, had nothing to populate it from, and so asserted
   * `false` for every row — which rendered every completed session in the city
   * as unpaid, with an "Unpaid" figure on the screen agreeing with it.
   * Optional here so a response from an older deployment reads as unpaid rather
   * than throwing.
   */
  payments?: { mode: PaymentMode }[];
}

/**
 * What `GET /sessions/:id` adds on top of a list row.
 *
 * The list carries only whether a payment was captured and by what mode — the
 * two facts a table cell shows. Anything that needs a payment *id*, for a
 * refund or a receipt, still has to fetch the session, and this stays a
 * separate type so a screen holding a list row cannot quietly assume otherwise.
 */
export interface ApiSessionDetail extends ApiSession {
  payments: {
    id: string;
    amount: number;
    mode: PaymentMode;
    status: PaymentStatus;
    createdAt: string;
  }[];
  incidents: { id: string; type: IncidentType; status: IncidentStatus; createdAt: string }[];
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

  get: (idOrCode: string) => api.get<ApiSessionDetail>(`/sessions/${idOrCode}`),

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
