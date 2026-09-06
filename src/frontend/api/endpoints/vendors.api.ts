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
  /** Computed server-side: every required document verified. */
  kycComplete?: boolean;
  missingDocuments?: string[];
  user?: { id: string; email?: string | null; status: string; lastLoginAt?: string | null } | null;
  documents?: ApiVendorDocument[];
  _count?: { zones: number; attendants: number };
}

export interface ApiVendorDocument {
  id: string;
  type: string;
  mediaId: string;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
}

/** What `GET /vendors/dashboard` answers for the signed-in vendor. */
export interface ApiVendorDashboard {
  activeParking: number;
  sessionsToday: number;
  /** Paise. */
  cashToday: number;
  digitalToday: number;
  collectedToday: number;
  /** Approved or awaiting approval, not yet paid out. Paise. */
  settlementDue: number;
  openShifts: number;
}

export const vendorsApi = {
  /**
   * The vendor's own figures. Scoped by the API to the caller's vendor and
   * refused outright to an account that is not one, so there is no id to pass.
   */
  dashboard: () => api.get<ApiVendorDashboard>("/vendors/dashboard"),

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
