import type { Paise } from "@/shared/types/common.types";

/**
 * Every amount in KMCP is an integer number of paise. These helpers exist so
 * that no other file ever has a reason to do money arithmetic with floats.
 */

export function addPaise(...amounts: Paise[]): Paise {
  return amounts.reduce((sum, a) => sum + Math.round(a), 0);
}

export function applyPercent(amount: Paise, percent: number): Paise {
  return Math.round((amount * percent) / 100);
}

/** Splits an amount into commission / vendor share, always summing back exactly. */
export function splitCommission(
  gross: Paise,
  commissionPct: number,
): { commission: Paise; vendorShare: Paise } {
  const commission = applyPercent(gross, commissionPct);
  return { commission, vendorShare: gross - commission };
}

/** Tax on a tax-exclusive base. */
export function taxOn(base: Paise, taxPercent: number): Paise {
  return applyPercent(base, taxPercent);
}

export function clampToCap(amount: Paise, cap?: Paise | null): Paise {
  if (cap === undefined || cap === null) return amount;
  return Math.min(amount, cap);
}

export function assertBalanced(debits: Paise[], credits: Paise[]): void {
  const d = addPaise(...debits);
  const c = addPaise(...credits);
  if (d !== c) throw new Error(`Ledger does not balance: debit ${d} vs credit ${c}`);
}
