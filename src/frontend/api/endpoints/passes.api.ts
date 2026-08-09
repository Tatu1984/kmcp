import { api, type ApiResult } from "../client";
import type { PassStatus, SlotType } from "@/shared/types/domain.types";

type Query = Record<string, string | number | boolean | undefined>;

export interface ApiPassPlan {
  id: string;
  name: string;
  vehicleTypeId: string;
  /** Empty means city-wide. */
  zoneIds: string[];
  durationDays: number;
  /** Paise. */
  price: number;
  isActive: boolean;
  activePasses: number;
  vehicleType?: { id: string; code: SlotType; label: string } | null;
  zones: { id: string; code: string; name: string }[];
  /** "All zones", one zone's name, or a count. */
  zoneScope: string;
}

export interface ApiPass {
  id: string;
  userId: string;
  vehicleId: string;
  planId: string;
  qrCode: string;
  validFrom: string;
  validTo: string;
  status: PassStatus;
  createdAt: string;
  user?: { id: string; name: string; phone?: string | null; email?: string | null } | null;
  vehicle?: {
    id: string;
    plateNumber: string;
    vehicleType?: { id: string; code: SlotType; label: string } | null;
  } | null;
  plan?: { id: string; name: string; price: number; durationDays: number; zoneIds: string[] } | null;
}

export interface PassSummary {
  total: number;
  active: number;
  expired: number;
  cancelled: number;
  pendingPayment: number;
  expiringSoon: number;
  revenue: number;
}

export const passPlansApi = {
  list: (query: Query = {}): Promise<ApiResult<ApiPassPlan[]>> =>
    api.get<ApiPassPlan[]>("/pass-plans", { query }),

  get: (id: string) => api.get<ApiPassPlan>(`/pass-plans/${id}`),

  create: (body: {
    name: string;
    vehicleTypeId: string;
    zoneIds?: string[];
    durationDays: number;
    price: number;
    isActive?: boolean;
  }) => api.post<ApiPassPlan>("/pass-plans", body),

  update: (id: string, body: Record<string, unknown>) =>
    api.patch<ApiPassPlan>(`/pass-plans/${id}`, body),

  /** Plans are withdrawn from sale, never deleted. */
  setActive: (id: string, isActive: boolean) =>
    api.post<ApiPassPlan>(`/pass-plans/${id}/status`, { isActive }),
};

export const passesApi = {
  list: (query: Query = {}): Promise<ApiResult<ApiPass[]>> => api.get<ApiPass[]>("/passes", { query }),

  get: (id: string) => api.get<ApiPass>(`/passes/${id}`),

  summary: () => api.get<PassSummary>("/passes/summary"),

  cancel: (id: string, reason: string) => api.post<ApiPass>(`/passes/${id}/cancel`, { reason }),
};
