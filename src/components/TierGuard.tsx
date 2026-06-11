import React from 'react';
import { useFeatures } from '../hooks/useFeatures';
import { useUI } from '../contexts/UIContext';
import { ShieldCheckIcon, LockClosedIcon } from '../constants';

interface TierGuardProps {
    /** The feature key from useFeatures that must be truthy */
    feature: string;
    /** Optional: override the plan name shown in the upgrade CTA */
    requiredPlanLabel?: string;
    /** Optional: custom message explaining what's locked */
    lockedMessage?: string;
    /** Render children if the feature is allowed */
    children: React.ReactNode;
    /** Optional: render a compact variant (for sidebar items / inline cards) */
    variant?: 'full' | 'compact';
    /** Optional: fallback to render instead of the default locked state */
    fallback?: React.ReactNode;
}

/**
 * TierGuard — Tier-based feature gate.
 *
 * Wraps any UI section that requires a specific subscription tier.
 * When the current plan doesn't meet the requirement, a polished
 * upgrade prompt is shown instead of the children.
 *
 * Usage:
 *   <TierGuard feature="canUseClientPortal" requiredPlanLabel="Growth">
 *       <ClientPortalSetup />
 *   </TierGuard>
 */
export const TierGuard: React.FC<TierGuardProps> = ({
    feature,
    requiredPlanLabel,
    lockedMessage,
    children,
    variant = 'full',
    fallback,
}) => {
    const features = useFeatures() as Record<string, unknown>;
    const { navigateTo } = useUI();

    const isAllowed = !!features[feature];

    if (isAllowed) return <>{children}</>;

    // Derive the plan label from the feature name if not explicitly provided
    const planLabel = requiredPlanLabel || derivePlanLabel(feature);
    const message = lockedMessage || `This feature requires the ${planLabel} plan or higher. Upgrade to unlock it.`;

    // If a custom fallback is provided, use it
    if (fallback) return <>{fallback}</>;

    // Compact variant — for sidebar items, cards, inline blocks
    if (variant === 'compact') {
        return (
            <div className="relative group">
                <div className="opacity-50 pointer-events-none select-none blur-[2px]">
                    {children}
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-zinc-900/60 rounded-lg">
                    <button
                        onClick={() => navigateTo('settings', null, { settingsTargetId: 'subscription-management' })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg shadow-lg transition-colors"
                    >
                        <LockClosedIcon className="w-3.5 h-3.5" />
                        {planLabel}
                    </button>
                </div>
            </div>
        );
    }

    // Full variant — the default upgrade prompt card
    return (
        <div className="flex flex-col items-center justify-center h-full w-full p-8 text-center animate-in fade-in duration-300">
            <div className="max-w-md w-full bg-white dark:bg-zinc-900 p-10 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-zinc-800 flex flex-col items-center">
                <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-6 ring-8 ring-amber-50/50 dark:ring-amber-900/10">
                    <ShieldCheckIcon className="w-10 h-10 text-amber-500 dark:text-amber-400" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">
                    Feature Locked
                </h2>
                <p className="text-slate-500 dark:text-zinc-400 mb-8 leading-relaxed">
                    {message}
                </p>
                <button
                    onClick={() => navigateTo('settings', null, { settingsTargetId: 'subscription-management' })}
                    className="w-full py-3.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/20"
                >
                    Upgrade to {planLabel}
                </button>
            </div>
        </div>
    );
};

/**
 * Derive the minimum plan label from a feature key name.
 * This is a best-effort helper — prefer passing requiredPlanLabel explicitly.
 */
function derivePlanLabel(feature: string): string {
    if (feature.includes('Enterprise') || feature.includes('Audit') || feature.includes('ExternalCounsel') || feature.includes('AdvancedSecurity')) {
        return 'Enterprise';
    }
    if (feature.includes('Pro') || feature.includes('AdvancedReporting') || feature.includes('AdvancedBilling')) {
        return 'Pro';
    }
    // Default: most features are Growth+
    return 'Growth';
}

export default TierGuard;
