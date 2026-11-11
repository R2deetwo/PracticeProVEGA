/**
 * dashboardKpis — the pure KPI calculations behind the unified dashboard
 * (K-5/K-6, KOMPLETE unified-product integrity).
 *
 * DEFECT: each KPI was computed inline in Dashboard.tsx with drifting
 * semantics — the "Managed Units" card displayed the count of property
 * ROWS (a 24-unit estate counted as 1), and "units" meant different
 * things on different surfaces (declared numberOfUnits here, embedded
 * units.length there, rows grouped by address elsewhere). Nothing was
 * testable and nothing stated its own definition.
 *
 * THE RULES (each KPI states its calculation — pinned by
 * tests/unit/unitCounts.test.ts):
 *   - activeMattersCount    — matters with status 'Active' (archived rows
 *                             excluded defensively), i.e. LEGAL workload.
 *   - overdueTasksCount     — non-done tasks whose dueDate is in the past.
 *   - outstandingLegalRevenue — Σ outstanding of UNPAID/OVERDUE LEGAL-origin
 *                             invoices (money the legal operation is owed;
 *                             property money is ledger-tracked, never mixed
 *                             into this figure).
 *   - portfolioUnitTotals   — managedUnits = Σ unitCountBase (every
 *                             property's declared-or-embedded inventory,
 *                             minimum 1 occupancy per row); propertyCount
 *                             = property ROWS; occupiedProperties = rows
 *                             with status 'Occupied'; occupancyRate =
 *                             occupiedProperties / propertyCount (a
 *                             PROPERTY-level occupancy rate — units are not
 *                             assumed letable individually unless declared).
 *   - outstandingRentLedger — Σ pending/defaulted tenancy-ledger entries
 *                             (rent money only; voided/test rows excluded).
 *
 * K-6 (no double counting): legal invoices and the rent ledger are
 * disjoint money systems; a contact referenced by both a matter and a
 * property is ONE contact and never contributes to more than one count
 * (each KPI counts records of a single type — matters, property rows,
 * ledger entries — never a mix).
 */

import { InvoiceStatus } from '../types';
import { unitCountBase } from './propertyUnitCount';
import { invoiceBusinessOrigin, type InvoiceLike, type MatterLike, type PropertyLike } from './invoiceOrigin';

export interface TaskLike {
    id?: string;
    status?: string;
    dueDate?: string | number | null;
    [key: string]: any;
}

export interface MatterKpiInput extends MatterLike {
    status?: string;
    title?: string;
    [key: string]: any;
}

export interface LedgerEntryLike {
    propertyId?: string | null;
    unitId?: string | null;
    status?: string;
    recordStatus?: string | null;
    amount?: number;
    [key: string]: any;
}

/** Active legal matters. Definition: status === 'Active' and not archived. */
export function activeMattersCount(matters: MatterKpiInput[]): number {
    return (matters || []).filter((m) => {
        if (!m || !m.id || !m.title) return false;
        if (m.archivedAt) return false; // archived rows are not active workload
        return m.status === 'Active';
    }).length;
}

/** Overdue tasks. Definition: not done, dueDate in the past. */
export function overdueTasksCount(tasks: TaskLike[], now: number = Date.now()): number {
    return (tasks || []).filter((t) => {
        if (!t || !t.id) return false;
        if (t.status === 'done') return false;
        if (!t.dueDate) return false;
        return new Date(t.dueDate).getTime() < now;
    }).length;
}

/**
 * Outstanding LEGAL revenue. Definition: Σ line-item totals of
 * Unpaid/Overdue invoices classified as legal-origin. Property-origin
 * invoices (management fees) are excluded — they are property revenue and
 * belong to the property figures, so no money is counted twice.
 */
export function outstandingLegalRevenue(
    invoices: (InvoiceLike & { status?: string })[],
    evidence: { matters?: MatterLike[]; properties?: PropertyLike[] } = {}
): number {
    return (invoices || [])
        .filter((i) => i && (i.status === InvoiceStatus.Unpaid || i.status === InvoiceStatus.Overdue))
        .filter((i) => invoiceBusinessOrigin(i, evidence) === 'legal')
        .reduce((sum, i) => sum + (i.lineItems || []).reduce((s: number, li: any) => s + (li.total || 0), 0), 0);
}

export interface PortfolioPropertyInput extends PropertyLike {
    status?: string | null;
    numberOfUnits?: number | null;
    units?: unknown[];
}

export interface PortfolioUnitTotals {
    /** Property ROWS on record. */
    propertyCount: number;
    /** Σ unitCountBase: every property's declared-or-embedded inventory,
     *  minimum one occupancy per row (an undeclared single-occupancy
     *  property is its own one unit — the R41 rule). */
    managedUnits: number;
    /** Property rows with status 'Occupied'. */
    occupiedProperties: number;
    /** occupiedProperties / propertyCount, rounded to a whole percent
     *  (0 when there are no properties). A PROPERTY-level rate. */
    occupancyRate: number;
}

/** The portfolio's unit/occupancy totals. See interface docs for each. */
export function portfolioUnitTotals(properties: PortfolioPropertyInput[]): PortfolioUnitTotals {
    const rows = (properties || []).filter(Boolean);
    const propertyCount = rows.length;
    const managedUnits = rows.reduce((n, p) => n + unitCountBase(p as { numberOfUnits?: number; units?: unknown[] }), 0);
    const occupiedProperties = rows.filter((p) => p.status === 'Occupied').length;
    const occupancyRate = propertyCount > 0
        ? Math.round((occupiedProperties / propertyCount) * 100)
        : 0;
    return { propertyCount, managedUnits, occupiedProperties, occupancyRate };
}

/**
 * Outstanding RENT. Definition: Σ pending/defaulted tenancy-ledger
 * entries (rent money the property operation is owed), excluding voided
 * and test rows. Management-fee invoices are NOT rent and never enter
 * this figure.
 */
export function outstandingRentLedger(
    ledgerEntries: LedgerEntryLike[],
    propertyIds: string[] = []
): number {
    const ids = new Set(propertyIds.map(String));
    return (ledgerEntries || [])
        .filter((e) => {
            if (!e) return false;
            if (e.recordStatus === 'voided' || e.recordStatus === 'test') return false;
            if (e.status !== 'pending' && e.status !== 'defaulted') return false;
            // Scope to the firm's properties when a list is provided
            // (defensive: the caller normally passes already-scoped rows).
            if (ids.size > 0) {
                return ids.has(String(e.propertyId)) || ids.has(String(e.unitId));
            }
            return true;
        })
        .reduce((sum, e) => sum + (e.amount || 0), 0);
}
