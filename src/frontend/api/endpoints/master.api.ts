import { api, type ApiResult } from "../client";
import type { SlotType, SlotStatus } from "@/shared/types/domain.types";
import type { Role } from "@/shared/constants/roles";

type Query = Record<string, string | number | boolean | undefined>;

/* ------------------------------------------------------------ vehicle types */

export interface ApiVehicleType {
  id: string;
  code: SlotType;
  label: string;
  iconKey?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export const vehicleTypesApi = {
  /** Public — the citizen app reads this before anyone signs in. */
  list: (includeInactive = false): Promise<ApiResult<ApiVehicleType[]>> =>
    api.get<ApiVehicleType[]>("/vehicle-types", {
      query: { includeInactive },
      anonymous: true,
    }),

  create: (body: Partial<ApiVehicleType>) => api.post<ApiVehicleType>("/vehicle-types", body),

  update: (id: string, body: Partial<ApiVehicleType>) =>
    api.patch<ApiVehicleType>(`/vehicle-types/${id}`, body),

  remove: (id: string) => api.delete(`/vehicle-types/${id}`),
};

/* -------------------------------------------------------------------- slots */

export interface ApiSlot {
  id: string;
  zoneId: string;
  code: string;
  type: SlotType;
  status: SlotStatus;
  isReserved: boolean;
  zone?: { id: string; code: string; name: string } | null;
}

export interface SlotSummary {
  zone: { id: string; code: string; name: string; capacity: number };
  total: number;
  mappedAgainstCapacity: { mapped: number; capacity: number };
  activeSessions: number;
  byStatus: { status: SlotStatus; count: number }[];
  byType: { type: SlotType; count: number }[];
}

export const slotsApi = {
  list: (query: Query = {}): Promise<ApiResult<ApiSlot[]>> => api.get<ApiSlot[]>("/slots", { query }),

  summary: (zoneId: string) => api.get<SlotSummary>(`/slots/summary/${zoneId}`),

  create: (body: { zoneId: string; code: string; type: SlotType; isReserved?: boolean }) =>
    api.post<ApiSlot>("/slots", body),

  /** Numbers a run of bays; existing codes are skipped, so retrying is safe. */
  bulkCreate: (body: {
    zoneId: string;
    prefix: string;
    from: number;
    to: number;
    type: SlotType;
    isReserved?: boolean;
    pad?: number;
  }) =>
    api.post<{ requested: number; created: number; skippedExisting: string[] }>("/slots/bulk", body),

  update: (id: string, body: { type?: SlotType; isReserved?: boolean }) =>
    api.patch<ApiSlot>(`/slots/${id}`, body),

  changeStatus: (id: string, status: SlotStatus, reason?: string) =>
    api.post<ApiSlot>(`/slots/${id}/status`, { status, reason }),

  remove: (id: string) => api.delete(`/slots/${id}`),
};

/* --------------------------------------------------------------- attendants */

export interface ApiAttendant {
  id: string;
  userId: string;
  vendorId: string;
  employeeCode: string;
  defaultZoneId?: string | null;
  isActive: boolean;
  createdAt: string;
  user: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    status: string;
    lastLoginAt?: string | null;
  };
  vendor: { id: string; orgName: string; status: string };
  onShift?: { id: string; startAt: string; zoneId?: string | null } | null;
}

export const attendantsApi = {
  list: (query: Query = {}): Promise<ApiResult<ApiAttendant[]>> =>
    api.get<ApiAttendant[]>("/attendants", { query }),

  get: (id: string) => api.get<ApiAttendant & { devices: unknown[]; sessionCount: number }>(`/attendants/${id}`),

  create: (body: {
    name: string;
    phone: string;
    email?: string;
    vendorId: string;
    employeeCode: string;
    defaultZoneId?: string;
    password?: string;
  }) => api.post<ApiAttendant>("/attendants", body),

  update: (id: string, body: Record<string, unknown>) => api.patch<ApiAttendant>(`/attendants/${id}`, body),

  setActive: (id: string, isActive: boolean, reason: string) =>
    api.post<ApiAttendant>(`/attendants/${id}/status`, { isActive, reason }),

  transfer: (id: string, vendorId: string, reason: string) =>
    api.post<ApiAttendant>(`/attendants/${id}/transfer`, { vendorId, reason }),

  /** Releases every bound device and ends the attendant's sessions with it. */
  unbindDevices: (id: string, reason: string) =>
    api.post<{ unbound: true; devicesReleased: number }>(`/attendants/${id}/unbind-device`, { reason }),
};

