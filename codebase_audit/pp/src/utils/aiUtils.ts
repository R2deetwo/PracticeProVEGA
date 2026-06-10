import { GoogleGenAI } from "@google/genai";
import { AppState, User, HistoryEntry } from '../types';
import { ALOA_PRECISION_PROTOCOL } from '../constants/aloaPrompts';


/**
 * Utility functions for AI configuration and key management.
 */
const STORAGE_KEY_API_KEY = 'practicepro_custom_gemini_key';

export const AI_CONFIG = {
    gemini: {
        // Standard model identifiers for @google/genai SDK (Updated May 2026)
        defaultModel: 'gemini-2.5-flash',
        proModel: 'gemini-2.5-pro',
        flashModel: 'gemini-2.0-flash',
        fallbackPlan: [
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-3.1-flash',
            'gemini-1.5-flash',
            'gemini-2.5-pro'
        ]
    },
    embeddingModel: 'text-embedding-004'
};

/**
 * Simple wrapper for Gemini AI calls.
 * Technically this project seems to prefer direct the standard model.generateContent 
 * but for this helper we'll make it asynchronous.
 */
export const streamGemini = async (
    prompt: string,
    options: {
        model?: string;
        apiKeyOverride?: string;
        appState?: AppState; // Added for RAG
        currentUser?: User; // Added for RAG
        currentHistoryEntry?: HistoryEntry; // Added for RAG
        localFiles?: any[]; // Added for RAG
        isFirmSearchEnabled?: boolean; // Added for RAG
    } = {}
): Promise<string> => {
    const apiKey = options.apiKeyOverride || getGeminiApiKey();
    if (!apiKey) throw new Error("API Key missing. Please set your Gemini API key in Settings.");

    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    const modelName = options.model || AI_CONFIG.gemini.defaultModel;

    const getSystemInstruction = (
        appState: AppState,
        currentUser: User,
        currentHistoryEntry: HistoryEntry,
        localFiles?: any[],
        isFirmSearchEnabled?: boolean
    ): string => {
        let localDocsPrompt = "";
        if (localFiles && localFiles.length > 0) { // Simplified condition
            localDocsPrompt = `
            **SECURE LOCAL DOCUMENTS ACCESSED:**
            The user has securely granted access to the following local files/folders. You can answer questions about them based on their names.
            ${localFiles?.map(f => `- ${f.name} (${f.kind})`).join('\n') || ''}
            `;
        }

        let firmRAGPrompt = "";
        if (isFirmSearchEnabled && appState?.documents) {
            const indexedDocs = appState.documents
                .filter(d => d.firmId && d.firmId !== 'local')
                .slice(0, 50);

            const docContext = indexedDocs.map(d => `- [Doc: ${d.title || 'Untitled'}] Status: ${d.litigationStatus || 'N/A'}, Category: ${d.categoryId || 'General'}`).join('\n');

            firmRAGPrompt = `
            **FIRM SEARCH ENABLED (RAG MODE):**
            Your firm's indexed documents are available for context. Answer questions specifically about these documents if requested.
            AVAILABLE DOCUMENTS:
            ${docContext}
            `;
        }

        return `
        ${ALOA_PRECISION_PROTOCOL}
        ${firmRAGPrompt}
        ${localDocsPrompt}
        `; // Closing backtick for template literal
    };

    let systemInstruction = '';
    if (options.appState && options.currentUser && options.currentHistoryEntry) {
        systemInstruction = getSystemInstruction(
            options.appState,
            options.currentUser,
            options.currentHistoryEntry,
            options.localFiles,
            options.isFirmSearchEnabled
        );
    }

    try {
        console.log(`[AI] Calling Gemini: ${modelName} (System Instruction: ${systemInstruction ? 'Yes' : 'No'})`);
        const response = await (ai.models as any).generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            systemInstruction: systemInstruction || undefined
        });

        const responseText = typeof response.text === 'function' ? (response as any).text() : response.text;
        return responseText || "";
    } catch (e: any) {
        console.error(`Gemini Error (${modelName}):`, e);
        // If it's a model error, provide more context to the user
        if (e.message?.includes('unavailable') || e.message?.includes('not found')) {
            throw new Error(`Model "${modelName}" is unavailable in your region or with this API key. Error: ${e.message}`);
        }
        throw e;
    }
};

