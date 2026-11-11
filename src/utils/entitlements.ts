/**
 * entitlements — the ONE authoritative frontend interpretation of what a
 * firm can use (KOMPLETE unified-product integrity round, K-3).
 *
 * Before this module, the entitlement decision lived inline inside the
 * useFeatures hook and mixed two vocabularies:
 *   - the PLAN (Core/Growth/Pro/Enterprise/Komplete, trial-aware) decides
 *     the DEPTH of what is available (tier limits, premium gates);
 *   - the PRODUCT (vega/atrium/unified) decides which SURFACES exist.
 * Several backend gates (tierLimits, estateCommunity) and a second flag
 * engine (productConfig) re-derived the same answer with drifting rules —
 * the "split-brain" this round closes.
 *
 * THE AUTHORITATIVE MODEL (mirrored server-side in convex/tierLimits.ts):
 *   1. PRODUCT decides surfaces. Legal surfaces (Matters, Research,
 *      DraftPro, Retainer Billing) need a legal-capable product; property
 *      surfaces (Properties, rent ledger, service charges) need a
 *      property-capable product. A unified (Komplete) firm has BOTH.
 *   2. PLAN decides depth. Trial-aware: while trialEndsAt is in the future
 *      and trialPlan is set, the trial plan grants entitlements even though
 *      billingPlan stays Core.
 *   3. A unified firm on a non-Komplete plan (e.g. after trial expiry) is
 *      an inconsistent-but-tolerated state: it keeps BOTH product surfaces
 *      (property management is a surface, not a tier perk — Atrium Core
 *      has it) but every plan-gated premium feature locks exactly as it
 *      does for single-product firms on the same plan. The server applies
 *      the same plan to both dimension sets (seats/matters/storage per the
 *      Vega table; units/tenants/WhatsApp per the Atrium table).
 *   4. Only the Komplete plan (or Enterprise, its equivalent) confers
 *      "unlimited everything" — never the product field alone.
 *
 * This module is PURE: it takes primitives, returns decisions, and is
 * unit-tested (tests/unit/entitlements.test.ts). useFeatures is a thin
 * wrapper — client-side state manipulation cannot alter it because it
 * derives everything from the server-loaded firm/user records.
 */

import { SubscriptionPlan } from '../types';

// ─── Product normalization ───────────────────────────────────────────────────
// The backend accepts several product spellings (createFirm validator,
// fixProductMode's valid list, signup normalization all accept 'komplete';
// legacy rows may store 'sentry'). The canonical runtime values are
// 'vega' | 'atrium' | 'unified'. ProductContext aliases the same set; this
// module MUST agree with it so entitlements and UI surfaces never diverge
// (the K-8 interaction defect: ProductContext resolved 'komplete' →
// 'unified' for navigation, while the raw value reached useFeatures and
// stripped BOTH capability flags).
export type NormalizedProduct = 'vega' | 'atrium' | 'unified';

const PRODUCT_ALIASES: Record<string, NormalizedProduct> = {
    vega: 'vega',
    legal: 'vega',
    atrium: 'atrium',
    property: 'atrium',
    sentry: 'atrium',
    unified: 'unified',
    komplete: 'unified',
};

export function normalizeProduct(raw?: string | null): NormalizedProduct {
    if (!raw) return 'unified'; // hydration default — provisional until firm data lands
    return PRODUCT_ALIASES[String(raw).toLowerCase().trim()] || 'unified';
}

export function isPropertyCapableProduct(raw?: string | null): boolean {
    const p = normalizeProduct(raw);
    return p === 'atrium' || p === 'unified';
}

