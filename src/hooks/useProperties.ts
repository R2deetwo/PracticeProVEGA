
import { useCallback } from 'react';
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PropertyStatus, PropertyCategory, AppState } from '../types';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook for managing properties and rental portfolios.
 */
export const useProperties = (appState: AppState, actions: any) => {
    const { currentUser, bearerToken } = useAuth();
    const { addToast } = useUI();

    // Convex Mutations
    const deletePropertyCascadeMutation = useMutation(api.myFunctions.deletePropertyCascade);
    // E4: the ONE staff-authed bulk mutation (see handleBulkUpdateProperties).
    const bulkUpdatePropertiesMutation = useMutation(api.tenancyLifecycle.bulkUpdateProperties);

    /**
     * Delete a property and unlink it from all associated matters.
     */
    const handleDeleteProperty = useCallback(async (id: string, name: string, silent = false) => {
        try {
            await deletePropertyCascadeMutation({ propertyId: id, firmId: currentUser?.firmId || '' });
            actions.removeItemFromState('properties', id);
            if (!silent) {
                // SINGLE SUMMARY TOAST — one message for the entire property
                // (including all its units). Previously, deleting a multi-unit
                // property triggered cascading toasts for each child unit.
                addToast(`Property "${name}" and its associated units were removed successfully.`, { type: 'success', duration: 4000 });
            }
        } catch (e) {
            console.error("Property delete failed:", e);
            if (!silent) {
                addToast("Failed to delete property.", { type: 'error' });
            }
            throw e;
        }
    }, [currentUser, deletePropertyCascadeMutation, actions, addToast]);

    /**
     * Bulk update property statuses or categories.
     *
     * ROUND E (Wave E4): this used to fan out N sequential updateItem calls
     * (each gated by requireFirmUser — any firm member) with no enum
     * validation and a partial-failure state. It now calls the dedicated
     * staff-authed bulkUpdateProperties mutation ONCE:
     *   - staff-only (requireStaffCaller + assertSameFirm server-side),
     *   - status/category whitelisted to the real enums,
     *   - the tenancy ledger guards consistency (a unit with an ACTIVE
     *     tenancy cannot be bulk-marked Vacant/Listed/Sold — end the
     *     tenancy first),
     *   - local state updates arrive through the reactive getFirmData
     *     re-merge (the same path every dedicated lifecycle mutation uses).
     */
    const handleBulkUpdateProperties = useCallback(async (ids: string[], data: { status?: PropertyStatus, category?: PropertyCategory }) => {
        try {
            const res: any = await bulkUpdatePropertiesMutation({
                firmId: currentUser?.firmId || '',
                propertyIds: ids,
                status: data.status,
                category: data.category,
                userEmail: currentUser?.email,
                sessionToken: (bearerToken ?? undefined) || undefined,
            });
            const { updated = 0, conflicts = 0, skipped = 0, conflictLabels = [] } = res || {};
            if (updated > 0 && conflicts === 0) {
                addToast(`Updated ${updated} propert${updated === 1 ? 'y' : 'ies'}.`, { type: 'success' });
            } else if (conflicts > 0) {
                addToast(
                    `${updated} updated · ${conflicts} skipped (active tenancy — end the tenancy first${conflictLabels.length ? `: ${conflictLabels.slice(0, 3).join(', ')}${conflictLabels.length > 3 ? '…' : ''}` : ''})${skipped ? ` · ${skipped} not found` : ''}.`,
                    { type: 'info', duration: 6000 }
                );
            } else if (updated === 0) {
                addToast('No properties were updated.', { type: 'info' });
            }
        } catch (e: any) {
            console.error('Bulk update failed:', e);
            addToast(String(e?.message || 'Bulk update failed.'), { type: 'error' });
        }
    }, [currentUser, bearerToken, bulkUpdatePropertiesMutation, addToast]);

    /**
     * Update contact's property portfolio link.
     */
    const onUpdateContactProperties = useCallback((contactId: string, properties: any[]) =>
        actions.updateItem('contacts', { id: contactId, properties }, 'Property Portfolio'), [actions]);

    return {
        handleDeleteProperty,
        handleBulkUpdateProperties,
        onUpdateContactProperties,
    };
};
