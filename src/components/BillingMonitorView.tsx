/**
 * BillingMonitorView — Trust Layer for Automated Retainer Billing
 * ─────────────────────────────────────────────────────────────────────────────
 * Administrative control room for system-generated invoices.
 *
 * Each outbox entry flows through a strict state machine:
 *   Staged → Queued → Sent   (happy path)
 *   Staged → Failed          (missing client email / gateway error)
 *   Staged → Paused          (lawyer froze for editing)
 *   Staged → Skipped         (lawyer cancelled this cycle)
 *
 * Lawyer Override Controls:
 *   [Approve & Send Now] — bypasses the review window, immediately queues
 *   [Pause / Edit]        — freezes for editing line items or client details
 *   [Skip Cycle]          — cancels current cycle without breaking schedule
 *   [Retry]               — re-queues a Failed entry after the issue is fixed
 *
 * Resilience:
 *   - The Convex queries are wrapped in a child component so that if the
 *     backend hasn't been deployed yet (functions missing), the rest of
 *     the Financials page keeps working. The user sees a clear "Backend
 *     not deployed" message instead of a hard crash.
 */

import React, { useState, useMemo, ReactNode } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useUI } from '../contexts/UIContext';
import { useFeatures } from '../hooks/useFeatures';
import { useFinanceState } from '../contexts/FinanceContext';
import { InvoiceOutboxState } from '../types';
import { formatNaira } from '../utils/formatting';
import {
    BillingIcon,
    ExclamationTriangleIcon,
    ZapIcon,
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
    PauseIcon,
    ForwardIcon,
    ArrowPathIcon,
    PencilIcon,
    ChevronRightIcon,
} from '../constants';
import EmptyState from './EmptyState';

type OutboxEntry = {
    _id: string;
    firmId: string;
    matterId: string;
    invoiceId?: string;
    invoiceNumber?: string;
    clientId?: string;
    clientName?: string;
    clientEmail?: string;
    matterTitle?: string;
    cycleLabel?: string;
    frequency?: string;
    scheduledFor: string;
    stagedAt: string;
    sentAt?: string;
    failedAt?: string;
    pausedAt?: string;
    skippedAt?: string;
    state: string;
    failureReason?: string;
    subTotal?: number;
    taxAmount?: number;
    totalAmount?: number;
    currency?: string;
    lineItems?: any[];
};

type FilterTab = 'all' | InvoiceOutboxState;

