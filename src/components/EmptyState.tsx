
import React from 'react';
import { PlusIcon } from '../constants';

interface EmptyStateProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    actionLabel?: string;
    onAction?: () => void;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
}

/**
 * EmptyState — standardized empty state component used across the app.
 *
 * Design rules (enforced here so callers don't drift):
 * - Icon is pinned to w-12 h-12 (48px) inside a w-14 h-14 (56px) circle.
 *   Previously callers passed w-full h-full or w-24 h-24, causing design drift.
 * - Container: rounded-full bg-slate-100 dark:bg-zinc-800 — consistent across
 *   Properties, Matters, Documents, Contacts, Tasks, etc.
 * - Layout: flex-col items-center justify-center, uniform p-8, max-w-sm text.
 * - No clipping, no cut-off edges, no geometric mismatches.
 */
const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    description,
    icon,
    actionLabel,
    onAction,
    secondaryActionLabel,
    onSecondaryAction
}) => {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] p-8 text-center animate-fade-in w-full">
            {/* Icon — pinned to 48px inside a 56px circle. The wrapper forces
                consistent sizing regardless of what className the caller put
                on the icon (we override with w-12 h-12). */}
            <div className="mb-4 flex-shrink-0">
                <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
                    <div className="w-12 h-12 flex items-center justify-center text-slate-400 dark:text-zinc-500 [&>svg]:w-6 [&>svg]:h-6">
                        {icon}
                    </div>
                </div>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm mb-5 leading-relaxed">
                {description}
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 justify-center items-center">
                {actionLabel && onAction && (
                    <button
                        onClick={onAction}
                        className="px-5 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 shadow-sm transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <PlusIcon className="w-4 h-4" />
                        {actionLabel}
                    </button>
                )}
                {secondaryActionLabel && onSecondaryAction && (
                    <button
                        onClick={onSecondaryAction}
                        className="px-5 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-zinc-700 transition-all text-sm"
                    >
                        {secondaryActionLabel}
                    </button>
                )}
            </div>
        </div>
    );
};

export default EmptyState;
