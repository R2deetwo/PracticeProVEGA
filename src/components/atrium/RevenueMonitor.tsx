/**
 * RevenueMonitor — Unified Atrium Revenue Dashboard
 *
 * MERGED (Aug 2026): Replaces three separate components:
 *   - RevenueEngine.tsx (deleted — was a tab container with dark theme)
 *   - ServiceChargeMonitor.tsx (merged — was standalone defaulter dashboard)
 *   - ServiceChargeBars.tsx (kept as-is — used inline in PropertyDetailView
 *     for unit-level charge tracking, NOT part of this dashboard)
 *
 * This is the single Atrium revenue dashboard, shown when navigating to
 * the 'atriumEngine' view. It combines:
 *   - Defaulter tracking (from ServiceChargeMonitor)
 *   - Ledger entries (from LedgerManager — imported, not merged)
 *   - Automations (from AutomationCenter — imported, not merged)
 *   - Vacancy pipeline (from VacancyPipeline — imported, not merged)
 *
 * The key change: ServiceChargeMonitor's dashboard is now the default tab
 * content directly in this component, rather than being a separate file
 * rendered inside RevenueEngine's tab system. The file count drops by 1
 * (RevenueEngine deleted) and the import chain shortens by 1 level.
 *
 * Theme: Uses the app's standard light/dark theme (RevenueEngine had
 * a forced dark theme — now removed for consistency with the rest of
 * the app).
 */

import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import { formatNaira } from '../../utils/formatting';
import { FinancialStatusBadge } from '../ui/FinancialStatusBadge';
import LedgerManager from './LedgerManager';
import VacancyPipeline from './VacancyPipeline';
import { AtriumInbox } from './AtriumInbox';
import AutomationCenter from './AutomationCenter';
import ErrorBoundary from '../ErrorBoundary';

// ── Tab config ────────────────────────────────────────────────────────────
type TabId = 'defaulters' | 'ledger' | 'automations' | 'inbox' | 'pipeline';

interface TabDef {
    id: TabId;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
}

