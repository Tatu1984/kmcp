import { api, type ApiResult } from "../client";
import type { PassStatus, SessionStatus, SlotType, UserStatus } from "@/shared/types/domain.types";

type Query = Record<string, string | number | boolean | undefined>;

export interface ApiCitizen {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  status: UserStatus;
  vehicleCount: number;
  sessionsCount: number;
  /** Paise, net of refunds. */
  totalSpent: number;
  hasActivePass: boolean;
  joinedAt: string;
  lastSeenAt?: string | null;
}

export interface ApiCitizenVehicle {
  id: string;
  plateNumber: string;
  makeModel?: string | null;
  colour?: string | null;
  /** The flag an attendant's handset actually checks when starting a session. */
  isBlacklisted: boolean;
  vehicleType?: { id: string; code: SlotType; label: string } | null;
}

export interface ApiCitizenDetail extends ApiCitizen {
  vehicles: ApiCitizenVehicle[];
  sessions: {
    id: string;
    code: string;
    plateNumber: string;
    status: SessionStatus;
    startAt: string;
    endAt?: string | null;
    payableAmount?: number | null;
    zone?: { id: string; name: string } | null;
  }[];
  passes: {
    id: string;
    qrCode: string;
    validFrom: string;
    validTo: string;
    status: PassStatus;
    plan?: { name: string; price: number } | null;
  }[];
}

export interface CitizenSummary {
  total: number;
  active: number;
  suspended: number;
  blacklisted: number;
  withActivePass: number;
  claimedVehicles: number;
}

export interface CitizenListQuery extends Query {
  status?: UserStatus;
  withPass?: boolean;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  q?: string;
}

export const citizensApi = {
  list: (query: CitizenListQuery = {}): Promise<ApiResult<ApiCitizen[]>> =>
    api.get<ApiCitizen[]>("/citizens", { query }),

  get: (id: string) => api.get<ApiCitizenDetail>(`/citizens/${id}`),

  summary: () => api.get<CitizenSummary>("/citizens/summary"),

  /** Ends their signed-in sessions. Vehicles are untouched — see below. */
  setStatus: (id: string, status: UserStatus, reason: string) =>
    api.post<ApiCitizenDetail>(`/citizens/${id}/status`, { status, reason }),

  /**
   * Blacklisting the account does not stop the car at the kerb: an attendant
   * types a plate and never sees an owner, so the plate has to be blocked too.
   */
  setVehicleBlacklist: (id: string, vehicleId: string, isBlacklisted: boolean, reason: string) =>
    api.post<ApiCitizenDetail>(`/citizens/${id}/vehicles/${vehicleId}/blacklist`, {
      isBlacklisted,
      reason,
    }),
};
