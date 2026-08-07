/**
 * BroadcastConsole — admin broadcast console for the Founder APK.
 *
 * Allows the founder to send platform-wide announcements to:
 *   - All Apps
 *   - Vega Only
 *   - Atrium Only
 *   - Komplete Only
 *
 * Delivery channels:
 *   - In-App Banner (creates a notification for every matching user)
 *   - Email (via Brevo)
 *   - Both
 *
 * Color-coded themes:
 *   - Info/Announcement (blue)
 *   - Success/Milestone (green)
 *   - Warning (amber)
 *   - Urgent Alert (red)
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useFounderAuth, useFounderToast } from '../FounderContexts';

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm';
const LABEL = 'text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest';

type Target = 'all' | 'legal' | 'property' | 'unified';
type Channel = 'inapp' | 'email' | 'both';
type Theme = 'info' | 'success' | 'warning' | 'urgent';
type PersistenceMode = 'permanent' | 'session' | 'persistent';

const PERSISTENCE_LABELS: Record<PersistenceMode, { label: string; description: string; icon: string }> = {
    permanent:  { label: 'Dismiss Permanently', description: 'Once dismissed, never shows again. Ideal for one-off announcements or compliance acknowledgments.', icon: '🔒' },
    session:    { label: 'Dismiss for Session', description: 'Hidden until logout. Reappears on next login until expired.', icon: '⏱️' },
    persistent: { label: 'Non-Dismissible',     description: 'No X button. Stays pinned until you archive it from the Control Center.', icon: '📌' },
};

const THEME_STYLES: Record<Theme, { label: string; color: string; bg: string; border: string; emoji: string }> = {
    info:    { label: 'Info / Announcement', color: 'text-blue-600',     bg: 'bg-blue-50 dark:bg-blue-900/20',     border: 'border-blue-300 dark:border-blue-700',     emoji: '🔵' },
    success: { label: 'Success / Milestone', color: 'text-emerald-600',  bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-300 dark:border-emerald-700', emoji: '🟢' },
    warning: { label: 'Warning',             color: 'text-amber-600',    bg: 'bg-amber-50 dark:bg-amber-900/20',   border: 'border-amber-300 dark:border-amber-700',   emoji: '🟡' },
    urgent:  { label: 'Urgent Alert',        color: 'text-red-600',      bg: 'bg-red-50 dark:bg-red-900/20',       border: 'border-red-300 dark:border-red-700',       emoji: '🔴' },
};

const TARGET_LABELS: Record<Target, string> = {
    all: 'All Apps',
    legal: 'Vega Only (Legal)',
    property: 'Atrium Only (Property)',
    unified: 'Komplete Only (Unified)',
};

export const BroadcastConsole: React.FC = () => {
    const { currentUser } = useFounderAuth();
    const { addToast } = useFounderToast();
    const convex = useConvex();

    const [target, setTarget] = useState<Target>('all');
    const [channel, setChannel] = useState<Channel>('inapp');
    const [theme, setTheme] = useState<Theme>('info');
    const [persistenceMode, setPersistenceMode] = useState<PersistenceMode>('permanent');
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [deepLink, setDeepLink] = useState('');
    const [isSending, setIsSending] = useState(false);

    const tokenIdentifier = currentUser?.email || currentUser?.tokenIdentifier || '';

    // Get all users to know how many will receive the broadcast
    const allFirms = useQuery(api.founderMetrics.getAllFirmsForAdmin,
        tokenIdentifier ? { tokenIdentifier } : "skip");
    const recipientCount = (allFirms as any[])?.reduce((sum, f) => sum + (f.userCount || 0), 0) || 0;
    const logAdminAction = useMutation(api.founderMetrics.logAdminAction);

    // Fetch broadcast history (admin action log filtered to broadcasts)
    const broadcastHistory = useQuery(api.founderMetrics.getAdminActionLog,
        tokenIdentifier ? { tokenIdentifier } : "skip");

    // Active Banners Control Center — fetch all active broadcasts
    const activeBanners = useQuery(api.broadcasts.getActiveBroadcastsForAdmin,
        tokenIdentifier ? { tokenIdentifier } : "skip");

    // Archive a broadcast (kill all its notification rows)
    const archiveBroadcast = useMutation(api.broadcasts.archiveBroadcast);
    const bulkArchiveBroadcasts = useMutation(api.broadcasts.bulkArchiveBroadcasts);
    const cleanupDuplicateBroadcasts = useMutation(api.broadcasts.cleanupDuplicateBroadcasts);

    // Selected banner IDs for bulk actions
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [expandedBannerId, setExpandedBannerId] = useState<string | null>(null);

    const handleArchive = async (broadcastId: string) => {
        if (!confirm('Archive this banner? This will remove it from ALL users immediately.')) return;
        try {
            const result = await archiveBroadcast({ tokenIdentifier, broadcastId });
            addToast(`Banner archived. Removed ${result.deleted} notification(s).`, { type: 'success' });
        } catch (e: any) {
            addToast(e?.message || 'Failed to archive banner.', { type: 'error' });
        }
    };

    const handleBulkArchive = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Archive ${selectedIds.size} banner(s)? This will remove ALL their notifications from ALL users.`)) return;
        try {
            const result = await bulkArchiveBroadcasts({ tokenIdentifier, broadcastIds: [...selectedIds] });
            addToast(`Bulk archived. Removed ${result.deleted} notification(s).`, { type: 'success' });
            setSelectedIds(new Set());
        } catch (e: any) {
            addToast(e?.message || 'Failed to bulk archive.', { type: 'error' });
        }
    };

    const handleCleanupDuplicates = async () => {
        if (!confirm('Remove all duplicate broadcast notifications? This keeps only the newest copy per user+title+message.')) return;
        try {
            const result = await cleanupDuplicateBroadcasts({ tokenIdentifier });
            if (result.deleted > 0) {
                addToast(`Cleaned up ${result.deleted} duplicate notification(s).`, { type: 'success' });
            } else {
                addToast('No duplicates found. Database is clean.', { type: 'info' });
            }
        } catch (e: any) {
            addToast(e?.message || 'Failed to cleanup duplicates.', { type: 'error' });
        }
    };

    const toggleSelect = (broadcastId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(broadcastId)) next.delete(broadcastId);
            else next.add(broadcastId);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (!activeBanners || activeBanners.length === 0) return;
        if (selectedIds.size === activeBanners.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(activeBanners.map((b: any) => b.broadcastId)));
        }
    };

    const handleSend = async () => {
        if (!title.trim() || !message.trim()) {
            addToast('Please enter a title and message.', { type: 'error' });
            return;
        }
        setIsSending(true);
        try {
            // Use the Convex action to broadcast the notification
            // We'll create a notification for each user matching the target product
            const result = await convex.action(api.founderMetrics.broadcastNotification, {
                tokenIdentifier,
                targetProduct: target,
                channel,
                theme,
                title: title.trim(),
                message: message.trim(),
                deepLink: deepLink.trim() || undefined,
                persistenceMode,
            });
            // Log the admin action so it appears in the audit trail
            try {
                await logAdminAction({
                    tokenIdentifier,
                    action: 'Broadcast sent',
                    details: `Title: "${title.trim()}", Recipients: ${result.recipientCount}, Channel: ${channel}, Theme: ${theme}, Target: ${target}`,
                });
            } catch {}
            addToast(`Broadcast sent to ${result.recipientCount} users.`, { type: 'success' });
            setTitle('');
            setMessage('');
            setDeepLink('');
        } catch (e: any) {
            addToast(e?.message || 'Failed to send broadcast.', { type: 'error' });
        } finally {
            setIsSending(false);
        }
    };

    const themeStyle = THEME_STYLES[theme];

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            {/* Header */}
            <div style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
            className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6">
                <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Broadcast Console</h2>
                <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Send announcements to all users across the platform</p>
            </div>

            <div className="px-4 sm:px-6 lg:px-8 space-y-4">
                {/* Active Banners Control Center */}
                <div className={CARD}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            {activeBanners && activeBanners.length > 0 && (
                                <input
                                    type="checkbox"
                                    checked={selectedIds.size === activeBanners.length && activeBanners.length > 0}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-slate-300 dark:border-zinc-600 text-primary-600 focus:ring-primary-500"
                                />
                            )}
                            <p className={LABEL + ' mb-0'}>Active Banners Control Center</p>
                            {activeBanners && activeBanners.length > 0 && (
                                <span className="text-2xs font-bold text-primary-600 dark:text-primary-400">{activeBanners.length} active</span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {activeBanners && activeBanners.length > 0 && (
                                <button
                                    onClick={handleCleanupDuplicates}
                                    className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded text-2xs font-bold hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                                >
                                    Cleanup Duplicates
                                </button>
                            )}
                            {selectedIds.size > 0 && (
                                <button
                                    onClick={handleBulkArchive}
                                    className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-2xs font-bold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                >
                                    Archive Selected ({selectedIds.size})
                                </button>
                            )}
                        </div>
                    </div>
                    {activeBanners === undefined ? (
                        <div className="flex justify-center py-4">
                            <div className="w-6 h-6 border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
                        </div>
                    ) : activeBanners.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">No active banners. Banners you send will appear here for monitoring.</p>
                    ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                            {activeBanners.map((banner: any) => {
                                const isSelected = selectedIds.has(banner.broadcastId);
                                const isExpanded = expandedBannerId === banner.broadcastId;
                                const themeKey = banner.theme || 'info';
                                const themeColors: Record<string, { badge: string; accent: string }> = {
                                    info:    { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', accent: 'border-l-blue-400' },
                                    success: { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', accent: 'border-l-emerald-400' },
                                    warning: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', accent: 'border-l-amber-400' },
                                    urgent:  { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', accent: 'border-l-red-400' },
                                };
                                const tc = themeColors[themeKey] || themeColors.info;
                                return (
                                    <div key={banner.broadcastId} className={`p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg border-l-4 ${tc.accent} ${isSelected ? 'ring-2 ring-primary-400' : ''}`}>
                                        <div className="flex items-start gap-2 mb-2">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelect(banner.broadcastId)}
                                                className="w-4 h-4 mt-0.5 rounded border-slate-300 dark:border-zinc-600 text-primary-600 focus:ring-primary-500 flex-shrink-0"
                                            />
                                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedBannerId(isExpanded ? null : banner.broadcastId)}>
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${tc.badge}`}>
                                                        {themeKey === 'info' ? '🔵 Info' : themeKey === 'success' ? '🟢 Success' : themeKey === 'warning' ? '🟡 Warning' : themeKey === 'urgent' ? '🔴 Urgent' : themeKey}
                                                    </span>
                                                    <p className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate flex-1">{banner.title}</p>
                                                </div>
                                                <p className={`text-2xs text-slate-400 ${isExpanded ? 'whitespace-pre-wrap break-words' : 'truncate'}`}>
                                                    {banner.message}
                                                    {!isExpanded && banner.message && banner.message.length > 80 && (
                                                        <span className="text-primary-500 ml-1">... (tap to expand)</span>
                                                    )}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleArchive(banner.broadcastId)}
                                                className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-2xs font-bold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex-shrink-0"
                                            >
                                                Archive
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-1 ml-6">
                                            <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                                                {banner.targetProduct === 'all' ? 'All Apps' :
                                                 banner.targetProduct === 'unified' ? 'Komplete' :
                                                 banner.targetProduct === 'legal' ? 'Vega' :
                                                 banner.targetProduct === 'property' ? 'Atrium' : banner.targetProduct}
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                {banner.recipientCount} recipients
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-slate-200 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400">
                                                {banner.activeCount} active · {banner.dismissedCount} dismissed
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-slate-200 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400">
                                                {PERSISTENCE_LABELS[banner.persistenceMode as PersistenceMode]?.label || banner.persistenceMode}
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-slate-200 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400">
                                                {banner.createdAt ? new Date(banner.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Target Audience */}
                <div className={CARD}>
                    <p className={LABEL}>Target Audience</p>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                        {(Object.keys(TARGET_LABELS) as Target[]).map(t => (
                            <button
                                key={t}
                                onClick={() => setTarget(t)}
                                className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-colors ${
                                    target === t
                                        ? 'bg-primary-600 text-white shadow-sm'
                                        : 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600'
                                }`}
                            >
                                {TARGET_LABELS[t]}
                            </button>
                        ))}
                    </div>
                    <p className="text-2xs text-slate-400 mt-2">~{recipientCount} users will receive this broadcast</p>
                </div>

                {/* Delivery Channel */}
                <div className={CARD}>
                    <p className={LABEL}>Delivery Channel</p>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                        {([
                            { id: 'inapp', label: 'In-App Banner' },
                            { id: 'email', label: 'Email (Brevo)' },
                            { id: 'both', label: 'Both' },
                        ] as { id: Channel; label: string }[]).map(c => (
                            <button
                                key={c.id}
                                onClick={() => setChannel(c.id)}
                                className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-colors ${
                                    channel === c.id
                                        ? 'bg-primary-600 text-white shadow-sm'
                                        : 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600'
                                }`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Theme */}
                <div className={CARD}>
                    <p className={LABEL}>Alert Theme</p>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                        {(Object.keys(THEME_STYLES) as Theme[]).map(t => (
                            <button
                                key={t}
                                onClick={() => setTheme(t)}
                                className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-colors border-2 ${
                                    theme === t
                                        ? `${THEME_STYLES[t].bg} ${THEME_STYLES[t].color} ${THEME_STYLES[t].border}`
                                        : 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 border-transparent hover:bg-slate-200 dark:hover:bg-zinc-600'
                                }`}
                            >
                                {THEME_STYLES[t].emoji} {THEME_STYLES[t].label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Persistence Mode */}
                <div className={CARD}>
                    <p className={LABEL}>Persistence / Dismissal Behavior</p>
                    <div className="space-y-2 mt-3">
                        {(Object.keys(PERSISTENCE_LABELS) as PersistenceMode[]).map(m => (
                            <button
                                key={m}
                                onClick={() => setPersistenceMode(m)}
                                className={`w-full p-3 rounded-lg text-left transition-colors border-2 ${
                                    persistenceMode === m
                                        ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700'
                                        : 'bg-slate-50 dark:bg-zinc-900 border-transparent hover:border-slate-200 dark:hover:border-zinc-700'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-base">{PERSISTENCE_LABELS[m].icon}</span>
                                    <span className={`text-xs font-bold ${persistenceMode === m ? 'text-primary-700 dark:text-primary-400' : 'text-slate-700 dark:text-zinc-200'}`}>
                                        {PERSISTENCE_LABELS[m].label}
                                    </span>
                                </div>
                                <p className="text-2xs text-slate-400 ml-7">{PERSISTENCE_LABELS[m].description}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Message Composer */}
                <div className={CARD}>
                    <p className={LABEL}>Message</p>
                    <div className="space-y-3 mt-3">
                        <div>
                            <label className="text-2xs font-bold text-slate-400 uppercase tracking-widest">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="e.g., New Feature: Global Search"
                                className="w-full mt-1 px-3 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="text-2xs font-bold text-slate-400 uppercase tracking-widest">Message Body</label>
                            <textarea
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder="Type your announcement message..."
                                rows={4}
                                className="w-full mt-1 px-3 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 resize-none"
                            />
                        </div>
                        <div>
                            <label className="text-2xs font-bold text-slate-400 uppercase tracking-widest">Deep-Link Route (optional)</label>
                            <input
                                type="text"
                                value={deepLink}
                                onChange={e => setDeepLink(e.target.value)}
                                placeholder="e.g., /settings or /help"
                                className="w-full mt-1 px-3 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Preview */}
                <div className={CARD}>
                    <p className={LABEL}>Preview</p>
                    <div className={`mt-3 p-4 rounded-xl border-2 ${themeStyle.bg} ${themeStyle.border}`}>
                        <div className="flex items-start gap-3">
                            <span className="text-lg">{themeStyle.emoji}</span>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold ${themeStyle.color}`}>{title || 'Your title here'}</p>
                                <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1">{message || 'Your message will appear here.'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Send Button */}
                <button
                    onClick={handleSend}
                    disabled={isSending || !title.trim() || !message.trim()}
                    className="w-full px-4 py-3 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                    {isSending ? 'Sending broadcast...' : `Send Broadcast to ${TARGET_LABELS[target]}`}
                </button>

                {/* Cleanup Duplicates — removes duplicate broadcast notifications
                    from the DB (from before the dedup fix was deployed) */}
                <button
                    onClick={handleCleanupDuplicates}
                    className="w-full px-4 py-2.5 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors"
                >
                    Clean Up Duplicate Notifications
                </button>
                <p className="text-2xs text-slate-400 text-center -mt-2">
                    Removes duplicate broadcast notifications from the DB. Run once to fix existing duplicates from before the dedup fix.
                </p>

                {/* Broadcast History — shows past broadcasts sent from this console */}
                <div className={CARD}>
                    <p className={LABEL}>Broadcast History</p>
                    <div className="mt-3 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                        {broadcastHistory === undefined ? (
                            <div className="flex justify-center py-4">
                                <div className="w-6 h-6 border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
                            </div>
                        ) : broadcastHistory.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">No broadcasts sent yet.</p>
                        ) : (
                            broadcastHistory
                                .filter((e: any) => (e.event || '').startsWith('Broadcast sent:'))
                                .slice(0, 20)
                                .map((event: any, i: number) => (
                                    <div key={event._id || i} className="p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <p className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate">
                                                {(event.event || '').replace('Broadcast sent: ', '')}
                                            </p>
                                            <span className="text-2xs text-slate-400 flex-shrink-0 whitespace-nowrap">
                                                {event.timestamp ? new Date(event.timestamp).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                                            </span>
                                        </div>
                                        {event.properties && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {event.properties.targetProduct && (
                                                    <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                                                        {event.properties.targetProduct === 'all' ? 'All Apps' :
                                                         event.properties.targetProduct === 'unified' ? 'Komplete' :
                                                         event.properties.targetProduct === 'legal' ? 'Vega' :
                                                         event.properties.targetProduct === 'property' ? 'Atrium' :
                                                         event.properties.targetProduct}
                                                    </span>
                                                )}
                                                {event.properties.recipientCount !== undefined && (
                                                    <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                        {event.properties.recipientCount} recipients
                                                    </span>
                                                )}
                                                {event.properties.channel && (
                                                    <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-slate-200 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400">
                                                        {event.properties.channel === 'inapp' ? 'In-App' :
                                                         event.properties.channel === 'email' ? 'Email' : 'Both'}
                                                    </span>
                                                )}
                                                {event.properties.theme && (
                                                    <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                        {event.properties.theme}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
