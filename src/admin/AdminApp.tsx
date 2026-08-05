/**
 * AdminApp — the shell for the PracticePro Founder APK.
 *
 * NO AUTH REQUIRED:
 *   The founder APK auto-logs in as a demo founder user. The session
 *   token is written to localStorage in main.tsx BEFORE React mounts,
 *   so AuthContext picks it up and skips the login screen entirely.
 *
 *   The real security boundary is server-side (requireAdmin() in Convex
 *   checks the tokenIdentifier against the users table). If the demo
 *   email doesn't exist as an Admin in the DB, founder metrics queries
 *   will return an authorization error (but the app will still load).
 *
 * SPLASH SCREEN:
 *   The HTML splash in admin.html plays a 3-phase animation that mirrors
 *   the consumer app's SplashScreen but in reverse:
 *     Consumer:  black → amber → green → "Ready"
 *     Founder:   green → orange → black → "FOUNDER"
 *   AdminApp drives the phase transitions via CSS classes on the splash
 *   element, then dismisses it after the animation completes.
 */

import React, { useState, useEffect } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { FounderDashboard } from '../components/FounderDashboard';
import { FirmManagement } from './views/FirmManagement';
import { UserManagement } from './views/UserManagement';
import { AuditLogs } from './views/AuditLogs';
import { FounderSignals } from './views/FounderSignals';
import { useFounderSignals } from './useFounderSignals';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

export type AdminView = 'dashboard' | 'signals' | 'firms' | 'users' | 'audit' | 'settings';

/**
 * Drive the HTML splash screen phases.
 * Mirrors the consumer SplashScreen.tsx timing but in reverse:
 *   Phase 1 (0ms):     green  — logo visible in brand green
 *   Phase 2 (750ms):   orange — logo morphs to orange
 *   Phase 3 (1350ms):  black  — logo morphs to black + "FOUNDER" text appears
 *   Exit   (1900ms):   fade out splash, mount the app
 */
function useFounderSplashTimeline() {
    useEffect(() => {
        const splash = document.getElementById('founder-splash');
        if (!splash) return;

        // Phase 1: green (already set in HTML as default)
        // Phase 2: orange at 750ms
        const t1 = window.setTimeout(() => {
            splash.classList.add('phase-orange');
        }, 750);

        // Phase 3: black at 1350ms
        const t2 = window.setTimeout(() => {
            splash.classList.add('phase-black');
        }, 1350);

        // Exit: fade out at 1900ms
        const t3 = window.setTimeout(() => {
            splash.classList.add('hidden');
            // Remove from DOM after the fade-out transition
            window.setTimeout(() => { try { splash.remove(); } catch {} }, 500);
        }, 1900);

        return () => {
            window.clearTimeout(t1);
            window.clearTimeout(t2);
            window.clearTimeout(t3);
        };
    }, []);
}

export const AdminApp: React.FC = () => {
    const { currentUser } = useAuth();
    const [activeView, setActiveView] = useState<AdminView>('dashboard');

    // Drive the splash screen animation (green → orange → black → FOUNDER)
    useFounderSplashTimeline();

    // ─── Founder signals (new users / churn / scaling / per-product) ───
    const isFounder = currentUser?.role === UserRole.Admin;
    useFounderSignals({ enabled: isFounder });

    // While the session is loading (first frame), render nothing —
    // the HTML splash is still visible and will be dismissed by the
    // timeline hook above.
    if (!currentUser) {
        return null;
    }

    return (
        <div className="h-[100dvh] flex bg-slate-50 dark:bg-zinc-900 overflow-hidden">
            <AdminSidebar activeView={activeView} setActiveView={setActiveView} />
            <main className="flex-1 overflow-hidden min-w-0">
                {activeView === 'dashboard' && <FounderDashboard />}
                {activeView === 'signals' && <FounderSignals />}
                {activeView === 'firms' && <FirmManagement />}
                {activeView === 'users' && <UserManagement />}
                {activeView === 'audit' && <AuditLogs />}
                {activeView === 'settings' && (
                    <div className="h-full flex items-center justify-center text-slate-400 p-8">
                        <p className="text-sm">Platform settings coming soon.</p>
                    </div>
                )}
            </main>
        </div>
    );
};
