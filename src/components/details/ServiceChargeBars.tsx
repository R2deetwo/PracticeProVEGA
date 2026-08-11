/**
 * ServiceChargeBars — Interactive status pills for Service Charge (SC)
 * and Minimum Vend (MV).
 *
 * Two display modes controlled by the `expanded` prop:
 *
 * 1. Unexpanded (default — small unit cards):
 *    Renders ONE single primary status pill per charge indicating the unit's
 *    overall standing for the CURRENT billing cycle:
 *      🟢 CLEAR       — current cycle settled on time
 *      🟠 LATE        — current cycle paid late or past due within grace
 *      🟥 OUTSTANDING — current cycle unpaid and past due
 *    No month text is shown — just the status word. Clicking opens the
 *    Quick Payment Drawer for the current period.
 *
 * 2. Expanded (full unit detail):
 *    Renders a horizontal sequence of compact monthly status pills for ALL
 *    elapsed tenancy periods to date:
 *      🟢 Green  = Paid On Time
 *      🟠 Orange = Paid Late (retained permanently in history)
 *                  OR Currently Late (past due & unpaid — auto-flagged)
 *      🔴 Red    = Outstanding (not yet past due)
 *    Each pill is labeled with a month abbreviation (Jan, Feb, Mar...).
 *    Hovering shows a rich tooltip with period details.
 *
 * Automated Late-Status Engine:
 *   When the current calendar date exceeds a period's due date AND no payment
 *   has been logged, the system automatically flags the period as 'late'.
 *   This runs on every render via mergePeriods() — no cron needed.
 *
 * Permanent Historical Record:
 *   Marking a LATE period as PAID settles the balance (allowing receipt
 *   generation) but retains the `paidOnTime: false` flag. The pill stays
 *   orange in the historical timeline (PAID LATE), even though balance is ₦0.
 *
 * Quick Payment Drawer:
 *   A slide-in drawer with 3 toggle buttons (Paid / Late / Outstanding) and
 *   a [Generate & Issue Receipt] prompt. The backdrop is bg-black/60 and
 *   blocks all background pointer events while open.
 *
 * Integration:
 *   Shown on unit cards in PropertyDetailView. The `expanded` prop is wired
 *   to the card's expand/collapse state.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Property, ServiceChargePeriod } from '../../types';
import { formatNairaCompact, formatNairaFull, formatDateShort } from '../../utils/formatting';
import { CalendarIcon, XIcon, CheckCircleIcon, DownloadIcon } from '../../constants';
import ReceiptModal from '../modals/ReceiptModal';
import { useCoreState } from '../../contexts/CoreContext';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';

// ─── Helpers ────────────────────────────────────────────────────────────────
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const periodMonths = (freq?: string): number => {
    if (!freq) return 12;
    const f = freq.toLowerCase();
    if (f.includes('year') || f.includes('annual')) return 12;
    if (f.includes('bi') || f.includes('6-month') || f.includes('semi')) return 6;
    if (f.includes('quarter')) return 3;
    if (f.includes('month')) return 1;
    return 12;
};

const FULL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const getFullMonthYear = (isoDate: string): string => {
    try {
        const d = new Date(isoDate);
        return `${FULL_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
        return '';
    }
};

/**
 * Compute the list of elapsed billing periods from leaseStart to now.
 * Uses calendar-month arithmetic (not fixed 30.44 days) for accurate
 * period boundaries — a Jan 1 start with monthly frequency produces
 * Feb 1, Mar 1, Apr 1... regardless of month length.
 *
 * Historical periods default to 'outstanding' (red). The auto-late engine
 * from the previous round has been removed per the latest brief: historical
 * periods are RED until explicitly marked as paid/late during onboarding.
 */
function computeElapsedPeriods(
    leaseStart: string,
    leaseEnd: string | undefined,
    frequency: string | undefined,
    perPeriodAmount: number,
): ServiceChargePeriod[] {
    if (!leaseStart) return [];
    const start = new Date(leaseStart);
    if (isNaN(start.getTime())) return [];
    const now = new Date();
    const endBoundary = leaseEnd ? new Date(Math.min(now.getTime(), new Date(leaseEnd).getTime())) : now;
    const periodM = periodMonths(frequency);

    const periods: ServiceChargePeriod[] = [];
    let periodStart = new Date(start);
    let idx = 1;
    // Safety cap: never render more than 60 periods (5 years of monthly).
    while (periodStart < endBoundary && idx <= 60) {
        const dueDate = periodStart.toISOString().split('T')[0];
        periods.push({
            index: idx,
            dueDate,
            status: 'outstanding', // default: red — user marks as paid during onboarding
            amount: perPeriodAmount,
        });
        // Advance by calendar months (not fixed days) for accurate boundaries
        periodStart = new Date(periodStart.getFullYear(), periodStart.getMonth() + periodM, periodStart.getDate());
        idx++;
    }
    return periods;
}

