
import { useDataState } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SubscriptionPlan } from '../types';
import {
    computeEntitlements,
    normalizeProduct,
    type Entitlements,
} from '../utils/entitlements';

/**
 * useFeatures — thin wrapper over the ONE authoritative entitlement
 * computation (src/utils/entitlements.ts → computeEntitlements).
 *
 * K-3 (unified-product integrity): the decision table used to live inline
 * here and was re-derived — with drift — in the Sidebar lock rules, the
 * backend tier limits, the estate-community gate and productConfig's
 * second flag engine. Everything now delegates to the pure module; this
 * hook only gathers the server-loaded firm/user records that feed it, so
 * no client-side feature-state manipulation can alter entitlements (the
 * data itself is server-fetched and the actual data access is enforced by
 * session-derived identity in every Convex function — R16).
 */
export const useFeatures = (): Entitlements => {
    const { appState } = useDataState();
    const { currentUser } = useAuth();

    // Portal users (Client/Tenant) may boot before firmDetails loads —
    // presume the full Komplete entitlement set so the portal renders
    // instead of showing "Portal Unavailable" (unchanged behaviour).
    const isPortalUser = currentUser?.role === 'Client' || currentUser?.role === 'Tenant';

    const firm = (appState.firmDetails ?? {}) as any;

    return computeEntitlements({
        billingPlan: firm.subscriptionPlan || (isPortalUser ? SubscriptionPlan.Komplete : SubscriptionPlan.Core),
        trialPlan: firm.trialPlan ?? null,
        trialEndsAt: firm.trialEndsAt ?? null,
        // Product: firm record first, the user's own product as the portal
        // fallback (firm data is not loaded for portal users).
        product: firm.product || currentUser?.product || 'unified',
        subscriptionAddons: firm.subscriptionAddons,
    });
};

export { normalizeProduct };