// ── Icons ──────────────────────────────────────────────────────────────────
const ShieldIcon = ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);
const LedgerIcon = ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />
        <line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
    </svg>
);
const BoltIcon = ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
);
const InboxIcon = ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path d="M3 13h6l3 3 3-3h6" /><path d="M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
    </svg>
);
const FunnelIcon = ({ className = 'w-4 h-4' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path d="M3 4h18l-7 8v8l-4-2v-6L3 4z" />
    </svg>
);

// ─── Inline ServiceChargeDashboard (merged from ServiceChargeMonitor) ──────
// The ServiceChargeMonitor's dashboard logic is now inline here rather than
// being a separate import. ServiceChargeBars (used in PropertyDetailView for
// unit-level charge tracking) remains a separate component — it serves a
// different context (per-unit detail, not dashboard-level overview).

const ServiceChargeDashboard: React.FC = () => {
    const { currentUser } = useAuth();
    const { coreState } = useCoreState();
    const firmId = coreState.firmDetails?.id || currentUser?.firmId || '';
    const allCharges = coreState.serviceCharges || [];
    const markPaidMutation = useMutation(api.sentry.markChargeAsPaid);
    const logAuto = useMutation(api.sentry.logAutomation);
    const { queueMutation, isOnline } = useOfflineQueue();
    const [showAddModal, setShowAddModal] = useState(false);
    const [penaltyCharge, setPenaltyCharge] = useState<any>(null);
    const [partialPaymentCharge, setPartialPaymentCharge] = useState<any>(null);
    const [partialAmount, setPartialAmount] = useState('');
    const [toast, setToast] = useState('');
    const [filter, setFilter] = useState<'all' | 'defaulters' | 'critical' | 'partial'>('all');

    const charges = useMemo(() => {
        if (filter === 'defaulters') return allCharges.filter(c => c.isDefaulter);
        if (filter === 'critical') return allCharges.filter(c => (c.daysOverdue ?? 0) > 14);
        if (filter === 'partial') return allCharges.filter(c => c.serviceChargeStatus === 'PARTIALLY_PAID');
        return allCharges;
    }, [allCharges, filter]);

    const defaulters = allCharges.filter(c => c.isDefaulter);
    const critical = allCharges.filter(c => (c.daysOverdue ?? 0) > 14);
    const partialPayers = allCharges.filter(c => c.serviceChargeStatus === 'PARTIALLY_PAID');
    const revenueAtRisk = defaulters.reduce((s, c) => s + c.amount + (c.penaltyApplied ? c.amount * 0.1 : 0), 0);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const handleMarkPaid = async (charge: any) => {
        // IDEMPOTENCY (Phase 3): uuid per payment action — a retry/offline
        // replay with the same key is deduped server-side instead of
        // double-crediting the charge or double-counting ledger revenue.
        const idempotencyKey = uuidv4();
        if (!isOnline) {
            queueMutation({
                mutationName: 'markChargeAsPaid',
                args: { serviceChargeId: charge._id as any, paidAmount: charge.amount, firmId, channel: 'Bank Transfer', userEmail: currentUser?.email, idempotencyKey },
                label: `${charge.category} charge marked paid`,
            });
            showToast(`${charge.category} charge saved offline. Will sync when you reconnect.`);
            return;
        }
        try {
            await markPaidMutation({ serviceChargeId: charge._id as any, paidAmount: charge.amount, firmId, channel: 'Bank Transfer', userEmail: currentUser?.email, idempotencyKey });
            showToast(`${charge.category} charge marked as fully paid`);
        } catch (e: any) {
            showToast(e?.message || 'Failed to mark charge as paid — please try again.');
        }
    };

    const handlePartialPayment = async () => {
        if (!partialPaymentCharge || !partialAmount) return;
        const amount = parseFloat(partialAmount);
        if (isNaN(amount) || amount <= 0) return;
        if (!isOnline) {
            queueMutation({
                mutationName: 'markChargeAsPaid',
                args: { serviceChargeId: partialPaymentCharge._id as any, paidAmount: amount, firmId, channel: 'Bank Transfer', isPartialPayment: true, userEmail: currentUser?.email, idempotencyKey: uuidv4() },
                label: `Partial payment ₦${amount.toLocaleString()}`,
            });
            showToast(`Partial payment of ₦${amount.toLocaleString()} saved offline.`);
            setPartialPaymentCharge(null);
            setPartialAmount('');
            return;
        }
        try {
            await markPaidMutation({ serviceChargeId: partialPaymentCharge._id as any, paidAmount: amount, firmId, channel: 'Bank Transfer', isPartialPayment: true, userEmail: currentUser?.email, idempotencyKey: uuidv4() });
            showToast(`Partial payment of ₦${amount.toLocaleString()} recorded`);
            setPartialPaymentCharge(null);
            setPartialAmount('');
        } catch (e: any) {
            showToast(e?.message || 'Failed to record partial payment — please try again.');
        }
    };

    return (
        <div className="p-4 space-y-4">
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 shadow-sm">
                    <p className="text-2xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Total Charges</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">{allCharges.length}</p>
                </div>
                <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 shadow-sm">
                    <p className="text-2xs font-bold text-rose-500 uppercase tracking-wider mb-1">Defaulters</p>
                    <p className="text-lg font-black text-rose-600 dark:text-rose-400">{defaulters.length}</p>
                </div>
                <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 shadow-sm">
                    <p className="text-2xs font-bold text-amber-500 uppercase tracking-wider mb-1">Critical</p>
                    <p className="text-lg font-black text-amber-600 dark:text-amber-400">{critical.length}</p>
                </div>
                <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 shadow-sm">
                    <p className="text-2xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Revenue at Risk</p>
                    <p className="text-lg font-black text-rose-600 dark:text-rose-400">₦{formatNaira(revenueAtRisk)}</p>
                </div>
            </div>

            {/* Filter chips */}
            <div className="flex gap-2 flex-wrap">
                {([
                    { id: 'all', label: 'All', count: allCharges.length },
                    { id: 'defaulters', label: 'Defaulters', count: defaulters.length },
                    { id: 'critical', label: 'Critical (>14 days)', count: critical.length },
                    { id: 'partial', label: 'Partial Payers', count: partialPayers.length },
                ] as const).map(f => (
                    <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        className={`px-3 py-1.5 rounded-lg text-2xs font-bold transition-colors ${
                            filter === f.id
                                ? 'bg-primary-600 text-white'
                                : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                        }`}
                    >
                        {f.label} ({f.count})
                    </button>
                ))}
            </div>

            {/* Charge list */}
            <div className="space-y-2">
                {charges.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-3">
                            <ShieldIcon className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">No service charges found</p>
                    </div>
                ) : (
                    charges.map((charge: any) => (
                        <div key={charge._id} className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{charge.category || 'Service Charge'}</p>
                                    <p className="text-2xs text-slate-400 dark:text-zinc-500">
                                        {charge.unitName || charge.unitId || 'Unknown unit'} · ₦{formatNaira(charge.amount)}
                                    </p>
                                </div>
                                <FinancialStatusBadge
                                    status={charge.serviceChargeStatus || (charge.isDefaulter ? 'Defaulted' : 'Paid')}
                                    size="sm"
                                />
                            </div>
                            {(charge.daysOverdue ?? 0) > 0 && (
                                <p className="text-2xs text-rose-500 font-medium mb-2">{charge.daysOverdue} days overdue</p>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleMarkPaid(charge)}
                                    className="px-3 py-1.5 bg-emerald-600 text-white text-2xs font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                                >
                                    Mark Paid
                                </button>
                                <button
                                    onClick={() => { setPartialPaymentCharge(charge); setPartialAmount(''); }}
                                    className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-2xs font-bold rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                                >
                                    Partial Payment
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Partial payment modal */}
            {partialPaymentCharge && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPartialPaymentCharge(null)}>
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">Partial Payment</h3>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">Amount due: ₦{formatNaira(partialPaymentCharge.amount)}</p>
                        <input
                            type="number"
                            value={partialAmount}
                            onChange={e => setPartialAmount(e.target.value)}
                            placeholder="Enter amount..."
                            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 mb-4"
                        />
                        <div className="flex gap-2">
                            <button onClick={() => setPartialPaymentCharge(null)} className="flex-1 py-2 text-xs font-bold text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 rounded-lg">Cancel</button>
                            <button onClick={handlePartialPayment} className="flex-1 py-2 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Record Payment</button>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div className="fixed bottom-20 right-4 z-50 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-lg shadow-lg text-xs font-medium">
                    {toast}
                </div>
            )}
        </div>
    );
};

// ─── Main RevenueMonitor component ────────────────────────────────────────
export const RevenueMonitor: React.FC = () => {
    const { currentUser } = useAuth();
    const { coreState } = useCoreState();
    const firmId = coreState.firmDetails?.id || currentUser?.firmId || '';
    const [activeTab, setActiveTab] = useState<TabId>('defaulters');

    const defaulters = useQuery(api.sentry.getDefaulters, firmId ? { firmId, userEmail: currentUser?.email } : 'skip');
    const criticalCount = (defaulters || []).filter((d: any) => (d.daysOverdue ?? 0) > 14).length;

    const tabs: TabDef[] = [
        { id: 'defaulters', label: 'Service Charges', shortLabel: 'Charges', icon: <ShieldIcon /> },
        { id: 'ledger', label: 'Ledger', shortLabel: 'Ledger', icon: <LedgerIcon /> },
        { id: 'automations', label: 'Automations', shortLabel: 'Auto', icon: <BoltIcon /> },
        { id: 'inbox', label: 'Inbox', shortLabel: 'Inbox', icon: <InboxIcon /> },
        { id: 'pipeline', label: 'Vacancy Pipeline', shortLabel: 'Pipeline', icon: <FunnelIcon /> },
    ];

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-950">
            {/* Header — stat summary */}
            <div className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-lg font-black text-slate-900 dark:text-white">Revenue Monitor</h1>
                    {criticalCount > 0 && (
                        <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-2xs font-bold rounded-full">
                            {criticalCount} critical
                        </span>
                    )}
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex-shrink-0 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 overflow-x-auto">
                <div className="flex px-3 sm:px-6 gap-0 min-w-max">
                    {tabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`relative flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold transition-all border-b-2 -mb-px flex-shrink-0 whitespace-nowrap ${
                                    isActive
                                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                        : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
                                }`}
                            >
                                <span className="w-4 h-4 flex-shrink-0">{tab.icon}</span>
                                <span className="hidden sm:block">{tab.label}</span>
                                <span className="sm:hidden">{tab.shortLabel}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-20 sm:pb-4">
                <ErrorBoundary fallback={<div className="p-6 text-center text-rose-500">Failed to load this section. Please try refreshing.</div>}>
                    {activeTab === 'defaulters' && <ServiceChargeDashboard />}
                    {activeTab === 'ledger' && <LedgerManager />}
                    {activeTab === 'automations' && <AutomationCenter />}
                    {activeTab === 'inbox' && <AtriumInbox />}
                    {activeTab === 'pipeline' && <VacancyPipeline />}
                </ErrorBoundary>
            </div>
        </div>
    );
};

export default RevenueMonitor;
