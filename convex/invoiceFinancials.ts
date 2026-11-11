/**
 * convex/invoiceFinancials.ts — THE ONE TAX AND TOTALS CONTRACT (V2 round,
 * 2026-11-11). Fixes V-FIN-2, V-FIN-15 and the outstanding-balance drift
 * (V-FIN-1/V-FIN-10) at their shared root: every surface used to compute
 * VAT, totals and "outstanding" with its own formula.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE TAX CONTRACT (V-FIN-15 — percentage vs fraction, resolved once)
 * ─────────────────────────────────────────────────────────────────────────────
 * At this module's boundary a tax rate is a PERCENTAGE: 7.5 means 7.5%.
 * Before V2 the codebase held BOTH conventions at once —
 *   • InvoiceForm/InvoiceGeneratorForm: `vatRate || 0.075` then subTotal ×
 *     vatRate (fraction semantics — a firm that stored 7.5 was charged 750%)
 *   • useFinance: `vatRate || 7.5` then subTotal × rate / 100 (percentage
 *     semantics — a firm that stored 0.075 was charged 0.075%)
 *   • retainerBilling: hardcoded percentage 7.5
 * …and the generate-from-matter path dropped VAT to zero entirely because it
 * required a `tax.applicable` flag the generating form never sent (V-FIN-2).
 *
 * normalizeTaxRate() reconciles ALL of it:
 *   • undefined/NaN        → the firm default (Nigerian VAT, 7.5%)
 *   • 0                    → 0 (EXPLICIT zero-rating — never defaulted away;
 *                             a zero-rated invoice keeps taxRate: 0, which is
 *                             a different financial statement from "not
 *                             taxable": the seller may still reclaim input VAT
 *                             on zero-rated output)
 *   • 0 < rate < 1         → legacy FRACTION storage (0.075) → ×100
 *   • rate ≥ 1             → percentage as-is (7.5, 10)
 *   • negative             → rejected (an invalid rate must fail loudly, not
 *                             silently bill -3%)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ARITHMETIC CONTRACT — integer kobo at every calculation boundary
 * ─────────────────────────────────────────────────────────────────────────────
 * Round F convention (moneyUtils): compute in integer kobo internally, store
 * naira @2dp. Every helper here converts each operand to kobo ONCE, sums in
 * integers, and converts back a single time. 0.1 + 0.2 is exactly 0.3.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE TOTALS CONTRACT (V-FIN-2/V-FIN-15 — server-authoritative)
 * ─────────────────────────────────────────────────────────────────────────────
 * computeInvoiceTotals() is the ONLY way an invoice's money figures are
 * computed — called server-side by the createItem/updateItem invoice fence
 * and by retainerBilling, so manual, generated and edited invoices follow
 * identical rules and client-provided totals can never become authoritative.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE OUTSTANDING CONTRACT (V-FIN-1/V-FIN-10 — one number, every surface)
 * ─────────────────────────────────────────────────────────────────────────────
 * invoiceOutstanding() is the ONE definition of "what this client still
 * owes on this invoice": the persisted total minus payments actually
 * recorded (amountPaid), floor 0. Mirrored to the client in
 * src/utils/invoiceFinancials.ts (drift-tested, same convention as
 * financialLifecycle) and served to the portal as a server-computed
 * summary (portals.getClientFinancialSummary) so the five previously-
 * disagreeing surfaces (client dashboard hero, client financials tab,
 * client billing tab, staff KPI strip, reports) show the same naira.
 *
 * This module is PURE — no Convex imports — so the unit tests (and only
 * they) can import it directly; src/ uses the mirror per repo convention.
 */

// ─── Tax-rate normalisation (THE contract boundary) ─────────────────────────

/** Nigerian VAT (VAT Act, Finance Act 2020). The default when a firm has no
 *  explicit setting — matches the pre-V2 fallback in useFinance.ts. */
export const DEFAULT_VAT_RATE_PCT = 7.5;

