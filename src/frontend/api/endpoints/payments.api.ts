import { api, type ApiResult } from "../client";
import type { PaymentMode, PaymentStatus } from "@/shared/types/domain.types";

type Query = Record<string, string | number | boolean | undefined>;

export interface ApiReceipt {
  id: string;
  number: string;
  gstInvoiceNo?: string | null;
  issuedAt: string;
  sentChannels: string[];
}

export interface ApiPayment {
  id: string;
  sessionId?: string | null;
  passId?: string | null;
  shiftId?: string | null;
  mode: PaymentMode;
  /** Paise. Always the fare the server computed — never a client figure. */
  amount: number;
  status: PaymentStatus;
  idempotencyKey: string;
  gateway?: string | null;
  gatewayOrderId?: string | null;
  gatewayPaymentId?: string | null;
  signatureVerified: boolean;
  collectedByAttendantId?: string | null;
  paidByUserId?: string | null;
  paidAt?: string | null;
  refundedAmount: number;
  failureReason?: string | null;
  createdAt: string;
  session?: {
    id: string;
    code: string;
    plateNumber: string;
    zoneId: string;
    vendorId: string;
    payableAmount?: number | null;
  } | null;
  receipt?: ApiReceipt | null;
}

export interface PaymentSummary {
  collected: number;
  refunded: number;
  net: number;
  count: number;
  /** Money someone is still physically holding. */
  cash: number;
  /** Money that has already reached a bank. */
  digital: number;
  byMode: { mode: PaymentMode; amount: number; count: number }[];
}

export interface PaymentListQuery extends Query {
  status?: PaymentStatus;
  mode?: PaymentMode;
  sessionId?: string;
  shiftId?: string;
  vendorId?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}

/** What a Razorpay checkout sheet needs, returned alongside a gateway payment. */
export interface CheckoutHandles {
  replayed: boolean;
  gatewayKeyId?: string | null;
}

export const paymentsApi = {
  list: (query: PaymentListQuery = {}): Promise<ApiResult<ApiPayment[]>> =>
    api.get<ApiPayment[]>("/payments", { query }),

  get: (id: string) => api.get<ApiPayment>(`/payments/${id}`),

  summary: (query: { from?: string; to?: string } = {}) =>
    api.get<PaymentSummary>("/payments/summary", { query }),

  /**
   * Collect against a session.
   *
   * Note the absent amount: what is owed comes from the session's computed fare,
   * so a modified client cannot name its own price. `idempotencyKey` is required
   * because an attendant tapping "collect" twice on a failing connection must
   * produce one payment, not two.
   */
  collect: (body: {
    sessionId: string;
    mode: PaymentMode;
    idempotencyKey: string;
    paidByUserId?: string;
  }) => api.post<ApiPayment & CheckoutHandles>("/payments/collect", body),

  /** Confirms a completed checkout. The webhook remains the authority. */
  verify: (
    id: string,
    body: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
  ) => api.post<ApiPayment>(`/payments/${id}/verify`, body),

  /** Omit `amount` to return everything still refundable. */
  refund: (id: string, body: { amount?: number; reason: string }) =>
    api.post<ApiPayment>(`/payments/${id}/refund`, body),

  /** Issues the receipt, or returns the one already issued — never a second number. */
  receipt: (id: string) => api.post<ApiReceipt>(`/payments/${id}/receipt`),
};
