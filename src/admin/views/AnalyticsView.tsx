/**
 * AnalyticsView — platform analytics dashboard for the Founder APK.
 *
 * Shows:
 *   - Growth chart (30-day matters created)
 *   - Practice area distribution
 *   - Product breakdown (Vega / Atrium / Komplete)
 *   - Active user trends (24h active)
 *   - Revenue metrics (MRR, ARR, per-product)
 *   - Engagement metrics (feature adoption across platform)
 *
 * Uses data from getFounderMetrics (already includes dailyGrowth,
 * practiceAreaStats, activeUserList, productBreakdown, MRR).
 */

import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useFounderAuth } from '../FounderContexts';
import NairaSymbol from '../../components/NairaSymbol';

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm';
const LABEL = 'text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest';
const SECTION_TITLE = 'text-sm font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-3';

function formatCompact(amount: number): string {
    if (!amount || isNaN(amount)) return '0';
    if (amount >= 1_000_000_000) return (amount / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (amount >= 1_000) return (amount / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return amount.toFixed(0);
}

const PRODUCT_LABELS: Record<string, string> = {
    legal: 'Vega',
    property: 'Atrium',
    unified: 'Komplete',
};

const PRODUCT_COLORS: Record<string, string> = {
    legal: 'bg-blue-500',
    property: 'bg-sky-500',
    unified: 'bg-violet-500',
};

export const AnalyticsView: React.FC = () => {
    const { currentUser, bearerToken } = useFounderAuth();
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');
    const tokenIdentifier = currentUser?.email || currentUser?.tokenIdentifier || '';

    const metrics = useQuery(api.founderMetrics.getFounderMetrics,
        tokenIdentifier && bearerToken ? { tokenIdentifier, sessionToken: bearerToken ?? undefined } : "skip");

    const alerts = useQuery(api.founderMetrics.getFounderAlerts,
        tokenIdentifier && bearerToken ? { tokenIdentifier, sessionToken: bearerToken ?? undefined } : "skip");

    if (metrics === undefined) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-zinc-900">
                <div className="w-8 h-8 border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (metrics === null || (metrics as any)?.error) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                <p className="text-sm">Unable to load analytics.</p>
            </div>
        );
    }

    const dailyGrowth = metrics.dailyGrowth || [];
    const practiceAreaStats = metrics.practiceAreaStats || [];
    const activeUserList = metrics.activeUserList || [];
    const productBreakdown = (alerts as any)?.productBreakdown || [];
    const monthlyRecurringRevenue = metrics.monthlyRecurringRevenue || 0;
    const platformRevenue = metrics.platformRevenue || 0;
    const totalFirms = metrics.totalFirms || 0;
    const totalUsers = metrics.totalUsers || 0;
    const totalMatters = metrics.totalMatters || 0;

    // Compute growth chart max for scaling
    const growthMax = Math.max(...dailyGrowth.map((d: any) => d.count || 0), 1);

    // Filter by time range
    const filteredGrowth = timeRange === '7d' ? dailyGrowth.slice(-7) : timeRange === '30d' ? dailyGrowth : dailyGrowth;

    // Compute total matters in selected period
    const periodTotal = filteredGrowth.reduce((sum: number, d: any) => sum + (d.count || 0), 0);

    // Compute practice area max for bar chart
    const areaMax = Math.max(...practiceAreaStats.map((a: any) => a.count || 0), 1);

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            {/* Header */}
            <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Analytics</h2>
                        <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Platform growth, engagement & revenue insights</p>
                    </div>
                    {/* Time range selector */}
                    <div className="flex gap-1 bg-slate-100 dark:bg-zinc-800 rounded-lg p-1">
                        {(['7d', '30d', 'all'] as const).map(r => (
                            <button
                                key={r}
                                onClick={() => setTimeRange(r)}
                                className={`px-3 py-1 rounded-md text-2xs font-bold transition-colors ${
                                    timeRange === r ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400'
                                }`}
                            >
                                {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : 'All Time'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="px-4 sm:px-6 lg:px-8 space-y-6">
                {/* ─── KPI Summary ──────────────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className={CARD}>
                        <p className={LABEL}>Total Firms</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalFirms}</p>
                    </div>
                    <div className={CARD}>
                        <p className={LABEL}>Total Users</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalUsers}</p>
                    </div>
                    <div className={CARD}>
                        <p className={LABEL}>Total Matters</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalMatters}</p>
                    </div>
                    <div className={CARD}>
                        <p className={LABEL}>Platform MRR</p>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1"><NairaSymbol />{formatCompact(monthlyRecurringRevenue)}</p>
                    </div>
                </div>

                {/* ─── Growth Chart (30-day matters created) ───────────── */}
                <div className={CARD}>
                    <div className="flex items-center justify-between mb-3">
                        <p className={SECTION_TITLE + ' mb-0'}>Matter Creation Growth</p>
                        <span className="text-2xs font-bold text-slate-400">{periodTotal} matters in selected period</span>
                    </div>
                    {filteredGrowth.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-8">No growth data yet.</p>
                    ) : (
                        <div className="flex items-end gap-1 h-32 mt-2">
                            {filteredGrowth.map((day: any, i: number) => {
                                const heightPct = ((day.count || 0) / growthMax) * 100;
                                const isLast7 = i >= filteredGrowth.length - 7;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
                                        {/* Tooltip on hover */}
                                        <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-2xs px-2 py-1 rounded whitespace-nowrap z-10">
                                            {day.count || 0} on {day.date}
                                        </div>
                                        <div
                                            className={`w-full rounded-t transition-all duration-300 ${
                                                isLast7 ? 'bg-primary-500' : 'bg-primary-300 dark:bg-primary-700'
                                            } hover:bg-primary-600`}
                                            style={{ height: `${Math.max(heightPct, 2)}%` }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className="flex justify-between mt-2 text-2xs text-slate-400">
                        <span>{filteredGrowth[0]?.date || '—'}</span>
                        <span>{filteredGrowth[filteredGrowth.length - 1]?.date || '—'}</span>
                    </div>
                </div>

                {/* ─── Two-column: Practice Areas + Product Breakdown ──── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Practice Area Distribution */}
                    <div className={CARD}>
                        <p className={SECTION_TITLE}>Practice Area Distribution</p>
                        {practiceAreaStats.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-8">No practice area data.</p>
                        ) : (
                            <div className="space-y-2">
                                {practiceAreaStats.slice(0, 8).map((area: any, i: number) => {
                                    const pct = ((area.count || 0) / areaMax) * 100;
                                    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500', 'bg-sky-500', 'bg-indigo-500', 'bg-teal-500'];
                                    return (
                                        <div key={i}>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="font-semibold text-slate-700 dark:text-zinc-200">{area.area}</span>
                                                <span className="text-slate-400">{area.count}</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${colors[i % colors.length]}`}
                                                    style={{ width: `${Math.max(pct, 2)}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Product Breakdown */}
                    <div className={CARD}>
                        <p className={SECTION_TITLE}>Product Breakdown</p>
                        {productBreakdown.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-8">No product data.</p>
                        ) : (
                            <div className="space-y-3">
                                {productBreakdown.map((p: any) => (
                                    <div key={p.product} className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${PRODUCT_COLORS[p.product] || 'bg-slate-400'}`} />
                                        <div className="flex-1">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="font-bold text-slate-700 dark:text-zinc-200">{PRODUCT_LABELS[p.product] || p.product}</span>
                                                <span className="text-slate-400">{p.firms} firms · {p.users} users</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <div className="flex-1 h-2 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                    <div className={`h-full ${PRODUCT_COLORS[p.product] || 'bg-slate-400'}`} style={{ width: `${totalFirms > 0 ? (p.firms / totalFirms) * 100 : 0}%` }} />
                                                </div>
                                            </div>
                                            {p.mrr > 0 && (
                                                <p className="text-2xs text-slate-400 mt-0.5">
                                                    MRR: <NairaSymbol />{formatCompact(p.mrr)} · {p.matters} matters
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── Engagement: Active Users + Revenue ───────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Active Users (24h) */}
                    <div className={CARD}>
                        <div className="flex items-center justify-between mb-3">
                            <p className={SECTION_TITLE + ' mb-0'}>Active Users (24h)</p>
                            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{activeUserList.length}</span>
                        </div>
                        {activeUserList.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">No active users in the last 24 hours.</p>
                        ) : (
                            <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                                {activeUserList.slice(0, 20).map((user: any, i: number) => (
                                    <div key={i} className="flex items-center gap-2 text-xs">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                                        <span className="text-slate-600 dark:text-zinc-300 truncate">{user.name || 'Unknown'}</span>
                                    </div>
                                ))}
                                {activeUserList.length > 20 && (
                                    <p className="text-2xs text-slate-400 text-center pt-1">+{activeUserList.length - 20} more</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Revenue Summary */}
                    <div className={CARD}>
                        <p className={SECTION_TITLE}>Revenue Summary</p>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                                <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">Monthly Recurring (MRR)</span>
                                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400"><NairaSymbol />{formatCompact(monthlyRecurringRevenue)}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg">
                                <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">Annual Run Rate (ARR)</span>
                                <span className="text-lg font-black text-slate-700 dark:text-zinc-200"><NairaSymbol />{formatCompact(platformRevenue)}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg">
                                <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">Revenue Per Firm</span>
                                <span className="text-lg font-black text-slate-700 dark:text-zinc-200">
                                    <NairaSymbol />{formatCompact(totalFirms > 0 ? monthlyRecurringRevenue / totalFirms : 0)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── Scaling Signals (from alerts) ───────────────────── */}
                {(alerts as any)?.scalingSignals && (alerts as any).scalingSignals.length > 0 && (
                    <div className={CARD}>
                        <p className={SECTION_TITLE}>Scaling Signals</p>
                        <div className="space-y-2">
                            {(alerts as any).scalingSignals.map((sig: any, i: number) => (
                                <div key={i} className={`p-3 rounded-lg flex items-start gap-2 ${
                                    sig.severity === 'critical' ? 'bg-red-50 dark:bg-red-900/20' :
                                    sig.severity === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20' :
                                    'bg-blue-50 dark:bg-blue-900/20'
                                }`}>
                                    <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                                        sig.severity === 'critical' ? 'bg-red-500' :
                                        sig.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                                    }`} />
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">{sig.title}</p>
                                        {sig.description && <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">{sig.description}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
