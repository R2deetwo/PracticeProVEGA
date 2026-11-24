/**
 * currencyStatus — ONE currency/repeal vocabulary for the legal corpus
 * (Workstream B, 2026-11-24: "Currency & Repeal/Amendment Status
 * Tagging (Crucial for ~15-Year Archive)").
 *
 * The corpus mixes several legacy status vocabularies (legal_instruments
 * .status = in_force|amended|repealed|unknown; the curated instruments
 * table = in_force|repealed|superseded|monitor + verificationStatus;
 * chunk warnings[] = amended|overruled|repealed|stale|unverified). The
 * consumer surfaces (ALOA answers, Contract Analyzer citations, DraftPro
 * authority library, Vox citations) need ONE status with ONE badge.
 *
 * The four values (mirrored in convex/legal/currency.ts so ingestion
 * derives the same field server-side):
 *   active_verified      — in force AND verified against an authoritative
 *                          source; safe to cite without caveats.
 *   amended_partial      — still in force but amended (or partially
 *                          amended); cite the AS-AMENDED text and say so.
 *   superseded_or_repealed — repealed / replaced / superseded. EXCLUDED
 *                          from default live answers unless the user
 *                          explicitly asks for historical material, and
 *                          always labelled.
 *   unverified_archive   — default for legacy/archive material whose
 *                          currency nobody has verified yet. Surfaced with
 *                          a clear verification caveat badge.
 *
 * Pure functions — safe for tests, SSR, and the ingestion engine ports.
 */

export const CURRENCY_STATUSES = [
  'active_verified',
  'amended_partial',
  'superseded_or_repealed',
  'unverified_archive',
] as const;

export type CurrencyStatus = (typeof CURRENCY_STATUSES)[number];

export const DEFAULT_CURRENCY_STATUS: CurrencyStatus = 'unverified_archive';

/** Derive the currency status from whatever legacy vocabulary a table
 *  carries. Absent/unknown inputs honestly land on unverified_archive —
 *  never a fabricated "in force". */
export function deriveCurrencyStatus(input: {
  /** legal_instruments.status: in_force | amended | repealed | unknown */
  status?: string | null;
  /** amendmentTracker.amended / .repealed (legal_instruments). */
  amended?: boolean | null;
  repealed?: boolean | null;
  /** Curated instruments table: in_force | repealed | superseded | monitor. */
  statusV2?: string | null;
  /** Any explicit verification signal (verificationStatus / verified). */
  verified?: boolean | null;
}): CurrencyStatus {
  const st = String(input.status ?? input.statusV2 ?? '').toLowerCase().trim();
  if (input.repealed || st === 'repealed' || st === 'superseded' || st === 'repealed_' || st === 'repealed.') {
    return 'superseded_or_repealed';
  }
  if (input.amended || st === 'amended') {
    return 'amended_partial';
  }
  if (st === 'in_force' || st === 'monitor') {
    // In force AND verified → active; in force but never verified → the
    // honest default for the ~15-year archive.
    return input.verified ? 'active_verified' : 'unverified_archive';
  }
  return DEFAULT_CURRENCY_STATUS;
}

/** Short human label (badges, chips). */
export function currencyStatusLabel(status: string): string {
  switch (status) {
    case 'active_verified':
      return 'Verified in force';
    case 'amended_partial':
      return 'As amended';
    case 'superseded_or_repealed':
      return 'Repealed / superseded';
    case 'unverified_archive':
      return 'Unverified archive';
    default:
      return 'Unverified archive';
  }
}

/** One-line caveat the consumer surfaces verbatim. */
export function currencyStatusCaveat(status: string): string {
  switch (status) {
    case 'active_verified':
      return '';
    case 'amended_partial':
      return 'This provision has been amended — cite the text as amended and check the latest amendment.';
    case 'superseded_or_repealed':
      return 'This provision has been repealed or superseded — it is shown for historical reference only and must not be cited as current law.';
    case 'unverified_archive':
    default:
      return 'Archived material — currency not yet verified. Confirm the provision is still in force before relying on it.';
  }
}

/** Tailwind chip classes per status (single source for ALOA / Contract
 *  Analyzer / DraftPro badges so the warning looks the same everywhere). */
export function currencyStatusChipClass(status: string): string {
  switch (status) {
    case 'active_verified':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
    case 'amended_partial':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
    case 'superseded_or_repealed':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800';
    case 'unverified_archive':
    default:
      return 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
  }
}
