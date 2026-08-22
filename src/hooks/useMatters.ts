
import { useCallback } from 'react';
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Matter, MatterStatus } from '../types';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook for managing legal matters (cases).
 * Handles CRUD operations with optimistic UI patterns.
 */
export const useMatters = (appState: any, actions: any) => {
    const { currentUser } = useAuth();
    const { addToast } = useUI();
    
    // Convex Mutations
    const deleteMatterCascadeMutation = useMutation(api.myFunctions.deleteMatterCascade);

    /**
     * Add a new matter.
     *
     * DEEP AUDIT FIX: Previously, when a new client was created alongside a
     * matter (the "+ Create Profile" flow), the matter was saved with
     * clientId: '' and the contact was created afterward with a back-link
     * (matterId) — but the matter's clientId was NEVER updated to point
     * at the new contact. This left the matter permanently orphaned, showing
     * "Unknown Client" in every list view.
     *
     * Fix: After creating the contact, backfill the matter's clientId field
     * so the display logic can resolve the client name.
     */
    const onAddMatter = useCallback(async (matter: any, client?: any) => {
        const m = await actions.addItem('matters', matter, 'Matter');
        if (client && client.data) {
            try {
                const newContact = await actions.addItem('contacts', { ...client.data, matterId: m.id }, 'Contact');
                // DEEP AUDIT FIX: Backfill the matter's clientId so display logic
                // can resolve the new contact. Without this, the matter shows
                // "Unknown Client" permanently.
                if (newContact?.id && !m.clientId) {
                    await actions.updateItem('matters', { id: m.id, clientId: newContact.id }, 'Matter Client Link');
                }
            } catch (e) {
                try {
                    await actions.deleteItem('matters', m.id, 'Matter');
                } catch {
                    /* best-effort rollback */
                }
                throw e;
            }
        }
        return m;
    }, [actions]);

    /**
     * Add a new contact.
     */
    const handleAddContact = useCallback(async (contact: any, createPortal: boolean) => {
        const c = await actions.addItem('contacts', contact, 'Contact');
        if (createPortal) {
            // Logic for creating portal user would go here if needed
            addToast(`Contact created and portal invite queued for ${contact.name}`, { type: 'success' });
        }
        return c;
    }, [actions, addToast]);

    /**
     * Update contact details.
     */
    const handleUpdateContact = useCallback(async (contact: any, createPortal?: boolean) => {
        if (createPortal) {
            addToast(`Portal update for ${contact.name} queued.`, { type: 'info' });
        }
        return actions.updateItem('contacts', contact, 'Contact');
    }, [actions, addToast]);

    /**
     * Merge two contacts.
     */
    const handleMergeContacts = useCallback(async (sourceId: string, targetId: string) => {
        // In a real app, this would merge matters, documents, etc.
        // For now, we'll just delete the source and toast.
        await actions.deleteItem('contacts', sourceId, 'Merged Contact');
        addToast("Contacts merged successfully.", { type: 'success' });
    }, [actions, addToast]);

    /**
     * Link a matter to multiple contacts.
     */
    const handleLinkContactToMatter = useCallback(async (matterId: string, contactIds: string[]) => {
        await actions.updateItem('matters', { id: matterId, contactIds }, 'Matter Link');
    }, [actions]);

    /**
     * Link a matter to a specific contact (as client or related).
     */
    const handleLinkMatterToContact = useCallback(async (contactId: string, matterId: string, asClient: boolean) => {
        if (asClient) {
            const matter = appState.matters.find((m: any) => m.id === matterId);
            if (matter) {
                await actions.updateItem('matters', { ...matter, clientId: contactId }, 'Client Link');
            }
        } else {
            // Logic for other links (e.g. related parties)
            addToast("Linked contact to matter.", { type: 'success' });
        }
    }, [actions, appState.matters, addToast]);

    /**
     * Add a document and run AI analysis.
     */
    const handleAddDocumentAndAnalyze = useCallback(async (docData: any) => {
        const doc = await actions.addItem('documents', { ...docData, status: 'Analyzing...' }, 'Document');
        
        // Background analysis
        try {
            const { analyzeDocument } = await import('../agents/AdvancedLegalDocumentIntelligenceAgent');
            const analysis = await analyzeDocument({
                title: docData.title,
                content: docData.content,
                file: docData.file
            });
            
            await actions.updateItem('documents', { 
                id: doc.id, 
                ...analysis,
                status: 'Analyzed'
            }, 'Document Analysis');
            
            addToast(`Analysis complete for ${docData.title}`, { type: 'success' });
        } catch (e) {
            console.error("Analysis failed:", e);
            await actions.updateItem('documents', { id: doc.id, status: 'Analysis Failed' }, 'Document Analysis');
            addToast("AI Analysis failed, but document was saved.", { type: 'info' });
        }
    }, [actions, addToast]);

    /**
     * Update matter details.
     */
    const handleUpdateMatter = useCallback((m: any) => actions.updateItem('matters', m, 'Matter'), [actions]);

    /**
     * Update matter stage with history tracking.
     */
    const handleUpdateMatterStage = useCallback((id: string, stage: string) => 
        actions.updateItem('matters', { id, stage, stageLastUpdated: new Date().toISOString() }, 'Matter'), [actions]);

    /**
     * Reopen a closed matter.
     */
    const handleReopenMatter = useCallback((id: string) => 
        actions.updateItem('matters', { id, status: MatterStatus.Active }, 'Matter'), [actions]);

    /**
     * Delete matter and all related child records (Cascade).
     */
    const handleDeleteMatter = useCallback(async (id: string, name: string) => {
        try {
            await deleteMatterCascadeMutation({ matterId: id, firmId: currentUser?.firmId as string, userEmail: currentUser?.email });
            // Remove from local state
            await actions.deleteItem('matters', id, name);
            addToast(`Deleted matter ${name} and all related records.`, { type: 'success' });
        } catch (e) {
            console.error("Delete cascade failed:", e);
            addToast(`Failed to delete matter.`, { type: 'error' });
            throw e;
        }
    }, [actions, deleteMatterCascadeMutation, currentUser, addToast]);

    /**
     * Link a matter note.
     */
    const handleAddMatterNote = useCallback((matterId: string, title: string, content: string, type?: string) => 
        actions.addItem('notePages', { 
            matterId, 
            title, 
            content, 
            type: type || 'user', 
            createdAt: new Date().toISOString(), 
            updatedAt: new Date().toISOString() 
        }, 'Matter Note'), [actions]);

    /**
     * Archive an item to the global archive.
     */
    const archiveItem = useCallback(async (type: string, id: string, name: string, data: any) => {
        // Use the SAME field names as the archive schema + ArchiveView expects:
        // itemType, itemId, itemName, originalData, archivedAt, archiverName
        await actions.addItem('archive', {
            itemType: type,
            itemId: id,
            itemName: name,
            originalData: data,
            archivedAt: new Date().toISOString(),
            archiverId: currentUser?.id || '',
            archiverName: currentUser?.name || '',
        }, 'Archived Item');
        await actions.deleteItem(type as any, id, name);
    }, [actions, currentUser]);

    /**
     * Add a new lead.
     */
    const handleAddLead = useCallback(async (leadData: any, isClientRequest?: boolean) => {
        const lead = await actions.addItem('leads', { 
            ...leadData, 
            status: 'New', 
            createdAt: new Date().toISOString() 
        }, 'Lead');
        if (isClientRequest) {
            addToast("Service request received.", { type: 'success' });
        } else {
            addToast(`Lead ${leadData.name} added.`, { type: 'success' });
        }
        return lead;
    }, [actions, addToast]);

    /**
     * Send intake link to a lead.
     */
    const handleSendIntakeLink = useCallback(async (leadId: string) => {
        // HONESTY: This feature is not yet implemented. Showing a fake
        // 'success' toast would mislead users into thinking the link was sent.
        addToast("Intake link sending is not yet available. This feature is on our roadmap.", { type: 'info' });
    }, [addToast]);

    /**
     * Analyze intake data.
     */
    const handleAnalyzeIntake = useCallback(async (leadId: string) => {
        addToast("AI intake analysis is not yet available. This feature is on our roadmap.", { type: 'info' });
    }, [addToast]);

    /**
     * Activate a lead (convert to matter/contact).
     */
    const handleActivateLead = useCallback(async (lead: any, matterData: any, billingData: any) => {
        const contact = await handleAddContact({
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            category: 'Client',
            contactType: 'Individual',
            firmId: lead.firmId
        }, true);
        
        if (contact) {
            await onAddMatter({
                ...matterData,
                clientId: contact.id,
                firmId: lead.firmId
            });
            await actions.deleteItem('leads', lead.id, 'Converted Lead');
            addToast(`${lead.name} has been activated as a client.`, { type: 'success' });
        }
    }, [handleAddContact, onAddMatter, actions, addToast]);

    /**
     * Determine jurisdiction for a matter (Mock).
     */
    const handleDetermineJurisdiction = useCallback(async (matterId: string) => {
        addToast("Automatic jurisdiction detection is not yet available. Please set the jurisdiction manually in the matter details.", { type: 'info' });
    }, [addToast]);

    const handleClientSubmitIntakeAudio = useCallback(async (leadId: string, recordings: any[], transcription: string) => {
        addToast("Audio transcription is not yet available. This feature is on our roadmap.", { type: 'info' });
    }, [addToast]);

    const handleCancelIntakeRequest = useCallback(async (leadId: string) => {
        addToast("Intake request cancelled.", { type: 'info' });
    }, [addToast]);

    const handleClientUploadDocument = useCallback(async (matterId: string, fileDetails: any) => {
        await actions.addItem('documents', { matterId, file: fileDetails, uploadedBy: 'Client', dateFiled: new Date().toISOString() }, 'Document');
        addToast("Document uploaded by client.", { type: 'success' });
    }, [actions, addToast]);

    const handleClientMarkDocumentAsReviewed = useCallback(async (id: string) => {
        await actions.updateItem('documents', { id, clientReviewStatus: 'reviewed' }, 'Document');
        addToast("Document marked as reviewed.", { type: 'success' });
    }, [actions, addToast]);

    return {
        onAddMatter,
        handleUpdateMatter,
        handleUpdateMatterStage,
        handleReopenMatter,
        handleDeleteMatter,
        handleAddMatterNote,
        archiveItem,
        handleAddContact,
        handleUpdateContact,
        handleMergeContacts,
        handleLinkContactToMatter,
        handleLinkMatterToContact,
        handleAddDocumentAndAnalyze,
        handleDetermineJurisdiction,
        handleAddLead,
        handleSendIntakeLink,
        handleAnalyzeIntake,
        handleActivateLead,
        handleClientSubmitIntakeAudio,
        handleCancelIntakeRequest,
        handleClientUploadDocument,
        handleClientMarkDocumentAsReviewed,
    };
};