/* -------------------------------------------------------------------- users */

export interface ApiUser {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: Role;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "BLACKLISTED";
  twoFactorEnabled: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

export const usersApi = {
  list: (query: Query = {}): Promise<ApiResult<ApiUser[]>> => api.get<ApiUser[]>("/users", { query }),

  get: (id: string) =>
    api.get<ApiUser & { zoneIds: string[]; liveSessions: number; activeDevices: number }>(`/users/${id}`),

  create: (body: {
    name: string;
    email: string;
    phone?: string;
    role: Role;
    password: string;
    zoneIds?: string[];
  }) => api.post<ApiUser>("/users", body),

  update: (id: string, body: Partial<{ name: string; email: string; phone: string }>) =>
    api.patch<ApiUser>(`/users/${id}`, body),

  changeRole: (id: string, role: Role, reason: string) =>
    api.post<ApiUser>(`/users/${id}/role`, { role, reason }),

  changeStatus: (id: string, status: ApiUser["status"], reason: string) =>
    api.post<ApiUser>(`/users/${id}/status`, { status, reason }),

  resetPassword: (id: string, password: string, reason: string) =>
    api.post(`/users/${id}/password-reset`, { password, reason }),

  assignZones: (id: string, zoneIds: string[]) => api.post(`/users/${id}/zones`, { zoneIds }),
};

/* ----------------------------------------------------------- settings & cms */

export interface ConfigEntry {
  key: string;
  value: unknown;
  updatedAt: string;
  updatedBy?: string | null;
}

export interface ApiCmsPage {
  slug: string;
  title: string;
  bodyHtml: string;
  publishedAt?: string | null;
  updatedAt: string;
}

export interface ApiFaq {
  id: string;
  question: string;
  answer: string;
  category?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ApiBanner {
  id: string;
  title: string;
  body?: string | null;
  imageUrl?: string | null;
  audience: "CITIZEN" | "VENDOR" | "ALL";
  startAt: string;
  endAt: string;
  isActive: boolean;
}

export const settingsApi = {
  config: () => api.get<{ count: number; namespaces: Record<string, ConfigEntry[]> }>("/config"),

  setConfig: (key: string, value: unknown, reason?: string) =>
    api.put(`/config/${key}`, { value, reason }),

  setConfigBulk: (entries: { key: string; value: unknown }[], reason?: string) =>
    api.post("/config", { entries, reason }),

  pages: () => api.get<ApiCmsPage[]>("/cms/pages"),
  page: (slug: string) => api.get<ApiCmsPage>(`/cms/pages/${slug}`),
  upsertPage: (body: { slug: string; title: string; bodyHtml: string; publish: boolean }) =>
    api.put<ApiCmsPage>("/cms/pages", body),
  removePage: (slug: string) => api.delete(`/cms/pages/${slug}`),

  faqs: () => api.get<ApiFaq[]>("/cms/faqs"),
  createFaq: (body: Omit<ApiFaq, "id">) => api.post<ApiFaq>("/cms/faqs", body),
  updateFaq: (id: string, body: Partial<ApiFaq>) => api.patch<ApiFaq>(`/cms/faqs/${id}`, body),
  removeFaq: (id: string) => api.delete(`/cms/faqs/${id}`),

  banners: () => api.get<ApiBanner[]>("/cms/banners"),
  createBanner: (body: Omit<ApiBanner, "id">) => api.post<ApiBanner>("/cms/banners", body),
  updateBanner: (id: string, body: Partial<ApiBanner>) => api.patch<ApiBanner>(`/cms/banners/${id}`, body),
  removeBanner: (id: string) => api.delete(`/cms/banners/${id}`),
};
