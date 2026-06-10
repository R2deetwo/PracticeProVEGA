
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { AppState } from '../types';

/**
 * Hook for managing research notebooks, sources, and AI analysis.
 */
export const useResearch = (appState: AppState, actions: any) => {
    const { currentUser } = useAuth();
    const { addToast } = useUI();

    const handleAddResearchNotebook = useCallback((data: any) => {
        const notebook = {
            id: uuidv4(),
            firmId: data.firmId || currentUser?.firmId || '',
            userId: data.userId || currentUser?.id || '',
            name: data.name,
            matterId: data.matterId || null,
            createdAt: new Date().toISOString(),
        };
        actions.addItem('researchNotebooks', notebook, 'Notebook');
        addToast(`Notebook "${data.name}" created.`, { type: 'success' });
        return notebook;
    }, [currentUser, actions, addToast]);

    const handleAddResearchSource = useCallback((notebookId: string, sourceData: any) => {
        const source = {
            id: uuidv4(),
            firmId: currentUser?.firmId || '',
            notebookId,
            name: sourceData.name,
            type: sourceData.type || 'text',
            content: sourceData.content || '',
            file: sourceData.file || null,
            createdAt: new Date().toISOString(),
        };
        actions.addItem('researchSources', source, 'Source');
        addToast(`Source "${sourceData.name}" added.`, { type: 'success' });
    }, [currentUser, actions, addToast]);

    const handleSendResearchMessage = useCallback(async (notebookId: string, content: string) => {
        const msg = {
            id: uuidv4(),
            firmId: currentUser?.firmId,
            notebookId,
            content,
            role: 'user',
            timestamp: new Date().toISOString(),
        };
        await actions.addItem('researchMessages', msg, 'Message');
    }, [currentUser, actions]);

    return {
        handleAddResearchNotebook,
        handleAddResearchSource,
        handleSendResearchMessage,
        handleDeleteResearchNotebook: (id: string, name: string) => actions.deleteItem('researchNotebooks', id, name),
        handleDeleteResearchSource: (id: string) => actions.deleteItem('researchSources', id),
        handleSaveAnalysisResult: (result: any) => actions.addItem('researchAnalysisResults', result, 'Analysis Result'),
        handleDeleteAnalysisResult: (id: string) => actions.deleteItem('researchAnalysisResults', id),
    };
};
