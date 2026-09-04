import { api } from "../client";

/**
 * Generated documents: receipts, settlement statements, shift slips, zone
 * signage and the audit-trail export.
 *
 * Unlike `reportsApi.download`, none of these endpoints returns a file. The API
 * renders the document once, stores it in object storage, and hands back a
 * short-lived signed URL — so the response *is* the ordinary JSON envelope and
 * goes through the shared client. The file is fetched separately, from storage,
 * by `saveDocument` below.
 */
export interface IssuedDocument {
  mediaId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Short-lived. Not a permalink — fetch it now or ask again. */
  url: string;
  expiresInSeconds: number;
  /** SHA-256 of the record the document renders. Printed on the document. */
  digest: string;
  /** False when the API handed back the file it already had. */
  regenerated: boolean;
}

export interface AuditTrailQuery {
  from: string;
  to: string;
  action?: string;
  entity?: string;
  entityId?: string;
  actorUserId?: string;
}

export const documentsApi = {
  /** The parking receipt for a payment. Needs the payment id, not the session's. */
  receipt: (paymentId: string) => api.get<IssuedDocument>(`/documents/receipts/${paymentId}`),

  settlement: (settlementId: string) =>
    api.get<IssuedDocument>(`/documents/settlements/${settlementId}`),

  shiftSlip: (shiftId: string) => api.get<IssuedDocument>(`/documents/shifts/${shiftId}`),

  zoneSignage: (zoneId: string) => api.get<IssuedDocument>(`/documents/zones/${zoneId}/signage`),

  auditTrail: (query: AuditTrailQuery) =>
    api.get<IssuedDocument>("/documents/audit-trail", { query: { ...query } }),
};

/**
 * Puts a rendered document in front of the user.
 *
 * The straightforward thing — `<a href={signedUrl} download>` — does not work:
 * the `download` attribute is ignored on a cross-origin href, so the browser
 * navigates to the bucket instead of saving. Fetching the bytes and saving a
 * blob does work, and gives the file the name the API chose rather than the
 * object key. That is the same manual-blob approach `reportsApi.download` takes
 * for CSV, for the same reason: the browser needs something it can save.
 *
 * The fetch is cross-origin to the storage host, which may or may not answer
 * with CORS headers depending on how the bucket is configured. If it refuses,
 * opening the signed URL in a new tab still shows the document — a PDF viewer
 * is a perfectly good outcome for a statement somebody is about to print, and
 * it is a great deal better than an error for a file that exists.
 */
export async function saveDocument(document_: IssuedDocument): Promise<void> {
  try {
    const response = await fetch(document_.url);
    if (!response.ok) throw new Error(String(response.status));

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = document_.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(document_.url, "_blank", "noopener,noreferrer");
  }
}

/**
 * Opens a document for printing rather than saving.
 *
 * "Print statement" and "Print zone signage" both want a viewer with a print
 * dialogue, not a file in the downloads folder. A new tab is the only thing a
 * page can reliably do here: printing another origin's PDF from a hidden iframe
 * is blocked in every current browser.
 */
export function printDocument(document_: IssuedDocument): void {
  window.open(document_.url, "_blank", "noopener,noreferrer");
}
