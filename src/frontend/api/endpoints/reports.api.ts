import { api, apiBaseUrl, getTokens, type ApiResult } from "../client";
import type { ReportStatus } from "@/shared/types/domain.types";

type Query = Record<string, string | number | boolean | undefined>;

export interface ApiReportType {
  key: string;
  label: string;
  description: string;
}

export interface ApiReportJob {
  id: string;
  type: string;
  /** Human label for the type, resolved server-side from the catalogue. */
  label: string;
  params: Record<string, unknown>;
  paramsLabel: string;
  status: ReportStatus;
  requestedById: string;
  requestedBy: string;
  error?: string | null;
  createdAt: string;
  completedAt?: string | null;
  rowCount?: number;
}

/** How often a schedule fires. Three cadences, not a cron expression. */
export type ReportFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export interface ApiReportSchedule {
  id: string;
  name: string;
  type: string;
  /** The catalogue's label for the type, resolved server-side. */
  label: string;
  frequency: ReportFrequency;
  /**
   * Local wall clock in `timezone` — deliberately not a UTC instant. The API
   * stores the authority's intent ("Monday at eight, in Kolkata") and derives
   * `nextRunAt` from it, so an edit to the hour means what it says whatever the
   * server's own clock is set to.
   */
  hour: number;
  minute: number;
  /** ISO weekday, 1 = Monday … 7 = Sunday. Set only for a weekly schedule. */
  weekday: number | null;
  /** 1–31, clamped to the last day of a short month. Set only for a monthly one. */
  dayOfMonth: number | null;
  timezone: string;
  /** "Every Monday at 08:00 (Asia/Kolkata)" — built by the API, not the portal. */
  cadence: string;
  zoneId: string | null;
  vendorId: string | null;
  paramsLabel: string;
  channels: string[];
  ownerId: string;
  ownerName: string;
  isActive: boolean;
  nextRunAt: string;
  lastRunAt?: string | null;
  lastStatus?: string | null;
  lastError?: string | null;
  lastJobId?: string | null;
  failureCount: number;
  /** The cap the API applies before it switches a failing schedule off. */
  failuresBeforePause: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReportScheduleBody {
  name: string;
  type: string;
  frequency: ReportFrequency;
  hour: number;
  minute: number;
  weekday?: number | null;
  dayOfMonth?: number | null;
  timezone?: string;
  zoneId?: string | null;
  vendorId?: string | null;
  channels?: string[];
  isActive?: boolean;
}

/**
 * Recurring reports.
 *
 * There is no recipient field anywhere here, and that is not an omission: a
 * schedule runs as — and is delivered to — the account that created it. The API
 * refuses to take an owner for the same reason `messagingApi.emailReport` takes
 * no address, since either would be a way to have a report produced under a
 * principal that sees more than you do.
 */
export const reportSchedulesApi = {
  list: (query: Query = {}): Promise<ApiResult<ApiReportSchedule[]>> =>
    api.get<ApiReportSchedule[]>("/reports/schedules", { query }),

  get: (id: string) => api.get<ApiReportSchedule>(`/reports/schedules/${id}`),

  create: (body: ReportScheduleBody) => api.post<ApiReportSchedule>("/reports/schedules", body),

  /** Pausing and resuming are this call with `isActive` alone. */
  update: (id: string, body: Partial<ReportScheduleBody>) =>
    api.patch<ApiReportSchedule>(`/reports/schedules/${id}`, body),

  remove: (id: string) => api.delete<{ deleted: true }>(`/reports/schedules/${id}`),

  /** Runs it now, as its owner. Does not move the next scheduled run. */
  runNow: (id: string) => api.post<ApiReportSchedule>(`/reports/schedules/${id}/run`),
};

export const reportsApi = {
  /** The catalogue, from the API — the portal never invents a report type. */
  types: () => api.get<ApiReportType[]>("/reports/types"),

  list: (query: Query = {}): Promise<ApiResult<ApiReportJob[]>> =>
    api.get<ApiReportJob[]>("/reports", { query }),

  generate: (body: {
    type: string;
    from: string;
    to: string;
    zoneId?: string;
    vendorId?: string;
  }) => api.post<ApiReportJob>("/reports", { ...body, format: "csv" }),

  /**
   * Downloads the CSV.
   *
   * Fetched by hand rather than through the shared client: the response is a
   * file, not the `{ success, data, meta }` envelope, and the browser needs a
   * blob to save rather than a parsed object.
   */
  download: async (id: string, filename?: string): Promise<void> => {
    const tokens = getTokens();
    const response = await fetch(`${apiBaseUrl()}/reports/${id}/download`, {
      headers: tokens?.accessToken ? { authorization: `Bearer ${tokens.accessToken}` } : {},
    });
    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? "Your session has expired. Sign in again."
          : "The report could not be downloaded.",
      );
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      filename ??
      // The server names the file; this is only the fallback.
      response.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ??
      `${id}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
