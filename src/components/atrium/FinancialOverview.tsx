/**
 * FinancialOverview — ROUND F (Wave F1): the financial overview console.
 * ─────────────────────────────────────────────────────────────────────────────
 * The owner brief §1 gap: one filterable control center for the money. The
 * pieces existed (Round B cash-flow, Round E per-property rollups, real
 * outstanding balances) but no single surface answered "what came in, what
 * is at risk, what is awaiting review, what is unapplied, what happened
 * lately" in one view. This is that surface — the first tab of Financials.
 *
 * Conventions honored here:
 *   - READ-ONLY. Every figure comes from the server (getFinancialOverview);
 *     nothing is recomputed client-side, so the console can never disagree
 *     with the ledger it reads.
 *   - ui/ primitives ONLY (Badge / EmptyState) — zero raw interactive
 *     elements (ADR-0004 ratchet).
 *   - Staff-only: requireStaffCaller + firm scoping is enforced server-side.
 *   - Active records only: voided/test rows are annotations, not money —
 *     excluded server-side, so they never appear here as income or risk.
 */
import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { Badge, EmptyState } from '../ui';
import { formatNaira } from '../../utils/formatting';
import {
    TrendingUp, AlertTriangle, ArrowLeftRight, Inbox, Wallet, Clock,
} from 'lucide-react';

export interface FinancialOverviewProps {
    firmId: string;
}

