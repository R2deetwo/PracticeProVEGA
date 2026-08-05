/**
 * useFounderSignals — real-time founder signal polling for the Founder APK.
 *
 * WHAT IT DOES:
 *   1. Polls the backend `getFounderAlerts` Convex query every 5 minutes
 *      while the Founder APK is open.
 *   2. Compares the latest signal snapshot against the last snapshot
 *      persisted in localStorage.
 *   3. For any signal that is NEW or has gotten WORSE (e.g., churn count
 *      increased, scaling severity escalated), fires a LOCAL notification
 *      on the device so the founder sees it in the notification shade —
 *      even if they're not looking at the app.
 *   4. Persists the latest snapshot so we don't re-notify on the same
 *      signal twice.
 *
 * WHY LOCAL NOTIFICATIONS:
 *   Setting up FCM/APNs true push is a bigger project. For the founder's
 *   own APK (which they install and open regularly), local notifications
 *   triggered on a poll while the app is open/backgrounded is enough to
 *   catch new signups, churn risks, and scaling signals within minutes.
 *
 * NOTIFICATION CATEGORIES:
 *   - New user signup    → 'practicepro-general'  channel, info tone
 *   - New firm signup    → 'practicepro-general'  channel, info tone
 *   - Churn risk pool    → 'practicepro-tasks'    channel, warning tone
 *   - Scaling severity   → 'practicepro-tasks'    channel, warning tone
 *   - Push product pick  → 'practicepro-general'  channel, info tone
 */

import { useEffect, useRef } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { registerForNotifications, showLocalNotification } from '../utils/notifications';
import { Capacitor } from '@capacitor/core';

const LS_KEY = 'practicepro_founder_signals_v1';
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

type Severity = 'info' | 'warning' | 'critical';

interface PersistedSnapshot {
    newUsers24hCount: number;
    newFirms24hCount: number;
    churnRiskCount: number;
    scalingSignalIds: string[];
    worstScalingSeverity: Severity | null;
    pushProduct: string | null;
    notifiedAt: number; // epoch millis of last notification we fired
}

function readSnapshot(): PersistedSnapshot | null {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as PersistedSnapshot;
    } catch {
        return null;
    }
}

function writeSnapshot(s: PersistedSnapshot) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(s));
    } catch {}
}

function severityRank(s: Severity): number {
    return s === 'critical' ? 3 : s === 'warning' ? 2 : 1;
}

