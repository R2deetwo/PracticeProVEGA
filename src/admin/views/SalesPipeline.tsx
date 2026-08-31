/**
 * SalesPipeline — Founder App view for sales lead management.
 *
 * Shows all sales inquiries submitted via the Contact Sales drawer on
 * the public landing page. Leads are categorized by status:
 *   Unread → Contacted → Qualified → Converted → Closed
 *
 * Features:
 * - Amber/gold badge accent for high-priority sales leads
 * - Structured preview: "New Sales Lead: [Company] — Interested in [Product]"
 * - Badge count dynamically increments when a new lead arrives
 * - Marking a lead as "contacted" decrements the unread badge
 * - Filterable by status
 */
import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useFounderAuth, useFounderToast } from '../FounderContexts';

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm';

const STATUS_COLORS: Record<string, string> = {
    unread: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    contacted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    qualified: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    converted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    closed: 'bg-slate-100 text-slate-500 dark:bg-zinc-700 dark:text-zinc-400',
    spam: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

const PRODUCT_BADGE: Record<string, string> = {
    Vega: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Atrium: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    Komplete: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
};

export const SalesPipeline: React.FC = () => {
    const { currentUser } = useFounderAuth();
    const { addToast } = useFounderToast();
    const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const inquiries = useQuery(api.salesInquiries.listSalesInquiries,
        statusFilter ? { status: statusFilter as any } : {});
    const unreadCount = useQuery(api.salesInquiries.getUnreadSalesInquiryCount, {});
    const updateStatus = useMutation(api.salesInquiries.updateInquiryStatus);

    const handleStatusChange = async (inquiryId: string, newStatus: string) => {
        try {
            await updateStatus({ inquiryId: inquiryId as any, status: newStatus as any });
            addToast(`Lead marked as ${newStatus}.`, { type: 'success' });
        } catch (e: any) {
            addToast(e?.message || 'Failed to update lead status.', { type: 'error' });
        }
    };

    const isLoading = inquiries === undefined;
    const safeInquiries = inquiries || [];

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            {/* Header */}
            <div style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
                className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Sales Pipeline</h2>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                            Inbound sales leads from the Contact Sales form
                        </p>
                    </div>
                    {/* Unread badge */}
                    {unreadCount && unreadCount > 0 ? (
                        <span className="px-3 py-1.5 bg-amber-500 text-white text-sm font-black rounded-full shadow-lg flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 1l2.928 6.327L20 8.18l-5 4.876L16.18 20 10 16.586 3.82 20 5 13.056 0 8.18l7.072-.853L10 1z"/></svg>
                            {unreadCount} New
                        </span>
                    ) : null}
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Status Filter Pills */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                    {[
                        { id: undefined, label: 'All' },
                        { id: 'unread', label: 'Unread' },
                        { id: 'contacted', label: 'Contacted' },
                        { id: 'qualified', label: 'Qualified' },
                        { id: 'converted', label: 'Converted' },
                        { id: 'closed', label: 'Closed' },
                    ].map(filter => (
                        <button
                            key={filter.label}
                            onClick={() => setStatusFilter(filter.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                                statusFilter === filter.id
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700'
                            }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>

                {/* Loading */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-6 h-6 border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
                    </div>
                ) : safeInquiries.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-sm text-slate-400 dark:text-zinc-500">No sales inquiries yet.</p>
                    </div>
                ) : (
                    /* Lead List */
                    <div className="space-y-2">
                        {safeInquiries.map((inquiry: any) => (
                            <div
                                key={inquiry._id}
                                className={`border rounded-lg overflow-hidden transition-all ${
                                    inquiry.status === 'unread'
                                        ? 'border-amber-300 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-900/10'
                                        : 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800'
                                }`}
                            >
                                {/* Lead Row */}
                                <button
                                    onClick={() => setExpandedId(expandedId === String(inquiry._id) ? null : String(inquiry._id))}
                                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-zinc-700/30 transition-colors text-left"
                                >
                                    {/* Amber dot for unread */}
                                    {inquiry.status === 'unread' && (
                                        <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 animate-pulse" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                                {inquiry.name}
                                            </p>
                                            {inquiry.companyName && (
                                                <span className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                                                    {inquiry.companyName}
                                                </span>
                                            )}
                                            {inquiry.productInterest && (
                                                <span className={`text-2xs font-bold px-1.5 py-0.5 rounded uppercase ${PRODUCT_BADGE[inquiry.productInterest] || 'bg-slate-100 text-slate-500'}`}>
                                                    {inquiry.productInterest}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                                            {inquiry.message.substring(0, 80)}{inquiry.message.length > 80 ? '...' : ''}
                                        </p>
                                    </div>
                                    <span className={`text-2xs font-bold px-2 py-0.5 rounded-full uppercase flex-shrink-0 ${STATUS_COLORS[inquiry.status] || STATUS_COLORS.unread}`}>
                                        {inquiry.status}
                                    </span>
                                    <svg className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${expandedId === String(inquiry._id) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {/* Expanded Detail */}
                                {expandedId === String(inquiry._id) && (
                                    <div className="px-3 pb-3 border-t border-slate-100 dark:border-zinc-700/50 pt-3 bg-slate-50 dark:bg-zinc-800/50">
                                        <div className="space-y-2 mb-3">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-500 dark:text-zinc-400 font-bold">Email</span>
                                                <a href={`mailto:${inquiry.email}`} className="text-primary-600 dark:text-primary-400 font-medium underline">{inquiry.email}</a>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-500 dark:text-zinc-400 font-bold">Source</span>
                                                <span className="text-slate-600 dark:text-zinc-300">{inquiry.source || 'landing_page'}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-500 dark:text-zinc-400 font-bold">Submitted</span>
                                                <span className="text-slate-600 dark:text-zinc-300">{new Date(inquiry.createdAt).toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 mb-3">
                                            <p className="text-xs text-slate-600 dark:text-zinc-400 whitespace-pre-wrap">{inquiry.message}</p>
                                        </div>
                                        {/* Status Actions */}
                                        <div className="flex gap-2 flex-wrap">
                                            {inquiry.status === 'unread' && (
                                                <button onClick={() => handleStatusChange(String(inquiry._id), 'contacted')} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors">
                                                    Mark Contacted
                                                </button>
                                            )}
                                            {inquiry.status === 'contacted' && (
                                                <button onClick={() => handleStatusChange(String(inquiry._id), 'qualified')} className="px-3 py-1.5 bg-violet-600 text-white text-xs font-bold rounded-lg hover:bg-violet-700 transition-colors">
                                                    Mark Qualified
                                                </button>
                                            )}
                                            {inquiry.status === 'qualified' && (
                                                <button onClick={() => handleStatusChange(String(inquiry._id), 'converted')} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors">
                                                    Mark Converted
                                                </button>
                                            )}
                                            {(inquiry.status !== 'closed' && inquiry.status !== 'spam') && (
                                                <>
                                                    <button onClick={() => handleStatusChange(String(inquiry._id), 'closed')} className="px-3 py-1.5 bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-bold rounded-lg hover:bg-slate-300 dark:hover:bg-zinc-600 transition-colors">
                                                        Close
                                                    </button>
                                                    <button onClick={() => handleStatusChange(String(inquiry._id), 'spam')} className="px-3 py-1.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-lg hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors">
                                                        Spam
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
