
import { useDataState } from '../contexts/DataContext';
import { SubscriptionPlan } from '../types';
import { isPropertyCapable, isLegalCapable } from '../constants/tiers';

export const useFeatures = () => {
    const { appState } = useDataState();
    const plan = appState.firmDetails.subscriptionPlan || SubscriptionPlan.Core;
    const product = appState.firmDetails.product || 'legal';

    // ─── Product Mode ────────────────────────────────────────────────────
    const isPropertyFirm = isPropertyCapable(product);
    const isLegalFirm    = isLegalCapable(product);

    // ─── Plan Hierarchy ──────────────────────────────────────────────────
    const isCore       = plan === SubscriptionPlan.Core;
    const isGrowth     = plan === SubscriptionPlan.Growth;
    const isPro        = plan === SubscriptionPlan.Pro;
    const isUltimate   = plan === SubscriptionPlan.Ultimate;
    const isEnterprise = plan === SubscriptionPlan.Enterprise;

    const isGrowthOrAbove    = isGrowth || isPro || isUltimate || isEnterprise;
    const isProOrAbove       = isPro || isUltimate || isEnterprise;
    const isUltimateOrAbove  = isUltimate || isEnterprise;

    // ─── Entitlements ─────────────────────────────────────────────────────
    //
    // KEY RULE: For Atrium/Property firms, every paid plan (Core → Enterprise)
    // unlocks the Property Management view. The old "Ultimate only" gate was
    // a Vega-centric rule that must NOT apply to property-mode firms.
    //
    const canUsePropertyManager =
        isPropertyFirm              // Atrium/Unified firm: any plan unlocks it
        || isUltimateOrAbove;       // Vega firm: still requires Ultimate+

    return {
        currentPlan: plan,
        product,
        isPropertyFirm,
        isLegalFirm,

        // --- FEATURE GATES ---

        // AI Features (Growth+)
        canUseAI: isGrowthOrAbove,
        canUseAutomation: isEnterprise,

        // Advanced Reporting (Pro+)
        canUseAdvancedReporting: isProOrAbove,

        // Property Management — see rule above
        canUsePropertyManager,

        // Research (All plans)
        canAccessLawReports: isLegalFirm,
        canUseResearchStudio: isLegalFirm,

        // Core Features (All plans)
        canUseClientPortal: true,
        canUseTrustAccounting: true,

        // Team Features
        canAddUsers: isGrowthOrAbove,

        // Enterprise Features
        canUseAuditLogs: isEnterprise,
        canUseExternalCounsel: isEnterprise,
        canUseAdvancedSecurity: isEnterprise,

        // Limits
        maxUsers: isEnterprise || isUltimate ? null : (isProOrAbove ? 10 : (isGrowth ? 3 : 1)),
        supportLevel: isEnterprise
            ? 'Dedicated Account Manager'
            : (isUltimateOrAbove ? 'Priority Phone & Email'
            : (isPro ? 'Priority Email' : 'Standard')),

        // Helper
        checkFeatureAccess: (feature: 'ai' | 'research' | 'automation' | 'audit' | 'security' | 'trust' | 'bi' | 'team' | 'property') => {
            switch (feature) {
                case 'ai':         return isGrowthOrAbove;
                case 'automation': return isEnterprise;
                case 'team':       return isGrowthOrAbove;
                case 'bi':         return isProOrAbove;
                case 'property':   return canUsePropertyManager;
                case 'research':   return isLegalFirm;
                case 'trust':      return true;
                case 'audit':      return isEnterprise;
                case 'security':   return isEnterprise;
                default:           return true;
            }
        }
    };
};
