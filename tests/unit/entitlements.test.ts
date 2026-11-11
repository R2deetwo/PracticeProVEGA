/**
 * entitlements.test.ts — the K-3 authoritative entitlement contract
 * (KOMPLETE unified-product integrity round).
 *
 * Covers the required test list:
 *   1. Unified firm resolution (product normalization — every accepted
 *      spelling resolves ONE way).
 *   2. Legal-only, property-only and unified entitlements.
 *   3. Core-plan unified firms (the corrected behaviour).
 *   4. Trial activation, expiry and downgrade paths (frontend + the
 *      convex tierLimits mirror).
 *   12. Cross-product permissions (staffCanViewBilling).
 *
 * Plus the client-manipulation guarantee: computeEntitlements is pure and
 * derives every decision from the firm/user records — a caller cannot
 * flip a feature by mutating React state, only by changing what the
 * SERVER loaded (and actual data access is enforced session-side in
 * every Convex function).
 */
import { describe, it, expect } from 'vitest';
import {
    computeEntitlements,
    normalizeProduct,
    isPropertyCapableProduct,
    isLegalCapableProduct,
    staffCanViewBilling,
} from '../../src/utils/entitlements';
// convex/tierLimits.ts is dependency-free pure TS — testable directly.
import {
    getMaxUsersForFirm,
    getTierLimitsForFirm,
    getDisplayPlan,
    effectiveFirmPlan,
    resolveTierLimitsForFirm,
} from '../../convex/tierLimits';
import { isPropertyCapable, isLegalCapable, isKomplete } from '../../src/constants/tiers';

const NOW = 1_700_000_000_000;
// convex/tierLimits' effectiveFirmPlan reads the REAL clock (no injectable
// now), so the server-side trial tests use real-time-relative dates.
const REAL_NOW = Date.now();
const TRIAL_END = REAL_NOW + 86_400_000 * 15; // 15 days out
const TRIAL_EXPIRED = REAL_NOW - 86_400_000; // yesterday
// The pure frontend computation takes an injectable clock — fixed dates.
const FX_NOW = NOW;
const FX_TRIAL_END = FX_NOW + 86_400_000 * 15;
const FX_TRIAL_EXPIRED = FX_NOW - 86_400_000;

describe('1. Unified firm resolution — one vocabulary, every spelling', () => {
    it('canonical spellings resolve to themselves', () => {
        expect(normalizeProduct('vega')).toBe('vega');
        expect(normalizeProduct('atrium')).toBe('atrium');
        expect(normalizeProduct('unified')).toBe('unified');
    });

    it('backend-accepted aliases resolve to the canonical product', () => {
        // createFirm accepts legal/property/unified/vega/atrium; fixProductMode's
        // valid list also accepts 'komplete' and 'sentry' — the K-8 interaction
        // defect was these reaching the entitlement layer un-normalized.
        expect(normalizeProduct('legal')).toBe('vega');
        expect(normalizeProduct('property')).toBe('atrium');
        expect(normalizeProduct('komplete')).toBe('unified');
        expect(normalizeProduct('sentry')).toBe('atrium');
        expect(normalizeProduct('  KOMPLETE ')).toBe('unified'); // case + whitespace tolerant
    });

    it('missing product is the provisional unified default (hydration)', () => {
        expect(normalizeProduct(undefined)).toBe('unified');
        expect(normalizeProduct(null)).toBe('unified');
        expect(normalizeProduct('')).toBe('unified');
    });

    it('a komplete-valued firm row keeps BOTH capability flags (the K-8 defect)', () => {
        // Before K-3/K-8: ProductContext aliased 'komplete' → unified for
        // navigation, but tiers.ts's raw checks stripped both capabilities,
        // hiding Matters AND Properties from such a firm.
        expect(isPropertyCapable('komplete')).toBe(true);
        expect(isLegalCapable('komplete')).toBe(true);
        expect(isKomplete('komplete')).toBe(true);
        expect(isPropertyCapableProduct('komplete')).toBe(true);
        expect(isLegalCapableProduct('komplete')).toBe(true);
        const e = computeEntitlements({ product: 'komplete', billingPlan: 'Komplete' });
        expect(e.isLegalFirm).toBe(true);
        expect(e.isPropertyFirm).toBe(true);
        expect(e.isKompleteFirm).toBe(true);
    });
});

