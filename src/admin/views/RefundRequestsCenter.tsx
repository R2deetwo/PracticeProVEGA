/**
 * RefundRequestsCenter — Founder Admin approval queue for refund requests.
 *
 * P3 (decision (a)): the marketing surface promises a "30-day money-back
 * guarantee on annual plans". This view is the founder half of that
 * promise's backend:
 *   1. Stats header (pending count + NGN volume, approved-awaiting-processing)
 *   2. Filterable queue (pending / approved / denied / processed / cancelled / all)
 *   3. Per-request card: firm, plan + interval, amount, eligibility badge
 *      (guarantee / discretionary / unverified), reason, reference, full
 *      status-trail timeline
 *   4. Actions: Approve / Deny (pending, with note), Mark Processed
 *      (approved — after executing the refund MANUALLY in Paystack, paste
 *      the refund reference), Withdraw is customer-side only.
 *   5. "File on behalf of a firm" form for requests that arrive outside
 *      the app (email / WhatsApp) — creates a pending row so the decision
 *      still goes through this queue.
 *
 * MONEY NEVER MOVES HERE: the app does not call the Paystack refund API.
 * The founder executes refunds in the Paystack dashboard and records the
 * reference here; the paystack webhook (refund.processed) auto-completes
 * approved requests when Paystack confirms the money moved.
 *
 * DEFENSIVE QUERY PATTERN: same as SubscriptionRequestsCenter — the
 * refunds module requires a Convex deploy to exist on the backend, so all
 * calls use useConvex() + try/catch (never useQuery) to avoid a
 * synchronous throw black-screening the founder app.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useFounderAuth, useFounderToast } from '../FounderContexts';
import { formatNaira } from '../../utils/formatting';
import NairaSymbol from '../../components/NairaSymbol';

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm';
const LABEL = 'text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest';

const STATUS_FILTERS = [
    { id: 'pending',   label: 'Pending',   color: 'bg-amber-500' },
    { id: 'approved',  label: 'Approved',  color: 'bg-emerald-500' },
    { id: 'denied',    label: 'Denied',    color: 'bg-red-500' },
    { id: 'processed', label: 'Processed', color: 'bg-sky-500' },
    { id: 'cancelled', label: 'Cancelled', color: 'bg-slate-500' },
    { id: 'all',       label: 'All',       color: 'bg-primary-600' },
] as const;

const STATUS_CHIP: Record<string, string> = {
    pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    approved:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    denied:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    processed: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    cancelled: 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400',
};

const ELIGIBILITY_META: Record<string, { label: string; chip: string; hint: string }> = {
    guarantee: {
        label: 'In guarantee window',
        chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        hint: 'Annual plan, paid within the last 30 days — the money-back guarantee applies as-of-right. Denying requires a note.',
    },
    discretionary: {
        label: 'Discretionary',
        chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        hint: 'Outside the guarantee window or a monthly plan — refund is at your judgement (service failure, goodwill, etc.).',
    },
    unverified: {
        label: 'Unverified payment',
        chip: 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400',
        hint: 'No matching payment was found — verify the reference in Paystack before deciding.',
    },
};

const PRODUCT_LABEL: Record<string, string> = {
    legal: 'Vega', property: 'Atrium', unified: 'Komplete',
    vega: 'Vega', atrium: 'Atrium', komplete: 'Komplete',
};

function timeAgo(iso: string | null | undefined): string {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function formatWhen(iso: string | null | undefined): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export const RefundRequestsCenter: React.FC = () => {
    const { currentUser, bearerToken } = useFounderAuth();
    const { addToast } = useFounderToast();
    const tokenIdentifier = currentUser?.email || currentUser?.tokenIdentifier || '';

    // ─── State ────────────────────────────────────────────────────────
    const [statusFilter, setStatusFilter] = useState<string>('pending');
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [decisionNote, setDecisionNote] = useState<Record<string, string>>({});
    const [refundRef, setRefundRef] = useState<Record<string, string>>({});
    const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
    // "File on behalf" form
    const [showFileForm, setShowFileForm] = useState(false);
    const [fileFirmId, setFileFirmId] = useState('');
    const [fileReason, setFileReason] = useState('');
    const [fileAmount, setFileAmount] = useState('');
    const [fileReference, setFileReference] = useState('');
    const [isFiling, setIsFiling] = useState(false);

    // ─── Data — DEFENSIVE PATTERN (see file header) ───────────────────
    const convex = useConvex();
    const [stats, setStats] = useState<any>(undefined);
    const [requests, setRequests] = useState<any[] | undefined>(undefined);

    useEffect(() => {
        if (!tokenIdentifier || !convex) return;
        let cancelled = false;
        const fetchData = async () => {
            try {
                const s = await convex.query(api.refunds.getRefundRequestStats, { tokenIdentifier, sessionToken: bearerToken ?? undefined });
                if (!cancelled) setStats(s);
            } catch (e: any) {
                console.warn('[RefundRequestsCenter] getRefundRequestStats failed (backend may not be deployed yet):', e?.message || e);
                if (!cancelled) setStats(null);
            }
            try {
                const r = await convex.query(api.refunds.getRefundRequests, { tokenIdentifier, sessionToken: bearerToken ?? undefined, status: statusFilter });
                if (!cancelled) setRequests(r || []);
            } catch (e: any) {
                console.warn('[RefundRequestsCenter] getRefundRequests failed (backend may not be deployed yet):', e?.message || e);
                if (!cancelled) setRequests([]);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 30_000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [tokenIdentifier, convex, statusFilter]);

    const refresh = async () => {
        try {
            const s = await convex.query(api.refunds.getRefundRequestStats, { tokenIdentifier, sessionToken: bearerToken ?? undefined });
            setStats(s);
        } catch {}
        try {
            const r = await convex.query(api.refunds.getRefundRequests, { tokenIdentifier, sessionToken: bearerToken ?? undefined, status: statusFilter });
            setRequests(r || []);
        } catch {}
    };

    // ─── Filters ──────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        if (!requests || !Array.isArray(requests)) return [];
        if (!search) return requests;
        const q = search.toLowerCase();
        return requests.filter((r: any) =>
            r.firmName?.toLowerCase().includes(q) ||
            r.requestedByEmail?.toLowerCase().includes(q) ||
            r.transactionReference?.toLowerCase().includes(q) ||
            r.reason?.toLowerCase().includes(q)
        );
    }, [requests, search]);

    // ─── Actions ──────────────────────────────────────────────────────
    const decide = async (requestId: string, decision: 'approved' | 'denied') => {
        setIsProcessing(prev => ({ ...prev, [requestId]: true }));
        try {
            await convex.mutation(api.refunds.decideRefundRequest, {
                tokenIdentifier,
                sessionToken: bearerToken ?? undefined,
                requestId,
                decision,
                note: decisionNote[requestId]?.trim() || undefined,
            });
            addToast(decision === 'approved'
                ? 'Refund approved. Execute the refund in the Paystack dashboard, then mark it processed with the refund reference.'
                : 'Refund request denied. The firm has been notified.', { type: decision === 'approved' ? 'success' : 'info' });
            setDecisionNote(prev => ({ ...prev, [requestId]: '' }));
            await refresh();
        } catch (e: any) {
            addToast(e?.message?.split('\n')[0] || 'Action failed.', { type: 'error' });
        } finally {
            setIsProcessing(prev => ({ ...prev, [requestId]: false }));
        }
    };

    const markProcessed = async (requestId: string) => {
        setIsProcessing(prev => ({ ...prev, [requestId]: true }));
        try {
            await convex.mutation(api.refunds.markRefundProcessed, {
                tokenIdentifier,
                sessionToken: bearerToken ?? undefined,
                requestId,
                paystackRefundReference: refundRef[requestId]?.trim() || undefined,
            });
            addToast('Refund marked processed. The firm has been notified.', { type: 'success' });
            setRefundRef(prev => ({ ...prev, [requestId]: '' }));
            await refresh();
        } catch (e: any) {
            addToast(e?.message?.split('\n')[0] || 'Action failed.', { type: 'error' });
        } finally {
            setIsProcessing(prev => ({ ...prev, [requestId]: false }));
        }
    };

    const fileOnBehalf = async () => {
        if (!fileFirmId.trim() || fileReason.trim().length < 10) {
            addToast('Firm ID and a reason of at least 10 characters are required.', { type: 'error' });
            return;
        }
        setIsFiling(true);
        try {
            await convex.mutation(api.refunds.createRefundRequestOnBehalf, {
                tokenIdentifier,
                sessionToken: bearerToken ?? undefined,
                firmId: fileFirmId.trim(),
                reason: fileReason.trim(),
                amount: fileAmount ? Number(fileAmount) : undefined,
                transactionReference: fileReference.trim() || undefined,
            });
            addToast('Refund request filed on behalf of the firm. It is now pending your decision.', { type: 'success' });
            setFileFirmId(''); setFileReason(''); setFileAmount(''); setFileReference('');
            setShowFileForm(false);
            setStatusFilter('pending');
            await refresh();
        } catch (e: any) {
            addToast(e?.message?.split('\n')[0] || 'Failed to file the request.', { type: 'error' });
        } finally {
            setIsFiling(false);
        }
    };

    // ─── Render ───────────────────────────────────────────────────────
    return (
        <div className="h-full overflow-y-auto bg-slate-50 dark:bg-zinc-900 custom-scrollbar">
            <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-24">

                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-5">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Refunds</h1>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-md">
                            30-day money-back guarantee queue. Money moves manually in Paystack — this view tracks the promise, decision, and completion.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowFileForm(prev => !prev)}
                        className="flex-shrink-0 px-3 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 transition-colors shadow-sm"
                    >
                        {showFileForm ? 'Close' : '+ File on Behalf'}
                    </button>
                </div>

                {/* File-on-behalf form */}
                {showFileForm && (
                    <div className={`${CARD} mb-5`}>
                        <h3 className="text-sm font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-3">File a refund request on a firm's behalf</h3>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                            For refund requests that arrive by email, WhatsApp, or phone. The request enters the queue as pending — approving is still a separate, explicit step.
                        </p>
                        <div className="space-y-3">
                            <div>
                                <label className={LABEL}>Firm ID *</label>
                                <input
                                    value={fileFirmId}
                                    onChange={(e) => setFileFirmId(e.target.value)}
                                    placeholder="Copy from Organizations → firm details"
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-sm text-slate-900 dark:text-white font-mono"
                                />
                            </div>
                            <div>
                                <label className={LABEL}>Customer's reason * (min 10 chars)</label>
                                <textarea
                                    value={fileReason}
                                    onChange={(e) => setFileReason(e.target.value)}
                                    rows={3}
                                    placeholder="e.g. Customer emailed: service did not meet expectations, requesting annual plan refund (paid 12 Sep)."
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-sm text-slate-900 dark:text-white"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={LABEL}>Amount (₦, optional)</label>
                                    <input
                                        value={fileAmount}
                                        onChange={(e) => setFileAmount(e.target.value.replace(/[^0-9]/g, ''))}
                                        placeholder="Auto from payment"
                                        inputMode="numeric"
                                        className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-sm text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className={LABEL}>Paystack reference (optional)</label>
                                    <input
                                        value={fileReference}
                                        onChange={(e) => setFileReference(e.target.value)}
                                        placeholder="PP-…"
                                        className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-sm text-slate-900 dark:text-white font-mono"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={fileOnBehalf}
                                disabled={isFiling}
                                className="w-full py-2.5 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors"
                            >
                                {isFiling ? 'Filing…' : 'File Request'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    <div className={CARD}>
                        <p className={LABEL}>Pending</p>
                        <p className="text-2xl font-black text-amber-500 mt-1">{stats?.pending ?? '—'}</p>
                    </div>
                    <div className={CARD}>
                        <p className={LABEL}>Pending volume</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 flex items-center gap-0.5">
                            <NairaSymbol />{stats ? formatNaira(stats.pendingAmountNaira || 0) : '—'}
                        </p>
                    </div>
                    <div className={CARD}>
                        <p className={LABEL}>Approved — move money</p>
                        <p className={`text-2xl font-black mt-1 ${stats?.approved > 0 ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`}>{stats?.approved ?? '—'}</p>
                    </div>
                    <div className={CARD}>
                        <p className={LABEL}>Processed (total)</p>
                        <p className="text-2xl font-black text-sky-500 mt-1">{stats?.processed ?? '—'}</p>
                    </div>
                </div>

                {/* Search */}
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search firm, email, reference, reason…"
                    className="w-full mb-4 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm text-slate-900 dark:text-white shadow-sm"
                />

                {/* Status filter tabs */}
                <div className="flex gap-2 mb-5 overflow-x-auto pb-1 custom-scrollbar">
                    {STATUS_FILTERS.map(f => (
                        <button
                            key={f.id}
                            onClick={() => setStatusFilter(f.id)}
                            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                                statusFilter === f.id
                                    ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-900'
                                    : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 hover:border-slate-300'
                            }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${f.color}`} />
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* List */}
                {requests === undefined ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className={`${CARD} animate-pulse h-32`} />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-14 h-14 mx-auto bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-3">
                            <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 17m0 0l2-6m-2 6l6-2m3-3l6 2m0 0l-2-6m2 6l-6-2" transform="rotate(90 12 12)" />
                            </svg>
                        </div>
                        <p className="text-sm font-bold text-slate-600 dark:text-zinc-300">No {statusFilter === 'all' ? '' : statusFilter} refund requests</p>
                        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                            Customer requests appear here automatically (Settings → Billing → Request a refund).
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((r: any) => {
                            const elig = ELIGIBILITY_META[r.eligibility] || ELIGIBILITY_META.unverified;
                            const isExpanded = expandedId === r.id;
                            return (
                                <div key={r.id} className={CARD}>
                                    {/* Card header row */}
                                    <button
                                        onClick={() => setExpandedId(isExpanded ? null : r.id)}
                                        className="w-full text-left"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-bold text-slate-900 dark:text-white truncate">{r.firmName}</p>
                                                    <span className={`text-2xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${STATUS_CHIP[r.status] || STATUS_CHIP.cancelled}`}>{r.status}</span>
                                                    <span className={`text-2xs font-bold px-1.5 py-0.5 rounded ${elig.chip}`}>{elig.label}</span>
                                                    {r.submittedBy === 'founder' && (
                                                        <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">Founder-filed</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                                                    {r.requestedByEmail || '—'} · {r.plan ? `${PRODUCT_LABEL[r.firmProduct] || ''} ${r.plan}` : 'plan unknown'}{r.billingInterval ? ` (${r.billingInterval})` : ''} · {timeAgo(r.createdAt)}
                                                </p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-0.5">
                                                    <NairaSymbol />{formatNaira(r.amount || 0)}
                                                </p>
                                                {r.transactionReference && (
                                                    <p className="text-2xs text-slate-400 font-mono truncate max-w-[140px]" title={r.transactionReference}>{r.transactionReference}</p>
                                                )}
                                            </div>
                                        </div>
                                    </button>

                                    {/* Reason (always visible) */}
                                    <div className="mt-3 pl-3 border-l-2 border-slate-200 dark:border-zinc-600">
                                        <p className="text-xs text-slate-600 dark:text-zinc-300 italic line-clamp-2">"{r.reason}"</p>
                                    </div>

                                    {/* Expanded: eligibility hint + trail + actions */}
                                    {isExpanded && (
                                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-700 space-y-4">
                                            <p className="text-2xs text-slate-400 dark:text-zinc-500 leading-relaxed">{elig.hint}</p>

                                            {/* Status trail timeline */}
                                            <div>
                                                <p className={LABEL + ' mb-2'}>Status trail</p>
                                                <div className="space-y-2.5">
                                                    {(r.statusTrail || []).map((entry: any, i: number) => (
                                                        <div key={i} className="flex items-start gap-2.5">
                                                            <div className="flex flex-col items-center mt-1">
                                                                <span className={`w-2 h-2 rounded-full ${STATUS_CHIP[entry.status] ? STATUS_CHIP[entry.status].split(' ')[0] : 'bg-slate-400'}`} />
                                                                {i < (r.statusTrail || []).length - 1 && <span className="w-px h-4 bg-slate-200 dark:bg-zinc-600 mt-0.5" />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                                                                    {entry.status}
                                                                    <span className="font-normal text-slate-400 dark:text-zinc-500"> · {entry.by} · {formatWhen(entry.at)}</span>
                                                                </p>
                                                                {entry.note && <p className="text-2xs text-slate-500 dark:text-zinc-400 leading-snug">{entry.note}</p>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {(r.statusTrail || []).length === 0 && (
                                                        <p className="text-xs text-slate-400">No trail entries.</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            {r.status === 'pending' && (
                                                <div className="space-y-2">
                                                    <input
                                                        value={decisionNote[r.id] || ''}
                                                        onChange={(e) => setDecisionNote(prev => ({ ...prev, [r.id]: e.target.value }))}
                                                        placeholder={r.eligibility === 'guarantee' ? 'Note (required if denying a guarantee-window request)' : 'Note to the firm (optional)'}
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-xs text-slate-900 dark:text-white"
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => decide(r.id, 'approved')}
                                                            disabled={isProcessing[r.id]}
                                                            className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                                        >
                                                            {isProcessing[r.id] ? '…' : 'Approve'}
                                                        </button>
                                                        <button
                                                            onClick={() => decide(r.id, 'denied')}
                                                            disabled={isProcessing[r.id]}
                                                            className="flex-1 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 disabled:opacity-50 transition-colors"
                                                        >
                                                            {isProcessing[r.id] ? '…' : 'Deny'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {r.status === 'approved' && (
                                                <div className="space-y-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                                                    <p className="text-2xs font-bold text-emerald-700 dark:text-emerald-400 leading-relaxed">
                                                        1. Execute the refund in the Paystack dashboard (Transactions → Refund).<br />
                                                        2. Paste the refund reference below and mark processed.
                                                    </p>
                                                    <div className="flex gap-2">
                                                        <input
                                                            value={refundRef[r.id] || ''}
                                                            onChange={(e) => setRefundRef(prev => ({ ...prev, [r.id]: e.target.value }))}
                                                            placeholder="Paystack refund reference"
                                                            className="flex-1 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-700 text-xs text-slate-900 dark:text-white font-mono"
                                                        />
                                                        <button
                                                            onClick={() => markProcessed(r.id)}
                                                            disabled={isProcessing[r.id] || !(refundRef[r.id] || '').trim()}
                                                            className="px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-bold hover:bg-sky-700 disabled:opacity-50 transition-colors"
                                                        >
                                                            {isProcessing[r.id] ? '…' : 'Mark Processed'}
                                                        </button>
                                                    </div>
                                                    <p className="text-2xs text-emerald-600/70 dark:text-emerald-500/70">
                                                        Tip: if you already refunded in Paystack, the webhook may complete this automatically when refund.processed arrives.
                                                    </p>
                                                </div>
                                            )}

                                            {r.status === 'processed' && r.paystackRefundReference && (
                                                <p className="text-2xs text-slate-500 dark:text-zinc-400 font-mono">
                                                    Paystack refund ref: {r.paystackRefundReference} · processed by {r.processedBy || '—'} {timeAgo(r.processedAt)}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
