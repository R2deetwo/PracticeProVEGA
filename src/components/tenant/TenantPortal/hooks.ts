/**
 * TenantPortal/hooks — orchestrator support hooks extracted from index.tsx
 * (P5 monolith split, 2026-09-14). Bodies are verbatim from the original
 * orchestrator; only the wiring (parameters/returns) is new.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';

/** Portal theme isolation: portal users only ever see standard light/dark.
 *  Separate localStorage key so the portal preference is independent of admin. */
export function usePortalTheme(theme: string, setTheme: (t: 'light' | 'dark') => void) {
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
  return { isDark, toggleTheme };
}

/** Sentry Pass enablement request — automated message to the property manager. */
export function useSentryPassRequest(opts: {
  tenantInfo: any; currentUser: any; effectiveFirmId: string; userId: string;
  addToast: (msg: React.ReactNode, opts?: any) => void;
}) {
  const { tenantInfo, currentUser, effectiveFirmId, userId, addToast } = opts;
  const [isRequestingVms, setIsRequestingVms] = useState(false);

  const sendPortalMessage = useMutation(api.portals.sendPortalMessage);
  // Sentry Pass Request Handler — sends an automated message to the property manager
  // requesting that Sentry Pass be enabled for the resident's property.
  // Includes unit number so the PM knows which unit the request is from.
  const handleRequestVmsEnable = async () => {
    if (isRequestingVms) return;
    setIsRequestingVms(true);
    try {
      const residentName = tenantInfo?.tenantName || currentUser?.name || 'Resident';
      const propertyName = tenantInfo?.primaryPropertyName || tenantInfo?.properties?.[0]?.name || 'my property';
      const unitName = tenantInfo?.primaryUnitName || tenantInfo?.units?.[0]?.name || '';
      const unitLabel = unitName ? `Unit ${unitName} at ${propertyName}` : propertyName;
      await sendPortalMessage({
        firmId: effectiveFirmId,
        senderId: userId,
        senderName: residentName,
        senderEmail: currentUser?.email,
        senderRole: 'Tenant',
        subject: 'Sentry Pass Enablement Request',
        content: `Hello,\n\nI would like to request that the Sentry Pass be enabled for ${unitLabel}. This will allow me to generate 6-digit access codes for my visitors, contractors, and delivery personnel.\n\nPlease enable this feature in Portal Access Settings at your earliest convenience.\n\nThank you,\n${residentName}${unitName ? ` (Unit ${unitName})` : ''}`,
        propertyId: tenantInfo?.primaryPropertyId || tenantInfo?.properties?.[0]?.id || undefined,
        unitId: tenantInfo?.primaryUnitId || tenantInfo?.units?.[0]?.id || undefined,
      });
      addToast('Request sent to your property manager. They will enable Sentry Pass from Portal Access Settings.', { type: 'success' });
    } catch (e: any) {
      addToast(e?.message || 'Failed to send request. Please try again or contact your property manager directly.', { type: 'error' });
    } finally {
      setIsRequestingVms(false);
    }
  };

  return { isRequestingVms, handleRequestVmsEnable };
}

/** Paystack wallet-funding redirect verification (?wallet_funded=REF).
 *  Runs on portal mount regardless of active tab — deliberately kept at
 *  orchestrator level so a redirect landing on any tab still verifies. */
export function useWalletFundingVerify(opts: {
  userId: string; effectiveFirmId: string; tenantInfo: any;
  addToast: (msg: React.ReactNode, opts?: any) => void;
}) {
  const { userId, effectiveFirmId, tenantInfo, addToast } = opts;
  // Check for Paystack redirect after wallet funding (?wallet_funded=REF).
  // FIX: previously the reference was read and DISCARDED — no verification,
  // no credit. Now we call wallets.verifyWalletFunding (server-side Paystack
  // verify) so the balance actually updates and the resident gets feedback.
  const verifyWalletFundingAction = useAction(api.wallets.verifyWalletFunding);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fundedRef = params.get('wallet_funded');
    if (fundedRef && userId && effectiveFirmId) {
      window.history.replaceState({}, '', window.location.pathname);
      (async () => {
        try {
          const propertyId = (tenantInfo as any)?.units?.[0]?.propertyId || (tenantInfo as any)?.propertyId || '';
          const result = await verifyWalletFundingAction({
            reference: fundedRef,
            tenantId: userId,
            firmId: effectiveFirmId,
            propertyId,
          });
          if (result?.success) {
            addToast(`Wallet funded successfully${result.newBalance !== undefined ? ` — new balance: ₦${Number(result.newBalance).toLocaleString('en-NG')}` : ''}.`, { type: 'success' });
          } else {
            addToast(result?.error || 'We could not confirm your wallet payment yet — if you were debited, it will reflect shortly.', { type: 'warning' });
          }
        } catch (e: any) {
          addToast(e?.message || 'Wallet payment verification failed. Please contact your property manager.', { type: 'error' });
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, effectiveFirmId, tenantInfo]);

}

/** Self-healing: auto-repair missing firmId + auto-relink tenant to property. */
export function usePortalSelfHealing(opts: {
  email: string; effectiveFirmId: string; firmResolution: any; tenantInfo: any;
  repairFirmId: any; relinkToProperty: any;
}) {
  const { email, effectiveFirmId, firmResolution, tenantInfo, repairFirmId, relinkToProperty } = opts;
  const [hasAttemptedRelink, setHasAttemptedRelink] = useState(false);
  const [hasAttemptedFirmRepair, setHasAttemptedFirmRepair] = useState(false);

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

  return { hasAttemptedRelink };
}

/** Badge counts for the tab bar (messages, notices, open maintenance). */
export function usePortalBadges(opts: { userId: string; effectiveFirmId: string; tenantInfo: any }) {
  const { userId, effectiveFirmId, tenantInfo } = opts;

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

  // ── Unread notices count (notices created in the last 3 days that the tenant
  //    likely hasn't seen yet — we use a simple heuristic since there's no
  //    per-tenant read tracking for notices) ──
  const activeNotices = useQuery(
    api.portals.getActiveNotices,
    effectiveFirmId ? {
      firmId: effectiveFirmId,
      propertyId: tenantInfo?.primaryPropertyId || undefined,
      unitId: tenantInfo?.primaryUnitId || undefined,
    } : 'skip'
  );
  const unreadNoticesCount = useMemo(() => {
    if (!activeNotices) return 0;
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    return activeNotices.filter((n: any) => n.createdAt > threeDaysAgo).length;
  }, [activeNotices]);

  // ── Open maintenance tickets count for badge ──
  const maintenanceTickets = useQuery(
    api.portals.getMaintenanceTicketsByTenant,
    (tenantInfo?.tenantId || userId) ? {
      tenantId: tenantInfo?.tenantId || userId,
    } : 'skip'
  );
  const openMaintenanceCount = useMemo(() => {
    if (!maintenanceTickets) return 0;
    return maintenanceTickets.filter((t: any) =>
      t.status === 'open' || t.status === 'in_progress'
    ).length;
  }, [maintenanceTickets]);

  return { unreadMessageCount, unreadNoticesCount, openMaintenanceCount };
}
