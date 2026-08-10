/**
 * ServiceChargeBars — Interactive per-period progress bars for Service Charge (SC)
 * and Minimum Vend (MV).
 *
 * Renders one colored bar per elapsed billing period from leaseStart to now:
 *   🟩 Green  = Paid / Clear (settled on time)
 *   🟧 Orange = Late Payment / Default Warning (paid after due date)
 *   🟥 Red    = Outstanding / Overdue (unpaid past due date)
 *
 * Clicking any bar opens the Quick Payment Drawer where the user can toggle
 * the period's status between Paid / Late / Outstanding. When a period is
 * marked as Paid, an inline "[Generate & Issue Receipt]" prompt appears.
 *
 * Data model:
 *   Periods are computed from leaseStart + rentFrequency. The per-period
 *   status is persisted in rentalDetails.scPeriods / rentalDetails.mvPeriods.
 *   When no stored status exists for a period, it defaults to 'outstanding'.
 *
 * Integration:
 *   Shown on unit cards in PropertyDetailView, replacing the old static
 *   SC/MV badges. Vertically aligned with the Term Progress row (Calendar icon).
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Property, ServiceChargePeriod } from '../../types';
import { formatNairaCompact, formatDateShort } from '../../utils/formatting';
import NairaSymbol from '../NairaSymbol';
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
            status: 'outstanding', // default; will be overridden by stored data
            amount: perPeriodAmount,
        });
        periodStart += periodMs;
        idx++;
    }
    return periods;
}

/**
 * Merge computed periods with stored status data.
 * Stored periods are matched by index. If no stored data exists, the period
 * defaults to 'outstanding'.
 */
function mergePeriods(
    computed: ServiceChargePeriod[],
    stored: ServiceChargePeriod[] | undefined,
): ServiceChargePeriod[] {
    if (!stored || stored.length === 0) return computed;
    const storedMap = new Map(stored.map(p => [p.index, p]));
    return computed.map(p => {
        const s = storedMap.get(p.index);
        return s ? { ...p, status: s.status, paidDate: s.paidDate } : p;
    });
}

