
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
    const { currentUser } = useAuth();
    const { addToast } = useUI();

    // Convex Mutations
    const deletePropertyCascadeMutation = useMutation(api.myFunctions.deletePropertyCascade);

    /**
     * Delete a property and unlink it from all associated matters.
     */
    const handleDeleteProperty = useCallback(async (id: string, name: string) => {
        // Optimistic delete from local state
        // (This logic should eventually be unified with actions.deleteItem)
        try {
            await deletePropertyCascadeMutation({ propertyId: id, firmId: currentUser?.firmId || '' });
            addToast(`Property "${name}" deleted and unlinked from matters.`, { type: 'success' });
            
            // Sync with DataActions if available
            if (actions.deleteItem) {
                await actions.deleteItem('properties', id, name);
            }
        } catch (e) {
            console.error("Property delete failed:", e);
            addToast("Failed to delete property.", { type: 'error' });
        }
    }, [currentUser, deletePropertyCascadeMutation, actions, addToast]);

    /**
     * Bulk update property statuses or categories.
     */
    const handleBulkUpdateProperties = useCallback(async (ids: string[], data: { status?: PropertyStatus, category?: PropertyCategory }) => {
        const promises = ids.map(id => actions.updateItem('properties', { id, ...data }, 'Property'));
        await Promise.all(promises);
        addToast(`Successfully updated ${ids.length} properties.`, { type: 'success' });
    }, [actions, addToast]);

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
