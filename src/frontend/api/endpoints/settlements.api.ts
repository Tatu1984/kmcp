import { api, type ApiResult } from "../client";
import type { PaymentMode, SettlementStatus } from "@/shared/types/domain.types";

type Query = Record<string, string | number | boolean | undefined>;

export interface ApiSettlement {
  id: string;
  /** Derived server-side from the period and id. */
  reference: string;
  vendorId: string;
  periodStart: string;
  periodEnd: string;
  /** All paise, all net of refunds. */
  grossCollected: number;
  cashCollected: number;
  digitalCollected: number;
  commissionAmount: number;
  vendorShare: number;
  governmentShare: number;
  status: SettlementStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  payoutRef?: string | null;
  payoutStatus?: string | null;
  createdAt: string;
  sessionsCount: number;
  vendor?: {
    id: string;
    orgName: string;
    commissionPct: string | number;
    bankAccountNo?: string | null;
    bankIfsc?: string | null;
  } | null;
}

export interface ApiSettlementDetail extends ApiSettlement {
  lines: {
    id: string;
    amount: number;
    commission: number;
    payment?: {
      id: string;
      mode: PaymentMode;
      paidAt?: string | null;
      session?: { id: string; code: string; plateNumber: string } | null;
    } | null;
  }[];
  /** Double-entry postings. Debits and credits always sum equal. */
  ledger: {
    id: string;
    account: string;
    debit: number;
    credit: number;
    refType: string;
    refId: string;
    postedAt: string;
  }[];
}

export interface SettlementSummary {
  gross: number;
  vendorShare: number;
  governmentShare: number;
  commission: number;
  counts: {
    draft: number;
    pendingApproval: number;
    approved: number;
    rejected: number;
    paid: number;
  };
  /** Approved but not yet transferred — what the authority still owes. */
  awaitingPayout: number;
}

export interface RevenueOverview {
  gross: number;
  refunded: number;
  net: number;
  count: number;
  byMode: { mode: PaymentMode; amount: number; count: number }[];
  byDay: { date: string; amount: number }[];
  byZone: {
    id: string;
    code: string;
    name: string;
    wardName?: string | null;
    vendorName?: string | null;
    amount: number;
  }[];
  byVendor: {
    id: string;
    orgName: string;
    commissionPct: number;
    zoneCount: number;
    attendantCount: number;
    amount: number;
    commission: number;
    governmentShare: number;
  }[];
}

export const settlementsApi = {
  list: (query: Query = {}): Promise<ApiResult<ApiSettlement[]>> =>
    api.get<ApiSettlement[]>("/settlements", { query }),

  get: (id: string) => api.get<ApiSettlementDetail>(`/settlements/${id}`),

  summary: () => api.get<SettlementSummary>("/settlements/summary"),

  /** Sweeps in every captured payment in the period no settlement has claimed. */
  generate: (body: { vendorId: string; periodStart: string; periodEnd: string }) =>
    api.post<ApiSettlementDetail>("/settlements/generate", body),

  submit: (id: string) => api.post<ApiSettlementDetail>(`/settlements/${id}/submit`),

  /** Posts the ledger entries. Refused if they would not balance. */
  approve: (id: string) => api.post<ApiSettlementDetail>(`/settlements/${id}/approve`),

  reject: (id: string, reason: string) =>
    api.post<ApiSettlementDetail>(`/settlements/${id}/reject`, { reason }),

  /**
   * Records a transfer made at the bank against its reference. It does not move
   * money — RazorpayX credentials do not exist yet.
   */
  payout: (id: string, reference: string, note?: string) =>
    api.post<ApiSettlementDetail>(`/settlements/${id}/payout`, { reference, note }),
};

export const revenueApi = {
  overview: (query: { from?: string; to?: string; vendorId?: string } = {}) =>
    api.get<RevenueOverview>("/revenue", { query }),
};