// ─── Status colors ──────────────────────────────────────────────────────────
const STATUS_COLORS = {
    paid:        { bar: 'bg-emerald-500', hover: 'hover:bg-emerald-600', label: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', name: 'Paid' },
    late:        { bar: 'bg-amber-500',   hover: 'hover:bg-amber-600',   label: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/20',   name: 'Late' },
    outstanding: { bar: 'bg-red-500',     hover: 'hover:bg-red-600',     label: 'text-red-600 dark:text-red-400',       bg: 'bg-red-50 dark:bg-red-900/20',       name: 'Outstanding' },
} as const;

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
    const colors = STATUS_COLORS[period.status];

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[4500] bg-black/40 sm:backdrop-blur-sm"
                onClick={onClose}
            />
            {/* Drawer — slides in from the right */}
            <div
                className="fixed top-0 right-0 bottom-0 z-[4501] w-full sm:max-w-md bg-white dark:bg-zinc-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex-shrink-0">
                    <div>
                        <p className="text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                            {chargeType} · Period {period.index}
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
                    {/* Amount */}
                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-700/60">
                        <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                            Charge Amount
                        </p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">
                            <NairaSymbol />{formatNairaCompact(period.amount)}
                        </p>
                    </div>

                    {/* Current status */}
                    <div className={`p-3 rounded-lg ${colors.bg} border border-transparent`}>
                        <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                            Current Status
                        </p>
                        <p className={`text-sm font-black uppercase ${colors.label}`}>
                            {colors.name}
                        </p>
                        {period.paidDate && (
                            <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-1">
                                Paid on {formatDateShort(period.paidDate)}
                            </p>
                        )}
                    </div>

                    {/* Toggle buttons */}
                    <div>
                        <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                            Change Status
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            {(['paid', 'late', 'outstanding'] as const).map(s => {
                                const c = STATUS_COLORS[s];
                                const isActive = period.status === s;
                                return (
                                    <button
                                        key={s}
                                        onClick={() => onStatusChange(s)}
                                        className={`px-3 py-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all border-2 ${
                                            isActive
                                                ? `${c.bar} text-white border-transparent shadow-md`
                                                : `bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600`
                                        }`}
                                    >
                                        {c.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Receipt prompt — shown when status is 'paid' */}
                    {period.status === 'paid' && (
                        <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex items-start gap-3">
                                <div className="p-1.5 bg-emerald-600 text-white rounded-lg flex-shrink-0">
                                    <CheckCircleIcon className="w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                                        Payment Recorded
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

// ─── Main Component ─────────────────────────────────────────────────────────
interface ServiceChargeBarsProps {
    /** The unit (Property) to render bars for. */
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

    // Compute periods
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
        const updated: ServiceChargePeriod = {
            ...selectedPeriod,
            status: newStatus,
            paidDate: newStatus === 'paid' || newStatus === 'late'
                ? new Date().toISOString().split('T')[0]
                : undefined,
        };
        if (existingIdx >= 0) {
            updatedPeriods[existingIdx] = updated;
        } else {
            updatedPeriods.push(updated);
            updatedPeriods.sort((a, b) => a.index - b.index);
        }
        // Update the aggregate serviceChargeStatus based on all periods
        const allPaid = updatedPeriods.every(p => p.status === 'paid');
        const anyOutstanding = updatedPeriods.some(p => p.status === 'outstanding');
        let aggregateStatus: 'PAID_FULLY' | 'PARTIALLY_PAID' | 'UNPAID' = 'UNPAID';
        if (allPaid) aggregateStatus = 'PAID_FULLY';
        else if (anyOutstanding && updatedPeriods.some(p => p.status !== 'outstanding')) aggregateStatus = 'PARTIALLY_PAID';
        else if (anyOutstanding) aggregateStatus = 'UNPAID';
        else aggregateStatus = 'PARTIALLY_PAID';

        const updatedRental = {
            ...rental,
            [periodsKey]: updatedPeriods,
            // Only update aggregate SC status (not MV — MV doesn't have an aggregate field)
            ...(selectedChargeType === 'SC' ? { serviceChargeStatus: aggregateStatus } : {}),
        } as Property['rentalDetails'];
        onUpdate(updatedRental!);
        // Update the selected period in the drawer
        setSelectedPeriod(updated);
    }, [selectedPeriod, selectedChargeType, rental, onUpdate]);

    const handleGenerateReceipt = useCallback(() => {
        if (selectedPeriod && onGenerateReceipt) {
            onGenerateReceipt(selectedPeriod, selectedChargeType);
        }
        setDrawerOpen(false);
    }, [selectedPeriod, selectedChargeType, onGenerateReceipt]);

    // Render nothing if no SC and no MV
    if (scAmount <= 0 && (!mvEnabled || mvAmount <= 0)) return null;

    return (
        <>
            {/* SC Bars */}
            {scAmount > 0 && scPeriods.length > 0 && (
                <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-3xs w-6 flex-shrink-0">SC</span>
                    <div className="flex items-center gap-1 flex-wrap">
                        {scPeriods.map(period => {
                            const c = STATUS_COLORS[period.status];
                            return (
                                <button
                                    key={period.index}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleBarClick(period, 'SC');
                                    }}
                                    title={`Period ${period.index} · ${c.name} · Due ${formatDateShort(period.dueDate)}`}
                                    className={`h-2.5 w-8 rounded-full ${c.bar} ${c.hover} transition-all hover:scale-110 hover:shadow-sm cursor-pointer`}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* MV Bars */}
            {mvEnabled && mvAmount > 0 && mvPeriods.length > 0 && (
                <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-3xs w-6 flex-shrink-0">MV</span>
                    <span className="text-3xs font-bold text-slate-500 dark:text-zinc-400 mr-0.5">{mvLabel}</span>
                    <div className="flex items-center gap-1 flex-wrap">
                        {mvPeriods.map(period => {
                            const c = STATUS_COLORS[period.status];
                            return (
                                <button
                                    key={period.index}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleBarClick(period, 'MV');
                                    }}
                                    title={`Period ${period.index} · ${c.name} · Due ${formatDateShort(period.dueDate)}`}
                                    className={`h-2.5 w-8 rounded-full ${c.bar} ${c.hover} transition-all hover:scale-110 hover:shadow-sm cursor-pointer`}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Quick Payment Drawer */}
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
