/**
 * SystemStatus — surfaces recent system errors (Gemini failures, PDF errors, etc.)
 */

import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useFounderAuth } from '../FounderContexts';

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm overflow-hidden';

export const SystemStatus: React.FC = () => {
    const { currentUser } = useFounderAuth();
    const tokenIdentifier = currentUser?.email || '';
    const [expandedId, setExpandedId] = React.useState<string | null>(null);
    const errors = useQuery(api.founderMetrics.getSystemErrors,
        tokenIdentifier ? { tokenIdentifier } : "skip");

    const isLoading = errors === undefined;
    const safeErrors = (errors as any[]) || [];

    // Format time ago — shows hours if < 24h, days otherwise
    const formatTimeAgo = (days: number): string => {
        if (days < 1) {
            const hours = Math.max(0, Math.floor(days * 24));
            return hours <= 0 ? 'just now' : `${hours}h ago`;
        }
        return `${Math.floor(days)}d ago`;
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
                <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">System Status</h2>
                <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{isLoading ? 'Loading...' : `${safeErrors.length} errors in the last 7 days`}</p>
            </div>

            <div className="px-4 sm:px-6 lg:px-8">
                {isLoading ? (
                    <div className={CARD}>
                        <div className="text-center py-8">
                            <div className="w-8 h-8 mx-auto border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
                            <p className="text-sm text-slate-400 mt-3">Loading system status...</p>
                        </div>
                    </div>
                ) : safeErrors.length === 0 ? (
                    <div className={CARD}>
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <p className="text-sm font-bold text-emerald-600">All systems operational</p>
                            <p className="text-xs text-slate-400 mt-1">No errors detected in the last 7 days.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {safeErrors.map((err: any, i: number) => {
                            const errId = err._id || `err-${i}`;
                            const isExpanded = expandedId === errId;
                            const propsStr = err.properties ? JSON.stringify(err.properties, null, 2) : '';
                            return (
                            <div key={errId} className={CARD}>
                                <div
                                    className="flex items-start gap-3 min-w-0 cursor-pointer"
                                    onClick={() => setExpandedId(isExpanded ? null : errId)}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zM12 15.75h.007v.008H12v-.008z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{err.event}</p>
                                        <p className="text-2xs text-slate-400">Firm: {err.firmId} · {formatTimeAgo(err.timeAgo || 0)}</p>
                                        {err.properties && !isExpanded && (
                                            <p className="text-2xs text-slate-400 truncate mt-0.5">{JSON.stringify(err.properties).substring(0, 120)}...</p>
                                        )}
                                        {isExpanded && propsStr && (
                                            <pre className="text-2xs text-slate-500 dark:text-zinc-400 mt-2 p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg overflow-x-auto custom-scrollbar whitespace-pre-wrap break-all">{propsStr}</pre>
                                        )}
                                        {isExpanded && (
                                            <p className="text-2xs text-primary-600 dark:text-primary-400 mt-1">Tap to collapse</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
