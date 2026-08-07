import { api } from "../client";

export type MediaPurpose =
  | "SESSION_EVIDENCE_START"
  | "SESSION_EVIDENCE_END"
  | "KYC_DOCUMENT"
  | "AGREEMENT"
  | "RECEIPT"
  | "REPORT_EXPORT"
  | "INCIDENT_PHOTO"
  | "PROFILE";

export interface UploadTicket {
  uploadUrl: string;
  key: string;
  bucket: string;
  expiresInSeconds: number;
  method: "PUT";
  headers: Record<string, string>;
}

export interface ApiMedia {
  id: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
  purpose: MediaPurpose;
  createdAt: string;
}

export const mediaApi = {
  requestUpload: (body: { purpose: MediaPurpose; mimeType: string; sizeBytes: number; fileName?: string }) =>
    api.post<UploadTicket>("/media/uploads", body),

  confirmUpload: (body: {
    key: string;
    purpose: MediaPurpose;
    mimeType: string;
    sizeBytes: number;
    capturedAt?: string;
    lat?: number;
    lng?: number;
  }) => api.post<ApiMedia>("/media/uploads/confirm", body),

  url: (id: string) => api.get<{ id: string; url: string; mimeType: string }>(`/media/${id}/url`),

  urls: (ids: string[]) => api.post<{ id: string; url: string; mimeType: string }[]>("/media/urls", { ids }),

  remove: (id: string) => api.delete(`/media/${id}`),
};

/**
 * The whole upload, as one call for the UI.
 *
 * The bytes go straight from the browser to object storage — deliberately not
 * through our API — so this is a plain fetch to the presigned URL rather than
 * anything that carries our bearer token.
 */
export async function uploadFile(file: File, purpose: MediaPurpose): Promise<ApiMedia> {
  const { data: ticket } = await mediaApi.requestUpload({
    purpose,
    mimeType: file.type,
    sizeBytes: file.size,
    fileName: file.name,
  });

  const put = await fetch(ticket.uploadUrl, {
    method: ticket.method,
    headers: ticket.headers,
    body: file,
  });
  if (!put.ok) {
    throw new Error(`Storage rejected the upload (${put.status}). Please try again.`);
  }

  const { data } = await mediaApi.confirmUpload({
    key: ticket.key,
    purpose,
    mimeType: file.type,
    sizeBytes: file.size,
  });
  return data;
}

/* --------------------------------------------------------------------- rbac */

export interface RbacRole {
  code: string;
  label: string;
  description: string | null;
  permissions: string[];
  unrestricted: boolean;
  zoneScoped: boolean;
  isSystem: boolean;
  userCount: number;
  /** False for the superuser, whose grants are unrestricted by definition. */
  editable: boolean;
  /** Only a non-system role nobody holds can be removed. */
  deletable: boolean;
}

export interface RbacMatrix {
  permissions: string[];
  groups: { key: string; label: string; permissions: { key: string; label: string }[] }[];
  roles: RbacRole[];
  ungrouped: string[];
  editable: boolean;
}

export const rbacApi = {
  matrix: () => api.get<RbacMatrix>("/rbac/matrix"),

  createRole: (body: {
    code: string;
    label: string;
    description?: string;
    permissions?: string[];
    isZoneScoped?: boolean;
  }) => api.post<RbacRole>("/rbac/roles", body),

  /**
   * `permissions` replaces the whole list — the matrix sends the full set it
   * wants rather than a diff, so two administrators editing at once cannot
   * merge into a grant neither of them chose.
   */
  updateRole: (
    code: string,
    body: {
      label?: string;
      description?: string;
      permissions?: string[];
      isZoneScoped?: boolean;
      reason?: string;
    },
  ) => api.patch<RbacRole & { sessionsRevoked: number }>(`/rbac/roles/${code}`, body),

  removeRole: (code: string) => api.delete(`/rbac/roles/${code}`),
};
