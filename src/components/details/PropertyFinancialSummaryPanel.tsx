import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

/**
 * PropertyFinancialSummaryPanel — ROUND E (Wave E3): the server-computed
 * per-property financial rollup, rendered in PropertyDetailView's
 * financials tab.
 * ─────────────────────────────────────────────────────────────────────────
 * The StatCards above this panel read the DENORMALIZED rentalDetails
 * snapshot (contracted figures); this panel is the LEDGER TRUTH —
 * actually-cleared money, shape-proof service-charge balances (a charge
 * stored under the custom unit id matches this property's Convex-_id
 * rows through the E1 resolver), receipts from rent history, E1 tenancy
 * occupancy, and maintenance counts. Voided/test ledger records are
 * excluded server-side (annotations, not money).
 *
 * Conventions (Round E doctrine): staff-only + firm-scoped read
 * (requireStaffCaller + assertSameFirm inside the query), ui/ primitives
 * only, read-only, hides itself while loading or when the query is
 * skipped (no empty shells).
 */

interface SummaryUnit {
    key: string;
    label: string;
    status: string | null;
    tenantName: string | null;
    rentAmount: number;
    rentFrequency: string | null;
    activeTenancy: boolean;
    chargesOutstanding: number;
    receiptsPaid: number;
    receiptsCount: number;
}

interface FinancialSummary {
    property: {
        _id: string;
        id: string | null;
        address: string | null;
        rentCollectionMode: string | null;
        managementFeePercentage: number;
    };
    units: SummaryUnit[];
    counts: {
        units: number;
        activeTenancies: number;
        totalTenancies: number;
        statusOccupied: number;
        statusVacant: number;
    };
    ledger: {
        cleared: number;
        pending: number;
        defaulted: number;
        voidedExcluded: number;
        testExcluded: number;
        byType: Record<string, { cleared: number; pending: number; defaulted: number; total: number }>;
    };
    rentCollected: { ytdLedger: number };
    receipts: { count: number; totalPaid: number; ytdPaid: number };
    serviceCharges: {
        count: number;
        unpaid: number;
        partial: number;
        paid: number;
        defaulters: number;
        outstanding: number;
        creditCarriedForward: number;
    };
    maintenance: { total: number; open: number };
}

const naira = (n: number): string => `₦${(Number(n) || 0).toLocaleString('en-NG')}`;

