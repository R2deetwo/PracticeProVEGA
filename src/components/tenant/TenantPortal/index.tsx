/**
 * TenantPortal — Atrium Residents' Portal (thin orchestrator).
 *
 * Composition layer only: resolves tenant identity + firm, self-heals broken
 * links, owns tab state, and mounts one tab component per active tab.
 * Sub-sections live in ./ (DashboardTab, NoticesTab, LedgerTab, ReceiptsTab,
 * MaintenanceTab, MessagesTab, PaymentsTab, DocumentsTab, HelpAndSupportTab),
 * chrome in ./PortalHeader + ./PortalNav, blocking states in ./PortalStates,
 * and orchestrator hooks in ./hooks.
 *
 * Feature-gated: canUseTenantPortal (Atrium Growth+ only)
 * Role-gated: Only users with role === 'Tenant'
 */
import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useUI } from '../../../contexts/UIContext';
import { useFeatures } from '../../../hooks/useFeatures';
import { VisitorPortal } from '../../portal/VisitorPortal';
import EstateCommunityResidentView from '../EstateCommunityResidentView';
import NairaSymbol from '../../NairaSymbol';
import { Receipt as ReceiptIcon, Home as HomeIcon } from 'lucide-react';
import { BellIcon, VisitorIcon, DownloadIcon, DocumentIcon, HelpCircleIcon } from '../../../constants';
import { type TabId, ChatIcon, WrenchIcon, TabErrorBoundary } from './shared';
import { VisitorDisabledState } from './VisitorDisabledState';
import { usePortalTheme, useSentryPassRequest, useWalletFundingVerify, usePortalSelfHealing, usePortalBadges } from './hooks';
import { PortalDataUnavailable, PortalUnavailable, NoPropertyAssignment } from './PortalStates';
import { PortalHeader } from './PortalHeader';
import { PortalTabBar, PortalBottomNav } from './PortalNav';
import { DashboardTab } from './DashboardTab';
import { NoticesTab } from './NoticesTab';
import { LedgerTab } from './LedgerTab';
import { ReceiptsTab } from './ReceiptsTab';
import { MaintenanceTab } from './MaintenanceTab';
import { MessagesTab } from './MessagesTab';
import { PaymentsTab } from './PaymentsTab';
import { DocumentsTab } from './DocumentsTab';
import { HelpAndSupportTab } from './HelpAndSupportTab';

