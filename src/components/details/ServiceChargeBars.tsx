/**
 * ServiceChargeBars — the Units-tab billing timeline: RENT, SC & MV.
 *
 * OVERHAUL (the "dead pills" fix): the previous implementation stepped at
 * the RENT frequency (no form ever set serviceChargeFrequency → annual rent
 * produced ONE pill per year), defaulted every computed period to red
 * 'outstanding' with the auto-late engine removed, rendered anonymous
 * color-only dashes (the header claimed month labels that never existed),
 * and never read a single payment record — while the expanded card labeled
 * all of this "Payment History".
 *
 * NOW — "it does what it claims to do":
 *   • TIME drives the strip. Periods are derived from leaseStart on every
 *     render via the shared engine (src/utils/leaseTimeline.ts): each new
 *     month adds a pill, the timeline visibly moves month-to-month.
 *   • PAYMENTS drive the colors. rentPaymentHistory rows (Collect Rent)
 *     settle RENT pills automatically; stored scPeriods/mvPeriods marks and
 *     receiptNumbers remain honored overrides for SC/MV.
 *   • STATE IS DERIVED, not stored: unpaid-but-current → amber DUE ("new
 *     service charge is due" — said out loud), window-closed-unpaid → red
 *     OVERDUE, settled → green (orange when settled late), pre-paid → blue.
 *   • READABLE, not cryptic: collapsed cards get text chips ("SC DUE",
 *     "SC 3 MO OVERDUE", "RENT CLEAR") instead of color-only dashes;
 *     expanded cards get month-labeled pills + a one-line legend.
 *   • CADENCE: without an explicit serviceChargeFrequency the SC timeline
 *     runs MONTHLY at the monthly rate (annual totals spread /12 — never
 *     12× inflated); explicit frequencies keep their legacy cadence.
 *
 * The Quick Payment Drawer (manual mark + auto receipt issuance) is the
 * input path for SC/MV and is preserved — its marks now land on the
 * correct month because the engine merges stored rows by DUE DATE (legacy
 * annual-cadence marks migrate onto the monthly grid correctly).
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Property } from '../../types';
import { formatNairaCompact, formatNairaFull, formatDateShort } from '../../utils/formatting';
import { CalendarIcon, XIcon, CheckCircleIcon, DownloadIcon } from '../../constants';
import { resolveServiceChargeAmount } from '../../utils/serviceCharge';
import {
    buildTimeline,
    buildRentTimeline,
    buildAdvanceRows,
    advanceCoverageLabel,
    serviceChargeTimeline,
    summarizeTimeline,
    monthAbbr,
    monthLabel,
    type CadenceResolution,
    type TimelinePeriod,
    type TimelineSummary,
} from '../../utils/leaseTimeline';
import ReceiptModal from '../modals/ReceiptModal';
import { buildReceiptLogArgs, buildReceiptContent, upsertReceiptNumber } from '../../utils/receiptDelivery';
import { useCoreState } from '../../contexts/CoreContext';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';

// ─── Helpers ────────────────────────────────────────────────────────────────
const FULL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const getFullMonthYear = (isoDate: string): string => {
    try {
        const d = new Date(isoDate);
        return `${FULL_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
        return '';
    }
};

/** Month label under each pill — January pills carry the year. */
const pillMonthLabel = (isoDate: string): string => {
    const abbr = monthAbbr(isoDate);
    try {
        const d = new Date(isoDate);
        if (d.getMonth() === 0) return `${abbr}'${String(d.getFullYear()).slice(2)}`;
        return abbr;
    } catch { return abbr; }
};

/** Max pills rendered inline before a "+N earlier" overflow chip appears. */
const MAX_VISIBLE_PILLS = 18;

// ─── Status colors & metadata ───────────────────────────────────────────────
// Four-color system, unchanged vocabulary:
//   green  = Paid On Time   amber = DUE now / Paid Late   red = OVERDUE   blue = Advance
interface StatusMeta {
    pill: string;       // pill background color
    hover: string;      // hover state
    label: string;      // text color for status label
    bg: string;         // soft background for drawer status box
    name: string;       // human-readable name
    description: string;// long-form description for tooltip
}

