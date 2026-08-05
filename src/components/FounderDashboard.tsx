/**
 * FounderDashboard — Platform-wide monitoring dashboard for the founder.
 *
 * Consumes the existing getFounderMetrics and getAllFirmsForAdmin Convex
 * queries. Shows:
 *   - KPI strip (total firms, users, matters, revenue)
 *   - 30-day growth chart (matters created per day)
 *   - Practice area heatmap (most common matter types)
 *   - Top 5 firms by volume
 *   - Active users (last 24h)
 *   - All firms table with admin controls (plan, status, billing)
 *
 * ACCESS:
 *   This view is only accessible to Admin users. In the future, it will
 *   move to a separate "PracticePro Admin" APK.
 */

import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { formatNaira } from '../utils/formatting';
import NairaSymbol from './NairaSymbol';

const KPI_CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm';
const KPI_LABEL = 'text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest';
const KPI_VALUE = 'text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1';
const SECTION_TITLE = 'text-sm font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-3';

export const FounderDashboard: React.FC = () => {
    const { currentUser } = useAuth();
    const { addToast } = useUI();

    // Use the logged-in founder's email as the tokenIdentifier for
    // server-side requireFounder() verification.
    const tokenIdentifier = currentUser?.email || currentUser?.tokenIdentifier || '';
    const metrics = useQuery(api.founderMetrics.getFounderMetrics,
        tokenIdentifier ? { tokenIdentifier } : "skip");

    // If the query errored (e.g., demo user isn't an admin in the DB),
    // show a friendly message instead of crashing.
    if (metrics === undefined) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );
    }

    // If the query returned an error (Convex throws when requireAdmin fails),
    // useQuery returns undefined, so we show a setup message.
    if (metrics === null || (metrics as any)?.error) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold mb-2">Founder Dashboard</h2>
                <p className="text-sm max-w-md mb-4">The founder dashboard needs a verified admin account to load platform metrics.</p>
                <div className="bg-slate-100 dark:bg-zinc-800 rounded-lg p-4 text-left max-w-md text-xs">
                    <p className="font-bold mb-2">To enable data:</p>
                    <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-zinc-400">
                        <li>Create a user in Convex with email <code className="text-primary-600">founder@practicepro.ng</code></li>
                        <li>Set that user's <code className="text-primary-600">role</code> to <code className="text-primary-600">Admin</code></li>
                        <li>Or change <code className="text-primary-600">tokenIdentifier</code> in <code>src/components/FounderDashboard.tsx</code> to your real admin email</li>
                    </ol>
                </div>
            </div>
        );
    }

    const maxGrowth = Math.max(...(metrics.dailyGrowth?.map((d: any) => d.count) || [1]), 1);
    const maxArea = Math.max(...(metrics.practiceAreaStats?.map((a: any) => a.count) || [1]), 1);
    // PRIVACY: Platform subscription revenue (what firms pay PracticePro),
    // NOT client invoice totals. Client financials are never exposed.
    const platformRevenue = metrics.platformRevenue || 0;
    const monthlyRecurringRevenue = metrics.monthlyRecurringRevenue || 0;
    const activeCount = metrics.activeUserList?.length || 0;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            {/* Header */}
            <div className="sticky top-0 pt-safe z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6">
                <div>
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Founder Dashboard</h2>
                    <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        Platform-wide metrics · Last updated: {metrics.lastUpdated ? new Date(metrics.lastUpdated).toLocaleString('en-GB') : '—'}
                    </p>
                </div>
            </div>

            <div className="px-4 sm:px-6 lg:px-8 space-y-6">
                {/* KPI Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className={KPI_CARD}>
                        <p className={KPI_LABEL}>Total Firms</p>
                        <p className={KPI_VALUE}>{metrics.totalFirms}</p>
                    </div>
                    <div className={KPI_CARD}>
                        <p className={KPI_LABEL}>Total Users</p>
                        <p className={KPI_VALUE}>{metrics.totalUsers}</p>
                    </div>
                    <div className={KPI_CARD}>
                        <p className={KPI_LABEL}>Total Matters</p>
                        <p className={KPI_VALUE}>{metrics.totalMatters}</p>
                    </div>
                    <div className={KPI_CARD}>
                        <p className={KPI_LABEL}>Platform MRR</p>
                        <p className={KPI_VALUE}><NairaSymbol />{formatNaira(monthlyRecurringRevenue)}</p>
                        <p className="text-3xs text-slate-400 mt-1">Annual: <NairaSymbol />{formatNaira(platformRevenue)}</p>
                    </div>
                </div>

                {/* Active Users + Growth Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* 30-Day Growth Chart */}
                    <div className={`${KPI_CARD} lg:col-span-2`}>
                        <p className={SECTION_TITLE}>Matters Created (Last 30 Days)</p>
                        <div className="flex items-end gap-1 h-32 mt-2">
                            {(metrics.dailyGrowth || []).map((d: any, i: number) => (
                                <div
                                    key={i}
                                    className="flex-1 bg-primary-500/70 dark:bg-primary-600/70 rounded-t-sm transition-all hover:bg-primary-600 dark:hover:bg-primary-500"
                                    style={{ height: `${(d.count / maxGrowth) * 100}%`, minHeight: d.count > 0 ? '4px' : '0' }}
                                    title={`${d.date}: ${d.count} matter${d.count !== 1 ? 's' : ''}`}
                                />
                            ))}
                        </div>
                        <div className="flex justify-between text-3xs text-slate-400 mt-1">
                            <span>30 days ago</span>
                            <span>Today</span>
                        </div>
                    </div>

                    {/* Active Users */}
                    <div className={KPI_CARD}>
                        <p className={SECTION_TITLE}>Active Users (24h)</p>
                        <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mb-2">{activeCount}</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                            {(metrics.activeUserList || []).map((user: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-slate-600 dark:text-zinc-300 truncate">{user.name || user.email || 'Unknown'}</span>
                                </div>
                            ))}
                            {activeCount === 0 && (
                                <p className="text-xs text-slate-400 italic">No active users in the last 24 hours.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Practice Areas + Top Firms */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Practice Area Heatmap */}
                    <div className={KPI_CARD}>
                        <p className={SECTION_TITLE}>Practice Areas</p>
                        <div className="space-y-2">
                            {(metrics.practiceAreaStats || []).map((area: any) => (
                                <div key={area.area} className="flex items-center gap-3">
                                    <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300 w-32 truncate flex-shrink-0">{area.area}</span>
                                    <div className="flex-1 h-6 bg-slate-100 dark:bg-zinc-700 rounded-lg overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-primary-500 to-indigo-500 rounded-lg transition-all"
                                            style={{ width: `${(area.count / maxArea) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 w-8 text-right">{area.count}</span>
                                </div>
                            ))}
                            {(!metrics.practiceAreaStats || metrics.practiceAreaStats.length === 0) && (
                                <p className="text-xs text-slate-400 italic">No matters yet.</p>
                            )}
                        </div>
                    </div>

                    {/* Top 5 Firms */}
                    <div className={KPI_CARD}>
                        <p className={SECTION_TITLE}>Top Firms by Volume</p>
                        <div className="space-y-2">
                            {(metrics.topFirms || []).map((firm: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-700/30 transition-colors">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-3xs font-black text-slate-500 dark:text-zinc-400 flex-shrink-0">
                                            {i + 1}
                                        </span>
                                        <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate">{firm.name || 'Unnamed'}</span>
                                    </div>
                                    <span className="text-xs font-bold text-primary-600 dark:text-primary-400 flex-shrink-0">{firm.matters} matters</span>
                                </div>
                            ))}
                            {(!metrics.topFirms || metrics.topFirms.length === 0) && (
                                <p className="text-xs text-slate-400 italic">No firms yet.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className={KPI_CARD}>
                    <p className={SECTION_TITLE}>Recent Platform Activity</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                        {(metrics.recentActivity || []).map((event: any, i: number) => (
                            <div key={i} className="flex items-center gap-3 text-xs p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-700/30">
                                <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                                <span className="text-slate-600 dark:text-zinc-300 flex-1 truncate">{event.event || 'Unknown event'}</span>
                                <span className="text-3xs text-slate-400 flex-shrink-0">
                                    {event.timestamp ? new Date(event.timestamp).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                                </span>
                            </div>
                        ))}
                        {(!metrics.recentActivity || metrics.recentActivity.length === 0) && (
                            <p className="text-xs text-slate-400 italic">No recent activity.</p>
                        )}
                    </div>
                </div>

                {/* Firm management has its own dedicated page in the sidebar.
                    Use the 'Firms' tab to view and edit all firms. */}
            </div>
        </div>
    );
};

export default FounderDashboard;
