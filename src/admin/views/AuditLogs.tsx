/**
 * AuditLogs — platform-wide audit trail viewer for the Admin APK.
 * Shows recent analytics events (signups, plan changes, etc.)
 */

import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

export const AuditLogs: React.FC = () => {
    const [search, setSearch] = useState('');
    const metrics = useQuery(api.founderMetrics.getFounderMetrics, {});

    if (!metrics) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );
    }

    const events = (metrics.recentActivity || []).filter((e: any) =>
        !search || (e.event || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            <div className="sticky top-0 pt-safe z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Audit Logs</h2>
                        <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Recent platform activity ({events.length} events)</p>
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Filter events..."
                        className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 w-48 sm:w-64"
                    />
                </div>
            </div>

            <div className="px-4 sm:px-6 lg:px-8">
                <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm p-4">
                    <div className="space-y-1.5 max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar">
                        {events.length === 0 ? (
                            <p className="text-sm text-slate-400 italic text-center py-8">No audit events found.</p>
                        ) : events.map((event: any, i: number) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-700/30 transition-colors border border-slate-100 dark:border-zinc-700/50">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">{event.event || 'Unknown event'}</p>
                                    <p className="text-2xs text-slate-400 mt-0.5">
                                        Firm: {event.firmId || '—'} · User: {event.userId || '—'}
                                    </p>
                                    {event.properties && (
                                        <p className="text-2xs text-slate-400 mt-0.5 truncate">
                                            {JSON.stringify(event.properties).substring(0, 120)}
                                        </p>
                                    )}
                                </div>
                                <span className="text-2xs text-slate-400 flex-shrink-0 whitespace-nowrap">
                                    {event.timestamp ? new Date(event.timestamp).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
