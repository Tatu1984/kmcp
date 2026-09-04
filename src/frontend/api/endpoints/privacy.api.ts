import { api } from "../client";

/**
 * Retention, subject rights and consent — the DPDP surface.
 *
 * Two grants cover it, and they are the ones that already exist rather than a
 * new `privacy.*` key: `config.write` for the retention schedule, because a
 * retention period is a `SystemConfig` row like any other, and `user.manage`
 * for anything that touches one person's data, because exporting or erasing an
 * account is account administration. `privacy.controller.ts` on the API sets
 * out the reasoning at length.
 */

/** One class of record, and the period the authority keeps it for. */
export interface RetentionClass {
  code: string;
  label: string;
  /** The SystemConfig key holding the period. Editable through `/config`. */
  configKey: string;
  defaultDays: number;
  /** The period actually in force, which may not be the default. */
  days: number;
  /** False while the platform is still running on the seeded proposal. */
  configured: boolean;
  covers: string;
  basis: string;
  /** False for a class that redacts fields rather than deleting rows. */
  destroys: boolean;
}

export interface RetentionPolicy {
  /** True while the purge reports and destroys nothing. Seeded true. */
  dryRun: boolean;
  /** True while a blanket hold suspends the sweep entirely. */
  legalHold: boolean;
  batchLimit: number;
  classes: RetentionClass[];
}

export interface RetentionClassOutcome {
  code: string;
  label: string;
  days: number;
  cutoff: string;
  pastCutoff: number;
  heldBack: number;
  purged: number;
  moreRemaining: boolean;
}

export interface RetentionPreview {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  legalHold: boolean;
  preview: boolean;
  batchLimit: number;
  classes: RetentionClassOutcome[];
  totalPurged: number;
}

export interface ConsentPurposeSummary {
  purpose: string;
  granted: number;
  withdrawn: number;
  denied: number;
}

export interface ConsentSummary {
  citizens: number;
  purposes: ConsentPurposeSummary[];
  notice: { slug: string; updatedAt: string; published: boolean } | null;
  /** Set when the notice consent is being recorded against is missing or a draft. */
  warning: string | null;
}

/** The subject-access package. Deliberately loose — it is a document, not a form. */
export interface DataExport {
  meta: {
    generatedAt: string;
    generatedBy: { id: string; name: string; role: string };
    subjectId: string;
    truncated: Record<string, boolean>;
    note: string;
  };
  profile: { id: string; name: string };
  [section: string]: unknown;
}

export const privacyApi = {
  /** The schedule as the platform is actually running it. */
  retention: () => api.get<RetentionPolicy>("/privacy/retention"),

  /**
   * What the next purge would destroy, without destroying it.
   *
   * Report-only on the API regardless of configuration — the officer about to
   * turn the dry run off should be able to see the consequence without
   * performing it.
   */
  previewPurge: () => api.post<RetentionPreview>("/privacy/retention/preview"),

  consentSummary: () => api.get<ConsentSummary>("/privacy/consents/summary"),

  /** Everything held about one citizen. Audited against the calling officer. */
  export: (citizenId: string) => api.get<DataExport>(`/privacy/citizens/${citizenId}/export`),

  /**
   * Anonymisation, not deletion. The financial record survives and comes to
   * refer to an account that identifies nobody.
   *
   * The id is repeated in the body on purpose: the API refuses unless it
   * matches the path, so a mis-clicked row cannot erase the wrong person.
   */
  erase: (citizenId: string, reason: string) =>
    api.post(`/privacy/citizens/${citizenId}/erase`, { reason, confirmCitizenId: citizenId }),

  correct: (
    citizenId: string,
    changes: { name?: string; phone?: string | null; email?: string | null },
    reason: string,
  ) => api.patch(`/privacy/citizens/${citizenId}`, { ...changes, reason }),

  consents: (citizenId: string) => api.get(`/privacy/citizens/${citizenId}/consents`),
};

/**
 * Hands the subject-access package to the officer as a file.
 *
 * Built from a blob rather than pointed at a URL, because this response is
 * assembled per request and has no address of its own — and because a link to
 * somebody's whole parking history is not a thing to leave sitting in a browser
 * history. The blob URL is revoked immediately after the click.
 *
 * The filename carries the citizen id and the date, since the officer will be
 * attaching it to a request reference and a folder of `export.json` files helps
 * nobody.
 */
export function saveDataExport(pack: DataExport, citizenId: string): void {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `kmcp-data-export-${citizenId}-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
