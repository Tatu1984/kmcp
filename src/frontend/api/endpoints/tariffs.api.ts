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

/**
 * A date the pricing rules treat differently.
 *
 * `multiplier` arrives as a string: it is a Prisma `Decimal` on the server, and
 * a decimal serialised through JSON stays a string rather than becoming a float
 * that rounds ₹0.01 away from a fare. Coerce it at the point of display.
 */
export interface ApiHoliday {
  id: string;
  date: string;
  name: string;
  isEvent: boolean;
  zoneIds: string[];
  multiplier?: number | string | null;
}

export interface ApiDiscount {
  id: string;
  name: string;
  code?: string | null;
  zoneId?: string | null;
  vehicleTypeId?: string | null;
  /** Percentage, as a decimal string. See `ApiHoliday.multiplier`. */
  percentOff?: number | string | null;
  /** Paise. */
  flatOff?: number | null;
  validFrom: string;
  validTo: string;
  maxUses?: number | null;
  usedCount: number;
  isActive: boolean;
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

  holidays: () => api.get<ApiHoliday[]>("/holidays"),

  createHoliday: (body: {
    date: string;
    name: string;
    isEvent?: boolean;
    zoneIds?: string[];
    multiplier?: number;
  }) => api.post<ApiHoliday>("/holidays", body),

  /**
   * There is no PATCH for a holiday. The calendar is add-and-remove by design —
   * a date is either in it or it is not — so correcting one means removing it
   * and adding it back, which is what the two calls above express.
   */
  removeHoliday: (id: string) => api.delete(`/holidays/${id}`),

  discounts: () => api.get<ApiDiscount[]>("/discounts"),

  createDiscount: (body: {
    name: string;
    code?: string;
    zoneId?: string;
    vehicleTypeId?: SlotType;
    percentOff?: number;
    flatOff?: number;
    validFrom: string;
    validTo: string;
    maxUses?: number;
    isActive?: boolean;
  }) => api.post<ApiDiscount>("/discounts", body),

  /**
   * `PATCH /discounts/:id` carries one field — `isActive`. Pausing and resuming
   * is the whole of what the API lets an officer change about a live discount,
   * which is deliberate: the terms a citizen was quoted under cannot be edited
   * out from under a redemption that already happened.
   */
  setDiscountActive: (id: string, isActive: boolean) =>
    api.patch<ApiDiscount>(`/discounts/${id}`, { isActive }),
};
