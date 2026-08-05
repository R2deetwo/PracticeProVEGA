/**
 * FounderSignals — founder-grade monitoring view for the Founder APK.
 *
 * Three sections:
 *   1. ALERTS — new users (24h / 7d), new firms (24h), churn risk pool
 *   2. SCALING SIGNALS — computed health-of-platform flags
 *   3. PRODUCT BREAKDOWN — per-product metrics (legal / property / unified)
 *      with a "Push Product" recommendation surfacing the product with
 *      the highest 7-day velocity per firm.
 *
 * The data is the same data that drives the local notifications in
 * useFounderSignals. So when a notification lands on the founder's
 * phone and they tap it, this is the view they land on.
 */

import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatNaira } from '../../utils/formatting';
import NairaSymbol from '../../components/NairaSymbol';

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm';
const LABEL = 'text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest';
const SECTION_TITLE = 'text-sm font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-3';

const PRODUCT_LABEL: Record<string, string> = {
    legal: 'PracticePro Legal',
    property: 'PracticePro Property',
    unified: 'PracticePro Unified',
};

const SEVERITY_STYLE: Record<string, string> = {
    info: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
};

export const FounderSignals: React.FC = () => {
    // Use the logged-in founder's email for server-side verification.
    const { currentUser } = useAuth();
    const tokenIdentifier = currentUser?.email || currentUser?.tokenIdentifier || '';
    const alerts = useQuery(api.founderMetrics.getFounderAlerts,
        tokenIdentifier ? { tokenIdentifier } : "skip");

    if (!alerts) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-zinc-900">
                <div className="w-10 h-10 border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );
    }

    const activeRatio = alerts.totalUsers > 0 ? (alerts.activeCount / alerts.totalUsers) * 100 : 0;
    const velocityPct = alerts.mattersPrior7d > 0
        ? ((alerts.mattersLast7d - alerts.mattersPrior7d) / alerts.mattersPrior7d) * 100
        : alerts.mattersLast7d > 0 ? 100 : 0;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            {/* Header */}
            <div className="sticky top-0 pt-safe z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Founder Signals</h2>
                        <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                            Live growth, churn, scaling & product signals · Updated {alerts.lastUpdated ? new Date(alerts.lastUpdated).toLocaleTimeString('en-GB') : '—'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="px-4 sm:px-6 lg:px-8 space-y-6">
                {/* ─── ALERTS GRID ───────────────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className={CARD}>
                        <p className={LABEL}>New Users (24h)</p>
                        <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{alerts.newUsers24hCount}</p>
                        <p className="text-3xs text-slate-400 mt-1">{alerts.newUsers7dCount} in last 7d</p>
                    </div>
                    <div className={CARD}>
                        <p className={LABEL}>New Firms (24h)</p>
                        <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{alerts.newFirms24hCount}</p>
                        <p className="text-3xs text-slate-400 mt-1">{alerts.totalFirms} total firms</p>
                    </div>
                    <div className={CARD}>
                        <p className={LABEL}>Churn Risks</p>
                        <p className={`text-2xl sm:text-3xl font-black mt-1 ${alerts.churnRiskCount >= 10 ? 'text-red-600 dark:text-red-400' : alerts.churnRiskCount >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-zinc-200'}`}>{alerts.churnRiskCount}</p>
                        <p className="text-3xs text-slate-400 mt-1">no activity in 14+ days</p>
                    </div>
                    <div className={CARD}>
                        <p className={LABEL}>Active Now (24h)</p>
                        <p className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400 mt-1">{alerts.activeCount}</p>
                        <p className="text-3xs text-slate-400 mt-1">{activeRatio.toFixed(0)}% of {alerts.totalUsers} users</p>
                    </div>
                </div>

                {/* ─── NEW USERS + CHURN DETAILS ────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* New Users */}
                    <div className={CARD}>
                        <p className={SECTION_TITLE}>New Users (24h)</p>
                        <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar">
                            {(alerts.newUsers24h as any[]).length === 0 && (
                                <p className="text-xs text-slate-400 italic">No new users in the last 24 hours.</p>
                            )}
                            {(alerts.newUsers24h as any[]).map((u, i) => (
                                <div key={i} className="flex items-center gap-3 text-xs p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-700/30">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                                    <span className="text-slate-700 dark:text-zinc-200 flex-1 truncate">{u.name}</span>
                                    <span className="text-3xs text-slate-400 flex-shrink-0">{PRODUCT_LABEL[u.product] || u.product}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Churn Risks */}
                    <div className={CARD}>
                        <p className={SECTION_TITLE}>Churn Risk Pool ({alerts.churnRiskCount})</p>
                        <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar">
                            {(alerts.churnRisks as any[]).length === 0 && (
                                <p className="text-xs text-slate-400 italic">No churn risks detected. Healthy engagement.</p>
                            )}
                            {(alerts.churnRisks as any[]).slice(0, 12).map((u, i) => (
                                <div key={i} className="flex items-center gap-3 text-xs p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-700/30">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${u.daysSinceSeen >= 30 ? 'bg-red-500' : 'bg-amber-500'}`} />
                                    <span className="text-slate-700 dark:text-zinc-200 flex-1 truncate">{u.name}</span>
                                    <span className="text-3xs text-slate-400 flex-shrink-0">{u.daysSinceSeen}d silent</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ─── SCALING SIGNALS ──────────────────────────────────── */}
                <div className={CARD}>
                    <p className={SECTION_TITLE}>Scaling Signals</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {(alerts.scalingSignals as any[]).length === 0 && (
                            <p className="text-xs text-slate-400 italic md:col-span-2">No scaling signals right now. Platform is humming along.</p>
                        )}
                        {(alerts.scalingSignals as any[]).map(s => (
                            <div key={s.id} className={`rounded-xl border p-3 text-xs ${SEVERITY_STYLE[s.severity] || SEVERITY_STYLE.info}`}>
                                <p className="font-black uppercase tracking-wider text-3xs mb-1">{s.severity}</p>
                                <p className="font-bold text-sm">{s.title}</p>
                                <p className="mt-1 opacity-90">{s.detail}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ─── HEALTH METRICS ───────────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className={CARD}>
                        <p className={LABEL}>Matter Velocity (7d)</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{alerts.mattersLast7d}</p>
                        <p className={`text-3xs mt-1 font-bold ${velocityPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {velocityPct >= 0 ? '▲' : '▼'} {Math.abs(velocityPct).toFixed(0)}% vs last week
                        </p>
                    </div>
                    <div className={CARD}>
                        <p className={LABEL}>Platform MRR/Firm</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white mt-1"><NairaSymbol />{formatNaira(alerts.revenuePerFirm)}</p>
                        <p className="text-3xs text-slate-400 mt-1">across {alerts.totalFirms} firms</p>
                    </div>
                    <div className={CARD}>
                        <p className={LABEL}>Top Plan</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{alerts.topPlan}</p>
                        <p className="text-3xs text-slate-400 mt-1">{Math.round((alerts.topPlanShare || 0) * 100)}% of firms</p>
                    </div>
                    <div className={CARD}>
                        <p className={LABEL}>Active Ratio</p>
                        <p className={`text-2xl font-black mt-1 ${activeRatio >= 30 ? 'text-emerald-600 dark:text-emerald-400' : activeRatio >= 15 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>{activeRatio.toFixed(0)}%</p>
                        <p className="text-3xs text-slate-400 mt-1">{alerts.activeCount} of {alerts.totalUsers} users</p>
                    </div>
                </div>

                {/* ─── PRODUCT BREAKDOWN + PUSH RECOMMENDATION ─────────── */}
                <div className={CARD}>
                    <p className={SECTION_TITLE}>Product Breakdown — Push the Right Product</p>
                    <div className="overflow-x-auto custom-scrollbar -mx-2">
                        <table className="w-full text-xs min-w-[640px]">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-zinc-700 text-left">
                                    <th className="py-2 px-2 font-bold text-slate-500 dark:text-zinc-400">Product</th>
                                    <th className="py-2 px-2 font-bold text-slate-500 dark:text-zinc-400 text-right">Firms</th>
                                    <th className="py-2 px-2 font-bold text-slate-500 dark:text-zinc-400 text-right">Users</th>
                                    <th className="py-2 px-2 font-bold text-slate-500 dark:text-zinc-400 text-right">Matters</th>
                                    <th className="py-2 px-2 font-bold text-slate-500 dark:text-zinc-400 text-right">7d Velocity</th>
                                    <th className="py-2 px-2 font-bold text-slate-500 dark:text-zinc-400 text-right">Per-Firm</th>
                                    <th className="py-2 px-2 font-bold text-slate-500 dark:text-zinc-400 text-right">Platform Rev.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-700/50">
                                {(alerts.productBreakdown as any[]).map(p => {
                                    const perFirm = p.firms > 0 ? p.matters7d / p.firms : 0;
                                    const isPush = alerts.pushProduct?.product === p.product;
                                    return (
                                        <tr key={p.product} className={isPush ? 'bg-emerald-50 dark:bg-emerald-900/10' : ''}>
                                            <td className="py-2 px-2 font-bold text-slate-700 dark:text-zinc-200">
                                                <div className="flex items-center gap-2">
                                                    <span>{PRODUCT_LABEL[p.product] || p.product}</span>
                                                    {isPush && (
                                                        <span className="px-1.5 py-0.5 rounded text-3xs font-black bg-emerald-600 text-white">PUSH</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-2 px-2 text-right text-slate-600 dark:text-zinc-300">{p.firms}</td>
                                            <td className="py-2 px-2 text-right text-slate-600 dark:text-zinc-300">{p.users}</td>
                                            <td className="py-2 px-2 text-right text-slate-600 dark:text-zinc-300">{p.matters}</td>
                                            <td className="py-2 px-2 text-right font-bold text-slate-700 dark:text-zinc-200">{p.matters7d}</td>
                                            <td className="py-2 px-2 text-right text-slate-600 dark:text-zinc-300">{perFirm.toFixed(1)}</td>
                                            <td className="py-2 px-2 text-right text-slate-600 dark:text-zinc-300"><NairaSymbol />{formatNaira(p.revenue)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {alerts.pushProduct && (
                        <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                Push: {PRODUCT_LABEL[alerts.pushProduct.product] || alerts.pushProduct.product}
                            </p>
                            <p className="text-3xs text-emerald-700/80 dark:text-emerald-400/80 mt-1">
                                Highest 7-day matter velocity per firm ({alerts.pushProduct.matters7d} matters across {alerts.pushProduct.firms} firms = {alerts.pushProduct.velocityPerFirm.toFixed(1)}/firm). Double down on marketing, case studies, and onboarding for this product.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
