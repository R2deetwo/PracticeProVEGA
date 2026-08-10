/**
 * OnboardUnitLedgerModal — Quick-settle historical ledger during unit onboarding.
 *
 * When creating or editing a unit with an existing tenancy, this modal lets
 * property managers quickly mark all historical billing periods as paid
 * without needing to manually generate individual receipts for past offline
 * months.
 *
 * Features:
 *   1. Lists all elapsed billing periods (computed from leaseStart + frequency).
 *   2. Each period defaults to OUTSTANDING (red) with a status toggle.
 *   3. Bulk controls:
 *      - [Mark All as Paid On Time] → all historical periods → green
 *      - [Mark All as Paid Late] → all historical periods → orange
 *      - [Mark All as Outstanding] → reset to red
 *   4. Individual period toggle: Paid On Time / Paid Late / Outstanding.
 *   5. Advance payment support: [Add Advance Month] creates a future
 *      pre-paid period (blue pill).
 *   6. Saves to rentalDetails.scPeriods / mvPeriods on apply.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Property, ServiceChargePeriod } from '../../types';
import { formatNairaCompact, formatDateShort } from '../../utils/formatting';
import { XIcon, CheckCircleIcon, PlusIcon, DownloadIcon } from '../../constants';

// ─── Helpers (duplicated from ServiceChargeBars for independence) ────────────
const periodMonths = (freq?: string): number => {
    if (!freq) return 12;
    const f = freq.toLowerCase();
    if (f.includes('year') || f.includes('annual')) return 12;
    if (f.includes('bi') || f.includes('6-month') || f.includes('semi')) return 6;
    if (f.includes('quarter')) return 3;
    if (f.includes('month')) return 1;
    return 12;
};

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
    while (periodStart < endBoundary && idx <= 60) {
        periods.push({
            index: idx,
            dueDate: periodStart.toISOString().split('T')[0],
            status: 'outstanding',
            amount: perPeriodAmount,
        });
        periodStart = new Date(periodStart.getFullYear(), periodStart.getMonth() + periodM, periodStart.getDate());
        idx++;
    }
    return periods;
}

const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const getMonthYear = (iso: string) => {
    try { const d = new Date(iso); return `${FULL_MONTHS[d.getMonth()]} ${d.getFullYear()}`; } catch { return ''; }
};

const STATUS_META: Record<string, { color: string; name: string }> = {
    paid:         { color: 'bg-emerald-500', name: 'Paid On Time' },
    late:         { color: 'bg-amber-500',   name: 'Paid Late' },
    outstanding:  { color: 'bg-red-500',     name: 'Outstanding' },
    advance_paid: { color: 'bg-blue-500',    name: 'Advance Paid' },
};

// ─── Component ──────────────────────────────────────────────────────────────
interface OnboardUnitLedgerModalProps {
    unit: Property;
    chargeType: 'SC' | 'MV';
    onClose: () => void;
    onApply: (updatedPeriods: ServiceChargePeriod[]) => void;
}

export const OnboardUnitLedgerModal: React.FC<OnboardUnitLedgerModalProps> = ({
    unit, chargeType, onClose, onApply,
}) => {
    const rental = (unit.rentalDetails || unit) as Property['rentalDetails'];
    const leaseStart = rental?.leaseStart || '';
    const leaseEnd = rental?.leaseEnd;
    const frequency = rental?.rentFrequency;

    const scAmount = Number(rental?.serviceChargeAmount ?? rental?.serviceCharge ?? 0);
    const mvAmount = Number((unit as any).minimumVendAmount || 0);
    const perPeriodAmount = chargeType === 'SC' ? scAmount : mvAmount;

    const periodsKey = chargeType === 'SC' ? 'scPeriods' : 'mvPeriods';
    const storedPeriods = (rental?.[periodsKey] as ServiceChargePeriod[]) || [];

    // Compute initial periods (historical elapsed + stored advance)
    const initialPeriods = useMemo(() => {
        const elapsed = computeElapsedPeriods(leaseStart, leaseEnd, frequency, perPeriodAmount);
        const storedMap = new Map(storedPeriods.map(p => [p.index, p]));
        const merged = elapsed.map(p => {
            const s = storedMap.get(p.index);
            return s ? { ...p, status: s.status, paidDate: s.paidDate, paidOnTime: s.paidOnTime } : p;
        });
        // Append stored advance periods
        const advance = storedPeriods.filter(p => p.status === 'advance_paid' && p.index > elapsed.length);
        return [...merged, ...advance];
    }, [leaseStart, leaseEnd, frequency, perPeriodAmount, storedPeriods]);

    const [periods, setPeriods] = useState<ServiceChargePeriod[]>(initialPeriods);

    const handleStatusChange = useCallback((index: number, newStatus: 'paid' | 'late' | 'outstanding' | 'advance_paid') => {
        setPeriods(prev => prev.map(p => {
            if (p.index !== index) return p;
            const todayIso = new Date().toISOString().split('T')[0];
            let paidOnTime: boolean | undefined;
            if (newStatus === 'paid' || newStatus === 'late') {
                const dueMs = new Date(p.dueDate).getTime();
                const paidMs = new Date(todayIso).getTime();
                paidOnTime = paidMs <= dueMs;
            } else if (newStatus === 'advance_paid') {
                paidOnTime = true;
            } else {
                paidOnTime = undefined;
            }
            return {
                ...p,
                status: newStatus,
                paidDate: newStatus === 'paid' || newStatus === 'late' || newStatus === 'advance_paid' ? todayIso : undefined,
                paidOnTime,
                isAdvance: newStatus === 'advance_paid' ? true : undefined,
            };
        }));
    }, []);

    const handleBulkSettle = useCallback((status: 'paid' | 'late' | 'outstanding') => {
        const todayIso = new Date().toISOString().split('T')[0];
        setPeriods(prev => prev.map(p => {
            // Only bulk-settle non-advance periods
            if (p.isAdvance || p.status === 'advance_paid') return p;
            let paidOnTime: boolean | undefined;
            if (status === 'paid' || status === 'late') {
                const dueMs = new Date(p.dueDate).getTime();
                const paidMs = new Date(todayIso).getTime();
                paidOnTime = paidMs <= dueMs;
            } else {
                paidOnTime = undefined;
            }
            return {
                ...p,
                status,
                paidDate: status === 'paid' || status === 'late' ? todayIso : undefined,
                paidOnTime,
            };
        }));
    }, []);

    const handleAddAdvance = useCallback(() => {
        setPeriods(prev => {
            const maxIndex = Math.max(0, ...prev.map(p => p.index));
            const nextIndex = maxIndex + 1;
            // Calculate the due date for this future period
            if (!leaseStart) return prev;
            const start = new Date(leaseStart);
            const periodM = periodMonths(frequency);
            const futureStart = new Date(start.getFullYear(), start.getMonth() + (nextIndex - 1) * periodM, start.getDate());
            const todayIso = new Date().toISOString().split('T')[0];
            return [...prev, {
                index: nextIndex,
                dueDate: futureStart.toISOString().split('T')[0],
                status: 'advance_paid' as const,
                paidDate: todayIso,
                amount: perPeriodAmount,
                paidOnTime: true,
                isAdvance: true,
            }];
        });
    }, [leaseStart, frequency, perPeriodAmount]);

    const handleApply = useCallback(() => {
        onApply(periods);
        onClose();
    }, [periods, onApply, onClose]);

    const historicalCount = periods.filter(p => !p.isAdvance && p.status !== 'advance_paid').length;
    const advanceCount = periods.filter(p => p.isAdvance || p.status === 'advance_paid').length;
    const settledCount = periods.filter(p => p.status === 'paid' || p.status === 'late' || p.status === 'advance_paid').length;

    return (
        <div className="fixed inset-0 z-[4600] flex items-center justify-center p-4" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 sm:backdrop-blur-sm pointer-events-auto"
                onClick={onClose}
                aria-hidden="true"
            />
            {/* Modal */}
            <div
                className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-700/60 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex-shrink-0">
                    <div>
                        <p className="text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                            {chargeType} · Onboard Historical Ledger
                        </p>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">
                            Settle Past Periods
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                            {historicalCount} historical · {advanceCount} advance · {settledCount} settled
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
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Bulk settle controls */}
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-700/60">
                        <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                            Bulk Settle Historical Periods
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => handleBulkSettle('paid')}
                                className="px-2 py-2 text-2xs font-black uppercase tracking-wider rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                            >
                                All Paid On Time
                            </button>
                            <button
                                onClick={() => handleBulkSettle('late')}
                                className="px-2 py-2 text-2xs font-black uppercase tracking-wider rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                            >
                                All Paid Late
                            </button>
                            <button
                                onClick={() => handleBulkSettle('outstanding')}
                                className="px-2 py-2 text-2xs font-black uppercase tracking-wider rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                            >
                                Reset All
                            </button>
                        </div>
                    </div>

                    {/* Period list */}
                    <div className="space-y-2">
                        {periods.length === 0 && (
                            <p className="text-sm text-slate-400 italic text-center py-4">
                                No billing periods computed. Set a lease start date and frequency first.
                            </p>
                        )}
                        {periods.map(period => {
                            const meta = STATUS_META[period.status] || STATUS_META.outstanding;
                            return (
                                <div
                                    key={period.index}
                                    className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border ${
                                        period.isAdvance
                                            ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200/50 dark:border-blue-800/30'
                                            : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700'
                                    }`}
                                >
                                    {/* Period info */}
                                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                        <div className={`h-2.5 w-2.5 rounded-full ${meta.color} flex-shrink-0`} />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate">
                                                {getMonthYear(period.dueDate)}
                                            </p>
                                            <p className="text-2xs text-slate-400">
                                                {formatNairaCompact(period.amount)}
                                                {period.paidDate && ` · Paid ${formatDateShort(period.paidDate)}`}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Status toggle buttons */}
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {(['paid', 'late', 'outstanding', 'advance_paid'] as const).map(s => {
                                            const sm = STATUS_META[s];
                                            const isActive = period.status === s;
                                            return (
                                                <button
                                                    key={s}
                                                    onClick={() => handleStatusChange(period.index, s)}
                                                    className={`h-6 w-6 rounded-md transition-all ${
                                                        isActive
                                                            ? `${sm.color} ring-2 ring-offset-1 ring-offset-white dark:ring-offset-zinc-800 ring-slate-400`
                                                            : 'bg-slate-100 dark:bg-zinc-700 hover:opacity-70'
                                                    }`}
                                                    title={sm.name}
                                                    aria-label={sm.name}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Add advance period */}
                    <button
                        onClick={handleAddAdvance}
                        className="w-full px-3 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800/40 transition-colors flex items-center justify-center gap-1.5"
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                        Add Advance Pre-Paid Period
                    </button>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3 bg-white dark:bg-zinc-900">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApply}
                        className="px-6 py-2 text-sm font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <CheckCircleIcon className="w-3.5 h-3.5" />
                        Apply Ledger
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnboardUnitLedgerModal;
