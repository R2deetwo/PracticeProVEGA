/**
 * src/utils/financialLifecycle.ts — client-side mirror of the financial
 * record lifecycle predicates (accounting-integrity round, 2026-09-14).
 *
 * The SERVER canon lives in convex/financialIntegrity.ts. This repo's
 * convention keeps src/ importing only from convex/_generated/api (bundling
 * server modules into the Vite client is off-limits), so the predicate is
 * mirrored here instead of imported.
 *
 * DRIFT IS TESTED AWAY: tests/unit/financialIntegrity.test.ts imports BOTH
 * copies and asserts they agree on every recordStatus value — if anyone
 * changes one without the other, the suite goes red.
 *
 * Semantics: a ledger/invoice row with recordStatus 'voided' (reversal
 * annotation) or 'test' (test-data quarantine) is NOT money — it stays in
 * the table for forensic completeness but is excluded from every total,
 * on the server (getCashFlowSummary, getTenantLedger) and in the client
 * mirrors (LedgerManager cash flow, tenant outstanding) alike.
 */

/** True when a financial record counts toward money totals. */
export function isActiveFinancialRecord(
  recordStatus: string | undefined | null
): boolean {
  return recordStatus !== "voided" && recordStatus !== "test";
}

/**
 * Client-side idempotency key for addLedgerEntry. Generated ONCE at submit
 * time and included in both the online call and the offline-queue args, so
 * an offline queue replay of the same submission is a server-side no-op
 * instead of a duplicate revenue entry (one of the "records I don't
 * remember" origins).
 */
export function makeLedgerIdempotencyKey(parts: {
  firmId: string;
  unitId: string;
  amount: number;
  type: string;
  nonce: string;
}): string {
  return `ledger:${parts.firmId}:${parts.unitId}:${parts.type}:${parts.amount}:${parts.nonce}`;
}
