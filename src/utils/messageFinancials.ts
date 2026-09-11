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
  /** True when this resident's tenancy has commenced (paid rent history
   *  or lease start on/before today — see usePropertyGroups). Move-in
   *  fees are treated as settled for existing residents. */
  isExistingTenant?: boolean;
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
 *
 * NEW vs EXISTING RESIDENTS (user feedback 2026-09-11): "an existing
 * tenant with rent due only has to pay the rent. these other fees are
 * for new tenants only." Caution deposit and legal/agency fees are
 * one-time MOVE-IN charges — for an EXISTING resident (tenancy already
 * commenced) they are settled, so reminders must not resurrect them.
 * The rent (amount) and the recurring service charge are unaffected.
 *
 * Resolution per figure:
 *   • amount / serviceCharge: manual → record → 0 (unchanged)
 *   • caution/legal/agency for an EXISTING resident: manual → 0
 *     (a manually typed figure still wins — a manager deliberately
 *     demanding an unpaid move-in fee can type it in);
 *   • caution/legal/agency for a NEW resident: manual → record → 0
 *     (full move-in breakdown, as before).
 */
export function resolveFinancials(
  manual: FinancialFields,
  recipient: FinancialSource
): { amount: number; serviceCharge: number; legalFee: number; agencyFee: number; cautionDeposit: number } {
  const existing = recipient.isExistingTenant === true;
  return {
    amount: manual.amount ?? recipient.amount ?? 0,
    serviceCharge: manual.serviceCharge ?? recipient.serviceCharge ?? 0,
    legalFee: existing ? (manual.legalFee ?? 0) : (manual.legalFee ?? recipient.legalFee ?? 0),
    agencyFee: existing ? (manual.agencyFee ?? 0) : (manual.agencyFee ?? recipient.agencyFee ?? 0),
    cautionDeposit: existing ? (manual.cautionDeposit ?? 0) : (manual.cautionDeposit ?? recipient.cautionDeposit ?? 0),
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
