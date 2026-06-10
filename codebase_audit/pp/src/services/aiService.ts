
import { AppState, User, HistoryEntry, AloaMessage, Matter } from '../types';
import { getAIProvider } from '../utils/aiUtils';
import * as geminiService from './geminiService';
export const sendMessage = async (
    history: AloaMessage[],
    context: {
        appState: AppState;
        currentUser: User;
        currentHistoryEntry: HistoryEntry;
        localFiles?: any[];
        aloaXLibrary?: any[];
        isFirmSearchEnabled?: boolean;
        searchBrain?: (query: string) => Promise<string>;
    },
    modelPreference: 'auto' | 'flash' | 'pro' = 'auto'
): Promise<{ text?: string; toolCalls?: any[]; modelUsed?: string }> => {
    // Default to Gemini
    return geminiService.sendMessage(history, context, modelPreference);
};

export const streamDraft = async (
    history: { role: string, content: string }[],
    context: { appState: AppState; currentUser: User; },
    onChunk: (text: string) => void
) => {
    return geminiService.streamDraft(history, context, onChunk);
};

export const analyzeAttorneyDictation = async (audioBase64: string, matter: Matter, firmDetails?: any) => {
    // Currently Gemini unique due to multimodal audio support
    return geminiService.analyzeAttorneyDictation(audioBase64, matter, firmDetails);
};
