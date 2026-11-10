/**
 * ariaFinancials — ARIA's REAL-books financial query bridge (Round G §2+§6).
 *
 * WHY THIS EXISTS: Round F gave Atrium OS a complete money-truth backend —
 * getFinancialOverview, getFinancialReports and getResidentBill, every
 * figure computed server-side, kobo-internally, staff-authed and
 * firm-scoped. But ARIA could not reach ANY of it: the assistant's only
 * data tools were the client-state searches (tasks/notes/matters/
 * documents/properties). Ask ARIA "who owes rent?" or "what did we
 * collect this month?" and it had nothing real to answer from — the
 * exact fabrication risk the owner brief §2/§6 forbids.
 *
 * This module is the dispatch layer between the `query_financials` chat
 * tool and those REAL Convex reads. It moves no money, computes no
 * totals client-side, and invents nothing: the tool result the model
 * receives IS the server's answer, with a grounding note that pins the
 * anti-fabrication rule (§6: the LLM never touches the database; it
 * only ever sees authed, server-computed results).
 *
 * The Convex query functions are injected as deps so tests can drive
 * the dispatch without a live backend.
 */

export const ARIA_FINANCIAL_REPORTS = [
  'overview',
  'arrears_aging',
  'rent_roll',
  'collections',
  'revenue_by_type',
  'payment_history',
  'period_comparison',
  'resident_bill',
] as const;

export type AriaFinancialReport = (typeof ARIA_FINANCIAL_REPORTS)[number];

/** report → key inside getFinancialReports' return object. */
const REPORTS_KEY: Partial<Record<AriaFinancialReport, string>> = {
  arrears_aging: 'arrearsAging',
  rent_roll: 'rentRoll',
  collections: 'scCollections',
  revenue_by_type: 'revenueByType',
  payment_history: 'paymentHistory',
  period_comparison: 'periodComparison',
};

export interface AriaFinancialAuth {
  firmId: string;
  sessionToken?: string;
  userEmail?: string;
}

export interface AriaFinancialQueryArgs {
  report: AriaFinancialReport;
  /** Required for resident_bill — resolve the unit first via
   * query_firm_data(category='properties') if unknown. */
  unitId?: string;
  /** Optional resident identity keys (same union as getResidentBill). */
  tenantContactId?: string;
  tenantUserId?: string;
  tenantEmail?: string;
}

export interface AriaFinancialDeps {
  // Args are `any` deliberately: the real implementations are Convex
  // generated query functions whose arg types are produced by the
  // schema codegen — the dispatch builds the args and the tests inject
  // fakes; nothing here should re-declare Convex's generated shapes.
  getFinancialOverview: (args: any) => Promise<unknown>;
  getFinancialReports: (args: any) => Promise<unknown>;
  getResidentBill: (args: any) => Promise<unknown>;
}

export interface AriaFinancialResult {
  report: AriaFinancialReport;
  /** The server's answer, verbatim. */
  data: unknown;
  /** Anti-fabrication grounding note for the model. */
  note: string;
}

export const ARIA_FINANCIAL_GROUNDING_NOTE =
  'FIGURES: every number in this result was computed server-side from the firm\'s real books. ' +
  'Report these figures EXACTLY as given — never recompute, total, or estimate them yourself, and never ' +
  'state a financial figure that did not come from this result. If the user asks for a figure this report ' +
  'does not contain, call query_financials again with the report that does (or say what is not on record).';

export function isAriaFinancialReport(v: unknown): v is AriaFinancialReport {
  return typeof v === 'string' && (ARIA_FINANCIAL_REPORTS as readonly string[]).includes(v);
}

/**
 * Run one financial report query against the REAL backend reads.
 * Throws only on auth/transport errors (the caller surfaces those to the
 * model as a tool error); never fabricates a fallback.
 */
export async function runAriaFinancialQuery(
  args: AriaFinancialQueryArgs,
  auth: AriaFinancialAuth,
  deps: AriaFinancialDeps,
): Promise<AriaFinancialResult> {
  const report = args.report;
  if (!isAriaFinancialReport(report)) {
    throw new Error(`Unknown financial report '${String(report)}'. Valid: ${ARIA_FINANCIAL_REPORTS.join(', ')}.`);
  }

  if (report === 'overview') {
    const data = await deps.getFinancialOverview({
      firmId: auth.firmId,
      sessionToken: auth.sessionToken,
      userEmail: auth.userEmail,
    });
    return { report, data, note: ARIA_FINANCIAL_GROUNDING_NOTE };
  }

  if (report === 'resident_bill') {
    if (!args.unitId || !String(args.unitId).trim()) {
      // Instruct, don't guess (§6): the model must resolve the unit first.
      return {
        report,
        data: null,
        note:
          'A resident bill needs a unit. Call query_firm_data with category=\'properties\' to find the ' +
          'property/unit the user means, then call query_financials again with report=\'resident_bill\' ' +
          'and that unitId. NEVER invent a bill or quote balances from memory.',
      };
    }
    const data = await deps.getResidentBill({
      firmId: auth.firmId,
      sessionToken: auth.sessionToken,
      userEmail: auth.userEmail,
      unitId: String(args.unitId).trim(),
      ...(args.tenantContactId ? { tenantContactId: args.tenantContactId } : {}),
      ...(args.tenantUserId ? { tenantUserId: args.tenantUserId } : {}),
      ...(args.tenantEmail ? { tenantEmail: args.tenantEmail } : {}),
    });
    return { report, data, note: ARIA_FINANCIAL_GROUNDING_NOTE };
  }

  // The six report-suite reports all come from getFinancialReports —
  // one authed read, then the requested slice.
  const key = REPORTS_KEY[report]!;
  const all = (await deps.getFinancialReports({
    firmId: auth.firmId,
    sessionToken: auth.sessionToken,
    userEmail: auth.userEmail,
  })) as Record<string, unknown>;

  if (!all || typeof all !== 'object' || !(key in all)) {
    throw new Error(`The financial report '${report}' is unavailable right now. Say so and suggest retrying.`);
  }
  return { report, data: all[key], note: ARIA_FINANCIAL_GROUNDING_NOTE };
}

/** Human-readable one-liner for the "ARIA is working…" status strip. */
export function describeAriaFinancialQuery(args: AriaFinancialQueryArgs): string {
  switch (args.report) {
    case 'overview':
      return 'reading your live financial overview';
    case 'arrears_aging':
      return 'checking who owes and how long';
    case 'rent_roll':
      return 'pulling the rent roll';
    case 'collections':
      return 'reading service-charge collections';
    case 'revenue_by_type':
      return 'reading revenue by type';
    case 'payment_history':
      return 'reading payment history';
    case 'period_comparison':
      return 'comparing this month to last';
    case 'resident_bill':
      return 'building the resident bill statement';
    default:
      return 'reading your books';
  }
}
