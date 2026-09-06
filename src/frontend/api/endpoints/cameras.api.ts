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
  /** How many bays it can see. A planning figure, not a constraint. */
  coverageSlots?: number | null;
  hasIR: boolean;
  hasPTZ: boolean;
  /** False for one taken out of service without being removed. */
  isActive: boolean;
  /** What the last probe found. Null until somebody has tested it. */
  resolution?: string | null;
  fps?: number | null;
  probedAt?: string | null;
  /** ffprobe's own words when the last test failed. Null when it worked. */
  probeError?: string | null;
  street: {
    id: string;
    name: string;
    ward: { id: string; name: string };
    zones: { id: string; code: string; name: string }[];
  };
}

/**
 * How a camera is plumbed in, for the edit form.
 *
 * Deliberately not part of `ApiCamera`: it is a different question under a
 * different permission, and it is the one shape here that gets near a secret.
 * Even so the API returns neither the username nor the password — only whether
 * there is one — and the RTSP address arrives with any credentials stripped out
 * of it rather than starred over.
 */
export interface ApiCameraConnection {
  id: string;
  code: string;
  label: string;
  streetId: string;
  streamKey?: string | null;
  rtspUrl: string | null;
  onvifUrl: string | null;
  hasCredentials: boolean;
  coverageSlots?: number | null;
  hasIR: boolean;
  hasPTZ: boolean;
  isActive: boolean;
  makeModel?: string | null;
  installedAt?: string | null;
  /** What the camera is called on the streaming gateway. */
  path: string;
}

/** What the camera itself said when it was last asked. */
export interface ApiCameraProbe {
  camera: ApiCamera;
  reachable: boolean;
  resolution: string | null;
  fps: number | null;
  codec: string | null;
  error: string | null;
  /** True when a status set by hand was reported on but not overwritten. */
  statusHeld: boolean;
}

export interface CameraWrite {
  streetId?: string;
  code?: string;
  label?: string;
  makeModel?: string;
  streamKey?: string;
  installedAt?: string;
  rtspUrl?: string;
  onvifUrl?: string;
  /** Sent once and never returned. Omit to keep what is stored. */
  username?: string;
  password?: string;
  coverageSlots?: number;
  hasIR?: boolean;
  hasPTZ?: boolean;
  isActive?: boolean;
  status?: CameraStatus;
  /** Empties the stored username and password — which leaving them out cannot say. */
  clearCredentials?: boolean;
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
 * Both URLs are credential-free by construction: they address the streaming
 * gateway, which holds the connection to the camera, and there is nothing in
 * them a viewer could use to reach the camera itself. That is the whole reason
 * playback is a question put to the server rather than a URL built on the
 * client.
 *
 * `available: false` carries a `reason` naming which piece is missing — no
 * address on the camera, no gateway deployed, the camera out of service — so a
 * screen can say something more useful than "no video".
 */
export interface ApiCameraPlayback {
  cameraId: string;
  available: boolean;
  reason?: "NO_SOURCE" | "NO_GATEWAY" | "OUT_OF_SERVICE" | "OFFLINE" | "NOT_PERMITTED" | null;
  detail?: string | null;
  /** HLS: plays anywhere, a few seconds behind. The default. */
  hlsUrl: string | null;
  /** WebRTC over WHEP: sub-second, and what a live incident wants. */
  webrtcUrl: string | null;
  /** The camera's name on the gateway. */
  path: string | null;
  /**
   * Whether the gateway has the picture right now.
   *
   * False is ordinary rather than wrong: the gateway pulls on demand, so a
   * camera nobody has watched recently is not connected until the player asks.
   */
  ready: boolean;
}

export const camerasApi = {
  list: (query: Query = {}): Promise<ApiResult<ApiCamera[]>> =>
    api.get<ApiCamera[]>("/cameras", { query }),

  health: () => api.get<ApiCameraHealth>("/cameras/health"),

  get: (id: string) => api.get<ApiCamera>(`/cameras/${id}`),

  /** Every call is recorded to the audit trail, whether or not anything plays. */
  playback: (id: string) => api.get<ApiCameraPlayback>(`/cameras/${id}/playback`),

  /** `camera.manage`. Returns no credentials — see ApiCameraConnection. */
  connection: (id: string) => api.get<ApiCameraConnection>(`/cameras/${id}/connection`),

  create: (body: CameraWrite) => api.post<ApiCamera>("/cameras", body),

  update: (id: string, body: CameraWrite) => api.patch<ApiCamera>(`/cameras/${id}`, body),

  /**
   * Opens the stream and reports what answered. Up to eight seconds, so the
   * caller wants a spinner and the default 20s client timeout is right.
   */
  probe: (id: string) => api.post<ApiCameraProbe>(`/cameras/${id}/probe`),

  remove: (id: string) => api.delete<{ id: string; deleted: true }>(`/cameras/${id}`),
};
