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

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
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
    const [showFirmsTable, setShowFirmsTable] = useState(false);
    const [editingFirm, setEditingFirm] = useState<string | null>(null);
    const [editPlan, setEditPlan] = useState('');
    const [editStatus, setEditStatus] = useState('');
    const [editNotes, setEditNotes] = useState('');

    const metrics = useQuery(api.founderMetrics.getFounderMetrics, {});
    const allFirms = useQuery(api.founderMetrics.getAllFirmsForAdmin, {});
    const updateFirmSettings = useMutation(api.founderMetrics.updateFirmAdminSettings);

    // Guard — only Admins can see this
    if (currentUser?.role !== 'Admin') {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                <p className="text-lg font-medium">Access Denied</p>
                <p className="text-sm mt-1">You need admin privileges to view this dashboard.</p>
            </div>
        );
    }

    if (!metrics) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );
    }

    const maxGrowth = Math.max(...(metrics.dailyGrowth?.map((d: any) => d.count) || [1]), 1);
    const maxArea = Math.max(...(metrics.practiceAreaStats?.map((a: any) => a.count) || [1]), 1);
    const totalRevenue = metrics.totalRevenue || 0;
    const activeCount = metrics.activeUserList?.length || 0;

    const handleSaveFirmSettings = async (firmId: string) => {
        try {
            await updateFirmSettings({
                firmId,
                settings: {
                    subscriptionPlan: editPlan || undefined,
                    adminStatus: editStatus || undefined,
                    adminNotes: editNotes || undefined,
                },
            });
            addToast('Firm settings updated.', { type: 'success' });
            setEditingFirm(null);
        } catch (e: any) {
            addToast(e?.message || 'Failed to update firm.', { type: 'error' });
        }
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            {/* Header */}
            <div className="sticky top-0 pt-safe z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Founder Dashboard</h2>
                        <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                            Platform-wide metrics · Last updated: {metrics.lastUpdated ? new Date(metrics.lastUpdated).toLocaleString('en-GB') : '—'}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowFirmsTable(v => !v)}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg font-bold text-xs hover:bg-primary-700 transition-colors shadow-sm"
                    >
                        {showFirmsTable ? 'Show Metrics' : 'Manage Firms'}
                    </button>
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
                        <p className={KPI_LABEL}>Revenue (Paid)</p>
                        <p className={KPI_VALUE}><NairaSymbol />{formatNaira(totalRevenue)}</p>
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

                {/* All Firms Table (toggled) */}
                {showFirmsTable && allFirms && (
                    <div className={KPI_CARD}>
                        <p className={SECTION_TITLE}>All Firms ({allFirms.length})</p>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-zinc-700 text-left">
                                        <th className="py-2 px-2 font-bold text-slate-500 dark:text-zinc-400">Firm</th>
                                        <th className="py-2 px-2 font-bold text-slate-500 dark:text-zinc-400">Admin</th>
                                        <th className="py-2 px-2 font-bold text-slate-500 dark:text-zinc-400">Plan</th>
                                        <th className="py-2 px-2 font-bold text-slate-500 dark:text-zinc-400">Users</th>
                                        <th className="py-2 px-2 font-bold text-slate-500 dark:text-zinc-400">Matters</th>
                                        <th className="py-2 px-2 font-bold text-slate-500 dark:text-zinc-400">Status</th>
                                        <th className="py-2 px-2 font-bold text-slate-500 dark:text-zinc-400">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-700/50">
                                    {allFirms.map((firm: any) => (
                                        <tr key={firm.id} className="hover:bg-slate-50 dark:hover:bg-zinc-700/30">
                                            <td className="py-2 px-2 font-semibold text-slate-700 dark:text-zinc-200 truncate max-w-[160px]">{firm.firmName}</td>
                                            <td className="py-2 px-2 text-slate-500 dark:text-zinc-400 truncate max-w-[140px]">{firm.adminEmail}</td>
                                            <td className="py-2 px-2">
                                                {editingFirm === firm.id ? (
                                                    <select value={editPlan} onChange={e => setEditPlan(e.target.value)} className="bg-slate-50 dark:bg-zinc-700 text-xs rounded px-1 py-0.5 border border-slate-200 dark:border-zinc-600">
                                                        <option value="">Keep</option>
                                                        <option value="Core">Core</option>
                                                        <option value="Growth">Growth</option>
                                                        <option value="Pro">Pro</option>
                                                        <option value="Enterprise">Enterprise</option>
                                                        <option value="Komplete">Komplete</option>
                                                    </select>
                                                ) : (
                                                    <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${firm.plan === 'Enterprise' || firm.plan === 'Komplete' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400'}`}>{firm.plan}</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-2 text-slate-600 dark:text-zinc-300">{firm.userCount}</td>
                                            <td className="py-2 px-2 text-slate-600 dark:text-zinc-300">{firm.matterCount}</td>
                                            <td className="py-2 px-2">
                                                {editingFirm === firm.id ? (
                                                    <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="bg-slate-50 dark:bg-zinc-700 text-xs rounded px-1 py-0.5 border border-slate-200 dark:border-zinc-600">
                                                        <option value="">Keep</option>
                                                        <option value="active">Active</option>
                                                        <option value="suspended">Suspended</option>
                                                        <option value="trial">Trial</option>
                                                    </select>
                                                ) : (
                                                    <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${firm.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : firm.status === 'suspended' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>{firm.status}</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-2">
                                                {editingFirm === firm.id ? (
                                                    <div className="flex gap-1">
                                                        <button onClick={() => handleSaveFirmSettings(firm.id)} className="px-2 py-0.5 bg-emerald-600 text-white rounded text-3xs font-bold hover:bg-emerald-700">Save</button>
                                                        <button onClick={() => setEditingFirm(null)} className="px-2 py-0.5 bg-slate-200 dark:bg-zinc-600 text-slate-600 dark:text-zinc-300 rounded text-3xs font-bold">Cancel</button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => { setEditingFirm(firm.id); setEditPlan(''); setEditStatus(''); setEditNotes(firm.notes || ''); }} className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded text-3xs font-bold hover:bg-slate-200 dark:hover:bg-zinc-600">Edit</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FounderDashboard;