export const PropertyFinancialSummaryPanel: React.FC<{ propertyId: string }> = ({ propertyId }) => {
    const { currentUser, bearerToken } = useAuth();
    const { coreState } = useCoreState();
    const firmId = coreState.firmDetails?.id || (currentUser as any)?.firmId || '';

    const summary = useQuery(
        api.tenancyLifecycle.getPropertyFinancialSummary,
        firmId && propertyId
            ? { firmId, propertyId, userEmail: currentUser?.email, sessionToken: bearerToken ?? undefined }
            : 'skip'
    ) as FinancialSummary | undefined;

    if (summary === undefined) {
        return (
            <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );
    }

    const sc = summary.serviceCharges;
    const hasSc = sc.count > 0;

    return (
        <Card variant="widget" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-white tracking-tight">
                        Financial Summary — Ledger Truth
                    </h4>
                    <p className="text-3xs text-slate-400 dark:text-zinc-500 mt-0.5">
                        Server-computed across every unit id shape · voided &amp; test records excluded
                        {summary.ledger.voidedExcluded + summary.ledger.testExcluded > 0
                            ? ` (${summary.ledger.voidedExcluded} voided, ${summary.ledger.testExcluded} test)`
                            : ''}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge tone="info" size="xs">{summary.counts.units} unit{summary.counts.units === 1 ? '' : 's'}</Badge>
                    <Badge tone={summary.counts.activeTenancies > 0 ? 'success' : 'neutral'} size="xs">
                        {summary.counts.activeTenancies} active lease{summary.counts.activeTenancies === 1 ? '' : 's'}
                    </Badge>
                    {summary.maintenance.open > 0 && (
                        <Badge tone="warning" size="xs">{summary.maintenance.open} open maintenance</Badge>
                    )}
                </div>
            </div>

            {/* Money roll — cleared / outstanding / receipts / SC outstanding */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 p-3">
                    <p className="text-2xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Collected (cleared)</p>
                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-400 mt-1">{naira(summary.ledger.cleared)}</p>
                    <p className="text-3xs text-slate-400 mt-0.5">{naira(summary.rentCollected.ytdLedger)} rent YTD</p>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-3">
                    <p className="text-2xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Outstanding (ledger)</p>
                    <p className="text-lg font-black text-amber-700 dark:text-amber-400 mt-1">{naira(summary.ledger.pending + summary.ledger.defaulted)}</p>
                    <p className="text-3xs text-slate-400 mt-0.5">
                        {naira(summary.ledger.pending)} pending · {naira(summary.ledger.defaulted)} defaulted
                    </p>
                </div>
                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-3">
                    <p className="text-2xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Receipts (rent history)</p>
                    <p className="text-lg font-black text-blue-700 dark:text-blue-400 mt-1">{naira(summary.receipts.totalPaid)}</p>
                    <p className="text-3xs text-slate-400 mt-0.5">{summary.receipts.count} receipt{summary.receipts.count === 1 ? '' : 's'} · {naira(summary.receipts.ytdPaid)} YTD</p>
                </div>
                <div className="rounded-lg bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 p-3">
                    <p className="text-2xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Service charge due</p>
                    <p className="text-lg font-black text-rose-700 dark:text-rose-400 mt-1">{naira(sc.outstanding)}</p>
                    <p className="text-3xs text-slate-400 mt-0.5">
                        {sc.unpaid} unpaid · {sc.partial} partial · {sc.paid} paid{sc.creditCarriedForward > 0 ? ` · ${naira(sc.creditCarriedForward)} credit` : ''}
                    </p>
                </div>
            </div>

            {/* Per-unit table */}
            {summary.units.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-zinc-500 italic py-4 text-center">
                    No unit rows resolved for this property group.
                </p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 font-bold uppercase text-2xs">
                            <tr>
                                <th className="px-3 py-2">Unit</th>
                                <th className="px-3 py-2">Resident</th>
                                <th className="px-3 py-2 text-right">Rent</th>
                                <th className="px-3 py-2 text-right">Receipts</th>
                                <th className="px-3 py-2 text-right">SC due</th>
                                <th className="px-3 py-2 text-center">Lease</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-700">
                            {summary.units.map((u) => (
                                <tr key={u.key} className="hover:bg-slate-50 dark:hover:bg-zinc-700/40">
                                    <td className="px-3 py-2 font-semibold text-slate-700 dark:text-zinc-200">
                                        <span className="mr-1.5">{u.label}</span>
                                        {u.activeTenancy ? (
                                            <Badge tone="success" size="xs">active</Badge>
                                        ) : u.status === 'Occupied' ? (
                                            <Badge tone="warning" size="xs">occupied*</Badge>
                                        ) : (
                                            <Badge tone="neutral" size="xs">{u.status || '—'}</Badge>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600 dark:text-zinc-400">{u.tenantName || '—'}</td>
                                    <td className="px-3 py-2 text-right text-slate-700 dark:text-zinc-200">
                                        {u.rentAmount > 0 ? naira(u.rentAmount) : '—'}
                                        {u.rentFrequency && u.rentAmount > 0 && (
                                            <span className="text-3xs text-slate-400 ml-1">/{u.rentFrequency === 'Annually' ? 'yr' : u.rentFrequency === 'Monthly' ? 'mo' : 'qtr'}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-600 dark:text-zinc-400">
                                        {u.receiptsCount > 0 ? `${u.receiptsCount} · ${naira(u.receiptsPaid)}` : '—'}
                                    </td>
                                    <td className={`px-3 py-2 text-right font-semibold ${u.chargesOutstanding > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                                        {u.chargesOutstanding > 0 ? naira(u.chargesOutstanding) : '—'}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {u.activeTenancy ? <Badge tone="success" size="xs">on ledger</Badge> : <span className="text-3xs text-slate-400">no ledger row</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <p className="text-3xs text-slate-400 dark:text-zinc-500 leading-relaxed">
                Figures computed server-side from ledger entries, service charges, rent receipts and the
                tenancy ledger — matched across all four unit-id shapes (custom id, Convex id, composite,
                bare unit). <span className="font-semibold">occupied*</span> = the denormalized unit status
                says occupied but no active tenancy ledger row exists (use the Tenancy Lifecycle console to
                record it). {hasSc ? `${sc.defaulters} defaulter${sc.defaulters === 1 ? '' : 's'} on service charges.` : 'No service charges recorded for this property yet.'}
            </p>
        </Card>
    );
};