/**
 * Compute advance pre-paid periods — future cycles that the tenant has
 * paid for ahead of time. These are stored periods with status='advance_paid'
 * whose index exceeds the elapsed period count. They appear as blue pills
 * after the historical elapsed pills.
 *
 * Example: 6 months elapsed + 2 months paid in advance = 8 pills total
 * (6 historical + 2 blue advance pills).
 */
function computeAdvancePeriods(
    elapsedCount: number,
    leaseStart: string,
    frequency: string | undefined,
    perPeriodAmount: number,
    stored: ServiceChargePeriod[] | undefined,
): ServiceChargePeriod[] {
    if (!leaseStart || !stored || stored.length === 0) return [];
    const advanceStored = stored.filter(p => p.status === 'advance_paid' && p.index > elapsedCount);
    if (advanceStored.length === 0) return [];

    const start = new Date(leaseStart);
    const periodM = periodMonths(frequency);

    return advanceStored.map(s => {
        // Calculate the due date for this future period
        const futureStart = new Date(start.getFullYear(), start.getMonth() + (s.index - 1) * periodM, start.getDate());
        return {
            index: s.index,
            dueDate: futureStart.toISOString().split('T')[0],
            status: 'advance_paid' as const,
            paidDate: s.paidDate,
            amount: s.amount || perPeriodAmount,
            isAdvance: true,
        };
    });
}

/**
 * Merge computed periods with stored status data.
 *
 * Per the latest brief, historical periods default to 'outstanding' (red)
 * — the auto-late engine has been removed. Only explicitly stored statuses
 * override the default.
 *
 * Advance pre-paid periods (status='advance_paid', index > elapsed count)
 * are appended after the historical elapsed periods.
 */
function mergePeriods(
    computed: ServiceChargePeriod[],
    stored: ServiceChargePeriod[] | undefined,
): ServiceChargePeriod[] {
    if (!stored || stored.length === 0) {
        // No stored data — all historical periods default to 'outstanding' (red)
        return computed;
    }
    const storedMap = new Map(stored.map(p => [p.index, p]));
    const merged = computed.map(p => {
        const s = storedMap.get(p.index);
        if (s) {
            // Stored record exists — use its status + paidOnTime flag
            return { ...p, status: s.status, paidDate: s.paidDate, paidOnTime: s.paidOnTime, isAdvance: s.isAdvance };
        }
        // No stored record — keep as 'outstanding' (red) for historical periods
        return p;
    });

    // Append advance pre-paid periods (future cycles beyond elapsed count)
    const advancePeriods = computeAdvancePeriods(
        computed.length,
        computed[0]?.dueDate || '',
        undefined, // frequency is passed by the caller via stored amounts
        computed[0]?.amount || 0,
        stored,
    );
    return [...merged, ...advancePeriods];
}

// ─── Status colors & metadata ───────────────────────────────────────────────
// Note: a 'paid' period with paidOnTime=false is displayed as ORANGE (Paid Late)
// in the historical timeline, even though its balance is ₦0. This is the
// "permanent historical record" behavior the user requested.
interface StatusMeta {
    pill: string;       // pill background color
    hover: string;      // hover state
    label: string;      // text color for status label
    bg: string;         // soft background for drawer status box
    name: string;       // human-readable name
    description: string;// long-form description for tooltip
}

const getStatusMeta = (period: ServiceChargePeriod): StatusMeta => {
    if (period.status === 'paid') {
        if (period.paidOnTime === false) {
            // Paid Late — orange pill, balance settled but history retained
            return {
                pill: 'bg-amber-500',
                hover: 'hover:bg-amber-600',
                label: 'text-amber-600 dark:text-amber-400',
                bg: 'bg-amber-50 dark:bg-amber-900/20',
                name: 'Paid Late',
                description: `Settled on ${period.paidDate ? formatDateShort(period.paidDate) : '—'} (after due date)`,
            };
        }
        // Paid On Time — green pill
        return {
            pill: 'bg-emerald-500',
            hover: 'hover:bg-emerald-600',
            label: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-50 dark:bg-emerald-900/20',
            name: 'Paid On Time',
            description: `Settled on ${period.paidDate ? formatDateShort(period.paidDate) : '—'}`,
        };
    }
    if (period.status === 'late') {
        // Currently late (past due & unpaid) OR explicitly marked late
        return {
            pill: 'bg-amber-500',
            hover: 'hover:bg-amber-600',
            label: 'text-amber-600 dark:text-amber-400',
            bg: 'bg-amber-50 dark:bg-amber-900/20',
            name: 'Late',
            description: period.paidDate
                ? `Settled on ${formatDateShort(period.paidDate)} (after due date)`
                : 'Past due date — unpaid',
        };
    }
    if (period.status === 'advance_paid') {
        // Advance Paid — blue pill, settled ahead of future billing date
        return {
            pill: 'bg-blue-500',
            hover: 'hover:bg-blue-600',
            label: 'text-blue-600 dark:text-blue-400',
            bg: 'bg-blue-50 dark:bg-blue-900/20',
            name: 'Advance Paid',
            description: `Pre-paid on ${period.paidDate ? formatDateShort(period.paidDate) : '—'} (future cycle)`,
        };
    }
    // Outstanding — red pill (default for historical periods until marked)
    return {
        pill: 'bg-red-500',
        hover: 'hover:bg-red-600',
        label: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-900/20',
        name: 'Outstanding',
        description: 'Unpaid — past due',
    };
};

