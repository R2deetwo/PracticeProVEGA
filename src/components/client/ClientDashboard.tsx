import React, { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useDataActions } from '../../contexts/DataContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useFeatures } from '../../hooks/useFeatures';
import { Matter } from '../../types';
import {
    MattersIcon, PlusIcon, LockClosedIcon, DocumentIcon,
    ChatAltIcon, ClockIcon, CheckCircleIcon, BanknotesIcon,
    UploadIcon, SendIcon, ScalesIcon,
    ExclamationTriangleIcon, EyeIcon, ChevronRightIcon,
    LargeFolderIcon, UserCircleIcon
} from '../../constants';
import { timeAgo, getInitials } from '../../utils/colorUtils';

// ─── Stage Badge ────────────────────────────────────────────────────────
const StageBadge: React.FC<{ stage: string }> = ({ stage }) => {
    const s = stage?.toLowerCase() || '';
    let bg = 'bg-slate-100 text-slate-700 dark:bg-zinc-700 dark:text-zinc-300';
    if (s.includes('file') || s.includes('plead') || s.includes('initi')) {
        bg = 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    } else if (s.includes('discover') || s.includes('evid') || s.includes('research')) {
        bg = 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
    } else if (s.includes('trial') || s.includes('hear') || s.includes('argu')) {
        bg = 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
    } else if (s.includes('judg') || s.includes('conclu') || s.includes('final')) {
        bg = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    } else if (s.includes('appeal')) {
        bg = 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
    } else if (s.includes('settlem') || s.includes('negoti') || s.includes('medi')) {
        bg = 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400';
    } else if (s.includes('compli') || s.includes('exec') || s.includes('enforc')) {
        bg = 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
    }
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${bg}`}>
            {stage || 'Unknown'}
        </span>
    );
};

// ─── Summary Card ───────────────────────────────────────────────────────
const SummaryCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: number | string;
    accent?: string;
}> = ({ icon, label, value, accent = 'text-emerald-600 dark:text-emerald-400' }) => (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-5 flex items-start gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-50 dark:bg-emerald-900/20 ${accent}`}>
            {icon}
        </div>
        <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">{label}</p>
        </div>
    </div>
);

// ─── Tab Button ─────────────────────────────────────────────────────────
type PortalTab = 'overview' | 'matters' | 'documents' | 'messages';

