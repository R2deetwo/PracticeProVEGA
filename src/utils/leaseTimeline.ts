/**
 * leaseTimeline — the shared billing-timeline engine for the Units tab.
 *
 * WHY THIS EXISTS (the bugs this locks out):
 *   ServiceChargeBars stepped its pill timeline at the RENT frequency
 *   (`serviceChargeFrequency ?? rentFrequency`) — but no form ever set
 *   serviceChargeFrequency, so units with annual rent (the app default)
 *   produced ONE pill per YEAR. Months passed with zero visual change.
 *   Every computed period also defaulted to `status: 'outstanding'` (the
 *   auto-late engine had been removed), so new periods just added another
 *   red dash until someone hand-opened a drawer and toggled it. The pills
 *   were disconnected from real payment records (rentPaymentHistory from
 *   Collect Rent) and the expanded card's "Payment History" section never
 *   showed rent at all.
 *
 * WHAT THIS ENGINE DOES — "let it do what it claims to do":
 *   1. TIME drives the timeline. Calendar-accurate periods are derived from
 *      leaseStart on every render — each new month adds a period, each
 *      passed window advances its state. No cron, no manual month-chasing.
 *   2. PAYMENTS drive the colors. Recorded payments (rentPaymentHistory or
 *      future payment-shaped records) are matched to period windows; a
 *      matched period turns green (or amber if settled after its window).
 *      Stored scPeriods/mvPeriods statuses remain overrides — manual marks
 *      and receiptNumbers are never lost.
 *   3. STATE IS DERIVED, not stored: an unpaid period is `due` (amber) while
 *      inside its billing window and `overdue` (red) once the window closes.
 *      A `due` chip appears every month until settled — "new service charge
 *      is due" is finally something the UI says out loud.
 *
 * CADENCE RESOLUTION (the 12× trap):
 *   - explicit `serviceChargeFrequency` → its cadence; per-period amount =
 *     the resolved total (amount-first chain) for non-monthly cycles.
 *   - NO explicit frequency (the entire production fleet today) → MONTHLY
 *     cadence. Per-month amount = the explicit monthly rate (the field the
 *     form literally labels "Monthly Service Charge") when defined; when
 *     only a period total exists it is SPREAD across that period's months
 *     (annual total / 12) so monthly pills never inflate 12×.
 *
 * LEGACY STORED PERIODS (cadence migration):
 *   scPeriods rows created under the old annual cadence carry dueDates 12
 *   months apart. Merging by index would smear a "year 2 paid" mark onto
 *   "month 2" of the new monthly grid — so overrides are matched by
 *   DUE DATE first (a legacy annual mark lands on the correct month of
 *   the monthly grid), with index as fallback only when a stored row has
 *   no dueDate.
 */

import { resolveServiceChargeAmount } from './serviceCharge';

// ─── Shared cadence math ────────────────────────────────────────────────────
export const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Frequency label → number of calendar months per billing period.
 *  NOTE ordering: 'bi'/'semi'/'6-month' MUST be checked before 'annual' —
 *  "Bi-Annually" contains "annual" and used to fall into the 12-month branch. */
export function periodMonths(freq?: string): number {
    if (!freq) return 12;
    const f = freq.toLowerCase();
    if (f.includes('bi') || f.includes('6-month') || f.includes('semi')) return 6;
    if (f.includes('year') || f.includes('annual')) return 12;
    if (f.includes('quarter')) return 3;
    if (f.includes('month')) return 1;
    return 12;
}

/** How long after a period's window closes before it displays as overdue. */
export const DEFAULT_GRACE_DAYS = 0;

// ─── Timeline types ─────────────────────────────────────────────────────────
export type PeriodStatus =
    | 'paid'          // settled (stored or payment-matched); paidOnTime flag refines the color
    | 'late'          // settled after its window (stored, or payment-matched late)
    | 'advance_paid'  // pre-paid future cycle (stored)
    | 'due'           // unpaid, inside its own billing window (amber)
    | 'overdue'       // unpaid, window closed past grace (red)
    | 'outstanding';  // legacy stored value — normalized at build time

