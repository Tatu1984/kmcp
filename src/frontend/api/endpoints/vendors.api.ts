import { api, type ApiResult } from "../client";
import type { VendorStatus } from "@/shared/types/domain.types";

type Query = Record<string, string | number | boolean | undefined>;

export interface ApiVendor {
  id: string;
  userId: string;
  orgName: string;
  contactName: string;
  contactPhone: string;
  gstin?: string | null;
  pan?: string | null;
  bankAccountName?: string | null;
  bankAccountNo?: string | null;
  bankIfsc?: string | null;
  /** Prisma Decimal crosses the wire as a string — parse before arithmetic. */
  commissionPct: string;
  rating?: string | null;
  status: VendorStatus;
  approvedAt?: string | null;
  createdAt: string;
  zoneCount?: number;
  attendantCount?: number;
}

export const vendorsApi = {
  list: (query: Query = {}): Promise<ApiResult<ApiVendor[]>> =>
    api.get<ApiVendor[]>("/vendors", { query }),

  get: (id: string) => api.get<ApiVendor>(`/vendors/${id}`),

  performance: (id: string) => api.get(`/vendors/${id}/performance`),

  create: (body: Record<string, unknown>) => api.post<ApiVendor>("/vendors", body),

  update: (id: string, body: Record<string, unknown>) => api.patch<ApiVendor>(`/vendors/${id}`, body),

  changeStatus: (id: string, status: VendorStatus, reason?: string) =>
    api.post<ApiVendor>(`/vendors/${id}/status`, { status, reason }),

  addDocument: (id: string, type: string, mediaId: string) =>
    api.post(`/vendors/${id}/documents`, { type, mediaId }),

  verifyDocument: (documentId: string, verified: boolean) =>
    api.patch(`/vendors/documents/${documentId}`, { verified }),

  assignZones: (id: string, zoneIds: string[], replace = false) =>
    api.post(`/vendors/${id}/zones`, { zoneIds, replace }),

  setCommission: (id: string, commissionPct: number, reason: string) =>
    api.patch(`/vendors/${id}/commission`, { commissionPct, reason }),
};
