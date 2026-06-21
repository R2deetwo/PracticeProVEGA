import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useDataActions } from '../../contexts/DataContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useFeatures } from '../../hooks/useFeatures';
import { useProduct } from '../../contexts/ProductContext';
import {
    MattersIcon, PlusIcon, LockClosedIcon, DocumentIcon,
    ChatAltIcon, ClockIcon, CheckCircleIcon,
    UploadIcon, SendIcon, ScalesIcon,
    ExclamationTriangleIcon, EyeIcon, ChevronRightIcon,
    LargeFolderIcon, UserCircleIcon, ClipboardListIcon
} from '../../constants';
import { Receipt } from 'lucide-react';
import { timeAgo, getInitials } from '../../utils/colorUtils';

// ─── Local Icons ──────────────────────────────────────────────────────────────
const SunIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
);

const MoonIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
);

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

// ─── Summary Card (Premium) ────────────────────────────────────────────
// Redesigned: borderless, soft shadow, tinted icon background, larger
// rounding (rounded-2xl). Matches the premium portal aesthetic.
const SummaryCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: number | string;
    accent?: string;
}> = ({ icon, label, value, accent = 'text-brand-primary' }) => (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-soft p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-brand-primary/10 ${accent}`}>
            {icon}
        </div>
        <div>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
            <p className="text-[10px] sm:text-xs text-slate-400 dark:text-zinc-500 mt-0.5 font-medium uppercase tracking-wide">{label}</p>
        </div>
    </div>
);

// ─── Tab Button ─────────────────────────────────────────────────────────
type PortalTab = 'overview' | 'matters' | 'documents' | 'messages' | 'requests';

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
        className={`flex items-center gap-1.5 sm:gap-2 whitespace-nowrap py-3 px-2 sm:px-4 border-b-2 font-semibold text-xs sm:text-sm transition-colors ${
            active === tab
                ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
        }`}
    >
        <span className="w-4 h-4">{icon}</span>
        <span className="hidden sm:inline">{label}</span>
        {badge !== undefined && badge > 0 && (
            <span className="ml-0.5 sm:ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full">
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
    const { currentUser, isImpersonating, revertToOriginalUser, logout } = useAuth();
    const { coreState } = useCoreState();
    const { navigateTo, openModal, addToast, theme, setTheme } = useUI();
    const { canUseClientPortal } = useFeatures();
    const { handleSendClientMessage } = useDataActions();
    const { isProperty } = useProduct();

    // ─── Force light mode for portal users ──────────────────────────────
    // Portal users should always see light mode for maximum readability.
    // The theme toggle is still available if they want to switch.
    React.useEffect(() => {
        // Only force light on first load — don't override user's explicit choice
        const hasUserSetTheme = localStorage.getItem('practicepro_theme');
        if (!hasUserSetTheme) {
            setTheme('light');
        }
    }, [setTheme]);

    // Repair mutation for fixing missing firmId on portal user records
    const repairFirmId = useMutation(api.portals.repairPortalUserFirmId);
    const sendPortalMessage = useMutation(api.portals.sendPortalMessage);
    const [isRepairing, setIsRepairing] = useState(false);

    const [activeTab, setActiveTab] = useState<PortalTab>(() => {
        const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
        if (['overview', 'matters', 'documents', 'messages', 'requests'].includes(hash)) return hash as PortalTab;
        return 'overview';
    });
    const handleTabChange = (tab: PortalTab) => {
        setActiveTab(tab);
        window.location.hash = tab;
    };
    const [docFilter, setDocFilter] = useState<string>('all');
    const [messageText, setMessageText] = useState('');
    const [selectedMatterForMessage, setSelectedMatterForMessage] = useState<string>('');
    const [isComposing, setIsComposing] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<{ file: File; name: string }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const isDark = theme === 'dark' || theme === 'midnight' || theme === 'oled' ||
        theme === 'neon-cyber' || theme === 'midnight-emerald' || theme === 'army-dark' ||
        (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const toggleTheme = () => {
        setTheme(isDark ? 'light' : 'dark');
    };

    // ── Data Derivation via direct Convex queries ──────────────────────────
    // Portal users don't have matterState (DataProvider skips firm data),
    // so we use dedicated portal queries that look up the contact by userId.

    // Fallback: if firmId is missing, try to resolve it from invite records
    const firmResolution = useQuery(
        api.portals.resolveFirmFromInvite,
        !currentUser?.firmId && currentUser?.email ? { email: currentUser.email } : 'skip'
    );
    const effectiveFirmId = currentUser?.firmId || firmResolution?.firmId || '';

    // 1. Look up the client's contact record by userId
    const clientContactResult = useQuery(
        api.portals.getClientContactByUserId,
        (currentUser?.id && effectiveFirmId)
            ? { firmId: effectiveFirmId, userId: currentUser.id }
            : 'skip'
    );

    // 2. Get the client's matters directly from Convex
    const clientMattersResult = useQuery(
        api.portals.getClientMattersByUserId,
        (currentUser?.id && effectiveFirmId)
            ? { firmId: effectiveFirmId, userId: currentUser.id }
            : 'skip'
    );

    // Derive contactId for the other portal queries
    const clientContactId = clientContactResult?._id ? String(clientContactResult._id) : null;

    // Convex queries — always called, use "skip" when args not ready
    const portalQueryArgs = (clientContactId && effectiveFirmId)
        ? { firmId: effectiveFirmId, contactId: clientContactId }
        : 'skip';

    const clientDocs = useQuery(api.portals.getClientDocuments, portalQueryArgs);
    const clientMessages = useQuery(api.portals.getClientMessages, portalQueryArgs);
    const clientActivity = useQuery(api.portals.getClientActivity, portalQueryArgs);
    const clientInvoices = useQuery(api.portals.getClientInvoices, portalQueryArgs);
    const clientConsentRecords = useQuery(
        api.portals.getClientConsentRecords,
        currentUser?.email ? { email: currentUser.email } : 'skip'
    );
    // Conversation-based portal messages (new system)
    const portalConversations = useQuery(
        api.portals.getPortalConversationsByParticipant,
        currentUser?.id ? { participantId: currentUser.id } : 'skip'
    );
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const conversationMessages = useQuery(
        api.portals.getConversationMessages,
        activeConversationId ? { conversationId: activeConversationId } : 'skip'
    );
    const markRead = useMutation(api.portals.markConversationReadByParticipant);
    const generateUploadUrl = useMutation(api.myFunctions.generateUploadUrl);

    // Use the Convex-queried matters (not matterState which is empty for portal users)
    const clientMattersLoading = clientMattersResult === undefined && !!effectiveFirmId;
    const clientMatters = (clientMattersResult || []) as any[];

    // ── Access Control (after all hooks) ─────────────────────────────────
    if (!currentUser || currentUser.role !== 'Client') {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="max-w-md bg-white dark:bg-zinc-900 p-10 rounded-3xl shadow-xl border border-slate-100 dark:border-zinc-800 flex flex-col items-center">
                    <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
                        <LockClosedIcon className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">Access Denied</h2>
                    <p className="text-slate-500 dark:text-zinc-400 leading-relaxed">
                        You do not have permission to access this portal. If you believe this is an error, please contact your firm administrator.
                    </p>
                </div>
            </div>
        );
    }

    // CRITICAL: If firmId can't be resolved, show a repair UI instead of infinite skeletons.
    // This happens when the user's firmId was cleared (e.g. during portal access revocation)
    // AND no invite records exist to resolve it from.
    if (!effectiveFirmId && firmResolution !== undefined) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-zinc-950 p-6">
                <div className="text-center max-w-sm">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mb-4">
                        <ExclamationTriangleIcon className="w-8 h-8 text-rose-500" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Portal Data Unavailable</h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
                        We couldn't load your portal data. Your account may need to be re-linked to your firm.
                    </p>
                    <button
                        onClick={async () => {
                            setIsRepairing(true);
                            try {
                                const result = await repairFirmId({ email: currentUser.email });
                                if (result.success) {
                                    addToast('Account repaired! Refreshing...', { type: 'success' });
                                    setTimeout(() => window.location.reload(), 1500);
                                } else {
                                    addToast('Could not auto-repair. Please contact your firm administrator.', { type: 'error' });
                                }
                            } catch {
                                addToast('Repair failed. Please contact your firm administrator.', { type: 'error' });
                            } finally {
                                setIsRepairing(false);
                            }
                        }}
                        disabled={isRepairing}
                        className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isRepairing ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Repairing...
                            </span>
                        ) : (
                            'Repair My Account'
                        )}
                    </button>
                    <button
                        onClick={() => logout()}
                        className="mt-3 block mx-auto text-sm text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        );
    }

    // SAFETY NET: Portal users with a valid Client role should ALWAYS be able
    // to access their portal. The canUseClientPortal feature gate is meant to
    // control whether ADMINS can create portal invites — it should never block
    // an already-authenticated portal user from accessing their own dashboard.
    // If the firm data hasn't loaded yet, we skip the gate entirely rather than
    // showing a misleading "Portal Unavailable" screen.
    // Only show the upgrade prompt if the user is NOT a Client role (e.g. admin previewing).
    if (!canUseClientPortal && currentUser.role !== 'Client') {
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

    const getUserName = (userId: string, fallbackName?: string): string => {
        if (fallbackName) return fallbackName;
        const user = coreState.users?.find(u => u.id === userId);
        return user?.name || coreState.firmDetails?.name || (isProperty ? 'Your Property Team' : 'Your Legal Team');
    };

    const getLawyerNames = (matter: any): string[] => {
        if (!matter.assignedUsers || matter.assignedUsers.length === 0) return [];
        return matter.assignedUsers.map((uid: string) => getUserName(uid)).filter((n: string) => n !== (isProperty ? 'Your Property Team' : 'Your Legal Team'));
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

    // ── Service Requests data ────────────────────────────────────────────
    // Fetch admin-configured service request types (defaults returned by
    // backend if firm hasn't configured any yet).
    const clientRequestTypes = useQuery(
        api.portals.getServiceRequestTypes,
        effectiveFirmId ? { firmId: effectiveFirmId, portalType: 'client' as const } : 'skip'
    );
    // Fetch this client's previously submitted requests (history)
    const clientServiceRequests = useQuery(
        api.portals.getClientServiceRequestsByClient,
        currentUser?.id ? { clientId: currentUser.id } : 'skip'
    );
    const createClientServiceRequest = useMutation(api.portals.createClientServiceRequest);

    const openRequestsCount = useMemo(() => {
        if (!clientServiceRequests) return 0;
        return clientServiceRequests.filter((r: any) => r.status === 'open' || r.status === 'in_progress').length;
    }, [clientServiceRequests]);

    // ── Handlers ─────────────────────────────────────────────────────────
    const handleUploadClick = () => {
        // Upload functionality not yet available for portal users.
        // The upload button is hidden from the UI (see Coming Soon badge removal below).
    };

    const handleSendMessage = async () => {
        if (!messageText.trim() && pendingFiles.length === 0) return;
        if (!selectedMatterForMessage) {
            addToast('Please select a matter first', { type: 'error' });
            return;
        }
        try {
            // Upload files first
            const storageIds: string[] = [];
            const fileNames: string[] = [];
            for (const { file, name } of pendingFiles) {
                try {
                    const postUrl = await generateUploadUrl();
                    const res = await fetch(postUrl, { method: 'POST', body: file });
                    if (res.ok) {
                        const { storageId } = await res.json();
                        if (storageId) { storageIds.push(storageId); fileNames.push(name); }
                    }
                } catch {}
            }
            // Use the new conversation-based sendPortalMessage
            await sendPortalMessage({
                firmId: effectiveFirmId,
                senderId: currentUser.id,
                senderName: currentUser.name,
                senderEmail: currentUser.email,
                senderRole: 'Client',
                content: messageText.trim(),
                matterId: selectedMatterForMessage,
                attachments: storageIds.length > 0 ? storageIds : undefined,
                attachmentNames: fileNames.length > 0 ? fileNames : undefined,
                // THREADING FIX: Pass the active conversation ID to continue in same thread
                conversationId: activeConversationId || undefined,
            });
            setMessageText('');
            setPendingFiles([]);
            setIsComposing(false);
            setSelectedMatterForMessage('');
            addToast('Message sent', { type: 'success' });
        } catch (err: any) {
            addToast(err.message || 'Failed to send message', { type: 'error' });
        }
    };

    // ── Render: Overview Tab (Premium Layout) ───────────────────────────
    // Architecture: Hero Card → Quick Service Grid → Bottom Sheet with activity
    const renderOverview = () => (
        <div className="space-y-0">
            {/* ─── Hero Card (full-width, brand-colored) ─────────────────── */}
            <div className="bg-brand-primary text-white rounded-premium p-6 mx-0 sm:mx-4 shadow-premium">
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">
                    {isProperty ? 'Property Portal' : 'Legal Portal'}
                </p>
                <h2 className="text-2xl font-black tracking-tight mb-3">
                    Welcome, {currentUser.name?.split(' ')[0] || 'Client'}
                </h2>
                <div className="flex items-center gap-6">
                    <div>
                        <p className="text-3xl font-black">{activeMattersCount}</p>
                        <p className="text-[10px] text-white/60 uppercase tracking-wide font-medium">
                            {isProperty ? 'Active Properties' : 'Active Matters'}
                        </p>
                    </div>
                    <div className="w-px h-10 bg-white/20" />
                    <div>
                        <p className="text-3xl font-black">{pendingDocsCount}</p>
                        <p className="text-[10px] text-white/60 uppercase tracking-wide font-medium">Pending Docs</p>
                    </div>
                    <div className="w-px h-10 bg-white/20" />
                    <div>
                        <p className={`text-3xl font-black ${outstandingInvoicesCount > 0 ? 'text-amber-200' : ''}`}>
                            {outstandingInvoicesCount}
                        </p>
                        <p className="text-[10px] text-white/60 uppercase tracking-wide font-medium">Invoices Due</p>
                    </div>
                </div>
            </div>

            {/* ─── Quick Service Grid (3-col, tinted icons) ──────────────── */}
            <div className="grid grid-cols-4 gap-3 px-0 sm:px-4 mt-6">
                {[
                    { icon: <ScalesIcon className="w-5 h-5" />, label: 'Matters', tab: 'matters' as PortalTab, count: clientMatters.length },
                    { icon: <LargeFolderIcon className="w-5 h-5" />, label: 'Documents', tab: 'documents' as PortalTab, count: sharedDocsCount },
                    { icon: <ChatAltIcon className="w-5 h-5" />, label: 'Messages', tab: 'messages' as PortalTab, count: unreadMessagesCount },
                    { icon: <ClipboardListIcon className="w-5 h-5" />, label: 'Requests', tab: 'requests' as PortalTab, count: openRequestsCount },
                ].map(service => (
                    <button
                        key={service.label}
                        onClick={() => handleTabChange(service.tab)}
                        className="flex flex-col items-center group active:scale-95 transition-transform"
                    >
                        <div className="w-14 h-14 bg-brand-primary/10 rounded-icon flex items-center justify-center text-brand-primary relative">
                            {service.icon}
                            {service.count > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm">
                                    {service.count > 9 ? '9+' : service.count}
                                </span>
                            )}
                        </div>
                        <span className="mt-2 text-[11px] font-semibold text-slate-700 dark:text-zinc-300 text-center leading-tight">
                            {service.label}
                        </span>
                    </button>
                ))}
            </div>

            {/* ─── Bottom Sheet (Recent Activity) ────────────────────────── */}
            <div className="bg-white dark:bg-zinc-800 rounded-t-[32px] mt-8 p-6 min-h-[40vh] shadow-premium">
                <div className="w-10 h-1 bg-slate-200 dark:bg-zinc-600 rounded-full mx-auto mb-6" />

                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Recent Activity</h3>
                    <button
                        onClick={() => openModal('newLead', null, { name: currentUser.name, email: currentUser.email, isClientRequest: true })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary/10 text-brand-primary rounded-lg text-xs font-bold hover:bg-brand-primary/20 transition-colors"
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                        Request Service
                    </button>
                </div>

                {/* Loading state: show skeleton ONLY for the first 3 seconds.
                    After that, if still undefined (query skipped because firmId
                    isn't resolved), show empty state instead of infinite skeleton. */}
                {clientActivity === undefined && effectiveFirmId ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex items-start gap-3 animate-pulse">
                                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-700" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3 bg-slate-100 dark:bg-zinc-700 rounded w-3/4" />
                                    <div className="h-2 bg-slate-100 dark:bg-zinc-700 rounded w-1/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : clientActivity === undefined && !effectiveFirmId ? (
                    <div className="text-center py-8">
                        <div className="w-12 h-12 mx-auto bg-slate-50 dark:bg-zinc-700 rounded-full flex items-center justify-center mb-3 text-slate-300 dark:text-zinc-500">
                            <ClockIcon className="w-6 h-6" />
                        </div>
                        <p className="text-sm text-slate-400 dark:text-zinc-500">Loading your portal data...</p>
                    </div>
                ) : !clientActivity || clientActivity.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="w-12 h-12 mx-auto bg-slate-50 dark:bg-zinc-700 rounded-full flex items-center justify-center mb-3 text-slate-300 dark:text-zinc-500">
                            <ClockIcon className="w-6 h-6" />
                        </div>
                        <p className="text-sm text-slate-400 dark:text-zinc-500">No recent activity yet</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {clientActivity.slice(0, 8).map((activity: any) => (
                            <div key={String(activity._id)} className="flex items-start gap-3 py-2.5">
                                <div className="w-9 h-9 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-[10px] font-bold text-brand-primary">
                                        {getInitials(activity.userName)}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-800 dark:text-zinc-200 leading-snug">
                                        <span className="font-semibold">{activity.userName}</span>{' '}
                                        {activity.action}
                                        {activity.targetName && (
                                            <> &middot; <span className="text-brand-primary">{activity.targetName}</span></>
                                        )}
                                    </p>
                                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                                        {activity.timestamp ? timeAgo(activity.timestamp) : ''}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    // ── Render: Matters Tab ──────────────────────────────────────────────
    const renderMatters = () => {
        if (clientMattersLoading) {
            return (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-5 animate-pulse">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 space-y-2">
                                    <div className="h-5 bg-slate-200 dark:bg-zinc-700 rounded w-3/4" />
                                    <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-1/2" />
                                </div>
                                <div className="h-6 w-20 bg-slate-200 dark:bg-zinc-700 rounded-full" />
                            </div>
                            <div className="mt-4 flex gap-6">
                                <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-24" />
                                <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-20" />
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

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
                            className="bg-white dark:bg-zinc-800 rounded-2xl shadow-soft p-5 cursor-pointer hover:shadow-premium transition-all transition-all group"
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
        const isLoading = clientDocs === undefined && effectiveFirmId;
        const docs = filteredDocs || [];
        const consents = clientConsentRecords || [];

        const handlePrintConsent = (consent: any) => {
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Terms Acceptance Record</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1e293b; line-height: 1.7; }
                        .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 24px; }
                        .header h1 { font-size: 24px; font-weight: 800; margin: 0 0 4px; color: #1e293b; }
                        .header .brand { color: #f59e0b; }
                        .header p { color: #64748b; font-size: 13px; margin: 0; }
                        .details { background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; }
                        .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
                        .row:last-child { border-bottom: none; }
                        .label { color: #64748b; font-size: 13px; }
                        .value { font-weight: 600; font-size: 13px; }
                        .badge { display: inline-block; background: #ecfdf5; color: #059669; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; }
                        .footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
                        @media print { body { padding: 0; } .no-print { display: none; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Practice<span class="brand">Pro</span> <span style="color:#8b5cf6;font-size:13px">VEGA</span></h1>
                        <p>Terms & Conditions Acceptance Record</p>
                    </div>
                    <div class="details">
                        <div class="row"><span class="label">User</span><span class="value">${consent.inviteeName || currentUser?.name || 'N/A'}</span></div>
                        <div class="row"><span class="label">Email</span><span class="value">${consent.inviteeEmail || currentUser?.email || 'N/A'}</span></div>
                        <div class="row"><span class="label">Portal Type</span><span class="value">${consent.portalType === 'client' ? 'Client Portal' : "Residents' Portal"}</span></div>
                        <div class="row"><span class="label">Terms Accepted</span><span class="value">${consent.termsAcceptedAt ? new Date(consent.termsAcceptedAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span></div>
                        <div class="row"><span class="label">Account Activated</span><span class="value">${consent.acceptedAt ? new Date(consent.acceptedAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span></div>
                        <div class="row"><span class="label">Status</span><span class="value"><span class="badge">ACCEPTED</span></span></div>
                    </div>
                    <div class="footer">
                        <p>This record confirms your acceptance of the PracticePro portal terms and conditions.</p>
                        <p>PracticePro Legal Technologies Ltd · Lagos, Nigeria</p>
                        <p>NDPA 2023 Compliant · ISO 27001 Aligned · AES-256 Encrypted</p>
                    </div>
                    <div class="no-print" style="position:fixed;bottom:20px;right:20px;">
                        <button onclick="window.print()" style="padding:10px 20px;background:#10b981;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">Print Record</button>
                    </div>
                </body>
                </html>
            `;
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(html);
                printWindow.document.close();
            } else {
                addToast('Please allow popups to print this record.', { type: 'error' });
            }
        };

        const handlePrintDocument = (doc: any) => {
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${doc.title || 'Document'}</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1e293b; line-height: 1.7; }
                        .header { border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 24px; }
                        .header h1 { font-size: 20px; font-weight: 800; margin: 0 0 4px; color: #1e293b; }
                        .header p { color: #64748b; font-size: 13px; margin: 0; }
                        .content { white-space: pre-wrap; font-size: 14px; }
                        .footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
                        @media print { body { padding: 0; } .no-print { display: none; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>${doc.title || 'Untitled Document'}</h1>
                        <p>${doc.matterTitle ? `Matter: ${doc.matterTitle}` : ''} ${doc.dateFiled ? `· Filed: ${doc.dateFiled}` : ''}</p>
                    </div>
                    <div class="content">${doc.content || 'Document content is not available for viewing in the portal. Please contact your legal team for the full document.'}</div>
                    <div class="footer">
                        <p>PracticePro VEGA · Document generated ${new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div class="no-print" style="position:fixed;bottom:20px;right:20px;">
                        <button onclick="window.print()" style="padding:10px 20px;background:#10b981;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">Print Document</button>
                    </div>
                </body>
                </html>
            `;
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(html);
                printWindow.document.close();
            } else {
                addToast('Please allow popups to print this document.', { type: 'error' });
            }
        };

        return (
            <div className="space-y-6">
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
                    {/* Upload Document button removed — not yet available for portal users. */}
                </div>

                {/* ─── Terms & Consents Section ───────────────────────────── */}
                {consents.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <svg className="w-4 h-4 text-violet-600 dark:text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
                            </svg>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Terms & Consents</h3>
                        </div>
                        <div className="space-y-2">
                            {consents.map((consent: any) => (
                                <div
                                    key={String(consent._id)}
                                    className="bg-white dark:bg-zinc-800 rounded-2xl shadow-soft p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center flex-shrink-0">
                                            <svg className="w-5 h-5 text-violet-600 dark:text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
                                            </svg>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200">
                                                {consent.portalType === 'client' ? 'Client Portal Terms & Conditions' : "Residents' Portal Terms & Conditions"}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-zinc-400">
                                                Accepted on {consent.termsAcceptedAt
                                                    ? new Date(consent.termsAcceptedAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                    : 'N/A'}
                                            </p>
                                            <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                                                <CheckCircleIcon className="w-3 h-3" /> Accepted
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0 pl-12 sm:pl-0">
                                        <button
                                            onClick={() => handlePrintConsent(consent)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 rounded-lg text-xs font-bold hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
                                        >
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
                                            </svg>
                                            Print
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── Shared Documents ─────────────────────────────────────── */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <DocumentIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Shared Documents</h3>
                    </div>

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
                                    className="bg-white dark:bg-zinc-800 rounded-2xl shadow-soft p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors"
                                >
                                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                        <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                                            <FileTypeIcon source={doc.source} title={doc.title} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                                {doc.title || 'Untitled Document'}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-zinc-400">
                                                {doc.matterTitle && (
                                                    <span className="truncate max-w-[120px] sm:max-w-[200px]">{doc.matterTitle}</span>
                                                )}
                                                {doc.dateFiled && (
                                                    <>
                                                        <span>&middot;</span>
                                                        <span>{doc.dateFiled}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:flex-shrink-0 pl-12 sm:pl-0">
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
                                        <button
                                            onClick={() => handlePrintDocument(doc)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-lg text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-600 transition-colors"
                                            title="Print document"
                                        >
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
                                            </svg>
                                            Print
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // ── Render: Messages Tab ─────────────────────────────────────────────
    const renderMessages = () => {
        const isLoading = clientMessages === undefined && effectiveFirmId;
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
                            {/* File attachments */}
                            {pendingFiles.length > 0 && (
                                <div className="flex gap-2 flex-wrap">
                                    {pendingFiles.map((f, i) => (
                                        <div key={i} className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-600 rounded-lg px-2.5 py-1.5 text-xs">
                                            <DocumentIcon className="w-3 h-3 text-slate-400" />
                                            <span className="max-w-[120px] truncate text-slate-700 dark:text-zinc-300">{f.name}</span>
                                            <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 ml-0.5">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center justify-end gap-2">
                                <input type="file" ref={fileInputRef} onChange={(e) => {
                                    const files = Array.from(e.target.files || []);
                                    setPendingFiles(prev => [...prev, ...files.map(f => ({ file: f, name: f.name }))]);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }} multiple className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" />
                                <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1.5" title="Attach file">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                    Attach
                                </button>
                                <button
                                    onClick={() => { setIsComposing(false); setMessageText(''); setSelectedMatterForMessage(''); setPendingFiles([]); }}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-zinc-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSendMessage}
                                    disabled={(!messageText.trim() && pendingFiles.length === 0) || !selectedMatterForMessage}
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
                                : getUserName(msg.authorId, msg.authorName);

                            return (
                                <div
                                    key={String(msg._id)}
                                    className={`bg-white dark:bg-zinc-800 rounded-2xl shadow-soft p-4 ${
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

    // ── Service Requests Tab ─────────────────────────────────────────────
    // Local component state for the request submission form. We declare it
    // here at the top level of ClientDashboard so the form survives re-renders.
    const [requestSubject, setRequestSubject] = useState('');
    const [requestDescription, setRequestDescription] = useState('');
    const [selectedRequestTypeKey, setSelectedRequestTypeKey] = useState<string>('doc_review');
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

    const selectedRequestType = useMemo(() => {
        if (!clientRequestTypes || clientRequestTypes.length === 0) return null;
        return clientRequestTypes.find((t: any) => t.key === selectedRequestTypeKey) || clientRequestTypes[0];
    }, [clientRequestTypes, selectedRequestTypeKey]);

    const handleSubmitRequest = async () => {
        if (!requestSubject.trim() || !requestDescription.trim()) {
            addToast('Please fill in subject and description before submitting.', { type: 'info' });
            return;
        }
        if (!effectiveFirmId) {
            addToast('Unable to submit — firm information is still loading. Please try again.', { type: 'info' });
            return;
        }

        setIsSubmittingRequest(true);
        try {
            const typeLabel = selectedRequestType?.label || selectedRequestTypeKey;
            await createClientServiceRequest({
                firmId: effectiveFirmId,
                clientId: currentUser?.id,
                clientName: currentUser?.name,
                clientEmail: currentUser?.email,
                matterId: undefined, // optional — could be linked to a specific matter
                requestTypeKey: selectedRequestTypeKey,
                requestTypeLabel: typeLabel,
                subject: requestSubject.trim(),
                description: requestDescription.trim(),
            });
            addToast('Your request has been submitted. Your legal team will respond shortly.', { type: 'success' });
            setRequestSubject('');
            setRequestDescription('');
            setSelectedRequestTypeKey('doc_review');
        } catch (err: any) {
            addToast(err.message || 'Failed to submit request. Please try again.', { type: 'error' });
        } finally {
            setIsSubmittingRequest(false);
        }
    };

    const getRequestStatusBadge = (status: string) => {
        const config: Record<string, { bg: string; text: string; label: string }> = {
            open:        { bg: 'bg-amber-50 dark:bg-amber-900/20',  text: 'text-amber-600 dark:text-amber-400',  label: 'Open' },
            in_progress: { bg: 'bg-blue-50 dark:bg-blue-900/20',    text: 'text-blue-600 dark:text-blue-400',    label: 'In Progress' },
            resolved:    { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', label: 'Resolved' },
            closed:      { bg: 'bg-slate-100 dark:bg-zinc-700',     text: 'text-slate-600 dark:text-zinc-400',   label: 'Closed' },
        };
        const c = config[status] || config.open;
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`}>
                {status === 'resolved' || status === 'closed' ? <CheckCircleIcon className="w-3 h-3" /> : <ClockIcon className="w-3 h-3" />}
                {c.label}
            </span>
        );
    };

    const renderRequests = () => {
        const isLoading = clientRequestTypes === undefined || clientServiceRequests === undefined;
        return (
            <div className="px-4 sm:px-6 pb-12">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Service Requests</h2>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
                    Request a meeting, document review, or any other service from your legal team.
                </p>

                {/* New Request Form */}
                <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 mb-6 shadow-soft">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3">Submit a New Request</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-2">Request Type</label>
                            {clientRequestTypes === undefined ? (
                                <div className="grid grid-cols-2 gap-2">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="h-14 rounded-lg bg-slate-100 dark:bg-zinc-700 animate-pulse" />
                                    ))}
                                </div>
                            ) : clientRequestTypes && clientRequestTypes.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {clientRequestTypes.map((t: any) => {
                                        const isSelected = selectedRequestTypeKey === t.key;
                                        return (
                                            <button
                                                key={t.key}
                                                type="button"
                                                onClick={() => setSelectedRequestTypeKey(t.key)}
                                                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-left transition-all ${
                                                    isSelected
                                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-2 ring-emerald-500/20'
                                                        : 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-emerald-300 dark:hover:border-emerald-700'
                                                }`}
                                            >
                                                <span className="text-lg flex-shrink-0">{t.icon || '📋'}</span>
                                                <div className="min-w-0 flex-1">
                                                    <p className={`text-xs font-bold truncate ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-zinc-200'}`}>
                                                        {t.label}
                                                    </p>
                                                    {t.description && (
                                                        <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">{t.description}</p>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400">No request types configured.</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Subject</label>
                            <input
                                value={requestSubject}
                                onChange={e => setRequestSubject(e.target.value)}
                                placeholder="e.g., Please review the attached settlement agreement"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Details</label>
                            <textarea
                                value={requestDescription}
                                onChange={e => setRequestDescription(e.target.value)}
                                placeholder="Provide any context that will help your legal team respond effectively..."
                                rows={4}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                            />
                        </div>
                        <button
                            onClick={handleSubmitRequest}
                            disabled={isSubmittingRequest}
                            className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                        >
                            {isSubmittingRequest ? (
                                <>
                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <SendIcon className="w-3.5 h-3.5" />
                                    Submit Request
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Request History */}
                <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3">Your Request History</h3>
                {isLoading ? (
                    <div className="space-y-2">
                        {[1, 2].map(i => (
                            <div key={i} className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 animate-pulse">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-700" />
                                    <div className="flex-1">
                                        <div className="h-4 bg-slate-100 dark:bg-zinc-700 rounded w-40 mb-2" />
                                        <div className="h-3 bg-slate-100 dark:bg-zinc-700 rounded w-24" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : clientServiceRequests && clientServiceRequests.length > 0 ? (
                    <div className="space-y-2">
                        {clientServiceRequests.map((r: any) => {
                            const typeMeta = (clientRequestTypes as any[] | undefined)?.find((rt: any) => rt.key === r.requestTypeKey);
                            const iconChar = typeMeta?.icon || '📋';
                            return (
                                <div
                                    key={r._id}
                                    className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 flex flex-row items-start sm:items-center justify-between gap-3"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${
                                            r.status === 'resolved' || r.status === 'closed'
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20'
                                                : r.status === 'in_progress'
                                                ? 'bg-blue-50 dark:bg-blue-900/20'
                                                : 'bg-amber-50 dark:bg-amber-900/20'
                                        }`}>
                                            {iconChar}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200 truncate">{r.subject}</p>
                                            <p className="text-xs text-slate-500 dark:text-zinc-400">
                                                <span className="font-medium text-slate-600 dark:text-zinc-300">{r.requestTypeLabel}</span>
                                                {' · '}
                                                {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">{getRequestStatusBadge(r.status)}</div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-8 text-center">
                        <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-zinc-700 flex items-center justify-center mb-3">
                            <ClipboardListIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
                        </div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">No service requests yet</p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                            Use the form above to request a meeting, document review, or any other service.
                        </p>
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
            case 'requests': return renderRequests();
        }
    };

    return (
        <div className="min-h-[100dvh] bg-slate-50 dark:bg-zinc-950 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            {/* Impersonation Banner — shown when admin is viewing as this client.
                Uses isImpersonating (synchronous) rather than originalUser (async query)
                so the banner — and the "Return to Admin" button — is always visible
                during impersonation, even if the admin's DB record is still loading
                or has a missing role. */}
            {isImpersonating && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <EyeIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                            You are previewing the portal as <strong>{currentUser.name || currentUser.email}</strong>
                        </p>
                    </div>
                    <button
                        onClick={revertToOriginalUser}
                        className="px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex-shrink-0"
                    >
                        Return to Admin
                    </button>
                </div>
            )}
            {/* Header — sticky on mobile so sign-out is always accessible */}
            <div className="mb-4 sticky top-0 z-20 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl py-3 sm:py-4 px-4 shadow-soft border-b border-slate-100 dark:border-zinc-800/50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-2">
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white truncate">
                            Welcome, {currentUser.name?.split(' ')[0] || 'Client'}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                            Your legal matters portal &mdash; stay informed and connected
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={() => openModal('newLead', null, { name: currentUser.name, email: currentUser.email, isClientRequest: true })}
                            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 text-sm transition-colors shadow-sm"
                        >
                            <PlusIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">Request Service</span>
                        </button>
                        {/* Theme Toggle — clearly visible */}
                        <button
                            onClick={toggleTheme}
                            className="p-2 sm:p-2.5 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shadow-soft border border-slate-100 dark:border-zinc-700"
                            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                            aria-label="Toggle theme"
                        >
                            {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                        </button>
                        {/* Sign Out — always visible and tappable for portal users */}
                        <button
                            onClick={() => logout()}
                            className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-white hover:bg-rose-600 dark:hover:bg-rose-500 border border-rose-200 dark:border-rose-800/50 hover:border-rose-600 dark:hover:border-rose-500 rounded-lg transition-colors active:scale-95"
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                            </svg>
                            <span className="hidden sm:inline">Sign Out</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="mb-6 overflow-x-auto no-scrollbar">
                <nav className="-mb-px flex space-x-0 sm:space-x-1 md:space-x-4">
                    <TabButton
                        label="Overview"
                        tab="overview"
                        active={activeTab}
                        onClick={() => handleTabChange('overview')}
                        icon={<ScalesIcon className="w-4 h-4" />}
                    />
                    <TabButton
                        label="Matters"
                        tab="matters"
                        active={activeTab}
                        onClick={() => handleTabChange('matters')}
                        icon={<MattersIcon className="w-4 h-4" />}
                        badge={clientMatters.length}
                    />
                    <TabButton
                        label="Documents"
                        tab="documents"
                        active={activeTab}
                        onClick={() => handleTabChange('documents')}
                        icon={<DocumentIcon className="w-4 h-4" />}
                        badge={sharedDocsCount}
                    />
                    <TabButton
                        label="Messages"
                        tab="messages"
                        active={activeTab}
                        onClick={() => handleTabChange('messages')}
                        icon={<ChatAltIcon className="w-4 h-4" />}
                        badge={unreadMessagesCount}
                    />
                    <TabButton
                        label="Requests"
                        tab="requests"
                        active={activeTab}
                        onClick={() => handleTabChange('requests')}
                        icon={<ClipboardListIcon className="w-4 h-4" />}
                        badge={openRequestsCount}
                    />
                </nav>
            </div>

            {/* Tab Content */}
            {renderTabContent()}
        </div>
    );
};

export default ClientDashboard;
