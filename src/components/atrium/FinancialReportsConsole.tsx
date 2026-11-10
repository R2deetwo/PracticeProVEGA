/**
 * FinancialReportsConsole — ROUND F (Wave F3): the report suite.
 * ─────────────────────────────────────────────────────────────────────────────
 * The owner brief §5: rent roll, arrears aging, service-charge collections,
 * revenue by type, payment history, period comparison — each rendered from
 * the server's figures (getFinancialReports computes everything kobo-internally)
 * and exportable as CSV with one tap.
 *
 * Conventions honored here:
 *   - every figure is the server's — this console renders and exports, it
 *     never computes money.
 *   - ui/ primitives ONLY (Button / Badge / EmptyState) — ADR-0004.
 *   - staff-only: requireStaffCaller + firm scoping enforced server-side.
 */
import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { Badge, Button, EmptyState } from '../ui';
import { formatNaira } from '../../utils/formatting';
import { buildCsv, downloadCsv } from '../../utils/csvExport';
import { FileSpreadsheet, Building2, AlertTriangle, Layers, TrendingUp, Receipt, GitCompareArrows } from 'lucide-react';

export interface FinancialReportsConsoleProps {
    firmId: string;
}

type ReportId = 'rentRoll' | 'arrears' | 'collections' | 'revenue' | 'payments' | 'period';

