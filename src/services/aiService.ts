
import { AppState, User, HistoryEntry, AloaMessage } from '../types';
import { SignerContext } from '../contexts/ProductContext';
import { getAIProvider } from '../utils/aiUtils';
import * as geminiService from './geminiService';
export const sendMessage = async (
    history: AloaMessage[],
    context: Parameters<typeof geminiService.sendMessage>[1],
    modelPreference: 'auto' | 'flash' | 'pro' | 'research' = 'auto',
    signal?: AbortSignal
): Promise<{ text?: string; toolCalls?: any[]; modelUsed?: string }> => {
    // Default to Gemini
    return geminiService.sendMessage(history, context, modelPreference, signal);
};

export const streamMessage = async (
    history: AloaMessage[],
    context: Parameters<typeof geminiService.sendMessage>[1],
    onChunk: (text: string) => void,
    modelPreference: 'auto' | 'flash' | 'pro' | 'research' = 'auto',
    signal?: AbortSignal
) => {
    return geminiService.streamMessage(history, context, onChunk, modelPreference, signal);
};

export const streamDraft = async (
    history: { role: string, content: string }[],
    context: { appState: AppState; currentUser: User; signerContext?: SignerContext | null; },
    onChunk: (text: string) => void,
    signal?: AbortSignal
) => {
    return geminiService.streamDraft(history, context, onChunk, signal);
};

