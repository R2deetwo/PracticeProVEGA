/**
 * src/utils/invoiceFinancials.ts — CLIENT MIRROR of the one tax/totals/
 * outstanding contract (V2 round, 2026-11-11).
 *
 * The SERVER canon lives in convex/invoiceFinancials.ts. Per repo convention
 * (see financialLifecycle.ts) src/ does not import convex server modules, so
 * the contract is mirrored here.
 *
 * DRIFT IS TESTED AWAY: tests/unit/roundV2FinancialTruth.test.ts imports BOTH
 * copies and asserts they agree across the full input matrix (rates, totals,
 * outstanding, summaries). Changing one without the other fails the suite.
 *
 * Why this mirror exists: before V2, five surfaces computed "outstanding"
 * with five different formulas — the client portal hero card summed
 * `inv.totalAmount || inv.amount` (fields that DO NOT EXIST on invoices, so
 * it showed ₦0 forever), the client financials tab used the same ghost
 * fields, ClientBillingTab used another fallback chain, the staff KPI strip
 * used `total_amount || subTotal` (a true ₦0 total silently fell back to
 * subTotal) and the reports view summed raw line items ignoring VAT. All of
 * them now call the functions below — or the server-computed summary for
 * portal users — so every surface shows the same naira.
 */

/** Nigerian VAT (VAT Act, Finance Act 2020). */
export const DEFAULT_VAT_RATE_PCT = 7.5;

/** Nigerian WHT on professional/legal services (CITA s.80). */
export const DEFAULT_WHT_RATE_PCT = 10;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toKobo(naira: number): number {
  return Math.round((Number(naira) || 0) * 100);
}

function koboToNairaFloor(kobo: number): number {
  return Math.round((kobo / 100) * 100) / 100;
}

/**
 * Normalise ANY historical rate representation to a percentage:
 * undefined → 7.5 default; 0 → 0 (explicit zero-rating); 0 < r < 1 → legacy
 * fraction (×100); r ≥ 1 → percentage; negative → throws.
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
  if (raw === 0) return 0;
  if (raw < 1) return round2(raw * 100);
  return round2(raw);
}

export interface LineItemLike {
  total?: number | null;
  hours?: number | null;
  rate?: number | null;
  [key: string]: any;
}

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
    throw new Error("Line item amounts cannot be negative — correct the line item before saving.");
  }
  return toKobo(total);
}

export function lineItemsSubTotalKobo(lineItems: LineItemLike[] | null | undefined): number {
  if (!Array.isArray(lineItems)) return 0;
  let kobo = 0;
  for (const li of lineItems) kobo += lineItemTotalKobo(li);
  return kobo;
}

export interface InvoiceTaxInput {
  applicable: boolean;
  ratePct: number;
}

export interface InvoiceWithholdingInput {
  applicable: boolean;
  ratePct: number;
}

export interface ComputedInvoiceTotals {
  subTotal: number;
  taxAmount: number;
  taxRate: number;
  taxApplicable: boolean;
  withholdingAmount: number;
  withholdingRate: number;
  withholdingApplicable: boolean;
  total_amount: number;
  netReceivable: number;
}

/** Compute every money figure of an invoice from line items + tax flags
 *  (kobo-exact). VAT and WHT are both computed on the fee; VAT adds to the
 *  total, WHT is deducted at source (netReceivable = total − WHT). */
export function computeInvoiceTotals(
  lineItems: LineItemLike[] | null | undefined,
  tax: InvoiceTaxInput,
  wht: InvoiceWithholdingInput = { applicable: false, ratePct: DEFAULT_WHT_RATE_PCT },
): ComputedInvoiceTotals {
  const subTotalKobo = lineItemsSubTotalKobo(lineItems);
  const taxApplicable = tax.applicable === true;
  const taxRate = taxApplicable ? normalizeTaxRate(tax.ratePct, DEFAULT_VAT_RATE_PCT) : 0;
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

const OPEN_STATUS_SET = new Set(["sent", "unpaid", "overdue", "partially_paid", "partially paid", ""]);

export function isOpenInvoiceStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return OPEN_STATUS_SET.has(s);
}

/** The invoice's full stated value, ONE fallback chain (kobo-exact):
 *  persisted total_amount first (including a true 0), then subTotal+tax,
 *  then line items+tax. */
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

export function invoiceAmountPaid(inv: { amountPaid?: number | null }): number {
  const paid = inv?.amountPaid;
  if (typeof paid !== "number" || !isFinite(paid) || paid < 0) return 0;
  return round2(paid);
}

/** What is still owed on ONE invoice: total − payments recorded, floor 0. */
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

export function isActiveFinancialRecordLocal(recordStatus: string | undefined | null): boolean {
  return recordStatus !== "voided" && recordStatus !== "test";
}

export interface ClientFinancialSummary {
  outstandingBalance: number;
  openInvoiceCount: number;
  paidTotal: number;
  overdueBalance: number;
}

/** THE client financial summary — one definition of what a client owes. */
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
    if (String(inv.status ?? "").trim().toLowerCase() === "void") continue;
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
