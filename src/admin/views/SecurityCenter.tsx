/**
 * SecurityCenter — Admin security & activity dashboard.
 *
 * Displays:
 *   1. Live Session Feed — real-time list of online users with firm name,
 *      product, and seconds since last heartbeat.
 *   2. Security Alerts Panel — recent security events (disposable email
 *      blocks, failed logins, unauthorized access attempts).
 *   3. Online firm tinting — firms with at least one online user get an
 *      emerald tint bar.
 *
 * Data sources:
 *   - api.founderMetrics.getAllPresenceForAdmin (real-time online users)
 *   - api.founderMetrics.getSecurityEventsForAdmin (security event log)
 *
 * Uses defensive query pattern (try/catch) so the view doesn't crash
 * if the Convex backend hasn't been deployed yet.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useFounderAuth } from '../FounderContexts';

interface PresenceEntry {
    userId: string;
    userName: string;
    userEmail: string;
    firmId: string;
    firmName: string;
    product: string;
    lastSeen: number;
    secondsAgo: number;
    isOnline: boolean;
}

interface SecurityEvent {
    id: string;
    eventType: string;
    email: string;
    ip: string;
    details: string;
    timestamp: number;
}

const SecurityCenter: React.FC = () => {
    const { currentUser } = useFounderAuth();
    const convex = useConvex();
    const [onlineUsers, setOnlineUsers] = useState<PresenceEntry[]>([]);
    const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!currentUser?.email) return;
        const token = currentUser.email.toLowerCase();

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [presence, events] = await Promise.all([
                    convex.query(api.founderMetrics.getAllPresenceForAdmin, { tokenIdentifier: token }),
                    convex.query(api.founderMetrics.getSecurityEventsForAdmin, { tokenIdentifier: token }),
                ]);
                setOnlineUsers(presence || []);
                setSecurityEvents(events || []);
            } catch (err: any) {
                console.error('SecurityCenter query failed:', err);
                setError(err.message || 'Failed to load security data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        // Refresh every 30 seconds for near-real-time updates
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [currentUser?.email, convex]);

    // Group online users by firm for the active firm tinting
    const onlineFirms = useMemo(() => {
        const firmMap = new Map<string, { firmName: string; users: PresenceEntry[] }>();
        onlineUsers.forEach(u => {
            const key = u.firmId || 'unknown';
            if (!firmMap.has(key)) {
                firmMap.set(key, { firmName: u.firmName || 'Unknown Firm', users: [] });
            }
            firmMap.get(key)!.users.push(u);
        });
        return Array.from(firmMap.entries()).map(([firmId, data]) => ({ firmId, ...data }));
    }, [onlineUsers]);

    if (loading && onlineUsers.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-zinc-400">
                <div className="w-6 h-6 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto bg-slate-50 dark:bg-zinc-900 p-4 pb-20">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-xl font-black text-slate-900 dark:text-white">Security Center</h1>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                        Real-time presence, security alerts, and anomaly detection
                    </p>
                </div>

                {error && (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                            {error}
                        </p>
                    </div>
                )}

                {/* KPI Row */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-slate-200 dark:border-zinc-700">
                        <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Online Now</p>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{onlineUsers.length}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-slate-200 dark:border-zinc-700">
                        <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Active Firms</p>
                        <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{onlineFirms.length}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-slate-200 dark:border-zinc-700">
                        <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Security Events</p>
                        <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{securityEvents.length}</p>
                    </div>
                </div>

                {/* Live Session Feed */}
                <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <h2 className="text-sm font-bold text-slate-800 dark:text-white">Live Sessions</h2>
                        </div>
                        <span className="text-2xs text-slate-400">{onlineUsers.length} online · auto-refresh 30s</span>
                    </div>
                    {onlineUsers.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">No active sessions right now</p>
                    ) : (
                        <div className="divide-y divide-slate-50 dark:divide-zinc-700/50">
                            {onlineUsers.map((user, i) => (
                                <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-zinc-700/30 transition-colors">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{user.userName}</p>
                                            <p className="text-2xs text-slate-400 truncate">{user.userEmail}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <div className="text-right">
                                            <p className="text-2xs font-semibold text-slate-600 dark:text-zinc-300 truncate max-w-[120px]">{user.firmName}</p>
                                            <p className="text-3xs text-slate-400">{user.secondsAgo}s ago</p>
                                        </div>
                                        <span className="px-1.5 py-0.5 text-3xs font-black uppercase rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                            Online
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Active Firms (with emerald tint) */}
                {onlineFirms.length > 0 && (
                    <div className="space-y-2">
                        <h2 className="text-sm font-bold text-slate-800 dark:text-white">Active Firms</h2>
                        {onlineFirms.map((firm, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border-l-4 border-emerald-500"
                                style={{ background: 'rgba(16, 185, 129, 0.08)' }}
                            >
                                <div>
                                    <p className="text-xs font-bold text-slate-800 dark:text-white">{firm.firmName}</p>
                                    <p className="text-2xs text-slate-500 dark:text-zinc-400">
                                        {firm.users.length} user{firm.users.length === 1 ? '' : 's'} online
                                    </p>
                                </div>
                                <span className="px-2 py-0.5 text-2xs font-black uppercase rounded-full bg-emerald-500 text-white">
                                    Online Now
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Security Alerts Panel */}
                <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-700 flex items-center gap-2">
                        <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        <h2 className="text-sm font-bold text-slate-800 dark:text-white">Security Alerts</h2>
                    </div>
                    {securityEvents.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">No security events detected</p>
                    ) : (
                        <div className="divide-y divide-slate-50 dark:divide-zinc-700/50">
                            {securityEvents.map((event, i) => (
                                <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-800 dark:text-white">
                                            {event.eventType.replace(/_/g, ' ')}
                                        </p>
                                        <p className="text-2xs text-slate-400 truncate">
                                            {event.email || '—'} {event.ip ? `· ${event.ip}` : ''}
                                        </p>
                                    </div>
                                    <span className="text-3xs text-slate-400 flex-shrink-0">
                                        {new Date(event.timestamp).toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SecurityCenter;
