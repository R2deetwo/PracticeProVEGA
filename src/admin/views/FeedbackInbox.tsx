/**
 * FeedbackInbox — founder dashboard view showing all user feedback.
 *
 * Uses the existing getFeedbackList query and adminReplyToFeedback mutation.
 * Supports filtering by status and product origin, and allows the founder
 * to reply directly to feedback.
 */

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useUI } from '../../contexts/UIContext';

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm';

export const FeedbackInbox: React.FC = () => {
    const { addToast } = useUI();
    const [filter, setFilter] = useState<'all' | 'New' | 'Replied' | 'Resolved' | 'Archived'>('all');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');

    const feedback = useQuery(api.feedback.getFeedbackList,
        filter === 'all' ? {} : { status: filter });

    const adminReply = useMutation(api.feedback.adminReplyToFeedback);

    const filtered = feedback || [];
    const selected = selectedId ? filtered.find((f: any) => f._id === selectedId) : null;

    const handleReply = async () => {
        if (!selected || !replyText.trim()) return;
        try {
            await adminReply({
                feedbackId: selected._id,
                adminId: 'founder',
                message: replyText.trim(),
            });
            addToast('Reply sent. User will see it in their inbox.', { type: 'success' });
            setReplyText('');
        } catch (e: any) {
            addToast(e?.message || 'Failed to send reply.', { type: 'error' });
        }
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            {/* Header */}
            <div className="sticky top-0 pt-safe z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Feedback Inbox</h2>
                        <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{filtered.length} feedback items</p>
                    </div>
                    <div className="flex gap-1 bg-slate-100 dark:bg-zinc-800 rounded-lg p-1">
                        {(['all', 'New', 'Replied', 'Resolved', 'Archived'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1 rounded-md text-2xs font-bold transition-colors ${
                                    filter === f ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400'
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="px-4 sm:px-6 lg:px-8">
                {filtered.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm p-12 text-center">
                        <p className="text-sm text-slate-400">No feedback yet. When users submit feedback from the client apps, it will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((item: any) => (
                            <div
                                key={item._id}
                                className={CARD}
                                onClick={() => setSelectedId(item._id)}
                            >
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${
                                                item.status === 'New' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                item.status === 'Replied' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                item.status === 'Resolved' ? 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400' :
                                                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                            }`}>{item.status || 'New'}</span>
                                            <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400">{item.type || 'General'}</span>
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.title || 'Untitled'}</h3>
                                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                            From: {item.userName || item.userEmail || 'Unknown'} · {item.timestamp ? new Date(item.timestamp).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-zinc-300 line-clamp-2">{item.message}</p>
                                {item.adminReply && (
                                    <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                                        <p className="text-2xs font-bold text-emerald-700 dark:text-emerald-400 mb-0.5">FOUNDER REPLY:</p>
                                        <p className="text-xs text-slate-600 dark:text-zinc-300">{item.adminReply}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Reply Drawer */}
                {selected && (
                    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center" onClick={() => setSelectedId(null)}>
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                        <div
                            className="relative bg-white dark:bg-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-700 w-full sm:max-w-lg max-h-[80vh] overflow-y-auto custom-scrollbar"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="sticky top-0 bg-white dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700 p-4 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selected.title || 'Untitled'}</h3>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400">{selected.userName || selected.userEmail}</p>
                                </div>
                                <button onClick={() => setSelectedId(null)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-700">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="p-4 space-y-4">
                                <div>
                                    <p className="text-2xs font-bold text-slate-400 uppercase tracking-widest mb-1">Feedback</p>
                                    <p className="text-sm text-slate-700 dark:text-zinc-200 whitespace-pre-wrap">{selected.message}</p>
                                </div>
                                {selected.replies && selected.replies.length > 0 && (
                                    <div>
                                        <p className="text-2xs font-bold text-slate-400 uppercase tracking-widest mb-1">Previous Replies</p>
                                        {selected.replies.map((r: any, i: number) => (
                                            <div key={i} className="p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg mb-2">
                                                <p className="text-xs text-slate-600 dark:text-zinc-300">{r.message}</p>
                                                <p className="text-2xs text-slate-400 mt-0.5">{r.timestamp ? new Date(r.timestamp).toLocaleString('en-GB') : ''}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div>
                                    <p className="text-2xs font-bold text-slate-400 uppercase tracking-widest mb-1">Your Reply</p>
                                    <textarea
                                        value={replyText}
                                        onChange={e => setReplyText(e.target.value)}
                                        placeholder="Type your response..."
                                        rows={4}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 resize-none"
                                    />
                                    <button
                                        onClick={handleReply}
                                        disabled={!replyText.trim()}
                                        className="mt-2 w-full px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700 transition-colors disabled:opacity-50"
                                    >
                                        Send Reply (In-App Notification)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
