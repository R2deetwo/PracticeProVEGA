
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
    const handleDeleteProperty = useCallback(async (id: string, name: string, silent = false) => {
        try {
            await deletePropertyCascadeMutation({ propertyId: id, firmId: currentUser?.firmId || '' });
            if (!silent) {
                addToast(`Property "${name}" deleted.`, { type: 'success' });
            }
        } catch (e) {
            console.error("Property delete failed:", e);
            if (!silent) {
                addToast("Failed to delete property.", { type: 'error' });
            }
            throw e;
        }
    }, [currentUser, deletePropertyCascadeMutation, addToast]);

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
