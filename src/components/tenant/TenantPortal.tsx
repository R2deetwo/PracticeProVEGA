/**
 * TenantPortal — Atrium Residents' Portal
 *
 * Portal for residents to view their financial ledger,
 * download rent receipts, check SC/MV status, log maintenance tickets
 * (with file attachments), submit payment proof, send messages to their
 * property manager (if enabled), and view inbound messages.
 *
 * Feature-gated: canUseTenantPortal (Atrium Growth+ only)
 * Role-gated: Only users with role === 'Tenant'
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { useFeatures } from '../../hooks/useFeatures';
import NairaSymbol from '../NairaSymbol';
import {
  EyeIcon,
  OfficeBuildingIcon,
  DownloadIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  DocumentIcon,
  MailIcon,
  BellIcon,
  VisitorIcon,
} from '../../constants';
import { Receipt as ReceiptIcon, Home as HomeIcon, Zap as ZapIcon, Wifi as WifiIcon, PlugZap as BoltIcon } from 'lucide-react';
import { VisitorPortal } from '../portal/VisitorPortal';
import { useConfirm } from '../ui/ConfirmDialog';
import { ServiceTypePicker } from '../portal/ServiceTypePicker';
import { PortalFontSizeControl } from '../portal/PortalFontSizeControl';

// ─── Local Icons ──────────────────────────────────────────────────────────────
const ReceiptIconLocal: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
    <path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h5" />
  </svg>
);

const WrenchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const ChatIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

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

const UploadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const PaperclipIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
);

const XCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
);

const SendIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatNaira = (amount: number) => (
  <span className="inline-flex items-center">
    <NairaSymbol />{amount.toLocaleString()}
  </span>
);

const formatDate = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
};

// ─── Tab Type ─────────────────────────────────────────────────────────────────
type TabId = 'dashboard' | 'notices' | 'ledger' | 'receipts' | 'maintenance' | 'messages' | 'payments' | 'documents' | 'visitors';

// ─── Main Component ──────────────────────────────────────────────────────────
const TenantPortal: React.FC = () => {
  const { currentUser, isImpersonating, revertToOriginalUser, logout } = useAuth();
  const { addToast, theme, setTheme } = useUI();
  const { canUseTenantPortal } = useFeatures();

  // ─── Portal theme isolation ──────────────────────────────────────────
  // Portal users ONLY ever see standard light or standard dark — never
  // the admin's custom themes (midnight, oled, neon-cyber, etc.).
  // Separate localStorage key so portal preference is independent of admin.
  const PORTAL_THEME_KEY = 'practicepro_portal_theme';
  React.useEffect(() => {
    const portalTheme = localStorage.getItem(PORTAL_THEME_KEY) as 'light' | 'dark' | null;
    if (portalTheme === 'light' || portalTheme === 'dark') {
      if (theme !== portalTheme) setTheme(portalTheme);
    } else {
      setTheme('light');
      try { localStorage.setItem(PORTAL_THEME_KEY, 'light'); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const hash = window.location.hash.replace('#', '');
    if (['dashboard', 'notices', 'ledger', 'receipts', 'maintenance', 'messages', 'payments', 'documents', 'visitors'].includes(hash)) return hash as TabId;
    return 'dashboard';
  });

  // Repair mutation for fixing missing firmId on portal user records
  const repairFirmId = useMutation(api.portals.repairPortalUserFirmId);
  const relinkToProperty = useMutation(api.portals.relinkPortalUserToProperty);
  const [isRepairing, setIsRepairing] = useState(false);
  const [hasAttemptedRelink, setHasAttemptedRelink] = useState(false);
  const [hasAttemptedFirmRepair, setHasAttemptedFirmRepair] = useState(false);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    window.location.hash = tab;
    // Haptic feedback on tab change
    try { import('../../utils/haptics').then(m => m.haptics.light()); } catch {}
  };

  // Resolve tenant info once at the top level — all sub-tabs can use it
  const firmId = currentUser?.firmId || '';
  const userId = currentUser?.id || '';
  const email = currentUser?.email || '';

  // Fallback: if firmId is missing, try to resolve it from the invite record
  const firmResolution = useQuery(
    api.portals.resolveFirmFromInvite,
    !firmId && email ? { email } : 'skip'
  );
  const effectiveFirmId = firmId || firmResolution?.firmId || '';

  const tenantInfo = useQuery(
    api.portals.getTenantInfo,
    effectiveFirmId && userId ? { firmId: effectiveFirmId, userId, email } : 'skip'
  );

  // Fetch firm portal settings for messaging toggle
  const portalSettings = useQuery(
    api.portals.getFirmPortalSettings,
    effectiveFirmId ? { firmId: effectiveFirmId } : 'skip'
  );

  // ── Self-healing #1: Auto-repair missing firmId ──
  // If the user has no firmId AND the invite resolution also failed, try the
  // repair mutation which searches multiple sources. This is critical because
  // portal access deletion can leave the user without a firmId.
  useEffect(() => {
    if (hasAttemptedFirmRepair) return;
    if (!email) return;
    if (effectiveFirmId) return; // Already have a firmId
    if (firmResolution === undefined) return; // Still loading

    // Both firmId and firmResolution are empty/null — need repair
    setHasAttemptedFirmRepair(true);
    repairFirmId({ email })
      .then((result: any) => {
        if (result.success) {
        } else {
          console.warn('[TenantPortal] Auto-repair failed:', result.message);
        }
      })
      .catch((err: any) => {
        console.warn('[TenantPortal] Auto-repair error:', err);
      });
  }, [effectiveFirmId, firmResolution, email, hasAttemptedFirmRepair]);

  // ── Self-healing #2: Auto-relink tenant to property if tenantInfo is empty ──
  // When getTenantInfo returns an empty result (no matching property/unit found),
  // this could mean the property record's currentTenantId is stale or missing.
  // We attempt a one-time relink to fix the data automatically.
  useEffect(() => {
    if (hasAttemptedRelink) return; // Only try once
    if (!tenantInfo || tenantInfo === undefined) return; // Still loading or no data
    if (!effectiveFirmId || !email) return; // Missing required params

    // Check if tenantInfo has no properties and no units (tenant not found in any property)
    const hasNoData = (!tenantInfo.properties || tenantInfo.properties.length === 0) &&
                      (!tenantInfo.units || tenantInfo.units.length === 0);

    if (hasNoData) {
      setHasAttemptedRelink(true);
      relinkToProperty({ email, firmId: effectiveFirmId })
        .then((result: any) => {
          if (result.success && result.linked) {
          } else {
            console.warn('[TenantPortal] Auto-relink could not find matching property:', result.message);
          }
        })
        .catch((err: any) => {
          console.warn('[TenantPortal] Auto-relink failed:', err);
        });
    }
  }, [tenantInfo, effectiveFirmId, email, hasAttemptedRelink]);

  // ── ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS ──────────────
  // React Rules of Hooks: hooks must be called in the same order on every render.
  // The useState/useEffect below were previously AFTER conditional returns,
  // which caused "Rendered fewer hooks than expected" crashes when firmId
  // resolution changed from loading (undefined) to resolved (null/empty).

  // TODO: Extract isDark detection into a shared useIsDark hook (used in TenantPortal, ClientDashboard, etc.)
  const [systemIsDark, setSystemIsDark] = useState(
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  // Portal users only see standard light or standard dark. Compute isDark
  // based ONLY on the two standard themes so a leaked admin theme is
  // treated as light (not as some broken custom theme).
  const isDark = theme === 'dark';

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    setTheme(newTheme);
    try { localStorage.setItem('practicepro_portal_theme', newTheme); } catch {}
  };

  // ── CONDITIONAL RETURNS (after all hooks) ────────────────────────────────

  // Access guard
  if (!currentUser) return null;

  // CRITICAL: If firmId can't be resolved, show a repair UI instead of infinite skeletons.
  // This happens when the user's firmId was cleared (e.g. during portal access revocation)
  // AND no invite records exist to resolve it from. The repair button calls a backend
  // mutation that searches multiple sources to find and restore the firmId.
  if (!effectiveFirmId && firmResolution !== undefined) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-950 p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mb-4">
            <ExclamationTriangleIcon className="w-8 h-8 text-rose-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Portal Data Unavailable</h3>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
            We couldn't load your portal data. Your account may need to be re-linked to your property manager's firm.
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
                  addToast('Could not auto-repair. Please contact your property manager.', { type: 'error' });
                }
              } catch {
                addToast('Repair failed. Please contact your property manager.', { type: 'error' });
              } finally {
                setIsRepairing(false);
              }
            }}
            disabled={isRepairing}
            className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

  // SAFETY NET: Portal users with a valid Tenant role should ALWAYS be able
  // to access their portal. The canUseTenantPortal feature gate is meant to
  // control whether ADMINS can create portal invites — it should never block
  // an already-authenticated portal user from accessing their own dashboard.
  if (!canUseTenantPortal && currentUser.role !== 'Tenant') {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
            <OfficeBuildingIcon className="w-8 h-8 text-amber-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Residents' Portal Unavailable</h3>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">
            The Residents' Portal is available on Growth and Pro plans. Ask your property manager to upgrade.
          </p>
        </div>
      </div>
    );
  }

  // If tenantInfo loaded but returned no properties/units, and auto-relink already
  // attempted, show a "no property assigned" state instead of infinite loading.
  const hasNoPropertyAssignment = tenantInfo !== undefined &&
    effectiveFirmId &&
    (!tenantInfo.properties || tenantInfo.properties.length === 0) &&
    (!tenantInfo.units || tenantInfo.units.length === 0) &&
    hasAttemptedRelink;

  // ── Unread message count for Messages tab badge ──
  const portalConversations = useQuery(
    api.portals.getPortalConversationsByParticipant,
    userId ? { participantId: userId } : 'skip'
  );
  const unresolvedInboundMsgs = useQuery(
    api.portals.getInboundMessagesByTenant,
    tenantInfo?.tenantId || userId ? { tenantId: tenantInfo?.tenantId || userId } : 'skip'
  );
  const unreadMessageCount = useMemo(() => {
    let count = 0;
    if (portalConversations) {
      for (const conv of portalConversations) {
        count += (conv.unreadByParticipant || 0);
      }
    }
    if (unresolvedInboundMsgs) {
      count += unresolvedInboundMsgs.filter((m: any) => !m.isRead).length;
    }
    return count;
  }, [portalConversations, unresolvedInboundMsgs]);

  const tabs: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Home', icon: <HomeIcon className="w-4 h-4" /> },
    { id: 'notices', label: 'Notices', icon: <BellIcon className="w-4 h-4" /> },
    { id: 'visitors', label: 'Visitors', icon: <VisitorIcon className="w-4 h-4" /> },
    { id: 'ledger', label: 'Ledger', icon: <ReceiptIcon className="w-4 h-4" /> },
    { id: 'receipts', label: 'Receipts', icon: <DownloadIcon className="w-4 h-4" /> },
    { id: 'maintenance', label: 'Maintenance', icon: <WrenchIcon className="w-4 h-4" /> },
    ...(portalSettings?.tenantMessagingEnabled ? [
      { id: 'messages' as TabId, label: 'Messages', icon: <ChatIcon className="w-4 h-4" />, badge: unreadMessageCount || undefined },
    ] : []),
    { id: 'payments', label: 'Payments', icon: <NairaSymbol className="w-4 h-4 inline" /> },
    { id: 'documents', label: 'Documents', icon: <DocumentIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Impersonation Banner — shown when admin is viewing as this tenant.
          Uses isImpersonating (synchronous) rather than originalUser (async query)
          so the banner — and the "Return to Admin" button — is always visible
          during impersonation, even if the admin's DB record is still loading
          or has a missing role. */}
      {isImpersonating && (
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <EyeIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
              You are previewing the portal as <strong>{tenantInfo?.tenantName || currentUser.name || currentUser.email}</strong>
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

      {/* Header — minimalist, sticky. Emulates the reference design's
          clean top bar: greeting on the left, utility icons on the right. */}
      <div className="flex-shrink-0 sticky top-0 z-20 border-b border-slate-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-2xs text-slate-400 dark:text-zinc-500 font-medium">
              {new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening'},
            </p>
            <h1 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {tenantInfo?.tenantName || currentUser.name?.split(' ')[0] || 'Resident'}
            </h1>
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

      {/* Tab Bar */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 sm:px-6">
        <div className="flex gap-0 -mb-px overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap relative ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge && tab.badge > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 bg-emerald-500 text-white text-2xs font-bold rounded-full flex items-center justify-center">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-900">
        {hasNoPropertyAssignment ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
              <OfficeBuildingIcon className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No Property Assignment Found</h3>
            <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md mb-6">
              Your portal account is set up, but you haven't been linked to a specific property or unit yet.
              Please contact your property manager so they can assign you to a property and send you a new portal invitation.
            </p>
            <button
              onClick={async () => {
                setIsRepairing(true);
                try {
                  // First try to repair the firmId (it might be wrong/stale)
                  const firmResult = await repairFirmId({ email });
                  // Then try to relink to property
                  const result = await relinkToProperty({ email, firmId: firmResult?.firmId || effectiveFirmId });
                  if ((result.success && result.linked) || (firmResult?.success && firmResult?.firmId)) {
                    addToast('Account repaired! Refreshing...', { type: 'success' });
                    setTimeout(() => window.location.reload(), 1500);
                  } else {
                    addToast('Could not auto-repair. Please ask your property manager to re-send your portal invitation.', { type: 'error' });
                  }
                } catch {
                  addToast('Repair failed. Please contact your property manager.', { type: 'error' });
                } finally {
                  setIsRepairing(false);
                }
              }}
              disabled={isRepairing}
              className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isRepairing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Repairing...
                </>
              ) : (
                'Try Repair Link'
              )}
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && <TabErrorBoundary tabName="Dashboard"><DashboardTab tenantInfo={tenantInfo} onNavigate={handleTabChange} /></TabErrorBoundary>}
            {activeTab === 'notices' && <TabErrorBoundary tabName="Notices"><NoticesTab tenantInfo={tenantInfo} effectiveFirmId={effectiveFirmId} /></TabErrorBoundary>}
            {activeTab === 'ledger' && <TabErrorBoundary tabName="Ledger"><LedgerTab tenantInfo={tenantInfo} effectiveFirmId={effectiveFirmId} /></TabErrorBoundary>}
            {activeTab === 'receipts' && <TabErrorBoundary tabName="Receipts"><ReceiptsTab tenantInfo={tenantInfo} effectiveFirmId={effectiveFirmId} addToast={addToast} /></TabErrorBoundary>}
            {activeTab === 'maintenance' && <TabErrorBoundary tabName="Maintenance"><MaintenanceTab tenantInfo={tenantInfo} effectiveFirmId={effectiveFirmId} addToast={addToast} /></TabErrorBoundary>}
            {activeTab === 'messages' && <TabErrorBoundary tabName="Messages"><MessagesTab tenantInfo={tenantInfo} effectiveFirmId={effectiveFirmId} portalSettings={portalSettings} addToast={addToast} /></TabErrorBoundary>}
            {activeTab === 'payments' && <TabErrorBoundary tabName="Payments"><PaymentsTab tenantInfo={tenantInfo} effectiveFirmId={effectiveFirmId} addToast={addToast} /></TabErrorBoundary>}
            {activeTab === 'documents' && <TabErrorBoundary tabName="Documents"><DocumentsTab tenantInfo={tenantInfo} effectiveFirmId={effectiveFirmId} addToast={addToast} /></TabErrorBoundary>}
            {activeTab === 'visitors' && <TabErrorBoundary tabName="Visitors"><VisitorPortal firmId={effectiveFirmId} propertyId={tenantInfo?.primaryPropertyId || tenantInfo?.properties?.[0]?.id || ''} propertyName={tenantInfo?.primaryPropertyName || tenantInfo?.properties?.[0]?.name} propertyAddress={tenantInfo?.primaryPropertyAddress || tenantInfo?.properties?.[0]?.address} unitId={tenantInfo?.primaryUnitId || tenantInfo?.units?.[0]?.id} unitName={tenantInfo?.primaryUnitName || tenantInfo?.units?.[0]?.name} residentName={tenantInfo?.tenantName} /></TabErrorBoundary>}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Tab Error Boundary ────────────────────────────────────────────────────────
// Catches rendering errors in individual tabs so a broken tab doesn't crash
// the entire portal. Shows a retry UI with a "Try Again" button.
class TabErrorBoundary extends React.Component<
  { tabName: string; children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[TabErrorBoundary] Error in ${this.props.tabName} tab:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mb-4">
            <ExclamationTriangleIcon className="w-7 h-7 text-rose-500" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
            {this.props.tabName} — Something Went Wrong
          </h3>
          <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md mb-4">
            This section encountered an error. Try refreshing, or contact your property manager if the problem persists.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Shared Tenant Info Hook Helper ──────────────────────────────────────────
// All sub-tabs receive tenantInfo from the parent to avoid duplicate queries

// ─── Dashboard Tab (card-based overview, emulates reference design) ──────────
// Professional card layout: hero card (identity + property) → outstanding
// balance card → quick services grid (pay rent, service charge, electricity,
// internet, maintenance, messages) → recent notices preview.
//
// "Services" here are NOT just requests — they're actionable tiles for
// anything the resident can DO: pay rent, pay service charge, buy electricity,
// pay internet, report maintenance, send a message.
const DashboardTab: React.FC<{ tenantInfo: any; onNavigate: (tab: TabId) => void }> = ({ tenantInfo, onNavigate }) => {
  const { currentUser } = useAuth();
  const formatNaira = (n: number) => `₦${(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  // Derive outstanding balance from tenantInfo (if available)
  const outstandingBalance = tenantInfo?.outstandingBalance || 0;
  const hasOutstanding = outstandingBalance > 0;

  const getInitials = (name?: string) => {
    if (!name) return 'R';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  // Quick services — actionable tiles. These are the things a resident
  // would commonly want to do, NOT just request submission.
  const services: { icon: React.ReactNode; label: string; tab: TabId; color: string }[] = [
    { icon: <NairaSymbol className="w-5 h-5 inline" />, label: 'Pay Rent', tab: 'payments', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
    { icon: <ReceiptIcon className="w-5 h-5" />, label: 'Service Charge', tab: 'ledger', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' },
    { icon: <BoltIcon className="w-5 h-5" />, label: 'Electricity', tab: 'ledger', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
    { icon: <WifiIcon className="w-5 h-5" />, label: 'Internet', tab: 'ledger', color: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400' },
    { icon: <WrenchIcon className="w-5 h-5" />, label: 'Maintenance', tab: 'maintenance', color: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' },
    { icon: <ChatIcon className="w-5 h-5" />, label: 'Messages', tab: 'messages', color: 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400' },
    { icon: <DownloadIcon className="w-5 h-5" />, label: 'Receipts', tab: 'receipts', color: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400' },
    { icon: <DocumentIcon className="w-5 h-5" />, label: 'Documents', tab: 'documents', color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' },
  ];

  return (
    <div className="space-y-5 pb-8">
      {/* ─── Hero Card (brand-primary green) ────────────────────────── */}
      <div className="bg-brand-primary text-white rounded-premium p-5 shadow-premium">
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0">
            <p className="text-2xs font-bold text-white/60 uppercase tracking-widest mb-1">
              Residents' Portal
            </p>
            <h2 className="text-xl font-black tracking-tight truncate">
              {tenantInfo?.tenantName || currentUser?.name?.split(' ')[0] || 'Resident'}
            </h2>
            {tenantInfo?.primaryPropertyName && (
              <p className="text-2xs text-white/50 mt-0.5 truncate">
                {tenantInfo?.primaryUnitName ? `Unit ${tenantInfo.primaryUnitName} · ` : ''}
                {tenantInfo.primaryPropertyName}
              </p>
            )}
          </div>
          <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold">
              {getInitials(tenantInfo?.tenantName || currentUser?.name)}
            </span>
          </div>
        </div>
        {/* Property / Unit badges */}
        {tenantInfo?.primaryPropertyAddress && (
          <div className="flex items-center gap-2 pt-3 border-t border-white/15">
            <OfficeBuildingIcon className="w-4 h-4 text-white/60 flex-shrink-0" />
            <p className="text-2xs text-white/70 truncate">
              {tenantInfo.primaryPropertyAddress}
            </p>
          </div>
        )}
      </div>

      {/* ─── Outstanding Balance Card (light mint) ──────────────────── */}
      <button
        onClick={() => onNavigate('ledger')}
        className="w-full text-left bg-emerald-50 dark:bg-emerald-900/15 rounded-2xl p-5 shadow-soft active:scale-[0.98] transition-transform"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xs font-bold text-emerald-700/70 dark:text-emerald-400/70 uppercase tracking-widest">
              Outstanding Balance
            </p>
            <p className={`text-2xl font-black mt-1 ${hasOutstanding ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-300'}`}>
              {formatNaira(outstandingBalance)}
            </p>
            <p className="text-2xs text-emerald-600/60 dark:text-emerald-400/60 mt-1">
              {hasOutstanding ? 'Tap to view breakdown' : 'All caught up'}
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold flex-shrink-0">
            <ReceiptIcon className="w-3.5 h-3.5" />
            Ledger
          </div>
        </div>
      </button>

      {/* ─── Quick Services Grid ────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3">Quick Services</h3>
        <div className="grid grid-cols-4 gap-3">
          {services.map(service => (
            <button
              key={service.label}
              onClick={() => onNavigate(service.tab)}
              className="flex flex-col items-center gap-2 p-3 bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-2xl shadow-soft active:scale-95 transition-transform"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${service.color}`}>
                {service.icon}
              </div>
              <span className="text-2xs font-semibold text-slate-700 dark:text-zinc-300 text-center leading-tight">
                {service.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Recent Notices Preview ─────────────────────────────────── */}
      <button
        onClick={() => onNavigate('notices')}
        className="w-full text-left bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-2xl p-5 shadow-soft active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BellIcon className="w-4 h-4 text-amber-500" />
            Notices
          </h3>
          <span className="text-2xs font-bold text-emerald-600 dark:text-emerald-400">View All →</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Tap to see notices from your property manager
        </p>
      </button>
    </div>
  );
};

// ─── Notice Board Tab ────────────────────────────────────────────────────────
const NoticesTab: React.FC<{ tenantInfo: any; effectiveFirmId?: string }> = ({ tenantInfo, effectiveFirmId }) => {
  const { currentUser } = useAuth();
  const firmId = effectiveFirmId || currentUser?.firmId || '';

  // Fetch active notices for this firm, scoped to the tenant's property/unit
  const notices = useQuery(
    api.portals.getActiveNotices,
    firmId ? {
      firmId,
      propertyId: tenantInfo?.primaryPropertyId || undefined,
      unitId: tenantInfo?.primaryUnitId || undefined,
    } : 'skip'
  );

  const isLoading = notices === undefined;

  // Priority badge config
  const priorityConfig: Record<string, { bg: string; text: string; label: string; dot: string }> = {
    urgent: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-300', label: 'Urgent', dot: 'bg-rose-500' },
    important: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', label: 'Important', dot: 'bg-amber-500' },
    normal: { bg: 'bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-800', text: 'text-slate-600 dark:text-zinc-400', label: 'General', dot: 'bg-slate-400' },
  };

  if (isLoading) {
    return (
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Notice Board</h3>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">Updates from your property manager</p>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl p-5 border border-slate-200 dark:border-zinc-700 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-3/4 mb-3" />
              <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-full mb-2" />
              <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const activeNotices = notices || [];

  return (
    <div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Notice Board</h3>
      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">Updates from your property manager</p>

      {activeNotices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <BellIcon className="w-7 h-7 text-slate-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400 mb-1">No notices right now</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500">When your property manager posts updates, they'll appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeNotices.map((notice: any) => {
            const pri = priorityConfig[notice.priority] || priorityConfig.normal;
            const isExpired = notice.expiresAt && notice.expiresAt < Date.now();
            return (
              <div
                key={notice._id}
                className={`bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border overflow-hidden transition-colors ${
                  notice.priority === 'urgent'
                    ? 'border-rose-200 dark:border-rose-800/50'
                    : notice.priority === 'important'
                    ? 'border-amber-200 dark:border-amber-800/50'
                    : 'border-slate-200 dark:border-zinc-700'
                }`}
              >
                {/* Pin indicator */}
                {notice.isPinned && (
                  <div className="px-5 pt-3 flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                    </svg>
                    <span className="text-2xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pinned</span>
                  </div>
                )}
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{notice.title}</h4>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold flex-shrink-0 ${pri.bg} ${pri.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${pri.dot}`} />
                      {pri.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{notice.body}</p>
                  <div className="mt-3 flex items-center gap-3 text-2xs text-slate-400 dark:text-zinc-500">
                    {notice.authorName && (
                      <span>Posted by {notice.authorName}</span>
                    )}
                    <span>{formatDate(notice.createdAt)}</span>
                    {notice.expiresAt && (
                      <span className={isExpired ? 'text-rose-500 font-medium' : ''}>
                        {isExpired ? 'Expired' : `Expires ${formatDate(notice.expiresAt)}`}
                      </span>
                    )}
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

// ─── Financial Ledger Tab ────────────────────────────────────────────────────
const LedgerTab: React.FC<{ tenantInfo: any; effectiveFirmId?: string }> = ({ tenantInfo, effectiveFirmId }) => {
  const { currentUser } = useAuth();
  const firmId = effectiveFirmId || currentUser?.firmId || '';
  const userId = currentUser?.id || '';

  const resolvedTenantId = tenantInfo?.tenantId || userId;

  // Fetch ledger entries from Convex using the resolved tenant ID
  const ledgerEntries = useQuery(
    api.portals.getTenantLedger,
    firmId && resolvedTenantId ? { firmId, tenantId: resolvedTenantId, email: currentUser?.email } : 'skip'
  );

  // Fetch service charges from Convex to compute current SC/MV
  const serviceCharges = useQuery(
    api.sentry.getServiceChargesByFirm,
    firmId ? { firmId } : 'skip'
  );

  const isLoading = ledgerEntries === undefined || serviceCharges === undefined;

  // Compute tenant-specific service charges
  const tenantServiceCharges = useMemo(() => {
    if (!serviceCharges || !resolvedTenantId) return [];
    return serviceCharges.filter((sc: any) => sc.tenantId === resolvedTenantId);
  }, [serviceCharges, resolvedTenantId]);

  // Summary calculations
  const currentMonthSC = useMemo(() => {
    return tenantServiceCharges
      .filter((sc: any) => !sc.isMinimumVend)
      .reduce((sum: number, sc: any) => sum + (sc.outstandingBalance ?? sc.amount), 0);
  }, [tenantServiceCharges]);

  const currentMonthMV = useMemo(() => {
    return tenantServiceCharges
      .filter((sc: any) => sc.isMinimumVend)
      .reduce((sum: number, sc: any) => sum + (sc.outstandingBalance ?? sc.amount), 0);
  }, [tenantServiceCharges]);

  const outstandingBalance = useMemo(() => {
    if (!ledgerEntries) return 0;
    return ledgerEntries
      .filter((e: any) => e.status === 'pending' || e.status === 'defaulted')
      .reduce((sum: number, e: any) => sum + e.amount, 0);
  }, [ledgerEntries]);

  const scPaid = tenantServiceCharges.filter((sc: any) => !sc.isMinimumVend && sc.serviceChargeStatus === 'PAID_FULLY').length > 0;
  const mvStatus = tenantServiceCharges.filter((sc: any) => sc.isMinimumVend).length > 0
    ? (tenantServiceCharges.filter((sc: any) => sc.isMinimumVend && sc.serviceChargeStatus === 'PAID_FULLY').length > 0 ? 'paid' : 'pending')
    : null;

  if (isLoading) {
    return (
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl p-4 border border-slate-200 dark:border-zinc-700 animate-pulse">
              <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-24 mb-2" />
              <div className="h-7 bg-slate-200 dark:bg-zinc-700 rounded w-32 mb-1" />
              <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-16" />
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-6 animate-pulse">
          <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-full mb-3" />
          <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-3/4 mb-3" />
          <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-1/2" />
        </div>
      </div>
    );
  }

  const hasLedgerData = ledgerEntries && ledgerEntries.length > 0;
  const hasServiceCharges = tenantServiceCharges.length > 0;

  return (
    <div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Payment Ledger</h3>
      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
        View your rent, Service Charge (SC), and Minimum Vend (MV) obligations and payment status.
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl p-4 border border-slate-200 dark:border-zinc-700">
          <p className="text-2xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">Current Month SC</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatNaira(currentMonthSC)}
          </p>
          {hasServiceCharges && !currentMonthSC ? (
            <span className="inline-flex items-center gap-1 mt-1 text-2xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
              <CheckIcon className="w-3 h-3" /> Paid
            </span>
          ) : currentMonthSC > 0 ? (
            <span className="inline-flex items-center gap-1 mt-1 text-2xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
              <ExclamationTriangleIcon className="w-3 h-3" /> Due
            </span>
          ) : null}
        </div>
        <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl p-4 border border-slate-200 dark:border-zinc-700">
          <p className="text-2xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">Current Month MV</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {currentMonthMV > 0 ? formatNaira(currentMonthMV) : '—'}
          </p>
          {mvStatus === 'paid' ? (
            <span className="inline-flex items-center gap-1 mt-1 text-2xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
              <CheckIcon className="w-3 h-3" /> Paid
            </span>
          ) : mvStatus === 'pending' ? (
            <span className="inline-flex items-center gap-1 mt-1 text-2xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
              <ExclamationTriangleIcon className="w-3 h-3" /> Pending
            </span>
          ) : null}
        </div>
        <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl p-4 border border-slate-200 dark:border-zinc-700">
          <p className="text-2xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">Outstanding Balance</p>
          <p className={`text-2xl font-bold ${outstandingBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {outstandingBalance > 0 ? formatNaira(outstandingBalance) : formatNaira(0)}
          </p>
          {outstandingBalance > 0 && (
            <p className="text-2xs text-slate-400 mt-1">
              {ledgerEntries?.filter((e: any) => e.status === 'pending' || e.status === 'defaulted').length || 0} unpaid {ledgerEntries?.filter((e: any) => e.status === 'pending' || e.status === 'defaulted').length === 1 ? 'entry' : 'entries'}
            </p>
          )}
          {outstandingBalance === 0 && hasLedgerData && (
            <span className="inline-flex items-center gap-1 mt-1 text-2xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
              <CheckIcon className="w-3 h-3" /> All Clear
            </span>
          )}
        </div>
      </div>

      {/* Service Charges Section */}
      {hasServiceCharges && (
        <div className="mb-6">
          <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3">Service Charges</h4>
          <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                    <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Category</th>
                    <th className="text-right px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Amount</th>
                    <th className="text-right px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Outstanding</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Cycle</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tenantServiceCharges.map((sc: any) => {
                    const isMV = sc.isMinimumVend;
                    const statusLabel = sc.serviceChargeStatus === 'PAID_FULLY'
                      ? 'Paid' : sc.serviceChargeStatus === 'PARTIALLY_PAID'
                      ? 'Partial' : 'Unpaid';
                    return (
                      <tr key={sc._id} className="border-b border-slate-100 dark:border-zinc-700/50 last:border-0">
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-zinc-200">
                          {isMV ? (sc.category === 'Other' ? 'Minimum Vend' : sc.category) : sc.category}
                          {isMV && <span className="ml-1 text-3xs text-emerald-500 font-bold">(MV)</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-zinc-300">{formatNaira(sc.amount)}</td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-zinc-300">
                          {formatNaira(sc.outstandingBalance ?? sc.amount)}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500 dark:text-zinc-400 text-xs">{sc.cycle}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold ${
                            sc.serviceChargeStatus === 'PAID_FULLY'
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                              : sc.serviceChargeStatus === 'PARTIALLY_PAID'
                              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                              : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'
                          }`}>
                            {sc.serviceChargeStatus === 'PAID_FULLY'
                              ? <CheckIcon className="w-3 h-3" />
                              : <ExclamationTriangleIcon className="w-3 h-3" />}
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      {hasLedgerData ? (
        <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                  <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Period</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Type</th>
                  <th className="text-right px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Amount</th>
                  <th className="text-center px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Ref</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map((entry: any) => (
                  <tr key={entry._id} className="border-b border-slate-100 dark:border-zinc-700/50 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-zinc-200">
                      {entry.period || formatDate(entry.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-zinc-300 capitalize">
                      {entry.type?.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-zinc-300">
                      {formatNaira(entry.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold ${
                        entry.status === 'cleared'
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                          : entry.status === 'defaulted'
                          ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'
                          : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                      }`}>
                        {entry.status === 'cleared'
                          ? <CheckIcon className="w-3 h-3" />
                          : <ExclamationTriangleIcon className="w-3 h-3" />}
                        {entry.status === 'cleared' ? 'Paid' : entry.status === 'defaulted' ? 'Defaulted' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 dark:text-zinc-500 text-xs font-mono">
                      {entry.txHash || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-zinc-800 dark:bg-zinc-700 flex items-center justify-center mb-3">
            <ReceiptIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">No payment records found</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Your property manager will add ledger entries as payments become due.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Receipts Tab ────────────────────────────────────────────────────────────
const ReceiptsTab: React.FC<{ tenantInfo: any; effectiveFirmId?: string; addToast: (msg: React.ReactNode, opts?: any) => void }> = ({ tenantInfo, effectiveFirmId, addToast }) => {
  const { currentUser } = useAuth();
  const firmId = effectiveFirmId || currentUser?.firmId || '';
  const userId = currentUser?.id || '';
  const resolvedTenantId = tenantInfo?.tenantId || userId;

  // Fetch ledger entries — receipts are cleared entries
  const ledgerEntries = useQuery(
    api.portals.getTenantLedger,
    firmId && resolvedTenantId ? { firmId, tenantId: resolvedTenantId, email: currentUser?.email } : 'skip'
  );

  const isLoading = ledgerEntries === undefined;

  // Filter for cleared entries (these are receipts)
  const receipts = useMemo(() => {
    if (!ledgerEntries) return [];
    return ledgerEntries.filter((e: any) => e.status === 'cleared');
  }, [ledgerEntries]);

  const handleDownload = (entry: any) => {
    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Receipt</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1e293b; }
          .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 20px; }
          .header h1 { font-size: 24px; font-weight: 800; margin: 0 0 4px; color: #1e293b; }
          .header p { color: #64748b; font-size: 13px; margin: 0; }
          .receipt-details { background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
          .row:last-child { border-bottom: none; }
          .label { color: #64748b; font-size: 13px; }
          .value { font-weight: 600; font-size: 13px; }
          .amount { font-size: 28px; font-weight: 800; color: #10b981; text-align: center; margin: 20px 0; }
          .footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          .badge { display: inline-block; background: #ecfdf5; color: #059669; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Practice<span style="color:#f59e0b">Pro</span> <span style="color:#8b5cf6;font-size:13px">ATRIUM</span></h1>
          <p>Official Payment Receipt</p>
        </div>
        <div class="amount">₦${(entry.amount || 0).toLocaleString('en-NG')}</div>
        <div class="receipt-details">
          <div class="row"><span class="label">Receipt No</span><span class="value">RCP-${String(entry._id || '').slice(-8).toUpperCase()}</span></div>
          <div class="row"><span class="label">Date</span><span class="value">${new Date(entry.timestamp || Date.now()).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
          <div class="row"><span class="label">Description</span><span class="value">${entry.description || entry.type?.replace(/_/g, ' ') || 'Payment'}</span></div>
          <div class="row"><span class="label">Period</span><span class="value">${entry.period || 'N/A'}</span></div>
          <div class="row"><span class="label">Type</span><span class="value">${(entry.type || 'payment').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</span></div>
          <div class="row"><span class="label">Status</span><span class="value"><span class="badge">PAID</span></span></div>
          ${tenantInfo?.primaryPropertyName ? `<div class="row"><span class="label">Property</span><span class="value">${tenantInfo.primaryPropertyName}</span></div>` : ''}
          ${tenantInfo?.primaryUnitName ? `<div class="row"><span class="label">Unit</span><span class="value">${tenantInfo.primaryUnitName}</span></div>` : ''}
          <div class="row"><span class="label">Tenant</span><span class="value">${currentUser?.name || 'N/A'}</span></div>
          ${entry.paymentRef ? `<div class="row"><span class="label">Reference</span><span class="value">${entry.paymentRef}</span></div>` : ''}
        </div>
        <div class="footer">
          <p>This is an official receipt generated by PracticePro Atrium.</p>
          <p>PracticePro Systems Ltd · Lagos, Nigeria</p>
          <p>NDPA 2023 Compliant · AES-256 Encrypted</p>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
    } else {
      addToast('Please allow popups to print your receipt.', { type: 'error' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-zinc-700" />
              <div className="flex-1">
                <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-48 mb-2" />
                <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-32" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Payment Receipts</h3>
      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
        View and download PDF receipts for your completed payments.
      </p>

      {receipts.length > 0 ? (
        <div className="space-y-3">
          {receipts.map((r: any) => (
            <div
              key={r._id}
              className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                  <ReceiptIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0 sm:min-w-0">
                  <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200">
                    {r.description || `${r.type?.replace('_', ' ')} — ${r.period || formatDate(r.timestamp)}`}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {formatDate(r.timestamp)} · {formatNaira(r.amount)}
                    {r.paymentRef && <span className="ml-2">Ref: {r.paymentRef}</span>}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDownload(r)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
              >
                <DownloadIcon className="w-3.5 h-3.5" /> Print Receipt
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-zinc-800 dark:bg-zinc-700 flex items-center justify-center mb-3">
            <DownloadIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">No receipts yet</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Receipts will appear here after your payments are confirmed.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Maintenance Tab ─────────────────────────────────────────────────────────
const MaintenanceTab: React.FC<{ tenantInfo: any; effectiveFirmId?: string; addToast: (msg: React.ReactNode, opts?: any) => void }> = ({ tenantInfo, effectiveFirmId, addToast }) => {
  const { currentUser } = useAuth();
  const firmId = effectiveFirmId || currentUser?.firmId || '';
  const userId = currentUser?.id || '';
  const resolvedTenantId = tenantInfo?.tenantId || userId;

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  // Selected admin-configured request type (key). Falls back to "other".
  const [selectedTypeKey, setSelectedTypeKey] = useState<string>('other');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch admin-configured service request types (with sensible defaults
  // returned by the backend if the firm hasn't configured any yet).
  const requestTypes = useQuery(
    api.portals.getServiceRequestTypes,
    firmId ? { firmId, portalType: 'resident' as const } : 'skip'
  );

  // Fetch tickets from Convex
  const tickets = useQuery(
    api.portals.getMaintenanceTicketsByTenant,
    resolvedTenantId ? { tenantId: resolvedTenantId } : 'skip'
  );

  // Mutation for creating a ticket
  const createTicket = useMutation(api.portals.createMaintenanceTicket);
  const cancelTicket = useMutation(api.portals.cancelMaintenanceTicket);
  // Get upload URL mutation
  const generateUploadUrl = useMutation(api.myFunctions.generateUploadUrl);

  // Cancel ticket state
  const [cancellingTicketId, setCancellingTicketId] = useState<string | null>(null);
  const [cancelNote, setCancelNote] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelTicket = async (ticketId: string) => {
    if (!cancelNote.trim()) {
      addToast('Please enter a reason for cancelling.', { type: 'info' });
      return;
    }
    if (!currentUser?.id) return;
    setIsCancelling(true);
    try {
      await cancelTicket({
        ticketId: ticketId as any,
        cancellationNote: cancelNote.trim(),
        cancelledBy: currentUser.id,
      });
      addToast('Ticket cancelled. Your property manager has been notified.', { type: 'success' });
      setCancellingTicketId(null);
      setCancelNote('');
    } catch (err: any) {
      addToast(err.message || 'Failed to cancel ticket.', { type: 'error' });
    } finally {
      setIsCancelling(false);
    }
  };

  // Use tenantInfo to resolve property and unit IDs
  // This is the KEY FIX: we no longer use coreState (which is empty for portal users)
  const propertyId = tenantInfo?.primaryPropertyId;
  const unitId = tenantInfo?.primaryUnitId;

  // Derive the selected type's full metadata (label, icon, defaultPriority)
  const selectedType = useMemo(() => {
    if (!requestTypes || requestTypes.length === 0) return null;
    return requestTypes.find((t: any) => t.key === selectedTypeKey) || requestTypes[0];
  }, [requestTypes, selectedTypeKey]);

  // Map a request type key back to one of the legacy `category` literals.
  // The schema still requires one of plumbing/electrical/structural/other —
  // we use this as a fallback for tickets created without a custom type.
  const mapKeyToLegacyCategory = (key: string): 'plumbing' | 'electrical' | 'structural' | 'other' => {
    if (key === 'plumbing') return 'plumbing';
    if (key === 'electrical') return 'electrical';
    if (key === 'structural') return 'structural';
    return 'other';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // Validate file types: images and PDFs only
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const validFiles = files.filter(f => {
      if (!validTypes.includes(f.type)) {
        addToast(`"${f.name}" is not a supported file type. Use images or PDFs.`, { type: 'error' });
        return false;
      }
      if (f.size > maxSize) {
        addToast(`"${f.name}" exceeds 10MB limit.`, { type: 'error' });
        return false;
      }
      return true;
    });
    setPendingFiles(prev => [...prev, ...validFiles]);
    // Reset the input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      addToast('Please fill in all fields before submitting.', { type: 'info' });
      return;
    }
    // Distinguish between tenantInfo still loading vs genuinely no property linked
    if (tenantInfo === undefined) {
      addToast('Still loading your property information. Please try again in a moment.', { type: 'info' });
      return;
    }
    if (!propertyId) {
      addToast('No property linked to your account. Please contact your property manager to ensure your unit is properly assigned.', { type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload files to Convex storage if any
      let attachmentStorageIds: string[] = [];
      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          try {
            const postUrl = await generateUploadUrl();
            const res = await fetch(postUrl, {
              method: 'POST',
              body: file,
            });
            if (res.ok) {
              const { storageId } = await res.json();
              if (storageId) attachmentStorageIds.push(storageId);
            }
          } catch (uploadErr) {
            console.warn('File upload failed:', uploadErr);
          }
        }
      }

      // Resolve the type metadata for the backend — pass both the new
      // requestTypeKey/Label AND a legacy `category` literal so older
      // practitioner UI that filters by `category` still works.
      const typeLabel = selectedType?.label || selectedTypeKey;
      const legacyCategory = mapKeyToLegacyCategory(selectedTypeKey);

      await createTicket({
        firmId,
        propertyId,
        unitId: unitId || undefined,
        tenantId: resolvedTenantId,
        tenantName: currentUser?.name || undefined,
        subject: subject.trim(),
        description: description.trim(),
        category: legacyCategory,
        requestTypeKey: selectedTypeKey,
        requestTypeLabel: typeLabel,
        attachments: attachmentStorageIds.length > 0 ? attachmentStorageIds : undefined,
      });
      addToast('Maintenance ticket submitted successfully. Your property manager has been notified.', { type: 'success' });
      setSubject('');
      setDescription('');
      setSelectedTypeKey('other');
      setPendingFiles([]);
    } catch (err: any) {
      addToast(err.message || 'Failed to submit ticket. Please try again.', { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = tickets === undefined;

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      open: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', label: 'Open' },
      in_progress: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', label: 'In Progress' },
      resolved: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', label: 'Resolved' },
      closed: { bg: 'bg-slate-100 dark:bg-zinc-800 dark:bg-zinc-700', text: 'text-slate-600 dark:text-zinc-400', label: 'Closed' },
      cancelled: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-600 dark:text-rose-400', label: 'Cancelled' },
    };
    const c = config[status] || config.open;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold ${c.bg} ${c.text}`}>
        {status === 'resolved' || status === 'closed' ? <CheckIcon className="w-3 h-3" /> : status === 'cancelled' ? <XCircleIcon className="w-3 h-3" /> : <ExclamationTriangleIcon className="w-3 h-3" />}
        {c.label}
      </span>
    );
  };

  return (
    <div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Maintenance Tickets</h3>
      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
        Log maintenance issues directly into your property manager's workflow.
      </p>

      {/* Property/Unit Info Banner */}
      {tenantInfo?.primaryPropertyName && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 text-sm">
          <div className="flex items-center gap-2">
            <OfficeBuildingIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="text-emerald-800 dark:text-emerald-300 font-medium">
              {tenantInfo.primaryUnitName
                ? `Unit ${tenantInfo.primaryUnitName} in ${tenantInfo.primaryPropertyName}`
                : tenantInfo.primaryPropertyName}
            </span>
          </div>
        </div>
      )}

      {/* New Ticket Form */}
      <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-5 mb-6">
        <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3">Report New Issue</h4>
        <div className="space-y-3">
          <div>
            {requestTypes === undefined ? (
              <>
                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-2">Request Type</label>
                <div className="h-12 rounded-lg bg-slate-100 dark:bg-zinc-800 dark:bg-zinc-700 animate-pulse" />
              </>
            ) : requestTypes && requestTypes.length > 0 ? (
              <ServiceTypePicker
                options={requestTypes as any}
                selectedKey={selectedTypeKey}
                onChange={setSelectedTypeKey}
                label="Request Type"
                placeholder="Select a request type"
              />
            ) : (
              <p className="text-xs text-slate-400">No request types configured. Please contact your property manager.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g., Leaking roof in bedroom"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the issue in detail..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            />
          </div>
          {/* File Attachments */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Attachments (Optional)</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-lg p-4 text-center cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors"
            >
              <UploadIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500 mx-auto mb-2" />
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                Click to upload photos or PDFs
              </p>
              <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-1">
                JPG, PNG, GIF, WebP, PDF · Max 10MB each
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            {/* Show selected files */}
            {pendingFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {pendingFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-800 rounded-lg">
                    <PaperclipIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-700 dark:text-zinc-300 flex-1 truncate">{file.name}</span>
                    <span className="text-2xs text-slate-400">{(file.size / 1024).toFixed(0)}KB</span>
                    <button onClick={() => removeFile(idx)} className="text-rose-500 hover:text-rose-700">
                      <XCircleIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </div>
      </div>

      {/* Existing Tickets */}
      <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3">Your Tickets</h4>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-zinc-700" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-40 mb-2" />
                  <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : tickets && tickets.length > 0 ? (
        <div className="space-y-2">
          {tickets.map((t: any) => {
            // Look up the icon for this ticket's request type
            const typeMeta = (requestTypes as any[] | undefined)?.find((rt: any) => rt.key === t.requestTypeKey);
            const iconChar = typeMeta?.icon || '🔧';
            const typeLabel = t.requestTypeLabel || (t.category ? t.category.charAt(0).toUpperCase() + t.category.slice(1) : 'Maintenance');
            const canCancel = t.status === 'open' || t.status === 'in_progress';
            const isCancellingThis = cancellingTicketId === String(t._id);
            return (
            <div
              key={t._id}
              className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden"
            >
              <div className="p-4 flex flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${
                    t.status === 'resolved' || t.status === 'closed'
                      ? 'bg-emerald-50 dark:bg-emerald-900/20'
                      : t.status === 'cancelled'
                      ? 'bg-rose-50 dark:bg-rose-900/20'
                      : t.status === 'in_progress'
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'bg-amber-50 dark:bg-amber-900/20'
                  }`}>
                    {iconChar}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200 truncate">{t.subject}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      <span className="font-medium text-slate-600 dark:text-zinc-300">{typeLabel}</span>
                      {' · '}
                      {formatDate(t.createdAt)}
                      {t.images?.length > 0 && <span className="ml-1">· <PaperclipIcon className="w-3 h-3 inline" /> {t.images.length}</span>}
                    </p>
                    {t.cancellationNote && (
                      <p className="text-2xs text-rose-500 dark:text-rose-400 mt-1 italic">
                        Cancelled: {t.cancellationNote}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">{getStatusBadge(t.status)}</div>
              </div>
              {/* Cancel button for open/in_progress tickets */}
              {canCancel && (
                <div className="px-4 pb-3">
                  <button
                    onClick={() => {
                      setCancellingTicketId(isCancellingThis ? null : String(t._id));
                      setCancelNote('');
                    }}
                    className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {isCancellingThis ? 'Hide' : 'Cancel Ticket'}
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
                      onClick={() => { setCancellingTicketId(null); setCancelNote(''); }}
                      className="flex-1 px-3 py-2 text-xs font-bold text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 dark:bg-zinc-700 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors"
                    >
                      Keep Ticket
                    </button>
                    <button
                      onClick={() => handleCancelTicket(String(t._id))}
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
        <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-zinc-800 dark:bg-zinc-700 flex items-center justify-center mb-3">
            <WrenchIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">No maintenance tickets</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Use the form above to report any issues in your unit.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Messages Tab ────────────────────────────────────────────────────────────
const MessagesTab: React.FC<{ tenantInfo: any; effectiveFirmId?: string; portalSettings: any; addToast: (msg: React.ReactNode, opts?: any) => void }> = ({ tenantInfo, effectiveFirmId, portalSettings, addToast }) => {
  const { currentUser } = useAuth();
  const userId = currentUser?.id || '';
  const firmId = effectiveFirmId || currentUser?.firmId || '';
  const email = currentUser?.email || '';
  const resolvedTenantId = tenantInfo?.tenantId || userId;
  const { confirm, ConfirmDialog } = useConfirm();

  // Conversation-based queries
  const conversations = useQuery(
    api.portals.getPortalConversationsByParticipant,
    userId ? { participantId: userId } : 'skip'
  );

  // Also fetch legacy inbound messages (WhatsApp/Email from PM)
  const inboundMessages = useQuery(
    api.portals.getInboundMessagesByTenant,
    resolvedTenantId ? { tenantId: resolvedTenantId } : 'skip'
  );

  // Active conversation messages
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const conversationMessages = useQuery(
    api.portals.getConversationMessages,
    activeConversationId ? { conversationId: activeConversationId } : 'skip'
  );

  // Mutations
  const sendMessage = useMutation(api.portals.sendPortalMessage);
  const markRead = useMutation(api.portals.markConversationReadByParticipant);
  // Uses the proper batch mutation api.portals.markInboundMessagesReadByTenant
  // (deployed via Task 8 npx convex deploy) to mark ALL unread inbound
  // messages as read in a single call. More efficient than the per-message
  // api.sentry.markMessageAsRead workaround used before Convex was deployed.
  const markInboundRead = useMutation(api.portals.markInboundMessagesReadByTenant);
  const deleteMessage = useMutation(api.portals.softDeletePortalMessage);
  const generateUploadUrl = useMutation(api.myFunctions.generateUploadUrl);

  // State
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<{ file: File; name: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (conversationMessages && conversationMessages.length > 0) {
      const timer = setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      return () => clearTimeout(timer);
    }
  }, [conversationMessages]);

  // Mark conversation as read when opened
  useEffect(() => {
    if (activeConversationId) {
      markRead({ conversationId: activeConversationId }).catch(() => {});
    }
  }, [activeConversationId]);

  // ── BUG FIX (Task 10 + Task 11): Clear the unread inbound-messages badge ──
  // When the tenant opens the Messages tab, mark all their unread
  // atrium_inbound_messages as read. This clears the red notification badge
  // on the Messages tab.
  //
  // Uses api.portals.markInboundMessagesReadByTenant (deployed via Task 8
  // npx convex deploy) — a single batch call that marks ALL unread messages
  // for this tenant as read. More efficient than the per-message workaround.
  //
  // Falls back gracefully: if the mutation fails (e.g. Convex not yet
  // deployed), the badge won't clear but no crash occurs.
  useEffect(() => {
    if (!inboundMessages || inboundMessages.length === 0) return;
    const unreadMessages = (inboundMessages as any[]).filter((m: any) => !m.isRead);
    if (unreadMessages.length === 0) return;
    // Fire-and-forget — non-blocking. markInboundMessagesReadByTenant takes
    // tenantId (Convex _id or email — mirrors getInboundMessagesByTenant's
    // lookup logic).
    markInboundRead({ tenantId: resolvedTenantId }).catch(() => {});
    // Also try by email — legacy data may be indexed by both tenantId and email.
    if (email && email !== resolvedTenantId) {
      markInboundRead({ tenantId: email }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboundMessages]);

  // Resolve file URLs for attachments using Convex query
  const [urlStorageIds, setUrlStorageIds] = useState<string[]>([]);
  const fileUrlResults = useQuery(
    api.myFunctions.getFileUrl,
    urlStorageIds.length > 0 ? { storageId: urlStorageIds[0] } : 'skip'
  );
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});

  // Collect unique storage IDs from conversation messages
  useEffect(() => {
    if (!conversationMessages) return;
    const ids = new Set<string>();
    for (const msg of conversationMessages) {
      if (msg.attachments) {
        for (const sid of msg.attachments) {
          if (!fileUrls[sid]) ids.add(sid);
        }
      }
    }
    setUrlStorageIds(Array.from(ids));
  }, [conversationMessages]);

  // Resolve file URLs one at a time
  useEffect(() => {
    if (fileUrlResults && urlStorageIds.length > 0) {
      setFileUrls(prev => ({ ...prev, [urlStorageIds[0]]: fileUrlResults }));
      setUrlStorageIds(prev => prev.slice(1));
    }
  }, [fileUrlResults, urlStorageIds]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const validFiles = files.filter(f => {
      if (f.size > maxSize) {
        addToast(`"${f.name}" exceeds 10MB limit.`, { type: 'error' });
        return false;
      }
      return true;
    });
    setPendingFiles(prev => [...prev, ...validFiles.map(f => ({ file: f, name: f.name }))]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if (!messageContent.trim() && pendingFiles.length === 0) {
      addToast('Please type a message or attach a file.', { type: 'info' });
      return;
    }
    setIsSending(true);
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
            if (storageId) {
              storageIds.push(storageId);
              fileNames.push(name);
            }
          }
        } catch (uploadErr) {
          console.warn('File upload failed:', uploadErr);
        }
      }

      await sendMessage({
        firmId,
        senderId: userId,
        senderName: currentUser?.name,
        senderEmail: email,
        senderRole: 'Tenant',
        content: messageContent.trim(),
        attachments: storageIds.length > 0 ? storageIds : undefined,
        attachmentNames: fileNames.length > 0 ? fileNames : undefined,
        propertyId: tenantInfo?.primaryPropertyId || undefined,
        unitId: tenantInfo?.primaryUnitId || undefined,
        // THREADING FIX: Pass the active conversation ID so the message
        // continues in the same thread instead of creating a new one.
        conversationId: activeConversationId || undefined,
      });
      setMessageContent('');
      setPendingFiles([]);
    } catch (err: any) {
      addToast(err.message || 'Failed to send message.', { type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Get the active conversation object
  const activeConversation = conversations?.find((c: any) => String(c._id) === activeConversationId);

  // Format time for chat bubbles
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isLoading = conversations === undefined;

  // ─── Chat View (when a conversation is active) ────────────────────────
  if (activeConversationId && activeConversation) {
    return (
      <div className="flex flex-col h-[calc(100dvh-220px)] min-h-[400px] min-h-0">
        {/* Chat header */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-t-xl">
          <button
            onClick={() => setActiveConversationId(null)}
            className="p-1.5 -ml-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
              {(activeConversation.participantName || 'PM').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              Property Manager
            </h4>
            <p className="text-2xs text-slate-500 dark:text-zinc-400">
              {activeConversation.unitId
                ? `Unit ${tenantInfo?.primaryUnitName || activeConversation.unitId}`
                : activeConversation.propertyId ? 'Property conversation' : 'General'}
            </p>
          </div>
          {(activeConversation.unreadByParticipant || 0) > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 bg-emerald-500 text-white text-2xs font-bold rounded-full flex items-center justify-center">
              {activeConversation.unreadByParticipant}
            </span>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-900 custom-scrollbar">
          {conversationMessages === undefined ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : conversationMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ChatIcon className="w-10 h-10 text-slate-300 dark:text-zinc-600 mb-2" />
              <p className="text-sm text-slate-400">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            // BUG FIX (Task 10): Filter out isDeleted messages — the backend
            // softDeletePortalMessage mutation marks them as isDeleted:true
            // but getConversationMessages still returns them. Without this
            // filter, deleted messages would stay visible forever (the user's
            // "delete doesn't work" complaint).
            conversationMessages
              .filter((msg: any) => !msg.isDeleted)
              .map((msg: any) => {
              const isMe = msg.senderId === userId;
              const isDeleted = msg.isDeleted;

              // Show deleted placeholder for soft-deleted messages
              if (isDeleted) {
                return (
                  <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      isMe
                        ? 'bg-emerald-600/20 text-emerald-300/60 dark:text-emerald-400/40 rounded-tr-none italic'
                        : 'bg-slate-100 dark:bg-zinc-800/50 text-slate-400 dark:text-zinc-500 border border-slate-200/50 dark:border-zinc-700/50 rounded-tl-none italic'
                    }`}>
                      <p className="text-xs">This message was deleted</p>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] ${isMe ? 'order-2' : 'order-1'}`}>
                    {/* Sender label */}
                    <div className={`flex items-center gap-1.5 mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-2xs font-bold text-slate-400 dark:text-zinc-500">
                        {isMe ? 'You' : (msg.senderName || 'Property Manager')}
                      </span>
                      <span className="text-2xs text-slate-300 dark:text-zinc-600">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                    {/* Bubble */}
                    <div className={`group relative rounded-2xl px-4 py-2.5 shadow-sm ${
                      isMe
                        ? 'bg-emerald-600 text-white rounded-tr-none'
                        : 'bg-white dark:bg-zinc-900 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 rounded-tl-none'
                    }`}>
                      <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>

                      {/* Delete button — only shown for own messages on hover */}
                      {isMe && (
                        <button
                          onClick={async () => {
                            if (deletingMessageId === String(msg._id)) return;
                            // IN-APP confirmation (replaces browser confirm)
                            // — the user explicitly requested no more browser
                            // messages. The ConfirmDialog is rendered at the
                            // bottom of the MessagesTab return statement.
                            const ok = await confirm({
                              title: 'Delete this message?',
                              message: 'The message will be removed from this conversation for you. The property manager will still have a record for their files.',
                              confirmLabel: 'Delete',
                              cancelLabel: 'Cancel',
                              danger: true,
                            });
                            if (!ok) return;
                            setDeletingMessageId(String(msg._id));
                            try {
                              await deleteMessage({ messageId: String(msg._id), requesterId: userId });
                              addToast('Message deleted.', { type: 'success', duration: 2500 });
                            } catch (err: any) {
                              addToast(err.message || 'Failed to delete message.', { type: 'error' });
                            } finally {
                              setDeletingMessageId(null);
                            }
                          }}
                          className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 w-5 h-5 bg-slate-200 dark:bg-zinc-700 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-500 hover:text-rose-500 rounded-full flex items-center justify-center transition-all"
                          title="Delete message"
                        >
                          {deletingMessageId === String(msg._id) ? (
                            <span className="w-3 h-3 border border-slate-400 border-t-slate-600 rounded-full animate-spin" />
                          ) : (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </button>
                      )}

                      {/* Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {msg.attachments.map((storageId: string, idx: number) => {
                            const fileName = msg.attachmentNames?.[idx] || `File ${idx + 1}`;
                            const fileUrl = fileUrls[storageId];
                            const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);
                            return (
                              <div key={storageId + idx} className={`rounded-lg overflow-hidden ${
                                isMe ? 'bg-emerald-500/30' : 'bg-slate-100 dark:bg-zinc-800 dark:bg-zinc-700'
                              }`}>
                                {isImage && fileUrl ? (
                                  <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                                    <img src={fileUrl} alt={fileName} className="max-w-full max-h-48 object-contain rounded" />
                                  </a>
                                ) : (
                                  <a
                                    href={fileUrl || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-2 px-3 py-2 text-xs font-medium ${
                                      isMe ? 'text-emerald-100' : 'text-slate-600 dark:text-zinc-300'
                                    }`}
                                  >
                                    <DocumentIcon className="w-4 h-4 flex-shrink-0" />
                                    <span className="truncate">{fileName}</span>
                                    <DownloadIcon className="w-3.5 h-3.5 flex-shrink-0 ml-auto" />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Compose area (only if messaging is enabled) */}
        {portalSettings?.tenantMessagingEnabled && (
          <div className="flex-shrink-0 border-t border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-b-xl">
            {/* Pending files preview */}
            {pendingFiles.length > 0 && (
              <div className="px-3 pt-2 flex gap-2 flex-wrap">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 dark:bg-zinc-700 rounded-lg px-2.5 py-1.5 text-xs">
                    <PaperclipIcon className="w-3 h-3 text-slate-400" />
                    <span className="max-w-[120px] truncate text-slate-700 dark:text-zinc-300">{f.name}</span>
                    <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500 ml-0.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 p-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                title="Attach file"
              >
                <PaperclipIcon className="w-5 h-5" />
              </button>
              <textarea
                value={messageContent}
                onChange={e => setMessageContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none max-h-32"
                style={{ minHeight: '40px' }}
              />
              <button
                onClick={handleSendMessage}
                disabled={isSending || (!messageContent.trim() && pendingFiles.length === 0)}
                className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {isSending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <SendIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Conversation List View ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-700" />
              <div className="flex-1">
                <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-3/4 mb-2" />
                <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Messages</h3>
      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
        {portalSettings?.tenantMessagingEnabled
          ? `Conversations with your property manager${tenantInfo?.primaryUnitName ? ` (Unit ${tenantInfo.primaryUnitName})` : ''}.`
          : 'Recent messages from your property manager.'}
      </p>

      {/* Quick send (only if messaging is enabled and no active conversation) */}
      {portalSettings?.tenantMessagingEnabled && (
        <div className="mb-6">
          {/* If there's an existing conversation, show a button to open it */}
          {conversations && conversations.length > 0 ? (
            <button
              onClick={() => setActiveConversationId(String(conversations[0]._id))}
              className="w-full flex items-center gap-3 bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                <ChatIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white">Continue Conversation</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                  {conversations[0].lastMessagePreview || 'No messages yet'}
                </p>
              </div>
              {(conversations[0].unreadByParticipant || 0) > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 bg-emerald-500 text-white text-2xs font-bold rounded-full flex items-center justify-center">
                  {conversations[0].unreadByParticipant}
                </span>
              )}
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            /* No conversation yet — inline compose to start one */
            <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4">
              <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-2">Start a Conversation</h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">
                Contact your property manager directly.
              </p>
              <div className="flex items-end gap-2">
                <textarea
                  value={messageContent}
                  onChange={e => setMessageContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  rows={2}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isSending || !messageContent.trim()}
                  className="self-end px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <SendIcon className="w-3.5 h-3.5" />
                  {isSending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inbound messages (WhatsApp/Email from PM — these come via Chakra) */}
      {inboundMessages && inboundMessages.length > 0 && (
        <div className="mb-6">
          <h4 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
            Incoming Messages
          </h4>
          <div className="space-y-2">
            {inboundMessages.map((msg: any) => (
              <div
                key={msg._id}
                className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-3"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    msg.channel === 'whatsapp' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-blue-50 dark:bg-blue-900/20'
                  }`}>
                    {msg.channel === 'whatsapp' ? (
                      <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    ) : (
                      <MailIcon className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">
                        {msg.senderName || 'Property Manager'}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-3xs font-bold uppercase ${
                        msg.channel === 'whatsapp' ? 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30' : 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30'
                      }`}>
                        {msg.channel || 'message'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-zinc-300 break-words">{msg.content}</p>
                    <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-1">
                      {formatDate(msg.receivedAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!conversations || conversations.length === 0) && (!inboundMessages || inboundMessages.length === 0) && (
        <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-zinc-800 dark:bg-zinc-700 flex items-center justify-center mb-3">
            <ChatIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">No messages</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {portalSettings?.tenantMessagingEnabled
              ? 'Start a conversation with your property manager.'
              : 'No messages from your property manager.'}
          </p>
        </div>
      )}
      {/* In-app confirmation dialog — replaces browser window.confirm() */}
      {ConfirmDialog}
    </div>
  );
};

// ─── Payments Tab (Upload Payment Proof) ─────────────────────────────────────
const PaymentsTab: React.FC<{ tenantInfo: any; effectiveFirmId?: string; addToast: (msg: React.ReactNode, opts?: any) => void }> = ({ tenantInfo, effectiveFirmId, addToast }) => {
  const { currentUser } = useAuth();
  const firmId = effectiveFirmId || currentUser?.firmId || '';
  const userId = currentUser?.id || '';
  const resolvedTenantId = tenantInfo?.tenantId || userId;

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitProof = useMutation(api.portals.submitPaymentProof);
  const generateUploadUrl = useMutation(api.myFunctions.generateUploadUrl);

  // Fetch existing payment proofs
  const paymentProofs = useQuery(
    api.portals.getPaymentProofsByTenant,
    resolvedTenantId ? { tenantId: resolvedTenantId } : 'skip'
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const validFiles = files.filter(f => {
      if (!validTypes.includes(f.type)) {
        addToast(`"${f.name}" is not a supported file type. Use images or PDFs.`, { type: 'error' });
        return false;
      }
      if (f.size > maxSize) {
        addToast(`"${f.name}" exceeds 10MB limit.`, { type: 'error' });
        return false;
      }
      return true;
    });
    setPendingFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (pendingFiles.length === 0) {
      addToast('Please upload at least one payment proof file.', { type: 'info' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload files to Convex storage
      const storageIds: string[] = [];
      for (const file of pendingFiles) {
        try {
          const postUrl = await generateUploadUrl();
          const res = await fetch(postUrl, {
            method: 'POST',
            body: file,
          });
          if (res.ok) {
            const { storageId } = await res.json();
            if (storageId) storageIds.push(storageId);
          }
        } catch (uploadErr) {
          console.warn('File upload failed:', uploadErr);
        }
      }

      if (storageIds.length === 0) {
        addToast('Failed to upload files. Please try again.', { type: 'error' });
        setIsSubmitting(false);
        return;
      }

      await submitProof({
        firmId,
        tenantId: resolvedTenantId,
        tenantName: currentUser?.name || undefined,
        tenantEmail: currentUser?.email || undefined,
        propertyId: tenantInfo?.primaryPropertyId || undefined,
        unitId: tenantInfo?.primaryUnitId || undefined,
        amount: amount ? parseFloat(amount) : undefined,
        period: period.trim() || undefined,
        description: description.trim() || undefined,
        storageIds,
      });

      addToast('Payment proof submitted successfully. Your property manager will review it and issue an official receipt.', { type: 'success' });
      setDescription('');
      setAmount('');
      setPeriod('');
      setPendingFiles([]);
    } catch (err: any) {
      addToast(err.message || 'Failed to submit payment proof.', { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"><CheckIcon className="w-3 h-3" /> Approved</span>;
      case 'rejected':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400"><XCircleIcon className="w-3 h-3" /> Rejected</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"><ExclamationTriangleIcon className="w-3 h-3" /> Pending Review</span>;
    }
  };

  return (
    <div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Payment Proof</h3>
      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
        Upload payment receipts or stubs for your property manager to review. Once approved, you will receive an official receipt.
      </p>

      {/* Upload Form */}
      <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-5 mb-6">
        <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3">Submit Payment Proof</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Amount (Optional)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₦</span>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Period (Optional)</label>
              <input
                type="text"
                value={period}
                onChange={e => setPeriod(e.target.value)}
                placeholder="e.g., January 2025"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g., Rent payment via bank transfer"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          {/* File Upload */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Upload Proof *</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-lg p-4 text-center cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors"
            >
              <UploadIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500 mx-auto mb-2" />
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                Click to upload payment receipt or stub
              </p>
              <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-1">
                JPG, PNG, PDF · Max 10MB each
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            {pendingFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {pendingFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-800 rounded-lg">
                    <PaperclipIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-700 dark:text-zinc-300 flex-1 truncate">{file.name}</span>
                    <span className="text-2xs text-slate-400">{(file.size / 1024).toFixed(0)}KB</span>
                    <button onClick={() => removeFile(idx)} className="text-rose-500 hover:text-rose-700">
                      <XCircleIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || pendingFiles.length === 0}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <UploadIcon className="w-4 h-4" />
            {isSubmitting ? 'Uploading...' : 'Submit Payment Proof'}
          </button>
        </div>
      </div>

      {/* Previous Submissions */}
      <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3">Previous Submissions</h4>
      {paymentProofs === undefined ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-zinc-700" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-40 mb-2" />
                  <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : paymentProofs.length > 0 ? (
        <div className="space-y-2">
          {paymentProofs.map((proof: any) => (
            <div
              key={proof._id}
              className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  proof.status === 'approved'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20'
                    : proof.status === 'rejected'
                    ? 'bg-rose-50 dark:bg-rose-900/20'
                    : 'bg-amber-50 dark:bg-amber-900/20'
                }`}>
                  <ReceiptIcon className={`w-4 h-4 ${
                    proof.status === 'approved'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : proof.status === 'rejected'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200 truncate">
                    {proof.description || 'Payment proof'}
                    {proof.amount && <span className="ml-2 text-emerald-600 dark:text-emerald-400">₦{proof.amount.toLocaleString()}</span>}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {proof.period && `${proof.period} · `}
                    {formatDate(proof.createdAt)}
                    {proof.storageIds?.length > 0 && <span className="ml-1">· {proof.storageIds.length} file(s)</span>}
                  </p>
                  {proof.adminNote && (
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 italic">
                      Note: {proof.adminNote}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">{getStatusBadge(proof.status)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-zinc-800 dark:bg-zinc-700 flex items-center justify-center mb-3">
            <ReceiptIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">No payment proofs submitted</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Upload a receipt or payment stub above to get an official receipt from your property manager.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Documents Tab ───────────────────────────────────────────────────────────
const PrinterIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
  </svg>
);

const FolderOpenIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const ShieldCheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
  </svg>
);

const DocumentsTab: React.FC<{ tenantInfo: any; effectiveFirmId?: string; addToast: (msg: React.ReactNode, opts?: any) => void }> = ({ tenantInfo, effectiveFirmId, addToast }) => {
  const { currentUser } = useAuth();
  const firmId = effectiveFirmId || currentUser?.firmId || '';
  const userId = currentUser?.id || '';
  const email = currentUser?.email || '';
  const resolvedTenantId = tenantInfo?.tenantId || userId;

  // Fetch lease details
  const leaseDetails = useQuery(
    api.portals.getTenantLeaseDetails,
    firmId && resolvedTenantId ? { firmId, tenantId: resolvedTenantId, email } : 'skip'
  );

  // Fetch consent records
  const consentRecords = useQuery(
    api.portals.getPortalUserConsentRecords,
    email ? { email } : 'skip'
  );

  // Fetch documents shared with the tenant
  const tenantDocs = useQuery(
    api.portals.getTenantDocuments,
    firmId && resolvedTenantId ? { firmId, tenantId: resolvedTenantId, email } : 'skip'
  );

  // Fetch payment proofs (they are also documents)
  const paymentProofs = useQuery(
    api.portals.getPaymentProofsByTenant,
    resolvedTenantId ? { tenantId: resolvedTenantId } : 'skip'
  );

  // View document content in a new window
  const handleViewDocument = (doc: any) => {
    if (doc.content) {
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
            <p>Property: ${tenantInfo?.primaryPropertyName || 'N/A'} ${tenantInfo?.primaryUnitName ? '· Unit: ' + tenantInfo.primaryUnitName : ''}</p>
          </div>
          <div class="content">${doc.content}</div>
          <div class="footer">
            <p>PracticePro Atrium · Document generated ${new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div class="no-print" style="position:fixed;bottom:20px;right:20px;display:flex;gap:8px;">
            <button onclick="window.print()" style="padding:10px 20px;background:#64748b;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">Print</button>
          </div>
        </body>
        </html>
      `;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
      } else {
        addToast('Please allow popups to view this document.', { type: 'error' });
      }
    } else {
      addToast('This document has no viewable content.', { type: 'info' });
    }
  };

  // Preview lease details (readable view, not print-focused)
  const handleViewLease = (lease: any) => {
    handlePrintLease(lease); // Same content, opens in new window for reading
  };

  // Preview consent record (readable view)
  const handleViewConsent = (consent: any) => {
    handlePrintConsent(consent); // Same content, opens in new window for reading
  };

  // Print lease details
  const handlePrintLease = (lease: any) => {
    const rd = lease.rentalDetails || {};
    const ud = lease.unitDetails || {};
    const td = lease.tenancyDetails || {};
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lease Agreement - ${lease.propertyName || 'Property'}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px 20px; color: #1e293b; line-height: 1.7; }
          .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 24px; }
          .header h1 { font-size: 24px; font-weight: 800; margin: 0 0 4px; color: #1e293b; }
          .header .brand { color: #f59e0b; }
          .header p { color: #64748b; font-size: 13px; margin: 0; }
          .section { margin-bottom: 24px; }
          .section h2 { font-size: 16px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; }
          .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
          .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
          .detail-label { color: #64748b; font-size: 13px; }
          .detail-value { font-weight: 600; font-size: 13px; }
          .footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          .badge { display: inline-block; background: #ecfdf5; color: #059669; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; }
          @media print { body { padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Practice<span class="brand">Pro</span> <span style="color:#8b5cf6;font-size:13px">ATRIUM</span></h1>
          <p>Lease Agreement Summary</p>
        </div>

        <div class="section">
          <h2>Property Information</h2>
          <div class="details-grid">
            <div class="detail-row"><span class="detail-label">Property</span><span class="detail-value">${lease.propertyName || 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label">Address</span><span class="detail-value">${lease.propertyAddress || 'N/A'}</span></div>
            ${lease.unitName ? `<div class="detail-row"><span class="detail-label">Unit</span><span class="detail-value">${lease.unitName}</span></div>` : ''}
            <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${lease.propertyType || lease.category || 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="badge">${lease.status || 'Active'}</span></span></div>
          </div>
        </div>

        <div class="section">
          <h2>Tenancy Details</h2>
          <div class="details-grid">
            <div class="detail-row"><span class="detail-label">Tenant</span><span class="detail-value">${rd.tenantName || ud.tenantName || currentUser?.name || 'N/A'}</span></div>
            ${rd.rentAmount || ud.rentAmount ? `<div class="detail-row"><span class="detail-label">Rent Amount</span><span class="detail-value">₦${(rd.rentAmount || ud.rentAmount || 0).toLocaleString('en-NG')}</span></div>` : ''}
            ${rd.paymentFrequency || td.paymentFrequency ? `<div class="detail-row"><span class="detail-label">Payment Frequency</span><span class="detail-value">${rd.paymentFrequency || td.paymentFrequency || 'Monthly'}</span></div>` : ''}
            ${rd.leaseStart || ud.leaseStart || td.startDate ? `<div class="detail-row"><span class="detail-label">Lease Start</span><span class="detail-value">${rd.leaseStart || ud.leaseStart || td.startDate || 'N/A'}</span></div>` : ''}
            ${rd.leaseEnd || ud.leaseEnd || td.endDate ? `<div class="detail-row"><span class="detail-label">Lease End</span><span class="detail-value">${rd.leaseEnd || ud.leaseEnd || td.endDate || 'N/A'}</span></div>` : ''}
            ${rd.securityDeposit ? `<div class="detail-row"><span class="detail-label">Security Deposit</span><span class="detail-value">₦${rd.securityDeposit.toLocaleString('en-NG')}</span></div>` : ''}
          </div>
        </div>

        ${rd.landlordName ? `
        <div class="section">
          <h2>Landlord Information</h2>
          <div class="details-grid">
            <div class="detail-row"><span class="detail-label">Landlord</span><span class="detail-value">${rd.landlordName}</span></div>
            ${rd.landlordPhone ? `<div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${rd.landlordPhone}</span></div>` : ''}
            ${rd.landlordEmail ? `<div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${rd.landlordEmail}</span></div>` : ''}
          </div>
        </div>
        ` : ''}

        <div class="footer">
          <p>This is a summary of your lease details from PracticePro Atrium.</p>
          <p>PracticePro Systems Ltd · Lagos, Nigeria</p>
          <p>NDPA 2023 Compliant · AES-256 Encrypted</p>
        </div>
        <div class="no-print" style="position:fixed;bottom:20px;right:20px;">
          <button onclick="window.print()" style="padding:10px 20px;background:#10b981;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">Print Lease</button>
        </div>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    } else {
      addToast('Please allow popups to print your lease.', { type: 'error' });
    }
  };

  // Print consent record
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
          <h1>Practice<span class="brand">Pro</span> <span style="color:#8b5cf6;font-size:13px">ATRIUM</span></h1>
          <p>Terms & Conditions Acceptance Record</p>
        </div>
        <div class="details">
          <div class="row"><span class="label">User</span><span class="value">${consent.inviteeName || currentUser?.name || 'N/A'}</span></div>
          <div class="row"><span class="label">Email</span><span class="value">${consent.inviteeEmail || email}</span></div>
          <div class="row"><span class="label">Portal Type</span><span class="value">${consent.portalType === 'resident' ? "Residents' Portal" : 'Client Portal'}</span></div>
          <div class="row"><span class="label">Terms Accepted</span><span class="value">${consent.termsAcceptedAt ? new Date(consent.termsAcceptedAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span></div>
          <div class="row"><span class="label">Account Activated</span><span class="value">${consent.acceptedAt ? new Date(consent.acceptedAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span></div>
          <div class="row"><span class="label">Status</span><span class="value"><span class="badge">ACCEPTED</span></span></div>
        </div>
        <div class="footer">
          <p>This record confirms your acceptance of the PracticePro portal terms and conditions.</p>
          <p>PracticePro Systems Ltd · Lagos, Nigeria</p>
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

  const isLoading = leaseDetails === undefined || consentRecords === undefined || tenantDocs === undefined;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-6 animate-pulse">
          <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-48 mb-4" />
          <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-full mb-2" />
          <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-3/4 mb-2" />
          <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-1/2" />
        </div>
        <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-6 animate-pulse">
          <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-48 mb-4" />
          <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-full mb-2" />
          <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-3/4" />
        </div>
      </div>
    );
  }

  const hasLease = leaseDetails && leaseDetails.length > 0;
  const hasConsents = consentRecords && consentRecords.length > 0;
  const hasDocs = tenantDocs && tenantDocs.length > 0;
  const hasProofs = paymentProofs && paymentProofs.length > 0;
  const hasAnyContent = hasLease || hasConsents || hasDocs || hasProofs;

  return (
    <div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">My Documents</h3>
      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
        View and print your lease agreement, accepted terms, consent records, and shared documents.
      </p>

      {!hasAnyContent && (
        <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-zinc-800 dark:bg-zinc-700 flex items-center justify-center mb-3">
            <FolderOpenIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">No documents available yet</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Your lease agreement, consent records, and shared documents will appear here.
          </p>
        </div>
      )}

      {/* ─── Lease Agreement Section ─────────────────────────────────────── */}
      {hasLease && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <OfficeBuildingIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Lease Agreement</h4>
          </div>
          <div className="space-y-3">
            {leaseDetails.map((lease: any, idx: number) => {
              const rd = lease.rentalDetails || {};
              const ud = lease.unitDetails || {};
              return (
                <div
                  key={lease.propertyId || idx}
                  className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                        <OfficeBuildingIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200">
                          {lease.propertyName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {lease.unitName ? `Unit: ${lease.unitName} · ` : ''}
                          {lease.propertyAddress || 'No address'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {lease.propertyType && (
                            <span className="text-2xs font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                              {lease.propertyType}
                            </span>
                          )}
                          {(rd.rentAmount || ud.rentAmount) && (
                            <span className="text-2xs font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                              ₦{(rd.rentAmount || ud.rentAmount || 0).toLocaleString()}/mo
                            </span>
                          )}
                          {(rd.leaseStart || ud.leaseStart) && (
                            <span className="text-2xs font-bold bg-slate-100 dark:bg-zinc-800 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 px-2 py-0.5 rounded-full">
                              From {rd.leaseStart || ud.leaseStart}
                              {(rd.leaseEnd || ud.leaseEnd) ? ` to ${rd.leaseEnd || ud.leaseEnd}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleViewLease(lease)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                      >
                        <EyeIcon className="w-3.5 h-3.5" /> Preview
                      </button>
                      <button
                        onClick={() => handlePrintLease(lease)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-lg text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-600 transition-colors"
                      >
                        <PrinterIcon className="w-3.5 h-3.5" /> Print
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Terms & Consents Section ───────────────────────────────────── */}
      {hasConsents && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheckIcon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Terms & Consents</h4>
          </div>
          <div className="space-y-3">
            {consentRecords.map((consent: any) => (
              <div
                key={String(consent._id)}
                className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center flex-shrink-0">
                      <ShieldCheckIcon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200">
                        {consent.portalType === 'resident' ? "Residents' Portal Terms & Conditions" : 'Client Portal Terms & Conditions'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Accepted on {consent.termsAcceptedAt
                          ? new Date(consent.termsAcceptedAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : 'N/A'}
                      </p>
                      <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                        <CheckIcon className="w-3 h-3" /> Accepted
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleViewConsent(consent)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 rounded-lg text-xs font-bold hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
                    >
                      <EyeIcon className="w-3.5 h-3.5" /> Preview
                    </button>
                    <button
                      onClick={() => handlePrintConsent(consent)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-lg text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-600 transition-colors"
                    >
                      <PrinterIcon className="w-3.5 h-3.5" /> Print
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Shared Documents Section ───────────────────────────────────── */}
      {hasDocs && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <DocumentIcon className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Shared Documents</h4>
          </div>
          <div className="space-y-3">
            {tenantDocs.map((doc: any) => (
              <div
                key={String(doc._id)}
                className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center flex-shrink-0">
                      <DocumentIcon className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200 truncate">
                        {doc.title || 'Untitled Document'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        {doc.dateFiled && `${doc.dateFiled} · `}
                        {doc.source && <span className="capitalize">{doc.source}</span>}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {doc.isSharedWithClient && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                            <CheckIcon className="w-3 h-3" /> Shared
                          </span>
                        )}
                        {doc.isSignatureRequested && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                            <ExclamationTriangleIcon className="w-3 h-3" /> Signature Requested
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleViewDocument(doc)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 rounded-lg text-xs font-bold hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors"
                    >
                      <EyeIcon className="w-3.5 h-3.5" /> View
                    </button>
                    <button
                      onClick={() => handleViewDocument(doc)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-lg text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-600 transition-colors"
                    >
                      <PrinterIcon className="w-3.5 h-3.5" /> Print
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Payment Proof Records Section ──────────────────────────────── */}
      {hasProofs && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ReceiptIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Payment Proofs</h4>
          </div>
          <div className="space-y-2">
            {paymentProofs.map((proof: any) => (
              <div
                key={proof._id}
                className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    proof.status === 'approved'
                      ? 'bg-emerald-50 dark:bg-emerald-900/20'
                      : proof.status === 'rejected'
                      ? 'bg-rose-50 dark:bg-rose-900/20'
                      : 'bg-amber-50 dark:bg-amber-900/20'
                  }`}>
                    <ReceiptIcon className={`w-4 h-4 ${
                      proof.status === 'approved'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : proof.status === 'rejected'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200 truncate">
                      {proof.description || 'Payment proof'}
                      {proof.amount && <span className="ml-2 text-emerald-600 dark:text-emerald-400">₦{proof.amount.toLocaleString()}</span>}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {proof.period && `${proof.period} · `}
                      {formatDate(proof.createdAt)}
                      {proof.storageIds?.length > 0 && <span className="ml-1">· {proof.storageIds.length} file(s)</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {proof.status === 'approved' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                      <CheckIcon className="w-3 h-3" /> Approved
                    </span>
                  )}
                  {proof.status === 'rejected' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400">
                      <XCircleIcon className="w-3 h-3" /> Rejected
                    </span>
                  )}
                  {proof.status === 'pending_review' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                      <ExclamationTriangleIcon className="w-3 h-3" /> Pending
                    </span>
                  )}
                  <button
                    onClick={() => {
                      const html = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                          <title>Payment Proof - ${proof.description || 'Receipt'}</title>
                          <style>
                            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1e293b; line-height: 1.7; }
                            .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 20px; }
                            .header h1 { font-size: 24px; font-weight: 800; margin: 0 0 4px; color: #1e293b; }
                            .header .brand { color: #f59e0b; }
                            .header p { color: #64748b; font-size: 13px; margin: 0; }
                            .details { background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0; }
                            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
                            .row:last-child { border-bottom: none; }
                            .label { color: #64748b; font-size: 13px; }
                            .value { font-weight: 600; font-size: 13px; }
                            .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; }
                            .footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
                            @media print { body { padding: 0; } .no-print { display: none; } }
                          </style>
                        </head>
                        <body>
                          <div class="header">
                            <h1>Practice<span class="brand">Pro</span> <span style="color:#8b5cf6;font-size:13px">ATRIUM</span></h1>
                            <p>Payment Proof Record</p>
                          </div>
                          <div class="details">
                            <div class="row"><span class="label">Description</span><span class="value">${proof.description || 'Payment proof'}</span></div>
                            ${proof.amount ? `<div class="row"><span class="label">Amount</span><span class="value">₦${proof.amount.toLocaleString('en-NG')}</span></div>` : ''}
                            ${proof.period ? `<div class="row"><span class="label">Period</span><span class="value">${proof.period}</span></div>` : ''}
                            <div class="row"><span class="label">Date Submitted</span><span class="value">${formatDate(proof.createdAt)}</span></div>
                            <div class="row"><span class="label">Status</span><span class="value"><span class="badge" style="background:${proof.status === 'approved' ? '#ecfdf5;color:#059669' : proof.status === 'rejected' ? '#fff1f2;color:#e11d48' : '#fffbeb;color:#d97706'}">${proof.status === 'approved' ? 'APPROVED' : proof.status === 'rejected' ? 'REJECTED' : 'PENDING REVIEW'}</span></span></div>
                            ${proof.adminNote ? `<div class="row"><span class="label">Admin Note</span><span class="value">${proof.adminNote}</span></div>` : ''}
                            <div class="row"><span class="label">Files Attached</span><span class="value">${proof.storageIds?.length || 0}</span></div>
                          </div>
                          <div class="footer">
                            <p>PracticePro Systems Ltd · Lagos, Nigeria</p>
                            <p>NDPA 2023 Compliant · AES-256 Encrypted</p>
                          </div>
                          <div class="no-print" style="position:fixed;bottom:20px;right:20px;">
                            <button onclick="window.print()" style="padding:10px 20px;background:#10b981;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">Print</button>
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
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                  >
                    <PrinterIcon className="w-3.5 h-3.5" /> Print
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantPortal;