// ─── Rich Hover Tooltip (Portal-rendered to avoid clipping) ─────────────────
// The tooltip is rendered via React Portal at document.body level, so it
// floats above ALL card containers — even those with overflow-hidden. The
// parent card's overflow clipping was causing the tooltip text to be cut off
// (e.g. "o log payment" instead of "Click to log payment").
//
// Positioning: we measure the pill's bounding rect on hover and position the
// tooltip centered above it. A re-measure runs on window scroll/resize.
interface PillTooltipProps {
    period: ServiceChargePeriod;
    chargeType: 'SC' | 'MV';
    targetRef: React.RefObject<HTMLElement>;
}

const PillTooltip: React.FC<PillTooltipProps> = ({ period, chargeType, targetRef }) => {
    const meta = getStatusMeta(period);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
        const measure = () => {
            const el = targetRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            // Center the tooltip (w-56 = 224px) above the pill.
            // If the pill is near the top of the viewport, flip below.
            const tooltipWidth = 224;
            const left = rect.left + rect.width / 2 - tooltipWidth / 2;
            // Clamp to viewport so the tooltip never overflows horizontally
            const clampedLeft = Math.max(8, Math.min(window.innerWidth - tooltipWidth - 8, left));
            const showBelow = rect.top < 200; // near top → flip below
            const top = showBelow ? rect.bottom + 8 : rect.top - 8;
            setPos({ top, left: clampedLeft });
        };
        measure();
        window.addEventListener('scroll', measure, true);
        window.addEventListener('resize', measure);
        return () => {
            window.removeEventListener('scroll', measure, true);
            window.removeEventListener('resize', measure);
        };
    }, [targetRef]);

    if (!pos) return null;

    return createPortal(
        <div
            className="fixed w-56 p-3 rounded-lg bg-slate-900 dark:bg-zinc-800 text-white shadow-xl z-[9999] pointer-events-none animate-in fade-in zoom-in-95 duration-150"
            style={{ top: pos.top, left: pos.left }}
        >
            <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                    <CalendarIcon className="w-3 h-3 text-slate-400" />
                    <span className="text-2xs font-bold text-slate-300 uppercase tracking-wider">
                        {getFullMonthYear(period.dueDate)}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-2xs text-slate-400 w-12">Amount</span>
                    <span className="text-sm font-bold text-white">{formatNairaCompact(period.amount)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-2xs text-slate-400 w-12">Status</span>
                    <span className={`text-xs font-bold ${meta.label}`}>{meta.name}</span>
                </div>
                <p className="text-2xs text-slate-400 italic">{meta.description}</p>
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-700/50">
                    <DownloadIcon className="w-3 h-3 text-emerald-400" />
                    <span className="text-2xs font-bold text-emerald-400">
                        {period.status === 'paid' ? 'View/Issue Receipt' : 'Click to log payment'}
                    </span>
                </div>
            </div>
        </div>,
        document.body,
    );
};

// ─── Quick Payment Drawer ───────────────────────────────────────────────────
interface QuickPaymentDrawerProps {
    period: ServiceChargePeriod | null;
    chargeType: 'SC' | 'MV';
    unitName: string;
    /** Full list of elapsed periods — rendered as a historical pill strip
     *  at the top of the drawer, above the Charge Amount. Clicking a pill
     *  switches the drawer's focus to that period. */
    allPeriods: ServiceChargePeriod[];
    onClose: () => void;
    onStatusChange: (status: 'paid' | 'late' | 'outstanding' | 'advance_paid') => void;
    onGenerateReceipt: () => void;
    /** Switch the drawer's focus to a different period in the historical strip. */
    onPeriodSelect: (period: ServiceChargePeriod) => void;
}