const REPORTS: { id: ReportId; label: string; icon: React.ReactNode }[] = [
    { id: 'rentRoll', label: 'Rent roll', icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'arrears', label: 'Arrears aging', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    { id: 'collections', label: 'SC collections', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'revenue', label: 'Revenue by type', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'payments', label: 'Payment history', icon: <Receipt className="w-3.5 h-3.5" /> },
    { id: 'period', label: 'Period comparison', icon: <GitCompareArrows className="w-3.5 h-3.5" /> },
];

const day = (ms: any) => {
    const t = Number(ms);
    if (!isFinite(t) || !t) return '—';
    return new Date(t).toLocaleDateString();
};

export const FinancialReportsConsole: React.FC<FinancialReportsConsoleProps> = ({ firmId }) => {
    const { currentUser, bearerToken } = useAuth() as { currentUser: any; bearerToken: string | null };
    const [active, setActive] = useState<ReportId>('rentRoll');

    const reports: any = useQuery(
        api.financialReporting.getFinancialReports,
        firmId ? { firmId, userEmail: currentUser?.email, sessionToken: bearerToken ?? undefined } : 'skip'
    );

    if (reports === undefined) {
        return <div className="p-6 text-sm text-slate-500 dark:text-zinc-400">Loading the report suite…</div>;
    }
    if (!reports) {
        return <EmptyState title="Reports unavailable" description="The report suite could not be loaded for this firm." icon={<FileSpreadsheet className="w-8 h-8" />} />;
    }

    // ── CSV shapes per report (headers fix column order; figures come from
    //    the server response verbatim). ────────────────────────────────────
    const exporters: Record<ReportId, { filename: string; headers: string[]; rows: Record<string, unknown>[] }> = {
        rentRoll: {
            filename: 'rent-roll',
            headers: ['unitLabel', 'status', 'leaseActive', 'tenantName', 'rent', 'frequency', 'leaseStart', 'leaseEnd', 'lastPaymentAt', 'lastPaymentAmount', 'lastPaymentRef'],
            rows: (reports.rentRoll ?? []).map((r: any) => ({
                unitLabel: r.unitLabel,
                status: r.status ?? '',
                leaseActive: r.leaseActive ? 'yes' : 'no',
                tenantName: r.tenantName ?? '',
                rent: r.rent,
                frequency: r.frequency ?? '',
                leaseStart: r.leaseStart ?? '',
                leaseEnd: r.leaseEnd ?? '',
                lastPaymentAt: r.lastPaymentAt ? day(r.lastPaymentAt) : '',
                lastPaymentAmount: r.lastPaymentAmount ?? '',
                lastPaymentRef: r.lastPaymentRef ?? '',
            })),
        },
        arrears: {
            filename: 'arrears-aging',
            headers: ['category', 'unitId', 'daysOverdue', 'outstanding'],
            rows: (reports.arrearsAging?.rows ?? []).map((r: any) => ({
                category: r.category,
                unitId: r.unitId ?? '',
                daysOverdue: r.daysOverdue,
                outstanding: r.outstanding,
            })),
        },
        collections: {
            filename: 'sc-collections',
            headers: ['category', 'charges', 'cycleAmount', 'collectedThisCycle', 'outstanding'],
            rows: (reports.scCollections?.byCategory ?? []).map((c: any) => ({
                category: c.category,
                charges: c.charges,
                cycleAmount: c.cycleAmount,
                collectedThisCycle: c.collectedThisCycle,
                outstanding: c.outstanding,
            })),
        },
        revenue: {
            filename: 'revenue-by-type',
            headers: ['month', 'type', 'amount', 'status'],
            rows: (reports.revenueByType?.months ?? []).flatMap((m: any) => [
                ...(m.byType ?? []).map((t: any) => ({ month: m.key, type: t.type, amount: t.amount, status: 'cleared' })),
                ...(Number(m.risk) > 0 ? [{ month: m.key, type: '(at risk)', amount: m.risk, status: 'pending/defaulted' }] : []),
            ]),
        },
        payments: {
            filename: 'payment-history',
            headers: ['date', 'unitId', 'type', 'channel', 'paymentRef', 'amount'],
            rows: (reports.paymentHistory ?? []).map((p: any) => ({
                date: day(p.at),
                unitId: p.unitId ?? '',
                type: p.type,
                channel: p.channel ?? '',
                paymentRef: p.paymentRef ?? '',
                amount: p.amount,
            })),
        },
        period: {
            filename: 'period-comparison',
            headers: ['period', 'income', 'atRisk', 'transactions'],
            rows: [
                { period: `${reports.periodComparison?.current?.key ?? ''} (current)`, income: reports.periodComparison?.current?.income ?? 0, atRisk: reports.periodComparison?.current?.risk ?? 0, transactions: reports.periodComparison?.current?.count ?? 0 },
                { period: `${reports.periodComparison?.previous?.key ?? ''} (previous)`, income: reports.periodComparison?.previous?.income ?? 0, atRisk: reports.periodComparison?.previous?.risk ?? 0, transactions: reports.periodComparison?.previous?.count ?? 0 },
                { period: 'delta', income: reports.periodComparison?.delta?.income ?? 0, atRisk: reports.periodComparison?.delta?.risk ?? 0, transactions: reports.periodComparison?.delta?.count ?? 0 },
            ],
        },
    };

    const current = exporters[active];

    return (
        <div className="space-y-4">
            {/* ── Report picker ── */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {REPORTS.map((r) => (
                        <Button
                            key={r.id}
                            variant={active === r.id ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setActive(r.id)}
                        >
                            {r.icon} {r.label}
                        </Button>
                    ))}
                </div>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={() => downloadCsv(current.filename, buildCsv(current.rows, current.headers))}
                >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Export CSV
                </Button>
            </div>

            {/* ── Rent roll ── */}
            {active === 'rentRoll' && (
                <div className="space-y-1.5">
                    {(reports.rentRoll ?? []).length === 0 ? (
                        <EmptyState title="No units yet" description="The rent roll lists every unit in the firm with its lease state — add properties first." icon={<Building2 className="w-8 h-8" />} />
                    ) : (
                        (reports.rentRoll ?? []).map((r: any) => (
                            <div key={String(r.unitKey)} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 dark:bg-zinc-900/50 px-3 py-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                                        {r.unitLabel} · {r.tenantName ?? 'vacant'}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                                        {r.leaseStart || '—'} → {r.leaseEnd || '—'}
                                        {r.lastPaymentAt ? ` · last payment ${day(r.lastPaymentAt)}` : ' · no payment on the books'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Badge tone={r.leaseActive ? 'success' : 'neutral'}>{r.leaseActive ? 'leased' : String(r.status ?? 'vacant')}</Badge>
                                    <span className="text-sm font-bold text-slate-800 dark:text-white">{formatNaira(Number(r.rent))}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── Arrears aging ── */}
            {active === 'arrears' && (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {(reports.arrearsAging?.buckets ?? []).map((b: any) => (
                            <div key={b.label} className="rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-3">
                                <p className="text-2xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">{b.label}</p>
                                <p className={`text-lg font-black mt-0.5 ${Number(b.outstanding) > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                                    {formatNaira(Number(b.outstanding))}
                                </p>
                                <p className="text-2xs text-slate-500 dark:text-zinc-400">{b.count} charge(s)</p>
                            </div>
                        ))}
                    </div>
                    {(reports.arrearsAging?.rows ?? []).length === 0 ? (
                        <EmptyState title="No arrears" description="No unsettled charge holds an outstanding balance." icon={<AlertTriangle className="w-8 h-8" />} />
                    ) : (
                        (reports.arrearsAging?.rows ?? []).slice(0, 50).map((r: any, i: number) => (
                            <div key={i} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 dark:bg-zinc-900/50 px-3 py-2">
                                <span className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                                    {r.category}{r.unitId ? ` · ${String(r.unitId)}` : ''}
                                </span>
                                <span className="flex items-center gap-2 flex-shrink-0">
                                    <Badge tone={r.daysOverdue > 60 ? 'danger' : 'warning'}>{r.daysOverdue}d</Badge>
                                    <span className="text-sm font-bold text-red-600 dark:text-red-400">{formatNaira(Number(r.outstanding))}</span>
                                </span>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── SC collections ── */}
            {active === 'collections' && (
                <div className="space-y-1.5">
                    {(reports.scCollections?.byCategory ?? []).length === 0 ? (
                        <EmptyState title="No service charges" description="No service-charge obligations exist for this firm." icon={<Layers className="w-8 h-8" />} />
                    ) : (
                        (reports.scCollections?.byCategory ?? []).map((c: any) => (
                            <div key={String(c.category)} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 dark:bg-zinc-900/50 px-3 py-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{c.category}</p>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                                        {c.charges} charge(s) · cycle {formatNaira(Number(c.cycleAmount))} · collected this cycle {formatNaira(Number(c.collectedThisCycle))}
                                    </p>
                                </div>
                                <span className="text-sm font-bold text-red-600 dark:text-red-400 flex-shrink-0">
                                    {formatNaira(Number(c.outstanding))} outstanding
                                </span>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── Revenue by type ── */}
            {active === 'revenue' && (
                <div className="space-y-2">
                    {(reports.revenueByType?.months ?? []).map((m: any) => (
                        <div key={m.key} className="rounded-lg bg-slate-50 dark:bg-zinc-900/50 px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-bold text-slate-800 dark:text-white">{m.key}</span>
                                <span className="text-sm font-semibold text-slate-600 dark:text-zinc-300">
                                    {formatNaira(Number(m.income))} in
                                    {Number(m.risk) > 0 ? ` · ${formatNaira(Number(m.risk))} at risk` : ''}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                                {(m.byType ?? []).map((t: any) => `${String(t.type)} ${formatNaira(Number(t.amount))}`).join(' · ') || 'no activity'}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Payment history ── */}
            {active === 'payments' && (
                <div className="space-y-1.5">
                    {(reports.paymentHistory ?? []).length === 0 ? (
                        <EmptyState title="No payments yet" description="Cleared payments appear here newest-first." icon={<Receipt className="w-8 h-8" />} />
                    ) : (
                        (reports.paymentHistory ?? []).slice(0, 50).map((p: any, i: number) => (
                            <div key={i} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 dark:bg-zinc-900/50 px-3 py-2">
                                <span className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                                    {day(p.at)} · {String(p.type)}{p.channel ? ` · ${String(p.channel)}` : ''}{p.paymentRef ? ` · ${String(p.paymentRef)}` : ''}
                                </span>
                                <span className="text-sm font-bold text-slate-800 dark:text-white flex-shrink-0">{formatNaira(Number(p.amount))}</span>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── Period comparison ── */}
            {active === 'period' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                        { label: `${reports.periodComparison?.previous?.key ?? '—'} (previous)`, income: reports.periodComparison?.previous?.income ?? 0, risk: reports.periodComparison?.previous?.risk ?? 0, count: reports.periodComparison?.previous?.count ?? 0 },
                        { label: `${reports.periodComparison?.current?.key ?? '—'} (current)`, income: reports.periodComparison?.current?.income ?? 0, risk: reports.periodComparison?.current?.risk ?? 0, count: reports.periodComparison?.current?.count ?? 0 },
                        { label: 'delta', income: reports.periodComparison?.delta?.income ?? 0, risk: reports.periodComparison?.delta?.risk ?? 0, count: reports.periodComparison?.delta?.count ?? 0 },
                    ].map((c) => (
                        <div key={c.label} className="rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-3">
                            <p className="text-2xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">{c.label}</p>
                            <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{formatNaira(Number(c.income))}</p>
                            <p className="text-2xs text-slate-500 dark:text-zinc-400">
                                {formatNaira(Number(c.risk))} at risk · {c.count} rows
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FinancialReportsConsole;