/** One billing period with its window + derived payment state. */
export interface TimelinePeriod {
    index: number;            // 1-based, monthly-grid position
    dueDate: string;          // ISO date (period start — charge is due)
    windowEnd: string;        // ISO date (period's billing window closes)
    status: PeriodStatus;
    amount: number;           // per-period charge
    paidAmount: number;       // payment-matched total (partial supported)
    paidDate?: string;        // last matched payment date
    paidOnTime?: boolean;     // settled within its window
    isAdvance?: boolean;      // pre-paid future cycle
    receiptNumber?: string;   // preserved from stored overrides
}

/** Payment-shaped record — rentPaymentHistory rows satisfy this today. */
export interface TimelinePayment {
    amount: number;
    paidDate?: string;
    status?: string;
    periodStart?: string;
    periodEnd?: string;
}

export interface TimelineSummary {
    state: 'none' | 'clear' | 'due' | 'overdue';
    /** Periods currently due (unpaid, in window). */
    dueCount: number;
    /** Periods past their window and still unpaid (or marked late). */
    overdueCount: number;
    /** Total unpaid amount across due + overdue periods. */
    outstandingTotal: number;
    /** The most recent unsettled period (due or overdue). */
    currentPeriod: TimelinePeriod | null;
    /** Next period start after the timeline head (when nothing is owed). */
    nextDueDate: string | null;
    /** Month label of the last settled period — "thru Aug 2026". */
    settledThrough: string | null;
}

// ─── Cadence resolution ─────────────────────────────────────────────────────
export interface CadenceResolution {
    /** Months per billing period on the timeline. */
    months: number;
    /** Charge amount for each period on the timeline. */
    perPeriodAmount: number;
    /** Effective frequency label (for drawer headers). */
    frequency: 'Monthly' | 'Quarterly' | 'Bi-Annually' | 'Annually';
    /** True when the unit explicitly chose this cadence. */
    explicit: boolean;
}

const FREQ_BY_MONTHS: Record<number, 'Monthly' | 'Quarterly' | 'Bi-Annually' | 'Annually'> = {
    1: 'Monthly', 3: 'Quarterly', 6: 'Bi-Annually', 12: 'Annually',
};

/**
 * Resolve the SC timeline cadence + per-period amount.
 *
 * explicit frequency  → that cadence; Monthly uses the monthly rate when
 *                       defined (else resolved total); other cycles use the
 *                       resolved total per period (legacy behavior parity).
 * no explicit frequency (production fleet) → MONTHLY cadence; per-month =
 *   monthly rate (form field "Monthly Service Charge") when defined, else
 *   the resolved total spread across the rent-frequency period (annual
 *   total / 12 — never 12× inflated).
 */
export function resolveCadence(args: {
    scFrequency?: string;
    rentFrequency?: string;
    monthlyRate?: number;
    resolvedTotal?: number;
}): CadenceResolution {
    const scFreq = args.scFrequency?.trim();
    if (scFreq) {
        const months = periodMonths(scFreq);
        const rate = Number(args.monthlyRate) || 0;
        const total = Number(args.resolvedTotal) || 0;
        const perPeriodAmount = months === 1
            ? (rate > 0 ? rate : total)
            : total;
        return {
            months,
            perPeriodAmount,
            frequency: FREQ_BY_MONTHS[months] ?? 'Annually',
            explicit: true,
        };
    }
    // No explicit SC frequency — timeline runs monthly. Amount: the monthly
    // rate when the lease declares one; otherwise spread the resolved total
    // (typically an annual/current-period total) across its natural months.
    const rate = Number(args.monthlyRate) || 0;
    const total = Number(args.resolvedTotal) || 0;
    const spreadMonths = periodMonths(args.rentFrequency);
    const perMonth = rate > 0 ? rate : (spreadMonths > 0 ? total / spreadMonths : total);
    return { months: 1, perPeriodAmount: perMonth, frequency: 'Monthly', explicit: false };
}

// ─── Timeline construction ──────────────────────────────────────────────────
/**
 * Build the billing timeline from leaseStart to `now` (calendar-accurate —
 * a Jan 1 monthly start yields Feb 1, Mar 1, ... regardless of month length).
 * Every period whose start ≤ now is included (a charge is DUE at period
 * start); stored overrides attach by dueDate-first matching; payments are
 * matched to windows and settle periods.
 */
