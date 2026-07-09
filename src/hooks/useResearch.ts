
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { AppState, ResearchSource } from '../types';
import { getGeminiApiKey, AI_CONFIG, stripPII } from '../utils/aiUtils';
import { GoogleGenAI, Type } from '@google/genai';
import { processAttachments } from '../utils/attachmentProcessor';

const CONVEX_URL = (import.meta.env.VITE_CONVEX_URL as string) || "https://gregarious-malamute-537.convex.cloud";

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

    const handleSendResearchMessage = useCallback(async (notebookId: string, content: string, sourceIds?: string[], sources?: ResearchSource[]) => {
        // 1. Save the user message
        const userMsg = {
            id: uuidv4(),
            firmId: currentUser?.firmId,
            notebookId,
            content,
            role: 'user',
            timestamp: new Date().toISOString(),
        };
        await actions.addItem('researchMessages', userMsg, 'Message');

        // 2. Save a placeholder AI message (will be updated with the response)
        const aiMsgId = uuidv4();
        const aiMsg = {
            id: aiMsgId,
            firmId: currentUser?.firmId,
            notebookId,
            content: '',
            role: 'model',
            timestamp: new Date().toISOString(),
            isThinking: true,
        };
        await actions.addItem('researchMessages', aiMsg, 'Message');

        // 3. Build context from selected sources
        let sourceContext = '';
        const selectedSources = sourceIds && sources
            ? sources.filter(s => sourceIds.includes(s.id))
            : (sources || []);

        // Process file-based sources (extract text from PDFs, DOCX, etc.)
        const fileStorageIds: { storageId: string; name: string }[] = [];
        for (const source of selectedSources) {
            if (source.content) {
                sourceContext += `\n\n--- SOURCE: ${source.name} ---\n${source.content}\n--- END SOURCE ---`;
            }
            if (source.file?.storageId) {
                fileStorageIds.push({ storageId: source.file.storageId!, name: source.file.name });
            }
        }

        // Fetch and extract text from file-based sources
        if (fileStorageIds.length > 0) {
            try {
                const { textParts, errors } = await processAttachments(
                    fileStorageIds.map(f => f.storageId),
                    fileStorageIds.map(f => f.name),
                    CONVEX_URL
                );
                if (textParts.length > 0) {
                    sourceContext += '\n\n' + textParts.join('\n\n');
                }
                if (errors.length > 0) {
                    console.warn('[Research] Some sources failed to process:', errors);
                }
            } catch (e) {
                console.warn('[Research] File processing failed:', e);
            }
        }

        // 4. Send to Gemini
        try {
            const apiKey = getGeminiApiKey();
            if (!apiKey) {
                // Update the AI message with an error
                await actions.updateItem('researchMessages', { id: aiMsgId, content: 'API key required. Please configure in Settings → AI Settings.', isThinking: false }, 'Message');
                return;
            }

            const ai = new GoogleGenAI({ apiKey });
            const model = AI_CONFIG.gemini.defaultModel;

            const systemPrompt = `You are a legal research assistant. The user has provided the following source documents as context. Answer their question based on the sources. If the answer isn't in the sources, say so.

SOURCE DOCUMENTS:${sourceContext || '\n(No sources provided — answer based on general knowledge if possible, otherwise ask for sources.)'}`;

            const response = await ai.models.generateContent({
                model,
                contents: [{ role: 'user', parts: [{ text: stripPII(content) }] }],
                config: {
                    systemInstruction: systemPrompt,
                    temperature: 0.3,
                },
            });

            const responseText = response.text || 'No response generated.';

            // 5. Update the AI message with the response
            await actions.updateItem('researchMessages', { id: aiMsgId, content: responseText, isThinking: false }, 'Message');
        } catch (err: any) {
            console.error('[Research] AI query failed:', err);
            await actions.updateItem('researchMessages', { id: aiMsgId, content: `Analysis failed: ${err.message || 'Unknown error'}`, isThinking: false }, 'Message');
        }
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
