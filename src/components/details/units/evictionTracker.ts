/**
 * evictionTracker.ts — the statutory eviction state machine (shared).
 * ─────────────────────────────────────────────────────────────────────────
 * MOVED VERBATIM from PropertyDetailView.tsx (Units Console refactor,
 * UNITS_PAGE_REDESIGN.md §4.1) so both the property-level handlers and the
 * per-unit console components share ONE definition with no import cycle.
 *
 * Nigerian Tenancy Law compliant:
 *   none → drafted → served → (countdown expires) → sevenDayDue
 *   superseded: when a fresh notice is generated while a served notice is
 *   active, the old notice transitions to 'superseded' and the countdown
 *   resets. "Served" is the sole statutory milestone — "Mark as Delivered"
 *   was removed by design.
 *
 * R3.2: notice periods come from src/utils/tenancyNoticePeriods.ts — the
 * encoded framework (weekly 1 week · monthly 1 month · quarterly 3 ·
 * yearly 6), state-aware via the property address. The divergent local
 * table is gone; what the UI footnote advertises is what this computes.
 */

import { noticePeriodForUnit, resolveTenancyPeriod, extractNigerianState } from '../../../utils/tenancyNoticePeriods';

export interface EvictionTracker {
    // STATUTORY EVICTION STATE MACHINE (Nigerian Tenancy Law compliant)
    // Streamlined: "Mark as Delivered" removed — "Served" is the sole
    // statutory milestone. Countdown activates on serve.
    //   none → drafted → served → (countdown expires) → sevenDayDue
    //   superseded: when a fresh notice is generated while a served notice
    //   is active, the old notice transitions to 'superseded' and the
    //   countdown resets.
    quitNoticeStatus: 'none' | 'drafted' | 'served' | 'superseded';
    quitNoticeDraftedDate?: number;
    quitNoticeServedDate?: number;
    quitNoticeSupersededDate?: number;
    quitNoticeDocumentId?: string;
    quitNoticeServiceMethod?: string; // 'personal' | 'substituted' | 'registered_post'
    // Countdown — calculated when notice is marked served
    quitNoticeCountdownEndDate?: number; // when the statutory period expires
    sevenDayNoticeStatus: 'none' | 'due' | 'drafted' | 'served' | 'delivered';
    sevenDayNoticeDueDate?: number;
    sevenDayNoticeDraftedDate?: number;
    sevenDayNoticeDocumentId?: string;
    // Audit trail — immutable event log stored on the tracker
    eventLog?: EvictionEvent[];
}

export interface EvictionEvent {
    type: 'drafted' | 'served' | 'superseded' | 'seven_day_issued' | 'seven_day_served' | 'retracted';
    timestamp: number;
    documentId?: string;
    notes?: string;
    actorId?: string;
}

/** Calculate statutory notice period in months based on tenancy frequency.
 *
 * DEPRECATED (R3.2): this table had no weekly case (weekly fell through to
 * the 6-month default) and computed quarterly as 1 month — both diverging
 * from the advertised framework (weekly 1 week · monthly 1 month ·
 * quarterly 3 · yearly 6) and from src/utils/tenancyNoticePeriods.ts, the
 * encoded framework the site footnote cites. Kept ONLY as a compatibility
 * shim for callers that still want months; use getNoticePeriod (below)
 * for anything user-facing — especially countdowns, where the weekly case
 * must compute in DAYS.
 */
export const getNoticePeriodMonths = (frequency?: string): number => {
    const period = resolveTenancyPeriod(frequency);
    if (period === 'weekly') return 0; // weekly periods are expressed in days — use getNoticePeriod
    if (period === 'monthly') return 1;
    if (period === 'quarterly') return 3;
    return 6; // yearly (the default) and at-will
};

/** The statutory notice period for a unit — ONE framework, state-aware.
 *
 * R3.2 (truth alignment): delegates to tenancyNoticePeriods.noticeToQuitPeriod
 * (weekly 1 week · monthly 1 month · quarterly 3 months · yearly 6 months;
 * Lagos cites the encoded Tenancy Law 2011; other states carry the
 * verifyStateStatute flag). The eviction countdown and the served-notice
 * audit notes both use this so the app computes exactly what the UI
 * footnote advertises.
 */
export const getNoticePeriod = (
    frequency: string | undefined,
    propertyAddress?: string
): { days: number | null; label: string; basis: string; verifyStateStatute: boolean; state: string } => {
    const state = extractNigerianState(propertyAddress);
    const result = noticePeriodForUnit(state, frequency);
    return {
        days: result.days,
        label: result.label,
        basis: result.basis,
        verifyStateStatute: result.verifyStateStatute,
        state,
    };
};

/** Countdown end date from the serve date, in the framework's own units
 *  (7 days for weekly; 30/91/182 days for monthly/quarterly/yearly — the
 *  same day counts the encoded framework util is tested against). */
export const getNoticePeriodEndDate = (
    servedDate: number,
    frequency: string | undefined,
    propertyAddress?: string
): { endDate: number; period: ReturnType<typeof getNoticePeriod> } => {
    const period = getNoticePeriod(frequency, propertyAddress);
    const days = period.days ?? 182; // at-will: fall back to the yearly maximum until the interval is established
    return { endDate: servedDate + days * 24 * 60 * 60 * 1000, period };
};

/** Get eviction tracker from a unit's rentalDetails */
export const getEvictionTracker = (unit: any): EvictionTracker => {
    const rd = unit?.rentalDetails || unit;
    return rd?.evictionTracker || { quitNoticeStatus: 'none', sevenDayNoticeStatus: 'none' };
};

/** One calm statutory line for a tracker — replaces the 7-badge wall. */
export const evictionSummaryLine = (t: EvictionTracker): string | null => {
    if (t.quitNoticeStatus === 'none' && t.sevenDayNoticeStatus === 'none') return null;
    const parts: string[] = [];
    if (t.quitNoticeStatus === 'drafted') parts.push('Quit notice drafted');
    if (t.quitNoticeStatus === 'served') {
        parts.push('Quit notice served');
        if (t.quitNoticeServedDate) parts.push(new Date(t.quitNoticeServedDate).toLocaleDateString('en-GB'));
        if (t.quitNoticeCountdownEndDate) {
            const end = t.quitNoticeCountdownEndDate;
            if (Date.now() >= end) parts.push('statutory period expired');
            else parts.push(`statutory period ends ${new Date(end).toLocaleDateString('en-GB')}`);
        }
    }
    if (t.quitNoticeStatus === 'superseded') parts.push('Prior quit notice superseded');
    const sevenDue = t.sevenDayNoticeStatus === 'due' && t.sevenDayNoticeDueDate && Date.now() >= t.sevenDayNoticeDueDate;
    if (sevenDue) parts.push('7-Day Notice due now');
    else if (t.sevenDayNoticeStatus === 'due' && t.sevenDayNoticeDueDate) parts.push(`7-Day Notice qualifies ${new Date(t.sevenDayNoticeDueDate).toLocaleDateString('en-GB')}`);
    if (t.sevenDayNoticeStatus === 'drafted') parts.push('7-Day Notice drafted');
    if (t.sevenDayNoticeStatus === 'served') parts.push('7-Day Notice served');
    if (t.sevenDayNoticeStatus === 'delivered') parts.push('7-Day Notice delivered');
    return parts.join(' · ') || null;
};