const TabButton: React.FC<{
    label: string;
    tab: PortalTab;
    active: PortalTab;
    onClick: () => void;
    icon: React.ReactNode;
    badge?: number;
}> = ({ label, tab, active, onClick, icon, badge }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 whitespace-nowrap py-3 px-4 border-b-2 font-semibold text-sm transition-colors ${
            active === tab
                ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
        }`}
    >
        <span className="w-4 h-4">{icon}</span>
        {label}
        {badge !== undefined && badge > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full">
                {badge}
            </span>
        )}
    </button>
);

// ─── Empty State ────────────────────────────────────────────────────────
const EmptyState: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
    <div className="text-center py-12 px-6">
        <div className="w-14 h-14 mx-auto bg-slate-100 dark:bg-zinc-700 rounded-full flex items-center justify-center mb-4 text-slate-400 dark:text-zinc-500">
            {icon}
        </div>
        <h3 className="text-lg font-semibold text-slate-700 dark:text-zinc-200">{title}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">{description}</p>
    </div>
);

// ─── File Type Icon ─────────────────────────────────────────────────────
const FileTypeIcon: React.FC<{ source?: string; title?: string }> = ({ source, title }) => {
    const t = (title || '').toLowerCase();
    const s = source || '';
    let color = 'text-slate-500 dark:text-zinc-400';
    if (t.includes('.pdf') || s === 'upload') color = 'text-red-500 dark:text-red-400';
    else if (t.includes('.doc') || t.includes('.docx')) color = 'text-blue-500 dark:text-blue-400';
    else if (t.includes('.xls') || t.includes('.xlsx')) color = 'text-green-500 dark:text-green-400';
    else if (s === 'generated') color = 'text-violet-500 dark:text-violet-400';
    return <DocumentIcon className={`w-5 h-5 ${color}`} />;
};

// ─── Filter SVG Icon ───────────────────────────────────────────────────
const FilterSvgIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
);

// ─── Main Component ─────────────────────────────────────────────────────
const ClientDashboard: React.FC = () => {
    // ── ALL HOOKS CALLED FIRST (before any conditional returns) ──────────
    const { currentUser } = useAuth();
    const { matterState } = useMatterState();
    const { coreState } = useCoreState();
    const { navigateTo, openModal, addToast } = useUI();
    const { canUseClientPortal } = useFeatures();
    const { handleSendClientMessage } = useDataActions();

    const [activeTab, setActiveTab] = useState<PortalTab>('overview');
    const [docFilter, setDocFilter] = useState<string>('all');
    const [messageText, setMessageText] = useState('');
    const [selectedMatterForMessage, setSelectedMatterForMessage] = useState<string>('');
    const [isComposing, setIsComposing] = useState(false);

    // ── Data Derivation ──────────────────────────────────────────────────
    const clientContact = matterState.contacts.find(c => c.userId === currentUser?.id);
    const clientMatters = clientContact
        ? matterState.matters.filter(m => m.clientId === clientContact.id)
        : [];

    // Convex queries — always called, use "skip" when args not ready
    const portalQueryArgs = (clientContact?.id && currentUser?.firmId)
        ? { firmId: currentUser.firmId, contactId: clientContact.id }
        : 'skip';

    const clientDocs = useQuery(api.portals.getClientDocuments, portalQueryArgs);
    const clientMessages = useQuery(api.portals.getClientMessages, portalQueryArgs);
    const clientActivity = useQuery(api.portals.getClientActivity, portalQueryArgs);
    const clientInvoices = useQuery(api.portals.getClientInvoices, portalQueryArgs);

    // ── Access Control (after all hooks) ─────────────────────────────────
    if (!currentUser || currentUser.role !== 'Client') {
        return <div>Access Denied.</div>;
    }

    if (!canUseClientPortal) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="max-w-md bg-white dark:bg-zinc-900 p-10 rounded-3xl shadow-xl border border-slate-100 dark:border-zinc-800 flex flex-col items-center">
                    <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-6">
                        <LockClosedIcon className="w-8 h-8 text-amber-500" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">Portal Unavailable</h2>
                    <p className="text-slate-500 dark:text-zinc-400 leading-relaxed">
                        The Client Portal is not available on your firm's current plan. Please contact your firm administrator.
                    </p>
                </div>
            </div>
        );
    }

    // ── Computed Values ──────────────────────────────────────────────────
    const activeMattersCount = clientMatters.filter(m => m.status !== 'Closed' && m.status !== 'Archived').length;

    const pendingDocsCount = useMemo(() => {
        if (!clientDocs) return 0;
        return clientDocs.filter((d: any) =>
            d.isSharedWithClient && !d.isSignatureRequested && d.clientReviewStatus !== 'reviewed'
        ).length;
    }, [clientDocs]);

    const outstandingInvoicesCount = useMemo(() => {
        if (!clientInvoices) return 0;
        return clientInvoices.filter((inv: any) =>
            inv.status === 'Overdue' || inv.status === 'Unpaid' || inv.status === 'Sent'
        ).length;
    }, [clientInvoices]);

    const getUserName = (userId: string): string => {
        const user = coreState.users.find(u => u.id === userId);
        return user?.name || 'Unknown';
    };

    const getLawyerNames = (matter: Matter): string[] => {
        if (!matter.assignedUsers || matter.assignedUsers.length === 0) return [];
        return matter.assignedUsers.map(uid => getUserName(uid)).filter(n => n !== 'Unknown');
    };

    const getUpcomingDeadlines = (matterId: string): string[] => {
        const matter = clientMatters.find(m => m.id === matterId);
        const deadlines: string[] = [];
        if (matter?.nextAdjournedDate) {
            deadlines.push(`Adjourned: ${matter.nextAdjournedDate}`);
        }
        return deadlines;
    };

    const filteredDocs = useMemo(() => {
        if (!clientDocs) return [];
        if (docFilter === 'all') return clientDocs;
        return clientDocs.filter((d: any) => String(d.matterId) === docFilter);
    }, [clientDocs, docFilter]);

    const unreadMessagesCount = useMemo(() => {
        if (!clientMessages) return 0;
        return clientMessages.filter((m: any) => m.authorId !== currentUser.id && !m.isRead).length;
    }, [clientMessages, currentUser.id]);

    const sharedDocsCount = useMemo(() => {
        if (!clientDocs) return 0;
        return clientDocs.filter((d: any) => d.isSharedWithClient).length;
    }, [clientDocs]);

    // ── Handlers ─────────────────────────────────────────────────────────
    const handleUploadClick = () => {
        addToast('Upload coming soon', { type: 'info' });
    };

    const handleSendMessage = () => {
        if (!messageText.trim()) return;
        if (!selectedMatterForMessage) {
            addToast('Please select a matter first', { type: 'error' });
            return;
        }
        try {
            handleSendClientMessage(selectedMatterForMessage, messageText.trim());
            setMessageText('');
            setIsComposing(false);
            setSelectedMatterForMessage('');
            addToast('Message sent', { type: 'success' });
        } catch {
            addToast('Failed to send message', { type: 'error' });
        }
    };

    // ── Render: Overview Tab ─────────────────────────────────────────────
    const renderOverview = () => (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard
                    icon={<MattersIcon className="w-5 h-5" />}
                    label="Active Matters"
                    value={activeMattersCount}
                />
                <SummaryCard
                    icon={<DocumentIcon className="w-5 h-5" />}
                    label="Pending Documents"
                    value={pendingDocsCount}
                />
                <SummaryCard
                    icon={<BanknotesIcon className="w-5 h-5" />}
                    label="Outstanding Invoices"
                    value={outstandingInvoicesCount}
                    accent={outstandingInvoicesCount > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
                />
            </div>

            {/* Recent Activity */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-700">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Activity</h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-zinc-700 max-h-96 overflow-y-auto">
                    {clientActivity === undefined ? (
                        <div className="px-6 py-8 text-center">
                            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="mt-2 text-sm text-slate-500">Loading activity...</p>
                        </div>
                    ) : clientActivity.length === 0 ? (
                        <EmptyState
                            icon={<ClockIcon className="w-6 h-6" />}
                            title="No Recent Activity"
                            description="Activity related to your matters will appear here."
                        />
                    ) : (
                        clientActivity.slice(0, 5).map((activity: any) => (
                            <div key={String(activity._id)} className="px-6 py-3 flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                        {getInitials(activity.userName)}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-800 dark:text-zinc-200">
                                        <span className="font-semibold">{activity.userName}</span>{' '}
                                        {activity.action}
                                        {activity.targetName && (
                                            <> &middot; <span className="text-emerald-600 dark:text-emerald-400">{activity.targetName}</span></>
                                        )}
                                    </p>
                                    <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                                        {activity.timestamp ? timeAgo(activity.timestamp) : ''}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                    onClick={() => setActiveTab('matters')}
                    className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-5 text-left hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors group"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <ScalesIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            <span className="font-semibold text-slate-800 dark:text-zinc-200">View Matters</span>
                        </div>
                        <ChevronRightIcon className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2">
                        {clientMatters.length} matter{clientMatters.length !== 1 ? 's' : ''} in your portfolio
                    </p>
                </button>

                <button
                    onClick={() => setActiveTab('documents')}
                    className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-5 text-left hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors group"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <LargeFolderIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            <span className="font-semibold text-slate-800 dark:text-zinc-200">Documents</span>
                        </div>
                        <ChevronRightIcon className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2">
                        {sharedDocsCount} document{sharedDocsCount !== 1 ? 's' : ''} shared with you
                    </p>
                </button>

                <button
                    onClick={() => setActiveTab('messages')}
                    className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-5 text-left hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors group"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <ChatAltIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            <span className="font-semibold text-slate-800 dark:text-zinc-200">Messages</span>
                        </div>
                        <ChevronRightIcon className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2">
                        {unreadMessagesCount > 0
                            ? `${unreadMessagesCount} unread message${unreadMessagesCount !== 1 ? 's' : ''}`
                            : 'No unread messages'}
                    </p>
                </button>
            </div>
        </div>
    );

    // ── Render: Matters Tab ──────────────────────────────────────────────
    const renderMatters = () => {
        if (clientMatters.length === 0) {
            return (
                <EmptyState
                    icon={<MattersIcon className="w-7 h-7" />}
                    title="No Matters Found"
                    description="There are no matters currently associated with your account. Contact your firm if you believe this is an error."
                />
            );
        }

        return (
            <div className="space-y-4">
                {clientMatters.map(matter => {
                    const lawyerNames = getLawyerNames(matter);
                    const deadlines = getUpcomingDeadlines(matter.id);

                    return (
                        <div
                            key={matter.id}
                            onClick={() => navigateTo('matterDetail', matter.id)}
                            className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-5 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all group"
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate">
                                        {matter.title}
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                                        Suit No: {matter.suitNumber || 'N/A'}
                                        {matter.referenceNumber && ` \u00B7 Ref: ${matter.referenceNumber}`}
                                    </p>
                                </div>
                                <StageBadge stage={matter.stage || ''} />
                            </div>

                            {/* Details Row */}
                            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                                {lawyerNames.length > 0 && (
                                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-300">
                                        <UserCircleIcon className="w-4 h-4 text-slate-400" />
                                        <span>{lawyerNames.join(', ')}</span>
                                    </div>
                                )}
                                {deadlines.length > 0 && (
                                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                        <ClockIcon className="w-4 h-4" />
                                        <span>{deadlines[0]}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
                                    <ClockIcon className="w-4 h-4" />
                                    <span>Updated {timeAgo(matter.stageLastUpdated)}</span>
                                </div>
                            </div>

                            {/* Practice Area & Status */}
                            <div className="mt-3 flex items-center gap-2">
                                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300">
                                    {matter.type || 'General'}
                                </span>
                                {matter.status && (
                                    <span className={`text-xs px-2 py-0.5 rounded-md ${
                                        matter.status === 'Active'
                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                                            : matter.status === 'Closed'
                                                ? 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300'
                                                : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                                    }`}>
                                        {matter.status}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // ── Render: Documents Tab ────────────────────────────────────────────
    const renderDocuments = () => {
        const isLoading = clientDocs === undefined;
        const docs = filteredDocs || [];

        return (
            <div className="space-y-4">
                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <FilterSvgIcon className="w-4 h-4 text-slate-400" />
                            <select
                                value={docFilter}
                                onChange={(e) => setDocFilter(e.target.value)}
                                className="text-sm border border-slate-200 dark:border-zinc-600 rounded-lg px-3 py-1.5 bg-white dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                            >
                                <option value="all">All Matters</option>
                                {clientMatters.map(m => (
                                    <option key={m.id} value={m.id}>{m.title}</option>
                                ))}
                            </select>
                        </div>
                        <span className="text-sm text-slate-500 dark:text-zinc-400">
                            {docs.length} document{docs.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <button
                        onClick={handleUploadClick}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 text-sm transition-colors"
                    >
                        <UploadIcon className="w-4 h-4" />
                        Upload Document
                    </button>
                </div>

                {/* Document List */}
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-5 animate-pulse">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-zinc-700" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-3/4" />
                                        <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-1/2" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : docs.length === 0 ? (
                    <EmptyState
                        icon={<LargeFolderIcon className="w-7 h-7" />}
                        title="No Documents Shared With You Yet"
                        description="Documents related to your matters will appear here once your legal team shares them."
                    />
                ) : (
                    <div className="space-y-2">
                        {docs.map((doc: any) => (
                            <div
                                key={String(doc._id)}
                                className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 flex items-center gap-4 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors"
                            >
                                <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                                    <FileTypeIcon source={doc.source} title={doc.title} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                        {doc.title || 'Untitled Document'}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-zinc-400">
                                        {doc.matterTitle && (
                                            <span className="truncate max-w-[200px]">{doc.matterTitle}</span>
                                        )}
                                        {doc.dateFiled && (
                                            <>
                                                <span>&middot;</span>
                                                <span>{doc.dateFiled}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {doc.isSignatureRequested && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                            <ExclamationTriangleIcon className="w-3 h-3" />
                                            Signature Requested
                                        </span>
                                    )}
                                    {doc.clientReviewStatus === 'review_requested' && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                                            <EyeIcon className="w-3 h-3" />
                                            Review Requested
                                        </span>
                                    )}
                                    {doc.isSharedWithClient && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                            <CheckCircleIcon className="w-3 h-3" />
                                            Shared
                                        </span>
                                    )}
                                    {doc.source && (
                                        <span className="text-xs text-slate-400 dark:text-zinc-500 capitalize">
                                            {doc.source}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // ── Render: Messages Tab ─────────────────────────────────────────────
    const renderMessages = () => {
        const isLoading = clientMessages === undefined;
        const messages = clientMessages || [];

        return (
            <div className="space-y-4">
                {/* Compose Area */}
                <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700">
                    {!isComposing ? (
                        <div className="p-4">
                            <button
                                onClick={() => setIsComposing(true)}
                                className="w-full text-left px-4 py-3 rounded-lg bg-slate-50 dark:bg-zinc-700 text-slate-400 dark:text-zinc-500 text-sm hover:bg-slate-100 dark:hover:bg-zinc-600 transition-colors"
                            >
                                Send a message to your legal team...
                            </button>
                        </div>
                    ) : (
                        <div className="p-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <label className="text-sm font-medium text-slate-700 dark:text-zinc-300 flex-shrink-0">Matter:</label>
                                <select
                                    value={selectedMatterForMessage}
                                    onChange={(e) => setSelectedMatterForMessage(e.target.value)}
                                    className="flex-1 text-sm border border-slate-200 dark:border-zinc-600 rounded-lg px-3 py-1.5 bg-white dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                >
                                    <option value="">Select a matter...</option>
                                    {clientMatters.map(m => (
                                        <option key={m.id} value={m.id}>{m.title}</option>
                                    ))}
                                </select>
                            </div>
                            <textarea
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                                placeholder="Type your message here..."
                                rows={3}
                                className="w-full text-sm border border-slate-200 dark:border-zinc-600 rounded-lg px-4 py-3 bg-slate-50 dark:bg-zinc-700 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                            />
                            <div className="flex items-center justify-end gap-2">
                                <button
                                    onClick={() => { setIsComposing(false); setMessageText(''); setSelectedMatterForMessage(''); }}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-zinc-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!messageText.trim() || !selectedMatterForMessage}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <SendIcon className="w-4 h-4" />
                                    Send Message
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Messages List */}
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-5 animate-pulse">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-700" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-1/4" />
                                        <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-3/4" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : messages.length === 0 ? (
                    <EmptyState
                        icon={<ChatAltIcon className="w-7 h-7" />}
                        title="No Messages Yet"
                        description="Start a conversation with your legal team by sending a message above."
                    />
                ) : (
                    <div className="space-y-2">
                        {messages.map((msg: any) => {
                            const isCurrentUser = msg.authorId === currentUser.id;
                            const authorName = isCurrentUser
                                ? currentUser.name
                                : getUserName(msg.authorId);

                            return (
                                <div
                                    key={String(msg._id)}
                                    className={`bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 ${
                                        !msg.isRead && !isCurrentUser ? 'border-l-4 border-l-emerald-400' : ''
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                                            isCurrentUser
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                : 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300'
                                        }`}>
                                            {getInitials(authorName)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-sm text-slate-900 dark:text-white">
                                                    {authorName}
                                                </span>
                                                {msg.matterTitle && (
                                                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400">
                                                        {msg.matterTitle}
                                                    </span>
                                                )}
                                                {!msg.isRead && !isCurrentUser && (
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                                )}
                                            </div>
                                            <p className="mt-1 text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
                                                {msg.content}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">
                                                {msg.timestamp ? timeAgo(msg.timestamp) : ''}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    // ── Main Render ──────────────────────────────────────────────────────
    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview': return renderOverview();
            case 'matters': return renderMatters();
            case 'documents': return renderDocuments();
            case 'messages': return renderMessages();
        }
    };

    return (
        <div className="min-h-full">
            {/* Header */}
            <div className="mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                            Welcome, {currentUser.name?.split(' ')[0] || 'Client'}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                            Your legal matters portal &mdash; stay informed and connected
                        </p>
                    </div>
                    <button
                        onClick={() => openModal('newLead', null, { name: currentUser.name, email: currentUser.email, isClientRequest: true })}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 text-sm transition-colors shadow-sm flex-shrink-0"
                    >
                        <PlusIcon className="w-4 h-4" />
                        Request Another Service
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="mb-6 border-b border-slate-200 dark:border-zinc-700 overflow-x-auto">
                <nav className="-mb-px flex space-x-1 sm:space-x-4">
                    <TabButton
                        label="Overview"
                        tab="overview"
                        active={activeTab}
                        onClick={() => setActiveTab('overview')}
                        icon={<ScalesIcon className="w-4 h-4" />}
                    />
                    <TabButton
                        label="Matters"
                        tab="matters"
                        active={activeTab}
                        onClick={() => setActiveTab('matters')}
                        icon={<MattersIcon className="w-4 h-4" />}
                        badge={clientMatters.length}
                    />
                    <TabButton
                        label="Documents"
                        tab="documents"
                        active={activeTab}
                        onClick={() => setActiveTab('documents')}
                        icon={<DocumentIcon className="w-4 h-4" />}
                        badge={sharedDocsCount}
                    />
                    <TabButton
                        label="Messages"
                        tab="messages"
                        active={activeTab}
                        onClick={() => setActiveTab('messages')}
                        icon={<ChatAltIcon className="w-4 h-4" />}
                        badge={unreadMessagesCount}
                    />
                </nav>
            </div>

            {/* Tab Content */}
            {renderTabContent()}
        </div>
    );
};

export default ClientDashboard;
