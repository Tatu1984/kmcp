import { api, type ApiResult } from "../client";

/** Live status of a camera's HLS feed, read from storage by the API. */
export type CameraStatus = "ONLINE" | "OFFLINE" | "STOPPED" | "CONNECTING";

/** A camera as the admin wall sees it. Never carries the ingest token. */
export interface ApiCamera {
  id: string;
  name: string;
  group: string | null;
  ingestKey: string;
  /** The playlist URL to play (served through the API, admin-gated). */
  hlsUrl: string;
  status: CameraStatus;
  available: boolean;
  checkedAt: string;
  createdAt: string;
}

/** The one-time Edge Agent secrets, shown once on create / rotate. */
export interface EdgeAgentConfig {
  ingestUrl: string;
  ingestToken: string;
  publishUrl: string;
  cameraId: string;
}

export interface CreateCameraResult {
  camera: {
    id: string;
    name: string;
    group: string | null;
    ingestKey: string;
    createdAt: string;
  };
  edgeAgent: EdgeAgentConfig;
}

export const camerasApi = {
  /** Every camera, with live status. Admin only (API enforces the role). */
  list: (): Promise<ApiResult<ApiCamera[]>> => api.get<ApiCamera[]>("/cameras"),

  /** Register a camera; the response carries the one-time ingest token. */
  create: (body: { name: string; group?: string }) =>
    api.post<CreateCameraResult>("/cameras", body),

  /** Rotate a camera's ingest token, revoking the old one. */
  rotateToken: (id: string) => api.post<EdgeAgentConfig>(`/cameras/${id}/rotate-token`),

  remove: (id: string) => api.delete<{ deleted: true; id: string }>(`/cameras/${id}`),
};
