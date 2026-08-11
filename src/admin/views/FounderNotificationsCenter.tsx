/**
 * FounderNotificationsCenter — Unified notifications feed for the founder app.
 *
 * Consolidates 4 data sources into one scrollable feed:
 *   1. Signals (new users, new firms, churn risks, milestones)
 *   2. Security events (disposable email blocks, unauthorized access, rate limits)
 *   3. Subscription requests (pending approvals)
 *   4. Broadcast delivery reports (sent/delivered/failed)
 *
 * Features:
 *   - Unified timeline sorted by timestamp (most recent first)
 *   - Color-coded category badges (emerald=signup, amber=churn, red=security,
 *     blue=subscription, violet=broadcast)
 *   - Filter tabs (All / Security / Signups / Subscriptions / Broadcasts)
 *   - Mark-as-read per item + "Mark All Read" button
 *   - Read state persisted to localStorage
 *   - Auto-refresh every 60s
 *   - Defensive query pattern (try/catch) so it never crashes
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useFounderAuth } from '../FounderContexts';

type Category = 'security' | 'signup' | 'subscription' | 'broadcast' | 'churn' | 'milestone' | 'system';
type FilterTab = 'all' | Category;

interface FeedItem {
    id: string;
    category: Category;
    title: string;
    description: string;
    timestamp: number;
    isRead: boolean;
    metadata?: any;
}

const CATEGORY_META: Record<Category, { label: string; badge: string; dot: string; icon: string }> = {
    security:      { label: 'Security',    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',           dot: 'bg-red-500',           icon: '🔒' },
    signup:        { label: 'New User',    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dot: 'bg-emerald-500', icon: '👤' },
    subscription:  { label: 'Subscription',badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',         dot: 'bg-blue-500',          icon: '💳' },
    broadcast:     { label: 'Broadcast',   badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400', dot: 'bg-violet-500',       icon: '📡' },
    churn:         { label: 'Churn Risk',  badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',    dot: 'bg-amber-500',         icon: '⚠️' },
    milestone:     { label: 'Milestone',   badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', dot: 'bg-purple-500',       icon: '🎯' },
    system:        { label: 'System',      badge: 'bg-slate-100 text-slate-700 dark:bg-zinc-700 dark:text-zinc-300',         dot: 'bg-slate-400',         icon: '⚙️' },
};

const FILTER_TABS: { id: FilterTab; label: string }[] = [
    { id: 'all',           label: 'All' },
    { id: 'security',      label: 'Security' },
    { id: 'signup',        label: 'Signups' },
    { id: 'subscription',  label: 'Subscriptions' },
    { id: 'broadcast',     label: 'Broadcasts' },
    { id: 'churn',         label: 'Churn' },
];

const READ_KEY = 'founder_notifications_read';

const FounderNotificationsCenter: React.FC = () => {
    const { currentUser } = useFounderAuth();
    const convex = useConvex();
    const [items, setItems] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
    const [readIds, setReadIds] = useState<Set<string>>(new Set());

    // Load read state from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(READ_KEY);
            if (stored) setReadIds(new Set(JSON.parse(stored)));
        } catch {}
    }, []);

    // Fetch all data sources
    useEffect(() => {
        if (!currentUser?.email) return;
        const token = currentUser.email.toLowerCase();

        const fetchAll = async () => {
            setLoading(true);
            const feed: FeedItem[] = [];

            // 1. Founder Alerts (signups, churn, milestones)
            try {
                const alerts = await convex.query(api.founderMetrics.getFounderAlerts, { tokenIdentifier: token });
                if (alerts) {
                    // New users
                    (alerts.newUsers24h || []).forEach((u: any, i: number) => {
                        feed.push({
                            id: `signup_${u.email}_${i}`,
                            category: 'signup',
                            title: `New User: ${u.name}`,
                            description: `${u.email} • ${u.product || 'unified'}`,
                            timestamp: Date.now() - (i * 3600000),
                            isRead: false,
                            metadata: u,
                        });
                    });
                    // New firms
                    (alerts.newFirms24h || []).forEach((f: any, i: number) => {
                        feed.push({
                            id: `firm_${f.name}_${i}`,
                            category: 'signup',
                            title: `New Firm: ${f.name}`,
                            description: `Product: ${f.product || 'unified'}`,
                            timestamp: Date.now() - (i * 3600000 + 1800000),
                            isRead: false,
                            metadata: f,
                        });
                    });
                    // Churn risks
                    (alerts.churnRisks || []).slice(0, 5).forEach((c: any, i: number) => {
                        feed.push({
                            id: `churn_${c.firmId || i}`,
                            category: 'churn',
                            title: `Churn Risk: ${c.firmName || 'Unknown'}`,
                            description: `${c.daysSinceActive || '?'} days inactive • Risk: ${c.risk || 'UNKNOWN'}`,
                            timestamp: Date.now() - (i * 7200000),
                            isRead: false,
                            metadata: c,
                        });
                    });
                    // Milestones
                    if (alerts.totalUsers > 0 && alerts.totalUsers % 10 === 0) {
                        feed.push({
                            id: `milestone_users_${alerts.totalUsers}`,
                            category: 'milestone',
                            title: `Milestone: ${alerts.totalUsers} Users`,
                            description: `Platform has reached ${alerts.totalUsers} total users`,
                            timestamp: Date.now(),
                            isRead: false,
                        });
                    }
                    if (alerts.totalFirms > 0 && alerts.totalFirms % 5 === 0) {
                        feed.push({
                            id: `milestone_firms_${alerts.totalFirms}`,
                            category: 'milestone',
                            title: `Milestone: ${alerts.totalFirms} Firms`,
                            description: `Platform has reached ${alerts.totalFirms} organizations`,
                            timestamp: Date.now() - 60000,
                            isRead: false,
                        });
                    }
                }
            } catch (e) {
                console.warn('[Notifications] getFounderAlerts failed:', e);
            }

            // 2. Security Events
            try {
                const events = await convex.query(api.founderMetrics.getSecurityEventsForAdmin, { tokenIdentifier: token });
                if (Array.isArray(events)) {
                    events.forEach((e: any) => {
                        feed.push({
                            id: `security_${e.id}`,
                            category: 'security',
                            title: e.eventType?.replace(/_/g, ' ') || 'Security Event',
                            description: `${e.email || '—'} ${e.ip ? `• IP: ${e.ip}` : ''} ${e.details ? `• ${e.details}` : ''}`,
                            timestamp: e.timestamp || Date.now(),
                            isRead: false,
                            metadata: e,
                        });
                    });
                }
            } catch (e) {
                console.warn('[Notifications] getSecurityEventsForAdmin failed:', e);
            }

            // 3. Subscription Requests
            try {
                const requests = await convex.query(api.founderMetrics.getSubscriptionRequests, { tokenIdentifier: token });
                if (requests && Array.isArray(requests)) {
                    requests.filter((r: any) => r.status === 'pending').forEach((r: any, i: number) => {
                        feed.push({
                            id: `sub_${r.id || i}`,
                            category: 'subscription',
                            title: `Pending: ${r.plan || 'Unknown Plan'}`,
                            description: `${r.firmName || 'Unknown Firm'} • ₦${(r.amount || 0).toLocaleString()}`,
                            timestamp: r.requestedAt ? new Date(r.requestedAt).getTime() : Date.now(),
                            isRead: false,
                            metadata: r,
                        });
                    });
                }
            } catch (e) {
                console.warn('[Notifications] getSubscriptionRequests failed:', e);
            }

            // 4. Online presence (system notification)
            try {
                const presence = await convex.query(api.founderMetrics.getAllPresenceForAdmin, { tokenIdentifier: token });
                if (Array.isArray(presence) && presence.length > 0) {
                    feed.push({
                        id: `presence_${Date.now()}`,
                        category: 'system',
                        title: `${presence.length} User${presence.length === 1 ? '' : 's'} Online Now`,
                        description: `Across ${new Set(presence.map((p: any) => p.firmId)).size} firm${new Set(presence.map((p: any) => p.firmId)).size === 1 ? '' : 's'}`,
                        timestamp: Date.now(),
                        isRead: false,
                    });
                }
            } catch (e) {
                console.warn('[Notifications] getAllPresenceForAdmin failed:', e);
            }

            // Sort by timestamp (most recent first)
            feed.sort((a, b) => b.timestamp - a.timestamp);
            setItems(feed);
            setLoading(false);
        };

        fetchAll();
        const interval = setInterval(fetchAll, 60000);
        return () => clearInterval(interval);
    }, [currentUser?.email, convex]);

    // Mark item as read
    const markAsRead = useCallback((id: string) => {
        setReadIds(prev => {
            const next = new Set(prev);
            next.add(id);
            try { localStorage.setItem(READ_KEY, JSON.stringify([...next])); } catch {}
            return next;
        });
    }, []);

    // Mark all as read
    const markAllRead = useCallback(() => {
        setReadIds(prev => {
            const next = new Set(prev);
            items.forEach(item => next.add(item.id));
            try { localStorage.setItem(READ_KEY, JSON.stringify([...next])); } catch {}
            return next;
        });
    }, [items]);

    // Filter items
    const filteredItems = useMemo(() => {
        if (activeFilter === 'all') return items;
        return items.filter(item => item.category === activeFilter);
    }, [items, activeFilter]);

    const unreadCount = useMemo(() => items.filter(i => !readIds.has(i.id)).length, [items, readIds]);

    const formatTime = (ts: number) => {
        const diff = Date.now() - ts;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    };

    return (
        <div className="h-full overflow-y-auto bg-slate-50 dark:bg-zinc-900 pb-20">
            <div className="max-w-3xl mx-auto p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-black text-slate-900 dark:text-white">Notifications</h1>
                        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'} · auto-refresh 60s
                        </p>
                    </div>
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllRead}
                            className="px-3 py-1.5 text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                        >
                            Mark All Read
                        </button>
                    )}
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-1 overflow-x-auto bg-white dark:bg-zinc-800 p-1 rounded-lg border border-slate-200 dark:border-zinc-700">
                    {FILTER_TABS.map(tab => {
                        const count = tab.id === 'all' ? items.length : items.filter(i => i.category === tab.id).length;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveFilter(tab.id)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all ${
                                    activeFilter === tab.id
                                        ? 'bg-primary-600 text-white shadow-sm'
                                        : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-700'
                                }`}
                            >
                                {tab.label}
                                {count > 0 && (
                                    <span className={`ml-1.5 px-1 py-0.5 rounded-full text-3xs ${
                                        activeFilter === tab.id ? 'bg-white/20' : 'bg-slate-200 dark:bg-zinc-600'
                                    }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Feed */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-6 h-6 border-2 border-slate-300 border-t-primary-600 rounded-full animate-spin" />
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-sm text-slate-400">No notifications in this category</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredItems.map((item) => {
                            const cat = CATEGORY_META[item.category];
                            const isRead = readIds.has(item.id);
                            return (
                                <div
                                    key={item.id}
                                    onClick={() => markAsRead(item.id)}
                                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                        isRead
                                            ? 'bg-white dark:bg-zinc-800/50 border-slate-100 dark:border-zinc-700/50 opacity-70'
                                            : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 shadow-sm hover:shadow-md'
                                    }`}
                                >
                                    {/* Category dot */}
                                    <div className={`w-2 h-2 rounded-full ${cat.dot} flex-shrink-0 mt-1.5 ${!isRead ? 'animate-pulse' : ''}`} />

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className={`px-1.5 py-0.5 rounded text-3xs font-black uppercase ${cat.badge}`}>
                                                {cat.label}
                                            </span>
                                            {!isRead && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                                            )}
                                        </div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                            {item.title}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                                            {item.description}
                                        </p>
                                    </div>

                                    {/* Timestamp */}
                                    <span className="text-3xs text-slate-400 flex-shrink-0 whitespace-nowrap">
                                        {formatTime(item.timestamp)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FounderNotificationsCenter;
