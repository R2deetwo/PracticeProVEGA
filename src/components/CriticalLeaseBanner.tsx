/**
 * CriticalLeaseBanner — Globally-pinned high-priority alert banner.
 *
 * Renders critical lease notifications as an interactive broadcast banner
 * pinned between the Header and the main content area. Critical events:
 *   - Lease Expiration (30/60/90 day thresholds)
 *   - Lease Expired (past end date)
 *   - Statutory Notice Window Compression
 *   - Unpaid Rent Defaulter
 *
 * The banner is NOT silent — it displays prominently with:
 *   ⚠️ [CRITICAL ALERT]: <message>
 *   [View Unit] | [Dismiss]
 *
 * Clicking [View Unit] deep-links to:
 *   /properties/[propertyId]?tab=units&unitId=[unitId]&action=highlight
 * via navigateTo('propertyDetail', propertyId, { tab: 'units', targetUnit, highlight })
 *
 * Dismissal is per-notification, persisted to localStorage so it doesn't
 * reappear on every page load.
 */

import React, { useState, useMemo } from 'react';
import { useCoreState } from '../contexts/CoreContext';
import { useUI } from '../contexts/UIContext';
import { XIcon } from '../constants';

// Notification types that are considered "critical" and should show as banners.
const CRITICAL_TYPES = [
    'lease_expiry',
    'lease_expired',
    'lease_expiring',
    'defaulter',
    'rent_overdue',
    'statutory_notice',
    'notice_window',
];

const isCritical = (type: string | undefined): boolean => {
    if (!type) return false;
    const lower = type.toLowerCase();
    return CRITICAL_TYPES.some(ct => lower.includes(ct));
};

// Per-notification dismissal — persisted to localStorage so dismissed
// banners don't reappear on page refresh.
const getDismissKey = (id: string) => `dismissed_critical_banner_${id}`;
const isDismissed = (id: string): boolean => {
    try { return localStorage.getItem(getDismissKey(id)) === 'true'; } catch { return false; }
};
const dismiss = (id: string): void => {
    try { localStorage.setItem(getDismissKey(id), 'true'); } catch {}
};

export const CriticalLeaseBanner: React.FC = () => {
    const { navigateTo } = useUI();
    const { coreState } = useCoreState();
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

    // Notifications come from coreState (same source as the Header bell)
    const notifications = coreState?.notifications || [];

    // Filter to critical, unread, non-dismissed notifications
    const criticalAlerts = useMemo(() => {
        if (!notifications || !Array.isArray(notifications)) return [];
        return notifications.filter((n: any) => {
            if (!isCritical(n.type)) return false;
            if (n.isRead) return false;
            const id = String(n._id || n.id || '');
            if (!id) return false;
            if (isDismissed(id) || dismissedIds.has(id)) return false;
            return true;
        }).slice(0, 3); // Max 3 banners at once
    }, [notifications, dismissedIds]);

    const handleViewUnit = (alert: any) => {
        const link = alert.link || {};
        const propertyId = link.id || alert.propertyId;
        const context = link.context || {};
        // Deep-link to the property's units tab with the target unit + highlight
        navigateTo(
            link.view || 'propertyDetail',
            propertyId,
            {
                tab: 'units',
                targetUnit: context.targetUnit || alert.unitId || propertyId,
                highlight: context.highlight || alert.unitId || propertyId,
            }
        );
    };

    const handleDismiss = (id: string) => {
        dismiss(id);
        setDismissedIds(prev => new Set(prev).add(id));
    };

    if (criticalAlerts.length === 0) return null;

    return (
        <div className="flex-shrink-0 z-30 border-b border-rose-200 dark:border-rose-900/50 bg-gradient-to-r from-rose-50 to-amber-50 dark:from-rose-950/40 dark:to-amber-950/40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 space-y-2">
                {criticalAlerts.map((alert: any) => {
                    const id = String(alert._id || alert.id || '');
                    const message = alert.message || alert.title || 'Critical lease alert';
                    return (
                        <div
                            key={id}
                            className="flex items-center justify-between gap-3 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-lg border border-rose-300 dark:border-rose-800/60 px-3 py-2 shadow-sm"
                        >
                            {/* Alert message */}
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs font-black">
                                    !
                                </span>
                                <div className="flex-1 min-w-0">
                                    <span className="text-2xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider mr-1.5">
                                        Critical Alert
                                    </span>
                                    <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-zinc-200 truncate">
                                        {message}
                                    </span>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                    onClick={() => handleViewUnit(alert)}
                                    className="px-2.5 py-1 text-2xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors whitespace-nowrap"
                                >
                                    View Unit
                                </button>
                                <button
                                    onClick={() => handleDismiss(id)}
                                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                                    aria-label="Dismiss"
                                >
                                    <XIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CriticalLeaseBanner;
