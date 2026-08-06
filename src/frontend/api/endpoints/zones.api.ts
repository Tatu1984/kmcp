import { api, type ApiResult } from "../client";
import type { SlotType, Zone, ZoneStatus } from "@/shared/types/domain.types";

/** The zone shape the API returns — occupancy is computed server-side. */
export interface ApiZone {
  id: string;
  code: string;
  name: string;
  wardId?: string | null;
  streetId?: string | null;
  centerLat: number;
  centerLng: number;
  capacity: number;
  allowedVehicleTypeIds: SlotType[];
  openTime: string;
  closeTime: string;
  status: ZoneStatus;
  closureReason?: string | null;
  closureUntil?: string | null;
  createdAt: string;
  ward?: { id: string; code: string; name: string } | null;
  street?: { id: string; name: string } | null;
  occupied: number;
  available: number;
  occupancyPct: number;
  availability: "AVAILABLE" | "LIMITED" | "FULL";
}

export interface ZoneListQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  q?: string;
  status?: ZoneStatus;
  wardId?: string;
  vendorId?: string;
}

export const zonesApi = {
  list: (query: ZoneListQuery = {}): Promise<ApiResult<ApiZone[]>> =>
    api.get<ApiZone[]>("/zones", { query: query as Record<string, string | number | undefined> }),

  get: (id: string) => api.get<ApiZone & { vendor: unknown }>(`/zones/${id}`),

  occupancy: (id: string) => api.get(`/zones/${id}/occupancy`),

  heatmap: () => api.get<ApiZone[]>("/zones/heatmap"),

  /** Public — no token required. */
  nearby: (lat: number, lng: number, radius = 2000) =>
    api.get<ApiZone[]>("/zones/nearby", { query: { lat, lng, radius }, anonymous: true }),

  create: (body: Partial<Zone> & Record<string, unknown>) => api.post<ApiZone>("/zones", body),

  update: (id: string, body: Record<string, unknown>) => api.patch<ApiZone>(`/zones/${id}`, body),

  changeStatus: (id: string, status: ZoneStatus, reason?: string, until?: string) =>
    api.post<ApiZone>(`/zones/${id}/status`, { status, reason, until }),

  assignVendor: (id: string, vendorId: string) => api.post(`/zones/${id}/vendor`, { vendorId }),

  retire: (id: string, reason: string) => api.delete(`/zones/${id}`, { reason }),
};
