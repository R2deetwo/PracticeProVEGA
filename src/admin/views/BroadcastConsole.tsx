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
    const cleanupDuplicates = useMutation(api.founderMetrics.cleanupDuplicateBroadcastNotifications);

    // Fetch broadcast history (admin action log filtered to broadcasts)
    const broadcastHistory = useQuery(api.founderMetrics.getAdminActionLog,
        tokenIdentifier ? { tokenIdentifier } : "skip");

    const handleCleanupDuplicates = async () => {
        try {
            const result = await cleanupDuplicates({ tokenIdentifier });
            if (result.deleted > 0) {
                addToast(`Cleaned up ${result.deleted} duplicate notification(s). Users will no longer see duplicates.`, { type: 'success' });
            } else {
                addToast('No duplicate notifications found. DB is clean.', { type: 'info' });
            }
        } catch (e: any) {
            addToast(e?.message || 'Failed to clean up duplicates.', { type: 'error' });
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
