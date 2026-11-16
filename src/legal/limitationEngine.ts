/**
 * limitationEngine — statutory limitation periods with SAFE_STOP semantics.
 *
 * PART OF THE ALOA LEGAL ENGINE (deterministic control plane, Pillar 1).
 *
 * WHY THIS EXISTS: limitation analysis was previously advisory prose at
 * best (see ComplianceEngine V5 comments — the old "5 years most states"
 * claim was unverifiable). The engine makes it a computation: the period is
 * read from a typed table, the deadline is calculated from the accrual
 * date, and a time-barred claim triggers a SAFE_STOP that HALTS the
 * drafting/filing recommendation and surfaces the equitable/statutory
 * exceptions for the lawyer — the model is never allowed to guess a
 * limitation period.
 *
 * SEEDING SCOPE + HONESTY: the table is currently seeded for LAGOS and for
 * the federal Public Officers Protection Act. Limitation periods differ by
 * state and by cause of action — when another state is supplied, the result
 * carries a state-verification note and the citation is flagged for
 * confirmation. Pinpoint section numbers are deliberately NOT asserted
 * until the firm verifies them (VERIFY discipline from the rules plan).
 */

export type LimitationCause =
    | 'simple_contract'
    | 'tort'
    | 'specialty_contract'
    | 'land_recovery'
    | 'public_officer_action'
    | 'unknown';

export const LIMITATION_CAUSES: LimitationCause[] = [
    'simple_contract',
    'tort',
    'specialty_contract',
    'land_recovery',
    'public_officer_action',
];

interface LimitationRule {
    cause: LimitationCause;
    years?: number;
    months?: number;
    citation: string;
    verifyNote?: string;
    note?: string;
}

const LAGOS_LIMITATION_CITATION =
    'Limitation Law of Lagos State (Cap. L52, Laws of Lagos State 2003)';
const POPA_CITATION = 'Public Officers Protection Act (federal), s. 2';

/** Equitable / statutory exceptions a lawyer may explore on a time bar. */
const TIME_BAR_EXCEPTIONS = [
    'Fraud or fraudulent concealment of the cause of action',
    'Plaintiff under a legal disability when the cause of action accrued',
    'Acknowledgment or part payment restart considerations',
    'Any statutory extension or leave of court specifically available for this cause of action',
];

const LIMITATION_TABLE: LimitationRule[] = [
    {
        cause: 'simple_contract',
        years: 6,
        citation: LAGOS_LIMITATION_CITATION,
        verifyNote: 'Six (6) years for simple contract in Lagos — confirm the pinpoint provision and check the law of the state where the action will be filed.',
    },
    {
        cause: 'tort',
        years: 6,
        citation: LAGOS_LIMITATION_CITATION,
        verifyNote: 'Six (6) years for tort in Lagos — confirm the pinpoint provision and the applicable state law.',
    },
    {
        cause: 'specialty_contract',
        years: 12,
        citation: LAGOS_LIMITATION_CITATION,
        verifyNote: 'Twelve (12) years for specialty contracts (under seal) in Lagos — confirm the pinpoint provision and the applicable state law.',
    },
    {
        cause: 'land_recovery',
        years: 12,
        citation: LAGOS_LIMITATION_CITATION,
        verifyNote: 'Twelve (12) years for recovery of land in Lagos — confirm the pinpoint provision and the applicable state law.',
    },
    {
        cause: 'public_officer_action',
        months: 3,
        citation: POPA_CITATION,
        note: 'Three (3) months from the act, neglect or default complained of. Several states have equivalent Public Officers Protection Laws with the same window — the defendant\'s status must be confirmed first.',
    },
];

export type LimitationStatus = 'WITHIN_LIMIT' | 'EXPIRING_SOON' | 'TIME_BARRED' | 'NEEDS_REVIEW';

export interface LimitationResult {
    cause: LimitationCause;
    status: LimitationStatus;
    /** ISO date the limitation period expires (empty for NEEDS_REVIEW). */
    limitationDeadline: string;
    /** Whole days from the proposed filing date to the deadline (negative = past). */
    daysRemaining: number;
    period: { years?: number; months?: number };
    citation: string;
    verifyNote?: string;
    note?: string;
    stateNote?: string;
    /** True only on TIME_BARRED — the gate's SAFE_STOP trigger. */
    safeStop: boolean;
    /** Exceptions the lawyer may explore when time-barred. */
    exceptionsToExplore: string[];
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const EXPIRING_SOON_WINDOW_DAYS = 90;

const toDate = (value: string | undefined): Date | null => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

const dayFloor = (d: Date): Date => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
};

/**
 * Compute the limitation position for a claim. Deterministic: the period
 * comes from the table, the dates from the caller — nothing is estimated.
 * `proposedFilingDate` defaults to today. An unknown cause returns
 * NEEDS_REVIEW (never a guessed period).
 */
export function calculateLimitation(input: {
    causeOfAction?: string;
    accrualDate?: string;
    proposedFilingDate?: string;
    state?: string;
}): LimitationResult {
    const cause = (LIMITATION_CAUSES as string[]).includes(input.causeOfAction || '')
        ? (input.causeOfAction as LimitationCause)
        : 'unknown';
    const accrual = toDate(input.accrualDate);
    const filing = dayFloor(toDate(input.proposedFilingDate) || new Date());

    if (cause === 'unknown' || !accrual) {
        return {
            cause,
            status: 'NEEDS_REVIEW',
            limitationDeadline: '',
            daysRemaining: 0,
            period: {},
            citation: '—',
            verifyNote:
                cause === 'unknown'
                    ? 'Cause of action not recognised by the limitation table — the period must be confirmed manually with counsel. The engine never guesses a limitation period.'
                    : 'Accrual date missing — limitation cannot be computed.',
            safeStop: false,
            exceptionsToExplore: [],
            ...(input.state && input.state.toLowerCase() !== 'lagos'
                ? {
                      stateNote: `The table is seeded for Lagos; the limitation position under ${input.state} law must be confirmed.`,
                  }
                : {}),
        };
    }

    const rule = LIMITATION_TABLE.find(r => r.cause === cause)!;
    const deadline = new Date(accrual);
    if (rule.years) deadline.setFullYear(deadline.getFullYear() + rule.years);
    if (rule.months) deadline.setMonth(deadline.getMonth() + rule.months);

    const daysRemaining = Math.round(
        (dayFloor(deadline).getTime() - filing.getTime()) / MS_PER_DAY,
    );

    const status: LimitationStatus =
        daysRemaining < 0 ? 'TIME_BARRED' : daysRemaining <= EXPIRING_SOON_WINDOW_DAYS ? 'EXPIRING_SOON' : 'WITHIN_LIMIT';

    return {
        cause,
        status,
        limitationDeadline: deadline.toISOString().split('T')[0],
        daysRemaining,
        period: rule.years ? { years: rule.years } : { months: rule.months },
        citation: rule.citation,
        ...(rule.verifyNote ? { verifyNote: rule.verifyNote } : {}),
        ...(rule.note ? { note: rule.note } : {}),
        ...(input.state && input.state.toLowerCase() !== 'lagos'
            ? {
                  stateNote: `The table is seeded for Lagos; the limitation position under ${input.state} law must be confirmed.`,
              }
            : {}),
        safeStop: status === 'TIME_BARRED',
        exceptionsToExplore: status === 'TIME_BARRED' ? TIME_BAR_EXCEPTIONS : [],
    };
}
