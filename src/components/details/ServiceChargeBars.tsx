/**
 * ServiceChargeBars — Interactive per-period status pills for Service Charge (SC)
 * and Minimum Vend (MV).
 *
 * Renders one colored "status pill" per elapsed billing period from leaseStart
 * to now. Pills are labeled with month abbreviations (Jan, Feb, Mar...) so
 * property managers can immediately identify chronic defaulters.
 *
 * Pill colors:
 *   🟢 Green  = Paid On Time (settled on or before due date)
 *   🟠 Orange = Paid Late (settled after due date — historical audit retained)
 *               OR Currently Late (past due date & unpaid — auto-flagged)
 *   🔴 Red    = Outstanding (unpaid, not yet past due)
 *
 * Automated Late-Status Engine:
 *   When the current calendar date exceeds a period's due date AND no payment
 *   has been logged, the system automatically flags the period as 'late' (orange).
 *   This runs on every render via the mergePeriods() function — no cron needed.
 *
 * Permanent Historical Record:
 *   Marking a LATE period as PAID settles the financial balance (allowing
 *   receipt generation) but retains the `paidOnTime: false` flag. The pill
 *   stays orange in the historical timeline (PAID LATE), even though the
 *   balance is ₦0. A period marked on or before its due date gets
 *   `paidOnTime: true` (PAID ON TIME — green pill).
 *
 * Hover Tooltip:
 *   Hovering any pill shows: month name, amount, status (Paid On Time /
 *   Paid Late / Outstanding), settled date (if applicable), and a link to
 *   view/issue a receipt.
 *
 * Quick Payment Drawer:
 *   Clicking any pill opens a slide-in drawer with 3 toggle buttons
 *   (Paid / Late / Outstanding) and a [Generate & Issue Receipt] prompt.
 *
 * Integration:
 *   Shown on unit cards in PropertyDetailView, replacing the old static
 *   SC/MV badges. Vertically aligned with the Term Progress row (Calendar icon).
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Property, ServiceChargePeriod } from '../../types';
import { formatNairaCompact, formatNairaFull, formatDateShort } from '../../utils/formatting';
import { CalendarIcon, XIcon, CheckCircleIcon, DownloadIcon } from '../../constants';

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

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const getMonthLabel = (isoDate: string): string => {
    try {
        const d = new Date(isoDate);
        return MONTH_ABBR[d.getMonth()] || '';
    } catch {
        return '';
    }
};

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
 * Each period has a dueDate (the start of that period) and an index.
 * Periods are capped at the leaseEnd if it exists.
 */
function computeElapsedPeriods(
    leaseStart: string,
    leaseEnd: string | undefined,
    frequency: string | undefined,
    perPeriodAmount: number,
): ServiceChargePeriod[] {
    if (!leaseStart) return [];
    const start = new Date(leaseStart).getTime();
    if (isNaN(start)) return [];
    const now = Date.now();
    const endBoundary = leaseEnd ? Math.min(now, new Date(leaseEnd).getTime()) : now;
    const periodM = periodMonths(frequency);
    const periodMs = periodM * 30.44 * MS_PER_DAY;

    const periods: ServiceChargePeriod[] = [];
    let periodStart = start;
    let idx = 1;
    // Safety cap: never render more than 60 periods (5 years of monthly).
    while (periodStart < endBoundary && idx <= 60) {
        const dueDate = new Date(periodStart).toISOString().split('T')[0];
        periods.push({
            index: idx,
            dueDate,
            status: 'outstanding', // default; auto-late engine + stored data will override
            amount: perPeriodAmount,
        });
        periodStart += periodMs;
        idx++;
    }
    return periods;
}

/**
 * Merge computed periods with stored status data AND apply the auto-late engine.
 *
 * Auto-late logic:
 *   - If a period has a stored status of 'paid' or 'late', use that (with paidOnTime flag).
 *   - If a period has NO stored status (default 'outstanding') AND its dueDate is
 *     in the past, automatically promote it to 'late' (currently past due & unpaid).
 *   - If a period's dueDate is today or in the future, keep it as 'outstanding'.
 *
 * This runs on every render, so the timeline is always current without needing
 * a cron job. The auto-promotion only affects display — it does NOT write to
 * the stored data unless the user explicitly logs a payment.
 */
function mergePeriods(
    computed: ServiceChargePeriod[],
    stored: ServiceChargePeriod[] | undefined,
): ServiceChargePeriod[] {
    if (!stored || stored.length === 0) {
        // No stored data — apply auto-late to all computed periods
        const now = Date.now();
        return computed.map(p => {
            const dueMs = new Date(p.dueDate).getTime();
            if (dueMs < now) {
                return { ...p, status: 'late' as const }; // auto-late: past due & unpaid
            }
            return p;
        });
    }
    const storedMap = new Map(stored.map(p => [p.index, p]));
    const now = Date.now();
    return computed.map(p => {
        const s = storedMap.get(p.index);
        if (s) {
            // Stored record exists — use its status + paidOnTime flag
            return { ...p, status: s.status, paidDate: s.paidDate, paidOnTime: s.paidOnTime };
        }
        // No stored record — apply auto-late if past due
        const dueMs = new Date(p.dueDate).getTime();
        if (dueMs < now) {
            return { ...p, status: 'late' as const };
        }
        return p;
    });
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
    // Outstanding — red pill
    return {
        pill: 'bg-red-500',
        hover: 'hover:bg-red-600',
        label: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-900/20',
        name: 'Outstanding',
        description: 'Unpaid — not yet past due',
    };
};

