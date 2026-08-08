/**
 * FounderDashboard — platform-wide monitoring dashboard.
 *
 * FEATURES:
 *   - Product filter toggle (All / Atrium / Vega / Komplete)
 *   - Clickable product breakdown cards → navigate to Signals
 *   - Top Entities toggle (Organizations by Properties vs Firms by Matters)
 *   - Compact currency formatting (no overflow)
 *   - Atrium-first layout (property metrics take priority)
 */

import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useFounderAuth } from '../admin/FounderContexts';
import NairaSymbol from './NairaSymbol';

const KPI_CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm overflow-hidden cursor-pointer transition-colors hover:border-primary-400';
const KPI_LABEL = 'text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest';
const KPI_VALUE = 'text-lg sm:text-2xl font-black text-slate-900 dark:text-white mt-1 truncate';
const SECTION_TITLE = 'text-sm font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-3';

function formatCompact(amount: number): string {
    if (!amount || isNaN(amount)) return '0';
    if (amount >= 1_000_000_000) return (amount / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (amount >= 1_000) return (amount / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return amount.toFixed(0);
}

type ProductFilter = 'all' | 'property' | 'legal' | 'unified';

const PRODUCT_FILTERS: { id: ProductFilter; label: string; color: string }[] = [
    { id: 'all', label: 'All', color: 'bg-primary-600' },
    { id: 'property', label: 'Atrium', color: 'bg-sky-500' },
    { id: 'legal', label: 'Vega', color: 'bg-emerald-500' },
    { id: 'unified', label: 'Komplete', color: 'bg-violet-500' },
];

const PRODUCT_LABEL: Record<string, string> = {
    legal: 'Vega',
    property: 'Atrium',
    unified: 'Komplete',
};

interface FounderDashboardProps {
    onNavigateToSignals?: (product?: string) => void;
    // CRO AUDIT Track A — allow the dashboard to navigate to the
    // Subscriptions approval queue when the founder taps the actionable banner.
    onNavigateToSubscriptions?: () => void;
}

export const FounderDashboard: React.FC<FounderDashboardProps> = ({ onNavigateToSignals: _onNavigateToSignals, onNavigateToSubscriptions }) => {
    const { currentUser } = useFounderAuth();
    const [productFilter, setProductFilter] = useState<ProductFilter>('all');
    const [entityToggle, setEntityToggle] = useState<'properties' | 'matters'>('properties');

    const tokenIdentifier = currentUser?.email || currentUser?.tokenIdentifier || '';
    const metrics = useQuery(api.founderMetrics.getFounderMetrics,
        tokenIdentifier ? { tokenIdentifier } : "skip");

    // CRO AUDIT Track A — fetch pending subscription requests + trial metrics
    // for the actionable items banner at the top of the dashboard.
    const subStats = useQuery(api.founderMetrics.getSubscriptionRequestStats,
        tokenIdentifier ? { tokenIdentifier } : "skip");
    const trialMetrics = useQuery(api.founderMetrics.getTrialMetrics,
        tokenIdentifier ? { tokenIdentifier } : "skip");

    const pendingSubCount = subStats?.pending || 0;
    const pendingSubVolume = subStats?.pendingAmountNaira || 0;
    const expiringSoonCount = subStats?.expiringSoon || 0;
    const activeTrials = trialMetrics?.activeTrials || 0;
    const trialsEndingToday = trialMetrics?.endingToday || 0;

    if (metrics === undefined) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (metrics === null || (metrics as any)?.error) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold mb-2">Founder Dashboard</h2>
                <p className="text-sm max-w-md mb-4">The founder dashboard needs a verified founder account to load platform metrics.</p>
            </div>
        );
    }

    const platformRevenue = metrics.platformRevenue || 0;
    const monthlyRecurringRevenue = metrics.monthlyRecurringRevenue || 0;
    const activeCount = metrics.activeUserList?.length || 0;
    const productBreakdown = metrics.productBreakdown || [];
    const atrium = productBreakdown.find((p: any) => p.product === 'property');
    const vega = productBreakdown.find((p: any) => p.product === 'legal');
    const komplete = productBreakdown.find((p: any) => p.product === 'unified');

    // ─── Per-product KPI recalculation ──────────────────────────────────
    // When a specific product filter is selected, the KPI strip shows
    // that product's metrics (firms, users, matters, MRR) instead of
    // the global totals. This is what makes tapping Atrium/Vega/Komplete
    // actually change the numbers on the dashboard.
    const selectedProductData = productFilter === 'all'
        ? null
        : productBreakdown.find((p: any) => p.product === productFilter);

    const displayFirms = selectedProductData ? selectedProductData.firms : metrics.totalFirms;
    const displayUsers = selectedProductData ? selectedProductData.users : metrics.totalUsers;
    const displayMatters = selectedProductData ? selectedProductData.matters : metrics.totalMatters;
    const displayMRR = selectedProductData ? (selectedProductData.mrr || 0) : monthlyRecurringRevenue;
    const displayRevenue = selectedProductData ? (selectedProductData.revenue || 0) : platformRevenue;

    // Filter top firms by product if a specific product is selected
    const topFirms = (metrics.topFirms || []).filter((f: any) => {
        if (productFilter === 'all') return true;
        return (f.product || 'unified') === productFilter;
    });

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20 overflow-x-hidden">
            {/* Header */}
            <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
                <div className="flex flex-col gap-3">
                    <div>
                        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Founder Dashboard</h2>
                        <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                            {productFilter !== 'all'
                                ? `Showing ${PRODUCT_LABEL[productFilter] || 'product'} metrics • Last updated: ${metrics.lastUpdated ? new Date(metrics.lastUpdated).toLocaleString('en-GB') : '—'}`
                                : `Last updated: ${metrics.lastUpdated ? new Date(metrics.lastUpdated).toLocaleString('en-GB') : '—'}`
                            }
                        </p>
                    </div>
                    {/* Product filter toggle */}
                    <div className="flex gap-1 bg-slate-100 dark:bg-zinc-800 rounded-lg p-1 overflow-x-auto no-scrollbar">
                        {PRODUCT_FILTERS.map(pf => (
                            <button
                                key={pf.id}
                                onClick={() => setProductFilter(pf.id)}
                                className={`px-3 py-1.5 rounded-md text-2xs font-bold transition-colors whitespace-nowrap flex-shrink-0 ${
                                    productFilter === pf.id
                                        ? `${pf.color} text-white shadow-sm`
                                        : 'text-slate-500 dark:text-zinc-400'
                                }`}
                            >
                                {pf.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="px-4 space-y-6">
                {/* ─── ACTION ITEMS BANNER (CRO AUDIT Track A) ─────────────── */}
                {/* Surfaces pending subscription requests + trials ending today
                    as the most actionable items at the top of the dashboard. */}
                {(pendingSubCount > 0 || trialsEndingToday > 0) && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl p-4 animate-fade-in">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center text-white">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                </svg>
                            </div>
                            <h3 className="text-sm font-black text-amber-800 dark:text-amber-200 uppercase tracking-widest">Action Items</h3>
                        </div>
                        <div className="space-y-2">
                            {pendingSubCount > 0 && (
                                <button
                                    onClick={() => onNavigateToSubscriptions?.()}
                                    className="w-full flex items-center justify-between p-3 bg-white dark:bg-zinc-800 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-black text-xs flex-shrink-0 ${expiringSoonCount > 0 ? 'bg-red-500' : 'bg-amber-500'}`}>
                                            {pendingSubCount > 9 ? '9+' : pendingSubCount}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                {pendingSubCount} subscription {pendingSubCount === 1 ? 'request' : 'requests'} pending
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-zinc-400">
                                                <NairaSymbol />{formatCompact(pendingSubVolume)} in pending volume
                                                {expiringSoonCount > 0 && <span className="text-red-600 dark:text-red-400 font-bold"> • {expiringSoonCount} expiring in 24h</span>}
                                            </p>
                                        </div>
                                    </div>
                                    <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            )}
                            {trialsEndingToday > 0 && (
                                <div className="w-full flex items-center justify-between p-3 bg-white dark:bg-zinc-800 rounded-xl text-left">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-500 text-white font-black text-xs flex-shrink-0">
                                            {trialsEndingToday > 9 ? '9+' : trialsEndingToday}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                {trialsEndingToday} {trialsEndingToday === 1 ? 'trial' : 'trials'} ending today
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-zinc-400">
                                                {activeTrials} active trials total — daily expiry cron runs at 0:05 UTC
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── Trial Funnel Mini-Stats (CRO AUDIT Track B) ─────── */}
                {/* Shows trial conversion funnel health at a glance. */}
                {activeTrials > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                        <div className={KPI_CARD}>
                            <p className={KPI_LABEL}>Active Trials</p>
                            <p className={KPI_VALUE}>{activeTrials}</p>
                        </div>
                        <div className={KPI_CARD}>
                            <p className={KPI_LABEL}>Ending in 4 Days</p>
                            <p className="text-lg sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 truncate">
                                {trialMetrics?.endingIn4Days || 0}
                            </p>
                        </div>
                        <div className={KPI_CARD}>
                            <p className={KPI_LABEL}>Total Trials Started</p>
                            <p className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                                {trialMetrics?.totalTrialsStarted || 0}
                            </p>
                        </div>
                    </div>
                )}

                {/* ─── PRODUCT BREAKDOWN (clickable → filter dashboard) ──── */}
                <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm overflow-hidden">
                    <p className={SECTION_TITLE}>Product Breakdown — Tap to filter dashboard</p>
                    <div className="grid grid-cols-3 gap-3">
                        {/* Atrium */}
                        <button
                            onClick={() => setProductFilter('property')}
                            className={`text-center p-3 bg-sky-50 dark:bg-sky-900/20 rounded-xl min-w-0 hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors ${productFilter === 'property' ? 'ring-2 ring-sky-500' : ''}`}
                        >
                            <p className="text-2xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest mb-1">Atrium</p>
                            <p className="text-xl font-black text-slate-900 dark:text-white">{atrium?.firms || 0}</p>
                            <p className="text-2xs text-slate-400">{atrium?.users || 0} users</p>
                            <p className="text-3xs text-slate-500 dark:text-zinc-500 mt-1"><NairaSymbol />{formatCompact(atrium?.mrr || 0)}/mo</p>
                        </button>
                        {/* Vega */}
                        <button
                            onClick={() => setProductFilter('legal')}
                            className={`text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl min-w-0 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors ${productFilter === 'legal' ? 'ring-2 ring-emerald-500' : ''}`}
                        >
                            <p className="text-2xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Vega</p>
                            <p className="text-xl font-black text-slate-900 dark:text-white">{vega?.firms || 0}</p>
                            <p className="text-2xs text-slate-400">{vega?.users || 0} users</p>
                            <p className="text-3xs text-slate-500 dark:text-zinc-500 mt-1"><NairaSymbol />{formatCompact(vega?.mrr || 0)}/mo</p>
                        </button>
                        {/* Komplete */}
                        <button
                            onClick={() => setProductFilter('unified')}
                            className={`text-center p-3 bg-violet-50 dark:bg-violet-900/20 rounded-xl min-w-0 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors ${productFilter === 'unified' ? 'ring-2 ring-violet-500' : ''}`}
                        >
                            <p className="text-2xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest mb-1">Komplete</p>
                            <p className="text-xl font-black text-slate-900 dark:text-white">{komplete?.firms || 0}</p>
                            <p className="text-2xs text-slate-400">{komplete?.users || 0} users</p>
                            <p className="text-3xs text-slate-500 dark:text-zinc-500 mt-1"><NairaSymbol />{formatCompact(komplete?.mrr || 0)}/mo</p>
                        </button>
                    </div>
                </div>

                {/* ─── KPI Strip ─────────────────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className={KPI_CARD} onClick={() => setProductFilter('all')}>
                        <p className={KPI_LABEL}>{productFilter === 'all' ? 'Total Orgs' : `${PRODUCT_LABEL[productFilter] || ''} Orgs`}</p>
                        <p className={KPI_VALUE}>{displayFirms}</p>
                    </div>
                    <div className={KPI_CARD} onClick={() => setProductFilter('all')}>
                        <p className={KPI_LABEL}>{productFilter === 'all' ? 'Total Users' : `${PRODUCT_LABEL[productFilter] || ''} Users`}</p>
                        <p className={KPI_VALUE}>{displayUsers}</p>
                    </div>
                    <div className={KPI_CARD} onClick={() => setProductFilter('all')}>
                        <p className={KPI_LABEL}>{productFilter === 'property' ? 'Properties' : productFilter === 'legal' ? 'Matters' : 'Matters + Properties'}</p>
                        <p className={KPI_VALUE}>{displayMatters}</p>
                    </div>
                    <div className={KPI_CARD} title={`Full: ₦${(displayMRR || 0).toLocaleString('en-NG')}/mo`}>
                        <p className={KPI_LABEL}>
                            {productFilter === 'all' ? 'Platform MRR' : `${PRODUCT_LABEL[productFilter] || ''} MRR`}
                        </p>
                        <p className={KPI_VALUE}><NairaSymbol />{formatCompact(displayMRR)}</p>
                        <p className="text-3xs text-slate-400 mt-1 truncate">Annual: <NairaSymbol />{formatCompact(displayRevenue)}</p>
                    </div>
                </div>

                {/* ─── Top Entities Toggle (Properties vs Matters) ──────── */}
                <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                        <p className={SECTION_TITLE + ' mb-0'}>Top Entities</p>
                        <div className="flex gap-1 bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5">
                            <button
                                onClick={() => setEntityToggle('properties')}
                                className={`px-2 py-1 rounded text-2xs font-bold transition-colors ${entityToggle === 'properties' ? 'bg-sky-500 text-white' : 'text-slate-500'}`}
                            >Properties</button>
                            <button
                                onClick={() => setEntityToggle('matters')}
                                className={`px-2 py-1 rounded text-2xs font-bold transition-colors ${entityToggle === 'matters' ? 'bg-emerald-500 text-white' : 'text-slate-500'}`}
                            >Matters</button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {topFirms.map((firm: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-700/30 transition-colors min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-3xs font-black text-slate-500 dark:text-zinc-400 flex-shrink-0">{i + 1}</span>
                                    <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate">{firm.name || 'Unnamed'}</span>
                                </div>
                                <span className="text-xs font-bold text-primary-600 dark:text-primary-400 flex-shrink-0">
                                    {entityToggle === 'properties' ? `${firm.matters || 0} units` : `${firm.matters || 0} matters`}
                                </span>
                            </div>
                        ))}
                        {topFirms.length === 0 && <p className="text-xs text-slate-400 italic">No organizations yet.</p>}
                    </div>
                </div>

                {/* ─── Active Users ─────────────────────────────────────── */}
                <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm overflow-hidden">
                    <p className={SECTION_TITLE}>Active Users (24h)</p>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mb-2">{activeCount}</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                        {(metrics.activeUserList || []).map((user: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs min-w-0">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                                <span className="text-slate-600 dark:text-zinc-300 truncate">{user.name || user.email || 'Unknown'}</span>
                            </div>
                        ))}
                        {activeCount === 0 && <p className="text-xs text-slate-400 italic">No active users in 24h.</p>}
                    </div>
                </div>

                {/* ─── Recent Activity ─────────────────────────────────── */}
                <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm overflow-hidden">
                    <p className={SECTION_TITLE}>Recent Platform Activity</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                        {(metrics.recentActivity || []).map((event: any, i: number) => (
                            <div key={i} className="flex items-center gap-3 text-xs p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-700/30 min-w-0">
                                <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                                <span className="text-slate-600 dark:text-zinc-300 flex-1 truncate">{event.event || 'Unknown event'}</span>
                                <span className="text-3xs text-slate-400 flex-shrink-0 whitespace-nowrap">{event.timestamp ? new Date(event.timestamp).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : ''}</span>
                            </div>
                        ))}
                        {(!metrics.recentActivity || metrics.recentActivity.length === 0) && <p className="text-xs text-slate-400 italic">No recent activity.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FounderDashboard;
