/**
 * BroadcastBanner — Frosted Colored Glass with Slim Carousel Indicators.
 *
 * DESIGN:
 *   - Vibrant color-tinted frosted glass (red/amber/blue/green/violet)
 *   - backdrop-filter: blur(16px) saturate(180%)
 *   - Fine noise/grain texture overlay (4% opacity)
 *   - Dark text on colored glass for high contrast
 *   - Left color accent bar
 *
 * CAROUSEL (max 4 banners):
 *   - Active banner in full view
 *   - Slim color-coded indicator dots/pills centered below the card
 *   - No numbers or "1 of N" text — just colored dots
 *   - Left < and right > arrows flanking the indicators
 *   - Clicking an indicator transitions to that banner
 *
 * DISMISSAL (strict isolation):
 *   - Per-broadcast-ID localStorage (NEVER wipes other banners)
 *   - 'persistent' persistenceMode = non-dismissible (no X button)
 *   - Smooth slide-out animation
 *
 * ACTION BUTTONS:
 *   - Deep links render as an explicit pill button on the right
 *   - The banner body is NOT clickable — only the button is
 *
 * HEIGHT UNIFORMITY:
 *   - All banners use the same min-height, padding, and gap spacing
 *   - Badges use identical line-heights and flex alignment
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { useCoreState } from '../contexts/CoreContext';
import { useUI } from '../contexts/UIContext';

// CRO AUDIT FIX — increased from 2 to 4 max simultaneous banners.
const MAX_BANNERS = 4;

const THEME: Record<string, {
    accentBar: string;        // left accent bar color
    pillBg: string;           // category pill background
    pillText: string;         // category pill text color
    label: string;            // category label text
    glassBg: string;          // frosted colored glass background (rgba)
}> = {
    info: {
        accentBar: 'bg-blue-400',
        pillBg: 'bg-white/25',
        pillText: 'text-white',
        label: 'Info',
        // Frosted Sky Blue Glass
        glassBg: 'rgba(82, 142, 186, 0.75)',
    },
    success: {
        accentBar: 'bg-emerald-400',
        pillBg: 'bg-white/25',
        pillText: 'text-white',
        label: 'Success',
        // Frosted Emerald Green Glass
        glassBg: 'rgba(86, 178, 126, 0.75)',
    },
    warning: {
        accentBar: 'bg-amber-400',
        pillBg: 'bg-white/25',
        pillText: 'text-white',
        label: 'Warning',
        // Frosted Amber/Gold Glass
        glassBg: 'rgba(217, 131, 43, 0.75)',
    },
    urgent: {
        accentBar: 'bg-red-400',
        pillBg: 'bg-white/25',
        pillText: 'text-white',
        label: 'Urgent',
        // Frosted Coral/Red Glass
        glassBg: 'rgba(225, 98, 89, 0.75)',
    },
    announcement: {
        accentBar: 'bg-emerald-400',
        pillBg: 'bg-white/25',
        pillText: 'text-white',
        label: 'Announcement',
        glassBg: 'rgba(86, 178, 126, 0.75)',
    },
    upsell: {
        accentBar: 'bg-violet-400',
        pillBg: 'bg-white/25',
        pillText: 'text-white',
        label: 'Offer',
        // Frosted Violet Glass
        glassBg: 'rgba(139, 92, 246, 0.75)',
    },
};

const DEFAULT_THEME = THEME.info;

function parseTheme(type: string): string {
    if (!type || !type.startsWith('broadcast_')) return 'info';
    const parsed = type.replace('broadcast_', '') || 'info';
    return THEME[parsed] ? parsed : 'info';
}

// CRO AUDIT FIX — PRODUCT TARGETING RESOLUTION.
// Uses MULTIPLE signals to resolve the user's product, because
// currentUser.product can be stale/empty/wrong-cased.
// Signals checked (in priority order):
//   1. firmDetails.product (most reliable — set by the firm creation flow)
//   2. firmDetails.subscriptionPlan (Komplete plan = unified product)
//   3. currentUser.product (set at signup, but can be stale)
// Returns canonical product: 'legal' | 'property' | 'unified'
function resolveUserProduct(currentUser: any, firmDetails: any): string {
    // Collect all signals
    const firmProduct = (firmDetails?.product || '').toLowerCase().trim();
    const firmPlan = (firmDetails?.subscriptionPlan || '').toLowerCase().trim();
    const userProduct = (currentUser?.product || '').toLowerCase().trim();

    // Normalize each signal to canonical form
    const normalize = (p: string): string => {
        if (!p) return '';
        if (p === 'komplete' || p === 'unified') return 'unified';
        if (p === 'vega' || p === 'legal') return 'legal';
        if (p === 'atrium' || p === 'property') return 'property';
        return '';
    };

    // Signal 1: firmDetails.product (most reliable)
    const fromFirm = normalize(firmProduct);
    if (fromFirm) return fromFirm;

    // Signal 2: firm's subscriptionPlan (Komplete plan → unified product)
    if (firmPlan === 'komplete') return 'unified';

    // Signal 3: currentUser.product
    const fromUser = normalize(userProduct);
    if (fromUser) return fromUser;

    // Default: 'unified' (Komplete — safest fallback, shows all broadcasts)
    return 'unified';
}

// Per-broadcast-ID dismissal via localStorage.
function isDismissed(broadcastId: string, notifId: string): boolean {
    try {
        if (broadcastId && localStorage.getItem(`dismissed_banner_${broadcastId}`) === 'true') return true;
        if (notifId && localStorage.getItem(`dismissed_banner_${notifId}`) === 'true') return true;
    } catch {}
    return false;
}

function markDismissed(broadcastId: string, notifId: string) {
    try {
        if (broadcastId) localStorage.setItem(`dismissed_banner_${broadcastId}`, 'true');
        if (notifId) localStorage.setItem(`dismissed_banner_${notifId}`, 'true');
    } catch {}
}

function isSessionDismissed(broadcastId: string, notifId: string): boolean {
    try {
        if (broadcastId && sessionStorage.getItem(`dismissed_banner_${broadcastId}`) === 'true') return true;
        if (notifId && sessionStorage.getItem(`dismissed_banner_${notifId}`) === 'true') return true;
    } catch {}
    return false;
}

function markSessionDismissed(broadcastId: string, notifId: string) {
    try {
        if (broadcastId) sessionStorage.setItem(`dismissed_banner_${broadcastId}`, 'true');
        if (notifId) sessionStorage.setItem(`dismissed_banner_${notifId}`, 'true');
    } catch {}
}

// ─── SnoozeButton Component ──────────────────────────────────────────
// Renders a snooze bell icon with a Portal dropdown for system banners.
// Persists snooze state to localStorage so the banner stays hidden for
// the chosen duration (1 day, 1 week, or until next billing cycle).
const SnoozeButton: React.FC<{ bannerId: string }> = ({ bannerId }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const btnRef = React.useRef<HTMLButtonElement>(null);
    const [pos, setPos] = React.useState({ top: 0, left: 0 });

    React.useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (btnRef.current && !btnRef.current.contains(target)) {
                const portal = document.getElementById('banner-snooze-dropdown');
                if (portal && portal.contains(target)) return;
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    React.useEffect(() => {
        if (isOpen && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setPos({ top: rect.bottom + 4, left: rect.right - 160 });
        }
    }, [isOpen]);

    const handleSnooze = (days: number) => {
        const until = new Date();
        until.setDate(until.getDate() + days);
        localStorage.setItem(`snooze_${bannerId}`, JSON.stringify({
            dismissed_until: until.toISOString(),
        }));
        setIsOpen(false);
        // Force re-render of the banner by reloading the page state
        window.dispatchEvent(new Event('storage'));
        // Also set the session dismissed flag so it hides immediately
        sessionStorage.setItem(`dismissed_banner_${bannerId}`, 'true');
    };

    return (
        <>
            <button
                ref={btnRef}
                onClick={(e) => { e.stopPropagation(); setIsOpen(p => !p); }}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-white/30 transition-colors flex-shrink-0"
                aria-label="Snooze banner"
                title="Snooze"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2a6 6 0 00-6 6v3.586l-1.707 1.707A1 1 0 003 15h14a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                </svg>
            </button>
            {isOpen && createPortal(
                <div
                    id="banner-snooze-dropdown"
                    className="fixed z-[9999] w-40 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg animate-fade-in"
                    style={{ top: pos.top, left: pos.left }}
                >
                    <button onClick={() => handleSnooze(1)} className="block w-full text-left px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-t-md">Snooze 1 Day</button>
                    <button onClick={() => handleSnooze(7)} className="block w-full text-left px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600">Snooze 1 Week</button>
                    <button onClick={() => handleSnooze(30)} className="block w-full text-left px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-b-md border-t border-gray-100 dark:border-gray-600">Dismiss Until Next Cycle</button>
                </div>,
                document.body
            )}
        </>
    );
};

export const BroadcastBanner: React.FC = () => {
    const { currentUser, isAuthenticated } = useAuth();
    const { coreState } = useCoreState();
    const { navigateTo } = useUI();
    const markAsRead = useMutation(api.myFunctions.markNotificationsAsRead);

    const [dismissingId, setDismissingId] = useState<string | null>(null);
    const [dismissTick, setDismissTick] = useState(0);
    const [activeIndex, setActiveIndex] = useState(0);

    // One-time cleanup of OLD dismissal state (message-family keys).
    useEffect(() => {
        try {
            sessionStorage.removeItem('dismissed_broadcasts_v2');
        } catch {}
    }, []);

    const userId = currentUser?._id || (currentUser as any)?.id || '';
    const userIdStr = String(userId);
    const userEmail = currentUser?.email || '';

    const broadcasts = useQuery(api.broadcasts.getActiveBroadcasts,
        isAuthenticated && (userIdStr || userEmail)
            ? { userId: userIdStr, email: userEmail }
            : "skip");

    // CRO AUDIT FIX — use multi-signal product resolution.
    // This fixes the bug where product-targeted broadcasts didn't render
    // because currentUser.product was stale or wrong-cased.
    const userProduct = useMemo(() =>
        resolveUserProduct(currentUser, coreState?.firmDetails),
        [currentUser, coreState?.firmDetails]
    );

    // DEDUPLICATE + FILTER
    const visibleBroadcasts = useMemo((): any[] => {
        if (!broadcasts || !Array.isArray(broadcasts)) return [];

        // Step 1: Deduplicate by broadcastId (keep first = most recent)
        const seenBroadcastIds = new Set<string>();
        const deduped = broadcasts.filter((b: any) => {
            if (!b) return false;
            const bid = b.broadcastId || b.link?.context?.broadcastId || '';
            if (bid) {
                if (seenBroadcastIds.has(bid)) return false;
                seenBroadcastIds.add(bid);
            }
            return true;
        });

        // Step 2 + 3: Filter by product + dismissal
        const matching = deduped.filter((b: any) => {
            // CRO AUDIT FIX — product targeting with normalized comparison.
            // The targetProduct from the backend can be 'all', 'legal',
            // 'property', or 'unified'. The userProduct is resolved via
            // resolveUserProduct() to the same canonical form.
            const targetProduct = (b.targetProduct || 'all').toLowerCase().trim();
            if (targetProduct !== 'all' && targetProduct !== userProduct) return false;

            const broadcastId = b.broadcastId || b.link?.context?.broadcastId || '';
            const notifId = String(b._id || b.id || '');
            const persistenceMode = b.persistenceMode || b.link?.context?.persistenceMode || 'permanent';

            if (persistenceMode === 'session') {
                if (isSessionDismissed(broadcastId, notifId)) return false;
            } else {
                if (isDismissed(broadcastId, notifId)) return false;
            }
            return true;
        });

        return matching.slice(0, MAX_BANNERS);
    }, [broadcasts, userProduct, dismissTick]);

    // ─── CRO AUDIT: AUTOMATED SYSTEM BANNERS ────────────────────────────
    // Generate synthetic system banners based on lifecycle state:
    //   1. Trial countdown (7 days, 3 days, expired)
    //   2. Overdue rent alerts (Atrium users with >0 overdue payments)
    // These are injected into the visible queue alongside real broadcasts.
    const systemBanners = useMemo((): any[] => {
        const banners: any[] = [];
        const now = Date.now();
        const DAY = 24 * 60 * 60 * 1000;

        // ── Trial countdown banners ──
        const trialEndsAt = (coreState?.firmDetails as any)?.trialEndsAt;
        const trialPlan = (coreState?.firmDetails as any)?.trialPlan;
        if (trialEndsAt && trialPlan) {
            const daysRemaining = Math.ceil((trialEndsAt - now) / DAY);
            if (daysRemaining <= 0) {
                // Expired — non-dismissible Red Urgent
                banners.push({
                    _id: `system_trial_expired`,
                    broadcastId: `system_trial_expired`,
                    title: 'TRIAL EXPIRED',
                    message: 'Your workspace trial has expired. Please select a plan to restore full access.',
                    type: 'broadcast_urgent',
                    persistenceMode: 'persistent',  // non-dismissible
                    deepLink: '/settings/billing',
                    targetProduct: 'all',
                    isSystem: true,
                });
            } else if (daysRemaining <= 3) {
                // 3 days — Amber Warning
                banners.push({
                    _id: `system_trial_3days`,
                    broadcastId: `system_trial_3days`,
                    title: 'TRIAL ENDING SOON',
                    message: `Your workspace trial ends in ${daysRemaining} day(s). Select a plan to avoid service interruption.`,
                    type: 'broadcast_warning',
                    persistenceMode: 'permanent',
                    deepLink: '/settings/billing',
                    targetProduct: 'all',
                    isSystem: true,
                });
            } else if (daysRemaining <= 7) {
                // 7 days — soft Blue Info
                banners.push({
                    _id: `system_trial_7days`,
                    broadcastId: `system_trial_7days`,
                    title: 'TRIAL ENDING',
                    message: `Your workspace trial ends in ${daysRemaining} days.`,
                    type: 'broadcast_info',
                    persistenceMode: 'permanent',
                    deepLink: '/settings/billing',
                    targetProduct: 'all',
                    isSystem: true,
                });
            }
        }

        // ── Overdue rent alert (Atrium / Komplete property firms) ──
        // ENRICHED PAYLOAD — dynamically includes tenant name, property
        // address, and unit number so the user can identify the defaulter
        // without clicking into multiple screens.
        const ledgerEntries = (coreState as any)?.ledgerEntries || [];
        const allProperties = (coreState as any)?.properties || [];
        const allUnits = allProperties.flatMap((p: any) => p.units || []);
        const overdueEntries = ledgerEntries.filter((e: any) =>
            e.status === 'pending' || e.status === 'defaulted'
        );
        const overdueCount = overdueEntries.length;

        // SNOOZE CHECK — if the user snoozed this banner, don't show it
        // until the snooze period expires.
        const snoozeKey = 'snooze_overdue_rent';
        const snoozeUntil = (() => {
            try { return JSON.parse(localStorage.getItem(snoozeKey) || 'null'); } catch { return null; }
        })();
        const isSnoozed = snoozeUntil && new Date(snoozeUntil.dismissed_until) > new Date();

        if (overdueCount > 0 && !isSnoozed && (userProduct === 'property' || userProduct === 'unified')) {
            const firstOverdue = overdueEntries[0];
            const targetPropertyId = firstOverdue?.propertyId || firstOverdue?.property || null;
            const targetUnitId = firstOverdue?.unitId || firstOverdue?.unit || null;
            const highlightId = firstOverdue?._id || firstOverdue?.id || null;

            // Look up property address and tenant name for dynamic text
            const targetProperty = allProperties.find((p: any) =>
                p.id === targetPropertyId || (p as any)._id === targetPropertyId
            );
            const targetUnit = allUnits.find((u: any) =>
                u.id === targetUnitId || (u as any)._id === targetUnitId
            ) || targetProperty?.units?.find?.((u: any) => u.id === targetUnitId);
            const propertyAddress = targetProperty?.address?.split(',')[0] || 'your property';
            const tenantName = firstOverdue?.tenantName || targetUnit?.rentalDetails?.tenantName || targetUnit?.tenantName || '';
            const unitName = targetUnit?.rentalDetails?.unitName || targetUnit?.unitName || targetUnit?.name || '';

            // Dynamic message based on count
            let message: string;
            if (overdueCount === 1 && tenantName) {
                message = `Overdue rent for ${tenantName} at ${propertyAddress}${unitName ? ` (Unit ${unitName})` : ''}.`;
            } else if (overdueCount > 1 && tenantName) {
                message = `Overdue rent at ${propertyAddress} for ${tenantName} and ${overdueCount - 1} other${overdueCount - 1 > 1 ? 's' : ''}.`;
            } else {
                message = `You have ${overdueCount} overdue rent payment${overdueCount > 1 ? 's' : ''} pending review.`;
            }

            banners.push({
                _id: `system_overdue_rent`,
                broadcastId: `system_overdue_rent`,
                title: 'OVERDUE RENT PAYMENTS',
                message,
                type: 'broadcast_warning',
                persistenceMode: 'permanent',
                deepLink: targetPropertyId
                    ? `properties/${targetPropertyId}?tab=units&targetUnit=${targetUnitId || ''}&highlight=${highlightId || 'overdue'}`
                    : 'properties',
                targetProduct: userProduct,
                isSystem: true,
            });
        }

        return banners;
    }, [coreState?.firmDetails, (coreState as any)?.ledgerEntries, userProduct]);

    // Merge system banners with real broadcasts, then sort by urgency.
    // CRO AUDIT: urgency-based sorting so the highest urgency notice
    // always occupies Position 1 in the carousel.
    // Priority: Urgent (Red) > Warning (Amber) > Info (Blue) > Success (Green)
    const URGENCY_RANK: Record<string, number> = {
        urgent: 0, announcement: 0,
        warning: 1,
        info: 2,
        success: 3,
        upsell: 4,
    };
    const allVisibleBanners = useMemo(() => {
        const combined = [...systemBanners, ...visibleBroadcasts];
        // Sort by urgency rank (ascending — 0 = highest priority)
        return combined.sort((a, b) => {
            const rankA = URGENCY_RANK[parseTheme(a.type || '')] ?? 5;
            const rankB = URGENCY_RANK[parseTheme(b.type || '')] ?? 5;
            if (rankA !== rankB) return rankA - rankB;
            // Same urgency — sort by timestamp (newest first)
            const tsA = new Date(a.timestamp || a._creationTime || 0).getTime();
            const tsB = new Date(b.timestamp || b._creationTime || 0).getTime();
            return tsB - tsA;
        }).slice(0, MAX_BANNERS);
    }, [systemBanners, visibleBroadcasts]);

    // Reset activeIndex if it's out of bounds
    useEffect(() => {
        if (activeIndex >= allVisibleBanners.length) {
            setActiveIndex(0);
        }
    }, [allVisibleBanners.length, activeIndex]);

    const handleDismiss = useCallback(async (broadcast: any) => {
        if (!broadcast) return;
        const notifId = String(broadcast._id || broadcast.id || '');
        const broadcastId = broadcast.broadcastId || broadcast.link?.context?.broadcastId || '';
        const persistenceMode = broadcast.persistenceMode || broadcast.link?.context?.persistenceMode || 'permanent';
        if (!notifId) return;

        setDismissingId(notifId);

        // ISOLATED dismissal — only this broadcastId
        if (persistenceMode === 'session') {
            markSessionDismissed(broadcastId, notifId);
        } else {
            markDismissed(broadcastId, notifId);
        }

        setTimeout(() => {
            setDismissTick(t => t + 1);
            setDismissingId(null);
        }, 300);

        if (persistenceMode === 'permanent') {
            try {
                await markAsRead({ ids: [notifId], userEmail: currentUser?.email });
            } catch (e) {
                console.error('[BroadcastBanner] Failed to mark as read:', e);
            }
        }
    }, [markAsRead, currentUser]);

    const handleStubClick = useCallback((index: number) => {
        setActiveIndex(index);
    }, []);

    const handlePrev = useCallback(() => {
        setActiveIndex(prev => (prev - 1 + allVisibleBanners.length) % allVisibleBanners.length);
    }, [allVisibleBanners.length]);

    const handleNext = useCallback(() => {
        setActiveIndex(prev => (prev + 1) % allVisibleBanners.length);
    }, [allVisibleBanners.length]);

    // CRASH-SAFE
    if (!allVisibleBanners || allVisibleBanners.length === 0) return null;

    const activeBroadcast = allVisibleBanners[activeIndex] || allVisibleBanners[0];
    if (!activeBroadcast) return null;

    const activeTheme = THEME[parseTheme(activeBroadcast.type || '')] || DEFAULT_THEME;
    const persistenceMode = activeBroadcast.persistenceMode || activeBroadcast.link?.context?.persistenceMode || 'permanent';
    const isDismissible = persistenceMode !== 'persistent';
    const isDismissing = dismissingId === String(activeBroadcast._id || activeBroadcast.id);

    return (
        <div className="w-full">
            {/* Active Card — Frosted Colored Glass (vibrant, NOT dark)
                - background: vibrant color-tinted glass matching urgency type
                - backdrop-filter: blur(16px) saturate(180%)
                - Fine noise/grain texture overlay (4% opacity)
                - 1px translucent white border: rgba(255, 255, 255, 0.25)
                - Inner highlight + soft drop shadow
                - UNIFORM HEIGHT: min-h-[110px], p-5, gap-2 between header and body
                - Left color accent bar
                - Smooth horizontal slide transition */}
            <div
                className={`relative overflow-hidden rounded-2xl transition-all duration-300 ease-out shadow-lg ${
                    isDismissing
                        ? 'opacity-0 -translate-x-8 max-h-0'
                        : 'opacity-100 translate-x-0'
                }`}
                style={{
                    background: activeTheme.glassBg,
                    backdropFilter: 'blur(16px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.3), 0 4px 24px -4px rgba(0, 0, 0, 0.2)',
                }}
            >
                {/* Fine noise/grain texture overlay */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
                        opacity: 0.04,
                        mixBlendMode: 'overlay',
                    }}
                />

                {/* Thin colored left accent bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${activeTheme.accentBar} z-10`} />

                {/* CRO AUDIT FIX — UNIFORM HEIGHT + PADDING + GAP.
                    min-h-[110px] ensures all banners are the same height.
                    p-5 (was p-4) gives consistent padding.
                    flex-col with gap-2 standardizes vertical rhythm. */}
                <div className="relative p-5 pl-6 z-10 flex flex-col gap-2 min-h-[110px] justify-between">
                    {/* Top row: title + (action button + dismiss) */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            {persistenceMode === 'persistent' && (
                                <span className="text-3xs font-bold text-slate-800/70 flex-shrink-0 leading-none">📌 Pinned</span>
                            )}
                            {/* Title — bold DARK text, uppercase, leading-none for uniform height */}
                            <p className="text-sm font-bold text-slate-900 truncate uppercase tracking-wide leading-none">
                                {activeBroadcast.title || 'Announcement'}
                            </p>
                        </div>

                        {/* Right side: explicit action button + dismiss X */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {/* CRO AUDIT FIX — EXPLICIT ACTION BUTTON for deep links.
                                The banner body is NOT clickable — only this button is.
                                Semi-translucent white pill, white bold text, rounded-full. */}
                            {activeBroadcast.deepLink && (
                                <button
                                    onClick={() => {
                                        if (activeBroadcast.deepLink) {
                                            // DEEP-LINK FIX — use client-side navigation instead of
                                            // window.location.href (which causes a full hard reload,
                                            // clearing user state and showing the splash screen again).
                                            //
                                            // Parse the deepLink to extract:
                                            //   - view name (e.g. 'properties', 'messaging')
                                            //   - entity ID (e.g. propertyId from 'properties/abc123?...')
                                            //   - context params (e.g. tab, highlight)
                                            const link = activeBroadcast.deepLink;
                                            const cleanLink = link.startsWith('/') ? link.slice(1) : link;
                                            const [pathPart, queryPart] = cleanLink.split('?');
                                            const segments = pathPart.split('/').filter(Boolean);
                                            const view = segments[0] || 'dashboard';
                                            const entityId = segments[1] || null;

                                            // Parse query params into context object
                                            const context: Record<string, any> = {};
                                            if (queryPart) {
                                                const params = new URLSearchParams(queryPart);
                                                params.forEach((value, key) => {
                                                    context[key] = value;
                                                });
                                            }

                                            // Map view names to the app's View type
                                            const viewMap: Record<string, string> = {
                                                'properties': 'properties',
                                                'matters': 'matters',
                                                'tasks': 'tasks',
                                                'documents': 'documents',
                                                'messaging': 'messaging',
                                                'contacts': 'contacts',
                                                'billing': 'billing',
                                                'settings': 'settings',
                                                'dashboard': 'dashboard',
                                                'atriumEngine': 'atriumEngine',
                                            };
                                            const targetView = viewMap[view] || view;

                                            // Use client-side navigateTo — preserves history stack
                                            // so the back button returns the user to where they were.
                                            navigateTo(targetView as any, entityId, context);
                                        }
                                    }}
                                    className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full text-3xs font-bold text-slate-900 hover:text-slate-900 bg-slate-900/15 hover:bg-slate-900/25 transition-colors backdrop-blur-sm leading-none"
                                >
                                    Open
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            )}

                            {/* SNOOZE button — for system banners (overdue rent).
                                Renders a snooze dropdown via Portal (same as ProTip).
                                Persists to localStorage so the banner stays hidden
                                for the chosen duration. */}
                            {activeBroadcast.isSystem && (
                                <SnoozeButton bannerId={activeBroadcast.broadcastId || activeBroadcast._id} />
                            )}

                            {/* Dismiss button — only if isDismissible.
                                CRO AUDIT FIX — 'persistent' mode hides the X completely
                                (non-dismissible enforcement). */}
                            {isDismissible && (
                                <button
                                    onClick={() => handleDismiss(activeBroadcast)}
                                    className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-white/30 transition-colors flex-shrink-0"
                                    aria-label="Dismiss"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Message body — crisp DARK text, leading-relaxed for uniform spacing */}
                    <p className="text-xs text-slate-800 leading-relaxed">
                        {activeBroadcast.message || ''}
                    </p>
                </div>
            </div>

            {/* CRO AUDIT FIX — SLIM CAROUSEL INDICATORS.
                Centered directly below the banner card.
                No numbers, no "1 of N" text — just slim color-coded dots.
                Active dot = colored pill matching the active banner's theme.
                Inactive dots = slim semi-translucent pills.
                Left < and right > arrows flank the indicators. */}
            {allVisibleBanners.length > 1 && (
                <div className="flex justify-center items-center gap-2 mt-2 w-full">
                    {/* Left arrow */}
                    <button
                        onClick={handlePrev}
                        className="flex items-center justify-center w-6 h-6 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors flex-shrink-0"
                        aria-label="Previous banner"
                    >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>

                    {/* Slim color-coded indicator dots — no numbers, no text */}
                    {allVisibleBanners.map((b, i) => {
                        const theme = THEME[parseTheme(b.type || '')] || DEFAULT_THEME;
                        const isActive = i === activeIndex;
                        return (
                            <button
                                key={String(b._id || b.id || i)}
                                onClick={() => handleStubClick(i)}
                                className="transition-all duration-300 ease-out flex-shrink-0"
                                style={isActive ? { background: theme.glassBg } : undefined}
                                title={b.title || `Banner ${i + 1}`}
                                aria-label={`Go to banner ${i + 1}`}
                            >
                                {/* Active = wider colored pill; Inactive = slim translucent dot */}
                                <span
                                    className={`block rounded-full transition-all duration-300 ease-out ${
                                        isActive
                                            ? 'w-6 h-2 shadow-sm'
                                            : 'w-2 h-2 bg-slate-300 dark:bg-zinc-600 hover:bg-slate-400 dark:hover:bg-zinc-500'
                                    }`}
                                />
                            </button>
                        );
                    })}

                    {/* Right arrow */}
                    <button
                        onClick={handleNext}
                        className="flex items-center justify-center w-6 h-6 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors flex-shrink-0"
                        aria-label="Next banner"
                    >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
};

export default BroadcastBanner;