export function buildTimeline(args: {
    leaseStart?: string;
    leaseEnd?: string;
    cadence: CadenceResolution;
    stored?: Array<Record<string, any>> | null;
    payments?: TimelinePayment[] | null;
    now?: Date;
    graceDays?: number;
    maxPeriods?: number;
}): TimelinePeriod[] {
    const { cadence, stored, payments, now = new Date(), graceDays = DEFAULT_GRACE_DAYS } = args;
    if (!args.leaseStart) return [];
    const start = new Date(args.leaseStart);
    if (isNaN(start.getTime()) || cadence.perPeriodAmount <= 0) return [];

    const endBoundary = args.leaseEnd && !isNaN(new Date(args.leaseEnd).getTime())
        ? Math.min(now.getTime(), new Date(args.leaseEnd).getTime())
        : now.getTime();
    const nowMs = now.getTime();
    const max = args.maxPeriods ?? 60; // 5 years of monthly pills

    // Stored overrides — dueDate-first (cadence-migration safe), index fallback.
    const storedByDue = new Map<string, Record<string, any>>();
    const storedByIndex = new Map<number, Record<string, any>>();
    for (const s of stored || []) {
        if (s == null) continue;
        const d = typeof s.dueDate === 'string' ? s.dueDate : '';
        if (d) { if (!storedByDue.has(d)) storedByDue.set(d, s); }
        else {
            const idx = Number(s.index) || 0;
            if (idx > 0 && !storedByIndex.has(idx)) storedByIndex.set(idx, s);
        }
    }

    const periods: TimelinePeriod[] = [];
    let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    let idx = 1;
    while (cursor.getTime() <= endBoundary && idx <= max) {
        const dueDate = toDateISO(cursor);
        const windowEndDate = addMonths(cursor, cadence.months);
        // subtract a day so non-monthly windows don't overlap the next start
        const windowEnd = offsetISO(windowEndDate, -1);

        const amount = cadence.perPeriodAmount;
        const matched = matchPayments(payments, dueDate, windowEnd);
        const paidAmount = matched.total;
        const override = storedByDue.get(dueDate) || storedByIndex.get(idx) || null;

        let status: PeriodStatus;
        let paidOnTime: boolean | undefined;
        let paidDate: string | undefined;
        let receiptNumber: string | undefined;
        let isAdvance: boolean | undefined;

        if (override) {
            const os = String(override.status || '');
            paidDate = override.paidDate;
            receiptNumber = override.receiptNumber;
            isAdvance = override.isAdvance;
            if (os === 'paid' || os === 'advance_paid') {
                status = os as PeriodStatus;
                paidOnTime = override.paidOnTime ?? (paidDate ? withinWindow(paidDate, windowEnd) : true);
            } else if (os === 'late') {
                status = 'late';
                paidOnTime = false;
            } else {
                // 'outstanding' (legacy) or anything else unpaid — re-derive
                // from time so stale stored rows don't freeze the strip red.
                ({ status, paidOnTime } = deriveFromTime(nowMs, dueDate, windowEnd, graceDays));
            }
        } else if (paidAmount >= amount * 0.999 && matched.lastPaidDate) {
            status = 'paid';
            paidDate = matched.lastPaidDate;
            paidOnTime = withinWindow(paidDate, windowEnd);
        } else if (paidAmount > 0) {
            // partial — stays in its due/overdue state, paidAmount shown
            ({ status, paidOnTime } = deriveFromTime(nowMs, dueDate, windowEnd, graceDays));
        } else {
            ({ status, paidOnTime } = deriveFromTime(nowMs, dueDate, windowEnd, graceDays));
        }

        periods.push({
            index: idx, dueDate, windowEnd, status, amount,
            paidAmount, paidDate, paidOnTime, isAdvance, receiptNumber,
        });

        cursor = windowEndDate;
        idx++;
    }

    // Stored advance periods beyond the elapsed head (future pre-paid cycles).
    const elapsed = periods.length;
    for (const s of stored || []) {
        const sIdx = Number(s?.index) || 0;
        const isAdv = s && String(s.status) === 'advance_paid' && sIdx > elapsed;
        if (!isAdv) continue;
        const advStart = addMonths(start, (sIdx - 1) * cadence.months);
        periods.push({
            index: sIdx,
            dueDate: toDateISO(advStart),
            windowEnd: offsetISO(addMonths(advStart, cadence.months), -1),
            status: 'advance_paid',
            amount: Number(s.amount) > 0 ? Number(s.amount) : cadence.perPeriodAmount,
            paidAmount: Number(s.amount) || 0,
            paidDate: s.paidDate,
            paidOnTime: true,
            isAdvance: true,
            receiptNumber: s.receiptNumber,
        });
    }
    return periods;
}