/** Nigerian WHT on professional/legal services (Companies Income Tax Act s.80).
 *  The default when an invoice applies withholding without an explicit rate. */
export const DEFAULT_WHT_RATE_PCT = 10;

/**
 * Normalise ANY historical rate representation to a percentage.
 * See the module header for the full rule table. Throws on negative rates.
 */
export function normalizeTaxRate(
  raw: number | null | undefined,
  fallbackPct: number = DEFAULT_VAT_RATE_PCT,
): number {
  if (raw === null || raw === undefined) return fallbackPct;
  if (typeof raw !== "number" || isNaN(raw)) return fallbackPct;
  if (raw < 0) {
    throw new Error("Tax rate cannot be negative. Rates are percentages (7.5 = 7.5%); a negative rate is not a valid tax statement.");
  }
  if (raw === 0) return 0; // explicit zero-rating — preserved, never defaulted
  if (raw < 1) return round2(raw * 100); // legacy fraction storage (0.075 → 7.5)
  return round2(raw); // percentage as-is
}

// ─── Kobo-exact primitives (self-contained; mirrors moneyUtils.addKobo so
//     this module stays import-free) ─────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toKobo(naira: number): number {
  return Math.round((Number(naira) || 0) * 100);
}

function sumKobo(nairaAmounts: number[]): number {
  let kobo = 0;
  for (const n of nairaAmounts) kobo += toKobo(n);
  return kobo;
}

function koboToNairaFloor(kobo: number): number {
  return Math.round((kobo / 100) * 100) / 100;
}

// ─── Line items ─────────────────────────────────────────────────────────────

export interface LineItemLike {
  total?: number | null;
  hours?: number | null;
  rate?: number | null;
  [key: string]: any;
}

/**
 * A single line item's amount in kobo: the explicit total when present,
 * otherwise hours × rate. Negative amounts are rejected (the manual form
 * already blocks them; the server must not accept what the form would not).
 */
export function lineItemTotalKobo(li: LineItemLike): number {
  let total: number;
  if (typeof li?.total === "number" && isFinite(li.total)) {
    total = li.total;
  } else {
    const hours = typeof li?.hours === "number" && isFinite(li.hours) ? li.hours : 0;
    const rate = typeof li?.rate === "number" && isFinite(li.rate) ? li.rate : 0;
    total = hours * rate;
  }
  if (total < 0) {
    throw new Error("Line item amounts cannot be negative — correct the line item before saving. Corrections to issued invoices belong in the audited void/reinstate lifecycle.");
  }
  return toKobo(total);
}

/** Sum of line-item amounts, in kobo. Empty/missing items → 0. */
export function lineItemsSubTotalKobo(lineItems: LineItemLike[] | null | undefined): number {
  if (!Array.isArray(lineItems)) return 0;
  let kobo = 0;
  for (const li of lineItems) kobo += lineItemTotalKobo(li);
  return kobo;
}

// ─── THE totals computation (server-authoritative, kobo-exact) ──────────────

export interface InvoiceTaxInput {
  /** Is tax applicable to this invoice at all? false → non-taxable supply. */
  applicable: boolean;
  /** Percentage (normalized). Ignored when applicable is false. */
  ratePct: number;
}

export interface InvoiceWithholdingInput {
  /** Is withholding tax deducted at source on this invoice? */
  applicable: boolean;
  /** Percentage (normalized). Ignored when applicable is false. */
  ratePct: number;
}

export interface ComputedInvoiceTotals {
  subTotal: number;
  taxAmount: number;
  /** VAT rate actually applied, as a percentage (persisted for audit truth). */
  taxRate: number;
  /** Whether tax was applied (persisted — distinguishes zero-rated from non-taxable). */
  taxApplicable: boolean;
  withholdingAmount: number;
  /** WHT rate actually applied, as a percentage (persisted). */
  withholdingRate: number;
  withholdingApplicable: boolean;
  /** subTotal + taxAmount — the invoice's full stated value. */
  total_amount: number;
  /** total_amount − withholdingAmount — what the firm actually collects. */
  netReceivable: number;
}

