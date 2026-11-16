/**
 * tenancyNoticePeriods — the Nigerian notice-to-quit framework, encoded.
 *
 * R40 (owner direction: "anything we say we have on the site, we should
 * have in the app"): the Atrium site says ARIA "applies the law of the
 * state where each property is located — quit notices included." This
 * util is that mechanism for NOTICE PERIODS — the core of every quit
 * notice:
 *
 *   · The GENERAL framework under Nigeria's Recovery of Premises laws
 *     (the pattern virtually all state statutes follow):
 *         weekly tenancy ......... 1 week's notice
 *         monthly tenancy ........ 1 month's notice
 *         quarterly tenancy ...... 3 months' notice
 *         yearly tenancy ......... 6 months' notice
 *   · LAGOS — the Tenancy Law of Lagos State 2011 is fully encoded in
 *     the legal corpus (convex/legalCorpus.ts, lagos_tenancy_law_2011)
 *     and follows the same periods by tenancy cycle (s. 13).
 *   · Every OTHER state/FCT — the general framework applies as the
 *     starting point, and ARIA verifies the current state statute (web
 *     research) before drafting, because state Recovery of Premises
 *     laws carry local variations. This boundary is honest: the app
 *     computes the framework; the AI confirms the statute.
 */

export type TenancyPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'at-will';

export interface NoticePeriodResult {
    /** The tenancy cycle the notice must match. */
    tenancyPeriod: TenancyPeriod;
    /** Notice length in days (null for at-will — the court decides). */
    days: number | null;
    /** Human label, e.g. "one (1) month's notice". */
    label: string;
    /** Where this figure comes from. */
    basis: 'general framework' | 'lagos_tenancy_law_2011';
    /** Whether the state's current statute should be verified (always
     *  true outside the encoded statutes — local variations exist). */
    verifyStateStatute: boolean;
}

const GENERAL_FRAMEWORK: Record<Exclude<TenancyPeriod, 'at-will'>, { days: number; label: string }> = {
    weekly: { days: 7, label: 'one (1) week\u2019s notice' },
    monthly: { days: 30, label: 'one (1) month\u2019s notice' },
    quarterly: { days: 91, label: 'three (3) months\u2019 notice' },
    yearly: { days: 182, label: 'six (6) months\u2019 notice' },
};

/** States whose tenancy statutes are encoded in the legal corpus. */
export const ENCODED_TENANCY_STATUTES: Record<string, string> = {
    lagos: 'Tenancy Law of Lagos State 2011 (legal corpus: lagos_tenancy_law_2011)',
};

/** Normalize a free-text state name to a corpus key. */
const stateKey = (state: string) => state.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The notice-to-quit period for a tenancy in a given state.
 *
 * `state` is the state the PROPERTY sits in (e.g. "Lagos", "FCT", "Ogun");
 * `period` is the tenancy cycle. For at-will/no-stipulated-period tenancies
 * the law fixes a short notice appropriate to the payment interval — the
 * caller should ask for the payment interval; we surface that instruction.
 */
export function noticeToQuitPeriod(state: string, period: TenancyPeriod): NoticePeriodResult {
    const encoded = ENCODED_TENANCY_STATUTES[stateKey(state)];
    if (period === 'at-will') {
        return {
            tenancyPeriod: period,
            days: null,
            label: 'a notice appropriate to the payment interval (establish the interval first — a notice that understates the required period is invalid)',
            basis: encoded ? 'lagos_tenancy_law_2011' : 'general framework',
            verifyStateStatute: true,
        };
    }
    const row = GENERAL_FRAMEWORK[period];
    return {
        tenancyPeriod: period,
        days: row.days,
        label: row.label,
        basis: encoded ? 'lagos_tenancy_law_2011' : 'general framework',
        verifyStateStatute: !encoded,
    };
}

/** The general framework as a printable table (ARIA's drafting aid). */
export function noticeFrameworkTable(): string {
    return [
        'Weekly tenancy — one (1) week\u2019s notice',
        'Monthly tenancy — one (1) month\u2019s notice',
        'Quarterly tenancy — three (3) months\u2019 notice',
        'Yearly tenancy — six (6) months\u2019 notice',
        'No stipulated period — the law fixes a notice appropriate to the payment interval; establish the interval before drafting',
    ].join('\n');
}


// ─── R3.2 (truth alignment): ONE framework for drafting AND countdowns ──────
//
// The eviction countdown (evictionTracker.ts) previously kept its own
// divergent table (no weekly case, quarterly = 1 month) while the site
// footnote and THIS util advertise weekly 1 week / quarterly 3 months.
// The countdown now delegates here — single source of truth, matching the
// advertised framework exactly.

/** Normalize a free-text rent frequency to a tenancy period.
 *  'Annually'/'yearly' → yearly · 'Bi-Annually'/'6-month' → quarterly
 *  (a half-year tenancy takes a quarter's notice — the classic rule the
 *  old countdown encoded as "3 months", preserved) · 'Quarterly' →
 *  quarterly · 'Monthly' → monthly · 'Weekly'/'week' → weekly · anything
 *  else → yearly (the default the old code applied, most common in Nigeria). */
export function resolveTenancyPeriod(frequency?: string): TenancyPeriod {
    const f = (frequency || '').toLowerCase().trim();
    if (f.includes('week')) return 'weekly';
    // Half-year cycles (Bi-Annually / 6-month) take a quarter's notice —
    // the classic rule the old countdown encoded as "3 months".
    if (f.includes('bi-annu') || f.includes('biannu') || f.includes('6-month') || f.includes('six month') || f.includes('half')) return 'quarterly';
    if (f.includes('quarter')) return 'quarterly';
    if (f.includes('month')) return 'monthly';
    return 'yearly';
}

/** The 36 states + FCT, for pulling the property's state out of a free-text
 *  address ("No. 20 Westsyde Drive, Ogombo, Ajah, Lagos State" → "Lagos"). */
const NIGERIAN_STATES: string[] = [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Federal Capital Territory',
    'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
    'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers',
    'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

/** Extract the Nigerian state from a free-text property address (or '').
 *  Word-boundary matched: 'London' must NOT match Ondo (the substring trap
 *  the R3.2 test caught); 'Ondo State', 'FCT' and full state names do. */
export function extractNigerianState(address?: string): string {
    const a = (address || '');
    if (!a) return '';
    for (const s of NIGERIAN_STATES) {
        const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`\\b${escaped}\\b`, 'i').test(a)) {
            return s === 'Federal Capital Territory' ? 'FCT' : s;
        }
    }
    return '';
}

/** The notice period for a unit, from its raw rent frequency + the property
 *  address (state-aware: Lagos cites its encoded statute). This is the ONE
 *  entry point the eviction countdown uses — no divergent second table. */
export function noticePeriodForUnit(state: string, frequency?: string): NoticePeriodResult {
    return noticeToQuitPeriod(state, resolveTenancyPeriod(frequency));
}
