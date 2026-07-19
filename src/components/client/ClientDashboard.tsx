import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useDataActions } from '../../contexts/DataContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useFeatures } from '../../hooks/useFeatures';
import { useProduct } from '../../contexts/ProductContext';
import { openHtmlInNewWindow, escapeHtml } from '../../utils/safePrintWindow';
import {
    MattersIcon, PlusIcon, LockClosedIcon, DocumentIcon,
    ChatAltIcon, ClockIcon, CheckCircleIcon,
    UploadIcon, SendIcon, ScalesIcon,
    ExclamationTriangleIcon, EyeIcon, ChevronRightIcon,
    LargeFolderIcon, UserCircleIcon, ClipboardListIcon, XIcon
} from '../../constants';
import { Receipt } from 'lucide-react';
import { timeAgo, getInitials } from '../../utils/colorUtils';
import { ServiceTypePicker } from '../portal/ServiceTypePicker';
import { PortalFontSizeControl } from '../portal/PortalFontSizeControl';

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
type PortalTab = 'overview' | 'matters' | 'documents' | 'messages' | 'requests' | 'financials';

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
        className={`flex items-center gap-2 sm:gap-2.5 whitespace-nowrap py-3.5 px-3 sm:px-4 border-b-2 font-semibold text-xs sm:text-sm transition-colors ${
            active === tab
                ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
        }`}
    >
        {/* Icon — larger than before (w-5 h-5) so it's easier to tap and
            more visually balanced against the label text. */}
        <span className="w-5 h-5 flex-shrink-0">{icon}</span>
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

    // ─── Portal theme isolation ──────────────────────────────────────────
    // Portal users should ONLY ever see standard light or standard dark —
    // never the admin's custom themes (midnight, oled, neon-cyber, etc.).
    // Those admin themes are designed for the practitioner dashboard and
    // look broken in the portal's simpler layout.
    //
    // We use a SEPARATE localStorage key (practicepro_portal_theme) so the
    // portal user's preference is independent of the admin's theme. If the
    // admin's theme leaks in (e.g. user was logged in as admin then switched
    // to portal), we override it to the portal user's last-known preference
    // or default to light.
    const PORTAL_THEME_KEY = 'practicepro_portal_theme';
    React.useEffect(() => {
        const portalTheme = localStorage.getItem(PORTAL_THEME_KEY) as 'light' | 'dark' | null;
        if (portalTheme === 'light' || portalTheme === 'dark') {
            // Apply the portal user's saved preference
            if (theme !== portalTheme) setTheme(portalTheme);
        } else {
            // First visit — default to light, save the preference
            setTheme('light');
            try { localStorage.setItem(PORTAL_THEME_KEY, 'light'); } catch {}
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Repair mutation for fixing missing firmId on portal user records
    const repairFirmId = useMutation(api.portals.repairPortalUserFirmId);
    const sendPortalMessage = useMutation(api.portals.sendPortalMessage);
    const [isRepairing, setIsRepairing] = useState(false);

    const [activeTab, setActiveTab] = useState<PortalTab>(() => {
        const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
        if (['overview', 'matters', 'documents', 'messages', 'requests', 'financials'].includes(hash)) return hash as PortalTab;
        return 'overview';
    });
    const handleTabChange = (tab: PortalTab) => {
        setActiveTab(tab);
        window.location.hash = tab;
        // Haptic feedback on tab change — light tap so the user feels
        // the navigation without being annoying.
        try { import('../../utils/haptics').then(m => m.haptics.light()); } catch {}
    };
    const [docFilter, setDocFilter] = useState<string>('all');
    // Terms & Consents collapse state — portal user can hide the T&C section
    // so it's not imposing. The acceptance record is still retained for
    // compliance; this just hides the visual reminder.
    const [tcCollapsed, setTcCollapsed] = useState<boolean>(() => {
        // Default to COLLAPSED so the T&C doesn't clutter the portal on
        // first visit. The user can expand it if they want to review.
        try { return localStorage.getItem('practicepro_tc_collapsed') !== '0'; } catch { return true; }
    });
    useEffect(() => {
        try { localStorage.setItem('practicepro_tc_collapsed', tcCollapsed ? '1' : '0'); } catch {}
    }, [tcCollapsed]);
    const [messageText, setMessageText] = useState('');
    const [selectedMatterForMessage, setSelectedMatterForMessage] = useState<string>('');
    const [isComposing, setIsComposing] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<{ file: File; name: string }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Portal users only ever see standard light or standard dark — never
    // the admin's custom themes. We compute isDark based ONLY on the two
    // standard themes so a leaked admin theme is treated as light.
    const isDark = theme === 'dark';

    const toggleTheme = () => {
        const newTheme = isDark ? 'light' : 'dark';
        setTheme(newTheme);
        // Persist to the portal-specific key so the admin's theme setting
        // is never affected by the portal user's choice (and vice versa).
        try { localStorage.setItem('practicepro_portal_theme', newTheme); } catch {}
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

    // 1b. Self-heal: if the contact lookup returned null AND the user has an
    // email/name, try to link their userId to an existing contact record.
    // This back-fills users who accepted invites BEFORE the contact-linking
    // step was added to setupPortalPassword. Safe to call repeatedly —
    // it's a no-op if the contact is already linked or doesn't exist.
    const selfHealContactLink = useMutation(api.portals.selfHealClientContactLink);
    useEffect(() => {
        if (
            clientContactResult === null && // lookup completed, no contact found
            currentUser?.id &&
            effectiveFirmId &&
            (currentUser.email || currentUser.name)
        ) {
            selfHealContactLink({
                firmId: effectiveFirmId,
                userId: currentUser.id,
                email: currentUser.email || undefined,
                name: currentUser.name || undefined,
            }).catch(() => {/* non-blocking */});
        }
    }, [clientContactResult, currentUser?.id, currentUser?.email, currentUser?.name, effectiveFirmId, selfHealContactLink]);

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

    // ── Loading-state helpers ────────────────────────────────────────────────
    // A portal query is "still loading" ONLY when:
    //   1. Its args are ready (clientContactId + effectiveFirmId resolved), AND
    //   2. The query itself is still pending (=== undefined).
    // If the args are NOT ready (e.g. contact lookup returned null), the query
    // is skipped and returns undefined — but that's NOT a loading state. The
    // contact may simply not exist yet. In that case we show an empty state,
    // never a stuck skeleton. This was the root cause of the "stuck skeleton"
    // bug: when clientContactResult === null, every downstream query was
    // skipped (returned undefined), and the old check `=== undefined && effectiveFirmId`
    // showed skeleton forever.
    const portalArgsReady = !!(clientContactId && effectiveFirmId);
    const clientContactResolved = clientContactResult !== undefined;
    const clientDocsLoading = clientDocs === undefined && portalArgsReady;
    const clientActivityLoading = clientActivity === undefined && portalArgsReady;
    const clientActivityResolved = clientActivity !== undefined || !portalArgsReady;
    const clientMessagesLoading = clientMessages === undefined && portalArgsReady;
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
            <div className="flex items-center justify-center min-h-[100dvh] bg-slate-50 dark:bg-zinc-950 p-6">
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
    const cancelClientServiceRequest = useMutation(api.portals.cancelClientServiceRequest);

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

    // ── Render: Overview Tab (Premium Card-Based Layout) ────────────────
    // Architecture: Hero Card → Financial Summary Card → Quick Services Grid → Recent Activity.
    // Emulates the professional card-based design the user referenced:
    //   - Hero card: brand-primary green, shows identity + key stats
    //   - Financial card: light mint, shows outstanding balance + CTA
    //   - Quick Services: actionable tiles (not just requests — includes
    //     pay invoice, documents, messages, new request)
    //   - Recent Activity: simple feed below
    const formatNaira = (n: number) => `₦${(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    const totalOutstanding = (clientInvoices || []).filter((inv: any) =>
        inv.status === 'Overdue' || inv.status === 'Unpaid' || inv.status === 'Sent'
    ).reduce((sum: number, inv: any) => sum + (inv.totalAmount || inv.amount || 0), 0);

    const renderOverview = () => (
        <div className="space-y-5 px-4 sm:px-6 pb-8">
            {/* ─── Hero Card (brand-primary green, identity + stats) ────── */}
            <div className="bg-brand-primary text-white rounded-premium p-5 shadow-premium">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">
                            Client Portal
                        </p>
                        <h2 className="text-xl font-black tracking-tight">
                            {currentUser.name?.split(' ')[0] || 'Client'}
                        </h2>
                        {currentUser.email && (
                            <p className="text-[11px] text-white/50 mt-0.5 truncate max-w-[200px]">
                                {currentUser.email}
                            </p>
                        )}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold">
                            {getInitials(currentUser.name || 'C')}
                        </span>
                    </div>
                </div>
                {/* Stats row — clean dividers, big numbers */}
                <div className="flex items-center gap-4 pt-3 border-t border-white/15">
                    <div className="flex-1">
                        <p className="text-2xl font-black">{activeMattersCount}</p>
                        <p className="text-[9px] text-white/60 uppercase tracking-wide font-medium">Matters</p>
                    </div>
                    <div className="w-px h-8 bg-white/15" />
                    <div className="flex-1">
                        <p className="text-2xl font-black">{pendingDocsCount}</p>
                        <p className="text-[9px] text-white/60 uppercase tracking-wide font-medium">Docs</p>
                    </div>
                    <div className="w-px h-8 bg-white/15" />
                    <div className="flex-1">
                        <p className={`text-2xl font-black ${outstandingInvoicesCount > 0 ? 'text-amber-200' : ''}`}>
                            {outstandingInvoicesCount}
                        </p>
                        <p className="text-[9px] text-white/60 uppercase tracking-wide font-medium">Invoices</p>
                    </div>
                </div>
            </div>

            {/* ─── Financial Summary Card (light mint, outstanding balance) ── */}
            <button
                onClick={() => handleTabChange('financials')}
                className="w-full text-left bg-emerald-50 dark:bg-emerald-900/15 rounded-2xl p-5 shadow-soft active:scale-[0.98] transition-transform"
            >
                <div className="flex items-start justify-between mb-3">
                    <div>
                        <p className="text-[10px] font-bold text-emerald-700/70 dark:text-emerald-400/70 uppercase tracking-widest">
                            Outstanding Balance
                        </p>
                        <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                            {formatNaira(totalOutstanding)}
                        </p>
                        <p className="text-[11px] text-emerald-600/60 dark:text-emerald-400/60 mt-1">
                            {outstandingInvoicesCount > 0
                                ? `${outstandingInvoicesCount} invoice${outstandingInvoicesCount > 1 ? 's' : ''} pending`
                                : 'All caught up'}
                        </p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold">
                        <Receipt className="w-3.5 h-3.5" />
                        View
                    </div>
                </div>
            </button>

            {/* ─── Quick Services Grid (the main navigation) ──────────────
                This IS the navigation — no more tab bar. Each box opens a
                full-page view with a Back button. The grid is extensible:
                admin can add new service boxes in the future (e.g., "Pay
                Service Charge", "Buy Electricity", etc.) via the
                ServiceRequestTypesConfig system. */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Services</h3>
                </div>
                <div className="grid grid-cols-4 gap-3">
                    {[
                        { icon: <ScalesIcon className="w-5 h-5" />, label: 'Matters', tab: 'matters' as PortalTab, color: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400', badge: clientMatters.length },
                        { icon: <LargeFolderIcon className="w-5 h-5" />, label: 'Documents', tab: 'documents' as PortalTab, color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400', badge: sharedDocsCount },
                        { icon: <ChatAltIcon className="w-5 h-5" />, label: 'Messages', tab: 'messages' as PortalTab, color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400', badge: unreadMessagesCount },
                        { icon: <ClipboardListIcon className="w-5 h-5" />, label: 'Requests', tab: 'requests' as PortalTab, color: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400', badge: openRequestsCount },
                        { icon: <Receipt className="w-5 h-5" />, label: 'Financials', tab: 'financials' as PortalTab, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400', badge: outstandingInvoicesCount },
                    ].map(service => (
                        <button
                            key={service.label}
                            onClick={() => handleTabChange(service.tab)}
                            className="flex flex-col items-center gap-2 p-3 bg-white dark:bg-zinc-800 rounded-2xl shadow-soft active:scale-95 transition-transform relative"
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${service.color} relative`}>
                                {service.icon}
                                {service.badge !== undefined && service.badge > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                                        {service.badge > 9 ? '9+' : service.badge}
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] font-semibold text-slate-700 dark:text-zinc-300 text-center leading-tight">
                                {service.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ─── Recent Activity (simple island feed) ─────────────────── */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl p-5 shadow-soft">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Recent Activity
                    </h3>
                    {clientActivity && clientActivity.length > 0 && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-full">
                            {clientActivity.length}
                        </span>
                    )}
                </div>

                {clientActivityLoading ? (
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
                ) : !clientActivityResolved ? (
                    <div className="text-center py-6">
                        <ClockIcon className="w-6 h-6 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-400 dark:text-zinc-500">Loading...</p>
                    </div>
                ) : !clientActivity || clientActivity.length === 0 ? (
                    <div className="text-center py-6">
                        <ClockIcon className="w-6 h-6 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-400 dark:text-zinc-500">No recent activity</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {clientActivity.slice(0, 6).map((activity: any) => {
                            const actionText: string = (activity.action || '').toLowerCase();
                            const targetType: string = (activity.targetType || '').toLowerCase();
                            let dotColor = 'bg-slate-400';
                            if (actionText.includes('upload') || actionText.includes('share') || targetType === 'document') dotColor = 'bg-blue-500';
                            else if (actionText.includes('message') || actionText.includes('reply')) dotColor = 'bg-emerald-500';
                            else if (actionText.includes('create') || actionText.includes('open') || targetType === 'matter') dotColor = 'bg-violet-500';
                            else if (actionText.includes('invoice') || actionText.includes('payment')) dotColor = 'bg-amber-500';
                            return (
                                <div key={String(activity._id)} className="flex items-start gap-3 py-2">
                                    <div className="relative flex-shrink-0 mt-0.5">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-700 flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                                                {getInitials(activity.userName)}
                                            </span>
                                        </div>
                                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${dotColor} border-2 border-white dark:border-zinc-800`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-700 dark:text-zinc-300 leading-snug">
                                            <span className="font-semibold">{activity.userName}</span>{' '}
                                            {activity.action}
                                            {activity.targetName && (
                                                <span className="text-slate-500 dark:text-zinc-400"> · {activity.targetName}</span>
                                            )}
                                        </p>
                                        <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                                            {activity.timestamp ? timeAgo(activity.timestamp) : ''}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
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
        const isLoading = clientDocsLoading;
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
                        <div class="row"><span class="label">User</span><span class="value">${escapeHtml(consent.inviteeName || currentUser?.name || 'N/A')}</span></div>
                        <div class="row"><span class="label">Email</span><span class="value">${escapeHtml(consent.inviteeEmail || currentUser?.email || 'N/A')}</span></div>
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
            // Use safe print window (Blob URL + noopener) to prevent XSS
            const printWindow = openHtmlInNewWindow(html);
            if (!printWindow) {
                addToast('Please allow popups to print this record.', { type: 'error' });
            }
        };

        const handlePrintDocument = (doc: any) => {
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${escapeHtml(doc.title || 'Document')}</title>
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
                        <h1>${escapeHtml(doc.title || 'Untitled Document')}</h1>
                        <p>${doc.matterTitle ? `Matter: ${escapeHtml(doc.matterTitle)}` : ''} ${doc.dateFiled ? `· Filed: ${escapeHtml(doc.dateFiled)}` : ''}</p>
                    </div>
                    <div class="content">${escapeHtml(doc.content || 'Document content is not available for viewing in the portal. Please contact your legal team for the full document.')}</div>
                    <div class="footer">
                        <p>PracticePro VEGA · Document generated ${new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div class="no-print" style="position:fixed;bottom:20px;right:20px;">
                        <button onclick="window.print()" style="padding:10px 20px;background:#10b981;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">Print Document</button>
                    </div>
                </body>
                </html>
            `;
            // Use safe print window (Blob URL + noopener) to prevent XSS
            const printWindow = openHtmlInNewWindow(html);
            if (!printWindow) {
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
                        <button
                            onClick={() => setTcCollapsed(c => !c)}
                            className="w-full flex items-center justify-between gap-2 mb-3 group"
                            aria-label={tcCollapsed ? 'Expand terms & consents' : 'Collapse terms & consents'}
                            aria-expanded={!tcCollapsed}
                        >
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-violet-600 dark:text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
                                </svg>
                                <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Terms & Consents</h3>
                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full">
                                    {consents.length} accepted
                                </span>
                            </div>
                            <svg
                                className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition-transform duration-200 ${tcCollapsed ? 'rotate-180' : ''}`}
                                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                            >
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </button>
                        {!tcCollapsed && (
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
                        )}
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
        const isLoading = clientMessagesLoading;
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

    // ── Financials: payment panel state ────────────────────────────────
    // Tracks which invoice's payment instructions panel is expanded.
    // When the user taps "Pay Now", the panel slides open showing bank
    // details + an "I've Paid" button that notifies the admin.
    const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
    const [isMarkingPaid, setIsMarkingPaid] = useState(false);
    // Cancel request state
    const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);
    const [cancelNote, setCancelNote] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);
    const [requestDescription, setRequestDescription] = useState('');
    const [selectedRequestTypeKey, setSelectedRequestTypeKey] = useState<string>('doc_review');
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
    // File attachments for service requests
    const [requestFiles, setRequestFiles] = useState<File[]>([]);
    const requestFileInputRef = useRef<HTMLInputElement>(null);

    const selectedRequestType = useMemo(() => {
        if (!clientRequestTypes || clientRequestTypes.length === 0) return null;
        return clientRequestTypes.find((t: any) => t.key === selectedRequestTypeKey) || clientRequestTypes[0];
    }, [clientRequestTypes, selectedRequestTypeKey]);

    // ── Financials: handle "I've Paid" ─────────────────────────────────
    // Sends a portal message to the admin notifying them that the client
    // has made payment for a specific invoice. The admin can then confirm
    // receipt and mark the invoice as Paid.
    const handleMarkInvoicePaid = async (inv: any) => {
        if (!effectiveFirmId || !currentUser?.id) return;
        setIsMarkingPaid(true);
        try {
            const invoiceLabel = inv.invoiceNumber || inv.title || `Invoice ${String(inv._id || inv.id).slice(-6)}`;
            const amount = inv.totalAmount || inv.amount || 0;
            await sendPortalMessage({
                firmId: effectiveFirmId,
                senderId: currentUser.id,
                senderName: currentUser.name,
                senderEmail: currentUser.email,
                senderRole: 'Client',
                subject: `Payment Notification: ${invoiceLabel}`,
                content: `I have made payment of ${formatNairaStatic(amount)} for invoice "${invoiceLabel}". Please confirm receipt and update the invoice status.\n\nInvoice details:\n- Amount: ${formatNairaStatic(amount)}\n- Due date: ${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'N/A'}\n- Status: ${inv.status}\n\nThank you.`,
            });
            addToast('Payment notification sent. Your legal team will confirm receipt shortly.', { type: 'success' });
            setExpandedInvoiceId(null);
        } catch (err: any) {
            addToast(err.message || 'Failed to send payment notification.', { type: 'error' });
        } finally {
            setIsMarkingPaid(false);
        }
    };
    const formatNairaStatic = (n: number) => `₦${(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

    // ── Cancel request handler ─────────────────────────────────────────
    const handleCancelRequest = async (requestId: string) => {
        if (!cancelNote.trim()) {
            addToast('Please enter a reason for cancelling.', { type: 'info' });
            return;
        }
        if (!currentUser?.id) return;
        setIsCancelling(true);
        try {
            await cancelClientServiceRequest({
                requestId: requestId as any,
                cancellationNote: cancelNote.trim(),
                cancelledBy: currentUser.id,
            });
            addToast('Request cancelled. Your legal team has been notified.', { type: 'success' });
            setCancellingRequestId(null);
            setCancelNote('');
        } catch (err: any) {
            addToast(err.message || 'Failed to cancel request.', { type: 'error' });
        } finally {
            setIsCancelling(false);
        }
    };

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

            // Upload any attached files to Convex storage
            let attachmentStorageIds: string[] = [];
            let attachmentNames: string[] = [];
            if (requestFiles.length > 0) {
                for (const file of requestFiles) {
                    try {
                        const postUrl = await generateUploadUrl();
                        const res = await fetch(postUrl, { method: 'POST', body: file });
                        if (res.ok) {
                            const { storageId } = await res.json();
                            if (storageId) {
                                attachmentStorageIds.push(storageId);
                                attachmentNames.push(file.name);
                            }
                        }
                    } catch (uploadErr) {
                        console.warn('File upload failed:', uploadErr);
                    }
                }
            }

            await createClientServiceRequest({
                firmId: effectiveFirmId,
                clientId: currentUser?.id,
                clientName: currentUser?.name,
                clientEmail: currentUser?.email,
                matterId: undefined,
                requestTypeKey: selectedRequestTypeKey,
                requestTypeLabel: typeLabel,
                subject: requestSubject.trim(),
                description: requestDescription.trim(),
                attachments: attachmentStorageIds.length > 0 ? attachmentStorageIds : undefined,
                attachmentNames: attachmentNames.length > 0 ? attachmentNames : undefined,
            });
            addToast('Your request has been submitted. Your legal team will respond shortly.', { type: 'success' });
            setRequestSubject('');
            setRequestDescription('');
            setSelectedRequestTypeKey('doc_review');
            setRequestFiles([]);
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
            cancelled:   { bg: 'bg-rose-50 dark:bg-rose-900/20',    text: 'text-rose-600 dark:text-rose-400',    label: 'Cancelled' },
        };
        const c = config[status] || config.open;
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`}>
                {status === 'resolved' || status === 'closed' ? <CheckCircleIcon className="w-3 h-3" /> : status === 'cancelled' ? <XIcon className="w-3 h-3" /> : <ClockIcon className="w-3 h-3" />}
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
                            {clientRequestTypes === undefined ? (
                                <>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-2">Request Type</label>
                                    <div className="h-12 rounded-lg bg-slate-100 dark:bg-zinc-700 animate-pulse" />
                                </>
                            ) : clientRequestTypes && clientRequestTypes.length > 0 ? (
                                <ServiceTypePicker
                                    options={clientRequestTypes as any}
                                    selectedKey={selectedRequestTypeKey}
                                    onChange={setSelectedRequestTypeKey}
                                    label="Request Type"
                                    placeholder="Select a request type"
                                />
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
                        {/* File attachments — images and short videos */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Attachments (Optional)</label>
                            <input
                                ref={requestFileInputRef}
                                type="file"
                                multiple
                                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,application/pdf"
                                onChange={(e) => {
                                    const files = Array.from(e.target.files || []);
                                    const maxSize = 25 * 1024 * 1024; // 25MB
                                    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'application/pdf'];
                                    const validFiles = files.filter(f => {
                                        if (!validTypes.includes(f.type)) {
                                            addToast(`"${f.name}" is not a supported file type. Use images, videos, or PDFs.`, { type: 'error' });
                                            return false;
                                        }
                                        if (f.size > maxSize) {
                                            addToast(`"${f.name}" exceeds 25MB limit.`, { type: 'error' });
                                            return false;
                                        }
                                        return true;
                                    });
                                    setRequestFiles(prev => [...prev, ...validFiles]);
                                    if (requestFileInputRef.current) requestFileInputRef.current.value = '';
                                }}
                                className="hidden"
                            />
                            <div
                                onClick={() => requestFileInputRef.current?.click()}
                                className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-lg p-4 text-center cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors"
                            >
                                <UploadIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500 mx-auto mb-2" />
                                <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                                    Click to upload photos, videos, or PDFs
                                </p>
                                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                                    JPG, PNG, GIF, WebP, MP4, PDF · Max 25MB each
                                </p>
                            </div>
                            {requestFiles.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {requestFiles.map((file, idx) => (
                                        <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-zinc-800 rounded-lg">
                                            {file.type.startsWith('image/') ? (
                                                <img src={URL.createObjectURL(file)} alt={file.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                                            ) : file.type.startsWith('video/') ? (
                                                <div className="w-8 h-8 rounded bg-slate-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-[8px] font-bold text-slate-500">VID</span>
                                                </div>
                                            ) : (
                                                <DocumentIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                            )}
                                            <span className="text-xs text-slate-700 dark:text-zinc-300 flex-1 truncate">{file.name}</span>
                                            <span className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(0)}KB</span>
                                            <button onClick={() => setRequestFiles(prev => prev.filter((_, i) => i !== idx))} className="text-rose-500 hover:text-rose-700">
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
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
                            const canCancel = r.status === 'open' || r.status === 'in_progress';
                            const isCancellingThis = cancellingRequestId === String(r._id);
                            return (
                                <div
                                    key={r._id}
                                    className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden"
                                >
                                    <div className="p-4 flex flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${
                                                r.status === 'resolved' || r.status === 'closed'
                                                    ? 'bg-emerald-50 dark:bg-emerald-900/20'
                                                    : r.status === 'cancelled'
                                                    ? 'bg-rose-50 dark:bg-rose-900/20'
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
                                                {r.cancellationNote && (
                                                    <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-1 italic">
                                                        Cancelled: {r.cancellationNote}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0">{getRequestStatusBadge(r.status)}</div>
                                    </div>
                                    {/* Cancel button for open/in_progress requests */}
                                    {canCancel && (
                                        <div className="px-4 pb-3">
                                            <button
                                                onClick={() => {
                                                    setCancellingRequestId(isCancellingThis ? null : String(r._id));
                                                    setCancelNote('');
                                                }}
                                                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                {isCancellingThis ? 'Hide' : 'Cancel Request'}
                                            </button>
                                        </div>
                                    )}
                                    {/* Cancel confirmation panel */}
                                    {canCancel && isCancellingThis && (
                                        <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-zinc-700 space-y-3">
                                            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">
                                                Reason for cancellation
                                            </label>
                                            <textarea
                                                value={cancelNote}
                                                onChange={e => setCancelNote(e.target.value)}
                                                placeholder="e.g., Issue was resolved another way, no longer needed..."
                                                rows={2}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => { setCancellingRequestId(null); setCancelNote(''); }}
                                                    className="flex-1 px-3 py-2 text-xs font-bold text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-700 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors"
                                                >
                                                    Keep Request
                                                </button>
                                                <button
                                                    onClick={() => handleCancelRequest(String(r._id))}
                                                    disabled={isCancelling || !cancelNote.trim()}
                                                    className="flex-1 px-3 py-2 text-xs font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                                                >
                                                    {isCancelling ? (
                                                        <>
                                                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                            Cancelling...
                                                        </>
                                                    ) : (
                                                        'Confirm Cancel'
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}
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

    // ── Render: Financials Tab ──────────────────────────────────────────
    // Shows the client's invoices and payment history. This was a huge
    // missed opportunity — clients had no visibility into their billing.
    const renderFinancials = () => {
        const isLoading = clientInvoices === undefined && portalArgsReady;
        const invoices = (clientInvoices || []) as any[];

        // Summary stats
        const totalOutstanding = invoices
            .filter(inv => inv.status === 'Overdue' || inv.status === 'Unpaid' || inv.status === 'Sent')
            .reduce((sum, inv) => sum + (inv.totalAmount || inv.amount || 0), 0);
        const totalPaid = invoices
            .filter(inv => inv.status === 'Paid')
            .reduce((sum, inv) => sum + (inv.totalAmount || inv.amount || 0), 0);
        const formatNaira = (n: number) => `₦${(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

        const getStatusBadge = (status: string) => {
            const config: Record<string, { bg: string; text: string }> = {
                Paid:     { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400' },
                Unpaid:   { bg: 'bg-amber-50 dark:bg-amber-900/20',     text: 'text-amber-600 dark:text-amber-400' },
                Overdue:  { bg: 'bg-rose-50 dark:bg-rose-900/20',       text: 'text-rose-600 dark:text-rose-400' },
                Sent:     { bg: 'bg-blue-50 dark:bg-blue-900/20',       text: 'text-blue-600 dark:text-blue-400' },
                Draft:    { bg: 'bg-slate-100 dark:bg-zinc-700',        text: 'text-slate-600 dark:text-zinc-400' },
            };
            const c = config[status] || config.Draft;
            return (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`}>
                    {status}
                </span>
            );
        };

        return (
            <div className="px-4 sm:px-6 pb-12 space-y-6">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Financials</h2>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">
                        Your invoices and payment history.
                    </p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl p-4 shadow-soft">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">Outstanding</p>
                        <p className={`text-xl font-black mt-1 ${totalOutstanding > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {formatNaira(totalOutstanding)}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl p-4 shadow-soft">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">Paid to Date</p>
                        <p className="text-xl font-black mt-1 text-emerald-600 dark:text-emerald-400">
                            {formatNaira(totalPaid)}
                        </p>
                    </div>
                </div>

                {/* Invoice List */}
                <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3">Invoices</h3>
                    {/* Payment info banner — shown when there are outstanding invoices */}
                    {invoices.length > 0 && totalOutstanding > 0 && (
                        <div className="mb-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/30 text-xs text-amber-800 dark:text-amber-300">
                            <p className="font-bold mb-1">How to Pay</p>
                            <p>Tap "Pay Now" on any outstanding invoice below to view payment instructions. After making payment, tap "I've Paid" to notify your legal team for confirmation.</p>
                        </div>
                    )}
                    {isLoading ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 animate-pulse">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-zinc-700" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-4 bg-slate-100 dark:bg-zinc-700 rounded w-3/4" />
                                            <div className="h-3 bg-slate-100 dark:bg-zinc-700 rounded w-1/2" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : invoices.length === 0 ? (
                        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-8 text-center">
                            <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-zinc-700 flex items-center justify-center mb-3">
                                <Receipt className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
                            </div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">No invoices yet</p>
                            <p className="text-xs text-slate-500 dark:text-zinc-400">
                                Your invoices will appear here once your legal team issues them.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {invoices.map((inv: any) => {
                                const invId = String(inv._id || inv.id);
                                const isUnpaid = inv.status === 'Overdue' || inv.status === 'Unpaid' || inv.status === 'Sent';
                                const isExpanded = expandedInvoiceId === invId;
                                return (
                                    <div key={invId} className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden">
                                        <div className="p-4 flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                                    inv.status === 'Paid'
                                                        ? 'bg-emerald-50 dark:bg-emerald-900/20'
                                                        : inv.status === 'Overdue'
                                                        ? 'bg-rose-50 dark:bg-rose-900/20'
                                                        : 'bg-amber-50 dark:bg-amber-900/20'
                                                }`}>
                                                    <Receipt className={`w-5 h-5 ${
                                                        inv.status === 'Paid'
                                                            ? 'text-emerald-600 dark:text-emerald-400'
                                                            : inv.status === 'Overdue'
                                                            ? 'text-rose-600 dark:text-rose-400'
                                                            : 'text-amber-600 dark:text-amber-400'
                                                    }`} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200 truncate">
                                                        {inv.invoiceNumber || inv.title || 'Invoice'}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                                                        {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : ''}
                                                        {inv.dueDate && ` · Due ${new Date(inv.dueDate).toLocaleDateString()}`}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                <p className="font-bold text-sm text-slate-800 dark:text-zinc-200">
                                                    {formatNaira(inv.totalAmount || inv.amount || 0)}
                                                </p>
                                                {getStatusBadge(inv.status)}
                                            </div>
                                        </div>
                                        {/* Action buttons for unpaid invoices */}
                                        {isUnpaid && (
                                            <div className="px-4 pb-3 flex gap-2">
                                                <button
                                                    onClick={() => setExpandedInvoiceId(isExpanded ? null : invId)}
                                                    className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
                                                >
                                                    {isExpanded ? 'Hide Instructions' : 'Pay Now'}
                                                </button>
                                            </div>
                                        )}
                                        {/* Expandable payment instructions panel */}
                                        {isUnpaid && isExpanded && (
                                            <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-zinc-700 space-y-3">
                                                <div className="bg-slate-50 dark:bg-zinc-700/30 rounded-lg p-3 text-xs space-y-2">
                                                    <p className="font-bold text-slate-700 dark:text-zinc-300">Payment Instructions</p>
                                                    <p className="text-slate-600 dark:text-zinc-400">
                                                        Please transfer {formatNaira(inv.totalAmount || inv.amount || 0)} to your legal team's bank account. Contact them directly if you need their bank details.
                                                    </p>
                                                    <p className="text-slate-500 dark:text-zinc-500 text-[11px]">
                                                        Reference: {inv.invoiceNumber || inv.title || 'Invoice'}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleMarkInvoicePaid(inv)}
                                                    disabled={isMarkingPaid}
                                                    className="w-full px-3 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                                                >
                                                    {isMarkingPaid ? (
                                                        <>
                                                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                            Sending...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircleIcon className="w-4 h-4" />
                                                            I've Made Payment
                                                        </>
                                                    )}
                                                </button>
                                                <p className="text-[10px] text-slate-400 dark:text-zinc-500 text-center">
                                                    This notifies your legal team to confirm receipt
                                                </p>
                                            </div>
                                        )}
                                        {/* Receipt button for paid invoices */}
                                        {inv.status === 'Paid' && (
                                            <div className="px-4 pb-3">
                                                <button
                                                    onClick={() => addToast('Receipt download coming soon. Contact your legal team for a copy.', { type: 'info' })}
                                                    className="w-full px-3 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors inline-flex items-center justify-center gap-2"
                                                >
                                                    <Receipt className="w-3.5 h-3.5" />
                                                    View Receipt
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
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
            case 'financials': return renderFinancials();
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
            {/* Header — minimalist, sticky. When viewing the dashboard, shows
                greeting + utility icons. When viewing a service (Matters, Documents,
                etc.), shows a Back button + the service name. No tab bar —
                navigation is via the Quick Services grid on the dashboard. */}
            <div className="sticky top-0 z-20 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl py-3 px-4 border-b border-slate-100 dark:border-zinc-800/50">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        {/* Back button — shown when viewing a service (not dashboard) */}
                        {activeTab !== 'overview' && (
                            <button
                                onClick={() => handleTabChange('overview')}
                                className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
                                aria-label="Back to dashboard"
                            >
                                <ChevronRightIcon className="w-5 h-5 rotate-180" />
                            </button>
                        )}
                        <div className="min-w-0">
                            {activeTab === 'overview' ? (
                                <>
                                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
                                        {new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening'},
                                    </p>
                                    <h1 className="text-base font-bold text-slate-900 dark:text-white truncate">
                                        {currentUser.name?.split(' ')[0] || 'Client'}
                                    </h1>
                                </>
                            ) : (
                                <h1 className="text-base font-bold text-slate-900 dark:text-white truncate capitalize">
                                    {activeTab === 'requests' ? 'Service Requests' : activeTab}
                                </h1>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                            aria-label="Toggle theme"
                        >
                            {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                        </button>
                        {/* Font-size control */}
                        <PortalFontSizeControl className="hidden md:inline-flex" />
                        {/* Sign Out */}
                        <button
                            onClick={() => logout()}
                            className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                            title="Sign out"
                            aria-label="Sign out"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                            </svg>
                            <span className="hidden sm:inline">Sign Out</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Tab bar REMOVED — navigation is now via the Quick Services grid
                on the dashboard overview. Each box navigates to a full-page view.
                A Back button in the header returns to the dashboard. This is
                simpler, more mobile-friendly, and extensible (admin can add
                new service boxes in the future). */}

            {/* Tab Content */}
            {renderTabContent()}
        </div>
    );
};

export default ClientDashboard;
