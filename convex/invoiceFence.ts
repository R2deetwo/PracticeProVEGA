/**
 * convex/invoiceFence.ts — the SERVER-SIDE invoice money fence (V2,
 * V-FIN-2 / V-FIN-6 / V-FIN-15).
 *
 * Every write to `invoices` through the generic CRUD paths passes through
 * this fence, inside the caller's transaction:
 *
 *   CREATE (myFunctions.createItem):
 *     1. The invoice number is issued server-side, atomically, per firm
 *        (invoiceNumbering.issueInvoiceNumber) — the client's count-based
 *        suggestion is replaced, so concurrent creations can never collide.
 *     2. subTotal / taxAmount / total_amount / withholding* / netReceivable
 *        are RECOMPUTED from lineItems + the tax contract. Client-provided
 *        totals are hints, never authoritative values.
 *
 *   UPDATE (myFunctions.updateItem):
 *     1. `amountPaid` is stripped — it moves ONLY through the audited
 *        financialIntegrity.recordInvoicePayment lifecycle.
 *     2. When the patch touches money-relevant fields (lineItems or any tax
 *        flag), totals are recomputed from the merged row with the SAME
 *        rules as creation — manual, generated and edited invoices use one
 *        calculation.
 *     3. A manually edited invoice number that collides with another of the
 *        firm's invoices is rejected.
 *
 * TAX INTENT RESOLUTION (backwards compatible):
 *   The pre-V2 forms never sent explicit tax flags — they sent a computed
 *   taxAmount (or nothing). The fence resolves intent as:
 *     applicable = explicit flag  ??  (client taxAmount > 0)
 *     ratePct    = explicit rate  ??  firm vatRate (legacy FRACTION storage
 *                 is normalised) ?? 7.5% default
 *   so an old caller that computed VAT keeps VAT — at the CORRECT normalized
 *   rate — and one that sent none keeps a non-taxable invoice. The V2 forms
 *   send the explicit flags (taxApplicable / taxRate / withholdingApplicable
 *   / withholdingRate, all percentages).
 */

import { computeInvoiceTotals, normalizeTaxRate, DEFAULT_VAT_RATE_PCT, DEFAULT_WHT_RATE_PCT } from "./invoiceFinancials";
import { issueInvoiceNumber } from "./invoiceNumbering";

interface FirmTaxSettings {
  vatRate?: number | null;
  whtRate?: number | null;
  [key: string]: any;
}

/** Resolve the firm's stored rates to percentages. Firm rows hold vatRate as
 *  a legacy FRACTION (FirmDetailsForm stores input/100) — normalizeTaxRate
 *  reconciles either storage convention. */
function firmRatesPct(taxSettings: FirmTaxSettings | null | undefined): { vatPct: number; whtPct: number } {
  return {
    vatPct: normalizeTaxRate(taxSettings?.vatRate, DEFAULT_VAT_RATE_PCT),
    whtPct: normalizeTaxRate(taxSettings?.whtRate, DEFAULT_WHT_RATE_PCT),
  };
}

function asBool(v: any): boolean | undefined {
  if (typeof v === "boolean") return v;
  return undefined;
}

function asNumber(v: any): number | undefined {
  if (typeof v === "number" && isFinite(v)) return v;
  return undefined;
}

/** Shared intent resolution + recomputation. Returns the authoritative money
 *  fields to persist. Pure except for the (already-normalized) inputs. */
export function resolveInvoiceMoney(
  data: {
    lineItems?: any[] | null;
    taxApplicable?: any;
    taxRate?: any;
    taxAmount?: any;
    withholdingApplicable?: any;
    withholdingRate?: any;
    withholdingAmount?: any;
  },
  taxSettings: FirmTaxSettings | null | undefined,
) {
  const { vatPct, whtPct } = firmRatesPct(taxSettings);

  // Tax intent: explicit flag first; legacy inference from a client-computed
  // taxAmount keeps old callers' VAT at the correctly-normalized rate.
  const explicitApplicable = asBool(data.taxApplicable);
  const legacyTaxHint = asNumber(data.taxAmount);
  const taxApplicable = explicitApplicable ?? (legacyTaxHint !== undefined && legacyTaxHint > 0);

  const explicitRate = asNumber(data.taxRate);
  const ratePct = taxApplicable
    ? normalizeTaxRate(explicitRate ?? taxSettings?.vatRate, vatPct)
    : 0;

  const whtExplicitApplicable = asBool(data.withholdingApplicable);
  const legacyWhtHint = asNumber(data.withholdingAmount);
  const whtApplicable = whtExplicitApplicable ?? (legacyWhtHint !== undefined && legacyWhtHint > 0);
  const whtExplicitRate = asNumber(data.withholdingRate);
  const whtRatePct = whtApplicable
    ? normalizeTaxRate(whtExplicitRate ?? taxSettings?.whtRate, whtPct)
    : 0;

  const totals = computeInvoiceTotals(
    data.lineItems,
    { applicable: taxApplicable, ratePct },
    { applicable: whtApplicable, ratePct: whtRatePct },
  );
  return totals;
}

