
import { useDataState } from '../contexts/DataContext';
import { SubscriptionPlan } from '../types';
import { isPropertyCapable, isLegalCapable, isKomplete } from '../constants/tiers';

export const useFeatures = () => {
    const { appState } = useDataState();
    const plan = appState.firmDetails.subscriptionPlan || SubscriptionPlan.Core;
    const product = appState.firmDetails.product || 'legal';

    // ─── Product Mode ────────────────────────────────────────────────────
    const isPropertyFirm = isPropertyCapable(product);
    const isLegalFirm    = isLegalCapable(product);
    const isKompleteFirm = isKomplete(product);

    // ─── Plan Hierarchy ──────────────────────────────────────────────────
    const isCore       = plan === SubscriptionPlan.Core;
    const isGrowth     = plan === SubscriptionPlan.Growth;
    const isPro        = plan === SubscriptionPlan.Pro;
    const isEnterprise = plan === SubscriptionPlan.Enterprise;
    const isKompletePlan = plan === SubscriptionPlan.Komplete;

    const isGrowthOrAbove    = isGrowth || isPro || isEnterprise || isKompletePlan;
    const isProOrAbove       = isPro || isEnterprise || isKompletePlan;
    const isEnterpriseOrAbove = isEnterprise || isKompletePlan;

    // ─── Entitlements ─────────────────────────────────────────────────────
    //
    // KEY RULES:
    // 1. For Atrium/Property firms, every paid plan unlocks Property Management.
    // 2. Komplete has ALL features unlocked (single tier, unlimited).
    //
    const canUsePropertyManager =
        isPropertyFirm              // Atrium/Unified firm: any plan unlocks it
        || isKompletePlan           // Komplete: always unlocked
        || isProOrAbove;            // Vega firm: requires Pro+

    return {
        currentPlan: plan,
        product,
        isPropertyFirm,
        isLegalFirm,
        isKompleteFirm,

        // --- FEATURE GATES ---

        // AI Features (Growth+)
        canUseAI: isGrowthOrAbove,
        canUseAutomation: isEnterpriseOrAbove,

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
        canUseAuditLogs: isEnterpriseOrAbove,
        canUseExternalCounsel: isEnterpriseOrAbove,
        canUseAdvancedSecurity: isEnterpriseOrAbove,

        // Limits
        maxUsers: isEnterpriseOrAbove || isKompletePlan ? null : (isProOrAbove ? 10 : (isGrowth ? 3 : 1)),
        supportLevel: isEnterprise
            ? 'Dedicated Account Manager'
            : (isKompletePlan ? 'Priority Phone & Email'
            : (isPro ? 'Priority Email' : 'Standard')),

        // Helper
        checkFeatureAccess: (feature: 'ai' | 'research' | 'automation' | 'audit' | 'security' | 'trust' | 'bi' | 'team' | 'property') => {
            switch (feature) {
                case 'ai':         return isGrowthOrAbove;
                case 'automation': return isEnterpriseOrAbove;
                case 'team':       return isGrowthOrAbove;
                case 'bi':         return isProOrAbove;
                case 'property':   return canUsePropertyManager;
                case 'research':   return isLegalFirm;
                case 'trust':      return true;
                case 'audit':      return isEnterpriseOrAbove;
                case 'security':   return isEnterpriseOrAbove;
                default:           return true;
            }
        }
    };
};
