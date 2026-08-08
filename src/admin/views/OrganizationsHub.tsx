/**
 * OrganizationsHub — unified Organizations + Firm Health management center.
 *
 * Merges the former OrganizationsCenter and FirmHealth views into a single
 * intuitive hub with:
 *   - Multi-criteria filtering (Product, Plan, Team Size, Health Status)
 *   - Global search (Organization Name, Admin Email)
 *   - Master-detail drawer with:
 *     1. Firm Health & Usage Metrics (seats, matters, properties, tenants)
 *     2. Communication Log (broadcasts sent to this firm)
 *     3. Direct Organization Messaging (send targeted broadcast)
 *   - Admin actions (edit plan/status, login as firm, archive)
 *
 * PRIVACY: Only shows platform subscription billing data (what the firm
 * pays PracticePro). Client-level invoices and financials are NEVER shown.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useFounderAuth, useFounderToast } from '../FounderContexts';
import { formatNaira } from '../../utils/formatting';
import NairaSymbol from '../../components/NairaSymbol';

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm';
const LABEL = 'text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest';
const SECTION_TITLE = 'text-sm font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-3';

const PRODUCT_LABEL: Record<string, string> = {
    legal: 'Vega',
    property: 'Atrium',
    unified: 'Komplete',
    vega: 'Vega',
    atrium: 'Atrium',
    komplete: 'Komplete',
};

const PRODUCT_COLOR: Record<string, string> = {
    legal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    property: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    unified: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    vega: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    atrium: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    komplete: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
};

const PLAN_COLOR: Record<string, string> = {
    Enterprise: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    Komplete: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    Pro: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    Growth: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    Core: 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400',
    Starter: 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400',
};

type ProductFilter = 'all' | 'legal' | 'property' | 'unified';
type PlanFilter = 'all' | 'Core' | 'Growth' | 'Pro' | 'Enterprise';
type TeamSizeFilter = 'all' | '1-5' | '6-20' | '20+';
type HealthFilter = 'all' | 'active' | 'at-risk' | 'churned';

export const OrganizationsHub: React.FC = () => {
    const { currentUser } = useFounderAuth();
    const { addToast } = useFounderToast();
    const convex = useConvex();
    const tokenIdentifier = currentUser?.email || currentUser?.tokenIdentifier || '';

    // Data
    const firms = useQuery(api.founderMetrics.getAllFirmsForAdmin,
        tokenIdentifier ? { tokenIdentifier } : "skip");
    const updateFirmSettings = useMutation(api.founderMetrics.updateFirmAdminSettings);
    const logAdminAction = useMutation(api.founderMetrics.logAdminAction);

    // Filter state
    const [search, setSearch] = useState('');
    const [productFilter, setProductFilter] = useState<ProductFilter>('all');
    const [planFilter, setPlanFilter] = useState<PlanFilter>('all');
    const [teamSizeFilter, setTeamSizeFilter] = useState<TeamSizeFilter>('all');
    const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');

    // Selected firm for detail drawer
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editPlan, setEditPlan] = useState('');
    const [editStatus, setEditStatus] = useState('');

    // Direct message composer
    const [showMessageComposer, setShowMessageComposer] = useState(false);
    const [messageTitle, setMessageTitle] = useState('');
    const [messageBody, setMessageBody] = useState('');
    const [isSendingMessage, setIsSendingMessage] = useState(false);

    // Filtered firms with multi-criteria
    const filtered = useMemo(() => {
        if (!firms || !Array.isArray(firms)) return [];

        return firms.filter((f: any) => {
            // Search — matches firm name, admin email
            if (search) {
                const q = search.toLowerCase();
                if (!f.firmName?.toLowerCase().includes(q) &&
                    !f.adminEmail?.toLowerCase().includes(q)) return false;
            }

            // Product filter
            if (productFilter !== 'all') {
                const fProduct = (f.product || 'legal').toLowerCase();
                if (fProduct !== productFilter &&
                    !(productFilter === 'unified' && fProduct === 'komplete') &&
                    !(productFilter === 'legal' && fProduct === 'vega') &&
                    !(productFilter === 'property' && fProduct === 'atrium')) return false;
            }

            // Plan filter
            if (planFilter !== 'all') {
                if (f.plan !== planFilter) return false;
            }

            // Team size filter
            if (teamSizeFilter !== 'all') {
                const count = f.userCount || 0;
                if (teamSizeFilter === '1-5' && (count < 1 || count > 5)) return false;
                if (teamSizeFilter === '6-20' && (count < 6 || count > 20)) return false;
                if (teamSizeFilter === '20+' && count < 21) return false;
            }

            // Health filter (based on status)
            if (healthFilter !== 'all') {
                if (healthFilter === 'active' && f.status !== 'active') return false;
                if (healthFilter === 'at-risk' && f.status !== 'trial') return false;
                if (healthFilter === 'churned' && f.status !== 'suspended') return false;
            }

            return true;
        });
    }, [firms, search, productFilter, planFilter, teamSizeFilter, healthFilter]);

    const selectedFirm = selectedId ? (firms as any[])?.find(f => f.id === selectedId) : null;

    // Fetch health details for the selected firm
    const health = useQuery(api.founderMetrics.getFirmHealthDetails,
        tokenIdentifier && selectedId ? { tokenIdentifier, firmId: selectedId } : "skip");

    // Fetch broadcast history for this firm (communications log)
    const firmBroadcasts = useQuery(api.broadcasts.getActiveBroadcastsForAdmin,
        tokenIdentifier ? { tokenIdentifier } : "skip");

    // Filter broadcasts to those targeting this firm's product or 'all'
    const firmCommunications = useMemo(() => {
        if (!firmBroadcasts || !selectedFirm) return [];
        const fProduct = (selectedFirm.product || 'legal').toLowerCase();
        return firmBroadcasts.filter((b: any) => {
            const target = b.targetProduct || 'all';
            if (target === 'all') return true;
            if (target === fProduct) return true;
            if (target === 'unified' && fProduct === 'komplete') return true;
            if (target === 'legal' && fProduct === 'vega') return true;
            if (target === 'property' && fProduct === 'atrium') return true;
            return false;
        });
    }, [firmBroadcasts, selectedFirm]);

    const handleSave = async (firmId: string) => {
        try {
            await updateFirmSettings({
                tokenIdentifier,
                firmId,
                settings: {
                    subscriptionPlan: editPlan || undefined,
                    adminStatus: editStatus || undefined,
                },
            });
            try {
                await logAdminAction({
                    tokenIdentifier,
                    action: 'ADMIN ACTION: Updated firm settings',
                    targetFirmId: firmId,
                    details: `Plan: ${editPlan || 'unchanged'}, Status: ${editStatus || 'unchanged'}`,
                });
            } catch {}
            addToast('Organization updated.', { type: 'success' });
            setEditingId(null);
        } catch (e: any) {
            addToast(e?.message || 'Failed to update.', { type: 'error' });
        }
    };

    const handleSendMessage = async () => {
        if (!selectedFirm || !messageTitle.trim() || !messageBody.trim()) return;
        setIsSendingMessage(true);
        try {
            // Send a targeted broadcast to this firm's product
            const targetProduct = (selectedFirm.product || 'legal').toLowerCase() === 'unified' ? 'unified' :
                                  (selectedFirm.product || 'legal').toLowerCase() === 'property' ? 'property' : 'legal';
            const result = await convex.action(api.founderMetrics.broadcastNotification, {
                tokenIdentifier,
                targetProduct,
                channel: 'inapp',
                theme: 'info',
                title: messageTitle.trim(),
                message: messageBody.trim(),
                persistenceMode: 'permanent',
            });
            try {
                await logAdminAction({
                    tokenIdentifier,
                    action: 'ADMIN ACTION: Direct message to organization',
                    targetFirmId: selectedFirm.id,
                    details: `Sent "${messageTitle.trim()}" to ${selectedFirm.firmName} (${result.recipientCount} recipients)`,
                });
            } catch {}
            addToast(`Message sent to ${result.recipientCount} user(s) in ${selectedFirm.firmName}.`, { type: 'success' });
            setMessageTitle('');
            setMessageBody('');
            setShowMessageComposer(false);
        } catch (e: any) {
            addToast(e?.message || 'Failed to send message.', { type: 'error' });
        } finally {
            setIsSendingMessage(false);
        }
    };

    // Loading state
    if (firms === undefined) {
        return (
            <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
                <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Organizations</h2>
                </div>
                <div className="px-4 sm:px-6 lg:px-8 space-y-3">
                    {[1,2,3].map(i => <div key={i} className="h-20 bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 animate-pulse" />)}
                </div>
            </div>
        );
    }

    if (firms === null || (firms as any)?.error) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                <p className="text-sm">Unable to load organizations.</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            {/* Header */}
            <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Organizations</h2>
                            <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                {filtered.length} of {firms.length} firms · Unified hub with health & usage metrics
                            </p>
                        </div>
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search name or email..."
                            className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 w-32 sm:w-64"
                        />
                    </div>

                    {/* Filter bar */}
                    <div className="flex flex-wrap gap-2">
                        {/* Product filter */}
                        <select
                            value={productFilter}
                            onChange={e => setProductFilter(e.target.value as ProductFilter)}
                            className="px-2 py-1 text-2xs font-bold bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-200"
                        >
                            <option value="all">All Products</option>
                            <option value="legal">Vega</option>
                            <option value="property">Atrium</option>
                            <option value="unified">Komplete</option>
                        </select>

                        {/* Plan filter */}
                        <select
                            value={planFilter}
                            onChange={e => setPlanFilter(e.target.value as PlanFilter)}
                            className="px-2 py-1 text-2xs font-bold bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-200"
                        >
                            <option value="all">All Plans</option>
                            <option value="Core">Core</option>
                            <option value="Growth">Growth</option>
                            <option value="Pro">Pro</option>
                            <option value="Enterprise">Enterprise</option>
                        </select>

                        {/* Team size filter */}
                        <select
                            value={teamSizeFilter}
                            onChange={e => setTeamSizeFilter(e.target.value as TeamSizeFilter)}
                            className="px-2 py-1 text-2xs font-bold bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-200"
                        >
                            <option value="all">Any Team Size</option>
                            <option value="1-5">1–5 users</option>
                            <option value="6-20">6–20 users</option>
                            <option value="20+">20+ users</option>
                        </select>

                        {/* Health filter */}
                        <select
                            value={healthFilter}
                            onChange={e => setHealthFilter(e.target.value as HealthFilter)}
                            className="px-2 py-1 text-2xs font-bold bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-200"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="at-risk">At Risk (Trial)</option>
                            <option value="churned">Churned (Suspended)</option>
                        </select>

                        {/* Clear filters */}
                        {(productFilter !== 'all' || planFilter !== 'all' || teamSizeFilter !== 'all' || healthFilter !== 'all' || search) && (
                            <button
                                onClick={() => {
                                    setProductFilter('all');
                                    setPlanFilter('all');
                                    setTeamSizeFilter('all');
                                    setHealthFilter('all');
                                    setSearch('');
                                }}
                                className="px-2 py-1 text-2xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                            >
                                Clear Filters
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Firm table */}
            <div className="px-4 sm:px-6 lg:px-8">
                {filtered.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm p-12 text-center">
                        <p className="text-sm text-slate-400">No organizations match your filters.</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-zinc-700 text-left bg-slate-50 dark:bg-zinc-900/50">
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Organization</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Product</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Plan</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Team</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Monthly</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-700/50">
                                    {filtered.map((firm: any) => (
                                        <tr
                                            key={firm.id}
                                            onClick={() => setSelectedId(firm.id)}
                                            className={`cursor-pointer transition-colors ${selectedId === firm.id ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-slate-50 dark:hover:bg-zinc-700/30'}`}
                                        >
                                            <td className="py-2.5 px-3">
                                                <p className="font-semibold text-slate-700 dark:text-zinc-200 truncate max-w-[140px]">{firm.firmName}</p>
                                                <p className="text-2xs text-slate-400 truncate max-w-[140px]">{firm.adminEmail}</p>
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${PRODUCT_COLOR[firm.product] || PRODUCT_COLOR.legal}`}>
                                                    {PRODUCT_LABEL[firm.product] || firm.product || 'Vega'}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${PLAN_COLOR[firm.plan] || PLAN_COLOR.Core}`}>{firm.plan}</span>
                                                {/* CRO AUDIT Track B — show trial badge next to plan */}
                                                {firm.isOnTrial && (
                                                    <span className="ml-1 px-1.5 py-0.5 rounded text-3xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" title={`Trialing ${firm.trialPlan} • ${firm.trialDaysRemaining}d left`}>
                                                        TRIAL · {firm.trialDaysRemaining}d
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300 font-bold">{firm.userCount}</td>
                                            <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300 font-bold">
                                                {firm.monthlySubscription > 0 ? <><NairaSymbol />{formatNaira(firm.monthlySubscription)}</> : <span className="text-slate-400">Free</span>}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${firm.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : firm.status === 'suspended' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>{firm.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Drawer */}
            {selectedFirm && (
                <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center" onClick={() => { setSelectedId(null); setShowMessageComposer(false); }}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div
                        className="relative bg-white dark:bg-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-700 w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="sticky top-0 bg-white dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700 p-4 flex items-center justify-between z-10">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedFirm.firmName}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${PRODUCT_COLOR[selectedFirm.product] || PRODUCT_COLOR.legal}`}>
                                        {PRODUCT_LABEL[selectedFirm.product] || selectedFirm.product || 'Vega'}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${PLAN_COLOR[selectedFirm.plan] || PLAN_COLOR.Core}`}>{selectedFirm.plan}</span>
                                    {/* CRO AUDIT Track B — trial badge in detail drawer */}
                                    {selectedFirm.isOnTrial && (
                                        <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" title={`Trial ends ${new Date(selectedFirm.trialEndsAt).toLocaleString()}`}>
                                            TRIAL · {selectedFirm.trialPlan} · {selectedFirm.trialDaysRemaining}d left
                                        </span>
                                    )}
                                    <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${selectedFirm.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>{selectedFirm.status}</span>
                                </div>
                            </div>
                            <button onClick={() => { setSelectedId(null); setShowMessageComposer(false); }} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-700">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-4 space-y-4">
                            {/* ─── Firm Health & Usage Metrics ─────────────────── */}
                            <div className={CARD}>
                                <p className={SECTION_TITLE}>Health & Usage Metrics</p>
                                {health === undefined ? (
                                    <div className="flex justify-center py-4">
                                        <div className="w-6 h-6 border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
                                    </div>
                                ) : health ? (
                                    <div className="space-y-3">
                                        {/* Churn risk + seats */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className={`p-3 rounded-lg ${health.churnRiskScore >= 60 ? 'bg-red-50 dark:bg-red-900/20' : health.churnRiskScore >= 30 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                                                <p className="text-2xs text-slate-400 uppercase tracking-widest">Churn Risk</p>
                                                <p className={`text-2xl font-black ${health.churnRiskScore >= 60 ? 'text-red-600' : health.churnRiskScore >= 30 ? 'text-amber-600' : 'text-emerald-600'}`}>{health.churnRiskScore}/100</p>
                                                <p className="text-2xs text-slate-400">{health.churnRiskScore >= 60 ? 'HIGH' : health.churnRiskScore >= 30 ? 'MEDIUM' : 'LOW'}</p>
                                            </div>
                                            <div className="p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg">
                                                <p className="text-2xs text-slate-400 uppercase tracking-widest">User Seats</p>
                                                <p className="text-2xl font-black text-slate-700 dark:text-zinc-200">
                                                    {health.seatsUsed}<span className="text-sm text-slate-400"> / {health.maxSeats == null ? '∞' : health.maxSeats}</span>
                                                </p>
                                                <p className="text-2xs text-slate-400">
                                                    {health.maxSeats == null ? 'Unlimited' : `${health.plan} tier`}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Usage bars */}
                                        {health.tierLimits && (
                                            <div className="space-y-2">
                                                <UsageBar label="Seats" used={health.usage?.seatsUsed ?? 0} max={health.tierLimits.maxUsers} percent={health.usagePercentages?.seats} />
                                                {selectedFirm.product === 'property' && (
                                                    <>
                                                        <UsageBar label="Property Units" used={health.usage?.unitsUsed ?? 0} max={health.tierLimits.maxUnits} percent={health.usagePercentages?.units} />
                                                        <UsageBar label="Active Tenants" used={health.usage?.tenantsCount ?? 0} max={health.tierLimits.maxActiveTenants} percent={health.usagePercentages?.tenants} />
                                                    </>
                                                )}
                                                {selectedFirm.product === 'legal' && (
                                                    <UsageBar label="Active Matters" used={health.usage?.activeMattersCount ?? 0} max={health.tierLimits.maxActiveMatters} percent={health.usagePercentages?.matters} />
                                                )}
                                            </div>
                                        )}

                                        {/* Feature adoption */}
                                        <div>
                                            <p className="text-2xs font-bold text-slate-400 uppercase tracking-widest mb-2">Feature Adoption</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <AdoptionBadge label="E-Signature" used={health.featureAdoption?.hasUsedEsign} />
                                                <AdoptionBadge label="Voice Dictation" used={health.featureAdoption?.hasUsedVoiceDictation} />
                                                <AdoptionBadge label="DraftPro" used={health.featureAdoption?.hasUsedDraftPro} />
                                                <AdoptionBadge label="Research" used={health.featureAdoption?.hasUsedResearch} />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400">Unable to load health data.</p>
                                )}
                            </div>

                            {/* ─── Communication Log ───────────────────────────── */}
                            <div className={CARD}>
                                <p className={SECTION_TITLE}>Communication Log</p>
                                {firmCommunications.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-3">No broadcasts sent to this organization yet.</p>
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                        {firmCommunications.slice(0, 10).map((comm: any) => (
                                            <div key={comm.broadcastId} className="p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg">
                                                <p className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate">{comm.title}</p>
                                                <p className="text-2xs text-slate-400 truncate">{comm.message}</p>
                                                <div className="flex gap-1 mt-1">
                                                    <span className="px-1 py-0.5 rounded text-3xs font-bold bg-slate-200 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400">
                                                        {comm.createdAt ? new Date(comm.createdAt).toLocaleDateString('en-GB') : ''}
                                                    </span>
                                                    <span className="px-1 py-0.5 rounded text-3xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                        {comm.recipientCount} recipients
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ─── Direct Organization Messaging ──────────────── */}
                            <div className={CARD}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className={LABEL + ' mb-0'}>Direct Message</p>
                                    <button
                                        onClick={() => setShowMessageComposer(!showMessageComposer)}
                                        className="px-2 py-1 bg-primary-600 text-white rounded text-2xs font-bold hover:bg-primary-700"
                                    >
                                        {showMessageComposer ? 'Cancel' : 'Message Organization'}
                                    </button>
                                </div>
                                {showMessageComposer && (
                                    <div className="space-y-2 mt-2">
                                        <input
                                            type="text"
                                            value={messageTitle}
                                            onChange={e => setMessageTitle(e.target.value)}
                                            placeholder="Message title..."
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                        />
                                        <textarea
                                            value={messageBody}
                                            onChange={e => setMessageBody(e.target.value)}
                                            placeholder="Type your message to this organization..."
                                            rows={3}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 resize-none"
                                        />
                                        <button
                                            onClick={handleSendMessage}
                                            disabled={isSendingMessage || !messageTitle.trim() || !messageBody.trim()}
                                            className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 disabled:opacity-50"
                                        >
                                            {isSendingMessage ? 'Sending...' : `Send to ${PRODUCT_LABEL[selectedFirm.product] || 'this product'} users`}
                                        </button>
                                        <p className="text-2xs text-slate-400">Sends an in-app broadcast to all users on this product tier.</p>
                                    </div>
                                )}
                            </div>

                            {/* ─── Subscription & Admin Actions ───────────────── */}
                            <div className={CARD}>
                                <p className={SECTION_TITLE}>Subscription & Admin</p>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <p className="text-2xs text-slate-400">Monthly</p>
                                        <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">
                                            {selectedFirm.monthlySubscription > 0 ? <><NairaSymbol />{formatNaira(selectedFirm.monthlySubscription)}</> : 'Free'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-2xs text-slate-400">Admin</p>
                                        <p className="text-sm font-bold text-slate-700 dark:text-zinc-200 truncate">{selectedFirm.adminEmail}</p>
                                    </div>
                                </div>
                                {editingId === selectedFirm.id ? (
                                    <div className="space-y-2">
                                        <select value={editPlan} onChange={e => setEditPlan(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-900 text-xs rounded px-2 py-1.5 border border-slate-200 dark:border-zinc-600">
                                            <option value="">Keep Current Plan</option>
                                            <option value="Core">Core</option>
                                            <option value="Growth">Growth</option>
                                            <option value="Pro">Pro</option>
                                            <option value="Enterprise">Enterprise</option>
                                            <option value="Komplete">Komplete</option>
                                        </select>
                                        <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-900 text-xs rounded px-2 py-1.5 border border-slate-200 dark:border-zinc-600">
                                            <option value="">Keep Current Status</option>
                                            <option value="active">Active</option>
                                            <option value="suspended">Suspended</option>
                                            <option value="trial">Trial</option>
                                        </select>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleSave(selectedFirm.id)} className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">Save</button>
                                            <button onClick={() => setEditingId(null)} className="px-3 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-lg text-xs font-bold">Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => { setEditingId(selectedFirm.id); setEditPlan(''); setEditStatus(''); }}
                                        className="w-full px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-zinc-600"
                                    >
                                        Edit Subscription & Status
                                    </button>
                                )}
                            </div>

                            {/* ─── Support Actions ─────────────────────────────── */}
                            <div className={CARD}>
                                <p className={SECTION_TITLE}>Support Actions</p>
                                <button
                                    onClick={() => {
                                        const adminEmail = selectedFirm.adminEmail;
                                        if (adminEmail && adminEmail !== 'unknown') {
                                            const url = `https://practice-pro-vega.vercel.app/?impersonate=${encodeURIComponent(adminEmail.toLowerCase())}`;
                                            window.open(url, '_blank');
                                            addToast(`Opening firm dashboard as ${adminEmail}...`, { type: 'success' });
                                        } else {
                                            addToast('No admin email found for this firm.', { type: 'error' });
                                        }
                                    }}
                                    className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                    Login As This Firm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Helper Components ────────────────────────────────────────────────
const UsageBar: React.FC<{ label: string; used: number; max: number | null; percent: number | null }> = ({ label, used, max, percent }) => {
    const isUnlimited = max === null || max === undefined;
    const colorClass = percent == null ? 'bg-slate-300' :
                       percent >= 100 ? 'bg-red-500' :
                       percent >= 80 ? 'bg-amber-500' :
                       'bg-emerald-500';
    return (
        <div>
            <div className="flex justify-between items-center mb-0.5">
                <span className="text-2xs font-bold text-slate-600 dark:text-zinc-300">{label}</span>
                <span className="text-2xs text-slate-400">
                    {used}{isUnlimited ? '' : ` / ${max}`}{percent != null && ` (${percent}%)`}
                </span>
            </div>
            {!isUnlimited && (
                <div className="h-1.5 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.min(100, percent || 0)}%` }} />
                </div>
            )}
            {isUnlimited && <p className="text-2xs text-slate-400">Unlimited</p>}
        </div>
    );
};

const AdoptionBadge: React.FC<{ label: string; used: boolean }> = ({ label, used }) => (
    <div className={`p-2 rounded-lg ${used ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-slate-50 dark:bg-zinc-900'}`}>
        <p className={`text-2xs font-bold ${used ? 'text-emerald-600' : 'text-slate-400'}`}>{label}</p>
        <p className={`text-3xs ${used ? 'text-emerald-500' : 'text-slate-400'}`}>{used ? '✓' : '—'}</p>
    </div>
);
