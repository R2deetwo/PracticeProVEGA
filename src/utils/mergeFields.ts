/**
 * mergeFields — client-side twin of the Automation Engine's server renderer
 * (convex/automationEngine.ts renderMergeFields).
 *
 * Lets the Scheduled Messages form show a LIVE preview of what each recipient
 * will see, then submit fully-resolved content per recipient. Supported tags
 * (lowercase as specified, uppercase legacy aliases accepted):
 *   {{tenant_name}} {{unit_number}} {{amount_due}} {{due_date}}
 *   {{property_name}} {{payment_link}}
 */

export interface ClientMergeVars {
  tenant_name?: string | null;
  unit_number?: string | null;
  amount_due?: number | null;
  due_date?: string | null;
  property_name?: string | null;
  firm_name?: string | null;
  payment_link?: string | null;
  [k: string]: unknown;
}

export const MERGE_FIELD_TAGS: Array<{ tag: string; label: string }> = [
  { tag: '{{tenant_name}}', label: "Tenant's name" },
  { tag: '{{unit_number}}', label: 'Unit' },
  { tag: '{{amount_due}}', label: 'Amount due' },
  { tag: '{{due_date}}', label: 'Due date' },
  { tag: '{{property_name}}', label: 'Property' },
  { tag: '{{payment_link}}', label: 'Payment link' },
];

function formatNaira(value: number): string {
  return `₦${value.toLocaleString('en-NG')}`;
}

/** Render tags; unknown tags are stripped so syntax never leaks to tenants. */
export function renderMergeFields(template: string, vars: ClientMergeVars): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, rawKey: string) => {
    const key = String(rawKey).toLowerCase();
    const value = (vars as Record<string, unknown>)[key];
    if (value === undefined || value === null) return '';
    if (typeof value === 'number') return formatNaira(value);
    return String(value).trim();
  });
}

export function hasMergeFields(template: string): boolean {
  return /\{\{\s*[a-zA-Z0-9_]+\s*\}\}/.test(template || '');
}

/**
 * Next rent due date for a unit (day-of-month of lease start, rolled
 * forward) — mirrors the engine's nextRentDueTimestamp.
 */
export function nextRentDueTs(fromTs: number, leaseStartTs?: number | null): number {
  const day = leaseStartTs ? Math.min(Math.max(new Date(leaseStartTs).getDate(), 1), 28) : 1;
  const from = new Date(fromTs);
  let candidate = new Date(from.getFullYear(), from.getMonth(), day);
  if (candidate.getTime() < fromTs - 86_400_000) {
    candidate = new Date(from.getFullYear(), from.getMonth() + 1, day);
  }
  return candidate.getTime();
}
