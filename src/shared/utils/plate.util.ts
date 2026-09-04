/**
 * Registration-number handling, mirrored from the API's `plate.util.ts`.
 *
 * This is a deliberate second copy, and it is worth being precise about why it
 * is acceptable here when a second copy of the *fare* rules is not. The server
 * remains the only thing that decides whether a plate is accepted — it
 * revalidates every submission and rejects what it does not recognise. What
 * this buys is the difference between telling an officer their typo is wrong
 * while they are still looking at the field, and telling them after a round
 * trip. If the two ever drift, the consequence is a hint that is briefly too
 * strict or too lax, not a charge that is wrong.
 *
 * Keep it in step with `kmcp-backend/src/common/utils/plate.util.ts`.
 */

/** Plates are stored and compared normalised: uppercase alphanumeric, no spaces. */
export const normalisePlate = (plate: string): string =>
  plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

/** Display form: WB02AB1234 → "WB 02 AB 1234". */
export function formatPlate(plate: string): string {
  const p = normalisePlate(plate);
  const m = p.match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/);
  return m ? [m[1], m[2], m[3], m[4]].filter(Boolean).join(" ") : plate;
}

/**
 * Indian registration formats, including the BH series and older single-letter
 * state codes. Phase 1 relies on this because the attendant types the number by
 * hand — a typo caught here is a dispute that never happens.
 */
const PATTERNS = [
  /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/, // WB02AB1234
  /^\d{2}BH\d{4}[A-Z]{1,2}$/, // 22BH1234AA — Bharat series
  /^[A-Z]{2}\d{1,2}\d{1,4}$/, // WB021234 — older format, no letter series
];

export const isValidPlate = (plate: string): boolean => {
  const p = normalisePlate(plate);
  return p.length >= 6 && p.length <= 12 && PATTERNS.some((re) => re.test(p));
};
