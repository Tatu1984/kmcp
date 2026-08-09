import { api, type ApiResult } from "../client";
import type { IncidentStatus, IncidentType } from "@/shared/types/domain.types";

type Query = Record<string, string | number | boolean | undefined>;

export interface ApiIncident {
  id: string;
  /** Derived from the id server-side — there is no reference column. */
  reference: string;
  reportedById: string;
  sessionId?: string | null;
  zoneId?: string | null;
  type: IncidentType;
  description: string;
  mediaIds: string[];
  photoCount: number;
  status: IncidentStatus;
  assignedTo?: string | null;
  resolutionNote?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  session?: {
    id: string;
    code: string;
    plateNumber: string;
    zoneId: string;
    vendorId: string;
  } | null;
  reportedBy?: { id: string; name: string; role: string } | null;
  assignedToUser?: { id: string; name: string } | null;
  resolvedByUser?: { id: string; name: string } | null;
  zone?: { id: string; code: string; name: string } | null;
}

export interface IncidentSummary {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  rejected: number;
  byType: { type: IncidentType; count: number }[];
}

export interface IncidentListQuery extends Query {
  status?: IncidentStatus;
  type?: IncidentType;
  zoneId?: string;
  sessionId?: string;
  assignedTo?: string;
  from?: string;
  to?: string;
  openOnly?: boolean;
  page?: number;
  pageSize?: number;
  sort?: string;
  q?: string;
}

export const incidentsApi = {
  list: (query: IncidentListQuery = {}): Promise<ApiResult<ApiIncident[]>> =>
    api.get<ApiIncident[]>("/incidents", { query }),

  get: (id: string) => api.get<ApiIncident>(`/incidents/${id}`),

  summary: () => api.get<IncidentSummary>("/incidents/summary"),

  /** Needs a session or a zone; the zone is taken from the session when omitted. */
  create: (body: {
    type: IncidentType;
    description: string;
    sessionId?: string;
    zoneId?: string;
    mediaIds?: string[];
  }) => api.post<ApiIncident>("/incidents", body),

  /** Assigning moves an open incident to in progress. */
  assign: (id: string, body: { assignedTo: string; note?: string }) =>
    api.post<ApiIncident>(`/incidents/${id}/assign`, body),

  /** Pick it up: in progress, assigned to the caller if nobody holds it yet. */
  start: (id: string) => api.post<ApiIncident>(`/incidents/${id}/start`),

  /** The note is required — it is what a complaint gets answered from later. */
  resolve: (id: string, body: { resolutionNote: string }) =>
    api.post<ApiIncident>(`/incidents/${id}/resolve`, body),

  reject: (id: string, body: { reason: string }) =>
    api.post<ApiIncident>(`/incidents/${id}/reject`, body),
};
