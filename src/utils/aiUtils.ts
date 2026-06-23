import { AppState, User, HistoryEntry } from '../types';
import { ALOA_PRECISION_PROTOCOL } from '../constants/aloaPrompts';


/**
 * Utility functions for AI configuration and key management.
 */
const STORAGE_KEY_API_KEY = 'practicepro_custom_gemini_key';

export const AI_CONFIG = {
    gemini: {
        // Models confirmed available via /v1beta/models for this API key (May 2026)
        defaultModel: 'gemini-2.0-flash',
        proModel: 'gemini-2.5-pro',
        flashModel: 'gemini-2.0-flash',
        fallbackPlan: [
            'gemini-2.0-flash',
            'gemini-2.5-flash',
            'gemini-2.0-flash-lite',
            'gemini-2.5-pro',
            'gemini-flash-latest'
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
    if (!apiKey) throw new Error("API Key missing. Get a free key at https://aistudio.google.com/app/apikey and paste it in Settings → Agents → API Key Configuration");

    const getSystemInstruction = (
        appState: AppState,
        currentUser: User,
        currentHistoryEntry: HistoryEntry,
        localFiles?: any[],
        isFirmSearchEnabled?: boolean
    ): string => {
        let localDocsPrompt = "";
        if (localFiles && localFiles.length > 0) {
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
        `;
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

    const modelsToTry = [
        options.model || AI_CONFIG.gemini.defaultModel,
        ...AI_CONFIG.gemini.fallbackPlan
    ].filter((m, i, arr) => arr.indexOf(m) === i); // deduplicate

    let lastError: any = null;

    for (const modelName of modelsToTry) {
        try {
            console.log(`[AI] Attempting Gemini: ${modelName}`);
            const modelTag = modelName.includes('models/') ? modelName : `models/${modelName}`;
            const url = `https://generativelanguage.googleapis.com/v1beta/${modelTag}:generateContent?key=${apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
                    generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                    ]
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(`API ${response.status}: ${errData?.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (responseText) return responseText;
        } catch (e: any) {
            lastError = e;
            console.warn(`[AI] Model ${modelName} failed:`, e.message);
            if (e.message?.includes('API key not valid')) throw e;
        }
    }

    throw lastError || new Error('All AI models failed to respond.');

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
    if (!apiKey) throw new Error("API Key missing. Get a free key at https://aistudio.google.com/app/apikey and paste it in Settings → Agents → API Key Configuration");

    const modelName = options.model || AI_CONFIG.gemini.defaultModel;
    const modelTag = modelName.includes('models/') ? modelName : `models/${modelName}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelTag}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 8192 }
        })
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Gemini Multipart Error (${modelName}): ${errData?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
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

    // Removed hardcoded master key for security. 
    return undefined;
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
 *
 * Returns both the sanitized text AND a report of what was stripped,
 * so the UI can show the user exactly what PII was detected and removed
 * before their data is sent to Google's AI.
 */
export interface PIIStripResult {
    sanitized: string;
    found: { type: string; original: string; replacement: string }[];
    totalStripped: number;
}

export const stripPII = (text: string): string => {
    return stripPIIWithReport(text).sanitized;
};

export const stripPIIWithReport = (text: string): PIIStripResult => {
    let sanitized = text;
    const found: { type: string; original: string; replacement: string }[] = [];

    // Email
    sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (match) => {
        found.push({ type: 'Email', original: match, replacement: '[EMAIL_REDACTED]' });
        return '[EMAIL_REDACTED]';
    });

    // Nigerian Phone Numbers (+234, 080, 081, 090, 070 followed by 8 digits)
    sanitized = sanitized.replace(/(?:\+234|0)[789][01]\d{8}/g, (match) => {
        found.push({ type: 'Phone', original: match, replacement: '[PHONE_REDACTED]' });
        return '[PHONE_REDACTED]';
    });

    // BVN / NIN (11 digits)
    sanitized = sanitized.replace(/\b\d{11}\b/g, (match) => {
        found.push({ type: 'NIN/BVN', original: match, replacement: '[ID_REDACTED]' });
        return '[ID_REDACTED]';
    });

    // Credit Cards
    sanitized = sanitized.replace(/\b(?:\d{4}[ -]?){3}\d{4}\b/g, (match) => {
        found.push({ type: 'Card', original: match, replacement: '[CARD_REDACTED]' });
        return '[CARD_REDACTED]';
    });

    // Nigerian bank account numbers (10 digits)
    sanitized = sanitized.replace(/\b\d{10}\b/g, (match) => {
        // Only flag if it looks like a bank account (not a date or reference number)
        // We check context — if preceded by "account", "acct", "bank", "no."
        const before = sanitized.substring(Math.max(0, sanitized.indexOf(match) - 30), sanitized.indexOf(match)).toLowerCase();
        if (before.includes('account') || before.includes('acct') || before.includes('bank') || before.includes('no.')) {
            found.push({ type: 'Bank Account', original: match, replacement: '[ACCOUNT_REDACTED]' });
            return '[ACCOUNT_REDACTED]';
        }
        return match;
    });

    return { sanitized, found, totalStripped: found.length };
};

/**
 * Generates an embedding for a given text using the Gemini Embedding API.
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error("API Key missing. Get a free key at https://aistudio.google.com/app/apikey and paste it in Settings → Agents → API Key Configuration");

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