const getStatusMeta = (period: TimelinePeriod): StatusMeta => {
    if (period.status === 'paid') {
        if (period.paidOnTime === false) {
            // Paid Late — amber pill, balance settled but history retained
            return {
                pill: 'bg-amber-500',
                hover: 'hover:bg-amber-600',
                label: 'text-amber-600 dark:text-amber-400',
                bg: 'bg-amber-50 dark:bg-amber-900/20',
                name: 'Paid Late',
                description: `Settled ${period.paidDate ? formatDateShort(period.paidDate) : '—'} (after window closed ${formatDateShort(period.windowEnd)})`,
            };
        }
        // Paid On Time — green pill
        return {
            pill: 'bg-emerald-500',
            hover: 'hover:bg-emerald-600',
            label: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-50 dark:bg-emerald-900/20',
            name: 'Paid On Time',
            description: `Settled ${period.paidDate ? formatDateShort(period.paidDate) : '—'} (within billing window)`,
        };
    }
    if (period.status === 'late') {
        return {
            pill: 'bg-amber-500',
            hover: 'hover:bg-amber-600',
            label: 'text-amber-600 dark:text-amber-400',
            bg: 'bg-amber-50 dark:bg-amber-900/20',
            name: 'Paid Late',
            description: period.paidDate
                ? `Settled ${formatDateShort(period.paidDate)} (after due date)`
                : 'Settled after its billing window (payment date not recorded)',
        };
    }
    if (period.status === 'advance_paid') {
        return {
            pill: 'bg-blue-500',
            hover: 'hover:bg-blue-600',
            label: 'text-blue-600 dark:text-blue-400',
            bg: 'bg-blue-50 dark:bg-blue-900/20',
            name: 'Advance Paid',
            description: `Pre-paid on ${period.paidDate ? formatDateShort(period.paidDate) : '—'} (future cycle)`,
        };
    }
    if (period.status === 'due') {
        // NEW derived state — the current cycle's charge is due right now.
        return {
            pill: 'bg-amber-500',
            hover: 'hover:bg-amber-600',
            label: 'text-amber-600 dark:text-amber-400',
            bg: 'bg-amber-50 dark:bg-amber-900/20',
            name: 'Due',
            description: `Due since ${formatDateShort(period.dueDate)} — inside its billing window (closes ${formatDateShort(period.windowEnd)})`,
        };
    }
    // 'overdue' (and any legacy 'outstanding' leftovers) — red.
    return {
        pill: 'bg-red-500',
        hover: 'hover:bg-red-600',
        label: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-900/20',
        name: 'Overdue',
        description: `Window closed ${formatDateShort(period.windowEnd)} — unpaid`,
    };
};

// ─── Rich Hover Tooltip (Portal-rendered to avoid clipping) ─────────────────
interface PillTooltipProps {
    period: TimelinePeriod;
    chargeType: 'SC' | 'MV' | 'RENT';
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
            const tooltipWidth = 224;
            const left = rect.left + rect.width / 2 - tooltipWidth / 2;
            const clampedLeft = Math.max(8, Math.min(window.innerWidth - tooltipWidth - 8, left));
            const showBelow = rect.top < 200;
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
                    <span className="text-2xs font-black uppercase tracking-wider text-slate-300">
                        {chargeType} · {getFullMonthYear(period.dueDate)}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-2xs text-slate-400 w-12">Amount</span>
                    <span className="text-sm font-bold text-white">{formatNairaCompact(period.amount)}</span>
                </div>
                {period.paidAmount > 0 && period.status !== 'paid' && period.status !== 'advance_paid' && (
                    <div className="flex items-center gap-1.5">
                        <span className="text-2xs text-slate-400 w-12">Paid</span>
                        <span className="text-sm font-bold text-emerald-400">{formatNairaCompact(period.paidAmount)}</span>
                    </div>
                )}
                <div className="flex items-center gap-1.5">
                    <span className="text-2xs text-slate-400 w-12">Status</span>
                    <span className={`text-xs font-bold ${meta.label}`}>{meta.name}</span>
                </div>
                <p className="text-2xs text-slate-400 italic">{meta.description}</p>
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-700/50">
                    <DownloadIcon className="w-3 h-3 text-emerald-400" />
                    <span className="text-2xs font-bold text-emerald-400">
                        {chargeType === 'RENT'
                            ? 'Recorded via Collect Rent'
                            : period.status === 'paid'
                                ? 'View/Issue Receipt'
                                : 'Click to log payment'}
                    </span>
                </div>
            </div>
        </div>,
        document.body,
    );
};

// ─── Quick Payment Drawer ───────────────────────────────────────────────────
interface QuickPaymentDrawerProps {
    period: TimelinePeriod | null;
    chargeType: 'SC' | 'MV';
    unitName: string;
    allPeriods: TimelinePeriod[];
    onClose: () => void;
    onStatusChange: (status: 'paid' | 'late' | 'outstanding' | 'advance_paid') => void;
    onGenerateReceipt: () => void;
    onPeriodSelect: (period: TimelinePeriod) => void;
    /** Log an advance payment: N cycles from this period, ONE receipt. */
    onAdvancePayment: (cycles: number) => void;
    /** Cadence of the selected stream (1 = monthly) + per-cycle charge. */
    cadenceMonths: number;
    perPeriodAmount: number;
}

