/**
 * SecurityCenter — Admin security & activity dashboard.
 *
 * ROUND D (D4) — this view was DETECT-ONLY: it could see presence and
 * security events, but every response action in the platform was orphaned.
 * securityHelpers' blockIp / unblockIp / suspendUser / unsuspendUser and
 * the blockedIps / suspendedUsers lists had ZERO UI (properly gated by
 * session-verified requireFounder, but unreachable), and
 * sessions.revokeAllUserSessions was an UNGATED public mutation (any
 * caller could force-logout anyone). The console now closes the loop:
 *
 * Displays:
 *   1. Live Session Feed — real-time online users + SUSPEND quick action
 *      (suspendUser + revokeAllUserSessions — the live bearer dies with
 *      the ban; enforcement already sat in requireFirmUser).
 *   2. Security Alerts Panel — recent security events + BLOCK IP quick
 *      action per event (enforced at /ai/stream).
 *   3. Suspended Users panel — list + unsuspend (suspension IS enforced:
 *      requireFirmUser + the estate resident gate reject suspended users).
 *   4. Blocked IPs panel — list + block form + unblock (enforced at the
 *      /ai/stream httpAction chokepoint — the only layer that can see the
 *      client IP; Convex mutations cannot).
 *
 * Data sources:
 *   - api.founderMetrics.getAllPresenceForAdmin (real-time online users)
 *   - api.founderMetrics.getSecurityEventsForAdmin (security event log)
 *   - api.securityHelpers.getSuspendedUsers / getSuspendedUsers list reads
 *   - api.securityHelpers.suspendUser / unsuspendUser / blockIp / unblockIp
 *   - api.sessions.revokeAllUserSessions (now session-gated: self or Founder)
 *
 * Uses defensive query pattern (try/catch) so the view doesn't crash
 * if the Convex backend hasn't been deployed yet.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    const { currentUser, bearerToken } = useFounderAuth();
    const convex = useConvex();
    const [onlineUsers, setOnlineUsers] = useState<PresenceEntry[]>([]);
    const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
    const [blockedIps, setBlockedIps] = useState<any[]>([]);
    const [suspendedUsers, setSuspendedUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    // Block-IP form state
    const [blockIpInput, setBlockIpInput] = useState('');
    const [blockReasonInput, setBlockReasonInput] = useState('');

    // Suspend-user form state
    const [suspendEmailInput, setSuspendEmailInput] = useState('');
    const [suspendReasonInput, setSuspendReasonInput] = useState('');

    const authArgs = useMemo(() => ({
        tokenIdentifier: (currentUser?.email || '').toLowerCase(),
        sessionToken: bearerToken ?? undefined,
    }), [currentUser?.email, bearerToken]);

    const fetchData = useCallback(async () => {
        if (!currentUser?.email) return;
        setLoading(true);
        setError(null);
        try {
            const [presence, events, ips, suspended] = await Promise.all([
                convex.query(api.founderMetrics.getAllPresenceForAdmin, { tokenIdentifier: authArgs.tokenIdentifier, sessionToken: authArgs.sessionToken }),
                convex.query(api.founderMetrics.getSecurityEventsForAdmin, { tokenIdentifier: authArgs.tokenIdentifier, sessionToken: authArgs.sessionToken }),
                convex.query(api.securityHelpers.getBlockedIps, { ...authArgs }).catch(() => [] as any[]),
                convex.query(api.securityHelpers.getSuspendedUsers, { ...authArgs }).catch(() => [] as any[]),
            ]);
            setOnlineUsers(presence || []);
            setSecurityEvents(events || []);
            setBlockedIps(ips || []);
            setSuspendedUsers(suspended || []);
        } catch (err: any) {
            console.error('SecurityCenter query failed:', err);
            setError(err.message || 'Failed to load security data');
        } finally {
            setLoading(false);
        }
    }, [currentUser?.email, convex, authArgs]);

    useEffect(() => {
        fetchData();
        // Refresh every 30 seconds for near-real-time updates
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const refreshLists = useCallback(async () => {
        try {
            const [ips, suspended] = await Promise.all([
                convex.query(api.securityHelpers.getBlockedIps, { ...authArgs }).catch(() => [] as any[]),
                convex.query(api.securityHelpers.getSuspendedUsers, { ...authArgs }).catch(() => [] as any[]),
            ]);
            setBlockedIps(ips || []);
            setSuspendedUsers(suspended || []);
        } catch { /* defensive */ }
    }, [convex, authArgs]);

    // ── D4 actions (all founder-session-authenticated server-side) ──────

    const handleBlockIp = async (ip: string, reason?: string) => {
        if (!ip.trim()) return;
        setBusy(`block:${ip}`);
        setActionError(null);
        try {
            await convex.mutation(api.securityHelpers.blockIp, { ...authArgs, ip: ip.trim(), reason: reason?.trim() || undefined });
            setBlockIpInput('');
            setBlockReasonInput('');
            await refreshLists();
        } catch (err: any) {
            setActionError(err.message || 'Failed to block IP.');
        } finally {
            setBusy(null);
        }
    };

    const handleUnblockIp = async (ip: string) => {
        setBusy(`unblock:${ip}`);
        setActionError(null);
        try {
            await convex.mutation(api.securityHelpers.unblockIp, { ...authArgs, ip });
            await refreshLists();
        } catch (err: any) {
            setActionError(err.message || 'Failed to unblock IP.');
        } finally {
            setBusy(null);
        }
    };

    const handleSuspendUser = async (userId: string, reason?: string) => {
        if (!userId) return;
        setBusy(`suspend:${userId}`);
        setActionError(null);
        try {
            await convex.mutation(api.securityHelpers.suspendUser, { ...authArgs, userId, reason: reason?.trim() || undefined });
            // Force-logout: revoke every session so a live bearer can't
            // outlive the ban on paths that don't consult suspendedUsers.
            try {
                await convex.mutation(api.sessions.revokeAllUserSessions, { userId: userId as any, sessionToken: authArgs.sessionToken });
            } catch (e: any) {
                console.warn('Session revocation after suspend failed (suspension still enforced by requireFirmUser):', e?.message);
            }
            setSuspendEmailInput('');
            setSuspendReasonInput('');
            await refreshLists();
        } catch (err: any) {
            setActionError(err.message || 'Failed to suspend user.');
        } finally {
            setBusy(null);
        }
    };

    const handleUnsuspendUser = async (userId: string) => {
        setBusy(`unsuspend:${userId}`);
        setActionError(null);
        try {
            await convex.mutation(api.securityHelpers.unsuspendUser, { ...authArgs, userId });
            await refreshLists();
        } catch (err: any) {
            setActionError(err.message || 'Failed to unsuspend user.');
        } finally {
            setBusy(null);
        }
    };

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
                        Real-time presence, security alerts, and response actions — suspend users, block IPs
                    </p>
                </div>

                {error && (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                            {error}
                        </p>
                    </div>
                )}
                {actionError && (
                    <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40">
                        <p className="text-xs font-bold text-rose-700 dark:text-rose-400">
                            {actionError}
                        </p>
                    </div>
                )}

                {/* KPI Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                    <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-slate-200 dark:border-zinc-700">
                        <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Suspended / Blocked</p>
                        <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{suspendedUsers.length} / {blockedIps.length}</p>
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
                                        <button
                                            onClick={() => handleSuspendUser(user.userId, 'Suspended from Security Center live feed')}
                                            disabled={busy === `suspend:${user.userId}`}
                                            className="px-2 py-1 text-3xs font-black uppercase rounded-md bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-50"
                                        >
                                            {busy === `suspend:${user.userId}` ? '…' : 'Suspend'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Suspended Users panel — the enforcement exists (requireFirmUser
                    + the estate resident gate); this is the missing console. */}
                <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-700 flex items-center gap-2">
                        <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        <h2 className="text-sm font-bold text-slate-800 dark:text-white">Suspended Users</h2>
                        <span className="text-2xs text-slate-400">suspension is enforced on every firm + resident call; sessions are revoked on suspend</span>
                    </div>
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-700 flex flex-wrap items-center gap-2">
                        <input
                            value={suspendEmailInput}
                            onChange={(e) => setSuspendEmailInput(e.target.value)}
                            placeholder="User ID to suspend (from Live Sessions or a security event)"
                            className="flex-1 min-w-[220px] px-2.5 py-1.5 text-2xs rounded-lg border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 focus:ring-1 focus:ring-amber-500/40 outline-none"
                        />
                        <input
                            value={suspendReasonInput}
                            onChange={(e) => setSuspendReasonInput(e.target.value)}
                            placeholder="Reason (optional)"
                            className="flex-1 min-w-[140px] px-2.5 py-1.5 text-2xs rounded-lg border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 focus:ring-1 focus:ring-amber-500/40 outline-none"
                        />
                        <button
                            onClick={() => handleSuspendUser(suspendEmailInput.trim(), suspendReasonInput)}
                            disabled={!suspendEmailInput.trim() || busy === `suspend:${suspendEmailInput.trim()}`}
                            className="px-3 py-1.5 text-2xs font-black uppercase rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-40"
                        >
                            Suspend User
                        </button>
                    </div>
                    {suspendedUsers.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">No suspended users</p>
                    ) : (
                        <div className="divide-y divide-slate-50 dark:divide-zinc-700/50">
                            {suspendedUsers.map((s, i) => (
                                <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{s.userId}</p>
                                        <p className="text-2xs text-slate-400 truncate">
                                            {s.reason || 'No reason recorded'}{s.suspendedBy ? ` · by ${s.suspendedBy}` : ''}
                                            {s.suspendedAt ? ` · ${new Date(s.suspendedAt).toLocaleString()}` : ''}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleUnsuspendUser(s.userId)}
                                        disabled={busy === `unsuspend:${s.userId}`}
                                        className="px-2 py-1 text-3xs font-black uppercase rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50 flex-shrink-0"
                                    >
                                        {busy === `unsuspend:${s.userId}` ? '…' : 'Unsuspend'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Blocked IPs panel — enforced at the /ai/stream chokepoint. */}
                <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-700 flex items-center gap-2">
                        <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                        <h2 className="text-sm font-bold text-slate-800 dark:text-white">Blocked IPs</h2>
                        <span className="text-2xs text-slate-400">enforced at the AI proxy (the layer that can see client IPs)</span>
                    </div>
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-700 flex flex-wrap items-center gap-2">
                        <input
                            value={blockIpInput}
                            onChange={(e) => setBlockIpInput(e.target.value)}
                            placeholder="IP address (e.g. 197.210.0.5)"
                            className="flex-1 min-w-[160px] px-2.5 py-1.5 text-2xs rounded-lg border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 focus:ring-1 focus:ring-rose-500/40 outline-none"
                        />
                        <input
                            value={blockReasonInput}
                            onChange={(e) => setBlockReasonInput(e.target.value)}
                            placeholder="Reason (optional)"
                            className="flex-1 min-w-[140px] px-2.5 py-1.5 text-2xs rounded-lg border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 focus:ring-1 focus:ring-rose-500/40 outline-none"
                        />
                        <button
                            onClick={() => handleBlockIp(blockIpInput, blockReasonInput)}
                            disabled={!blockIpInput.trim() || busy === `block:${blockIpInput.trim()}`}
                            className="px-3 py-1.5 text-2xs font-black uppercase rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors disabled:opacity-40"
                        >
                            Block IP
                        </button>
                    </div>
                    {blockedIps.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">No blocked IPs</p>
                    ) : (
                        <div className="divide-y divide-slate-50 dark:divide-zinc-700/50">
                            {blockedIps.map((b, i) => (
                                <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-800 dark:text-white truncate font-mono">{b.ip}</p>
                                        <p className="text-2xs text-slate-400 truncate">
                                            {b.reason || 'No reason recorded'}{b.blockedBy ? ` · by ${b.blockedBy}` : ''}
                                            {b.blockedAt ? ` · ${new Date(b.blockedAt).toLocaleString()}` : ''}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleUnblockIp(b.ip)}
                                        disabled={busy === `unblock:${b.ip}`}
                                        className="px-2 py-1 text-3xs font-black uppercase rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50 flex-shrink-0"
                                    >
                                        {busy === `unblock:${b.ip}` ? '…' : 'Unblock'}
                                    </button>
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
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-3xs text-slate-400">
                                            {new Date(event.timestamp).toLocaleString()}
                                        </span>
                                        {event.ip && (
                                            <button
                                                onClick={() => handleBlockIp(event.ip, `Security event: ${event.eventType}`)}
                                                disabled={busy === `block:${event.ip}` || blockedIps.some((b) => b.ip === event.ip)}
                                                className="px-2 py-1 text-3xs font-black uppercase rounded-md bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-40"
                                            >
                                                {blockedIps.some((b) => b.ip === event.ip) ? 'Blocked' : busy === `block:${event.ip}` ? '…' : 'Block IP'}
                                            </button>
                                        )}
                                    </div>
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