/**
 * Compute every money figure of an invoice from its line items + tax flags.
 * Integer kobo throughout; each output is converted back to naira once.
 *
 * Nigerian statutory convention: VAT and WHT are both computed on the FEE
 * (subTotal) — VAT adds to the invoice total, WHT is deducted at source by
 * the client from the amount payable. netReceivable = total − WHT.
 */
export function computeInvoiceTotals(
  lineItems: LineItemLike[] | null | undefined,
  tax: InvoiceTaxInput,
  wht: InvoiceWithholdingInput = { applicable: false, ratePct: DEFAULT_WHT_RATE_PCT },
): ComputedInvoiceTotals {
  const subTotalKobo = lineItemsSubTotalKobo(lineItems);
  const taxApplicable = tax.applicable === true;
  const taxRate = taxApplicable ? normalizeTaxRate(tax.ratePct, DEFAULT_VAT_RATE_PCT) : 0;
  // Integer kobo, banker-safe: tax = round(subTotal × rate%) — the last kobo
  // is rounded once, here, and nowhere else.
  const taxKobo = taxApplicable ? Math.round((subTotalKobo * taxRate) / 100) : 0;

  const whtApplicable = wht.applicable === true;
  const whtRate = whtApplicable ? normalizeTaxRate(wht.ratePct, DEFAULT_WHT_RATE_PCT) : 0;
  const whtKobo = whtApplicable ? Math.round((subTotalKobo * whtRate) / 100) : 0;

  const totalKobo = subTotalKobo + taxKobo;
  const netKobo = totalKobo - whtKobo;

  return {
    subTotal: koboToNairaFloor(subTotalKobo),
    taxAmount: koboToNairaFloor(taxKobo),
    taxRate,
    taxApplicable,
    withholdingAmount: koboToNairaFloor(whtKobo),
    withholdingRate: whtRate,
    withholdingApplicable: whtApplicable,
    total_amount: koboToNairaFloor(totalKobo),
    netReceivable: koboToNairaFloor(netKobo),
  };
}

// ─── THE outstanding contract (one number for every surface) ────────────────

/**
 * Invoice statuses that still owe money. Normalised case-insensitively
 * because legacy rows hold mixed casing ('Sent' vs 'sent'). Matches the
 * automation engine's open set (automationRules.INVOICE_OPEN_STATUSES)
 * plus the V2 'Partially Paid' status. Draft is NOT open (an unissued
 * draft has never been billed to the client).
 */
const OPEN_STATUS_SET = new Set(["sent", "unpaid", "overdue", "partially_paid", "partially paid", ""]);

export function isOpenInvoiceStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return OPEN_STATUS_SET.has(s);
}

/** The invoice's full stated value with ONE fallback chain (kobo-exact):
 *  the persisted server-computed total_amount first — INCLUDING a true 0,
 *  which the old `total_amount || subTotal` chains silently replaced —
 *  then subTotal + taxAmount, then the line-items sum + taxAmount. */
export function invoiceTotalAmount(inv: {
  total_amount?: number | null;
  subTotal?: number | null;
  taxAmount?: number | null;
  lineItems?: LineItemLike[] | null;
}): number {
  if (typeof inv?.total_amount === "number" && isFinite(inv.total_amount)) {
    return round2(inv.total_amount);
  }
  const hasSub = typeof inv?.subTotal === "number" && isFinite(inv.subTotal!);
  const tax = typeof inv?.taxAmount === "number" && isFinite(inv.taxAmount!) ? inv.taxAmount! : 0;
  if (hasSub) {
    return koboToNairaFloor(toKobo(inv!.subTotal as number) + toKobo(tax));
  }
  return koboToNairaFloor(lineItemsSubTotalKobo(inv?.lineItems) + toKobo(tax));
}

