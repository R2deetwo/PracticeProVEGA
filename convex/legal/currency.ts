/**
 * currency — the server-side currency/repeal derivation (Workstream B,
 * 2026-11-24). Mirrors src/legal/currencyStatus.ts 1:1 so the ingestion
 * pipeline and the consumer surfaces agree on ONE vocabulary:
 *
 *   active_verified | amended_partial | superseded_or_repealed | unverified_archive
 *
 * Absent/unknown inputs land on unverified_archive — never a fabricated
 * "in force" (the ~15-year legacy archive is presumed unverified until a
 * human or an authoritative source verifies it).
 *
 * Pure helper — no table access; keep it importable by ingest/search/audit.
 */

export const CURRENCY_STATUSES = [
  'active_verified',
  'amended_partial',
  'superseded_or_repealed',
  'unverified_archive',
] as const;

export type CurrencyStatus = (typeof CURRENCY_STATUSES)[number];

export const DEFAULT_CURRENCY_STATUS: CurrencyStatus = 'unverified_archive';

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
  if (input.repealed || st === 'repealed' || st === 'superseded') {
    return 'superseded_or_repealed';
  }
  if (input.amended || st === 'amended') {
    return 'amended_partial';
  }
  if (st === 'in_force' || st === 'monitor') {
    return input.verified ? 'active_verified' : 'unverified_archive';
  }
  return DEFAULT_CURRENCY_STATUS;
}