const QuickPaymentDrawer: React.FC<QuickPaymentDrawerProps> = ({
    period, chargeType, unitName, allPeriods, onClose, onStatusChange, onGenerateReceipt, onPeriodSelect,
}) => {
    if (!period) return null;
    const meta = getStatusMeta(period);

    return (
        <>
            {/* Backdrop — fixed inset-0, dark overlay (bg-black/60 per spec).
                pointer-events-auto catches ALL background interactions so they
                don't bleed through to underlying unit cards. onClick closes
                the drawer. */}
            <div
                className="fixed inset-0 z-[4500] bg-black/60 sm:backdrop-blur-sm pointer-events-auto"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                aria-hidden="true"
            />
            {/* Drawer — slides in from the right.
                z-[4501] sits above the backdrop. pointer-events-auto explicitly
                enables interaction on the drawer itself.
                CRITICAL: onClick + onMouseDown stopPropagation prevents clicks
                inside the drawer from bleeding through to the backdrop (which
                would close the drawer) or to background unit cards (which
                would trigger accidental card expansions). */}
            <div
                className="fixed top-0 right-0 bottom-0 z-[4501] w-full sm:max-w-md bg-white dark:bg-zinc-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 pointer-events-auto"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex-shrink-0">
                    <div>
                        <p className="text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                            {chargeType} · {getFullMonthYear(period.dueDate)}
                        </p>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">
                            Quick Payment
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                            {unitName} · Due {formatDateShort(period.dueDate)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* ── Historical Pill Strip ──────────────────────────────
                        Renders the full timeline of elapsed periods at the top
                        of the drawer, above the Charge Amount. Each pill is a
                        slim color-only bar (no text). Clicking a pill switches
                        the drawer's focus to that period — updating the amount,
                        status, and receipt prompt below. */}
                    {allPeriods.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                                Payment History · {allPeriods.length} period{allPeriods.length === 1 ? '' : 's'}
                            </p>
                            <div className="flex items-center gap-1 flex-wrap p-2 bg-slate-50 dark:bg-zinc-800/60 rounded-lg border border-slate-100 dark:border-zinc-700/60">
                                {allPeriods.map(p => {
                                    const m = getStatusMeta(p);
                                    const isActive = p.index === period.index;
                                    return (
                                        <button
                                            key={p.index}
                                            onClick={() => onPeriodSelect(p)}
                                            title={`${getFullMonthYear(p.dueDate)} — ${m.name}`}
                                            className={`h-2 w-7 rounded-full ${m.pill} transition-all cursor-pointer ${
                                                isActive
                                                    ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-zinc-800 ring-slate-400 scale-110'
                                                    : 'opacity-80 hover:opacity-100 hover:scale-105'
                                            }`}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Amount — single Naira symbol via formatNairaCompact (which
                        already injects ₦). No hardcoded ₦ prefix here. */}
                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-700/60">
                        <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                            Charge Amount
                        </p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">
                            {formatNairaCompact(period.amount)}
                        </p>
                    </div>

                    {/* Current status */}
                    <div className={`p-3 rounded-lg ${meta.bg} border border-transparent`}>
                        <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                            Current Status
                        </p>
                        <p className={`text-sm font-black uppercase ${meta.label}`}>
                            {meta.name}
                        </p>
                        <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-1">
                            {meta.description}
                        </p>
                    </div>

                    {/* Toggle buttons — 4 states: Paid On Time, Paid Late, Outstanding, Advance Paid */}
                    <div>
                        <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                            Change Status
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {(['paid', 'late', 'outstanding', 'advance_paid'] as const).map(s => {
                                // For the toggle button highlight, 'paid' with paidOnTime=false
                                // should highlight the 'paid' button (balance is settled).
                                const isActive = period.status === s;
                                const colorClass =
                                    s === 'paid' ? 'bg-emerald-500' :
                                    s === 'late' ? 'bg-amber-500' :
                                    s === 'advance_paid' ? 'bg-blue-500' :
                                    'bg-red-500';
                                const labelName =
                                    s === 'paid' ? 'Paid On Time' :
                                    s === 'late' ? 'Paid Late' :
                                    s === 'advance_paid' ? 'Advance Paid' :
                                    'Outstanding';
                                return (
                                    <button
                                        key={s}
                                        onClick={() => onStatusChange(s)}
                                        className={`px-3 py-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all border-2 ${
                                            isActive
                                                ? `${colorClass} text-white border-transparent shadow-md`
                                                : `bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600`
                                        }`}
                                    >
                                        {labelName}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-2xs text-slate-400 mt-2 italic">
                            Marking a late period as Paid settles the balance but retains the
                            &ldquo;Paid Late&rdquo; flag in the historical timeline.
                        </p>
                    </div>

                    {/* Receipt prompt — shown when status is 'paid' (balance settled).
                        Dynamic button toggle:
                        - No receipt issued → [Generate Receipt]
                        - Receipt already issued → [View Issued Receipt] */}
                    {period.status === 'paid' && (
                        <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex items-start gap-3">
                                <div className="p-1.5 bg-emerald-600 text-white rounded-lg flex-shrink-0">
                                    <CheckCircleIcon className="w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                                        Payment Recorded{period.paidOnTime === false ? ' (Late)' : ''}
                                    </p>
                                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                                        {period.receiptNumber
                                            ? `Receipt ${period.receiptNumber} already issued for this ${chargeType} payment.`
                                            : `Generate an itemized receipt for this ${chargeType} payment.`}
                                    </p>
                                    <button
                                        onClick={onGenerateReceipt}
                                        className={`mt-3 inline-flex items-center gap-2 px-4 py-2 text-white text-xs font-bold rounded-lg shadow-sm transition-colors ${
                                            period.receiptNumber
                                                ? 'bg-slate-600 hover:bg-slate-700'
                                                : 'bg-emerald-600 hover:bg-emerald-700'
                                        }`}
                                    >
                                        {period.receiptNumber ? (
                                            <>
                                                <DownloadIcon className="w-3.5 h-3.5" />
                                                View Issued Receipt
                                            </>
                                        ) : (
                                            <>
                                                <DownloadIcon className="w-3.5 h-3.5" />
                                                Generate Receipt
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

// ─── Status Pill (slim color-only bar with portal tooltip) ──────────────────
// Renders a slim color-only bar (h-2 w-7 rounded-full) — NO text label.
// Pure color encoding: Green=Paid On Time, Orange=Paid Late/Currently Late,
// Red=Outstanding. Hover shows a portal-rendered tooltip that floats above
// all card containers (avoids overflow clipping).
interface StatusPillProps {
    period: ServiceChargePeriod;
    chargeType: 'SC' | 'MV';
    onClick: () => void;
}

const StatusPill: React.FC<StatusPillProps> = ({ period, chargeType, onClick }) => {
    const [hovered, setHovered] = useState(false);
    const meta = getStatusMeta(period);
    const pillRef = useRef<HTMLButtonElement>(null);

    return (
        <div
            className="relative inline-block"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <motion.button
                ref={pillRef}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className={`h-2 w-7 rounded-full ${meta.pill} ${meta.hover} transition-all hover:scale-110 hover:shadow-sm cursor-pointer origin-left`}
                aria-label={`${meta.name} — ${getFullMonthYear(period.dueDate)}`}
            />
            {hovered && pillRef.current && (
                <PillTooltip period={period} chargeType={chargeType} targetRef={pillRef} />
            )}
        </div>
    );
};

// ─── Primary Status Pill (for unexpanded cards) ─────────────────────────────
// Renders ONE single slim color-only bar showing the unit's overall standing
// for the CURRENT billing cycle. NO text label — pure color encoding:
//   Green  = Clear (current cycle settled on time)
//   Orange = Late (current cycle paid late or past due)
//   Red    = Outstanding (current cycle unpaid and past due)
// Clicking opens the Quick Payment Drawer for the current (most recent) period.
interface PrimaryStatusPillProps {
    periods: ServiceChargePeriod[];
    chargeType: 'SC' | 'MV';
    onClick: (period: ServiceChargePeriod) => void;
}

const PrimaryStatusPill: React.FC<PrimaryStatusPillProps> = ({ periods, chargeType, onClick }) => {
    const [hovered, setHovered] = useState(false);
    const pillRef = useRef<HTMLButtonElement>(null);
    if (periods.length === 0) return null;

    // The "current" period is the most recent elapsed period (last in the array).
    const currentPeriod = periods[periods.length - 1];

    // Map the detailed status to the 3-bucket primary color:
    // - paid + paidOnTime=true  → green (Clear)
    // - paid + paidOnTime=false → orange (Late — settled but was late)
    // - late (auto or manual)   → orange (Late)
    // - advance_paid            → blue (Advance Paid)
    // - outstanding             → red (Outstanding)
    let primaryColor: string;
    let primaryLabel: string; // kept for aria-label + tooltip only, not rendered
    if (currentPeriod.status === 'paid' && currentPeriod.paidOnTime === true) {
        primaryColor = 'bg-emerald-500 hover:bg-emerald-600';
        primaryLabel = 'Clear';
    } else if (
        (currentPeriod.status === 'paid' && currentPeriod.paidOnTime === false) ||
        currentPeriod.status === 'late'
    ) {
        primaryColor = 'bg-amber-500 hover:bg-amber-600';
        primaryLabel = 'Late';
    } else if (currentPeriod.status === 'advance_paid') {
        primaryColor = 'bg-blue-500 hover:bg-blue-600';
        primaryLabel = 'Advance Paid';
    } else {
        primaryColor = 'bg-red-500 hover:bg-red-600';
        primaryLabel = 'Outstanding';
    }

    return (
        <div
            className="relative inline-block"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <button
                ref={pillRef}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick(currentPeriod);
                }}
                className={`h-2 w-7 rounded-full ${primaryColor} transition-all hover:scale-110 hover:shadow-sm cursor-pointer`}
                aria-label={`${chargeType} — ${primaryLabel}`}
            />
            {hovered && pillRef.current && (
                <PillTooltip period={currentPeriod} chargeType={chargeType} targetRef={pillRef} />
            )}
        </div>
    );
};

// ─── Main Component ─────────────────────────────────────────────────────────
interface ServiceChargeBarsProps {
    /** The unit (Property) to render pills for. */
    unit: Property;
    /** Called when period status changes, with the updated rentalDetails. */
    onUpdate: (updatedRentalDetails: Property['rentalDetails']) => void;
    /** Callback to generate a receipt for a paid period. */
    onGenerateReceipt?: (period: ServiceChargePeriod, chargeType: 'SC' | 'MV') => void;
    /** When true (expanded card), shows the full multi-period history pills.
     *  When false (unexpanded card), shows a single primary status pill
     *  (CLEAR / LATE / OUTSTANDING) for the current billing cycle. */
    expanded?: boolean;
}

export const ServiceChargeBars: React.FC<ServiceChargeBarsProps> = ({ unit, onUpdate, onGenerateReceipt, expanded = false }) => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState<ServiceChargePeriod | null>(null);
    const [selectedChargeType, setSelectedChargeType] = useState<'SC' | 'MV'>('SC');
    const [receiptModalOpen, setReceiptModalOpen] = useState(false);

    // Convex mutations + context for zero-touch receipt automation
    const { coreState } = useCoreState();
    const { currentUser } = useAuth();
    const { addToast } = useUI();
    const sendPortalMessage = useMutation(api.portals.sendPortalMessage);
    const logAutomation = useMutation(api.sentry.logAutomation);

    const rental = (unit.rentalDetails || unit) as Property['rentalDetails'];
    const leaseStart = rental?.leaseStart || '';
    const leaseEnd = rental?.leaseEnd;
    const rentFrequency = rental?.rentFrequency;
    // SC frequency: use serviceChargeFrequency if set, otherwise fall back
    // to rentFrequency. This fixes the bug where monthly SC was stepping
    // yearly because it used the rent frequency (which might be Annual).
    const scFrequency = rental?.serviceChargeFrequency ?? rentFrequency;

    // Property-level minimum vend config
    const mvEnabled = (unit as any).minimumVendEnabled || false;
    const mvAmount = Number((unit as any).minimumVendAmount || 0);
    const mvLabel = (unit as any).minimumVendLabel || 'Min Vend';

    // SC amount
    const scAmount = Number(rental?.serviceChargeAmount ?? rental?.serviceCharge ?? 0);

    // Compute periods — SC uses its own frequency (with rent fallback),
    // MV uses rent frequency (no separate MV frequency field exists yet).
    const scPeriods = useMemo(
        () => mergePeriods(computeElapsedPeriods(leaseStart, leaseEnd, scFrequency, scAmount), rental?.scPeriods),
        [leaseStart, leaseEnd, scFrequency, scAmount, rental?.scPeriods],
    );
    const mvPeriods = useMemo(
        () => mergePeriods(computeElapsedPeriods(leaseStart, leaseEnd, rentFrequency, mvAmount), rental?.mvPeriods),
        [leaseStart, leaseEnd, rentFrequency, mvAmount, rental?.mvPeriods],
    );

    const handleBarClick = useCallback((period: ServiceChargePeriod, chargeType: 'SC' | 'MV') => {
        setSelectedPeriod(period);
        setSelectedChargeType(chargeType);
        setDrawerOpen(true);
    }, []);

    // ── Zero-Touch Receipt Automation ────────────────────────────────────
    // When a payment is marked as 'paid', 'late', or 'advance_paid', this
    // function automatically:
    //   1. Generates a receipt number
    //   2. Publishes the receipt to the resident's portal (sendPortalMessage)
    //   3. Writes an immutable activity log entry (logAutomation)
    //   4. Persists the receipt number to the period (via onUpdate)
    //
    // This eliminates the manual "Generate Receipt" → "Issue to Resident"
    // multi-click flow. The user can still click [View Issued Receipt] in
    // the drawer to preview/download the PDF.
    const autoIssueReceipt = useCallback(async (
        period: ServiceChargePeriod,
        chargeType: 'SC' | 'MV',
        periodsKey: 'scPeriods' | 'mvPeriods',
    ) => {
        try {
            const firmId = coreState?.firmDetails?.id || currentUser?.firmId || '';
            const tenantName = rental?.tenantName || 'Resident';
            const unitName = rental?.unitName || unit.description || 'Unit';
            const chargeTypeLabel = chargeType === 'SC' ? 'Service Charge' : 'Minimum Vend';
            const billingPeriod = (() => {
                try { return new Date(period.dueDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
                catch { return `Period ${period.index}`; }
            })();
            const receiptNumber = `RC-${Date.now().toString().slice(-6)}-${period.index}`;
            const settlementMethod = period.paidOnTime === false ? 'Paid Late' :
                                      period.isAdvance ? 'Advance Payment' : 'Paid On Time';

            // 1. Publish receipt to resident's portal
            await sendPortalMessage({
                firmId,
                senderId: currentUser?.id || '',
                senderName: currentUser?.name || 'Property Manager',
                senderRole: 'admin',
                subject: `Receipt ${receiptNumber} — ${chargeTypeLabel} (${billingPeriod})`,
                content: `Your ${chargeTypeLabel} receipt for ${billingPeriod} has been automatically issued.\n\nReceipt No: ${receiptNumber}\nAmount Paid: ${formatNairaFull(period.amount)}\nPayment Date: ${formatDateShort(period.paidDate || new Date().toISOString().split('T')[0])}\nSettlement: ${settlementMethod}\n\nThis receipt was auto-generated when your payment was logged by management.`,
                unitId: unit.id,
            } as any);

            // 2. Write immutable activity log
            await logAutomation({
                firmId,
                unitId: unit.id,
                messageType: 'receipt_issued',
                channel: 'portal',
                recipient: tenantName,
                messagePreview: `Receipt #${receiptNumber} auto-issued to ${tenantName} for ${chargeTypeLabel} (${billingPeriod})`,
                messageContent: `Receipt #${receiptNumber} auto-issued to ${tenantName} for ${chargeTypeLabel} (${billingPeriod}). Amount: ${formatNairaFull(period.amount)}. Settlement: ${settlementMethod}.`,
                direction: 'outbound',
                senderName: currentUser?.name || 'Property Manager',
                status: 'sent',
                triggeredBy: currentUser?.id,
            } as any);

            // 3. Persist receipt number to the period
            const currentPeriods = (rental?.[periodsKey] as ServiceChargePeriod[]) || [];
            const updatedPeriods = currentPeriods.map(p =>
                p.index === period.index ? { ...p, receiptNumber } : p
            );
            const updatedRental = {
                ...rental,
                [periodsKey]: updatedPeriods,
            } as Property['rentalDetails'];
            onUpdate(updatedRental!);

            // 4. Toast confirmation
            addToast(`Receipt ${receiptNumber} auto-issued to ${tenantName}'s portal.`, { type: 'success' });
        } catch (err: any) {
            console.warn('Auto-receipt issuance failed:', err);
            addToast('Payment logged, but receipt auto-issuance failed. Use [Generate Receipt] manually.', { type: 'info' });
        }
    }, [coreState, currentUser, rental, unit, sendPortalMessage, logAutomation, onUpdate, addToast]);

    const handleStatusChange = useCallback((newStatus: 'paid' | 'late' | 'outstanding' | 'advance_paid') => {
        if (!selectedPeriod) return;
        const periodsKey = selectedChargeType === 'SC' ? 'scPeriods' : 'mvPeriods';
        const currentPeriods = (rental?.[periodsKey] as ServiceChargePeriod[]) || [];
        const updatedPeriods = [...currentPeriods];
        const existingIdx = updatedPeriods.findIndex(p => p.index === selectedPeriod.index);

        // Determine paidOnTime flag based on USER INTENT (not auto-calculated):
        // - 'paid' (user clicked "Paid On Time") → paidOnTime = TRUE (green pill)
        // - 'late' (user clicked "Paid Late") → paidOnTime = FALSE (orange pill)
        // - 'advance_paid' → paidOnTime = TRUE (blue pill, pre-paid)
        // - 'outstanding' → clear the flag
        //
        // CRITICAL FIX: The previous code auto-calculated paidOnTime by comparing
        // today's date to the due date. This meant clicking "Paid On Time" on a
        // past-due period would silently override the user's intent and set
        // paidOnTime=false → orange pill instead of green. Now we respect the
        // user's explicit selection.
        let paidOnTime: boolean | undefined;
        const todayIso = new Date().toISOString().split('T')[0];
        if (newStatus === 'paid') {
            paidOnTime = true;  // User explicitly marked as Paid On Time → green
        } else if (newStatus === 'late') {
            paidOnTime = false; // User explicitly marked as Paid Late → orange
        } else if (newStatus === 'advance_paid') {
            paidOnTime = true;  // Advance payment is always "on time" (pre-paid)
        } else {
            paidOnTime = undefined; // Outstanding → clear flag
        }

        const updated: ServiceChargePeriod = {
            ...selectedPeriod,
            status: newStatus,
            paidDate: newStatus === 'paid' || newStatus === 'late' || newStatus === 'advance_paid' ? todayIso : undefined,
            paidOnTime,
            isAdvance: newStatus === 'advance_paid' ? true : undefined,
        };

        if (existingIdx >= 0) {
            updatedPeriods[existingIdx] = updated;
        } else {
            updatedPeriods.push(updated);
            updatedPeriods.sort((a, b) => a.index - b.index);
        }

        // Update the aggregate serviceChargeStatus based on all periods.
        // A period counts as "settled" if its balance is ₦0 (status === 'paid'
        // regardless of paidOnTime, or 'advance_paid'). 'late' without a
        // paidDate is still unpaid. 'outstanding' is unpaid.
        const allSettled = updatedPeriods.every(p => p.status === 'paid' || p.status === 'advance_paid');
        const anyUnsettled = updatedPeriods.some(p =>
            p.status === 'outstanding' || (p.status === 'late' && !p.paidDate)
        );
        let aggregateStatus: 'PAID_FULLY' | 'PARTIALLY_PAID' | 'UNPAID' = 'UNPAID';
        if (allSettled) aggregateStatus = 'PAID_FULLY';
        else if (anyUnsettled && updatedPeriods.some(p => p.status === 'paid' || p.status === 'advance_paid')) aggregateStatus = 'PARTIALLY_PAID';
        else if (anyUnsettled) aggregateStatus = 'UNPAID';
        else aggregateStatus = 'PARTIALLY_PAID';

        const updatedRental = {
            ...rental,
            [periodsKey]: updatedPeriods,
            // Only update aggregate SC status (not MV — MV doesn't have an aggregate field)
            ...(selectedChargeType === 'SC' ? { serviceChargeStatus: aggregateStatus } : {}),
        } as Property['rentalDetails'];
        onUpdate(updatedRental!);
        // Update the selected period in the drawer so the UI reflects the new status
        setSelectedPeriod(updated);

        // ── ZERO-TOUCH RECEIPT AUTOMATION ───────────────────────────────
        // When a payment is settled (paid / late / advance_paid), automatically
        // issue the receipt to the resident's portal + activity log. This
        // eliminates the manual "Generate Receipt" → "Issue to Resident"
        // multi-click flow. Skip if a receipt was already issued for this period.
        if ((newStatus === 'paid' || newStatus === 'late' || newStatus === 'advance_paid') && !updated.receiptNumber) {
            // Fire async — don't block the UI
            autoIssueReceipt(updated, selectedChargeType, periodsKey);
        }
    }, [selectedPeriod, selectedChargeType, rental, onUpdate, autoIssueReceipt]);

    const handleGenerateReceipt = useCallback(() => {
        if (!selectedPeriod) return;
        // Open the ReceiptModal instead of firing a dead toast.
        // The modal handles PDF download + portal issuance + activity log.
        setReceiptModalOpen(true);
    }, [selectedPeriod]);

    // Called when the ReceiptModal successfully issues a receipt — persists
    // the receipt number to the period so the button toggles to [View Issued Receipt].
    const handleReceiptIssued = useCallback((receiptNumber: string) => {
        if (!selectedPeriod) return;
        const periodsKey = selectedChargeType === 'SC' ? 'scPeriods' : 'mvPeriods';
        const currentPeriods = (rental?.[periodsKey] as ServiceChargePeriod[]) || [];
        const updatedPeriods = currentPeriods.map(p =>
            p.index === selectedPeriod.index ? { ...p, receiptNumber } : p
        );
        const updatedRental = {
            ...rental,
            [periodsKey]: updatedPeriods,
        } as Property['rentalDetails'];
        onUpdate(updatedRental!);
        // Update selectedPeriod so the drawer reflects the issued state
        setSelectedPeriod(prev => prev ? { ...prev, receiptNumber } : prev);
    }, [selectedPeriod, selectedChargeType, rental, onUpdate]);

    // Close drawer on Escape key
    useEffect(() => {
        if (!drawerOpen) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setDrawerOpen(false);
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [drawerOpen]);

    // Render nothing if no SC and no MV
    if (scAmount <= 0 && (!mvEnabled || mvAmount <= 0)) return null;

    return (
        <>
            {/* SC — single primary pill (unexpanded) or full history (expanded) */}
            {scAmount > 0 && scPeriods.length > 0 && (
                <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-3xs w-6 flex-shrink-0">SC</span>
                    {expanded ? (
                        <div className="flex items-center gap-1 flex-wrap">
                            {scPeriods.map(period => (
                                <StatusPill
                                    key={period.index}
                                    period={period}
                                    chargeType="SC"
                                    onClick={() => handleBarClick(period, 'SC')}
                                />
                            ))}
                        </div>
                    ) : (
                        <PrimaryStatusPill
                            periods={scPeriods}
                            chargeType="SC"
                            onClick={(period) => handleBarClick(period, 'SC')}
                        />
                    )}
                </div>
            )}

            {/* MV — single primary pill (unexpanded) or full history (expanded) */}
            {mvEnabled && mvAmount > 0 && mvPeriods.length > 0 && (
                <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-3xs w-6 flex-shrink-0">MV</span>
                    {expanded ? (
                        <>
                            <span className="text-3xs font-bold text-slate-500 dark:text-zinc-400 mr-0.5">{mvLabel}</span>
                            <div className="flex items-center gap-1 flex-wrap">
                                {mvPeriods.map(period => (
                                    <StatusPill
                                        key={period.index}
                                        period={period}
                                        chargeType="MV"
                                        onClick={() => handleBarClick(period, 'MV')}
                                    />
                                ))}
                            </div>
                        </>
                    ) : (
                        <PrimaryStatusPill
                            periods={mvPeriods}
                            chargeType="MV"
                            onClick={(period) => handleBarClick(period, 'MV')}
                        />
                    )}
                </div>
            )}

            {/* Quick Payment Drawer — rendered via portal-free fixed overlay.
                The backdrop blocks all background pointer events.
                Passes the full allPeriods array so the drawer can render the
                historical pill strip at the top. */}
            {drawerOpen && (
                <QuickPaymentDrawer
                    period={selectedPeriod}
                    chargeType={selectedChargeType}
                    allPeriods={selectedChargeType === 'SC' ? scPeriods : mvPeriods}
                    unitName={rental?.unitName || unit.description || 'Unit'}
                    onClose={() => setDrawerOpen(false)}
                    onStatusChange={handleStatusChange}
                    onGenerateReceipt={handleGenerateReceipt}
                    onPeriodSelect={(p) => setSelectedPeriod(p)}
                />
            )}

            {/* ReceiptModal — opened by [Generate Receipt] / [View Issued Receipt]
                in the Quick Payment Drawer. Handles PDF download + portal issuance
                + activity log + dynamic button toggle. */}
            {receiptModalOpen && selectedPeriod && (
                <ReceiptModal
                    period={selectedPeriod}
                    chargeType={selectedChargeType}
                    unitName={rental?.unitName || unit.description || 'Unit'}
                    tenantName={rental?.tenantName || 'Resident'}
                    unitId={unit.id}
                    onClose={() => setReceiptModalOpen(false)}
                    onIssued={handleReceiptIssued}
                />
            )}
        </>
    );
};

export default ServiceChargeBars;
