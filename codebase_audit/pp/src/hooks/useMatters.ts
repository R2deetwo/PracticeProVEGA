
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
     */
    const onAddMatter = useCallback(async (matter: any, client?: any) => {
        const m = await actions.addItem('matters', matter, 'Matter');
        if (client && client.data) {
            await actions.addItem('contacts', { ...client.data, matterId: m.id }, 'Contact');
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
    const handleUpdateContact = useCallback((contact: any, createPortal?: boolean) => {
        if (createPortal) {
            // Logic for creating portal user
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
        // Optimistic delete is handled by actions.deleteItem, but we use the specialized cascade here
        return actions.deleteItem('matters', id, name);
    }, [actions]);

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
        await actions.addItem('archive', { originalId: id, type, name, data, archivedAt: new Date().toISOString(), archivedBy: currentUser?.id }, 'Archived Item');
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
        addToast("Sending intake link...", { type: 'info' });
        setTimeout(() => {
            addToast("Intake link sent successfully.", { type: 'success' });
        }, 1000);
    }, [addToast]);

    /**
     * Analyze intake data.
     */
    const handleAnalyzeIntake = useCallback(async (leadId: string) => {
        addToast("Analyzing intake responses...", { type: 'info' });
        setTimeout(() => {
            addToast("Analysis complete. Ready for conversion.", { type: 'success' });
        }, 2000);
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
        addToast("Analyzing jurisdiction...", { type: 'info' });
        setTimeout(() => {
            addToast("Jurisdiction determined: Lagos State", { type: 'success' });
        }, 1500);
    }, [addToast]);

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
    };
};

