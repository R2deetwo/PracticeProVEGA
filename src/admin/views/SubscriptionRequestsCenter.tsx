/**
 * SubscriptionRequestsCenter — Founder Admin approval queue for
 * subscription upgrade requests.
 *
 * CRO AUDIT Track A — Revenue Protection
 *
 * When a firm clicks "Pay Now / Report Payment Transferred" in the
 * PaymentGatewayModal, a pending row is inserted in the subscriptionRequests
 * table (status='pending_review'). The firm's subscriptionPlan is NOT
 * touched — only this founder admin view can flip the plan.
 *
 * This view surfaces:
 *   1. Stats header (pending count + total pending NGN volume)
 *   2. Filterable list of requests (pending / approved / rejected / all)
 *   3. Per-request card with: firm name, plan transition, amount, reference,
 *      requestedAt, auto-revert countdown, proof (if uploaded)
 *   4. Approve / Reject buttons with adminNotes input
 *
 * Auto-revert: pending requests auto-revert to 'auto_reverted' status
 * after 72 hours (cron at 0:10 UTC daily).
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useFounderAuth, useFounderToast } from '../FounderContexts';
import { formatNaira } from '../../utils/formatting';
import NairaSymbol from '../../components/NairaSymbol';

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm';
const LABEL = 'text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest';
const SECTION_TITLE = 'text-sm font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-3';

const STATUS_FILTERS = [
  { id: 'pending_review', label: 'Pending', color: 'bg-amber-500' },
  { id: 'approved',       label: 'Approved', color: 'bg-emerald-500' },
  { id: 'rejected',       label: 'Rejected', color: 'bg-red-500' },
  { id: 'auto_reverted',  label: 'Auto-Reverted', color: 'bg-slate-500' },
  { id: 'all',            label: 'All', color: 'bg-primary-600' },
] as const;

const PLAN_COLOR: Record<string, string> = {
  Enterprise: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  Komplete:   'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  Pro:        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Growth:     'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Core:       'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400',
};

const PRODUCT_LABEL: Record<string, string> = {
  legal: 'Vega', property: 'Atrium', unified: 'Komplete',
  vega: 'Vega', atrium: 'Atrium', komplete: 'Komplete',
};

const PRODUCT_COLOR: Record<string, string> = {
  legal:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  property:  'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  unified:   'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  vega:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  atrium:    'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  komplete:  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
};

function timeAgo(iso: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function timeUntil(epochMs: number | null): string {
  if (!epochMs) return '—';
  const diff = epochMs - Date.now();
  if (diff <= 0) return 'expired';
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

export const SubscriptionRequestsCenter: React.FC = () => {
  const { currentUser, bearerToken } = useFounderAuth();
  const { addToast } = useFounderToast();
  const tokenIdentifier = currentUser?.email || currentUser?.tokenIdentifier || '';

  // State
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]['id']>('pending_review');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  // CRO AUDIT — discounting system state
  const [discountPercent, setDiscountPercent] = useState<Record<string, number>>({});
  const [discountReason, setDiscountReason] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});

  // Data — DEFENSIVE PATTERN.
  // The new founderMetrics mutations (getSubscriptionRequestStats,
  // getSubscriptionRequests) require a Convex deploy to exist on the backend.
  // Until then, useQuery would throw synchronously and crash the page.
  // Using useConvex() + useEffect + try/catch so the page renders with
  // empty state until the backend is deployed.
  const convex = useConvex();
  const [stats, setStats] = useState<any>(undefined);
  const [requests, setRequests] = useState<any[] | undefined>(undefined);

  useEffect(() => {
    if (!tokenIdentifier || !convex) return;
    let cancelled = false;
    const fetchData = async () => {
      try {
        const s = await convex.query(api.founderMetrics.getSubscriptionRequestStats, { tokenIdentifier, sessionToken: bearerToken ?? undefined });
        if (!cancelled) setStats(s);
      } catch (e: any) {
        console.warn('[SubscriptionRequestsCenter] getSubscriptionRequestStats failed (backend may not be deployed yet):', e?.message || e);
        if (!cancelled) setStats(null);
      }
      try {
        const r = await convex.query(api.founderMetrics.getSubscriptionRequests, { tokenIdentifier, sessionToken: bearerToken ?? undefined, status: statusFilter });
        if (!cancelled) setRequests(r || []);
      } catch (e: any) {
        console.warn('[SubscriptionRequestsCenter] getSubscriptionRequests failed (backend may not be deployed yet):', e?.message || e);
        if (!cancelled) setRequests([]);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30_000);  // refresh every 30s
    return () => { cancelled = true; clearInterval(interval); };
  }, [tokenIdentifier, convex, statusFilter]);

  // Mutations — also defensive (use convex.mutation directly in handlers).
  // The useMutation hook itself doesn't throw at render time even if the
  // backend doesn't have the function yet — it only throws when called.
  // So we keep useMutation here; the handlers wrap calls in try/catch.
  const approveMutation = useMutation(api.founderMetrics.approveSubscriptionRequestAsFounder);
  const rejectMutation  = useMutation(api.founderMetrics.rejectSubscriptionRequestAsFounder);

  // Filtered requests (search by firm name, user email, reference)
  const filtered = useMemo(() => {
    if (!requests || !Array.isArray(requests)) return [];
    if (!search) return requests;
    const q = search.toLowerCase();
    return requests.filter((r: any) =>
      r.firmName?.toLowerCase().includes(q) ||
      r.userEmail?.toLowerCase().includes(q) ||
      r.transactionReference?.toLowerCase().includes(q) ||
      r.requestedPlan?.toLowerCase().includes(q)
    );
  }, [requests, search]);

  const handleApprove = async (requestId: string) => {
    setIsProcessing(prev => ({ ...prev, [requestId]: true }));
    try {
      await approveMutation({
        tokenIdentifier,
        sessionToken: bearerToken ?? undefined,
        requestId,
        adminNotes: adminNotes[requestId] || undefined,
        // CRO AUDIT — discounting system
        discountPercent: discountPercent[requestId] || undefined,
        discountReason: discountReason[requestId] || undefined,
      });
      const dp = discountPercent[requestId] || 0;
      addToast(
        dp > 0
          ? `Subscription approved with ${dp}% discount. Firm plan updated.`
          : 'Subscription approved. Firm plan updated.',
        { type: 'success' }
      );
      setExpandedId(null);
      setAdminNotes(prev => { const n = { ...prev }; delete n[requestId]; return n; });
      setDiscountPercent(prev => { const n = { ...prev }; delete n[requestId]; return n; });
      setDiscountReason(prev => { const n = { ...prev }; delete n[requestId]; return n; });
    } catch (e: any) {
      addToast(e?.message || 'Failed to approve.', { type: 'error' });
    } finally {
      setIsProcessing(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleReject = async (requestId: string) => {
    setIsProcessing(prev => ({ ...prev, [requestId]: true }));
    try {
      await rejectMutation({
        tokenIdentifier,
        sessionToken: bearerToken ?? undefined,
        requestId,
        reason: rejectReason[requestId] || undefined,
      });
      addToast('Subscription rejected. Firm notified.', { type: 'success' });
      setExpandedId(null);
      setRejectReason(prev => { const n = { ...prev }; delete n[requestId]; return n; });
    } catch (e: any) {
      addToast(e?.message || 'Failed to reject.', { type: 'error' });
    } finally {
      setIsProcessing(prev => ({ ...prev, [requestId]: false }));
    }
  };

  // ─── Loading state ────────────────────────────────────────────────
  if (requests === undefined || stats === undefined) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20 overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Subscription Requests</h2>
        <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Approve or reject bank-transfer upgrade requests. Auto-reverts after 72h.
        </p>
      </div>

      <div className="px-4 space-y-4">
        {/* ─── Stats Strip ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={CARD}>
            <p className={LABEL}>Pending</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{stats?.pending || 0}</p>
          </div>
          <div className={CARD}>
            <p className={LABEL}>Pending Volume</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              <NairaSymbol />{formatNaira(stats?.pendingAmountNaira || 0)}
            </p>
          </div>
          <div className={CARD}>
            <p className={LABEL}>Approved (lifetime)</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats?.approved || 0}</p>
          </div>
          <div className={CARD}>
            <p className={LABEL}>Expiring Soon (24h)</p>
            <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{stats?.expiringSoon || 0}</p>
          </div>
        </div>

        {/* ─── Search + Filters ────────────────────────────────────── */}
        <div className={CARD}>
          <input
            type="text"
            placeholder="Search by firm, email, reference, or plan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
          />
          <div className="flex gap-1 mt-3 overflow-x-auto no-scrollbar">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-md text-2xs font-bold transition-colors whitespace-nowrap flex-shrink-0 ${
                  statusFilter === f.id
                    ? `${f.color} text-white shadow-sm`
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Empty State ─────────────────────────────────────────── */}
        {filtered.length === 0 && (
          <div className={CARD + ' text-center py-12'}>
            <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-700 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300">
              {statusFilter === 'pending_review' ? 'No pending requests' : `No ${statusFilter.replace('_', ' ')} requests`}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {statusFilter === 'pending_review'
                ? 'When a firm reports a bank transfer, it will appear here for your approval.'
                : 'Try a different filter or search.'}
            </p>
          </div>
        )}

        {/* ─── Request List ────────────────────────────────────────── */}
        <div className="space-y-3">
          {filtered.map((r: any) => {
            const isExpanded = expandedId === r.id;
            const isPending = r.status === 'pending_review';
            const productLabel = PRODUCT_LABEL[r.firmProduct] || r.firmProduct || '—';
            const productColor = PRODUCT_COLOR[r.firmProduct] || 'bg-slate-100 text-slate-700';
            const planColor = PLAN_COLOR[r.requestedPlan] || 'bg-slate-100 text-slate-700';
            const currentPlanColor = PLAN_COLOR[r.currentPlan] || 'bg-slate-100 text-slate-700';

            return (
              <div key={r.id} className={CARD + ' transition-all ' + (isPending ? 'border-l-4 border-l-amber-500' : '')}>
                {/* Header row — always visible */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                  className="w-full flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-2xs font-black uppercase tracking-widest px-2 py-0.5 rounded ${productColor}`}>
                        {productLabel}
                      </span>
                      <span className={`text-2xs font-black uppercase tracking-widest px-2 py-0.5 rounded ${currentPlanColor}`}>
                        {r.currentPlan}
                      </span>
                      <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <span className={`text-2xs font-black uppercase tracking-widest px-2 py-0.5 rounded ${planColor}`}>
                        {r.requestedPlan}
                      </span>
                      {isPending && r.autoRevertAt && (
                        <span className="text-2xs text-amber-600 dark:text-amber-400 font-bold ml-auto">
                          ⏱ {timeUntil(r.autoRevertAt)}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{r.firmName}</h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                      {r.userEmail || 'Unknown user'} • {timeAgo(r.requestedAt)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-black text-slate-900 dark:text-white">
                      <NairaSymbol />{formatNaira(r.amount || 0)}
                    </p>
                    <p className="text-2xs text-slate-400 uppercase tracking-widest">
                      {r.billingInterval || 'annual'}
                    </p>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-700 space-y-3 animate-fade-in">
                    {/* Reference + Review info */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className={LABEL}>Transaction Reference</p>
                        <p className="font-mono font-bold text-slate-700 dark:text-zinc-300 text-xs mt-1 break-all">
                          {r.transactionReference || '—'}
                        </p>
                      </div>
                      <div>
                        <p className={LABEL}>Status</p>
                        <p className="font-bold text-slate-700 dark:text-zinc-300 mt-1 capitalize">
                          {(r.status || '—').replace('_', ' ')}
                        </p>
                        {r.reviewedAt && (
                          <p className="text-2xs text-slate-400 mt-1">
                            by {r.reviewedBy || '—'} • {timeAgo(r.reviewedAt)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Payment proof note */}
                    {r.paymentProofNote && (
                      <div className="bg-slate-50 dark:bg-zinc-700/30 rounded-lg p-3">
                        <p className={LABEL}>User Note</p>
                        <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1 italic">
                          "{r.paymentProofNote}"
                        </p>
                      </div>
                    )}

                    {/* Admin notes (existing, if any) */}
                    {r.adminNotes && !isPending && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                        <p className={LABEL}>Admin Notes</p>
                        <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1">{r.adminNotes}</p>
                      </div>
                    )}

                    {/* CRO AUDIT — show discount info on approved requests */}
                    {r.status === 'approved' && r.discountPercent && r.discountPercent > 0 && (
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
                        <p className={LABEL}>Discount Applied</p>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-slate-600 dark:text-zinc-300">
                            {r.discountPercent}% — {r.discountReason || 'no reason'}
                          </span>
                          <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            <NairaSymbol />{formatNaira(r.discountedAmount || 0)}
                            <span className="ml-1 text-2xs text-slate-400 line-through">
                              <NairaSymbol />{formatNaira(r.amount || 0)}
                            </span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Approve / Reject UI for pending requests */}
                    {isPending && (
                      <div className="space-y-3 pt-2">
                        {/* CRO AUDIT — Discounting system.
                            Founder can apply a discount % (0-100) before approving.
                            The discounted amount is computed live + shown below. */}
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
                          <label className={LABEL + ' block mb-2'}>Discount (optional)</label>
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={discountPercent[r.id] || 0}
                              onChange={e => setDiscountPercent(prev => ({ ...prev, [r.id]: parseInt(e.target.value) }))}
                              className="flex-1 accent-emerald-600"
                            />
                            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm w-12 text-right">
                              {discountPercent[r.id] || 0}%
                            </span>
                          </div>
                          <input
                            type="text"
                            placeholder="Discount reason (e.g. Early adopter loyalty discount)"
                            value={discountReason[r.id] || ''}
                            onChange={e => setDiscountReason(prev => ({ ...prev, [r.id]: e.target.value }))}
                            className="w-full px-2 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 rounded text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-1 focus:ring-emerald-500/30 outline-none"
                          />
                          {/* Live discount calculation */}
                          <div className="mt-2 flex justify-between items-center text-xs">
                            <span className="text-slate-500 dark:text-zinc-400">
                              Original: <NairaSymbol />{formatNaira(r.amount || 0)}
                            </span>
                            {(discountPercent[r.id] || 0) > 0 && (
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                Final: <NairaSymbol />{formatNaira(Math.round((r.amount || 0) * (1 - (discountPercent[r.id] || 0) / 100)))}
                                <span className="ml-1 text-2xs text-emerald-600 dark:text-emerald-500">
                                  (save <NairaSymbol />{formatNaira((r.amount || 0) - Math.round((r.amount || 0) * (1 - (discountPercent[r.id] || 0) / 100)))})
                                </span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Approve notes */}
                        <div>
                          <label className={LABEL + ' block mb-1'}>Approval Notes (optional)</label>
                          <input
                            type="text"
                            placeholder="e.g. Verified transfer of ₦80,000 received at 14:32"
                            value={adminNotes[r.id] || ''}
                            onChange={e => setAdminNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
                          />
                        </div>
                        {/* Reject reason */}
                        <div>
                          <label className={LABEL + ' block mb-1'}>Rejection Reason (if rejecting)</label>
                          <input
                            type="text"
                            placeholder="e.g. Transfer not received. Please contact support."
                            value={rejectReason[r.id] || ''}
                            onChange={e => setRejectReason(prev => ({ ...prev, [r.id]: e.target.value }))}
                            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-red-500/30 focus:border-red-500 outline-none"
                          />
                        </div>
                        {/* Action buttons */}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleApprove(r.id)}
                            disabled={isProcessing[r.id]}
                            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                            {isProcessing[r.id] ? (
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                            Approve &amp; Activate
                          </button>
                          <button
                            onClick={() => handleReject(r.id)}
                            disabled={isProcessing[r.id]}
                            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                            {isProcessing[r.id] ? (
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
