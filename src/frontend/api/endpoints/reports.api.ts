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