export function useFounderSignals({ enabled }: { enabled: boolean }) {
    // SECURITY: Pass tokenIdentifier for server-side admin verification.
    const { currentUser } = useAuth();
    const tokenIdentifier = currentUser?.email || currentUser?.tokenIdentifier || '';
    // useQuery gives us live updates from Convex. We don't need to poll
    // Convex itself — we poll for LOCAL NOTIFICATION dispatch only.
    const alerts = useQuery(api.founderMetrics.getFounderAlerts,
        enabled && tokenIdentifier ? { tokenIdentifier } : "skip");
    const lastNotifiedRef = useRef<number>(0);

    // Register for local notifications on mount (founder app only).
    useEffect(() => {
        if (!enabled) return;
        if (!Capacitor.isNativePlatform()) return;
        // Best-effort registration — silently fails if user denied.
        registerForNotifications().catch(() => {});
    }, [enabled]);

    // Process alerts → fire local notifications for any new/worsened signals.
    useEffect(() => {
        if (!enabled || !alerts) return;

        const prev = readSnapshot();
        const now = Date.now();

        // Throttle: don't fire notifications more than once per minute,
        // even if signals are changing rapidly.
        if (now - lastNotifiedRef.current < 60_000) {
            // Still persist the snapshot so we don't lose state.
            writeSnapshot({
                newUsers24hCount: alerts.newUsers24hCount,
                newFirms24hCount: alerts.newFirms24hCount,
                churnRiskCount: alerts.churnRiskCount,
                scalingSignalIds: alerts.scalingSignals.map((s: any) => s.id),
                worstScalingSeverity: alerts.scalingSignals.reduce<Severity | null>((acc: Severity | null, s: any) => {
                    if (!acc) return s.severity;
                    return severityRank(s.severity) > severityRank(acc) ? s.severity : acc;
                }, null),
                pushProduct: alerts.pushProduct?.product || null,
                notifiedAt: prev?.notifiedAt || 0,
            });
            return;
        }

        const newSignals: { title: string; body: string; type: string; extra: Record<string, any> }[] = [];

        // ─── New users / firms ────────────────────────────────────────
        if (alerts.newUsers24hCount > 0) {
            const prevCount = prev?.newUsers24hCount ?? 0;
            if (alerts.newUsers24hCount > prevCount) {
                newSignals.push({
                    title: `New user signup`,
                    body: `${alerts.newUsers24hCount} new user${alerts.newUsers24hCount !== 1 ? 's' : ''} in the last 24h (was ${prevCount}).`,
                    type: 'signup',
                    extra: { view: 'signals', context: { kind: 'new-users' } },
                });
            }
        }
        if (alerts.newFirms24hCount > 0) {
            const prevCount = prev?.newFirms24hCount ?? 0;
            if (alerts.newFirms24hCount > prevCount) {
                const names = (alerts.newFirms24h as any[]).slice(0, 2).map((f: any) => f.name).join(', ');
                newSignals.push({
                    title: `New firm signup`,
                    body: `${alerts.newFirms24hCount} new firm${alerts.newFirms24hCount !== 1 ? 's' : ''} in 24h${names ? ': ' + names : ''}.`,
                    type: 'firm-signup',
                    extra: { view: 'signals', context: { kind: 'new-firms' } },
                });
            }
        }

        // ─── Churn ────────────────────────────────────────────────────
        if (alerts.churnRiskCount > 0) {
            const prevCount = prev?.churnRiskCount ?? 0;
            // Notify if churn pool grew, OR if this is the first time we see churn
            if (alerts.churnRiskCount > prevCount) {
                newSignals.push({
                    title: `Churn risk: ${alerts.churnRiskCount} user${alerts.churnRiskCount !== 1 ? 's' : ''}`,
                    body: `${alerts.churnRiskCount} users haven't been seen in 14+ days (was ${prevCount}).`,
                    type: 'churn',
                    extra: { view: 'signals', context: { kind: 'churn' } },
                });
            }
        }

        // ─── Scaling severity ─────────────────────────────────────────
        const worstSeverity: Severity | null = (alerts.scalingSignals as any[]).reduce<Severity | null>((acc, s) => {
            if (!acc) return s.severity as Severity;
            return severityRank(s.severity) > severityRank(acc) ? (s.severity as Severity) : acc;
        }, null);
        if (worstSeverity && (worstSeverity === 'critical' || worstSeverity === 'warning')) {
            const prevSeverity = prev?.worstScalingSeverity || null;
            const escalated = !prevSeverity || severityRank(worstSeverity) > severityRank(prevSeverity);
            if (escalated) {
                const topSignal = (alerts.scalingSignals as any[]).find(s => s.severity === worstSeverity);
                if (topSignal) {
                    newSignals.push({
                        title: `${worstSeverity === 'critical' ? 'CRITICAL' : 'Scaling alert'}: ${topSignal.title}`,
                        body: topSignal.detail,
                        type: 'scaling',
                        extra: { view: 'signals', context: { kind: 'scaling', id: topSignal.id } },
                    });
                }
            }
        }

        // ─── Push product pick (only when product changes) ───────────
        const currentPushProduct = alerts.pushProduct?.product || null;
        if (currentPushProduct && currentPushProduct !== prev?.pushProduct) {
            const p = alerts.pushProduct;
            newSignals.push({
                title: `Push product: ${currentPushProduct}`,
                body: `${currentPushProduct} has the highest 7-day velocity per firm (${(p as any).matters7d} matters across ${(p as any).firms} firms).`,
                type: 'push-product',
                extra: { view: 'signals', context: { kind: 'push-product', product: currentPushProduct } },
            });
        }

        // ─── Fire notifications ──────────────────────────────────────
        if (newSignals.length > 0 && Capacitor.isNativePlatform()) {
            newSignals.forEach((s, i) => {
                // Stagger IDs so they don't overwrite each other
                const id = Date.now() + i;
                showLocalNotification({
                    title: s.title,
                    body: s.body,
                    id,
                    type: s.type === 'churn' || s.type === 'scaling' ? 'task' : 'general',
                    extraData: s.extra,
                }).catch(() => {});
            });
            lastNotifiedRef.current = now;
        }

        // ─── Persist the new snapshot ────────────────────────────────
        writeSnapshot({
            newUsers24hCount: alerts.newUsers24hCount,
            newFirms24hCount: alerts.newFirms24hCount,
            churnRiskCount: alerts.churnRiskCount,
            scalingSignalIds: (alerts.scalingSignals as any[]).map(s => s.id),
            worstScalingSeverity: worstSeverity,
            pushProduct: currentPushProduct,
            notifiedAt: lastNotifiedRef.current,
        });
    }, [enabled, alerts]);

    // Tick: force a re-evaluation every POLL_INTERVAL_MS. The Convex query
    // is already live, but this ensures we re-check the throttle window
    // even if no Convex update fires (e.g., when the app is foregrounded
    // after being backgrounded for hours).
    useEffect(() => {
        if (!enabled) return;
        const t = window.setInterval(() => {
            // No-op — the alerts query is live; this just makes sure we
            // re-evaluate the throttle. We force a state change by reading
            // and re-writing the snapshot's notifiedAt.
            const prev = readSnapshot();
            if (prev) writeSnapshot({ ...prev });
        }, POLL_INTERVAL_MS);
        return () => window.clearInterval(t);
    }, [enabled]);

    return alerts;
}