/** Fields the update fence recomputes when the patch touches them. */
export const INVOICE_MONEY_TRIGGER_FIELDS = new Set([
  "lineItems", "taxApplicable", "taxRate", "withholdingApplicable", "withholdingRate",
]);

/**
 * CREATE fence — mutates `sanitizedData` in place (number + authoritative
 * totals). Call inside the creating transaction, AFTER the client-id
 * idempotency check (replays must not burn a sequence number) and BEFORE
 * the insert.
 */
export async function applyInvoiceCreateFence(
  ctx: any,
  firmId: string,
  sanitizedData: Record<string, any>,
): Promise<void> {
  let firm: any = null;
  try { firm = await ctx.db.get(firmId); } catch { firm = null; }

  // 1. Server-issued, atomic, per-firm invoice number. Replaces the
  //    collision-prone client suggestion entirely.
  sanitizedData.invoiceNumber = await issueInvoiceNumber(ctx, firmId);

  // 2. Authoritative totals — the client's figures become hints.
  const totals = resolveInvoiceMoney(sanitizedData, firm?.taxSettings);
  sanitizedData.subTotal = totals.subTotal;
  sanitizedData.taxAmount = totals.taxAmount;
  sanitizedData.total_amount = totals.total_amount;
  sanitizedData.netReceivable = totals.netReceivable;
  sanitizedData.taxApplicable = totals.taxApplicable;
  sanitizedData.taxRate = totals.taxRate;
  sanitizedData.withholdingApplicable = totals.withholdingApplicable;
  sanitizedData.withholdingRate = totals.withholdingRate;
  sanitizedData.withholdingAmount = totals.withholdingAmount;
  // amountPaid is intentionally NOT set at creation — payments enter only
  // through the audited recordInvoicePayment lifecycle.
}

/**
 * UPDATE fence — adjusts `patchData` in place. Runs after sanitization,
 * before the audited patch. Returns silently for non-invoice tables.
 */
export async function applyInvoiceUpdateFence(
  ctx: any,
  firmId: string,
  docId: any,
  patchData: Record<string, any>,
): Promise<void> {
  // 1. amountPaid is lifecycle-controlled (audited payment recording only).
  if ("amountPaid" in patchData) {
    delete patchData.amountPaid;
  }

  let existing: any = null;
  try { existing = await ctx.db.get(docId); } catch { existing = null; }
  if (!existing) return; // resolveRecordForUpdate already gates existence

  // 2. Manual number edits must not collide with another of the firm's
  //    invoices (creation numbers are conflict-free by construction).
  if (typeof patchData.invoiceNumber === "string" && patchData.invoiceNumber.trim() !== "" &&
      patchData.invoiceNumber !== existing.invoiceNumber) {
    const firmInvoices: any[] = await ctx.db
      .query("invoices")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .collect();
    const clash = firmInvoices.some(
      (i) => String(i.invoiceNumber ?? "") === patchData.invoiceNumber && String(i._id) !== String(existing._id),
    );
    if (clash) {
      throw new Error(
        `Invoice number ${patchData.invoiceNumber} is already used by another invoice in this firm. ` +
        `Invoice numbers are unique — pick a different number.`
      );
    }
  }

  // 3. Recompute totals when the patch changes money-relevant fields.
  const touchesMoney = Object.keys(patchData).some((k) => INVOICE_MONEY_TRIGGER_FIELDS.has(k));
  if (!touchesMoney) return;

  let firm: any = null;
  try { firm = await ctx.db.get(firmId); } catch { firm = null; }

  const merged = {
    lineItems: existing.lineItems,
    taxApplicable: existing.taxApplicable,
    taxRate: existing.taxRate,
    taxAmount: existing.taxAmount,
    withholdingApplicable: existing.withholdingApplicable,
    withholdingRate: existing.withholdingRate,
    withholdingAmount: existing.withholdingAmount,
    ...pick(patchData, ["lineItems", "taxApplicable", "taxRate", "taxAmount", "withholdingApplicable", "withholdingRate", "withholdingAmount"]),
  };

  const totals = resolveInvoiceMoney(merged, firm?.taxSettings);
  patchData.subTotal = totals.subTotal;
  patchData.taxAmount = totals.taxAmount;
  patchData.total_amount = totals.total_amount;
  patchData.netReceivable = totals.netReceivable;
  patchData.taxApplicable = totals.taxApplicable;
  patchData.taxRate = totals.taxRate;
  patchData.withholdingApplicable = totals.withholdingApplicable;
  patchData.withholdingRate = totals.withholdingRate;
  patchData.withholdingAmount = totals.withholdingAmount;
}

function pick(obj: Record<string, any>, keys: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of keys) {
    if (obj && k in obj && obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}
