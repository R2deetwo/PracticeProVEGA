
import { useCallback } from 'react';
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook for managing legal matters (cases).
 * Handles CRUD operations with optimistic UI patterns.
 */
export const useMatters = (appState: any, actions: any) => {
    const { currentUser, bearerToken } = useAuth();
    const { addToast } = useUI();

    // Convex Mutations
    const deleteMatterCascadeMutation = useMutation(api.myFunctions.deleteMatterCascade);
    const closeMatterMutation = useMutation(api.matterLifecycle.closeMatter);
    const reopenMatterMutation = useMutation(api.matterLifecycle.reopenMatter);
    const archiveMatterMutation = useMutation(api.matterLifecycle.archiveMatter);
    const restoreMatterMutation = useMutation(api.matterLifecycle.restoreMatter);
    const assignUsersToMattersMutation = useMutation(api.matterLifecycle.assignUsersToMatters);
    const setMatterContactsMutation = useMutation(api.matterLifecycle.setMatterAssociatedContacts);
    const mergeContactsMutation = useMutation(api.contactIntegrity.mergeContacts);
    const authArgs = useCallback(() => ({
        userEmail: currentUser?.email,
        sessionToken: (bearerToken ?? undefined),
    }), [currentUser, bearerToken]);

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
                // DEEP AUDIT FIX (retained): backfill the matter's clientId if
                // it wasn't pre-linked. TASK 64: MatterForm now pre-links via a
                // stable client UUID on BOTH records (matter.clientId AND
                // contact.id), so this backfill is normally skipped; it stays
                // as a safety net for other callers. When it DOES run, prefer
                // the durable Convex _id — the local optimistic uuid does not
                // survive the backend merge, which is exactly what made fresh
                // matters display "Deleted Client".
                if (newContact?.id && !m.clientId) {
                    const durableContactId = (newContact as any)._id ?? newContact.id;
                    await actions.updateItem('matters', { id: m.id, clientId: durableContactId }, 'Matter Client Link');
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
            // V3 HONESTY (V-MATTER-17): no portal invite is queued by this
            // path — the old toast claimed one was. To invite, use Settings →
            // Portal Access (which sends a real invite).
            addToast(`Contact created. To give ${contact.name} portal access, invite them from Settings → Portal Access.`, { type: 'success' });
        }
        return c;
    }, [actions, addToast]);

    /**
     * Update contact details.
     */
    const handleUpdateContact = useCallback(async (contact: any, _createPortal?: boolean) => {
        // V3 HONESTY (V-MATTER-17): the old "Portal update queued" info
        // toast claimed a portal update that never happened. Editing a
        // contact updates the contact — nothing more, nothing less.
        return actions.updateItem('contacts', contact, 'Contact');
    }, [actions]);

    /**
     * Merge two contacts (V-MATTER-5/16).
     *
     * V3: the merge is now ONE atomic server mutation (contactIntegrity.
     * mergeContacts) — the old client two-step (reassign matters, then
     * hard-delete the source) destroyed the source's portal link, orphaned
     * secondary relationships, kept no audit record, and silently lost the
     * source's notes. The server merge preserves all of it and leaves a
     * soft-deleted tombstone pointing at the survivor.
     */
    const handleMergeContacts = useCallback(async (sourceId: string, targetId: string) => {
        try {
            const result = await mergeContactsMutation({
                sourceContactId: sourceId,
                targetContactId: targetId,
                ...authArgs(),
            });
            const otherLinks = (result.secondaryContacts || 0) + (result.parties || 0) + (result.tenancies || 0) + (result.propertyRelationships || 0);
            addToast(
                `Merged contacts — moved ${result.matters} matter${result.matters === 1 ? '' : 's'}, ` +
                `${result.properties} propert${result.properties === 1 ? 'y' : 'ies'} and ` +
                `${otherLinks} other link${otherLinks === 1 ? '' : 's'} to the target contact.`,
                { type: 'success' }
            );
        } catch (e: any) {
            console.error('[handleMergeContacts] failed:', e);
            addToast(e?.message || 'Failed to merge contacts.', { type: 'error' });
            throw e;
        }
    }, [mergeContactsMutation, authArgs, addToast]);

    /**
     * Link/unlink a matter's SECONDARY contacts (V-MATTER-15).
     * V3: writes the REAL schema field via a validated server mutation.
     * The old path patched an orphan `contactIds` key that exists on no
     * table, so the selection silently reset on every re-open.
     */
    const handleLinkContactToMatter = useCallback(async (matterId: string, contactIds: string[]) => {
        try {
            const result = await setMatterContactsMutation({ matterId, contactIds, ...authArgs() });
            addToast(
                `Linked ${result.linked} contact${result.linked === 1 ? '' : 's'}, unlinked ${result.unlinked}.`,
                { type: 'success' }
            );
        } catch (e: any) {
            addToast(e?.message || 'Failed to update matter contacts.', { type: 'error' });
            throw e;
        }
    }, [setMatterContactsMutation, authArgs, addToast]);

    /**
     * Link a matter to a specific contact (as client or associated contact).
     */
    const handleLinkMatterToContact = useCallback(async (contactId: string, matterId: string, asClient: boolean) => {
        if (asClient) {
            const matter = appState.matters.find((m: any) => m.id === matterId);
            if (matter) {
                await actions.updateItem('matters', { id: matter.id, clientId: contactId }, 'Client Link');
            }
        } else {
            // V3 (V-MATTER-15/17): a REAL secondary link — the old branch was
            // a success toast with no mutation behind it.
            const matter = appState.matters.find((m: any) => m.id === matterId);
            if (!matter) {
                addToast('Matter not found.', { type: 'error' });
                return;
            }
            const existing: string[] = Array.isArray(matter.associatedContactIds) ? matter.associatedContactIds : [];
            if (existing.includes(contactId)) {
                addToast('This contact is already linked to the matter.', { type: 'info' });
                return;
            }
            try {
                await setMatterContactsMutation({
                    matterId,
                    contactIds: [...existing, contactId],
                    ...authArgs(),
                });
                addToast('Contact linked to matter as an associated contact.', { type: 'success' });
            } catch (e: any) {
                addToast(e?.message || 'Failed to link contact to matter.', { type: 'error' });
            }
        }
    }, [actions, appState.matters, setMatterContactsMutation, authArgs, addToast]);

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
     * Update matter stage. V3 (V-MATTER-12): the durable history is
     * appended server-side (matterStageHistory) — this hook just sends the
     * change; the old comment claimed history tracking that consisted of
     * overwriting one timestamp.
     */
    const handleUpdateMatterStage = useCallback((id: string, stage: string) =>
        actions.updateItem('matters', { id, stage, stageLastUpdated: new Date().toISOString() }, 'Matter'), [actions]);

    /**
     * Close a matter through the validated lifecycle mutation (V-MATTER-3).
     * The server enforces the transition graph, stamps closedAt, records
     * activity and persists the closing note.
     */
    const handleCloseMatter = useCallback(async (id: string, closingNote?: string) => {
        try {
            const result = await closeMatterMutation({ matterId: id, closingNote: closingNote || '', ...authArgs() });
            addToast(result?.alreadyClosed ? 'Matter was already closed.' : 'Matter closed.', { type: 'success' });
            return result;
        } catch (e: any) {
            addToast(e?.message || 'Failed to close matter.', { type: 'error' });
            throw e;
        }
    }, [closeMatterMutation, authArgs, addToast]);

    /**
     * Reopen a closed matter through the validated lifecycle mutation
     * (V-MATTER-3). Previously reopening had NO UI at all — the hook existed
     * but no component ever called it.
     */
    const handleReopenMatter = useCallback(async (id: string) => {
        try {
            const result = await reopenMatterMutation({ matterId: id, ...authArgs() });
            addToast(result?.alreadyActive ? 'Matter is already active.' : 'Matter reopened.', { type: 'success' });
            return result;
        } catch (e: any) {
            addToast(e?.message || 'Failed to reopen matter.', { type: 'error' });
            throw e;
        }
    }, [reopenMatterMutation, authArgs, addToast]);

    /**
     * Bulk-assign users to many matters (V-MATTER-15) — the server mutation
     * the list's Assign button always needed (the old modal context was
     * ignored and the form could only ever assign ONE item).
     */
    const handleBulkAssignMatters = useCallback(async (matterIds: string[], assignedUsers: string[]) => {
        try {
            const result = await assignUsersToMattersMutation({ matterIds, assignedUsers, ...authArgs() });
            addToast(`Team updated on ${result.updated} matter${result.updated === 1 ? '' : 's'}.`, { type: 'success' });
            return result;
        } catch (e: any) {
            addToast(e?.message || 'Failed to assign team.', { type: 'error' });
            throw e;
        }
    }, [assignUsersToMattersMutation, authArgs, addToast]);

    /**
     * Restore a matter from the archive (V-MATTER-4).
     */
    const handleRestoreMatter = useCallback(async (opts: { matterId?: string; archiveRowId?: string }) => {
        try {
            await restoreMatterMutation({ ...opts, ...authArgs() });
            addToast('Matter restored from the archive.', { type: 'success' });
        } catch (e: any) {
            addToast(e?.message || 'Failed to restore matter.', { type: 'error' });
            throw e;
        }
    }, [restoreMatterMutation, authArgs, addToast]);

    /**
     * Delete matter and all related child records (Cascade).
     * V3 (V-MATTER-8): the hardened cascade refuses to run when the matter
     * has financial records (invoices, trust, ledger, billed time) — the
     * ledger only grows. The old flow ALSO called deleteItem after the
     * cascade (a second, silently-failing delete).
     */
    const handleDeleteMatter = useCallback(async (id: string, name: string) => {
        try {
            const result = await deleteMatterCascadeMutation({ matterId: id, firmId: currentUser?.firmId as string, ...authArgs() });
            // Optimistic local removal only — the server transaction is the
            // source of truth (the old second deleteItem call failed
            // silently against the already-deleted row).
            try {
                await actions.deleteItem('matters', id, name);
            } catch { /* already gone server-side */ }
            const summary = (result as any)?.summary || {};
            const detail = Object.entries(summary)
                .filter(([, n]) => (n as number) > 0)
                .map(([k, n]) => `${n} ${k}`)
                .join(', ');
            addToast(`Deleted matter ${name}${detail ? ` (${detail})` : ''}. Financial records were preserved.`, { type: 'success' });
        } catch (e: any) {
            console.error("Delete cascade failed:", e);
            addToast(e?.message || 'Failed to delete matter.', { type: 'error', duration: 8000 });
            throw e;
        }
    }, [actions, deleteMatterCascadeMutation, currentUser, authArgs, addToast]);

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
     *
     * V3 (V-MATTER-4/7): MATTERS take the atomic server path — one mutation
     * inserts the archive row AND flips status to 'Archived'. The old
     * two-step client sequence (insert archive row, then a delete the FK
     * guard refuses for any matter with children) is exactly what produced
     * ghost archive rows, so it no longer runs for matters. Other item
     * types keep the two-step flow (they have no children to block the
     * delete).
     */
    const archiveItem = useCallback(async (type: string, id: string, name: string, data?: any) => {
        if (type === 'matters' || type === 'Matter') {
            try {
                await archiveMatterMutation({ matterId: id, ...authArgs() });
                addToast(`Archived "${name}". Restore it any time from the Archive page.`, { type: 'success' });
                return;
            } catch (e: any) {
                addToast(e?.message || 'Failed to archive matter.', { type: 'error' });
                throw e;
            }
        }
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
    }, [actions, archiveMatterMutation, authArgs, currentUser, addToast]);

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
        // V3 HONESTY (V-MATTER-17): actually cancel the intake request — the
        // old toast claimed cancellation while changing nothing.
        try {
            await actions.updateItem('leads', { id: leadId, status: 'Cancelled', intakeSentAt: null }, 'Lead');
            addToast("Intake request cancelled.", { type: 'info' });
        } catch (e: any) {
            addToast(e?.message || 'Failed to cancel intake request.', { type: 'error' });
        }
    }, [actions, addToast]);

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
        handleCloseMatter,
        handleReopenMatter,
        handleBulkAssignMatters,
        handleRestoreMatter,
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

