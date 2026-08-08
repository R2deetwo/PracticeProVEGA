/**
 * ViewHeader — Canonical page header component.
 *
 * Enforces uniform header height, padding, safe-area insets, glass effect,
 * border color, and typography across ALL views. Kills 30+ duplicate header
 * implementations.
 *
 * Usage:
 *   <ViewHeader title="Matters" subtitle="Manage your legal cases" />
 *   <ViewHeader aria-label="Billing" title="Billing" actions={<button>Export</button>} />
 */

import React from 'react';

interface ViewHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
    /** Optional max-width for the inner container. Default: max-w-7xl */
    maxWidth?: 'max-w-7xl' | 'max-w-6xl' | 'max-w-5xl' | 'max-w-4xl' | 'max-w-3xl' | 'max-w-2xl' | 'none';
}

const ViewHeader: React.FC<ViewHeaderProps> = ({ title, subtitle, actions, maxWidth = 'max-w-7xl' }) => {
    const containerClass = maxWidth === 'none' ? '' : maxWidth;
    return (
        <header
            className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center gap-4"
            style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
        >
            <div className={`w-full ${containerClass} mx-auto flex justify-between items-center gap-4`}>
                <div className="min-w-0 flex-1">
                    <h2 className="text-xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
                        {title}
                    </h2>
                    {subtitle && (
                        <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                            {subtitle}
                        </p>
                    )}
                </div>
                {actions && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {actions}
                    </div>
                )}
            </div>
        </header>
    );
};

export default React.memo(ViewHeader);
