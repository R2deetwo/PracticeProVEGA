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
 * Access:
 *   - Strictly gated to firms with canUseRetainerAutoBilling (Vega Growth+
 *     or Komplete). Non-premium firms see an upgrade CTA.
 *   - Visible to all firm members; mutations are scoped to the caller's firm.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useUI } from '../contexts/UIContext';
import { useFeatures } from '../hooks/useFeatures';
import { useProduct } from '../contexts/ProductContext';
import { InvoiceOutboxState } from '../types';
import { formatNaira } from '../utils/formatting';
import {
    PlusIcon,
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
import Tooltip from './Tooltip';

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

const STATE_META: Record<string, { label: string; color: string; dot: string; icon: React.ReactNode }> = {
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

export const BillingMonitorView: React.FC = () => {
    const { openModal, navigateTo, addToast } = useUI();
    const features = useFeatures();
    const { isProperty } = useProduct();
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    const outbox = useQuery(api.retainerBilling.getOutboxForFirm, {}) as OutboxEntry[] | undefined;
    const stats = useQuery(api.retainerBilling.getOutboxStats, {});

    const approveAndSendNow = useMutation(api.retainerBilling.approveAndSendNow);
    const pauseForEdit = useMutation(api.retainerBilling.pauseForEdit);
    const skipCycle = useMutation(api.retainerBilling.skipCycle);
    const retryFailed = useMutation(api.retainerBilling.retryFailed);
    const updateOutboxEntry = useMutation(api.retainerBilling.updateOutboxEntry);

    const filteredEntries = useMemo(() => {
        if (!outbox) return [];
        if (activeTab === 'all') return outbox;
        return outbox.filter(e => e.state === activeTab);
    }, [outbox, activeTab]);

    const selectedEntry = useMemo(() => {
        if (!selectedId || !outbox) return null;
        return outbox.find(e => e._id === selectedId) || null;
    }, [selectedId, outbox]);

    // ─── Non-premium gate ──────────────────────────────────────────────
    if (!features.canUseRetainerAutoBilling) {
        return (
            <div className="h-full overflow-y-auto bg-slate-50 dark:bg-zinc-900 pb-32">
                <div className="px-4 sm:px-6 lg:px-8 py-10 max-w-2xl mx-auto text-center">
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
                    <button
                        onClick={() => openModal('upgradePlan')}
                        className="px-6 py-3 bg-primary-600 text-white rounded-xl font-bold shadow-lg hover:bg-primary-700 transition-all"
                    >
                        View Upgrade Options
                    </button>
                </div>
            </div>
        );
    }

    const handleAction = async (action: string, outboxId: string, ...args: any[]) => {
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

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-32">
            {/* Header */}
            <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <BillingIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        Billing Monitor
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        Outbox & pending queue for automated retainer invoices
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-flex px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded-full">
                        Premium
                    </span>
                </div>
            </div>

            <div className="px-4 sm:px-6 lg:px-8 space-y-5">
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
                    {FILTER_TABS.map(tab => {
                        const count = tab.id === 'all'
                            ? (stats?.total ?? 0)
                            : (stats?.[tab.id as keyof typeof stats] as number) ?? 0;
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
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                                    isActive ? 'bg-white/20' : 'bg-slate-100 dark:bg-zinc-700'
                                }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Outbox List */}
                {!outbox || outbox.length === 0 ? (
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
                        {filteredEntries.map(entry => (
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
            </div>

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
                            await updateOutboxEntry({ outboxId: selectedEntry._id, ...updates });
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
    icon: React.ReactNode;
    subtitle?: string;
    highlight?: boolean;
}> = ({ label, value, dot, icon, subtitle, highlight }) => (
    <div className={`p-3 rounded-xl border bg-white dark:bg-zinc-800 shadow-sm transition-all ${
        highlight ? 'border-rose-300 dark:border-rose-700 ring-2 ring-rose-100 dark:ring-rose-900/30' : 'border-slate-200 dark:border-zinc-700'
    }`}>
        <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">{label}</span>
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
        <div
            className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-all overflow-hidden"
        >
            <button
                onClick={onSelect}
                className="w-full text-left p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-zinc-700/30 transition-colors"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${meta.color}`}>
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
                            <span>{entry.clientEmail || <span className="text-rose-500 dark:text-rose-400 font-medium">No email</span>}</span>
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
                            {new Date(entry.scheduledFor).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
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
    icon: React.ReactNode;
    onClick: () => void;
    loading?: boolean;
    variant?: 'primary' | 'neutral' | 'warning';
}> = ({ label, icon, onClick, loading, variant = 'neutral' }) => {
    const variantClasses = {
        primary: 'bg-emerald-600 text-white hover:bg-emerald-700',
        neutral: 'bg-white dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-600 border border-slate-200 dark:border-zinc-600',
        warning: 'bg-amber-500 text-white hover:bg-amber-600',
    };
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            disabled={loading}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[32px] ${variantClasses[variant]}`}
        >
            {loading ? (
                <ArrowPathIcon className="w-3 h-3 animate-spin" />
            ) : (
                icon
            )}
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
            <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="relative w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-700 animate-in slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700 px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${meta.color}`}>
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
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">Cycle</p>
                        {editing && canEdit ? (
                            <input
                                type="text"
                                value={editCycleLabel}
                                onChange={e => setEditCycleLabel(e.target.value)}
                                className="w-full px-2 py-1.5 text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded-lg"
                            />
                        ) : (
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                {entry.cycleLabel || entry.matterTitle || 'Retainer Invoice'}
                            </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
                            <span>Frequency: <strong className="text-slate-700 dark:text-zinc-300">{entry.frequency || 'Monthly'}</strong></span>
                            <span>Scheduled: <strong className="text-slate-700 dark:text-zinc-300">{new Date(entry.scheduledFor).toLocaleString('en-NG')}</strong></span>
                        </div>
                    </div>

                    {/* Client Info */}
                    <div className="p-3 bg-slate-50 dark:bg-zinc-900/40 rounded-xl border border-slate-200 dark:border-zinc-700">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2">Client</p>
                        <div className="space-y-2">
                            <div>
                                <label className="text-[10px] text-slate-500 dark:text-zinc-400">Name</label>
                                {editing && canEdit ? (
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        className="w-full px-2 py-1.5 text-sm bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded-lg text-slate-900 dark:text-white"
                                    />
                                ) : (
                                    <p className="text-sm text-slate-900 dark:text-white">{entry.clientName || '—'}</p>
                                )}
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 dark:text-zinc-400">Email</label>
                                {editing && canEdit ? (
                                    <input
                                        type="email"
                                        value={editEmail}
                                        onChange={e => setEditEmail(e.target.value)}
                                        className={`w-full px-2 py-1.5 text-sm bg-white dark:bg-zinc-800 border rounded-lg text-slate-900 dark:text-white ${
                                            !editEmail ? 'border-amber-400' : 'border-slate-300 dark:border-zinc-600'
                                        }`}
                                        placeholder="client@example.com"
                                    />
                                ) : (
                                    <p className={`text-sm ${entry.clientEmail ? 'text-slate-900 dark:text-white' : 'text-rose-500 dark:text-rose-400 font-medium'}`}>
                                        {entry.clientEmail || 'No email — send will fail'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Line Items */}
                    <div className="p-3 bg-slate-50 dark:bg-zinc-900/40 rounded-xl border border-slate-200 dark:border-zinc-700">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2">Line Items</p>
                        <div className="space-y-1.5">
                            {(entry.lineItems || []).map((item: any, i: number) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <span className="text-slate-700 dark:text-zinc-300">{item.description}</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{formatNaira(item.total || 0)}</span>
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
                            <p className="text-sm text-rose-700 dark:text-rose-300">{entry.failureReason}</p>
                        </div>
                    )}

                    {/* Timestamps */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 dark:text-zinc-400">
                        <div>Staged: <strong>{new Date(entry.stagedAt).toLocaleString('en-NG')}</strong></div>
                        {entry.sentAt && <div>Sent: <strong>{new Date(entry.sentAt).toLocaleString('en-NG')}</strong></div>}
                        {entry.failedAt && <div>Failed: <strong>{new Date(entry.failedAt).toLocaleString('en-NG')}</strong></div>}
                        {entry.pausedAt && <div>Paused: <strong>{new Date(entry.pausedAt).toLocaleString('en-NG')}</strong></div>}
                        {entry.skippedAt && <div>Skipped: <strong>{new Date(entry.skippedAt).toLocaleString('en-NG')}</strong></div>}
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

export default BillingMonitorView;