/**
 * Multipart Gemini call — supports inline PDF/image data alongside text.
 * Parts format: [{ text: string } | { inlineData: { mimeType, data } }]
 */
export const streamGeminiMultipart = async (
    parts: any[],
    options: { model?: string; apiKeyOverride?: string } = {}
): Promise<string> => {
    const apiKey = options.apiKeyOverride || getGeminiApiKey();
    if (!apiKey) throw new Error("API Key missing. Please set your Gemini API key in Settings.");

    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    const modelName = options.model || AI_CONFIG.gemini.defaultModel;

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts }],
        });
        const responseText = typeof response.text === 'function' ? (response as any).text() : response.text;
        return responseText || "";
    } catch (e: any) {
        console.error(`Gemini Multipart Error (${modelName}):`, e);
        throw e;
    }
};

/**
 * Retrieves the Gemini API Key to use for requests.
 * Priority:
 * 1. User's custom key stored in localStorage.
 * 2. System/Firm key from environment variables.
 * @returns The API key string or undefined if neither exists.
 */
export const getGeminiApiKey = (): string | undefined => {
    const customKey = getCustomApiKey();
    if (customKey) return customKey;
    
    const envKey = import.meta.env.VITE_GEMINI_API_KEY as string;
    if (envKey) return envKey;

    // Hardcoded master key for demo/fallback
    return "AIzaSyAjPumBNTGi8Lzg457yKm4dD0jFAzefXo0";
};

/**
 * Retrieves the stored custom API key (if any) directly from storage.
 * Useful for UI to indicate if a custom key is set.
 */
export const getCustomApiKey = (): string | null => {
    try {
        return localStorage.getItem(STORAGE_KEY_API_KEY);
    } catch (e) {
        return null;
    }
}

/**
 * Removes hidden characters, non-ASCII characters, and whitespace.
 * Prevents "Failed to execute 'append' on 'Headers'" errors.
 */
const sanitizeApiKey = (key: string): string => {
    return key.replace(/[^ -~]/g, '').trim();
};

/**
 * Sets the user's custom API key in local storage.
 * @param key The API key string. Pass null to remove.
 */
export const setCustomApiKey = (key: string | null) => {
    try {
        if (key) {
            localStorage.setItem(STORAGE_KEY_API_KEY, sanitizeApiKey(key));
        } else {
            localStorage.removeItem(STORAGE_KEY_API_KEY);
        }
    } catch (e) {
        console.error("Failed to save custom API key", e);
    }
};

export const getAIProvider = (): 'gemini' => 'gemini';

/**
 * Strips Personal Identifiable Information (PII) from text.
 * Specifically targets Nigerian formats like NIN (11 digits), 
 * BVN (11 digits), Phone Numbers (+234), and Emails.
 */
export const stripPII = (text: string): string => {
    let sanitized = text;

    // Email
    sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');

    // Nigerian Phone Numbers (+234, 080, 081, 090, 070 followed by 8-10 digits)
    sanitized = sanitized.replace(/(?:\+234|0)[789][01]\d{8}/g, '[PHONE_REDACTED]');

    // BVN / NIN (usually 11 digits) - risky to blindly strip any 11 digits, 
    // but in legal context often identifies NIN/BVN
    sanitized = sanitized.replace(/\b\d{11}\b/g, '[ID_REDACTED]');

    // Credit Cards (generic)
    sanitized = sanitized.replace(/\b(?:\d{4}[ -]?){3}\d{4}\b/g, '[CARD_REDACTED]');

    return sanitized;
};

/**
 * Generates an embedding for a given text using the Gemini Embedding API.
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error("API Key missing");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.embeddingModel}:embedContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: AI_CONFIG.embeddingModel,
            content: { parts: [{ text }] },
        }),
    });

    if (!response.ok) {
        const errorArr = await response.json();
        throw new Error(`Embedding failed: ${errorArr.error?.message || response.statusText}`);
    }

    const json = await response.json();
    return json.embedding.values;
};