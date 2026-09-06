import { api, type ApiResult } from "../client";

type Query = Record<string, string | number | boolean | undefined>;

export type CameraStatus =
  | "ONLINE"
  | "OFFLINE"
  | "DEGRADED"
  | "MAINTENANCE"
  | "DECOMMISSIONED";

export const CAMERA_STATUS_LABELS: Record<CameraStatus, string> = {
  ONLINE: "Online",
  OFFLINE: "Offline",
  DEGRADED: "Poor signal",
  MAINTENANCE: "Maintenance",
  DECOMMISSIONED: "Removed",
};

export interface ApiCamera {
  id: string;
  streetId: string;
  code: string;
  /** Where it points, in words an engineer on the pavement would use. */
  label: string;
  makeModel?: string | null;
  status: CameraStatus;
  lastSeenAt?: string | null;
  installedAt?: string | null;
  createdAt: string;
  street: {
    id: string;
    name: string;
    ward: { id: string; name: string };
    zones: { id: string; code: string; name: string }[];
  };
}

export interface ApiCameraHealth {
  total: number;
  /** Registered but never once heard from — usually a cabling or config fault. */
  neverSeen: number;
  byStatus: { status: CameraStatus; count: number }[];
}

/**
 * Where a camera can be played from.
 *
 * `available` is false until a streaming gateway exists, with a `reason` the
 * screen can put in front of somebody. The rest of the shape is what a player
 * will need once one does, so wiring the gateway changes the server and not
 * the client.
 */
export interface ApiCameraPlayback {
  cameraId: string;
  available: boolean;
  reason?: "NO_GATEWAY" | "OFFLINE" | "NOT_PERMITTED";
  detail?: string;
  playbackUrl: string | null;
  protocol: "HLS" | "WEBRTC" | null;
  expiresAt: string | null;
}

export const camerasApi = {
  list: (query: Query = {}): Promise<ApiResult<ApiCamera[]>> =>
    api.get<ApiCamera[]>("/cameras", { query }),

  health: () => api.get<ApiCameraHealth>("/cameras/health"),

  get: (id: string) => api.get<ApiCamera>(`/cameras/${id}`),

  /** Every call is recorded to the audit trail, whether or not anything plays. */
  playback: (id: string) => api.get<ApiCameraPlayback>(`/cameras/${id}/playback`),

  create: (body: Record<string, unknown>) => api.post<ApiCamera>("/cameras", body),

  update: (id: string, body: Record<string, unknown>) =>
    api.patch<ApiCamera>(`/cameras/${id}`, body),
};
