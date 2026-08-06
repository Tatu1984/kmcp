import { api, type ApiResult } from "../client";

export interface ApiWard {
  id: string;
  code: string;
  name: string;
  streetCount?: number;
  zoneCount?: number;
}

export interface ApiStreet {
  id: string;
  wardId: string;
  name: string;
  ward?: { id: string; code: string; name: string } | null;
  zoneCount?: number;
}

type Query = Record<string, string | number | boolean | undefined>;

export const geographyApi = {
  wards: (query: Query = {}): Promise<ApiResult<ApiWard[]>> => api.get<ApiWard[]>("/wards", { query }),

  ward: (id: string) => api.get<ApiWard & { streets: { id: string; name: string }[] }>(`/wards/${id}`),

  createWard: (body: { code: string; name: string }) => api.post<ApiWard>("/wards", body),

  updateWard: (id: string, body: Partial<{ code: string; name: string }>) =>
    api.patch<ApiWard>(`/wards/${id}`, body),

  removeWard: (id: string) => api.delete<{ deleted: true; id: string }>(`/wards/${id}`),

  streets: (query: Query = {}): Promise<ApiResult<ApiStreet[]>> =>
    api.get<ApiStreet[]>("/streets", { query }),

  createStreet: (body: { wardId: string; name: string }) => api.post<ApiStreet>("/streets", body),

  updateStreet: (id: string, body: Partial<{ wardId: string; name: string }>) =>
    api.patch<ApiStreet>(`/streets/${id}`, body),

  removeStreet: (id: string) => api.delete<{ deleted: true; id: string }>(`/streets/${id}`),
};
