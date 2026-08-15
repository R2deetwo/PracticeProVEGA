
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

            const responseText = response.text || 'No response generated. Please try rephrasing your question.';

            // 5. Update the AI message with the response
            // Use try-catch in case updateItem fails — the message will still
            // be in local state even if the Convex update fails
            try {
                await actions.updateItem('researchMessages', { id: aiMsgId, content: responseText, isThinking: false }, 'Message');
            } catch (updateErr) {
                console.warn('[Research] updateItem failed, message may be stuck in thinking state:', updateErr);
                // Force-remove from local state and re-add with the response
                actions.removeItemFromState('researchMessages', aiMsgId);
                actions.addItem('researchMessages', {
                    id: aiMsgId,
                    firmId: currentUser?.firmId,
                    notebookId,
                    content: responseText,
                    role: 'model',
                    timestamp: new Date().toISOString(),
                    isThinking: false,
                }, 'Message');
            }
        } catch (err: any) {
            console.error('[Research] AI query failed:', err);
            // Classify the error and show a friendly message instead of raw
            // JSON. Google API errors (QuotaFailure, etc.) often include
            // structured JSON in err.message, which looks like gibberish to
            // users and overflows the chat bubble.
            let friendlyError = 'I couldn\'t analyze the sources. Please try again.';
            const errMsg = (err?.message || '').toString();
            const errStr = (err?.toString() || '').toString();

            if (errMsg.includes('QuotaFailure') || errMsg.includes('quota') || errStr.includes('RESOURCE_EXHAUSTED')) {
                friendlyError = 'The AI service is temporarily over its request quota. Please wait a moment and try again, or check your API key usage in Settings → AI Settings.';
            } else if (errMsg.includes('API key not valid') || errMsg.includes('API_KEY_INVALID') || errMsg.includes('PERMISSION_DENIED')) {
                friendlyError = 'Your AI API key appears to be invalid or expired. Please check your API key in Settings → AI Settings.';
            } else if (errMsg.includes('fetch') || errMsg.includes('network') || errMsg.includes('Failed to fetch')) {
                friendlyError = 'Network error — couldn\'t reach the AI service. Please check your internet connection and try again.';
            } else if (errMsg.includes('Billing')) {
                friendlyError = 'The AI service requires billing to be enabled on your Google Cloud account. Please enable billing or check your API key settings.';
            } else if (errMsg.includes('safety') || errMsg.includes('SAFETY')) {
                friendlyError = 'The AI service flagged this request as potentially unsafe. Try rephrasing your question or using different sources.';
            } else if (errMsg.includes('rate limit') || errMsg.includes('RATE_LIMIT')) {
                friendlyError = 'Too many requests to the AI service. Please wait a moment and try again.';
            }

            try {
                await actions.updateItem('researchMessages', { id: aiMsgId, content: friendlyError, isThinking: false }, 'Message');
            } catch (updateErr) {
                actions.removeItemFromState('researchMessages', aiMsgId);
                actions.addItem('researchMessages', {
                    id: aiMsgId,
                    firmId: currentUser?.firmId,
                    notebookId,
                    content: friendlyError,
                    role: 'model',
                    timestamp: new Date().toISOString(),
                    isThinking: false,
                }, 'Message');
            }
        }
    }, [currentUser, actions]);

    return {
        handleAddResearchNotebook,
        handleAddResearchSource,
        handleSendResearchMessage,
        handleDeleteResearchNotebook: async (id: string, name: string) => {
            // First, delete all child sources, messages, and analysis results
            // belonging to this notebook. This prevents orphaned records and
            // ensures clean deletion.
            try {
                const childSources = (appState.researchSources || []).filter((s: any) => s.notebookId === id);
                const childMessages = (appState.researchMessages || []).filter((m: any) => m.notebookId === id);
                const childResults = (appState.researchAnalysisResults || []).filter((r: any) => r.notebookId === id);

                // Delete children first (best-effort, don't block on failures)
                for (const s of childSources) {
                    try { await actions.deleteItem('researchSources', s.id || s._id); } catch {}
                }
                for (const m of childMessages) {
                    try { await actions.deleteItem('researchMessages', m.id || m._id); } catch {}
                }
                for (const r of childResults) {
                    try { await actions.deleteItem('researchAnalysisResults', r.id || r._id); } catch {}
                }

                // Then delete the notebook itself
                await actions.deleteItem('researchNotebooks', id, name);
            } catch (e: any) {
                // If the Convex delete fails, remove from local state anyway
                // so the user isn't stuck with an undeletable item in the UI.
                actions.removeItemFromState('researchNotebooks', id);
                actions.removeItemFromState('researchSources', id); // won't match, but safe
                addToast(`Notebook "${name}" removed from your view. ${e.message || ''}`, { type: 'info' });
            }
        },
        handleDeleteResearchSource: async (id: string) => {
            try {
                await actions.deleteItem('researchSources', id);
            } catch (e: any) {
                // Force-remove from local state so the UI isn't stuck
                actions.removeItemFromState('researchSources', id);
                addToast('Source removed from your view.', { type: 'info' });
            }
        },
        handleSaveAnalysisResult: (result: any) => actions.addItem('researchAnalysisResults', result, 'Analysis Result'),
        handleDeleteAnalysisResult: async (id: string) => {
            try {
                await actions.deleteItem('researchAnalysisResults', id);
            } catch (e: any) {
                actions.removeItemFromState('researchAnalysisResults', id);
            }
        },
    };
};
