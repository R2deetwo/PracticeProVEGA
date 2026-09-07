/**
 * Per-recipient financial data resolution for message templates.
 *
 * WHY THIS EXISTS (user feedback 2026-09-08): "when I selected late
 * service charge for a resident it still required me to fill in the
 * service charge information — the whole idea is that it should use the
 * correct info for the correct client and fill it in."
 *
 * The compose modal's financial fields were manual-only: residents'
 * unit data (rent, service charge, caution deposit, fees — already
 * resolved by usePropertyGroups) was never consulted, so templates
 * rendered ₦0 unless the user typed every figure by hand. Worse, a
 * bulk send applied ONE shared manual set to every recipient.
 *
 * Resolution order for each figure:
 *   1. a manually typed override (user edited the field on purpose);
 *   2. the RECIPIENT'S OWN unit data (per-recipient personalisation);
 *   3. 0 (template omits the line — see buildMessage's scLine guards).
 */

export interface FinancialFields {
  /** Rent override; null = not typed (fall back to the recipient's record). */
  amount?: number | null;
  serviceCharge?: number | null;
  legalFee?: number | null;
  agencyFee?: number | null;
  cautionDeposit?: number | null;
}

export interface FinancialSource extends FinancialFields {
  tenantName?: string;
  label?: string;
}

/** Numeric parse that accepts "150,000" / "150000.50" / "" — null when empty/invalid. */
export function parseMoneyInput(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Manual value wins when typed; otherwise fall back to the recipient's
 * own record. Returns the `extraData` shape consumed by buildMessage.
 */
export function resolveFinancials(
  manual: FinancialFields,
  recipient: FinancialSource
): { amount: number; serviceCharge: number; legalFee: number; agencyFee: number; cautionDeposit: number } {
  return {
    amount: manual.amount ?? recipient.amount ?? 0,
    serviceCharge: manual.serviceCharge ?? recipient.serviceCharge ?? 0,
    legalFee: manual.legalFee ?? recipient.legalFee ?? 0,
    agencyFee: manual.agencyFee ?? recipient.agencyFee ?? 0,
    cautionDeposit: manual.cautionDeposit ?? recipient.cautionDeposit ?? 0,
  };
}

/** True when at least one financial figure came from the recipient's record (for the "auto-filled" hint). */
export function hasAutoFilledFigures(manual: FinancialFields, recipient: FinancialSource): boolean {
  const resolved = resolveFinancials(manual, recipient);
  return (
    (recipient.serviceCharge ?? 0) > 0 && resolved.serviceCharge === recipient.serviceCharge ||
    (recipient.cautionDeposit ?? 0) > 0 && resolved.cautionDeposit === recipient.cautionDeposit ||
    (recipient.legalFee ?? 0) > 0 && resolved.legalFee === recipient.legalFee ||
    (recipient.agencyFee ?? 0) > 0 && resolved.agencyFee === recipient.agencyFee ||
    (recipient.amount ?? 0) > 0 && resolved.amount === recipient.amount
  );
}
