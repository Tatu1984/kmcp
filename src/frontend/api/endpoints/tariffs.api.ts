import { api } from "../client";
import type { SlotType } from "@/shared/types/domain.types";

export interface QuoteLine {
  label: string;
  code: string;
  amount: number;
}

/** Every amount is integer paise. Format only at the edge. */
export interface Quote {
  tariffId: string;
  tariffName: string;
  durationMinutes: number;
  chargeableMinutes: number;
  gracePeriodMin: number;
  lines: QuoteLine[];
  grossAmount: number;
  discountAmount: number;
  penaltyAmount: number;
  taxAmount: number;
  taxPercent: number;
  payableAmount: number;
  cappedByDailyLimit: boolean;
  waivedByPass: boolean;
}

export interface ApiTariff {
  id: string;
  name: string;
  zoneId?: string | null;
  vehicleTypeId: string;
  baseAmount: number;
  baseMinutes: number;
  incrementAmount: number;
  incrementMinutes: number;
  dailyCapAmount?: number | null;
  gracePeriodMin: number;
  overstayPenalty?: number | null;
  taxPercent: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isPublished: boolean;
  version: number;
  priority: number;
  createdAt: string;
  zone?: { id: string; code: string; name: string } | null;
  vehicleType?: { id: string; code: SlotType; label: string } | null;
  rules?: {
    id: string;
    type: string;
    label?: string | null;
    multiplier?: number | null;
    flatAmount?: number | null;
  }[];
}

export const tariffsApi = {
  list: (query: Record<string, string | number | undefined> = {}) =>
    api.get<ApiTariff[]>("/tariffs", { query }),

  get: (id: string) => api.get<ApiTariff>(`/tariffs/${id}`),

  /**
   * The fare preview. This calls the server rather than computing anything
   * locally — the API is the single authority on price, which is why the portal,
   * the vendor app and the citizen app can never disagree.
   */
  preview: (input: {
    zoneId: string;
    vehicleType: SlotType;
    durationMinutes?: number;
    startAt?: string;
    endAt?: string;
    discountCode?: string;
    overstayAfterMinutes?: number;
  }) => api.post<Quote>("/tariffs/preview", input),

  applicable: (zoneId: string, vehicleType: SlotType) =>
    api.get("/tariffs/applicable", { query: { zoneId, vehicleType } }),

  create: (body: Record<string, unknown>) => api.post("/tariffs", body),
  update: (id: string, body: Record<string, unknown>) => api.patch(`/tariffs/${id}`, body),
  duplicate: (id: string) => api.post(`/tariffs/${id}/duplicate`),
  publish: (id: string, approvalReference: string) =>
    api.post(`/tariffs/${id}/publish`, { approvalReference }),
  archive: (id: string, reason: string) => api.delete(`/tariffs/${id}`, { reason }),

  holidays: () => api.get("/holidays"),
  discounts: () => api.get("/discounts"),
};
