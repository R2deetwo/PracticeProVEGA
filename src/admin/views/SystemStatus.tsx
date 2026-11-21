/**
 * SystemStatus — the platform's server-side error log (2026-11-22 unification).
 *
 * FOUNDER BUG REPORT: this screen used to read `analytics_events` (client
 * product analytics) and showed "0 errors in the last 7 days — all systems
 * operational" while Aloa X reported "11 backend errors in 24 hours" from
 * the `error_events` table. Two tables, two definitions, one contradiction.
 *
 * Both surfaces now read the SAME table — `error_events`, the server-side
 * cron/webhook/action failures captured by convex/observability.ts — with
 * the same 24h/7d windows. The header shows both counts so the number the
 * Aloa X alert quotes is literally on this screen, and Aloa X's backend
 * alerts deep-link here for the stack traces.
 */

import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useFounderAuth } from '../FounderContexts';

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm overflow-hidden';

const SCOPE_BADGE: Record<string, string> = {
    cron: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
    webhook: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
    action: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    http: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
};

const SEV_BADGE: Record<string, string> = {
    error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
};

function timeAgoLabel(ts: number): string {
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

export const SystemStatus: React.FC = () => {
    const { currentUser, bearerToken } = useFounderAuth();
    const tokenIdentifier = currentUser?.email || '';
    const [expandedId, setExpandedId] = React.useState<string | null>(null);
    const result = useQuery(api.founderMetrics.getSystemErrors,
        tokenIdentifier && bearerToken ? { tokenIdentifier, sessionToken: bearerToken ?? undefined } : "skip");

    const isLoading = result === undefined;
    const errors: any[] = (result as any)?.errors ?? [];
    const errors24h: number = (result as any)?.errors24h ?? 0;
    const errors7d: number = (result as any)?.errors7d ?? 0;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
                <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">System Status</h2>
                <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    {isLoading ? 'Loading…' : `${errors24h} error${errors24h === 1 ? '' : 's'} in the last 24h · ${errors7d} in the last 7 days`}
                </p>
                <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-0.5">
                    Server-side failures (crons, webhooks, actions) — the same telemetry the Aloa X watchdog watches.
                </p>
            </div>

            <div className="px-4 sm:px-6 lg:px-8">
                {isLoading ? (
                    <div className={CARD}>
                        <div className="text-center py-8">
                            <div className="w-8 h-8 mx-auto border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
                            <p className="text-sm text-slate-400 mt-3">Loading system status…</p>
                        </div>
                    </div>
                ) : errors.length === 0 ? (
                    <div className={CARD}>
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <p className="text-sm font-bold text-emerald-600">All systems operational</p>
                            <p className="text-xs text-slate-400 mt-1">No backend errors captured in the last 7 days.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {errors.map((err: any) => {
                            const errId = err.id || `err-${err.timestamp}`;
                            const isExpanded = expandedId === errId;
                            return (
                            <div key={errId} className={CARD}>
                                <div
                                    className="flex items-start gap-3 min-w-0 cursor-pointer"
                                    onClick={() => setExpandedId(isExpanded ? null : errId)}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${err.severity === 'warning' ? 'bg-amber-100 dark:bg-amber-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                                        <svg className={`w-4 h-4 ${err.severity === 'warning' ? 'text-amber-500' : 'text-red-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`px-2 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider ${SCOPE_BADGE[err.scope] || 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300'}`}>
                                                {err.scope}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider ${SEV_BADGE[err.severity] || SEV_BADGE.error}`}>
                                                {err.severity}
                                            </span>
                                            <span className="text-2xs text-slate-400">{timeAgoLabel(err.timestamp)}</span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate mt-1">{err.name}</p>
                                        <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed break-words line-clamp-2">{err.message}</p>
                                        {isExpanded && (
                                            <>
                                                {err.stack && (
                                                    <pre className="text-2xs text-slate-500 dark:text-zinc-400 mt-2 p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg overflow-x-auto custom-scrollbar whitespace-pre-wrap break-all">{err.stack}</pre>
                                                )}
                                                {err.context && (
                                                    <pre className="text-2xs text-slate-500 dark:text-zinc-400 mt-2 p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg overflow-x-auto custom-scrollbar whitespace-pre-wrap break-all">{err.context}</pre>
                                                )}
                                                <p className="text-2xs text-primary-600 dark:text-primary-400 mt-1.5">Tap to collapse</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            );
                        })}
                        {errors7d >= 200 && (
                            <p className="text-center text-2xs text-slate-400 dark:text-zinc-500 py-1">
                                Showing the 200 most recent errors in the 7-day window.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