describe('2. Legal-only / property-only / unified entitlements (same plan, different products)', () => {
    const growth = { billingPlan: 'Growth' };

    it('Vega-only firm: legal surfaces on, property surfaces off', () => {
        const e = computeEntitlements({ ...growth, product: 'vega' });
        expect(e.isLegalFirm).toBe(true);
        expect(e.isPropertyFirm).toBe(false);
        expect(e.canUseResearchStudio).toBe(true);
        expect(e.canUseContractAnalyzer).toBe(true);
        expect(e.canUseCourtIntelligence).toBe(true);
        expect(e.canUseTenantPortal).toBe(false);
        expect(e.canUseEstateCommunity).toBe(false);
    });

    it('Atrium-only firm: property surfaces on, legal surfaces off', () => {
        const e = computeEntitlements({ ...growth, product: 'atrium' });
        expect(e.isPropertyFirm).toBe(true);
        expect(e.isLegalFirm).toBe(false);
        expect(e.canUsePropertyManager).toBe(true);
        expect(e.canUseTenantPortal).toBe(true);
        expect(e.canUseResearchStudio).toBe(false);
        expect(e.canUseRetainerAutoBilling).toBe(false);
        expect(e.canUseContractAnalyzer).toBe(false);
    });

    it('Unified firm: BOTH product surfaces (Komplete = Vega + Atrium at the same plan)', () => {
        const e = computeEntitlements({ ...growth, product: 'unified' });
        expect(e.isLegalFirm).toBe(true);
        expect(e.isPropertyFirm).toBe(true);
        expect(e.canUsePropertyManager).toBe(true);
        expect(e.canUseTenantPortal).toBe(true);
        expect(e.canUseResearchStudio).toBe(true);
        expect(e.canUseRetainerAutoBilling).toBe(true);
        expect(e.canUseContractAnalyzer).toBe(true);
    });

    it('the property-manager hybrid rule: Vega Pro+ unlocks property; Vega Core does not', () => {
        expect(computeEntitlements({ billingPlan: 'Core', product: 'vega' }).canUsePropertyManager).toBe(false);
        expect(computeEntitlements({ billingPlan: 'Growth', product: 'vega' }).canUsePropertyManager).toBe(false);
        expect(computeEntitlements({ billingPlan: 'Pro', product: 'vega' }).canUsePropertyManager).toBe(true);
        expect(computeEntitlements({ billingPlan: 'Komplete', product: 'vega' }).canUsePropertyManager).toBe(true);
    });
});