// ─── Rent timeline ──────────────────────────────────────────────────────────
/**
 * Rent periods on the rent-frequency cadence, auto-settled from
 * rentPaymentHistory rows (matched by periodStart/periodEnd when present,
 * else by paidDate within the window).
 */
export function buildRentTimeline(args: {
    leaseStart?: string;
    leaseEnd?: string;
    rentFrequency?: string;
    rentAmount?: number;
    payments?: TimelinePayment[] | null;
    now?: Date;
    graceDays?: number;
}): TimelinePeriod[] {
    const amount = Number(args.rentAmount) || 0;
    if (!args.leaseStart || amount <= 0) return [];
    const months = periodMonths(args.rentFrequency);
    return buildTimeline({
        leaseStart: args.leaseStart,
        leaseEnd: args.leaseEnd,
        cadence: { months, perPeriodAmount: amount, frequency: FREQ_BY_MONTHS[months] ?? 'Annually', explicit: false },
        payments: args.payments,
        now: args.now,
        graceDays: args.graceDays,
    });
}

// ─── Summary (drives the readable status chips) ─────────────────────────────
export function summarizeTimeline(periods: TimelinePeriod[], now: Date = new Date()): TimelineSummary {
    // Advance-settled periods that have ALREADY ARRIVED count as settled
    // months (a fully advance-paid unit is CLEAR, not invisible). Only
    // FUTURE pre-paid cycles are excluded from "what's owed right now".
    const nowMs = now.getTime();
    const real = periods.filter(p => {
        if (!p.isAdvance) return true;
        return new Date(p.dueDate).getTime() <= nowMs;
    });
    if (real.length === 0) return {
        state: 'none', dueCount: 0, overdueCount: 0, outstandingTotal: 0,
        currentPeriod: null, nextDueDate: null, settledThrough: null,
    };

    // 'late' is SETTLED (paid after its window) — it is NOT owed anymore.
    // Counting it as unsettled produced "SC 3 MO OVERDUE" chips + inflated
    // outstanding totals on units where every cycle was paid (late) —
    // "it cannot be due if they have paid; late or otherwise".
    const unsettled = real.filter(p => p.status === 'due' || p.status === 'overdue' || p.status === 'outstanding');
    const duePeriods = unsettled.filter(p => p.status === 'due');
    const overduePeriods = unsettled.filter(p => p.status !== 'due');
    const outstandingTotal = unsettled.reduce((sum, p) => sum + Math.max(0, p.amount - p.paidAmount), 0);

    const lastPeriod = real[real.length - 1];
    const nextDueDate = lastPeriod ? toDateISO(addMonths(new Date(lastPeriod.dueDate), 1)) : null;

    let settledThrough: string | null = null;
    for (let i = real.length - 1; i >= 0; i--) {
        // 'late' is settled too — a late payment extends settled-through.
        if (real[i].status === 'paid' || real[i].status === 'advance_paid' || real[i].status === 'late') {
            settledThrough = monthLabel(real[i].dueDate);
            break;
        }
    }

    if (overduePeriods.length > 0) {
        return {
            state: 'overdue', dueCount: duePeriods.length, overdueCount: overduePeriods.length,
            outstandingTotal, currentPeriod: overduePeriods[overduePeriods.length - 1] ?? null,
            nextDueDate, settledThrough,
        };
    }
    if (duePeriods.length > 0) {
        return {
            state: 'due', dueCount: duePeriods.length, overdueCount: 0,
            outstandingTotal, currentPeriod: duePeriods[duePeriods.length - 1] ?? null,
            nextDueDate, settledThrough,
        };
    }
    return {
        state: 'clear', dueCount: 0, overdueCount: 0, outstandingTotal: 0,
        currentPeriod: null, nextDueDate, settledThrough,
    };
}