// ─── Rich Hover Tooltip ─────────────────────────────────────────────────────
interface PillTooltipProps {
    period: ServiceChargePeriod;
    chargeType: 'SC' | 'MV';
}

const PillTooltip: React.FC<PillTooltipProps> = ({ period, chargeType }) => {
    const meta = getStatusMeta(period);
    return (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 rounded-lg bg-slate-900 dark:bg-zinc-800 text-white shadow-xl z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-slate-900 dark:bg-zinc-800 rotate-45" />
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
        </div>
    );
};

// ─── Quick Payment Drawer ───────────────────────────────────────────────────
interface QuickPaymentDrawerProps {
    period: ServiceChargePeriod | null;
    chargeType: 'SC' | 'MV';
    unitName: string;
    onClose: () => void;
    onStatusChange: (status: 'paid' | 'late' | 'outstanding') => void;
    onGenerateReceipt: () => void;
}

const QuickPaymentDrawer: React.FC<QuickPaymentDrawerProps> = ({
    period, chargeType, unitName, onClose, onStatusChange, onGenerateReceipt,
}) => {
    if (!period) return null;
    const meta = getStatusMeta(period);

    return (
        <>
            {/* Backdrop — fixed inset-0, dark overlay, pointer-events-auto
                ensures background buttons/cards are NOT clickable while drawer
                is open. z-[4500] sits above all unit card content. */}
            <div
                className="fixed inset-0 z-[4500] bg-black/50 sm:backdrop-blur-sm pointer-events-auto"
                onClick={onClose}
                aria-hidden="true"
            />
            {/* Drawer — slides in from the right.
                z-[4501] sits above the backdrop. pointer-events-auto explicitly
                enables interaction on the drawer itself. */}
            <div
                className="fixed top-0 right-0 bottom-0 z-[4501] w-full sm:max-w-md bg-white dark:bg-zinc-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 pointer-events-auto"
                role="dialog"
                aria-modal="true"
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

                    {/* Toggle buttons */}
                    <div>
                        <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                            Change Status
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            {(['paid', 'late', 'outstanding'] as const).map(s => {
                                // For the toggle button highlight, 'paid' with paidOnTime=false
                                // should highlight the 'paid' button (balance is settled).
                                const isActive = period.status === s;
                                const colorClass =
                                    s === 'paid' ? 'bg-emerald-500' :
                                    s === 'late' ? 'bg-amber-500' :
                                    'bg-red-500';
                                const labelName =
                                    s === 'paid' ? 'Paid' :
                                    s === 'late' ? 'Late' :
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

                    {/* Receipt prompt — shown when status is 'paid' (balance settled) */}
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
                                        Generate an itemized receipt for this {chargeType} payment.
                                    </p>
                                    <button
                                        onClick={onGenerateReceipt}
                                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                                    >
                                        <DownloadIcon className="w-3.5 h-3.5" />
                                        Generate & Issue Receipt
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

// ─── Status Pill (with hover tooltip) ───────────────────────────────────────
interface StatusPillProps {
    period: ServiceChargePeriod;
    chargeType: 'SC' | 'MV';
    onClick: () => void;
}

const StatusPill: React.FC<StatusPillProps> = ({ period, chargeType, onClick }) => {
    const [hovered, setHovered] = useState(false);
    const meta = getStatusMeta(period);
    const monthLabel = getMonthLabel(period.dueDate);

    return (
        <div
            className="relative inline-block"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
                className={`h-6 px-1.5 rounded-md ${meta.pill} ${meta.hover} transition-all hover:scale-110 hover:shadow-sm cursor-pointer flex items-center justify-center text-3xs font-black text-white min-w-[28px]`}
                aria-label={`${meta.name} — ${getFullMonthYear(period.dueDate)}`}
            >
                {monthLabel}
            </button>
            {hovered && (
                <PillTooltip period={period} chargeType={chargeType} />
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
}

export const ServiceChargeBars: React.FC<ServiceChargeBarsProps> = ({ unit, onUpdate, onGenerateReceipt }) => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState<ServiceChargePeriod | null>(null);
    const [selectedChargeType, setSelectedChargeType] = useState<'SC' | 'MV'>('SC');

    const rental = (unit.rentalDetails || unit) as Property['rentalDetails'];
    const leaseStart = rental?.leaseStart || '';
    const leaseEnd = rental?.leaseEnd;
    const frequency = rental?.rentFrequency;

    // Property-level minimum vend config
    const mvEnabled = (unit as any).minimumVendEnabled || false;
    const mvAmount = Number((unit as any).minimumVendAmount || 0);
    const mvLabel = (unit as any).minimumVendLabel || 'Min Vend';

    // SC amount
    const scAmount = Number(rental?.serviceChargeAmount ?? rental?.serviceCharge ?? 0);

    // Compute periods (with auto-late engine applied in mergePeriods)
    const scPeriods = useMemo(
        () => mergePeriods(computeElapsedPeriods(leaseStart, leaseEnd, frequency, scAmount), rental?.scPeriods),
        [leaseStart, leaseEnd, frequency, scAmount, rental?.scPeriods],
    );
    const mvPeriods = useMemo(
        () => mergePeriods(computeElapsedPeriods(leaseStart, leaseEnd, frequency, mvAmount), rental?.mvPeriods),
        [leaseStart, leaseEnd, frequency, mvAmount, rental?.mvPeriods],
    );

    const handleBarClick = useCallback((period: ServiceChargePeriod, chargeType: 'SC' | 'MV') => {
        setSelectedPeriod(period);
        setSelectedChargeType(chargeType);
        setDrawerOpen(true);
    }, []);

    const handleStatusChange = useCallback((newStatus: 'paid' | 'late' | 'outstanding') => {
        if (!selectedPeriod) return;
        const periodsKey = selectedChargeType === 'SC' ? 'scPeriods' : 'mvPeriods';
        const currentPeriods = (rental?.[periodsKey] as ServiceChargePeriod[]) || [];
        const updatedPeriods = [...currentPeriods];
        const existingIdx = updatedPeriods.findIndex(p => p.index === selectedPeriod.index);

        // Determine paidOnTime flag:
        // - If new status is 'paid' or 'late' (settling), check if payment date
        //   is on/before due date (paidOnTime=true) or after (paidOnTime=false).
        // - If new status is 'outstanding', clear the flag.
        let paidOnTime: boolean | undefined;
        const todayIso = new Date().toISOString().split('T')[0];
        if (newStatus === 'paid' || newStatus === 'late') {
            const dueMs = new Date(selectedPeriod.dueDate).getTime();
            const paidMs = new Date(todayIso).getTime();
            paidOnTime = paidMs <= dueMs;
        } else {
            paidOnTime = undefined;
        }

        const updated: ServiceChargePeriod = {
            ...selectedPeriod,
            status: newStatus,
            paidDate: newStatus === 'paid' || newStatus === 'late' ? todayIso : undefined,
            paidOnTime,
        };

        if (existingIdx >= 0) {
            updatedPeriods[existingIdx] = updated;
        } else {
            updatedPeriods.push(updated);
            updatedPeriods.sort((a, b) => a.index - b.index);
        }

        // Update the aggregate serviceChargeStatus based on all periods.
        // A period counts as "settled" if its balance is ₦0 (status === 'paid',
        // regardless of paidOnTime). 'late' without a paidDate is still unpaid.
        const allSettled = updatedPeriods.every(p => p.status === 'paid');
        const anyUnsettled = updatedPeriods.some(p =>
            p.status === 'outstanding' || (p.status === 'late' && !p.paidDate)
        );
        let aggregateStatus: 'PAID_FULLY' | 'PARTIALLY_PAID' | 'UNPAID' = 'UNPAID';
        if (allSettled) aggregateStatus = 'PAID_FULLY';
        else if (anyUnsettled && updatedPeriods.some(p => p.status === 'paid')) aggregateStatus = 'PARTIALLY_PAID';
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
    }, [selectedPeriod, selectedChargeType, rental, onUpdate]);

    const handleGenerateReceipt = useCallback(() => {
        if (selectedPeriod && onGenerateReceipt) {
            onGenerateReceipt(selectedPeriod, selectedChargeType);
        }
        setDrawerOpen(false);
    }, [selectedPeriod, selectedChargeType, onGenerateReceipt]);

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
            {/* SC Pills */}
            {scAmount > 0 && scPeriods.length > 0 && (
                <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-3xs w-6 flex-shrink-0">SC</span>
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
                </div>
            )}

            {/* MV Pills */}
            {mvEnabled && mvAmount > 0 && mvPeriods.length > 0 && (
                <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-3xs w-6 flex-shrink-0">MV</span>
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
                </div>
            )}

            {/* Quick Payment Drawer — rendered via portal-free fixed overlay.
                The backdrop blocks all background pointer events. */}
            {drawerOpen && (
                <QuickPaymentDrawer
                    period={selectedPeriod}
                    chargeType={selectedChargeType}
                    unitName={rental?.unitName || unit.description || 'Unit'}
                    onClose={() => setDrawerOpen(false)}
                    onStatusChange={handleStatusChange}
                    onGenerateReceipt={handleGenerateReceipt}
                />
            )}
        </>
    );
};

export default ServiceChargeBars;