describe('3. Core-plan unified firms — the corrected behaviour', () => {
    // A unified firm on Core is the post-trial-expiry state (the cron reverts
    // subscriptionPlan to Core and clears the trial fields). The authoritative
    // model: BOTH product surfaces survive (property management is a surface,
    // not a tier perk — Atrium Core has it), but every plan-gated premium
    // feature locks exactly as it does for single-product Core firms, and the
    // SERVER-side limits are Core-depth — never unlimited.
    const coreUnified = { billingPlan: 'Core', product: 'unified' };

    it('keeps both product surfaces', () => {
        const e = computeEntitlements(coreUnified);
        expect(e.canUsePropertyManager).toBe(true); // surface, not perk
        expect(e.canUseContractAnalyzer).toBe(true); // standard on every plan
    });

    it('locks every Core-tier premium feature exactly like Vega/Atrium Core', () => {
        const e = computeEntitlements(coreUnified);
        expect(e.canUseAI).toBe(false);
        expect(e.canUseClientPortal).toBe(false);
        expect(e.canUseTenantPortal).toBe(false);
        expect(e.canUseResearchStudio).toBe(false);
        expect(e.canUseAdvancedBilling).toBe(false);
        expect(e.canUseReportGenerator).toBe(false);
        expect(e.canUseRetainerAutoBilling).toBe(false);
        expect(e.canUseAuditLogs).toBe(false);
        expect(e.maxUsers).toBe(1); // Core seat limit — NOT unlimited
    });

    it('server-side: a unified product alone NEVER grants unlimited limits (the revenue leak)', () => {
        // Before the fix, getTierLimitsForFirm treated ANY unified-product firm
        // as all-unlimited regardless of plan — the founderMetrics D5 leak.
        const limits = getTierLimitsForFirm('Core', 'unified');
        expect(limits.maxUsers).toBe(1);              // Vega Core seats
        expect(limits.maxUnits).toBe(10);             // Atrium Core units
        expect(limits.maxActiveTenants).toBe(15);     // Atrium Core tenants
        expect(limits.maxActiveMatters).toBe(10);     // Vega Core matters
        expect(getMaxUsersForFirm('Core', 'unified')).toBe(1);
    });

    it('server-side: unified + Growth/Pro get that plan\u2019s depth on BOTH sides', () => {
        const growth = getTierLimitsForFirm('Growth', 'unified');
        expect(growth.maxUsers).toBe(5);              // Vega Growth seats
        expect(growth.maxUnits).toBe(25);             // Atrium Growth units
        expect(growth.maxActiveMatters).toBeNull();   // Vega Growth: unlimited matters
        const pro = getTierLimitsForFirm('Pro', 'unified');
        expect(pro.maxUsers).toBeNull();
        expect(pro.maxUnits).toBe(100);
    });

    it('server-side: only the Komplete/Enterprise plan is unlimited everything', () => {
        for (const plan of ['Komplete', 'Enterprise']) {
            const limits = getTierLimitsForFirm(plan, 'unified');
            expect(limits.maxUsers).toBeNull();
            expect(limits.maxUnits).toBeNull();
            expect(limits.maxActiveTenants).toBeNull();
            expect(limits.maxActiveMatters).toBeNull();
        }
        // ...for ANY product field (a Vega row billed Komplete paid the price)
        const vegaBilledKomplete = getTierLimitsForFirm('Komplete', 'vega');
        expect(vegaBilledKomplete.maxUsers).toBeNull();
    });

    it('display plan is honest: unified + Core shows Core, not the Enterprise brand', () => {
        expect(getDisplayPlan('Core', 'unified')).toBe('Core');
        expect(getDisplayPlan('Growth', 'unified')).toBe('Growth');
        // Entitled (or billed) Komplete/Enterprise keeps the Enterprise brand rule
        expect(getDisplayPlan('Komplete', 'unified')).toBe('Enterprise');
        expect(getDisplayPlan('Enterprise', 'unified')).toBe('Enterprise');
        expect(getDisplayPlan('Komplete', 'vega')).toBe('Enterprise');
    });
});

describe('4. Trial activation, expiry and downgrade paths', () => {
    it('activation: the trial plan grants entitlements while the window is open', () => {
        const e = computeEntitlements({
            billingPlan: 'Core',
            trialPlan: 'Komplete',
            trialEndsAt: FX_TRIAL_END,
            product: 'unified',
            now: FX_NOW,
        });
        expect(e.isOnTrial).toBe(true);
        expect(e.currentPlan).toBe('Komplete');
        expect(e.billingPlan).toBe('Core'); // billing basis unchanged
        expect(e.canUseAI).toBe(true);
        expect(e.canUsePropertyManager).toBe(true);
        expect(e.maxUsers).toBeNull();
    });

    it('expiry: entitlements fall back to the billing plan the moment the window closes', () => {
        const e = computeEntitlements({
            billingPlan: 'Core',
            trialPlan: 'Komplete',
            trialEndsAt: FX_TRIAL_EXPIRED,
            product: 'unified',
            now: FX_NOW,
        });
        expect(e.isOnTrial).toBe(false);
        expect(e.currentPlan).toBe('Core');
        expect(e.canUseAI).toBe(false);
        expect(e.maxUsers).toBe(1);
        // Surfaces survive expiry (product decides surfaces)
        expect(e.canUsePropertyManager).toBe(true);
    });

    it('downgrade: a Growth-trial unified firm lands on Core depth after expiry (frontend)', () => {
        const e = computeEntitlements({
            billingPlan: 'Core',
            trialPlan: 'Growth',
            trialEndsAt: FX_TRIAL_EXPIRED,
            product: 'unified',
            now: FX_NOW,
        });
        expect(e.currentPlan).toBe('Core');
        expect(e.canUseResearchStudio).toBe(false);
        expect(e.canUseClientPortal).toBe(false);
    });

    it('server-side: effectiveFirmPlan is trial-aware for the same firm record', () => {
        const trialing = { subscriptionPlan: 'Core', trialPlan: 'Komplete', trialEndsAt: TRIAL_END };
        expect(effectiveFirmPlan(trialing as any)).toBe('Komplete');
        const expired = { subscriptionPlan: 'Core', trialPlan: 'Komplete', trialEndsAt: TRIAL_EXPIRED };
        expect(effectiveFirmPlan(expired as any)).toBe('Core');
        const paid = { subscriptionPlan: 'Pro', trialPlan: null, trialEndsAt: null };
        expect(effectiveFirmPlan(paid as any)).toBe('Pro');
    });

    it('server-side: a firm trialing Komplete keeps unlimited limits for the window, then loses them', () => {
        const trialing = resolveTierLimitsForFirm({
            subscriptionPlan: 'Core', trialPlan: 'Komplete', trialEndsAt: TRIAL_END, product: 'unified',
        } as any);
        expect(trialing.maxUsers).toBeNull();
        expect(trialing.maxUnits).toBeNull();

        const expired = resolveTierLimitsForFirm({
            subscriptionPlan: 'Core', trialPlan: 'Komplete', trialEndsAt: TRIAL_EXPIRED, product: 'unified',
        } as any);
        expect(expired.maxUsers).toBe(1);
        expect(expired.maxUnits).toBe(10);
    });
});

