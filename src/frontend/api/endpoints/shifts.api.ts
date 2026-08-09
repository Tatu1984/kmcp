import { api, type ApiResult } from "../client";
import type { ShiftStatus } from "@/shared/types/domain.types";

type Query = Record<string, string | number | boolean | undefined>;

export interface ApiShift {
  id: string;
  attendantId: string;
  vendorId: string;
  zoneId?: string | null;
  startAt: string;
  endAt?: string | null;
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
  sessionsCount: number;
  /** Paise. What the sessions say was taken in cash. */
  cashExpected: number;
  /** Paise. What the attendant declared they were handing in. */
  cashDeposited?: number | null;
  digitalTotal: number;
  /** Deposited minus expected: negative is short, positive is over. */
  varianceAmount?: number | null;
  status: ShiftStatus;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  attendant?: {
    id: string;
    employeeCode: string;
    user: { name: string; phone?: string | null };
  } | null;
  vendor?: { id: string; orgName: string } | null;
  zone?: { id: string; code: string; name: string } | null;
}

export interface ShiftListQuery extends Query {
  status?: ShiftStatus;
  attendantId?: string;
  vendorId?: string;
  zoneId?: string;
  from?: string;
  to?: string;
  varianceOnly?: boolean;
  page?: number;
  pageSize?: number;
  sort?: string;
}

export const shiftsApi = {
  list: (query: ShiftListQuery = {}): Promise<ApiResult<ApiShift[]>> =>
    api.get<ApiShift[]>("/shifts", { query }),

  get: (id: string) => api.get<ApiShift>(`/shifts/${id}`),

  /** The signed-in attendant's open shift, or null. */
  current: () => api.get<ApiShift | null>("/shifts/current"),

  open: (body: { zoneId?: string; location?: { lat: number; lng: number }; clientEventId?: string } = {}) =>
    api.post<ApiShift>("/shifts/open", body),

  /**
   * `cashDeposited` is what the attendant counted, and is deliberately never
   * pre-filled from the expected figure — the close is a comparison, and
   * pre-filling would turn a count into a confirmation.
   */
  close: (
    id: string,
    body: { cashDeposited: number; location?: { lat: number; lng: number }; notes?: string },
  ) => api.post<ApiShift>(`/shifts/${id}/close`, body),

  /** Nobody may verify their own shift. */
  verify: (id: string, body: { cashReceived?: number; notes?: string } = {}) =>
    api.post<ApiShift>(`/shifts/${id}/verify`, body),
};
