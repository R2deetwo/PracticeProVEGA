/**
 * AuditLogs — platform-wide audit trail viewer for the Founder APK.
 *
 * Filters out low-value noise (logout events, routine page views) and
 * shows a clean, structured data table with:
 *   Timestamp | Actor | Role | Firm/Org | Action Category | Description
 *
 * System-level events (founder actions, system triggers) are clearly
 * badged as "System Founder" instead of showing "Firm: None".
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';

// Events that are low-value noise — filtered out of the feed
const NOISE_EVENTS = [
    'user_logout',
    'page_view',
    'sidebar_toggle',
    'modal_open',
    'modal_close',
    'notification_read',
    'toast_dismissed',
];

// High-value event categories — highlighted in the feed
const HIGH_VALUE_EVENTS = [
    'signup',
    'firm_create',
    'plan_upgrade',
    'plan_downgrade',
    'subscription_cancel',
    'payment_failure',
    'payment_success',
    'user_invite',
    'role_change',
    'firm_suspend',
    'firm_activate',
    'founder_login',
    'Manual Refresh',
    'Founder signals acknowledged',
];

function isHighValue(eventStr: string): boolean {
    const lower = (eventStr || '').toLowerCase();
    return HIGH_VALUE_EVENTS.some(hv => lower.includes(hv.toLowerCase()));
}

function isNoise(eventStr: string): boolean {
    const lower = (eventStr || '').toLowerCase();
    return NOISE_EVENTS.some(n => lower.includes(n));
}

function categorizeEvent(eventStr: string): string {
    const lower = (eventStr || '').toLowerCase();
    if (lower.includes('signup') || lower.includes('sign_up') || lower.includes('register')) return 'Signup';
    if (lower.includes('firm_create') || lower.includes('create_firm')) return 'Firm Created';
    if (lower.includes('plan') && (lower.includes('upgrade') || lower.includes('upgrad'))) return 'Plan Upgrade';
    if (lower.includes('plan') && (lower.includes('downgrade') || lower.includes('downgrad'))) return 'Plan Downgrade';
    if (lower.includes('cancel')) return 'Cancellation';
    if (lower.includes('payment') && lower.includes('fail')) return 'Payment Failure';
    if (lower.includes('payment') && lower.includes('success')) return 'Payment Success';
    if (lower.includes('invite')) return 'User Invite';
    if (lower.includes('role')) return 'Role Change';
    if (lower.includes('suspend')) return 'Firm Suspended';
    if (lower.includes('activate')) return 'Firm Activated';
    if (lower.includes('founder') || lower.includes('admin') || lower.includes('manual refresh')) return 'System';
    return 'Activity';
}

function formatActor(event: any): { name: string; email: string; isSystem: boolean } {
    if (event.userId === 'founder' || event.userId === 'admin' || event.firmId === 'system') {
        return { name: 'System Founder', email: 'system@practicepro', isSystem: true };
    }
    return {
        name: event.userId || 'Unknown',
        email: event.userId || '',
        isSystem: false,
    };
}

export const AuditLogs: React.FC = () => {
    const { currentUser } = useAuth();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'high-value' | 'system'>('all');
    const tokenIdentifier = currentUser?.email || currentUser?.tokenIdentifier || '';
    const metrics = useQuery(api.founderMetrics.getFounderMetrics,
        tokenIdentifier ? { tokenIdentifier } : "skip");

    const filteredEvents = useMemo(() => {
        if (!metrics?.recentActivity) return [];

        let events = metrics.recentActivity as any[];

        // Filter out noise
        events = events.filter((e: any) => !isNoise(e.event || ''));

        // Apply category filter
        if (filter === 'high-value') {
            events = events.filter((e: any) => isHighValue(e.event || ''));
        } else if (filter === 'system') {
            events = events.filter((e: any) =>
                e.userId === 'founder' || e.userId === 'admin' || e.firmId === 'system'
            );
        }

        // Apply search
        if (search) {
            const q = search.toLowerCase();
            events = events.filter((e: any) =>
                (e.event || '').toLowerCase().includes(q) ||
                (e.userId || '').toLowerCase().includes(q) ||
                (e.firmId || '').toLowerCase().includes(q)
            );
        }

        return events;
    }, [metrics, search, filter]);

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
                <p className="text-sm">Unable to load audit logs.</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            {/* Header */}
            <div className="sticky top-0 pt-safe z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Audit Logs</h2>
                        <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{filteredEvents.length} events (noise filtered)</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Filter tabs */}
                        <div className="flex gap-1 bg-slate-100 dark:bg-zinc-800 rounded-lg p-1">
                            {(['all', 'high-value', 'system'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-3 py-1 rounded-md text-2xs font-bold transition-colors ${
                                        filter === f ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400'
                                    }`}
                                >
                                    {f === 'all' ? 'All' : f === 'high-value' ? 'Key Events' : 'System'}
                                </button>
                            ))}
                        </div>
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search..."
                            className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 w-32 sm:w-48"
                        />
                    </div>
                </div>
            </div>

            {/* Audit Table */}
            <div className="px-4 sm:px-6 lg:px-8">
                {filteredEvents.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm p-12 text-center">
                        <p className="text-sm text-slate-400">No audit events match your filter.</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-zinc-700 text-left bg-slate-50 dark:bg-zinc-900/50">
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Timestamp</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Actor</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Type</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Firm/Org</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Category</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-700/50">
                                    {filteredEvents.map((event: any, i: number) => {
                                        const actor = formatActor(event);
                                        const category = categorizeEvent(event.event || '');
                                        const isHigh = isHighValue(event.event || '');
                                        return (
                                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-zinc-700/30 transition-colors">
                                                <td className="py-2.5 px-3 text-slate-400 text-2xs whitespace-nowrap">
                                                    {event.timestamp ? new Date(event.timestamp).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <div className="flex items-center gap-2">
                                                        {actor.isSystem && (
                                                            <span className="px-1.5 py-0.5 rounded text-3xs font-black bg-black text-white whitespace-nowrap">SYSTEM</span>
                                                        )}
                                                        <span className={`font-semibold truncate ${actor.isSystem ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-zinc-200'}`}>
                                                            {actor.name}
                                                        </span>
                                                    </div>
                                                    {actor.email && !actor.isSystem && (
                                                        <p className="text-2xs text-slate-400 truncate">{actor.email}</p>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${
                                                        actor.isSystem ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                                        'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400'
                                                    }`}>
                                                        {actor.isSystem ? 'Founder' : 'User'}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-slate-500 dark:text-zinc-400 truncate max-w-[120px]">
                                                    {event.firmId && event.firmId !== 'system' ? event.firmId : '—'}
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${
                                                        isHigh ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                        'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400'
                                                    }`}>
                                                        {category}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300">
                                                    {event.event || 'Unknown event'}
                                                    {event.properties && (
                                                        <p className="text-2xs text-slate-400 mt-0.5 truncate max-w-[200px]">
                                                            {JSON.stringify(event.properties).substring(0, 100)}
                                                        </p>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