const STATE_META: Record<string, { label: string; color: string; dot: string; icon: ReactNode }> = {
    Staged:  { label: 'Staged',  color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',   dot: 'bg-amber-500',   icon: <ClockIcon className="w-3.5 h-3.5" /> },
    Queued:  { label: 'Queued',  color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',       dot: 'bg-blue-500',    icon: <ForwardIcon className="w-3.5 h-3.5" /> },
    Sent:    { label: 'Sent',    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', dot: 'bg-emerald-500', icon: <CheckCircleIcon className="w-3.5 h-3.5" /> },
    Failed:  { label: 'Failed',  color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',       dot: 'bg-rose-500',    icon: <XCircleIcon className="w-3.5 h-3.5" /> },
    Paused:  { label: 'Paused',  color: 'bg-slate-200 text-slate-700 dark:bg-zinc-700 dark:text-zinc-200',       dot: 'bg-slate-500',   icon: <PauseIcon className="w-3.5 h-3.5" /> },
    Skipped: { label: 'Skipped', color: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',         dot: 'bg-zinc-400',    icon: <ForwardIcon className="w-3.5 h-3.5" /> },
};

const FILTER_TABS: { id: FilterTab; label: string }[] = [
    { id: 'all',     label: 'All' },
    { id: InvoiceOutboxState.Staged,  label: 'Staged' },
    { id: InvoiceOutboxState.Queued,  label: 'Queued' },
    { id: InvoiceOutboxState.Sent,    label: 'Sent' },
    { id: InvoiceOutboxState.Failed,  label: 'Failed' },
    { id: InvoiceOutboxState.Paused,  label: 'Paused' },
    { id: InvoiceOutboxState.Skipped, label: 'Skipped' },
];

/**
 * Outer component — handles the "premium not eligible" gate and the
 * "Convex backend not deployed yet" fallback. All actual data fetching
 * happens inside <BillingMonitorInner /> so a query failure can't crash
 * the parent Financials page.
 */
export const BillingMonitorView: React.FC = () => {
    const features = useFeatures();

    // ─── Non-premium gate ──────────────────────────────────────────────
    if (!features.canUseRetainerAutoBilling) {
        return (
            <div className="py-10 max-w-2xl mx-auto text-center">
                <div className="w-20 h-20 mx-auto bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-6 ring-8 ring-amber-50/50 dark:ring-amber-900/10">
                    <ZapIcon className="w-10 h-10 text-amber-500 dark:text-amber-400" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">
                    Automated Retainer Billing
                </h2>
                <p className="text-slate-500 dark:text-zinc-400 mb-8 leading-relaxed">
                    The Billing Monitor — including automated invoice generation, the pending outbox,
                    and lawyer override controls — is a premium feature available on Vega Growth+,
                    Vega Pro, and Komplete plans. Upgrade to unlock cron-based retainer invoicing
                    with full transparency and control.
                </p>
            </div>
        );
    }

    return (
        <ErrorBoundary
            fallback={<BillingMonitorNotDeployedFallback />}
        >
            <BillingMonitorInner />
        </ErrorBoundary>
    );
};

// ─── Fallback: shown when the Convex retainerBilling module isn't deployed ──
// Instead of just saying "unavailable", we show the user's existing retainer
// invoices (filtered from the regular invoices table) so the tab is still
// useful. A clear banner explains how to unlock the full automation features.
const BillingMonitorNotDeployedFallback: React.FC = () => {
    const { openModal, navigateTo } = useUI();
    const { financeState } = useFinanceState();
    const [showDeployScript, setShowDeployScript] = useState(false);

    // Filter invoices that look like retainer invoices (by title or matter type)
    const retainerInvoices = useMemo(() => {
        if (!financeState?.invoices) return [];
        return financeState.invoices.filter(inv => {
            const title = (inv.matter?.title || '').toLowerCase();
            const num = (inv.invoiceNumber || '').toLowerCase();
            return title.includes('retainer') || num.includes('ret') || num.includes('r-');
        });
    }, [financeState?.invoices]);

    const downloadDeployScript = () => {
        const script = `#!/bin/bash
# PracticePro — Convex Backend Deploy Script
# Run this from your project root to deploy the new retainerBilling module
# which powers the Billing Monitor's automated invoice outbox.

set -e

echo "→ Logging in to Convex (opens browser)..."
npx convex login

echo "→ Deploying Convex backend..."
npx convex deploy

echo "→ Done! The Billing Monitor tab will now show the live outbox."
echo "→ Refresh the app in your browser or restart the APK."
`;
        const blob = new Blob([script], { type: 'text/x-shellscript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'deploy-convex-backend.sh';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-5">
            {/* Banner — explains the situation + provides deploy action */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800/30">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                        <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-1">
                            Activate automated retainer billing
                        </h3>
                        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed mb-3">
                            You're seeing existing retainer invoices below. To unlock the full
                            Billing Monitor — automated invoice staging, the pending outbox queue,
                            and lawyer override controls (Approve &amp; Send, Pause, Skip Cycle) —
                            deploy the latest Convex backend from your machine.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={downloadDeployScript}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-all"
                            >
                                <ArrowPathIcon className="w-3 h-3" />
                                Download Deploy Script
                            </button>
                            <button
                                onClick={() => setShowDeployScript(!showDeployScript)}
                                className="px-3 py-1.5 bg-white dark:bg-zinc-800 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold border border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-zinc-700 transition-all"
                            >
                                {showDeployScript ? 'Hide' : 'Show'} instructions
                            </button>
                        </div>
                        {showDeployScript && (
                            <div className="mt-3 p-3 bg-slate-900 dark:bg-black/40 rounded-lg overflow-x-auto">
                                <code className="text-[11px] text-emerald-400 font-mono whitespace-pre">
{`# From your project root:
npx convex login      # one-time, opens browser
npx convex deploy     # pushes schema + mutations + crons

# Then refresh the app.`}
                                </code>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Existing retainer invoices (fallback content) */}
            <div>
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-200 dark:border-zinc-700">
                    <div className="w-1 h-5 bg-amber-500 rounded-full" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
                        Existing Retainer Invoices
                    </h3>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                        {retainerInvoices.length} found
                    </span>
                </div>
                {retainerInvoices.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 dark:text-zinc-500">
                        <BillingIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">No retainer invoices yet</p>
                        <p className="text-xs mt-1">
                            Create a matter with Retainer billing to see invoices here.
                        </p>
                        <button
                            onClick={() => openModal('newMatter')}
                            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 transition-all"
                        >
                            Create Matter
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {retainerInvoices.slice(0, 20).map((inv: any) => (
                            <div
                                key={inv.id}
                                onClick={() => navigateTo('invoiceDetail', inv.id)}
                                className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-all p-3 cursor-pointer"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                            {inv.invoiceNumber}
                                        </p>
                                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                                            {inv.client?.name} • {inv.matter?.title}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-black text-slate-900 dark:text-white">
                                            ₦{(inv.total_amount || inv.subTotal || 0).toLocaleString('en-NG')}
                                        </p>
                                        <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                            inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            inv.status === 'Overdue' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                            inv.status === 'Sent' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                            'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400'
                                        }`}>
                                            {inv.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Inner component — does the actual data fetching ────────────────────────
// Wrapped in ErrorBoundary above so any Convex query/mutation error is caught
// and shown as a friendly message instead of crashing the whole app.
const BillingMonitorInner: React.FC = () => {
    const { openModal, navigateTo, addToast } = useUI();
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    // useQuery returns `undefined` while loading and throws if the function
    // doesn't exist on the backend. The ErrorBoundary above catches the throw.
    const outbox = useQuery(api.retainerBilling.getOutboxForFirm, {}) as
        | OutboxEntry[]
        | undefined;
    const stats = useQuery(api.retainerBilling.getOutboxStats, {});

    const approveAndSendNow = useMutation(api.retainerBilling.approveAndSendNow);
    const pauseForEdit = useMutation(api.retainerBilling.pauseForEdit);
    const skipCycle = useMutation(api.retainerBilling.skipCycle);
    const retryFailed = useMutation(api.retainerBilling.retryFailed);
    const updateOutboxEntry = useMutation(api.retainerBilling.updateOutboxEntry);

    const filteredEntries = useMemo(() => {
        if (!outbox) return [];
        if (activeTab === 'all') return outbox;
        return outbox.filter((e) => e.state === activeTab);
    }, [outbox, activeTab]);

    const selectedEntry = useMemo(() => {
        if (!selectedId || !outbox) return null;
        return outbox.find((e) => e._id === selectedId) || null;
    }, [selectedId, outbox]);

    const handleAction = async (action: string, outboxId: string) => {
        setActionLoadingId(outboxId);
        try {
            switch (action) {
                case 'approve':
                    await approveAndSendNow({ outboxId });
                    addToast('Invoice approved & queued for immediate send.', { type: 'success' });
                    break;
                case 'pause':
                    await pauseForEdit({ outboxId });
                    addToast('Invoice paused for editing.', { type: 'info' });
                    break;
                case 'skip':
                    await skipCycle({ outboxId, reason: 'Skipped from Billing Monitor' });
                    addToast('Cycle skipped. Recurring schedule continues.', { type: 'info' });
                    break;
                case 'retry':
                    await retryFailed({ outboxId });
                    addToast('Retrying send…', { type: 'info' });
                    break;
            }
        } catch (err: any) {
            addToast(err?.message || 'Action failed.', { type: 'error' });
        } finally {
            setActionLoadingId(null);
        }
    };

    const totalSentValue = stats?.totalValue ?? 0;
    const isLoading = outbox === undefined;

    return (
        <div className="space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard
                    label="Staged"
                    value={stats?.Staged ?? 0}
                    dot="bg-amber-500"
                    icon={<ClockIcon className="w-4 h-4" />}
                />
                <KpiCard
                    label="Queued"
                    value={stats?.Queued ?? 0}
                    dot="bg-blue-500"
                    icon={<ForwardIcon className="w-4 h-4" />}
                />
                <KpiCard
                    label="Sent"
                    value={stats?.Sent ?? 0}
                    dot="bg-emerald-500"
                    icon={<CheckCircleIcon className="w-4 h-4" />}
                    subtitle={formatNaira(totalSentValue)}
                />
                <KpiCard
                    label="Failed"
                    value={stats?.Failed ?? 0}
                    dot="bg-rose-500"
                    icon={<XCircleIcon className="w-4 h-4" />}
                    highlight={!!stats?.Failed}
                />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                {FILTER_TABS.map((tab) => {
                    const count =
                        tab.id === 'all'
                            ? stats?.total ?? 0
                            : ((stats?.[tab.id as keyof typeof stats] as number) ?? 0);
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                                isActive
                                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                    : 'bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-700'
                            }`}
                        >
                            {tab.label}
                            <span
                                className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                                    isActive ? 'bg-white/20' : 'bg-slate-100 dark:bg-zinc-700'
                                }`}
                            >
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Outbox List */}
            {isLoading ? (
                <div className="space-y-2.5">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="h-24 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 animate-pulse"
                        />
                    ))}
                </div>
            ) : !outbox || outbox.length === 0 ? (
                <EmptyState
                    icon={<BillingIcon className="w-12 h-12" />}
                    title="No automated invoices yet"
                    description="When you create a Retainer-billed matter with automated invoicing enabled, system-generated invoices will appear here as they cycle through Staged → Queued → Sent."
                    actionLabel="Create Matter"
                    onAction={() => openModal('newMatter')}
                />
            ) : filteredEntries.length === 0 ? (
                <div className="text-center py-16 text-slate-400 dark:text-zinc-500">
                    <p className="text-sm font-medium">No entries in this state.</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {filteredEntries.map((entry) => (
                        <OutboxRow
                            key={entry._id}
                            entry={entry}
                            onSelect={() => setSelectedId(entry._id)}
                            onAction={handleAction}
                            actionLoadingId={actionLoadingId}
                        />
                    ))}
                </div>
            )}

            {/* Detail Drawer */}
            {selectedEntry && (
                <OutboxDetailDrawer
                    entry={selectedEntry}
                    onClose={() => setSelectedId(null)}
                    onAction={handleAction}
                    actionLoadingId={actionLoadingId}
                    onUpdate={async (updates) => {
                        setActionLoadingId(selectedEntry._id);
                        try {
                            await updateOutboxEntry({
                                outboxId: selectedEntry._id,
                                ...updates,
                            });
                            addToast('Entry updated.', { type: 'success' });
                        } catch (err: any) {
                            addToast(err?.message || 'Update failed.', { type: 'error' });
                        } finally {
                            setActionLoadingId(null);
                        }
                    }}
                    onViewMatter={() => {
                        setSelectedId(null);
                        navigateTo('matterDetail', selectedEntry.matterId);
                    }}
                />
            )}
        </div>
    );
};

// ─── KPI Card ───────────────────────────────────────────────────────────────
const KpiCard: React.FC<{
    label: string;
    value: number;
    dot: string;
    icon: ReactNode;
    subtitle?: string;
    highlight?: boolean;
}> = ({ label, value, dot, icon, subtitle, highlight }) => (
    <div
        className={`p-3 rounded-xl border bg-white dark:bg-zinc-800 shadow-sm transition-all ${
            highlight
                ? 'border-rose-300 dark:border-rose-700 ring-2 ring-rose-100 dark:ring-rose-900/30'
                : 'border-slate-200 dark:border-zinc-700'
        }`}
    >
        <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                {label}
            </span>
            <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        </div>
        <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{value}</span>
            {icon && <div className="text-slate-400 dark:text-zinc-500">{icon}</div>}
        </div>
        {subtitle && (
            <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 font-medium">{subtitle}</p>
        )}
    </div>
);

// ─── Outbox Row ─────────────────────────────────────────────────────────────
const OutboxRow: React.FC<{
    entry: OutboxEntry;
    onSelect: () => void;
    onAction: (action: string, outboxId: string) => void;
    actionLoadingId: string | null;
}> = ({ entry, onSelect, onAction, actionLoadingId }) => {
    const meta = STATE_META[entry.state] || STATE_META.Staged;
    const isLoading = actionLoadingId === entry._id;
    const canApprove = entry.state === 'Staged' || entry.state === 'Paused';
    const canPause = entry.state === 'Staged' || entry.state === 'Queued';
    const canSkip = entry.state === 'Staged' || entry.state === 'Queued' || entry.state === 'Paused';
    const canRetry = entry.state === 'Failed';

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-all overflow-hidden">
            <button
                onClick={onSelect}
                className="w-full text-left p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-zinc-700/30 transition-colors"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${meta.color}`}
                            >
                                {meta.icon}
                                {meta.label}
                            </span>
                            {entry.frequency && (
                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium uppercase tracking-wider">
                                    {entry.frequency}
                                </span>
                            )}
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {entry.cycleLabel || entry.matterTitle || 'Retainer Invoice'}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                            <span>{entry.clientName || 'Unknown client'}</span>
                            <span>•</span>
                            <span>
                                {entry.clientEmail || (
                                    <span className="text-rose-500 dark:text-rose-400 font-medium">
                                        No email
                                    </span>
                                )}
                            </span>
                        </div>
                        {entry.failureReason && (
                            <p className="mt-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                                <ExclamationTriangleIcon className="w-3 h-3 shrink-0" />
                                <span className="truncate">{entry.failureReason}</span>
                            </p>
                        )}
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-base font-black text-slate-900 dark:text-white">
                            {formatNaira(entry.totalAmount ?? 0)}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                            {new Date(entry.scheduledFor).toLocaleDateString('en-NG', {
                                day: 'numeric',
                                month: 'short',
                            })}
                        </p>
                    </div>
                </div>
            </button>

            {/* Action Bar */}
            <div className="border-t border-slate-100 dark:border-zinc-700/50 px-3 sm:px-4 py-2 flex items-center justify-end gap-1.5 bg-slate-50/50 dark:bg-zinc-800/50">
                {canApprove && (
                    <ActionButton
                        label="Approve & Send"
                        icon={<CheckCircleIcon className="w-3 h-3" />}
                        onClick={() => onAction('approve', entry._id)}
                        loading={isLoading}
                        variant="primary"
                    />
                )}
                {canPause && (
                    <ActionButton
                        label="Pause / Edit"
                        icon={<PauseIcon className="w-3 h-3" />}
                        onClick={() => onAction('pause', entry._id)}
                        loading={isLoading}
                        variant="neutral"
                    />
                )}
                {canSkip && (
                    <ActionButton
                        label="Skip Cycle"
                        icon={<ForwardIcon className="w-3 h-3" />}
                        onClick={() => onAction('skip', entry._id)}
                        loading={isLoading}
                        variant="neutral"
                    />
                )}
                {canRetry && (
                    <ActionButton
                        label="Retry"
                        icon={<ArrowPathIcon className="w-3 h-3" />}
                        onClick={() => onAction('retry', entry._id)}
                        loading={isLoading}
                        variant="warning"
                    />
                )}
                <button
                    onClick={onSelect}
                    className="ml-1 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
                    aria-label="View details"
                >
                    <ChevronRightIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

// ─── Action Button ──────────────────────────────────────────────────────────
const ActionButton: React.FC<{
    label: string;
    icon: ReactNode;
    onClick: () => void;
    loading?: boolean;
    variant?: 'primary' | 'neutral' | 'warning';
}> = ({ label, icon, onClick, loading, variant = 'neutral' }) => {
    const variantClasses = {
        primary: 'bg-emerald-600 text-white hover:bg-emerald-700',
        neutral:
            'bg-white dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-600 border border-slate-200 dark:border-zinc-600',
        warning: 'bg-amber-500 text-white hover:bg-amber-600',
    };
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            disabled={loading}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[32px] ${variantClasses[variant]}`}
        >
            {loading ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : icon}
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
};

// ─── Outbox Detail Drawer ───────────────────────────────────────────────────
const OutboxDetailDrawer: React.FC<{
    entry: OutboxEntry;
    onClose: () => void;
    onAction: (action: string, outboxId: string) => void;
    actionLoadingId: string | null;
    onUpdate: (updates: any) => Promise<void>;
    onViewMatter: () => void;
}> = ({ entry, onClose, onAction, actionLoadingId, onUpdate, onViewMatter }) => {
    const [editing, setEditing] = useState(false);
    const [editEmail, setEditEmail] = useState(entry.clientEmail || '');
    const [editName, setEditName] = useState(entry.clientName || '');
    const [editCycleLabel, setEditCycleLabel] = useState(entry.cycleLabel || '');
    const isLoading = actionLoadingId === entry._id;
    const meta = STATE_META[entry.state] || STATE_META.Staged;
    const canEdit = entry.state === 'Staged' || entry.state === 'Paused';

    return (
        <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />

            {/* Drawer */}
            <div className="relative w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-700 animate-in slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700 px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${meta.color}`}
                        >
                            {meta.icon}
                            {meta.label}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            {entry.invoiceNumber || 'Draft Invoice'}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700"
                    >
                        <XCircleIcon className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Cycle Info */}
                    <div className="p-3 bg-slate-50 dark:bg-zinc-900/40 rounded-xl border border-slate-200 dark:border-zinc-700">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                            Cycle
                        </p>
                        {editing && canEdit ? (
                            <input
                                type="text"
                                value={editCycleLabel}
                                onChange={(e) => setEditCycleLabel(e.target.value)}
                                className="w-full px-2 py-1.5 text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded-lg"
                            />
                        ) : (
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                {entry.cycleLabel || entry.matterTitle || 'Retainer Invoice'}
                            </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
                            <span>
                                Frequency:{' '}
                                <strong className="text-slate-700 dark:text-zinc-300">
                                    {entry.frequency || 'Monthly'}
                                </strong>
                            </span>
                            <span>
                                Scheduled:{' '}
                                <strong className="text-slate-700 dark:text-zinc-300">
                                    {new Date(entry.scheduledFor).toLocaleString('en-NG')}
                                </strong>
                            </span>
                        </div>
                    </div>

                    {/* Client Info */}
                    <div className="p-3 bg-slate-50 dark:bg-zinc-900/40 rounded-xl border border-slate-200 dark:border-zinc-700">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2">
                            Client
                        </p>
                        <div className="space-y-2">
                            <div>
                                <label className="text-[10px] text-slate-500 dark:text-zinc-400">
                                    Name
                                </label>
                                {editing && canEdit ? (
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="w-full px-2 py-1.5 text-sm bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded-lg text-slate-900 dark:text-white"
                                    />
                                ) : (
                                    <p className="text-sm text-slate-900 dark:text-white">
                                        {entry.clientName || '—'}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 dark:text-zinc-400">
                                    Email
                                </label>
                                {editing && canEdit ? (
                                    <input
                                        type="email"
                                        value={editEmail}
                                        onChange={(e) => setEditEmail(e.target.value)}
                                        className={`w-full px-2 py-1.5 text-sm bg-white dark:bg-zinc-800 border rounded-lg text-slate-900 dark:text-white ${
                                            !editEmail
                                                ? 'border-amber-400'
                                                : 'border-slate-300 dark:border-zinc-600'
                                        }`}
                                        placeholder="client@example.com"
                                    />
                                ) : (
                                    <p
                                        className={`text-sm ${
                                            entry.clientEmail
                                                ? 'text-slate-900 dark:text-white'
                                                : 'text-rose-500 dark:text-rose-400 font-medium'
                                        }`}
                                    >
                                        {entry.clientEmail || 'No email — send will fail'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Line Items */}
                    <div className="p-3 bg-slate-50 dark:bg-zinc-900/40 rounded-xl border border-slate-200 dark:border-zinc-700">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2">
                            Line Items
                        </p>
                        <div className="space-y-1.5">
                            {(entry.lineItems || []).map((item: any, i: number) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <span className="text-slate-700 dark:text-zinc-300">
                                        {item.description}
                                    </span>
                                    <span className="font-bold text-slate-900 dark:text-white">
                                        {formatNaira(item.total || 0)}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-zinc-700 space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                                <span>Subtotal</span>
                                <span>{formatNaira(entry.subTotal ?? 0)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                                <span>VAT (7.5%)</span>
                                <span>{formatNaira(entry.taxAmount ?? 0)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm font-bold text-slate-900 dark:text-white">
                                <span>Total</span>
                                <span>{formatNaira(entry.totalAmount ?? 0)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Failure Reason */}
                    {entry.failureReason && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800/30">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1 flex items-center gap-1">
                                <ExclamationTriangleIcon className="w-3 h-3" />
                                Failure Reason
                            </p>
                            <p className="text-sm text-rose-700 dark:text-rose-300">
                                {entry.failureReason}
                            </p>
                        </div>
                    )}

                    {/* Timestamps */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 dark:text-zinc-400">
                        <div>
                            Staged:{' '}
                            <strong>{new Date(entry.stagedAt).toLocaleString('en-NG')}</strong>
                        </div>
                        {entry.sentAt && (
                            <div>
                                Sent:{' '}
                                <strong>{new Date(entry.sentAt).toLocaleString('en-NG')}</strong>
                            </div>
                        )}
                        {entry.failedAt && (
                            <div>
                                Failed:{' '}
                                <strong>{new Date(entry.failedAt).toLocaleString('en-NG')}</strong>
                            </div>
                        )}
                        {entry.pausedAt && (
                            <div>
                                Paused:{' '}
                                <strong>{new Date(entry.pausedAt).toLocaleString('en-NG')}</strong>
                            </div>
                        )}
                        {entry.skippedAt && (
                            <div>
                                Skipped:{' '}
                                <strong>{new Date(entry.skippedAt).toLocaleString('en-NG')}</strong>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="sticky bottom-0 bg-white dark:bg-zinc-800 border-t border-slate-200 dark:border-zinc-700 px-5 py-3 flex items-center justify-between gap-2">
                    <button
                        onClick={onViewMatter}
                        className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
                    >
                        View Matter →
                    </button>
                    <div className="flex items-center gap-2">
                        {canEdit && (
                            <button
                                onClick={() => {
                                    if (editing) {
                                        onUpdate({
                                            clientEmail: editEmail,
                                            clientName: editName,
                                            cycleLabel: editCycleLabel,
                                        }).then(() => setEditing(false));
                                    } else {
                                        setEditing(true);
                                    }
                                }}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-all disabled:opacity-50"
                            >
                                <PencilIcon className="w-3 h-3" />
                                {editing ? 'Save' : 'Edit'}
                            </button>
                        )}
                        {(entry.state === 'Staged' || entry.state === 'Paused') && (
                            <button
                                onClick={() => onAction('approve', entry._id)}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-50"
                            >
                                <CheckCircleIcon className="w-3 h-3" />
                                Approve & Send Now
                            </button>
                        )}
                        {entry.state === 'Failed' && (
                            <button
                                onClick={() => onAction('retry', entry._id)}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-all disabled:opacity-50"
                            >
                                <ArrowPathIcon className="w-3 h-3" />
                                Retry Send
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Local Error Boundary ───────────────────────────────────────────────────
// Catches any render-time errors thrown by the inner component (most likely
// from useQuery/useMutation when the Convex backend hasn't been deployed with
// the retainerBilling module yet). Shows a friendly fallback instead of a
// hard white-screen crash.
class ErrorBoundary extends React.Component<
    { children: ReactNode; fallback: ReactNode },
    { hasError: boolean; errorMessage?: string }
> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true, errorMessage: error?.message || String(error) };
    }

    componentDidCatch(error: any, info: any) {
        console.error('[BillingMonitorView] ErrorBoundary caught:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return <>{this.props.fallback}</>;
        }
        return this.props.children;
    }
}

export default BillingMonitorView;
