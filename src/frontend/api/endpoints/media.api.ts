import { api } from "../client";
import type { Role } from "@/shared/constants/roles";

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

export interface RbacMatrix {
  permissions: string[];
  groups: { key: string; label: string; permissions: { key: string; label: string }[] }[];
  roles: {
    role: Role;
    label: string;
    description: string;
    unrestricted: boolean;
    permissions: string[];
    zoneScoped: boolean;
  }[];
  ungrouped: string[];
  editable: boolean;
}

export const rbacApi = {
  matrix: () => api.get<RbacMatrix>("/rbac/matrix"),
};