describe('client-state manipulation cannot grant entitlements', () => {
    it('every input combination that should NOT have a feature does not have it', () => {
        // A caller cannot get property manager without either a
        // property-capable product, Vega Pro+, or the Komplete plan —
        // no other argument combination grants it.
        const denials = [
            { billingPlan: 'Core', product: 'vega' },
            { billingPlan: 'Growth', product: 'vega' },
            { billingPlan: 'Core', product: 'legal' },
        ];
        for (const input of denials) {
            expect(computeEntitlements(input as any).canUsePropertyManager).toBe(false);
        }
    });

    it('the hydration default (product undefined) shows surfaces but holds every plan gate', () => {
        // The provisional unified default is the EXISTING boot behaviour
        // (ProductContext's safety-net philosophy: never hide surfaces
        // while data is loading). The plan gates still hold at Core — and
        // actual data access is enforced server-side by the firm's REAL
        // product, so the provisional default can never leak data.
        const e = computeEntitlements({ billingPlan: 'Core', product: undefined, now: NOW });
        expect(e.product).toBe('unified');
        expect(e.canUsePropertyManager).toBe(true); // provisional surface
        expect(e.canUseResearchStudio).toBe(false); // plan gate holds
        expect(e.canUseAI).toBe(false);
        expect(e.maxUsers).toBe(1);
    });

    it('unknown product spellings normalize to unified (never grant more than unified would at that plan)', () => {
        const e = computeEntitlements({ billingPlan: 'Core', product: 'garbage-value', now: NOW });
        // normalized to unified → same as the Core unified case above
        expect(e.canUsePropertyManager).toBe(true);   // surface
        expect(e.canUseResearchStudio).toBe(false);   // plan gate holds
        expect(e.maxUsers).toBe(1);
    });
});

describe('12. Cross-product permissions — staffCanViewBilling', () => {
    it('Vega-only firms: Financials is admin/solo (firm billing is sensitive)', () => {
        expect(staffCanViewBilling({ role: 'Admin', isSolo: false, product: 'vega' })).toBe(true);
        expect(staffCanViewBilling({ role: 'Lawyer', isSolo: false, product: 'vega' })).toBe(false);
        expect(staffCanViewBilling({ role: 'Paralegal', isSolo: false, product: 'legal' })).toBe(false);
        expect(staffCanViewBilling({ role: 'Lawyer', isSolo: true, product: 'vega' })).toBe(true);
    });

    it('Atrium firms: Financials is the operational revenue hub — all team members', () => {
        expect(staffCanViewBilling({ role: 'Lawyer', isSolo: false, product: 'atrium' })).toBe(true);
        expect(staffCanViewBilling({ role: 'Paralegal', isSolo: false, product: 'property' })).toBe(true);
        expect(staffCanViewBilling({ role: 'Admin', isSolo: false, product: 'atrium' })).toBe(true);
    });

    it('Unified firms follow the property rule (rent ledger is operational for the whole team)', () => {
        expect(staffCanViewBilling({ role: 'Lawyer', isSolo: false, product: 'unified' })).toBe(true);
        expect(staffCanViewBilling({ role: 'Paralegal', isSolo: false, product: 'komplete' })).toBe(true);
    });
});
