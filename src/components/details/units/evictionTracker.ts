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
 */

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

/** Calculate statutory notice period in months based on tenancy frequency */
export const getNoticePeriodMonths = (frequency?: string): number => {
    const f = (frequency || '').toLowerCase();
    if (f.includes('year')) return 6;
    if (f.includes('6-month')) return 3;
    if (f.includes('quarter')) return 1;
    if (f.includes('month')) return 1;
    return 6; // Default to 6 months for yearly tenancy (most common in Nigeria)
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