export function isLegalCapableProduct(raw?: string | null): boolean {
    const p = normalizeProduct(raw);
    return p === 'vega' || p === 'unified';
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

export interface EntitlementInput {
    /** The firm's actual subscription plan (billing basis). */
    billingPlan?: string | null;
    /** The plan being trialed, if any. */
    trialPlan?: string | null;
    /** Epoch ms when the trial ends. */
    trialEndsAt?: number | null;
    /** The firm's product field — any accepted spelling. */
    product?: string | null;
    /** The firm's add-on subscriptions (regulatoryCrossReference, estateCommunity, …). */
    subscriptionAddons?: any;
    /** Current time (injectable for tests). */
    now?: number;
}

export interface Entitlements {
    currentPlan: string;
    billingPlan: string;
    isOnTrial: boolean;
    trialPlan: string | null;
    trialEndsAt: number | null;
    product: NormalizedProduct;
    isPropertyFirm: boolean;
    isLegalFirm: boolean;
    isKompleteFirm: boolean;
    isGrowthOrAbove: boolean;
    isKompletePlan: boolean;

    canUseAI: boolean;
    canUseAutomation: boolean;
    canUseAdvancedReporting: boolean;
    canUsePropertyManager: boolean;
    canUseClientPortal: boolean;
    canUseTenantPortal: boolean;
    canUseCourtIntelligence: boolean;
    canUseAdvancedBilling: boolean;
    canUseReportGenerator: boolean;
    canUseRetainerAutoBilling: boolean;
    canUseResearchStudio: boolean;
    canUseContractAnalyzer: boolean;
    canUseRegulatoryEngine: boolean;
    canAddUsers: boolean;
    canUseAuditLogs: boolean;
    canUseExternalCounsel: boolean;
    canUseAdvancedSecurity: boolean;
    canUseEstateCommunity: boolean;
    estateCommunityStatus: string;
    estateCommunityTrialEndsAt: number | null;
    estateCommunityIncludedInPlan: boolean;
    maxUsers: number | null;
    supportLevel: string;
    checkFeatureAccess: (feature: string) => boolean;
}

/**
 * The single entitlement computation. Pure — same inputs, same outputs,
 * no React, no context. Everything the UI gates on comes from here.
 */
export function computeEntitlements(input: EntitlementInput): Entitlements {
    const now = input.now ?? Date.now();

    // ── Trial-aware plan resolution (billing stays Core during trials) ──
    const billingPlan = input.billingPlan || SubscriptionPlan.Core;
    const trialEndsAt = input.trialEndsAt ?? null;
    const trialPlan = input.trialPlan ?? null;
    const isOnTrial = !!(trialEndsAt && trialPlan && trialEndsAt > now);
    const plan = isOnTrial ? trialPlan : billingPlan;

    // ── Product surfaces (normalized — one vocabulary everywhere) ──
    const product = normalizeProduct(input.product);
    const isPropertyFirm = product === 'atrium' || product === 'unified';
    const isLegalFirm = product === 'vega' || product === 'unified';
    const isKompleteFirm = product === 'unified';

    // ── Plan hierarchy ──
    const isCore = plan === SubscriptionPlan.Core;
    const isGrowth = plan === SubscriptionPlan.Growth;
    const isPro = plan === SubscriptionPlan.Pro;
    const isEnterprise = plan === SubscriptionPlan.Enterprise;
    const isKompletePlan = plan === SubscriptionPlan.Komplete;

    const isGrowthOrAbove = isGrowth || isPro || isEnterprise || isKompletePlan;
    const isProOrAbove = isPro || isEnterprise || isKompletePlan;
    const isEnterpriseOrAbove = isEnterprise || isKompletePlan;

    // ── The property-manager hybrid rule (unchanged semantics, documented) ──
    // Atrium/Unified firms: property management is a product SURFACE — every
    // plan includes it (depth limited by the plan's unit/tenant limits).
    // Vega Pro+: unlocks property management as a cross-sell feature.
    // The Komplete plan: always unlocked.
    const canUsePropertyManager =
        isPropertyFirm
        || isProOrAbove
        || isKompletePlan;

    const addons = input.subscriptionAddons || {};
    const regulatoryActive = addons.regulatoryCrossReference?.status === 'active';
    const regulatoryTrial =
        addons.regulatoryCrossReference?.status === 'trial' &&
        addons.regulatoryCrossReference?.trialEndsAt > now;
    const estateActive = addons.estateCommunity?.status === 'active';
    const estateTrial =
        addons.estateCommunity?.status === 'trial' &&
        addons.estateCommunity?.trialEndsAt > now;

    const canUseRegulatoryEngine = isLegalFirm && (isEnterpriseOrAbove || regulatoryActive || regulatoryTrial);
    const canUseEstateCommunity = isPropertyFirm && (isProOrAbove || estateActive || estateTrial);

    const entitlements: Entitlements = {
        currentPlan: plan,
        billingPlan,
        isOnTrial,
        trialPlan: isOnTrial ? trialPlan : null,
        trialEndsAt: isOnTrial ? trialEndsAt : null,
        product,
        isPropertyFirm,
        isLegalFirm,
        isKompleteFirm,
        isGrowthOrAbove,
        isKompletePlan,

        canUseAI: isGrowthOrAbove,
        canUseAutomation: isEnterpriseOrAbove,
        canUseAdvancedReporting: isProOrAbove,
        canUsePropertyManager,
        canUseClientPortal: isGrowthOrAbove,
        canUseTenantPortal: isGrowthOrAbove && isPropertyFirm,
        canUseCourtIntelligence: isGrowthOrAbove && isLegalFirm,
        canUseAdvancedBilling: isProOrAbove,
        canUseReportGenerator: isGrowthOrAbove,
        canUseRetainerAutoBilling: isLegalFirm && isGrowthOrAbove,
        canUseResearchStudio: isLegalFirm && isGrowthOrAbove,
        canUseContractAnalyzer: isLegalFirm,
        canUseRegulatoryEngine,
        canAddUsers: isGrowthOrAbove,
        canUseAuditLogs: isEnterpriseOrAbove,
        canUseExternalCounsel: isEnterpriseOrAbove,
        canUseAdvancedSecurity: isEnterpriseOrAbove,
        canUseEstateCommunity,
        estateCommunityStatus: addons.estateCommunity?.status || 'none',
        estateCommunityTrialEndsAt: addons.estateCommunity?.trialEndsAt || null,
        estateCommunityIncludedInPlan: isPropertyFirm && isProOrAbove,
        maxUsers: isEnterpriseOrAbove || isKompletePlan ? null : (isProOrAbove ? null : (isGrowth ? 5 : 1)),
        supportLevel: isEnterprise
            ? 'Dedicated Account Manager'
            : (isKompletePlan ? 'Priority Phone & Email'
            : (isPro ? 'Priority Email' : 'Standard')),

        checkFeatureAccess: (feature: string) => {
            switch (feature) {
                case 'ai': return isGrowthOrAbove;
                case 'automation': return isEnterpriseOrAbove;
                case 'team': return isGrowthOrAbove;
                case 'bi': return isProOrAbove;
                case 'property': return canUsePropertyManager;
                case 'research': return isLegalFirm;
                case 'researchStudio': return isLegalFirm && isGrowthOrAbove;
                case 'audit': return isEnterpriseOrAbove;
                case 'security': return isEnterpriseOrAbove;
                case 'clientPortal': return isGrowthOrAbove;
                case 'tenantPortal': return isGrowthOrAbove && isPropertyFirm;
                case 'courtIntelligence': return isGrowthOrAbove && isLegalFirm;
                case 'advancedBilling': return isProOrAbove;
                case 'reportGenerator': return isGrowthOrAbove;
                case 'externalCounsel': return isEnterpriseOrAbove;
                case 'retainerAutoBilling': return isLegalFirm && isGrowthOrAbove;
                case 'contractAnalyzer': return isLegalFirm;
                case 'regulatoryEngine': return canUseRegulatoryEngine;
                case 'estateCommunity': return canUseEstateCommunity;
                default: return true;
            }
        },
    };

    // isCore referenced for parity with the original hook computation
    void isCore;
    return entitlements;
}

// ─── Cross-product role permissions (K-3 / required test 12) ────────────────
//
// Financials visibility for staff. The split that existed:
//   - Vega-only firms: firm billing/profitability is sensitive → admin/solo.
//   - Atrium firms: Financials is the operational revenue hub (rent ledger,
//     service charges, payment proofs, reconciliation) every team member
//     works in → all team members.
// A UNIFIED firm is half property business: its rent ledger and service
// charges are exactly the operational surfaces the Atrium rule exists for,
// so unified firms follow the property rule. (Firm-management actions stay
// admin-only in usePermissions; this only decides the Financials VIEW.)
export function staffCanViewBilling(input: {
    role: string;
    isSolo: boolean;
    /** The firm's product field — any accepted spelling. */
    product?: string | null;
}): boolean {
    if (input.isSolo) return true;
    if (input.role === 'Admin') return true;
    return isPropertyCapableProduct(input.product);
}
