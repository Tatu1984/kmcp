import { api, type ApiResult } from "../client";

type Query = Record<string, string | number | boolean | undefined>;

export type AttendantPayMode = "CASH" | "UPI" | "BANK_TRANSFER";

export const PAY_MODE_LABELS: Record<AttendantPayMode, string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
};

export interface ApiAttendantPayment {
  id: string;
  vendorId: string;
  attendantId: string;
  /** Paise. */
  amount: number;
  mode: AttendantPayMode;
  periodStart?: string | null;
  periodEnd?: string | null;
  /** UPI transaction id, bank UTR, or a cash voucher number. */
  reference?: string | null;
  note?: string | null;
  paidAt: string;
  recordedById: string;
  createdAt: string;
  attendant?: {
    id: string;
    employeeCode: string;
    user: { name: string; phone?: string | null };
  } | null;
}

export interface ApiAttendantPaySummary {
  /** Paise. */
  totalPaid: number;
  payments: number;
  byMode: { mode: AttendantPayMode; amount: number; count: number }[];
  /**
   * Every attendant on the vendor's books, including those paid nothing in the
   * period — a name missing from this list would read as "nothing owed" when it
   * actually means "never paid".
   */
  byAttendant: {
    attendantId: string;
    name: string;
    employeeCode: string;
    isActive: boolean;
    amount: number;
    payments: number;
  }[];
}

/**
 * What a vendor paid their own attendants.
 *
 * KMC contracts the vendor and settles with the vendor; the vendor employs the
 * attendant and pays them. Only the second leg lives here, and only the vendor
 * who made the payments can read it — the API refuses any caller without a
 * vendorId of their own, the authority and its superusers included. There is
 * consequently no `vendorId` parameter on any of these calls: there is nothing
 * to pass, because there is nothing else a caller could be asking about.
 */
export const attendantPaymentsApi = {
  list: (query: Query = {}): Promise<ApiResult<ApiAttendantPayment[]>> =>
    api.get<ApiAttendantPayment[]>("/attendant-payments", { query }),

  summary: (query: Query = {}) =>
    api.get<ApiAttendantPaySummary>("/attendant-payments/summary", { query }),

  /**
   * Records a payment that has already been made. This does not move money —
   * the vendor pays by cash, UPI or transfer from their own account, and the
   * platform holds the evidence that it happened.
   *
   * Anything other than cash must carry its transaction reference; a transfer
   * with nothing to quote cannot be reconciled against a bank statement later,
   * which is the only reason to record it at all.
   */
  create: (body: {
    attendantId: string;
    /** Paise. */
    amount: number;
    mode: AttendantPayMode;
    reference?: string;
    note?: string;
    periodStart?: string;
    periodEnd?: string;
    paidAt?: string;
  }) => api.post<ApiAttendantPayment>("/attendant-payments", body),
};
