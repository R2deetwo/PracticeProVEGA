/**
 * FeedbackInbox — founder dashboard view showing all user feedback.
 *
 * CATEGORIZED VIEW — feedback is organized into category tabs:
 *   All Conversations | Product Feedback | Technical Issues | General Queries | Account & Billing
 *
 * Each category maps to feedback types:
 *   - Product Feedback: Feature Requests, Suggestions, General Feedback
 *   - Technical Issues: Bug Reports, Maintenance, Technical
 *   - General Queries: Support Tickets, General
 *   - Account & Billing: Billing, Account, Data Restoration
 *
 * Status tabs (New, Replied, Resolved, Archived) now work via the
 * updateFeedbackStatus mutation.
 */

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useFounderAuth, useFounderToast } from '../FounderContexts';

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm';

type CategoryFilter = 'all' | 'product_feedback' | 'technical' | 'general' | 'billing';
type StatusFilter = 'all' | 'New' | 'Replied' | 'Resolved' | 'Archived';

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
    all: 'All Conversations',
    product_feedback: 'Product Feedback',
    technical: 'Technical Issues',
    general: 'General Queries',
    billing: 'Account & Billing',
};

export const FeedbackInbox: React.FC = () => {
    const { addToast } = useFounderToast();
    const { currentUser } = useFounderAuth();
    const tokenIdentifier = currentUser?.email || currentUser?.tokenIdentifier || '';
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');

    const feedback = useQuery(api.feedback.getFeedbackList,
        statusFilter === 'all'
            ? { category: categoryFilter }
            : { status: statusFilter, category: categoryFilter });

    const adminReply = useMutation(api.feedback.adminReplyToFeedback);
    const updateStatus = useMutation(api.feedback.updateFeedbackStatus);
    const logAdminAction = useMutation(api.founderMetrics.logAdminAction);

    const isLoading = feedback === undefined;
    const filtered = feedback || [];
    const selected = selectedId ? filtered.find((f: any) => f._id === selectedId) : null;

    const handleReply = async () => {
        if (!selected || !replyText.trim()) return;
        try {
            await adminReply({
                feedbackId: selected._id,
                adminId: currentUser?.email || 'founder',
                message: replyText.trim(),
            });
            try {
                await logAdminAction({
                    tokenIdentifier,
                    action: 'ADMIN ACTION: Replied to feedback',
                    targetFirmId: selected.firmId || undefined,
                    details: `Reply to "${selected.title || 'Untitled'}" from ${selected.userName || selected.userEmail || 'unknown'}`,
                });
            } catch {}
            addToast('Reply sent. User will see it in their inbox and get an email.', { type: 'success' });
            setReplyText('');
        } catch (e: any) {
            addToast(e?.message || 'Failed to send reply.', { type: 'error' });
        }
    };

    const handleStatusChange = async (newStatus: 'Resolved' | 'Archived' | 'New') => {
        if (!selected) return;
        try {
            await updateStatus({ feedbackId: selected._id, status: newStatus });
            addToast(`Marked as ${newStatus}`, { type: 'success' });
        } catch (e: any) {
            addToast(e?.message || 'Failed to update status.', { type: 'error' });
        }
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20 overflow-x-hidden">
            {/* Header */}
            <div style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
            className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6">
                <div className="flex flex-col gap-3">
                    <div>
                        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Feedback Inbox</h2>
                        <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{isLoading ? 'Loading...' : `${filtered.length} feedback items`}</p>
                    </div>
                    {/* Category tabs — primary organization */}
                    <div className="flex gap-1 bg-slate-100 dark:bg-zinc-800 rounded-lg p-1 overflow-x-auto no-scrollbar">
                        {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map(cat => (
                            <button
                                key={cat}
                                onClick={() => setCategoryFilter(cat)}
                                className={`px-3 py-1.5 rounded-md text-2xs font-bold transition-colors whitespace-nowrap flex-shrink-0 ${
                                    categoryFilter === cat ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-zinc-400'
                                }`}
                            >
                                {CATEGORY_LABELS[cat]}
                            </button>
                        ))}
                    </div>
                    {/* Status filter tabs — secondary filter */}
                    <div className="flex gap-1 overflow-x-auto no-scrollbar">
                        {(['all', 'New', 'Replied', 'Resolved', 'Archived'] as StatusFilter[]).map(f => (
                            <button
                                key={f}
                                onClick={() => setStatusFilter(f)}
                                className={`px-2.5 py-1 rounded-md text-3xs font-bold transition-colors whitespace-nowrap flex-shrink-0 border ${
                                    statusFilter === f
                                        ? 'bg-primary-600 text-white border-primary-600'
                                        : 'bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:border-primary-300'
                                }`}
                            >
                                {f === 'all' ? 'All Status' : f}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="px-4 sm:px-6 lg:px-8">
                {isLoading ? (
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm p-12 text-center">
                        <div className="w-8 h-8 mx-auto border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
                        <p className="text-sm text-slate-400 mt-3">Loading feedback...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm p-12 text-center">
                        <p className="text-sm text-slate-400">No feedback in this category. When users submit feedback, it will appear here.</p>
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
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${
                                                item.status === 'New' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                item.status === 'Replied' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                item.status === 'Resolved' ? 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400' :
                                                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                            }`}>{item.status || 'New'}</span>
                                            <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400">{item.type || 'General'}</span>
                                            {/* Auto-reply indicator */}
                                            {item.replies?.some((r: any) => r.adminId === 'system_auto_reply') && (
                                                <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" title="Auto-reply sent">Auto</span>
                                            )}
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
                                <div className="min-w-0">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">{selected.title || 'Untitled'}</h3>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400">{selected.userName || selected.userEmail}</p>
                                </div>
                                <button onClick={() => setSelectedId(null)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-700 flex-shrink-0">
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
                                        <p className="text-2xs font-bold text-slate-400 uppercase tracking-widest mb-1">Conversation History</p>
                                        {selected.replies.map((r: any, i: number) => (
                                            <div key={i} className={`p-2 rounded-lg mb-2 ${r.adminId === 'system_auto_reply' ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900/30' : 'bg-slate-50 dark:bg-zinc-900'}`}>
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    {r.adminId === 'system_auto_reply' && (
                                                        <span className="text-3xs font-bold text-purple-600 dark:text-purple-400 uppercase">Auto-Reply</span>
                                                    )}
                                                    {r.adminId !== 'system_auto_reply' && (
                                                        <span className="text-3xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Founder</span>
                                                    )}
                                                </div>
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
                                        Send Reply (In-App + Email Notification)
                                    </button>
                                </div>
                                {/* Status actions */}
                                <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-zinc-700">
                                    {selected.status !== 'Resolved' && (
                                        <button
                                            onClick={() => handleStatusChange('Resolved')}
                                            className="flex-1 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 rounded-lg transition-colors"
                                        >
                                            Mark Resolved
                                        </button>
                                    )}
                                    {selected.status !== 'Archived' && (
                                        <button
                                            onClick={() => handleStatusChange('Archived')}
                                            className="flex-1 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 rounded-lg transition-colors"
                                        >
                                            Archive
                                        </button>
                                    )}
                                    {selected.status !== 'New' && (
                                        <button
                                            onClick={() => handleStatusChange('New')}
                                            className="flex-1 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                        >
                                            Reopen
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
