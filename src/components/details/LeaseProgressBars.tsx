/**
 * LeaseProgressBars — Visual progress visualization for lease, rent & service charge.
 *
 * Renders up to three stacked horizontal progress bars:
 *   1. Lease Timeline — where "today" sits between leaseStart and leaseEnd
 *   2. Rent Collection — paid vs expected (so far) based on payment history
 *   3. Service Charge — paid vs expected for the current service charge cycle
 *
 * Design goals:
 *   - Mirror the visual language of the rest of the property detail UI
 *     (rounded-lg, slate/zinc surfaces, primary-600 accents).
 *   - Color-coded states: green = on-track, amber = approaching, red = overdue.
 *   - Compact: takes one card row, expands gracefully on wide screens.
 *   - Self-contained: receives a `Property` and derives everything else.
 *
 * Integration:
 *   Shown above the tab switcher in PropertyTrackingView for tenanted properties.
 */

import React, { useMemo } from 'react';
import { Property, RentPayment } from '../../types';
import { formatNairaCompact, formatNairaFull, formatDateShort } from '../../utils/formatting';
import NairaSymbol from '../NairaSymbol';

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

const clampPct = (n: number): number => Math.max(0, Math.min(100, n));

interface LeaseProgressBarsProps {
    property: Property;
    /** Optional override — when viewing a single unit, pass its rentalDetails. */
    unitRental?: Property['rentalDetails'];
    /** Optional override — when viewing a single unit, pass its payment history. */
    unitPayments?: RentPayment[];
}