const QuickPaymentDrawer: React.FC<QuickPaymentDrawerProps> = ({
    period, chargeType, unitName, allPeriods, onClose, onStatusChange, onGenerateReceipt, onPeriodSelect,
    onAdvancePayment, cadenceMonths, perPeriodAmount,
}) => {
    const [advanceCycles, setAdvanceCycles] = useState(1);
    if (!period) return null;
    const meta = getStatusMeta(period);

    return (
        <>
            <div
                className="fixed inset-0 z-[4500] bg-black/60 sm:backdrop-blur-sm pointer-events-auto"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                aria-hidden="true"
            />
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
                    {/* ── Historical Pill Strip (month-labeled) ───────────── */}
                    {allPeriods.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                                Payment History · {allPeriods.length} period{allPeriods.length === 1 ? '' : 's'}
                            </p>
                            <div className="flex flex-wrap items-start gap-x-1 gap-y-1.5 p-2 bg-slate-50 dark:bg-zinc-800/60 rounded-lg border border-slate-100 dark:border-zinc-700/60">
                                {allPeriods.map(p => {
                                    const m = getStatusMeta(p);
                                    const isActive = p.index === period.index;
                                    return (
                                        <button
                                            key={p.index}
                                            onClick={() => onPeriodSelect(p)}
                                            title={`${getFullMonthYear(p.dueDate)} — ${m.name}`}
                                            className="flex flex-col items-center gap-0.5 group/pill"
                                        >
                                            <span className={`h-2 w-7 rounded-full ${m.pill} transition-all cursor-pointer ${
                                                isActive
                                                    ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-zinc-800 ring-slate-400 scale-110'
                                                    : 'opacity-80 group-hover/pill:opacity-100 group-hover/pill:scale-105'
                                            }`} />
                                            <span className={`text-3xs font-bold leading-none ${isActive ? 'text-slate-700 dark:text-zinc-200' : 'text-slate-400 dark:text-zinc-500'}`}>
                                                {pillMonthLabel(p.dueDate)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Charge Amount */}
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

                    {/* Toggle buttons — 3 states: Paid On Time, Paid Late, Outstanding.
                        (Advance is its own flow below — it covers N cycles.) */}
                    <div>
                        <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                            Change Status
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            {(['paid', 'late', 'outstanding'] as const).map(s => {
                                const isActive = period.status === s;
                                const colorClass =
                                    s === 'paid' ? 'bg-emerald-500' :
                                    s === 'late' ? 'bg-amber-500' :
                                    'bg-red-500';
                                const labelName =
                                    s === 'paid' ? 'Paid On Time' :
                                    s === 'late' ? 'Paid Late' :
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

                    {/* ── Advance Payment — N cycles from this period, ONE receipt ── */}
                    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40">
                        <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-1">
                            Advance Payment
                        </p>
                        <p className="text-2xs text-slate-500 dark:text-zinc-400 mb-3">
                            Resident paid ahead? One payment covers {cadenceMonths === 1 ? 'months' : 'cycles'} from
                            this period — a single receipt is issued for the whole range.
                        </p>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setAdvanceCycles(c => Math.max(1, c - 1))}
                                    disabled={advanceCycles <= 1}
                                    aria-label="Fewer cycles"
                                    className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-800/60 text-blue-600 dark:text-blue-300 font-black text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                >
                                    −
                                </button>
                                <span className="min-w-16 text-center">
                                    <span className="block text-lg font-black text-blue-700 dark:text-blue-300 leading-none">{advanceCycles}</span>
                                    <span className="block text-3xs font-bold text-slate-400 uppercase tracking-wide mt-0.5">
                                        {cadenceMonths === 1 ? (advanceCycles === 1 ? 'month' : 'months') : (advanceCycles === 1 ? 'cycle' : 'cycles')}
                                    </span>
                                </span>
                                <button
                                    onClick={() => setAdvanceCycles(c => Math.min(12, c + 1))}
                                    disabled={advanceCycles >= 12}
                                    aria-label="More cycles"
                                    className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-800/60 text-blue-600 dark:text-blue-300 font-black text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                >
                                    +
                                </button>
                            </div>
                            <div className="text-right">
                                <p className="text-2xs font-bold text-slate-400 uppercase tracking-wide">Covers</p>
                                <p className="text-xs font-black text-blue-700 dark:text-blue-300">
                                    {advanceCoverageLabel(period.dueDate, advanceCycles, cadenceMonths).label}
                                </p>
                                <p className="text-2xs font-bold text-slate-500 dark:text-zinc-400 mt-0.5">
                                    {formatNairaFull(perPeriodAmount * advanceCycles)} total
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => onAdvancePayment(advanceCycles)}
                            className="w-full px-4 py-2.5 text-white text-xs font-bold rounded-lg bg-blue-500 hover:bg-blue-600 shadow-sm transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-200" />
                            Log Advance Payment · {advanceCycles} {cadenceMonths === 1 ? (advanceCycles === 1 ? 'month' : 'months') : (advanceCycles === 1 ? 'cycle' : 'cycles')}
                        </button>
                    </div>

                    {/* Receipt prompt */}
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
                                        <DownloadIcon className="w-3.5 h-3.5" />
                                        {period.receiptNumber ? 'View Issued Receipt' : 'Generate Receipt'}
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

// ─── Status Pill (month-labeled, portal tooltip) ────────────────────────────
// Each pill now says its month out loud (Jan, Feb...; Jan'26 carries the
// year) — the old color-only dashes forced users to hover to learn anything.
// `interactive` false (RENT row) renders a non-button: rent is recorded via
// Collect Rent, not this drawer.
interface StatusPillProps {
    period: TimelinePeriod;
    chargeType: 'SC' | 'MV' | 'RENT';
    onClick?: () => void;
}

const StatusPill: React.FC<StatusPillProps> = ({ period, chargeType, onClick }) => {
    const [hovered, setHovered] = useState(false);
    const meta = getStatusMeta(period);
    const pillRef = useRef<HTMLButtonElement>(null);

    const inner = (
        <>
            <motion.span
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className={`block h-2 w-7 rounded-full ${meta.pill} ${meta.hover} transition-all origin-left ${onClick ? 'cursor-pointer' : ''} ${onClick ? 'group-hover:scale-110' : ''}`}
            />
            <span className="text-3xs font-bold leading-none text-slate-400 dark:text-zinc-500 group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition-colors">
                {pillMonthLabel(period.dueDate)}
            </span>
        </>
    );

    const sharedHandlers = {
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
    };

    return (
        <div className="relative inline-flex flex-col items-center gap-0.5 group" {...sharedHandlers}>
            {onClick ? (
                <motion.button
                    ref={pillRef as React.RefObject<HTMLButtonElement>}
                    onClick={(e) => { e.stopPropagation(); onClick(); }}
                    className="block"
                    aria-label={`${meta.name} — ${getFullMonthYear(period.dueDate)}`}
                >
                    {inner}
                </motion.button>
            ) : (
                <span
                    ref={pillRef as React.RefObject<HTMLSpanElement>}
                    className="block"
                    aria-label={`${meta.name} — ${getFullMonthYear(period.dueDate)}`}
                >
                    {inner}
                </span>
            )}
            {hovered && pillRef.current && (
                <PillTooltip period={period} chargeType={chargeType} targetRef={pillRef} />
            )}
        </div>
    );
};

// ─── Timeline Status Chip (collapsed cards) ─────────────────────────────────
// Replaces the color-only 8×28px dash: the unit's billing state in WORDS.
//   emerald "SC CLEAR" / amber "SC DUE" / red "SC 3 MO OVERDUE"
// Tooltip carries the amount + month. Same chip vocabulary as every other
// badge in the units tab (text-3xs font-black uppercase rounded-full).
interface TimelineStatusChipProps {
    chargeLabel: string;                    // "SC" | "RENT" | "MV" etc.
    summary: TimelineSummary;
    onClick?: () => void;
    chargeType: 'SC' | 'MV' | 'RENT';
}

const TimelineStatusChip: React.FC<TimelineStatusChipProps> = ({ chargeLabel, summary, onClick, chargeType }) => {
    let cls: string;
    let text: string;
    let title: string;

    if (summary.state === 'overdue') {
        cls = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
        const count = summary.overdueCount + summary.dueCount;
        text = `${chargeLabel} ${count > 1 ? `${count} MO ` : ''}OVERDUE`;
        const cur = summary.currentPeriod;
        title = `${chargeLabel}: ${count} month${count > 1 ? 's' : ''} unsettled — ${formatNairaFull(summary.outstandingTotal)} outstanding${cur ? ` · oldest ${monthLabel(cur.dueDate)}` : ''}. Click to open payment drawer.`;
    } else if (summary.state === 'due') {
        cls = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
        text = `${chargeLabel} DUE`;
        const cur = summary.currentPeriod;
        const partial = cur && cur.paidAmount > 0 ? ` (${formatNairaCompact(cur.paidAmount)} paid)` : '';
        title = `${chargeLabel}: ${formatNairaFull(summary.outstandingTotal)} due for ${cur ? monthLabel(cur.dueDate) : 'current cycle'}${partial}. Click to open payment drawer.`;
    } else if (summary.state === 'clear') {
        cls = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
        text = `${chargeLabel} CLEAR`;
        title = `${chargeLabel}: settled through ${summary.settledThrough || 'latest period'}${summary.nextDueDate ? ` · next charge ${summary.nextDueDate}` : ''}.`;
    } else {
        return null; // nothing tracked (no lease/amount) — render nothing
    }

    const body = (
        <span className={`inline-flex items-center gap-0.5 text-3xs font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap ${cls}`} title={title}>
            {summary.state === 'overdue' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
            {text}
        </span>
    );

    if (!onClick) return body;
    return (
        <button onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={title} className="inline-flex">
            {body}
        </button>
    );
};

// ─── Legend (expanded view) ─────────────────────────────────────────────────
const TimelineLegend: React.FC = () => (
    <div className="flex items-center gap-3 flex-wrap text-3xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Paid</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Due / Paid Late</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Overdue</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Advance</span>
    </div>
);

// ─── Main Component ─────────────────────────────────────────────────────────
interface ServiceChargeBarsProps {
    /** The unit (Property) to render the timeline for. */
    unit: Property;
    /** Called when period status changes, with the updated rentalDetails. */
    onUpdate: (updatedRentalDetails: Property['rentalDetails']) => void;
    /** Callback to generate a receipt for a paid period. */
    onGenerateReceipt?: (period: TimelinePeriod, chargeType: 'SC' | 'MV') => void;
    /** When true (expanded card), shows the full month-labeled history.
     *  When false (collapsed card), shows readable status chips. */
    expanded?: boolean;
    /** Render the RENT row/chip (rent timeline from rentPaymentHistory).
     *  Pass false for "Management Only (No Rent)" properties. Default true. */
    includeRent?: boolean;
    /** Opens Collect Rent for this unit — the input path for rent money. */
    onCollectRent?: () => void;
}

export const ServiceChargeBars: React.FC<ServiceChargeBarsProps> = ({
    unit, onUpdate, onGenerateReceipt, expanded = false, includeRent = true, onCollectRent,
}) => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState<TimelinePeriod | null>(null);
    const [selectedChargeType, setSelectedChargeType] = useState<'SC' | 'MV'>('SC');
    const [receiptModalOpen, setReceiptModalOpen] = useState(false);

    // Convex mutations + context for zero-touch receipt automation
    const { coreState } = useCoreState();
    const { currentUser, bearerToken } = useAuth();
    const { addToast } = useUI();
    const sendPortalMessage = useMutation(api.portals.sendPortalMessage);
    const logAutomation = useMutation(api.sentry.logAutomation);

    const rental = (unit.rentalDetails || unit) as Property['rentalDetails'];
    const leaseStart = rental?.leaseStart || '';
    const leaseEnd = rental?.leaseEnd;
    const rentFrequency = rental?.rentFrequency;

    // Property-level minimum vend config
    const mvEnabled = (unit as any).minimumVendEnabled || false;
    const mvAmount = Number((unit as any).minimumVendAmount || 0);
    const mvLabel = (unit as any).minimumVendLabel || 'Min Vend';

    // SC money — unified resolution (Item 2): a defined 0 renders no SC row.
    const scAmount = resolveServiceChargeAmount({ unit, rental: unit.rentalDetails });

    // ── The three timelines — one engine, one clock ──
    // SC: engine resolves cadence (monthly unless the lease explicitly set
    // serviceChargeFrequency) + merges stored scPeriods overrides by dueDate.
    const { periods: scPeriods, cadence: scCadence, summary: scSummary } = useMemo(
        () => serviceChargeTimeline({ unit, rental }),
        [unit, rental],
    );

    // MV: minimum vend is a MONTHLY charge — same monthly grid as SC.
    // It used to step at the RENT frequency (annual by default → ONE MV
    // pill a year, 'not tracking the same way service charge tracks').
    // Stored mvPeriods rows still merge by DUE DATE, so legacy annual-step
    // marks land on their own month of the monthly grid.
    const mvPeriods = useMemo(() => buildTimeline({
        leaseStart, leaseEnd,
        cadence: {
            months: 1,
            perPeriodAmount: mvAmount,
            frequency: 'Monthly', explicit: false,
        },
        stored: (rental as any)?.mvPeriods,
    }), [leaseStart, leaseEnd, mvAmount, (rental as any)?.mvPeriods]);
    const mvSummary = useMemo(() => summarizeTimeline(mvPeriods), [mvPeriods]);

    // RENT: rent-frequency cadence, settled by recorded rentPaymentHistory rows.
    const rentPeriods = useMemo(() => includeRent ? buildRentTimeline({
        leaseStart, leaseEnd,
        rentFrequency,
        rentAmount: Number(rental?.rentAmount) || 0,
        payments: (unit as any).rentPaymentHistory || [],
    }) : [], [includeRent, leaseStart, leaseEnd, rentFrequency, rental?.rentAmount, (unit as any).rentPaymentHistory]);
    const rentSummary = useMemo(() => summarizeTimeline(rentPeriods), [rentPeriods]);

    const handleBarClick = useCallback((period: TimelinePeriod, chargeType: 'SC' | 'MV') => {
        setSelectedPeriod(period);
        setSelectedChargeType(chargeType);
        setDrawerOpen(true);
    }, []);

    // ── Zero-Touch Receipt Automation ──
    // 2026-09-12 fix: this used to pass messageType:'receipt_issued' — a
    // literal the logAutomation validator REJECTS — so the log write threw
    // AFTER the portal delivery succeeded, the receipt number was never
    // saved, and the UI reported failure. It also read the STALE `rental`
    // closure when persisting (reverting the manual mark the same tick).
    // Now: portal → persist (on the base ledger that already carries the
    // mark) → log (best-effort, never orphans a delivered receipt).
    const autoIssueReceipt = useCallback(async (
        period: TimelinePeriod,
        chargeType: 'SC' | 'MV',
        periodsKey: 'scPeriods' | 'mvPeriods',
        baseRental: Property['rentalDetails'],
        coverage?: { cycles: number; label: string; unit: string; indexes: number[] },
    ) => {
        const firmId = coreState?.firmDetails?.id || currentUser?.firmId || '';
        const tenantName = rental?.tenantName || 'Resident';
        const unitName = rental?.unitName || unit.description || 'Unit';
        const chargeTypeLabel = chargeType === 'SC' ? 'Service Charge' : 'Minimum Vend';
        const billingPeriod = coverage
            ? coverage.label
            : (() => {
                try { return new Date(period.dueDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
                catch { return `Period ${period.index}`; }
            })();
        const receiptNumber = `RC-${Date.now().toString().slice(-6)}-${period.index}`;
        const settlementMethod = period.paidOnTime === false ? 'Paid Late' :
                                  coverage ? `Advance Payment (${coverage.cycles} ${coverage.unit})` :
                                  period.isAdvance ? 'Advance Payment' : 'Paid On Time';
        const paymentDate = period.paidDate || new Date().toISOString().split('T')[0];

        // 1. Publish receipt to resident's portal — the PRIMARY delivery.
        //    If this fails the receipt is NOT issued (no number persisted).
        try {
            await sendPortalMessage({
                firmId,
                senderId: currentUser?.id || '',
                senderName: currentUser?.name || 'Property Manager',
                senderRole: 'admin',
                subject: `Receipt ${receiptNumber} — ${chargeTypeLabel} (${billingPeriod})`,
                content: buildReceiptContent({
                    receiptNumber,
                    chargeTypeLabel,
                    billingPeriod,
                    amountPaid: period.amount,
                    paymentDate,
                    settlementMethod,
                    coverageNote: coverage?.label,
                    autoGenerated: true,
                }),
                unitId: unit.id,
            } as any);
        } catch (err: any) {
            console.warn('Auto-receipt portal delivery failed:', err);
            addToast('Payment logged, but the receipt could not be delivered to the resident\'s portal. Click "Generate Receipt" to retry.', { type: 'warning', duration: 8000 });
            return;
        }

        // 2. Persist the receipt number — on the ledger that already carries
        //    this tick's mark + aggregates (baseRental), NOT the stale
        //    `rental` closure (which previously reverted the manual mark).
        //    An ADVANCE receipt stamps every covered cycle's row.
        const currentPeriods = ((baseRental as any)?.[periodsKey] as any[]) || [];
        let updatedPeriods = currentPeriods;
        if (coverage) {
            for (const idx of coverage.indexes) {
                updatedPeriods = upsertReceiptNumber(updatedPeriods, idx, receiptNumber);
            }
        } else {
            updatedPeriods = upsertReceiptNumber(currentPeriods, period.index, receiptNumber);
        }
        onUpdate({ ...baseRental!, [periodsKey]: updatedPeriods } as Property['rentalDetails']);

        // 3. Activity log — BEST-EFFORT: a log failure must never orphan a
        //    delivered receipt again (the 2026-09-12 failure was exactly
        //    this: portal delivered, log rejected, UI said it failed).
        try {
            await logAutomation(buildReceiptLogArgs({
                receiptNumber,
                chargeTypeLabel,
                billingPeriod,
                tenantName,
                amountPaid: period.amount,
                settlementMethod,
                firmId,
                unitId: unit.id,
                senderName: currentUser?.name || 'Property Manager',
                senderId: currentUser?.id,
                userEmail: currentUser?.email,
                sessionToken: (bearerToken ?? undefined),
            }) as any);
        } catch (logErr: any) {
            console.warn('Receipt activity-log write failed (receipt was delivered):', logErr);
            addToast(`Receipt ${receiptNumber} issued to ${tenantName}'s portal — the activity log could not be written.`, { type: 'success', duration: 6000 });
            return;
        }

        addToast(`Receipt ${receiptNumber} issued to ${tenantName}'s portal.`, { type: 'success' });
    }, [coreState, currentUser, rental, unit, sendPortalMessage, logAutomation, onUpdate, addToast, bearerToken]);

    const handleStatusChange = useCallback((newStatus: 'paid' | 'late' | 'outstanding' | 'advance_paid') => {
        if (!selectedPeriod) return;
        const periodsKey = selectedChargeType === 'SC' ? 'scPeriods' : 'mvPeriods';
        const currentPeriods = ((rental as any)?.[periodsKey] as any[]) || [];
        const updatedPeriods = [...currentPeriods];
        const existingIdx = updatedPeriods.findIndex(p => p.index === selectedPeriod.index);

        // paidOnTime reflects USER INTENT (Paid On Time → green, Paid Late →
        // orange) — never auto-override the explicit selection.
        let paidOnTime: boolean | undefined;
        const todayIso = new Date().toISOString().split('T')[0];
        if (newStatus === 'paid') paidOnTime = true;
        else if (newStatus === 'late') paidOnTime = false;
        else if (newStatus === 'advance_paid') paidOnTime = true;
        else paidOnTime = undefined;

        const updated = { ...selectedPeriod, status: newStatus, paidOnTime };

        if (existingIdx >= 0) {
            updatedPeriods[existingIdx] = updated;
        } else {
            updatedPeriods.push(updated);
            updatedPeriods.sort((a, b) => a.index - b.index);
        }

        // ── Aggregate derived from the ENGINE over the full timeline ──
        // (the old code aggregated over stored rows only — marking period 5
        // of 12 paid reported "PAID_FULLY" for the unit). The stored
        // serviceChargeStatus / outstandingServiceChargeBalance are what the
        // tenant portal + messaging surfaces read, so keep them live.
        let aggregateStatus: 'PAID_FULLY' | 'PARTIALLY_PAID' | 'UNPAID' = 'UNPAID';
        let outstandingBalance: number | undefined;
        if (selectedChargeType === 'SC') {
            const mergedRental = { ...rental, scPeriods: updatedPeriods };
            const { summary } = serviceChargeTimeline({ unit, rental: mergedRental });
            if (summary.state === 'clear') aggregateStatus = 'PAID_FULLY';
            else if (summary.state === 'due' || summary.state === 'overdue') {
                aggregateStatus = scPeriods.some(p => p.status === 'paid' || p.status === 'advance_paid')
                    || updatedPeriods.some(p => p.status === 'paid' || p.status === 'advance_paid')
                    ? 'PARTIALLY_PAID' : 'UNPAID';
            }
            outstandingBalance = Math.round(summary.outstandingTotal);
        }

        const updatedRental = {
            ...rental,
            [periodsKey]: updatedPeriods,
            ...(selectedChargeType === 'SC' ? {
                serviceChargeStatus: aggregateStatus,
                outstandingServiceChargeBalance: outstandingBalance,
            } : {}),
        } as Property['rentalDetails'];
        onUpdate(updatedRental!);
        setSelectedPeriod(updated);

        // ── ZERO-TOUCH RECEIPT AUTOMATION ──
        // baseRental carries this tick's mark + derived aggregates — the
        // receipt persists on TOP of it, never on a stale snapshot.
        if ((newStatus === 'paid' || newStatus === 'late' || newStatus === 'advance_paid') && !updated.receiptNumber) {
            autoIssueReceipt(updated, selectedChargeType, periodsKey, updatedRental);
        }
    }, [selectedPeriod, selectedChargeType, rental, unit, onUpdate, autoIssueReceipt, scPeriods]);

    const handleGenerateReceipt = useCallback(() => {
        if (!selectedPeriod) return;
        setReceiptModalOpen(true);
    }, [selectedPeriod]);

    // ── ADVANCE PAYMENT — "they paid six months in advance" ─────────────
    // ONE payment, N cycles, ONE receipt. The anchor period is settled by
    // the payment plus the following N-1 cycles; each covered row is stored
    // advance_paid and stamped with the SAME receipt number after delivery.
    const handleAdvancePayment = useCallback((cycles: number) => {
        if (!selectedPeriod) return;
        const periodsKey = selectedChargeType === 'SC' ? 'scPeriods' : 'mvPeriods';
        const cadence: CadenceResolution = selectedChargeType === 'SC'
            ? scCadence
            : { months: 1, perPeriodAmount: mvAmount, frequency: 'Monthly', explicit: false };
        const cov = advanceCoverageLabel(selectedPeriod.dueDate, cycles, cadence.months);
        const rows = buildAdvanceRows({ anchor: selectedPeriod, cycles, cadence });

        // Merge into the stored ledger by index (same-index rows are
        // replaced by the advance row; everything else is untouched).
        const currentPeriods = ((rental as any)?.[periodsKey] as any[]) || [];
        const byIndex = new Map<number, any>();
        for (const p of currentPeriods) {
            const idx = Number(p?.index) || 0;
            if (idx > 0) byIndex.set(idx, p);
        }
        for (const r of rows) {
            byIndex.set(r.index, { ...byIndex.get(r.index), ...r, coverageNote: cov.label });
        }
        const updatedPeriods = Array.from(byIndex.values())
            .sort((a, b) => (a.index || 0) - (b.index || 0));

        // SC aggregates stay live off the engine (tenant portal reads them).
        let aggregateStatus: 'PAID_FULLY' | 'PARTIALLY_PAID' | 'UNPAID' | undefined;
        let outstandingBalance: number | undefined;
        if (selectedChargeType === 'SC') {
            const mergedRental = { ...rental, scPeriods: updatedPeriods };
            const { summary } = serviceChargeTimeline({ unit, rental: mergedRental });
            if (summary.state === 'clear') aggregateStatus = 'PAID_FULLY';
            else if (summary.state === 'due' || summary.state === 'overdue') {
                aggregateStatus = updatedPeriods.some(p => p.status === 'paid' || p.status === 'advance_paid')
                    ? 'PARTIALLY_PAID' : 'UNPAID';
            }
            outstandingBalance = Math.round(summary.outstandingTotal);
        }

        const updatedRental = {
            ...rental,
            [periodsKey]: updatedPeriods,
            ...(selectedChargeType === 'SC' ? {
                serviceChargeStatus: aggregateStatus,
                outstandingServiceChargeBalance: outstandingBalance,
            } : {}),
        } as Property['rentalDetails'];
        onUpdate(updatedRental!);

        const todayIso = new Date().toISOString().split('T')[0];
        setSelectedPeriod(prev => prev ? {
            ...prev, status: 'advance_paid' as const, isAdvance: true,
            paidOnTime: true, paidDate: todayIso,
        } : prev);

        // ONE receipt for the whole range — amount = cycles × per-cycle.
        const unitWord = cadence.months === 1
            ? (cycles === 1 ? 'month' : 'months')
            : (cycles === 1 ? 'cycle' : 'cycles');
        autoIssueReceipt(
            { ...selectedPeriod, status: 'advance_paid' as const, isAdvance: true, paidOnTime: true, paidDate: todayIso, amount: cadence.perPeriodAmount * cycles },
            selectedChargeType,
            periodsKey,
            updatedRental,
            { cycles, label: cov.label, unit: unitWord, indexes: rows.map(r => r.index) },
        );
    }, [selectedPeriod, selectedChargeType, rental, unit, scCadence, mvAmount, onUpdate, autoIssueReceipt]);

    // Persist a receipt number to the stored period (button toggles to
    // [View Issued Receipt]). Upsert — a mark that hasn't been persisted
    // yet still gets its receipt number instead of losing it.
    const handleReceiptIssued = useCallback((receiptNumber: string) => {
        if (!selectedPeriod) return;
        const periodsKey = selectedChargeType === 'SC' ? 'scPeriods' : 'mvPeriods';
        const currentPeriods = ((rental as any)?.[periodsKey] as any[]) || [];
        const updatedPeriods = upsertReceiptNumber(currentPeriods, selectedPeriod.index, receiptNumber);
        const updatedRental = {
            ...rental,
            [periodsKey]: updatedPeriods,
        } as Property['rentalDetails'];
        onUpdate(updatedRental!);
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

    // Nothing tracked on any stream → render nothing.
    if (scPeriods.length === 0 && mvPeriods.length === 0 && rentPeriods.length === 0) {
        // Lease data exists but no timeline? Prompt for lease dates — silence
        // is worse than a nudge (the old UI simply vanished).
        if (scAmount > 0 && !leaseStart) {
            return (
                <span className="inline-flex items-center gap-0.5 text-3xs font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400" title="Service charge exists but no lease start date is set — add lease dates so the billing timeline can track it.">
                    SC · set lease dates
                </span>
            );
        }
        return null;
    }

    // ── Row renderer (expanded): label + frequency hint + overflow + pills ──
    const renderStrip = (
        label: string,
        hint: string,
        periods: TimelinePeriod[],
        chargeType: 'SC' | 'MV' | 'RENT',
        onClickPeriod?: (p: TimelinePeriod) => void,
    ) => {
        if (periods.length === 0) return null;
        const overflow = periods.length - MAX_VISIBLE_PILLS;
        const visible = overflow > 0 ? periods.slice(overflow) : periods;
        return (
            <div className="flex items-start gap-1.5 flex-wrap">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-3xs flex-shrink-0 pt-1" title={hint}>{label}</span>
                <div className="flex flex-wrap items-start gap-x-1 gap-y-1">
                    {overflow > 0 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); const p = periods[0]; onClickPeriod ? onClickPeriod(p) : undefined; }}
                            className="text-3xs font-black text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 rounded-full px-1.5 py-0.5 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                            title={`${overflow} earlier period${overflow > 1 ? 's' : ''} (since ${monthLabel(periods[0].dueDate)})`}
                        >
                            +{overflow}
                        </button>
                    )}
                    {visible.map(period => (
                        <StatusPill
                            key={`${period.index}-${period.dueDate}`}
                            period={period}
                            chargeType={chargeType}
                            onClick={onClickPeriod ? () => onClickPeriod(period) : undefined}
                        />
                    ))}
                </div>
            </div>
        );
    };

    const scHint = `Service Charge · ${formatNairaCompact(scCadence.perPeriodAmount)}/${scCadence.months === 1 ? 'mo' : `${scCadence.months}mo cycle`}${scCadence.explicit ? '' : ' (monthly tracking)'}`;
    const rentHint = `Rent · ${formatNairaCompact(Number(rental?.rentAmount) || 0)} per ${rentFrequency ? rentFrequency.toLowerCase() : 'period'}`;
    const mvHint = `${mvLabel} · ${formatNairaCompact(mvAmount)}/mo (monthly tracking)`;

    return (
        <div className="space-y-1.5">
            {expanded ? (
                <>
                    <TimelineLegend />
                    {renderStrip('RENT', rentHint, rentPeriods, 'RENT', onCollectRent ? () => onCollectRent() : undefined)}
                    {renderStrip('SC', scHint, scPeriods, 'SC', (p) => handleBarClick(p, 'SC'))}
                    {mvEnabled && renderStrip('MV', mvHint, mvPeriods, 'MV', (p) => handleBarClick(p, 'MV'))}
                </>
            ) : (
                <div className="flex items-center gap-1.5 flex-wrap">
                    <TimelineStatusChip chargeLabel="SC" chargeType="SC" summary={scSummary} onClick={() => {
                        const target = scSummary.currentPeriod || scPeriods[scPeriods.length - 1];
                        if (target) handleBarClick(target, 'SC');
                    }} />
                    <TimelineStatusChip chargeLabel="RENT" chargeType="RENT" summary={rentSummary} onClick={onCollectRent} />
                    {mvEnabled && <TimelineStatusChip chargeLabel="MV" chargeType="MV" summary={mvSummary} onClick={() => {
                        const target = mvSummary.currentPeriod || mvPeriods[mvPeriods.length - 1];
                        if (target) handleBarClick(target, 'MV');
                    }} />}
                </div>
            )}

            {/* Quick Payment Drawer */}
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
                    onAdvancePayment={handleAdvancePayment}
                    cadenceMonths={selectedChargeType === 'SC' ? scCadence.months : 1}
                    perPeriodAmount={selectedChargeType === 'SC' ? scCadence.perPeriodAmount : mvAmount}
                />
            )}

            {/* ReceiptModal — opened by [Generate Receipt] / [View Issued Receipt]
                in the Quick Payment Drawer. */}
            {receiptModalOpen && selectedPeriod && (
                <ReceiptModal
                    period={selectedPeriod as any}
                    chargeType={selectedChargeType}
                    unitName={rental?.unitName || unit.description || 'Unit'}
                    tenantName={rental?.tenantName || 'Resident'}
                    unitId={unit.id}
                    coverageNote={(selectedPeriod as any).coverageNote}
                    onClose={() => setReceiptModalOpen(false)}
                    onIssued={handleReceiptIssued}
                />
            )}
        </div>
    );
};

export default ServiceChargeBars;
