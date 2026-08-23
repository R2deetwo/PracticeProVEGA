
import { useDataState } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SubscriptionPlan } from '../types';
import { isPropertyCapable, isLegalCapable, isKomplete } from '../constants/tiers';

export const useFeatures = () => {
    const { appState } = useDataState();
    const { currentUser } = useAuth();

    // ─── CRO AUDIT TRACK B: Trial-aware plan resolution ──────────────────
    // If the firm has an active trial (trialEndsAt in the future, trialPlan set),
    // use the trialPlan for entitlement calculations — but only for feature
    // gating, not for billing display. The actual subscriptionPlan stays at
    // 'Core' until the trial converts to paid.
    const now = Date.now();
    const trialEndsAt = (appState.firmDetails as any)?.trialEndsAt;
    const trialPlan = (appState.firmDetails as any)?.trialPlan;
    const isOnTrial = !!(trialEndsAt && trialPlan && trialEndsAt > now);

    // Derive plan and product from firm details, with fallback to currentUser
    // for portal users (Client/Tenant) whose firm data may not be loaded yet.
    // This prevents portal users from seeing "Portal Unavailable" when
    // DataProvider hasn't loaded firmDetails for them.
    const billingPlan = appState.firmDetails.subscriptionPlan
        || (currentUser?.role === 'Client' || currentUser?.role === 'Tenant'
            ? SubscriptionPlan.Komplete  // Portal users: assume full access until firm data loads
            : SubscriptionPlan.Core);

    // For entitlements: use trialPlan if on active trial, else billingPlan.
    const plan = isOnTrial ? (trialPlan as any) : billingPlan;

    const product = appState.firmDetails.product
        || currentUser?.product
        || 'unified';

    // ─── Product Mode ────────────────────────────────────────────────────
    const isPropertyFirm = isPropertyCapable(product);
    const isLegalFirm    = isLegalCapable(product);
    const isKompleteFirm = isKomplete(product);

    // ─── Plan Hierarchy ──────────────────────────────────────────────────
    // NOTE: "Ultimate" plan has been removed. Komplete is the unified product.
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
        || isProOrAbove             // VEGA Pro+ unlocks property features
        || isKompletePlan;          // Komplete: always unlocked

    return {
        currentPlan: plan,
        billingPlan,          // The actual subscription plan (may be 'Core' during trial)
        isOnTrial,            // True if firm is in active trial window
        trialPlan: isOnTrial ? trialPlan : null,
        trialEndsAt: isOnTrial ? trialEndsAt : null,
        product,
        isPropertyFirm,
        isLegalFirm,
        isKompleteFirm,
        isGrowthOrAbove,
        isKompletePlan,

        // --- FEATURE GATES ---

        // AI Features (Growth+)
        canUseAI: isGrowthOrAbove,
        canUseAutomation: isEnterpriseOrAbove,

        // Advanced Reporting (Pro+)
        canUseAdvancedReporting: isProOrAbove,

        // Property Management — see rule above
        canUsePropertyManager,

        // Portal Features (Growth+)
        canUseClientPortal: isGrowthOrAbove,   // Client Portal gated to Growth+ (Core = no portal)
        canUseTenantPortal: isGrowthOrAbove && isPropertyFirm,  // Residents' Portal: Atrium Growth+ only

        // Legal Intelligence (Growth+)
        canUseCourtIntelligence: isGrowthOrAbove && isLegalFirm,  // Court rules & procedural intelligence

        // Billing & Financials
        canUseAdvancedBilling: isProOrAbove,           // Advanced billing & analytics (Pro+)
        canUseReportGenerator: isGrowthOrAbove,        // Report Generator (Growth+) — Core gets basic billing only

        // ─── AUTOMATED RETAINER BILLING (Premium) ───────────────────────
        // High-value operational feature: cron-based recurring retainer
        // invoicing + Billing Monitor outbox. Strictly gated to:
        //   - Vega (legal) firms on Growth, Pro, or Enterprise
        //   - Komplete (unified) firms (any plan — all features included)
        // Excluded for:
        //   - Atrium-only (property) firms — retainer billing is legal-only
        //   - Vega Core (free tier)
        // Backend mirrors this in convex/retainerBilling.ts → isFirmPremiumRetainerEligible
        canUseRetainerAutoBilling: isLegalFirm && isGrowthOrAbove,

        // Research
        canUseResearchStudio: isLegalFirm && isGrowthOrAbove,  // AI research studio (Growth+ legal)
        canAccessLawReports: isLegalFirm,                       // Basic law reports (all legal plans)

        // Team Features
        canAddUsers: isGrowthOrAbove,

        // Enterprise Features
        canUseAuditLogs: isEnterpriseOrAbove,
        canUseExternalCounsel: isEnterpriseOrAbove,
        canUseAdvancedSecurity: isEnterpriseOrAbove,

        // ─── ESTATE COMMUNITY FEATURES (Atrium only) ────────────────────
        // Three modules: Amenity Booking, Estate Bulletin, Service Provider Directory.
        // Pricing model (Aug 2026):
        //   - Pro / Enterprise: INCLUDED FREE (core to the "estate manager" persona)
        //   - Starter / Growth: ADD-ON at ₦5,000/month (below Sentry's ₦7,500)
        //   - Trial: 30 days free, once per firm (mirrors VMS trial pattern)
        // Backend mirrors this in convex/estateCommunity.ts — admin mutations
        // check requireAdmin, but the feature gate lives here for the UI.
        // The add-on state is stored at firmDetails.subscriptionAddons.estateCommunity
        // and follows the same { status, trialEndsAt, activatedAt } shape as VMS.
        canUseEstateCommunity: isPropertyFirm && (
            isProOrAbove  // Pro/Enterprise/Komplete: included
            || (appState.firmDetails as any)?.subscriptionAddons?.estateCommunity?.status === 'active'
            || (
                (appState.firmDetails as any)?.subscriptionAddons?.estateCommunity?.status === 'trial'
                && (appState.firmDetails as any)?.subscriptionAddons?.estateCommunity?.trialEndsAt > now
            )
        ),

        // Estate Community trial status (for the admin UI to show countdown / upgrade prompt)
        estateCommunityStatus: (appState.firmDetails as any)?.subscriptionAddons?.estateCommunity?.status || 'none',
        estateCommunityTrialEndsAt: (appState.firmDetails as any)?.subscriptionAddons?.estateCommunity?.trialEndsAt || null,
        // True if Estate Community is included in the current plan (Pro+) —
        // used by the admin panel to show "Included in your plan" vs "Add-on: ₦5,000/mo"
        estateCommunityIncludedInPlan: isPropertyFirm && isProOrAbove,

        // Limits
        maxUsers: isEnterpriseOrAbove || isKompletePlan ? null : (isProOrAbove ? null : (isGrowth ? 5 : 1)),
        supportLevel: isEnterprise
            ? 'Dedicated Account Manager'
            : (isKompletePlan ? 'Priority Phone & Email'
            : (isPro ? 'Priority Email' : 'Standard')),

        // Helper
        checkFeatureAccess: (feature: 'ai' | 'research' | 'automation' | 'audit' | 'security' | 'bi' | 'team' | 'property' | 'clientPortal' | 'tenantPortal' | 'courtIntelligence' | 'advancedBilling' | 'reportGenerator' | 'researchStudio' | 'externalCounsel' | 'retainerAutoBilling' | 'estateCommunity') => {
            switch (feature) {
                case 'ai':                return isGrowthOrAbove;
                case 'automation':        return isEnterpriseOrAbove;
                case 'team':              return isGrowthOrAbove;
                case 'bi':                return isProOrAbove;
                case 'property':          return canUsePropertyManager;
                case 'research':          return isLegalFirm;
                case 'researchStudio':    return isLegalFirm && isGrowthOrAbove;
                case 'audit':             return isEnterpriseOrAbove;
                case 'security':          return isEnterpriseOrAbove;
                case 'clientPortal':      return isGrowthOrAbove;
                case 'tenantPortal':      return isGrowthOrAbove && isPropertyFirm;
                case 'courtIntelligence': return isGrowthOrAbove && isLegalFirm;
                case 'advancedBilling':   return isProOrAbove;
                case 'reportGenerator':   return isGrowthOrAbove;
                case 'externalCounsel':   return isEnterpriseOrAbove;
                case 'retainerAutoBilling': return isLegalFirm && isGrowthOrAbove;
                case 'estateCommunity':   return isPropertyFirm && (
                    isProOrAbove
                    || (appState.firmDetails as any)?.subscriptionAddons?.estateCommunity?.status === 'active'
                    || ((appState.firmDetails as any)?.subscriptionAddons?.estateCommunity?.status === 'trial'
                        && (appState.firmDetails as any)?.subscriptionAddons?.estateCommunity?.trialEndsAt > now)
                );
                default:                  return true;
            }
        }
    };
};