// ─── Advance payments (pay N cycles ahead — ONE receipt) ────────────────────
/** A stored advance-payment row (what lands in scPeriods / mvPeriods). */
export interface AdvanceRow {
    index: number;
    dueDate: string;
    status: 'advance_paid';
    amount: number;
    paidDate: string;
    paidOnTime: boolean;
    isAdvance: boolean;
    receiptNumber?: string;
}

/**
 * Build the stored rows for an advance payment covering N cycles from an
 * anchor period — "they paid six months in advance" is ONE payment, N
 * cycles, ONE receipt (not six receipts). The anchor itself is settled by
 * the payment (it becomes advance_paid) plus the following N-1 cycles.
 */
export function buildAdvanceRows(args: {
    anchor: TimelinePeriod;
    cycles: number;
    cadence: CadenceResolution;
    paidDate?: string;
}): AdvanceRow[] {
    const cycles = Math.max(1, Math.min(12, Math.round(args.cycles)));
    const today = args.paidDate || new Date().toISOString().split('T')[0];
    const rows: AdvanceRow[] = [];
    for (let k = 0; k < cycles; k++) {
        rows.push({
            index: args.anchor.index + k,
            dueDate: addMonthsISO(args.anchor.dueDate, k * args.cadence.months),
            status: 'advance_paid',
            amount: args.cadence.perPeriodAmount,
            paidDate: today,
            paidOnTime: true,
            isAdvance: true,
        });
    }
    return rows;
}

/** Add months to an ISO date string, calendar-accurate. */
export function addMonthsISO(isoDate: string, months: number): string {
    return toDateISO(addMonths(new Date(isoDate), months));
}

/**
 * Human coverage label for an advance payment — "Sep 2026 – Feb 2027
 * (6 months)" on monthly cadence, "… (2 cycles)" on longer cadences.
 */
export function advanceCoverageLabel(
    anchorDueDate: string,
    cycles: number,
    cadenceMonths: number,
): { from: string; to: string; label: string } {
    const from = monthLabel(anchorDueDate);
    const to = monthLabel(addMonthsISO(anchorDueDate, (Math.max(1, cycles) - 1) * cadenceMonths));
    const unit = cadenceMonths === 1
        ? (cycles === 1 ? 'month' : 'months')
        : (cycles === 1 ? 'cycle' : 'cycles');
    // A single cycle reads "Sep 2026 (1 month)" — no "Sep – Sep".
    const label = from === to
        ? `${from} (${cycles} ${unit})`
        : `${from} – ${to} (${cycles} ${unit})`;
    return { from, to, label };
}

// ─── High-level convenience (used by views) ─────────────────────────────────
/**
 * One-call SC timeline + summary for a unit. Money comes from the Item-2
 * unified resolution (0 is a real value — a resolved 0 short-circuits to an
 * empty timeline); cadence from resolveCadence; stored scPeriods and any
 * payment-shaped records attach as overrides/matches.
 */
export function serviceChargeTimeline(args: {
    unit: Record<string, any>;
    rental?: Record<string, any> | null;
    defaultProperty?: Record<string, any> | null;
    payments?: TimelinePayment[] | null;
    now?: Date;
}): { periods: TimelinePeriod[]; summary: TimelineSummary; cadence: CadenceResolution } {
    const rental = args.rental ?? args.unit?.rentalDetails ?? null;
    const resolved = resolveServiceChargeAmount({
        unit: args.unit, rental, defaultProperty: args.defaultProperty,
    });
    const monthlyRateRaw = rental?.serviceCharge ?? args.unit?.serviceCharge;
    const monthlyRate = Number(monthlyRateRaw) || 0;
    const cadence = resolveCadence({
        scFrequency: rental?.serviceChargeFrequency,
        rentFrequency: rental?.rentFrequency,
        monthlyRate,
        resolvedTotal: resolved,
    });
    const periods = buildTimeline({
        leaseStart: rental?.leaseStart,
        leaseEnd: rental?.leaseEnd,
        cadence,
        stored: rental?.scPeriods,
        payments: args.payments,
        now: args.now,
    });
    return { periods, summary: summarizeTimeline(periods, args.now), cadence };
}