const TenantPortal: React.FC = () => {
  const { currentUser, isImpersonating, revertToOriginalUser, logout } = useAuth();
  const { addToast, theme, setTheme } = useUI();
  const { canUseTenantPortal } = useFeatures();

  // ── Portal theme isolation (standard light/dark only — see ./hooks) ──
  const { isDark, toggleTheme } = usePortalTheme(theme, setTheme);

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const hash = window.location.hash.replace('#', '');
    if (['dashboard', 'notices', 'ledger', 'receipts', 'maintenance', 'messages', 'payments', 'documents', 'visitors', 'community'].includes(hash)) return hash as TabId;
    return 'dashboard';
  });
  // SIMPLIFY FIX: state for the mobile bottom-nav "More" sheet (previously the
  // More button just jumped to the Notices tab with no menu at all).
  const [showMoreSheet, setShowMoreSheet] = useState(false);

  // Repair mutation for fixing missing firmId on portal user records
  const repairFirmId = useMutation(api.portals.repairPortalUserFirmId);
  const relinkToProperty = useMutation(api.portals.relinkPortalUserToProperty);

  const [isRepairing, setIsRepairing] = useState(false);


  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    window.location.hash = tab;
    // Haptic feedback on tab change
    try { import('../../../utils/haptics').then(m => m.haptics.light()); } catch {}
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


  // ── Orchestrator hooks (bodies verbatim, see ./hooks.ts) ──
  // Wallet-funding redirect verification runs regardless of active tab.
  useWalletFundingVerify({ userId, effectiveFirmId, tenantInfo, addToast });
  const { hasAttemptedRelink } = usePortalSelfHealing({
    email, effectiveFirmId, firmResolution, tenantInfo, repairFirmId, relinkToProperty,
  });
  const { isRequestingVms, handleRequestVmsEnable } = useSentryPassRequest({
    tenantInfo, currentUser, effectiveFirmId, userId, addToast,
  });
  const { unreadMessageCount, unreadNoticesCount, openMaintenanceCount } = usePortalBadges({
    userId, effectiveFirmId, tenantInfo,
  });

  // ── CONDITIONAL RETURNS (after all hooks) ────────────────────────────────

  // Access guard
  if (!currentUser) return null;

  // CRITICAL: If firmId can't be resolved, show a repair UI instead of infinite skeletons.
  if (!effectiveFirmId && firmResolution !== undefined) {
    return (
      <PortalDataUnavailable
        isRepairing={isRepairing}
        setIsRepairing={setIsRepairing}
        repairFirmId={repairFirmId}
        email={email}
        addToast={addToast}
        logout={() => logout()}
      />
    );
  }

  // SAFETY NET: an authenticated portal user must never be blocked by the
  // admin-side feature gate (it gates admin invite creation, not portal access).
  if (!canUseTenantPortal && currentUser.role !== 'Tenant') {
    return <PortalUnavailable />;
  }

  // If tenantInfo loaded but returned no properties/units, and auto-relink already
  // attempted, show a "no property assigned" state instead of infinite loading.
  const hasNoPropertyAssignment = tenantInfo !== undefined &&
    effectiveFirmId &&
    (!tenantInfo.properties || tenantInfo.properties.length === 0) &&
    (!tenantInfo.units || tenantInfo.units.length === 0) &&
    hasAttemptedRelink;

  const tabs: { id: TabId; label: string; icon: React.ReactNode; badge?: number; disabled?: boolean }[] = [
    { id: 'dashboard', label: 'Home', icon: <HomeIcon className="w-4 h-4" /> },
    { id: 'notices', label: 'Notices', icon: <BellIcon className="w-4 h-4" />, badge: unreadNoticesCount || undefined },
    // VISITORS TAB — always visible. Sentry Pass is AND-gated:
    //   1. Firm-level: portalSettings.vmsEnabled
    //   2. Property-level: tenantInfo.primaryPropertyVmsEnabled (defaults true)
    // When either is off, the tab shows a "Feature Not Yet Active" message.
    { id: 'visitors', label: 'Visitors', icon: <VisitorIcon className="w-4 h-4" />, disabled: !portalSettings?.vmsEnabled || !(tenantInfo?.primaryPropertyVmsEnabled ?? true) },
    { id: 'ledger', label: 'Ledger', icon: <ReceiptIcon className="w-4 h-4" /> },
    { id: 'receipts', label: 'Receipts', icon: <DownloadIcon className="w-4 h-4" /> },
    { id: 'maintenance', label: 'Maintenance', icon: <WrenchIcon className="w-4 h-4" />, badge: openMaintenanceCount || undefined },
    ...(portalSettings?.tenantMessagingEnabled ? [
      { id: 'messages' as TabId, label: 'Messages', icon: <ChatIcon className="w-4 h-4" />, badge: unreadMessageCount || undefined },
    ] : []),
    { id: 'payments', label: 'Payments', icon: <NairaSymbol className="w-4 h-4 inline" /> },
    { id: 'documents', label: 'Documents', icon: <DocumentIcon className="w-4 h-4" /> },
    // ESTATE COMMUNITY TAB — shown only when the admin has enabled at least
    // one community module (amenity booking, bulletin, or service providers).
    // Controlled via Settings → Estate Community. Hidden entirely when no
    // modules are enabled, so commercial-only firms don't see a useless tab.
    ...((tenantInfo as any)?.communityFeatures?.amenityBooking ||
     (tenantInfo as any)?.communityFeatures?.bulletin ||
     (tenantInfo as any)?.communityFeatures?.serviceProviderDirectory
      ? [{ id: 'community' as TabId, label: 'Community', icon: <ChatIcon className="w-4 h-4" /> }]
      : []),
    { id: 'security', label: 'Help', icon: <HelpCircleIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <PortalHeader
        isImpersonating={isImpersonating}
        displayName={tenantInfo?.tenantName || currentUser.name || currentUser.email}
        onReturnToAdmin={revertToOriginalUser}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onLogout={() => logout()}
      />

      <PortalTabBar tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Content — extra padding-bottom on mobile so content isn't hidden behind the bottom nav */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-zinc-900 pb-24 sm:pb-6">

        {hasNoPropertyAssignment ? (
          <NoPropertyAssignment
            isRepairing={isRepairing}
            setIsRepairing={setIsRepairing}
            repairFirmId={repairFirmId}
            relinkToProperty={relinkToProperty}
            email={email}
            effectiveFirmId={effectiveFirmId}
            addToast={addToast}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && <TabErrorBoundary tabName="Dashboard"><DashboardTab tenantInfo={tenantInfo} onNavigate={handleTabChange} userId={userId} effectiveFirmId={effectiveFirmId} email={email} /></TabErrorBoundary>}
            {activeTab === 'notices' && <TabErrorBoundary tabName="Notices"><NoticesTab tenantInfo={tenantInfo} effectiveFirmId={effectiveFirmId} /></TabErrorBoundary>}
            {activeTab === 'ledger' && <TabErrorBoundary tabName="Ledger"><LedgerTab tenantInfo={tenantInfo} effectiveFirmId={effectiveFirmId} /></TabErrorBoundary>}
            {activeTab === 'receipts' && <TabErrorBoundary tabName="Receipts"><ReceiptsTab tenantInfo={tenantInfo} effectiveFirmId={effectiveFirmId} addToast={addToast} /></TabErrorBoundary>}
            {activeTab === 'maintenance' && <TabErrorBoundary tabName="Maintenance"><MaintenanceTab tenantInfo={tenantInfo} effectiveFirmId={effectiveFirmId} addToast={addToast} /></TabErrorBoundary>}
            {activeTab === 'messages' && <TabErrorBoundary tabName="Messages"><MessagesTab tenantInfo={tenantInfo} effectiveFirmId={effectiveFirmId} portalSettings={portalSettings} addToast={addToast} /></TabErrorBoundary>}
            {activeTab === 'payments' && <TabErrorBoundary tabName="Payments"><PaymentsTab tenantInfo={tenantInfo} effectiveFirmId={effectiveFirmId} addToast={addToast} /></TabErrorBoundary>}
            {activeTab === 'documents' && <TabErrorBoundary tabName="Documents"><DocumentsTab tenantInfo={tenantInfo} effectiveFirmId={effectiveFirmId} addToast={addToast} /></TabErrorBoundary>}
            {activeTab === 'visitors' && <TabErrorBoundary tabName="Visitors">
              {(portalSettings?.vmsEnabled && (tenantInfo?.primaryPropertyVmsEnabled ?? true)) ? (
                <VisitorPortal firmId={effectiveFirmId} propertyId={tenantInfo?.primaryPropertyId || tenantInfo?.properties?.[0]?.id || ''} propertyName={tenantInfo?.primaryPropertyName || tenantInfo?.properties?.[0]?.name} propertyAddress={tenantInfo?.primaryPropertyAddress || tenantInfo?.properties?.[0]?.address} unitId={tenantInfo?.primaryUnitId || tenantInfo?.units?.[0]?.id} unitName={tenantInfo?.primaryUnitName || tenantInfo?.units?.[0]?.name} residentName={tenantInfo?.tenantName} />
              ) : (
                <VisitorDisabledState onRequestEnable={handleRequestVmsEnable} isRequesting={isRequestingVms} />
              )}
            </TabErrorBoundary>}
            {activeTab === 'security' && <TabErrorBoundary tabName="Help"><HelpAndSupportTab tenantInfo={tenantInfo} portalSettings={portalSettings} onNavigate={handleTabChange} /></TabErrorBoundary>}

            {/* ESTATE COMMUNITY TAB — resident-facing view of admin-enabled
                community modules. Only renders when the admin has toggled at
                least one module on (the tab itself is hidden otherwise). */}
            {activeTab === 'community' && (
              <TabErrorBoundary tabName="Community">
                <EstateCommunityResidentView
                  firmId={effectiveFirmId}
                  propertyId={tenantInfo?.primaryPropertyId || tenantInfo?.properties?.[0]?.id || ''}
                  residentUserId={userId || ''}
                  residentName={tenantInfo?.tenantName || currentUser?.name || 'Resident'}
                  communityFeatures={(tenantInfo as any)?.communityFeatures}
                  userEmail={email || currentUser?.email || ''}
                />
              </TabErrorBoundary>
            )}

          </>
        )}
      </div>

      <PortalBottomNav
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        messagingEnabled={!!portalSettings?.tenantMessagingEnabled}
        unreadMessageCount={unreadMessageCount}
        openMaintenanceCount={openMaintenanceCount}
        showMoreSheet={showMoreSheet}
        onOpenMore={() => setShowMoreSheet(true)}
        onCloseMore={() => setShowMoreSheet(false)}
      />
    </div>
  );
};

export default TenantPortal;