const monthLabel = (key: string) => {
    const [y, m] = key.split('-');
    const idx = Number(m) - 1;
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${names[idx] ?? m} ${String(y).slice(2)}`;
};

const statusTone = (s: string): 'success' | 'warning' | 'danger' | 'neutral' => {
    if (s === 'cleared') return 'success';
    if (s === 'pending') return 'warning';
    if (s === 'defaulted') return 'danger';
    return 'neutral';
};

export const FinancialOverview: React.FC<FinancialOverviewProps> = ({ firmId }) => {
    const { currentUser, bearerToken } = useAuth() as { currentUser: any; bearerToken: string | null };
    const overview: any = useQuery(
        api.financialReporting.getFinancialOverview,
        firmId ? { firmId, userEmail: currentUser?.email, sessionToken: bearerToken ?? undefined } : 'skip'
    );

    if (overview === undefined) {
        return (
            <div className="p-6 text-sm text-slate-500 dark:text-zinc-400">
                Loading the financial overview…
            </div>
        );
    }
    if (!overview) {
        return (
            <EmptyState
                title="Financial overview unavailable"
                description="The overview could not be loaded for this firm."
                icon={<TrendingUp className="w-8 h-8" />}
            />
        );
    }

    const cf = overview.cashFlow ?? {};
    const sc = overview.serviceCharges ?? {};
    const proofs = overview.proofs ?? {};
    const unallocated = overview.unallocated ?? {};
    const monthly = (cf.monthlyData ?? {}) as Record<string, { income: number; risk: number }>;
    const months = Object.keys(monthly);
    const maxMonthly = Math.max(1, ...months.map((k) => Number(monthly[k].income) + Number(monthly[k].risk)));
    const recent: any[] = overview.recentActivity ?? [];

    return (
        <div className="space-y-6">
            {/* ── Money-at-a-glance tiles ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-4">
                    <p className="text-2xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Income (cleared)
                    </p>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{formatNaira(Number(cf.totalIncome ?? 0))}</p>
                    <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">{cf.totalTransactions ?? 0} active records · {cf.clearedCount ?? 0} cleared</p>
                </div>
                <div className="rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-4">
                    <p className="text-2xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> At risk
                    </p>
                    <p className={`text-xl font-black mt-1 ${Number(cf.revenueAtRisk ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                        {formatNaira(Number(cf.revenueAtRisk ?? 0))}
                    </p>
                    <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">{cf.pendingCount ?? 0} pending · {cf.defaultedCount ?? 0} defaulted</p>
                </div>
                <div className="rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-4">
                    <p className="text-2xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                        <Inbox className="w-3 h-3" /> Service charge outstanding
                    </p>
                    <p className={`text-xl font-black mt-1 ${Number(sc.outstanding ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {formatNaira(Number(sc.outstanding ?? 0))}
                    </p>
                    <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        {sc.unpaid ?? 0} unpaid · {sc.partiallyPaid ?? 0} partial · {sc.defaulters ?? 0} defaulters
                    </p>
                </div>
                <div className="rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-4">
                    <p className="text-2xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                        <Wallet className="w-3 h-3" /> Unapplied credit
                    </p>
                    <p className={`text-xl font-black mt-1 ${Number(unallocated.creditsWaiting ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                        {formatNaira(Number(unallocated.creditsWaiting ?? 0))}
                    </p>
                    <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        {unallocated.proofsAwaitingReview ?? 0} proofs awaiting review
                    </p>
                </div>
            </div>

            {/* ── Collections funnel: last 6 months (income vs at-risk) ── */}
            <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <ArrowLeftRight className="w-4 h-4" /> Last 6 months
                </p>
                <div className="rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-4 space-y-2.5">
                    {months.map((k) => {
                        const income = Number(monthly[k].income) + Number(monthly[k].risk) > 0
                            ? Number(monthly[k].income) / maxMonthly * 100
                            : 0;
                        const risk = Number(monthly[k].risk) > 0
                            ? Number(monthly[k].risk) / maxMonthly * 100
                            : 0;
                        return (
                            <div key={k} className="flex items-center gap-3">
                                <span className="text-2xs font-bold text-slate-500 dark:text-zinc-400 w-14 flex-shrink-0">{monthLabel(k)}</span>
                                <div className="flex-1 h-3.5 rounded-full bg-slate-100 dark:bg-zinc-900 overflow-hidden flex">
                                    <div className="h-full bg-emerald-500 dark:bg-emerald-600" style={{ width: `${income}%` }} />
                                    <div className="h-full bg-amber-400 dark:bg-amber-600" style={{ width: `${risk}%` }} />
                                </div>
                                <span className="text-2xs font-semibold text-slate-600 dark:text-zinc-300 w-28 text-right truncate">
                                    {formatNaira(Number(monthly[k].income))} in
                                    {Number(monthly[k].risk) > 0 ? ` · ${formatNaira(Number(monthly[k].risk))} risk` : ''}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Collections by type + outstanding by category ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500 mb-2">Collections by type</p>
                    {(overview.collections?.byType ?? []).length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-zinc-400">Nothing collected yet.</p>
                    ) : (
                        <div className="space-y-1.5">
                            {(overview.collections?.byType ?? []).map((t: any) => (
                                <div key={String(t.type)} className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-semibold text-slate-800 dark:text-white truncate">{String(t.type)}</span>
                                    <span className="text-sm font-bold text-slate-800 dark:text-white flex-shrink-0">
                                        {formatNaira(Number(t.amount))}
                                        <span className="text-2xs font-normal text-slate-400 dark:text-zinc-500 ml-1.5">({t.count})</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500 mb-2">Service charge outstanding by category</p>
                    {(sc.byCategory ?? []).length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-zinc-400">No unsettled charges.</p>
                    ) : (
                        <div className="space-y-1.5">
                            {(sc.byCategory ?? []).map((c: any) => (
                                <div key={String(c.category)} className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-semibold text-slate-800 dark:text-white truncate">{String(c.category)}</span>
                                    <span className="text-sm font-bold text-red-600 dark:text-red-400 flex-shrink-0">
                                        {formatNaira(Number(c.outstanding))}
                                        <span className="text-2xs font-normal text-slate-400 dark:text-zinc-500 ml-1.5">({c.count})</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Proof review queue + recent activity ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500 mb-2">Payment proofs</p>
                    <div className="flex flex-wrap gap-2">
                        <Badge tone="warning">{proofs.pendingReview ?? 0} pending review</Badge>
                        <Badge tone="info">{proofs.pendingVerification ?? 0} pending verification</Badge>
                        <Badge tone="neutral">{proofs.rejected ?? 0} rejected</Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                        Review them in the Payment Proofs tab; approvals book to the ledger atomically (Round B).
                    </p>
                </div>
                <div className="rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500 mb-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Recent activity
                    </p>
                    {recent.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-zinc-400">No ledger activity yet.</p>
                    ) : (
                        <div className="space-y-1.5">
                            {recent.slice(0, 8).map((r) => (
                                <div key={String(r.id)} className="flex items-center justify-between gap-3">
                                    <span className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                                        {new Date(Number(r.timestamp)).toLocaleDateString()} · {String(r.type)}
                                        {r.channel ? ` · ${String(r.channel)}` : ''}
                                    </span>
                                    <span className="flex items-center gap-1.5 flex-shrink-0">
                                        <Badge tone={statusTone(String(r.status))}>{String(r.status)}</Badge>
                                        <span className="text-sm font-bold text-slate-800 dark:text-white">{formatNaira(Number(r.amount))}</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FinancialOverview;