// ─── Formatting helpers (shared by all timeline surfaces) ───────────────────
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Aug 2026" — short month + year, for chips and settled-through labels. */
export function monthLabel(isoDate: string): string {
    try {
        const d = new Date(isoDate);
        return `${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
    } catch { return ''; }
}

/** "Aug" — the 3-letter label under each expanded-history pill. */
export function monthAbbr(isoDate: string): string {
    try {
        return MONTH_ABBR[new Date(isoDate).getMonth()];
    } catch { return ''; }
}

// ─── Internal helpers ───────────────────────────────────────────────────────
function deriveFromTime(nowMs: number, dueDate: string, windowEnd: string, graceDays: number): { status: PeriodStatus; paidOnTime?: boolean } {
    const dueMs = new Date(dueDate).getTime();
    const closeMs = new Date(windowEnd).getTime() + graceDays * MS_PER_DAY;
    if (nowMs > closeMs) return { status: 'overdue' };
    if (nowMs >= dueMs) return { status: 'due' };
    return { status: 'due' }; // not yet due shouldn't occur (only elapsed built) — treat as due
}

function matchPayments(payments: TimelinePayment[] | null | undefined, windowStart: string, windowEnd: string): { total: number; lastPaidDate?: string } {
    let total = 0;
    let lastPaidDate: string | undefined;
    const startMs = new Date(windowStart).getTime();
    const endMs = new Date(windowEnd).getTime();
    for (const p of payments || []) {
        if (!p) continue;
        // Only count settled payments.
        const st = String(p.status || 'paid').toLowerCase();
        if (st === 'pending' || st === 'overdue') continue;
        const amount = Number(p.amount) || 0;
        if (amount <= 0) continue;
        const paid = p.paidDate || p.periodEnd || p.periodStart;
        if (!paid) continue;
        // Primary match: the payment's own declared period (Collect Rent rows
        // carry periodStart/periodEnd) overlapping this window.
        const pStart = p.periodStart ? new Date(p.periodStart).getTime() : NaN;
        const pEnd = p.periodEnd ? new Date(p.periodEnd).getTime() : NaN;
        const overlaps = !isNaN(pStart) && !isNaN(pEnd)
            ? (pStart <= endMs && pEnd >= startMs)
            : false;
        const paidMs = new Date(paid).getTime();
        // Attribution: explicit periodStart/periodEnd is EXCLUSIVE (a Nov
        // charge settled Dec 5 belongs to Nov, paid late). The paidDate-in-
        // window fallback applies only to bare payments with no period fields.
        const inWindow = !overlaps && (isNaN(pStart) || isNaN(pEnd))
            ? (paidMs >= startMs && paidMs <= endMs + 1 * MS_PER_DAY)
            : false;
        if (overlaps || inWindow) {
            total += amount;
            if (!lastPaidDate || paid > lastPaidDate) lastPaidDate = paid;
        }
    }
    return { total, lastPaidDate };
}

function withinWindow(paidDate: string, windowEnd: string): boolean {
    try {
        return new Date(paidDate).getTime() <= new Date(windowEnd).getTime() + MS_PER_DAY;
    } catch { return true; }
}

function addMonths(d: Date, months: number): Date {
    return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
}

function offsetISO(d: Date | string, days: number): string {
    // ALWAYS clone — mutating the caller's Date shifts the timeline cursor
    // (a shared Date object here once silently stepped months backwards).
    const dt = d instanceof Date ? new Date(d.getTime()) : new Date(d);
    dt.setDate(dt.getDate() + days);
    return toDateISO(dt);
}

function toDateISO(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
