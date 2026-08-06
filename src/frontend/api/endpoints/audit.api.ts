import { api, type ApiResult } from "../client";
import type { Role } from "@/shared/constants/roles";

export interface AuditActor {
  id: string;
  name: string;
  email?: string | null;
  role: Role;
}

export interface AuditEntry {
  id: string;
  actorUserId?: string | null;
  actor?: AuditActor | null;
  action: string;
  entity: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
  requestId?: string | null;
  createdAt: string;
}

export interface AuthEvent {
  id: string;
  eventType:
    | "LOGIN_SUCCESS"
    | "LOGIN_FAILED"
    | "LOGOUT"
    | "SESSION_EXPIRED"
    | "SESSION_REVOKED"
    | "TOKEN_REUSE_DETECTED";
  userId?: string | null;
  userName?: string | null;
  userRole?: Role | null;
  identifierTried?: string | null;
  failureReason?: string | null;
  ipAddress?: string | null;
  city?: string | null;
  district?: string | null;
  region?: string | null;
  postal?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geoSource?: string | null;
  isp?: string | null;
  asn?: string | null;
  isVpnOrProxy?: boolean | null;
  ipTimezone?: string | null;
  browserName?: string | null;
  osName?: string | null;
  deviceType?: string | null;
  deviceFingerprint?: string | null;
  clientTimezone?: string | null;
  anomalies?: { code: string; severity: "low" | "medium" | "high"; detail: string }[] | null;
  riskScore?: number | null;
  isTrusted?: boolean;
  createdAt: string;
}

export interface LiveSession {
  id: string;
  sessionId: string;
  userId: string;
  userName?: string | null;
  userRole?: Role | null;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  ipAddress?: string | null;
  city?: string | null;
  country?: string | null;
  isp?: string | null;
  asn?: string | null;
  deviceFingerprint?: string | null;
  concurrentForUser: number;
}

export interface ActivityOverview {
  signInsToday: number;
  failuresToday: number;
  flaggedThisWeek: number;
  liveSessions: number;
  distinctIpsThisWeek: number;
  topCities: { city: string | null; count: number }[];
  riskiest: AuthEvent[];
}

export interface AuditSummary {
  total: number;
  thisWeek: number;
  byAction: { action: string; count: number }[];
  byEntity: { entity: string; count: number }[];
}

export const auditApi = {
  logs: (query: Record<string, string | number | undefined> = {}): Promise<ApiResult<AuditEntry[]>> =>
    api.get<AuditEntry[]>("/audit/logs", { query }),

  entry: (id: string) => api.get<AuditEntry>(`/audit/logs/${id}`),

  history: (entity: string, entityId: string) =>
    api.get<AuditEntry[]>(`/audit/entities/${entity}/${entityId}`),

  summary: () => api.get<AuditSummary>("/audit/summary"),

  syncBatches: (query: Record<string, string | number | undefined> = {}) =>
    api.get("/audit/sync", { query }),

  devices: (query: Record<string, string | number | undefined> = {}) =>
    api.get("/audit/devices", { query }),
};

export const activityApi = {
  overview: () => api.get<ActivityOverview>("/activity/overview"),

  events: (query: Record<string, string | number | boolean | undefined> = {}) =>
    api.get<AuthEvent[]>("/activity/events", { query }),

  user: (userId: string) => api.get(`/activity/users/${userId}`),

  sessions: () => api.get<LiveSession[]>("/activity/sessions"),

  revokeSession: (sessionId: string, reason: string) =>
    api.delete(`/activity/sessions/${sessionId}`, { reason }),

  approve: (eventId: string, label?: string) =>
    api.post(`/activity/events/${eventId}/approve`, { label }),

  trusted: () => api.get("/activity/trusted"),

  revokeTrust: (id: string) => api.delete(`/activity/trusted/${id}`),
};
