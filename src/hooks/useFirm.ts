
import { useCallback } from 'react';
import { useMutation, useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Product, AppState } from '../types';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook for managing firm-level settings, users, and onboarding.
 */
export const useFirm = (appState: AppState, actions: any) => {
    const { currentUser, updateCurrentUser, bearerToken } = useAuth();
    const { addToast } = useUI();
    const convex = useConvex();

    // Convex Mutations
    const createFirmMutation = useMutation(api.myFunctions.createFirm);
    const joinFirmMutation = useMutation(api.myFunctions.joinFirm);
    const updateItemMutation = useMutation(api.myFunctions.updateItem);

    /**
     * Update current user profile.
     */
    const handleUpdateUser = useCallback(async (userId: string, data: any) => {
        await updateItemMutation({ table: 'users', id: userId, data, userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined) || currentUser?.tokenIdentifier });
        // Only update the local current user state if we're updating OURSELVES.
        // When an admin updates ANOTHER user (e.g. Grant Access), we must NOT
        // overwrite our own currentUser with the other user's data.
        if (currentUser?.id === userId || currentUser?._id === userId) {
            updateCurrentUser(data);
        }
    }, [updateItemMutation, updateCurrentUser, currentUser]);

    /**
     * Update global firm details and settings.
     *
     * CRITICAL FIX (workspace-id-for-save bug):
     * The Convex `firms` table stores the firm's identifier in `_id` (auto-generated
     * by Convex) — there is NO separate `id` field on the document. After
     * `DataProvider` merges the backend firm record into `appState.firmDetails`,
     * the local object ends up with `_id` set but `id` undefined, which caused
     * "Could not determine workspace ID for save" whenever the user tried to
     * save bank accounts, integrations, AI settings, etc.
     *
     * Fix: resolve the firm id from ANY of `details.id`, `details._id`,
     * `appState.firmDetails?.id`, `appState.firmDetails?._id`, or
     * `currentUser.firmId` (last one covers the immediate post-createFirm
     * window where appState.firmDetails is still the default empty state but
     * currentUser.firmId is already set). The DataProvider merge is also
     * patched to always mirror `_id` onto `id`, but this hook stays defensive
     * so older cached state still works.
     *
     * ROUND 9 (toast fix): callers can control the toast behaviour via
     * opts.successToast:
     *   - omitted → "Firm settings updated." success toast (existing behaviour)
     *   - null → silent (the caller shows its own richer toast — e.g. the
     *     setup wizard / Practice Blueprint modal, which previously produced
     *     TWO competing toasts: "Workspace pre-configured: …" followed by
     *     "Firm settings updated.")
     *   - a custom string → that message as the success toast
     */
    const handleUpdateFirmDetails = useCallback(async (details: any, opts?: { successToast?: string | null }) => {
        if (!details) return;
        const existingFirm = appState.firmDetails as any;
        const firmId =
            details.id ||
            details._id ||
            existingFirm?.id ||
            existingFirm?._id ||
            currentUser?.firmId;

        if (!firmId) {
            addToast("Error: Could not determine workspace ID for save. Please refresh the page and try again.", { type: 'error' });
            console.error('[useFirm] handleUpdateFirmDetails: no firmId found in', { details, appStateFirmDetails: appState.firmDetails });
            return;
        }

        try {
            const { id, _id, ...dataToSave } = details;
            // CRITICAL FIX: pass userEmail so the backend requireAdmin() gate
            // can identify the caller. Without userEmail, requireFirmUser returns
            // an anonymous context (user: null), and requireAdmin throws
            // "Permission denied" because null.role !== "Admin" — which the
            // user sees as "Failed to sync firm settings" when saving a bank
            // account or any other firmDetails update.
            await updateItemMutation({
                table: 'firms',
                id: firmId,
                data: dataToSave,
                userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined),
            });
            if (opts?.successToast !== null) {
                addToast(opts?.successToast ?? "Firm settings updated.", { type: 'success' });
            }
        } catch (e) {
            console.error('[useFirm] handleUpdateFirmDetails failed:', e);
            // ROUND 9: honest, actionable error copy. The old generic
            // "Failed to sync firm settings." told the user nothing about
            // what to do next.
            addToast("Could not save your firm settings. Nothing was lost — please try again, or retry from Settings → Firm Configuration if it keeps failing.", { type: 'error', duration: 6000 });
        }
    }, [appState.firmDetails, updateItemMutation, addToast, currentUser]);

    /**
     * Create a new firm (Onboarding).
     *
     * CRO AUDIT FIX (Track A — A5): wrapped the createFirmMutation call in a
     * 30-second timeout. If Convex is slow or the WebSocket drops mid-call,
     * the user now sees a clear error + a "Recover Connection" affordance
     * instead of the button staying at "Creating..." forever.
     *
     * CRO AUDIT FIX (Track B — B2): added trial parameter. When trial=true,
     * the backend creates the firm with subscriptionPlan='Core' but sets
     * trialStartsAt/trialEndsAt/trialPlan so useFeatures can grant trial
     * entitlements during the 30-day window.
     */
    const createFirm = useCallback(async (
        name: string,
        address: string,
        plan: string,
        userDetails?: { email: string, name: string },
        product?: Product,
        isDataMigration?: boolean,
        trial?: boolean,
    ) => {
        // Wrap the mutation in a 30-second timeout race. If it doesn't resolve
        // in 30s, throw a clear error so the UI can show a "Recover Connection"
        // affordance instead of staying stuck on "Creating..." forever.
        const CREATE_FIRM_TIMEOUT_MS = 30_000;

        const mutationPromise = createFirmMutation({
            name,
            address,
            subscriptionPlan: plan,
            user_email: userDetails?.email || currentUser?.email || '',
            user_name: userDetails?.name || currentUser?.name || '',
            tokenIdentifier: userDetails?.email || currentUser?.email || '',
            product: product || "unified",
            // Only send isDataMigration when true — omitting it keeps backward compat
            // with older Convex validators that don't declare this field yet.
            ...(isDataMigration ? { isDataMigration: true } : {}),
            // Only send trial when true — same backward-compat pattern.
            ...(trial ? { trial: true } : {}),
        });

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(
                    'Firm creation timed out. Your workspace may still have been created — ' +
                    'click "Recover Connection" to check, or try again.'
                ));
            }, CREATE_FIRM_TIMEOUT_MS);
        });

        return await Promise.race([mutationPromise, timeoutPromise]) as string;
    }, [createFirmMutation, currentUser]);

    /**
     * Join an existing firm via invite code.
     */
    const joinFirm = useCallback(async (inviteCode: string) => {
        return await joinFirmMutation({
            inviteCode,
            tokenIdentifier: currentUser?.email || '',
            userName: currentUser?.name || '',
            userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined) || ''
        });
    }, [joinFirmMutation, currentUser]);

    /**
     * Validate an invite code before joining.
     */
    const validateInviteCode = useCallback(async (inviteCode: string) => {
        return await convex.query(api.myFunctions.validateInviteCode, { inviteCode });
    }, [convex]);

    /**
     * Regenerate a new invite code for the firm.
     */
    const regenerateInviteCode = useCallback(async (firmId: string) => {
        return await convex.mutation(api.myFunctions.regenerateInviteCode, { firmId });
    }, [convex]);

    const handleDeleteUser = useCallback(async (id: string) => {
        await actions.deleteItem('users', id, 'User');
    }, [actions]);

    return {
        handleUpdateUser,
        handleDeleteUser,
        handleUpdateFirmDetails,
        createFirm,
        joinFirm,
        validateInviteCode,
        regenerateInviteCode,
    };
};