/** Payments actually recorded against this invoice (V2 field; legacy rows
 *  settled by the status flip have none — status remains the Paid authority
 *  for them). Non-finite/negative values are treated as 0, never trusted. */
export function invoiceAmountPaid(inv: { amountPaid?: number | null }): number {
  const paid = inv?.amountPaid;
  if (typeof paid !== "number" || !isFinite(paid) || paid < 0) return 0;
  return round2(paid);
}

/** What is still owed on ONE invoice: total − payments recorded, floor 0.
 *  A fully-paid invoice returns 0 regardless of status string; an open
 *  invoice with recorded partial payments returns the true remainder
 *  (V-FIN-9 — partial payments must be visible in what's owed). */
export function invoiceOutstanding(inv: {
  status?: string | null;
  total_amount?: number | null;
  subTotal?: number | null;
  taxAmount?: number | null;
  lineItems?: LineItemLike[] | null;
  amountPaid?: number | null;
}): number {
  const total = invoiceTotalAmount(inv);
  const paid = invoiceAmountPaid(inv);
  const kobo = Math.max(0, toKobo(total) - toKobo(paid));
  return koboToNairaFloor(kobo);
}

/** Same predicate as financialIntegrity.isActiveFinancialRecord, repeated
 *  verbatim so this module stays import-free for the client mirror. Voided
 *  and test rows are annotations, not money. */
export function isActiveFinancialRecordLocal(recordStatus: string | undefined | null): boolean {
  return recordStatus !== "voided" && recordStatus !== "test";
}

export interface ClientFinancialSummary {
  /** Σ outstanding over open, active invoices. */
  outstandingBalance: number;
  /** Count of open, active invoices (what the portal badge shows). */
  openInvoiceCount: number;
  /** Σ stated totals of active, fully-paid invoices. */
  paidTotal: number;
  /** Σ outstanding over open, active invoices that are past their dueDate. */
  overdueBalance: number;
}

/**
 * THE client financial summary — computed server-side
 * (portals.getClientFinancialSummary) and mirrored client-side. Excludes
 * voided/test rows and non-open statuses; treats 'Partially Paid' and
 * past-due open invoices as still owing their true remainder.
 */
export function computeClientFinancialSummary(
  invoices: Array<{
    status?: string | null;
    recordStatus?: string | null;
    dueDate?: string | null;
    total_amount?: number | null;
    subTotal?: number | null;
    taxAmount?: number | null;
    lineItems?: LineItemLike[] | null;
    amountPaid?: number | null;
  }> | null | undefined,
  nowMs: number = Date.now(),
): ClientFinancialSummary {
  const rows = Array.isArray(invoices) ? invoices : [];
  let outstandingBalance = 0;
  let openInvoiceCount = 0;
  let paidTotal = 0;
  let overdueBalance = 0;

  for (const inv of rows) {
    if (!isActiveFinancialRecordLocal(inv.recordStatus)) continue;
    if (String(inv.status ?? "").trim().toLowerCase() === "void") continue; // belt-and-braces (pre-lifecycle voids)
    if (isOpenInvoiceStatus(inv.status)) {
      const owed = invoiceOutstanding(inv);
      outstandingBalance = koboToNairaFloor(toKobo(outstandingBalance) + toKobo(owed));
      openInvoiceCount++;
      const due = inv.dueDate ? Date.parse(String(inv.dueDate)) : NaN;
      if (!isNaN(due) && due < nowMs) {
        overdueBalance = koboToNairaFloor(toKobo(overdueBalance) + toKobo(owed));
      }
    } else if (String(inv.status ?? "").trim().toLowerCase() === "paid") {
      paidTotal = koboToNairaFloor(toKobo(paidTotal) + toKobo(invoiceTotalAmount(inv)));
    }
  }

  return { outstandingBalance, openInvoiceCount, paidTotal, overdueBalance };
}