export const LeaseProgressBars: React.FC<LeaseProgressBarsProps> = ({ property, unitRental, unitPayments }) => {
    const rental = unitRental || property.rentalDetails;
    const payments = unitPayments || property.rentPaymentHistory || [];

    // Management Only properties don't collect rent via the system — hide the
    // rent collection bar entirely. Only lease timeline + service charge show.
    const isManagementOnly = property.rentCollectionMode === 'Management Only (No Rent)';

    // ── 1. Lease Timeline progress ───────────────────────────────────────────
    const leaseTimeline = useMemo(() => {
        if (!rental?.leaseStart || !rental?.leaseEnd) return null;
        const start = new Date(rental.leaseStart).getTime();
        const end = new Date(rental.leaseEnd).getTime();
        const now = Date.now();
        if (end <= start) return null;

        const totalDays = Math.round((end - start) / MS_PER_DAY);
        const elapsedDays = Math.round((now - start) / MS_PER_DAY);
        const remainingDays = Math.round((end - now) / MS_PER_DAY);
        const elapsedPct = clampPct((elapsedDays / totalDays) * 100);

        let state: 'on-track' | 'approaching' | 'expired' = 'on-track';
        if (remainingDays < 0) state = 'expired';
        else if (remainingDays <= 60) state = 'approaching';

        return {
            start: rental.leaseStart!,
            end: rental.leaseEnd!,
            totalDays,
            elapsedDays,
            remainingDays,
            elapsedPct,
            state,
        };
    }, [rental?.leaseStart, rental?.leaseEnd]);

    // ── 2. Rent Collection progress ──────────────────────────────────────────
    const rentCollection = useMemo(() => {
        // Hide rent collection bar for Management Only properties
        if (isManagementOnly) return null;
        if (!rental?.rentAmount || !rental?.leaseStart) return null;
        const rentPerPeriod = rental.rentAmount;
        const periodM = periodMonths(rental.rentFrequency);
        const start = new Date(rental.leaseStart).getTime();
        const now = Date.now();

        // Number of complete periods elapsed since lease start (capped to lease end if present)
        const endBoundary = rental.leaseEnd ? Math.min(now, new Date(rental.leaseEnd).getTime()) : now;
        const elapsedMs = Math.max(0, endBoundary - start);
        const elapsedMonths = elapsedMs / (MS_PER_DAY * 30.44); // average month length
        const periodsElapsed = Math.max(0, Math.floor(elapsedMonths / periodM));

        const expectedSoFar = periodsElapsed * rentPerPeriod;
        const collectedSoFar = payments
            .filter(p => p.status === 'paid')
            .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        const outstanding = Math.max(0, expectedSoFar - collectedSoFar);
        const collectionPct = expectedSoFar > 0 ? clampPct((collectedSoFar / expectedSoFar) * 100) : 0;

        let state: 'on-track' | 'behind' | 'critical' = 'on-track';
        if (collectionPct < 50) state = 'critical';
        else if (collectionPct < 100) state = 'behind';

        return {
            rentPerPeriod,
            periodsElapsed,
            expectedSoFar,
            collectedSoFar,
            outstanding,
            collectionPct,
            state,
            hasPayments: payments.length > 0,
        };
    }, [isManagementOnly, rental?.rentAmount, rental?.rentFrequency, rental?.leaseStart, rental?.leaseEnd, payments]);

    // ── 3. Service Charge progress ───────────────────────────────────────────
    // Service charge is a per-cycle fee (e.g. annual vend/estate fee) tracked
    // separately from rent. The data model stores:
    //   - serviceCharge / serviceChargeAmount: the expected total for the cycle
    //   - serviceChargeStatus: 'PAID_FULLY' | 'PARTIALLY_PAID' | 'UNPAID'
    //   - outstandingServiceChargeBalance: remaining amount when partially paid
    //
    // When the expected amount is 0 or undefined, we render nothing for this bar.
    const serviceCharge = useMemo(() => {
        const expected = Number(rental?.serviceChargeAmount ?? rental?.serviceCharge ?? 0);
        if (!expected || expected <= 0) return null;

        const status = (rental?.serviceChargeStatus || 'UNPAID').toUpperCase();
        const outstandingBalance = Number(rental?.outstandingServiceChargeBalance ?? 0);

        let paid = 0;
        if (status === 'PAID_FULLY' || status === 'PAID') {
            paid = expected;
        } else if (status === 'PARTIALLY_PAID') {
            // If we have an explicit outstanding balance, derive paid from it.
            // Otherwise fall back to 0 (treat as nothing collected yet).
            paid = Math.max(0, expected - outstandingBalance);
        }
        // UNPAID → paid stays 0.

        const pct = expected > 0 ? clampPct((paid / expected) * 100) : 0;
        const remaining = Math.max(0, expected - paid);

        let state: 'on-track' | 'behind' | 'critical' = 'on-track';
        if (pct < 50) state = 'critical';
        else if (pct < 100) state = 'behind';

        return {
            expected,
            paid,
            remaining,
            pct,
            state,
            status,
        };
    }, [rental?.serviceChargeAmount, rental?.serviceCharge, rental?.serviceChargeStatus, rental?.outstandingServiceChargeBalance]);

    // If we have nothing to show, render nothing.
    if (!leaseTimeline && !rentCollection && !serviceCharge) return null;

    // ─── Color tokens ────────────────────────────────────────────────────────
    const timelineColor =
        leaseTimeline?.state === 'expired' ? 'bg-red-500' :
        leaseTimeline?.state === 'approaching' ? 'bg-amber-500' :
        'bg-emerald-500';
    const timelineTrack =
        leaseTimeline?.state === 'expired' ? 'bg-red-100 dark:bg-red-900/30' :
        leaseTimeline?.state === 'approaching' ? 'bg-amber-100 dark:bg-amber-900/30' :
        'bg-emerald-100 dark:bg-emerald-900/30';
    const timelineLabel =
        leaseTimeline?.state === 'expired' ? 'text-red-600 dark:text-red-400' :
        leaseTimeline?.state === 'approaching' ? 'text-amber-600 dark:text-amber-400' :
        'text-emerald-600 dark:text-emerald-400';

    const collectionColor =
        rentCollection?.state === 'critical' ? 'bg-red-500' :
        rentCollection?.state === 'behind' ? 'bg-amber-500' :
        'bg-emerald-500';
    const collectionTrack =
        rentCollection?.state === 'critical' ? 'bg-red-100 dark:bg-red-900/30' :
        rentCollection?.state === 'behind' ? 'bg-amber-100 dark:bg-amber-900/30' :
        'bg-emerald-100 dark:bg-emerald-900/30';
    const collectionLabel =
        rentCollection?.state === 'critical' ? 'text-red-600 dark:text-red-400' :
        rentCollection?.state === 'behind' ? 'text-amber-600 dark:text-amber-400' :
        'text-emerald-600 dark:text-emerald-400';

    const scColor =
        serviceCharge?.state === 'critical' ? 'bg-red-500' :
        serviceCharge?.state === 'behind' ? 'bg-amber-500' :
        'bg-emerald-500';
    const scTrack =
        serviceCharge?.state === 'critical' ? 'bg-red-100 dark:bg-red-900/30' :
        serviceCharge?.state === 'behind' ? 'bg-amber-100 dark:bg-amber-900/30' :
        'bg-emerald-100 dark:bg-emerald-900/30';
    const scLabel =
        serviceCharge?.state === 'critical' ? 'text-red-600 dark:text-red-400' :
        serviceCharge?.state === 'behind' ? 'text-amber-600 dark:text-amber-400' :
        'text-emerald-600 dark:text-emerald-400';

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-sm p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-primary-600 text-white rounded-lg shadow-sm">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                </div>
                <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">
                    Lease Progress
                </h3>
            </div>

            <div className="space-y-5">
                {/* ── Lease Timeline ── */}
                {leaseTimeline && (
                    <div>
                        <div className="flex items-baseline justify-between mb-1.5">
                            <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                                Lease Timeline
                            </p>
                            <p className={`text-xs font-bold ${timelineLabel}`}>
                                {leaseTimeline.state === 'expired' ? 'Expired' :
                                 leaseTimeline.state === 'approaching' ? 'Ending Soon' :
                                 'Active'}
                                {' · '}
                                {leaseTimeline.remainingDays < 0
                                    ? `${Math.abs(leaseTimeline.remainingDays)} days ago`
                                    : `${leaseTimeline.remainingDays} days left`}
                            </p>
                        </div>

                        {/* Bar with date markers */}
                        <div className="relative">
                            <div className={`h-2.5 rounded-full overflow-hidden ${timelineTrack}`}>
                                <div
                                    className={`h-full ${timelineColor} rounded-full transition-all duration-500`}
                                    style={{ width: `${leaseTimeline.elapsedPct}%` }}
                                />
                            </div>
                            {/* Today marker */}
                            {leaseTimeline.elapsedPct > 0 && leaseTimeline.elapsedPct < 100 && (
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5 h-4 bg-slate-700 dark:bg-white rounded-full"
                                    style={{ left: `${leaseTimeline.elapsedPct}%` }}
                                    title="Today"
                                />
                            )}
                        </div>
                        <div className="flex justify-between mt-1.5">
                            <span className="text-2xs text-slate-500 dark:text-zinc-400">
                                Start: <span className="font-semibold text-slate-700 dark:text-zinc-200">{formatDateShort(leaseTimeline.start)}</span>
                            </span>
                            <span className="text-2xs text-slate-500 dark:text-zinc-400">
                                End: <span className="font-semibold text-slate-700 dark:text-zinc-200">{formatDateShort(leaseTimeline.end)}</span>
                            </span>
                        </div>
                    </div>
                )}

                {/* ── Rent Collection ── */}
                {rentCollection && (
                    <div>
                        <div className="flex items-baseline justify-between mb-1.5">
                            <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                                Rent Collection
                            </p>
                            <p className={`text-xs font-bold ${collectionLabel}`}>
                                {rentCollection.collectionPct.toFixed(0)}% collected
                                {rentCollection.outstanding > 0 && (
                                    <> · <NairaSymbol />{formatNairaCompact(rentCollection.outstanding)} outstanding</>
                                )}
                            </p>
                        </div>

                        <div className={`h-2.5 rounded-full overflow-hidden ${collectionTrack}`}>
                            <div
                                className={`h-full ${collectionColor} rounded-full transition-all duration-500`}
                                style={{ width: `${rentCollection.collectionPct}%` }}
                            />
                        </div>

                        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 mt-1.5">
                            <span className="text-2xs text-slate-500 dark:text-zinc-400">
                                Collected: <span className="font-semibold text-emerald-600 dark:text-emerald-400"><NairaSymbol />{formatNairaCompact(rentCollection.collectedSoFar)}</span>
                            </span>
                            <span className="text-2xs text-slate-500 dark:text-zinc-400">
                                Expected ({rentCollection.periodsElapsed} period{rentCollection.periodsElapsed === 1 ? '' : 's'}): <span className="font-semibold text-slate-700 dark:text-zinc-200"><NairaSymbol />{formatNairaCompact(rentCollection.expectedSoFar)}</span>
                            </span>
                            {!rentCollection.hasPayments && (
                                <span className="text-2xs text-slate-400 italic">
                                    No payments recorded yet
                                </span>
                            )}
                        </div>

                        {/* Period rate chip — helps the user understand the math */}
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-700/60">
                            <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-2xs font-semibold text-slate-600 dark:text-zinc-300">
                                <NairaSymbol />{formatNairaFull(rentCollection.rentPerPeriod)} per {rental?.rentFrequency || 'period'}
                            </span>
                        </div>
                    </div>
                )}

                {/* ── Service Charge ── */}
                {serviceCharge && (
                    <div>
                        <div className="flex items-baseline justify-between mb-1.5">
                            <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                                Service Charge
                            </p>
                            <p className={`text-xs font-bold ${scLabel}`}>
                                {serviceCharge.pct.toFixed(0)}% collected
                                {serviceCharge.remaining > 0 && (
                                    <> · <NairaSymbol />{formatNairaCompact(serviceCharge.remaining)} outstanding</>
                                )}
                            </p>
                        </div>

                        <div className={`h-2.5 rounded-full overflow-hidden ${scTrack}`}>
                            <div
                                className={`h-full ${scColor} rounded-full transition-all duration-500`}
                                style={{ width: `${serviceCharge.pct}%` }}
                            />
                        </div>

                        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 mt-1.5">
                            <span className="text-2xs text-slate-500 dark:text-zinc-400">
                                Paid: <span className="font-semibold text-emerald-600 dark:text-emerald-400"><NairaSymbol />{formatNairaCompact(serviceCharge.paid)}</span>
                            </span>
                            <span className="text-2xs text-slate-500 dark:text-zinc-400">
                                Expected: <span className="font-semibold text-slate-700 dark:text-zinc-200"><NairaSymbol />{formatNairaCompact(serviceCharge.expected)}</span>
                            </span>
                            <span className={`text-2xs font-bold uppercase tracking-wider ${
                                serviceCharge.status === 'PAID_FULLY' || serviceCharge.status === 'PAID' ? 'text-emerald-600 dark:text-emerald-400' :
                                serviceCharge.status === 'PARTIALLY_PAID' ? 'text-amber-600 dark:text-amber-400' :
                                'text-red-600 dark:text-red-400'
                            }`}>
                                {serviceCharge.status === 'PAID_FULLY' || serviceCharge.status === 'PAID' ? 'Paid Fully' :
                                 serviceCharge.status === 'PARTIALLY_PAID' ? 'Partially Paid' :
                                 'Unpaid'}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LeaseProgressBars;
