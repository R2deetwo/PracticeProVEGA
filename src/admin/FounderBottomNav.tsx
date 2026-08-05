/**
 * FounderBottomNav — mobile-optimized bottom navigation for the Founder APK.
 *
 * Mirrors the consumer app's BottomNav pattern:
 *   - Fixed at the bottom of the screen
 *   - Icon + label for each nav item
 *   - Backdrop blur + safe area padding
 *   - Active item highlighted in brand color
 *   - Haptic feedback on tap (if available)
 *
 * This replaces the sidebar (which took up too much screen space on mobile).
 * The founder APK is designed for portrait mode on phones, just like the
 * consumer app.
 */

import React from 'react';
import type { AdminView } from './AdminApp';

interface NavItem {
    view: AdminView;
    label: string;
    icon: React.ReactElement;
}

const NAV_ITEMS: NavItem[] = [
    {
        view: 'dashboard',
        label: 'Dashboard',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
        ),
    },
    {
        view: 'signals',
        label: 'Signals',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
        ),
    },
    {
        view: 'organizations',
        label: 'Orgs',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
        ),
    },
    {
        view: 'audit',
        label: 'Audit',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
        ),
    },
    {
        view: 'settings',
        label: 'Settings',
        icon: (
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
    },
];

interface FounderBottomNavProps {
    activeView: AdminView;
    setActiveView: (v: AdminView) => void;
}

export const FounderBottomNav: React.FC<FounderBottomNavProps> = ({ activeView, setActiveView }) => {
    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-[1000] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-zinc-700 pb-safe pt-1"
        >
            <div className="flex items-start">
                {NAV_ITEMS.map(item => {
                    const isActive = activeView === item.view;
                    return (
                        <button
                            key={item.view}
                            onClick={() => setActiveView(item.view)}
                            className={`active-press touch-target relative flex flex-col items-center justify-center flex-1 pt-1.5 pb-1 h-14 transition-colors duration-200 ${
                                isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-zinc-400'
                            }`}
                            aria-current={isActive ? 'page' : undefined}
                            aria-label={item.label}
                        >
                            <div className="relative">
                                {React.cloneElement(item.icon, { className: 'w-5 h-5 mb-0.5' })}
                            </div>
                            <span className="text-2xs font-medium">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};
