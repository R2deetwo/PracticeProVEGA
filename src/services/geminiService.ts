import { FunctionDeclaration, Type, Content, GoogleGenAI } from "@google/genai";
import { AppState, User, HistoryEntry, AloaMessage, Matter, TaskStatus, MatterStatus, FirmDetails, SubscriptionPlan, FirmActivity, FileDetails, Lead, Contact, WorkflowDefinition, ArchivedItem, InvoiceLineItem, BankAccount, InvoiceStatus, AttorneyNote, Email, Property, IntakeFormTemplate, AutomationRule, TaskPriority, ExternalCounselInvite, ResearchNotebook, StudioAnalysisResult, AriaChatContext } from '../types';
import { SignerContext } from '../contexts/ProductContext';
import { AI_CONFIG, stripPII, getGeminiApiKey } from '../utils/aiUtils';
import { getSystemInstruction } from '../agents/AgencyHub';
import { ALOA_PRECISION_PROTOCOL, DRAFTPRO_HTML_FORMATTING_RULES, getAloaProtocol } from '../constants/aloaPrompts';
import { validateAIResponse } from '../config/identityGuardrails';
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const CONVEX_URL = (import.meta.env.VITE_CONVEX_URL as string) || "https://gregarious-malamute-537.convex.cloud";
const convex = new ConvexHttpClient(CONVEX_URL);

export enum ModalType {
    NewMatter = 'newMatter',
    NewContact = 'newContact',
    NewTask = 'newTask',
    MatterIngestion = 'matterIngestion',
}

export const tools: FunctionDeclaration[] = [
    {
        name: "navigate_to",
        description: "Navigates to a specific view within the app.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                view: { type: Type.STRING, description: "View name." },
                selectedId: { type: Type.STRING, description: "Item ID." },
                context: { type: Type.OBJECT, description: "Nav context." }
            },
            required: ["view"]
        }
    },
    {
        name: "create_matter",
        description: "Opens the New Matter form. Extract all provided details like title, clientId, matterType, suitNumber, court, etc.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                clientId: { type: Type.STRING },
                matterType: { type: Type.STRING },
                suitNumber: { type: Type.STRING },
                court: { type: Type.STRING },
                presidingJudge: { type: Type.STRING },
                subCategory: { type: Type.STRING },
                newClientName: { type: Type.STRING },
                newClientEmail: { type: Type.STRING },
                newClientPhone: { type: Type.STRING }
            }
        }
    },
    {
        name: "create_event",
        description: "Opens the New Event/Meeting form. Extract details like title, date, time, matterId, type, etc.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                date: { type: Type.STRING, description: "ISO Date string" },
                time: { type: Type.STRING },
                matterId: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["Court Hearing", "Meeting", "Deadline", "Task"] },
                location: { type: Type.STRING },
                description: { type: Type.STRING }
            }
        }
    },
    {
        name: "create_task",
        description: "Opens the New Task form. Extract details like title, dueDate, matterId, priority, etc.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                dueDate: { type: Type.STRING, description: "ISO Date string" },
                matterId: { type: Type.STRING },
                priority: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
                description: { type: Type.STRING }
            }
        }
    },
    {
        name: "create_contact",
        description: "Opens the New Contact form. Extract details like name, email, phone, category, etc.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING },
                email: { type: Type.STRING },
                phone: { type: Type.STRING },
                category: { type: Type.STRING },
                company: { type: Type.STRING },
                address: { type: Type.STRING }
            }
        }
    },
    {
        name: "create_property",
        description: "Opens the New Property form for property management. Extract details like address, category, propertyType, value, rentAmount, etc.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                address: { type: Type.STRING },
                category: { type: Type.STRING, enum: ["Tenanted Property", "Property For Sale", "Disputed Property", "Personal Residence", "Other"] },
                propertyType: { type: Type.STRING, enum: ["Residential", "Commercial", "Industrial", "Land", "Mixed Use"] },
                status: { type: Type.STRING, enum: ["Occupied", "Vacant", "Listed", "Maintenance", "Sold"] },
                value: { type: Type.NUMBER },
                rentAmount: { type: Type.NUMBER },
                tenantName: { type: Type.STRING }
            }
        }
    },
    {
        name: "open_matter_ingestion_wizard",
        description: "Opens the Smart Matter Ingest Wizard. Use this when the user mentions bulk upload, ingesting folders, or onboarding legacy data.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                context: { type: Type.OBJECT, description: "Optional context." }
            }
        }
    },
    {
        name: "start_drafting",
        description: "Starts drafting a document in the Law Editor. Use this when the user asks to write, draft, or create a document.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: "Title of the document" },
                prompt: { type: Type.STRING, description: "Detailed instructions for the drafting agent" }
            },
            required: ["prompt"]
        }
    },
    {
        name: "draft_workflow",
        description: "Creates a new custom workflow template with specific stages based on the user's request. Use this when the user asks to create, set up, or define a workflow.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                type: { type: Type.STRING, description: "The broad category (e.g., 'Civil Litigation', 'Real Estate')." },
                subCategoryName: { type: Type.STRING, description: "The specific workflow name (e.g., 'Election Petition', 'Divorce')." },
                stages: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "An ordered list of stages for this workflow (e.g., ['Filing', 'Service', 'Trial'])."
                }
            },
            required: ["type", "stages"]
        }
    },
    {
        name: "query_firm_data",
        description: "Searches through the firm's data for specific items. Use this when the user asks 'Find notes about X', 'What are my tasks relating to Y', or 'Show me endorsements for Z'.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: { type: Type.STRING, description: "Keywords to search for." },
                category: {
                    type: Type.STRING,
                    enum: ["all", "tasks", "notes", "matters", "documents", "endorsements"],
                    description: "Optional category to narrow down the search."
                }
            },
            required: ["query"]
        }
    },
    {
        name: "analyze_document",
        description: "Performs a deep semantic analysis of a specific document or note. Use this when the user asks for a summary, risk report, or specific content analysis of a document they just searched for or mentioned.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                sourceId: { type: Type.STRING, description: "The ID of the document or note to analyze." },
                type: { type: Type.STRING, enum: ["document", "note"], description: "The source type." }
            },
            required: ["sourceId", "type"]
        }
    },
    {
        name: "get_note_details",
        description: "Retrieves the full, detailed content of a specific note or endorsement. Use this when the user asks to 'see details', 'read full note', or 'show more' about a note they just found.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                noteId: { type: Type.STRING, description: "The ID of the note or endorsement." }
            },
            required: ["noteId"]
        }
    },
    {
        name: "execute_quick_action",
        description: "Directly executes a practice management action without opening a form. Use this when the user is specific (e.g., 'Change status of matter X to Completed', 'Assign task Y to John').",
        parameters: {
            type: Type.OBJECT,
            properties: {
                action: { type: Type.STRING, enum: ["update_status", "assign_user", "archive", "set_priority", "delete_item"] },
                targetType: { type: Type.STRING, enum: ["matters", "tasks", "documents", "contacts", "properties"] },
                targetId: { type: Type.STRING },
                value: { type: Type.STRING, description: "The new status, user ID, or priority value." }
            },
            required: ["action", "targetType", "targetId"]
        }
    },
    {
        name: "update_open_form",
        description: "Pushes data directly into the fields of an already open form. Use this when the user is currently looking at a form and asks you to 'Fill this in', 'Use this title', or 'Add these details'.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                data: { type: Type.OBJECT, description: "Key-value pairs of form field names and values." }
            },
            required: ["data"]
        }
    },
    {
        name: "search_legal_repo",
        description: "Searches the specialized Nigerian Legal Repository for case law, statutes, or procedural rules. Use this for specific legal research questions.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: { type: Type.STRING },
                jurisdiction: { type: Type.STRING, enum: ["Federal", "Lagos", "Delta", "Abuja", "General"] }
            },
            required: ["query"]
        }
    }
];

// getSystemInstruction is now imported from AgencyHub;

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
        injectedContext?: AriaChatContext | null;
    },
    modelPreference: 'auto' | 'flash' | 'pro' = 'auto'
): Promise<{ text?: string; toolCalls?: any[]; modelUsed?: string }> => {

    const { appState, currentUser, currentHistoryEntry, localFiles, aloaXLibrary, isFirmSearchEnabled } = context;
    const firmKey = appState.firmDetails?.aiSettings?.firmGeminiApiKey || getGeminiApiKey();

    // --- ALOA BRAIN: SEMANTIC RETRIEVAL ---
    let semanticContext: string | undefined;
    if (context.isFirmSearchEnabled && appState.firmDetails?.id) {
        try {
            const lastUserMsg = history.filter(m => m.role === 'user').pop()?.content;
            if (typeof lastUserMsg === 'string' && context.searchBrain) {
                semanticContext = await context.searchBrain(lastUserMsg);
            }
        } catch (e) {
            console.warn('[Brain] Search skipped:', e);
        }
    }

    const systemInstruction = getSystemInstruction(
        appState,
        currentUser,
        currentHistoryEntry,
        localFiles,
        aloaXLibrary,
        isFirmSearchEnabled,
        semanticContext,
        new Date().toISOString(),
        context.injectedContext
    );

    const preferredModelName = 
        modelPreference === 'pro' ? AI_CONFIG.gemini.proModel : 
        modelPreference === 'flash' ? (AI_CONFIG.gemini as any).flashModel : 
        AI_CONFIG.gemini.defaultModel;

    const contents: Content[] = history.map((msg): Content | null => {
        if (msg.role === 'tool' && msg.toolResult) {
            return {
                role: 'user', 
                parts: [{
                    functionResponse: {
                        name: msg.toolResult.toolName,
                        response: { result: msg.toolResult.output }
                    }
                }]
            };
        }

        if (msg.role === 'model' && msg.toolCalls) {
            return {
                role: 'model',
                parts: msg.toolCalls.map(tc => ({
                    functionCall: { name: tc.name, args: tc.args }
                }))
            };
        }

        const text = typeof msg.content === 'string' ? stripPII(msg.content) : '';
        if (!text) return null;
        return { role: msg.role === 'user' ? 'user' : 'model', parts: [{ text }] };
    }).filter((c): c is Content => c !== null);

    const modelsToTry = [preferredModelName, ...AI_CONFIG.gemini.fallbackPlan.filter(m => m !== preferredModelName)];
    let lastError = null;

    // ─── STRATEGY: Direct-First when client key is available ───────────────────
    // This bypasses Convex routing entirely, which avoids the issue where the
    // frontend may be pointed at a different Convex deployment than expected.
    const clientKey = firmKey || getGeminiApiKey();
    if (clientKey) {
        for (const modelName of modelsToTry) {
            try {
                const modelTag = modelName.includes('models/') ? modelName : `models/${modelName}`;
                const directUrl = `https://generativelanguage.googleapis.com/v1beta/${modelTag}:generateContent?key=${clientKey}`;

                const directResponse = await fetch(directUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents,
                        systemInstruction: { parts: [{ text: stripPII(systemInstruction) }] },
                        tools: [{ functionDeclarations: tools }],
                        generationConfig: { temperature: 0.2, topP: 0.1, topK: 40 },
                        safetySettings: [
                            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                        ]
                    })
                });

                if (directResponse.ok) {
                    const data = await directResponse.json();
                    const candidate = data?.candidates?.[0];
                    const rawText = candidate?.content?.parts?.find((p: any) => p.text)?.text || '';
                    const functionCalls = candidate?.content?.parts?.filter((p: any) => p.functionCall)?.map((p: any) => p.functionCall) || undefined;

                    const agent = currentHistoryEntry?.view === 'atriumEngine' || ['properties', 'propertyDetail'].includes(currentHistoryEntry?.view) ? 'ARIA' : 'ALOA';
                    const { sanitized } = validateAIResponse(rawText || '', agent as 'ARIA' | 'ALOA');
                    return { text: sanitized, toolCalls: functionCalls, modelUsed: `${modelName}` };
                }

                // Non-OK response — parse error and try next model
                const errData = await directResponse.json().catch(() => ({}));
                lastError = new Error(`AI Request Failed (${directResponse.status}): ${errData?.error?.message || directResponse.statusText}`);
                console.warn(`[AI Direct] ${modelName} failed (${directResponse.status}). Trying next...`);
            } catch (directErr: any) {
                lastError = directErr;
                console.warn(`[AI Direct] ${modelName} threw:`, directErr.message);
            }
        }
    }

    // ─── FALLBACK: Convex Proxy ────────────────────────────────────────────────
    for (const modelName of modelsToTry) {
        try {
            const response = await convex.action(api.ai.generateContent, {
                modelName,
                contents,
                systemInstruction: { parts: [{ text: stripPII(systemInstruction) }] },
                tools: [{ functionDeclarations: tools }],
                generationConfig: { temperature: 0.2, topP: 0.1, topK: 40 },
                firmGeminiApiKey: clientKey
            });

            const candidate = response?.candidates?.[0];
            const rawText = candidate?.content?.parts?.find((p: any) => p.text)?.text || '';
            const functionCalls = candidate?.content?.parts?.filter((p: any) => p.functionCall)?.map((p: any) => p.functionCall) || undefined;

            const agent = currentHistoryEntry?.view === 'atriumEngine' || ['properties', 'propertyDetail'].includes(currentHistoryEntry?.view) ? 'ARIA' : 'ALOA';
            const { sanitized } = validateAIResponse(rawText || '', agent as 'ARIA' | 'ALOA');
            return { text: sanitized, toolCalls: functionCalls, modelUsed: `${modelName} (Proxy)` };
        } catch (proxyErr: any) {
            lastError = proxyErr;
            console.warn(`[AI Proxy] ${modelName} failed via Convex:`, proxyErr.message);
        }
    }

    console.error("All AI paths exhausted. Last error:", lastError);
    throw lastError || new Error("All AI models are currently unavailable.");
};

/** Stream chat text (no tools) for responsive ALOA UI — tool flows still use sendMessage. */
export const streamMessage = async (
    history: AloaMessage[],
    context: {
        appState: AppState;
        currentUser: User;
        currentHistoryEntry: HistoryEntry;
        localFiles?: any[];
        aloaXLibrary?: any[];
        isFirmSearchEnabled?: boolean;
        searchBrain?: (query: string) => Promise<string>;
        injectedContext?: AriaChatContext | null;
    },
    onChunk: (text: string) => void,
    modelPreference: 'auto' | 'flash' | 'pro' = 'auto',
    signal?: AbortSignal
): Promise<{ text: string; modelUsed?: string }> => {
    const { appState, currentUser, currentHistoryEntry, localFiles, aloaXLibrary, isFirmSearchEnabled } = context;
    const firmKey = appState.firmDetails?.aiSettings?.firmGeminiApiKey || getGeminiApiKey();

    let semanticContext: string | undefined;
    if (context.isFirmSearchEnabled && appState.firmDetails?.id) {
        try {
            const lastUserMsg = history.filter(m => m.role === 'user').pop()?.content;
            if (typeof lastUserMsg === 'string' && context.searchBrain) {
                semanticContext = await context.searchBrain(lastUserMsg);
            }
        } catch (e) {
            console.warn('[Brain] Search skipped:', e);
        }
    }

    const systemInstruction = getSystemInstruction(
        appState,
        currentUser,
        currentHistoryEntry,
        localFiles,
        aloaXLibrary,
        isFirmSearchEnabled,
        semanticContext,
        new Date().toISOString(),
        context.injectedContext
    );

    const preferredModelName =
        modelPreference === 'pro' ? AI_CONFIG.gemini.proModel :
        modelPreference === 'flash' ? (AI_CONFIG.gemini as any).flashModel :
        (AI_CONFIG.gemini as any).flashModel || AI_CONFIG.gemini.defaultModel;

    const contents: Content[] = history.map((msg): Content | null => {
        const text = typeof msg.content === 'string' ? stripPII(msg.content) : '';
        if (!text || msg.role === 'tool') return null;
        return { role: msg.role === 'user' ? 'user' : 'model', parts: [{ text }] };
    }).filter((c): c is Content => c !== null);

    const clientKey = firmKey || getGeminiApiKey();
    if (!clientKey) throw new Error('No Gemini API key configured.');

    const modelTag = preferredModelName.includes('models/') ? preferredModelName : `models/${preferredModelName}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelTag}:streamGenerateContent?alt=sse&key=${clientKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: stripPII(systemInstruction) }] },
            generationConfig: { temperature: 0.2, topP: 0.1, topK: 40 },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ],
        }),
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Stream failed (${response.status}): ${errData?.error?.message || response.statusText}`);
    }
    if (!response.body) throw new Error('No stream body');

    const agent = currentHistoryEntry?.view === 'atriumEngine' || ['properties', 'propertyDetail'].includes(currentHistoryEntry?.view || '') ? 'ARIA' : 'ALOA';
    let fullText = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const normalized = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const parts = normalized.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data: ')) continue;
            const dataStr = line.slice(6).trim();
            if (!dataStr || dataStr === '[DONE]') continue;
            try {
                const data = JSON.parse(dataStr);
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                    fullText += text;
                    onChunk(text);
                }
            } catch { /* skip */ }
        }
    }

    const { sanitized } = validateAIResponse(fullText, agent as 'ARIA' | 'ALOA');
    return { text: sanitized, modelUsed: preferredModelName };
};

export const streamDraft = async (
    history: { role: string, content: string }[],
    context: { appState: AppState; currentUser: User; signerContext?: SignerContext | null; },
    onChunk: (text: string) => void,
    signal?: AbortSignal
) => {
    const contents: Content[] = history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: typeof msg.content === 'string' ? msg.content : '' }]
    })).filter(c => c.parts[0].text);

    // ── Build role-aware context instruction ────────────────────────────────
    // KOMPLETE (unified) mode: use the user's actual profile role, never guess.
    // VEGA mode: always "legal practitioner / Solicitor".
    // ATRIUM mode: always "property manager / real estate professional".
    const isUnified = !!context.signerContext;
    const aloaProtocol = getAloaProtocol(isUnified, context.signerContext);

    let roleContextBlock: string;
    const sc = context.signerContext;
    if (sc) {
        // KOMPLETE / unified — derive from user profile
        roleContextBlock = `CONTEXT: The user is ${sc.signerName || 'the account holder'}, a ${sc.signerTitle || 'professional'}.
Unless explicitly instructed otherwise, ALL drafts must be signed and authored as "${sc.signerName || '[SIGNER NAME]'}" with the title "${sc.signerTitle || '[SIGNER TITLE]'}".
Do NOT assume the user is a "Lawyer" or "Property Manager" — use their actual profile title: "${sc.signerTitle}".
If you need more context about the user's practice area, include [BRACKETED PLACEHOLDERS] rather than guessing.
Jurisdiction: Tailor to Nigerian law, specifically Delta State Civil Procedure Rules where applicable for litigation, or general Nigerian statutes (CAMA 2020, Land Use Act).`;
    } else {
        // VEGA or ATRIUM — existing behavior preserved
        roleContextBlock = `CONTEXT: The user is a legal practitioner based in Asaba, Delta State, Nigeria. 
Unless explicitly instructed otherwise (e.g., "Lagos High Court"), ALL drafts must be tailored to the jurisdiction of the High Court of Delta State or relevant Delta State laws.
The user is ALWAYS the Lawyer/Solicitor. Sign documents accordingly.`;
    }

    const systemInstruction = `
    ${aloaProtocol}
    
    ${DRAFTPRO_HTML_FORMATTING_RULES}

    ${roleContextBlock}
    
    TASK: Write a perfectly formatted, authoritative legal document.
    
    Adhere strictly to Nigerian Law, specifically Delta State Civil Procedure Rules where applicable for litigation, or general Nigerian statutes (CAMA 2020, Land Use Act).
    `;

    const modelsToTry = AI_CONFIG.gemini.fallbackPlan;
    let lastError = null;

    const clientKey = getGeminiApiKey();
    if (!clientKey) {
        throw new Error("No Gemini API key found. Please add VITE_GEMINI_API_KEY in your environment settings.");
    }
    
    // ─── STRATEGY: Direct REST Stream (mirrors the working sendMessage pattern) ─
    for (const modelToTest of modelsToTry) {
        try {
            const modelTag = modelToTest.includes('models/') ? modelToTest : `models/${modelToTest}`;
            const url = `https://generativelanguage.googleapis.com/v1beta/${modelTag}:streamGenerateContent?alt=sse&key=${clientKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal,
                body: JSON.stringify({
                    contents,
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
                    ]
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(`API error ${response.status}: ${errData?.error?.message || response.statusText}`);
            }

            if (!response.body) throw new Error('No response body from stream.');

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let chunkCount = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                // Normalize line endings
                const normalized = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                const parts = normalized.split('\n\n');
                buffer = parts.pop() || '';

                for (const part of parts) {
                    const line = part.trim();
                    if (!line.startsWith('data: ')) continue;
                    const dataStr = line.slice(6).trim();
                    if (!dataStr || dataStr === '[DONE]') continue;
                    try {
                        const data = JSON.parse(dataStr);
                        const candidate = data?.candidates?.[0];
                        if (candidate?.finishReason === 'SAFETY') continue;
                        const text = candidate?.content?.parts?.[0]?.text;
                        if (text) { onChunk(text); chunkCount++; }
                    } catch (_) { /* skip malformed chunks */ }
                }
            }

            // Flush any remaining buffer
            if (buffer.trim()) {
                const line = buffer.trim();
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6).trim();
                    if (dataStr && dataStr !== '[DONE]') {
                        try {
                            const data = JSON.parse(dataStr);
                            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                            if (text) { onChunk(text); chunkCount++; }
                        } catch (_) {}
                    }
                }
            }

            console.log(`[Draft Stream] ${modelToTest} completed. Chunks: ${chunkCount}`);
            return; // ✅ Success

        } catch (err: any) {
            if (err.name === 'AbortError' || signal?.aborted) throw err; // user cancelled
            lastError = err;
            console.warn(`[Draft Stream] ${modelToTest} failed:`, err.message);
        }
    }

    // ─── FALLBACK: Convex Proxy ────────────────────────────────────────────────
    for (const modelToTest of modelsToTry) {
        try {
            const streamUrl = CONVEX_URL.replace('.cloud', '.site') + '/ai/stream';
            const response = await fetch(streamUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal,
                body: JSON.stringify({
                    model: modelToTest,
                    contents,
                    systemInstruction,
                    apiKey: clientKey
                })
            });

            if (!response.ok || !response.body) {
                throw new Error("Stream connection failed.");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    if (buffer.trim()) {
                        if (buffer.startsWith('data: ')) {
                            const dataStr = buffer.replace('data: ', '').trim();
                            if (dataStr !== '[DONE]') {
                                try {
                                    const data = JSON.parse(dataStr);
                                    const chunkText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                                    if (chunkText) onChunk(chunkText);
                                } catch (e) {}
                            }
                        }
                    }
                    break;
                }
                
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop() || ''; 
                
                for (const part of parts) {
                    if (part.startsWith('data: ')) {
                        const dataStr = part.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') continue;
                        try {
                            const data = JSON.parse(dataStr);
                            const chunkText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                            if (chunkText) onChunk(chunkText);
                        } catch (e) {}
                    }
                }
            }
            return; // Success
        } catch (error: any) {
            lastError = error;
            console.warn(`[Drafting Proxy] Model ${modelToTest} failed via Convex:`, error.message);
        }
    }

    throw lastError || new Error("Drafting failed to initialize via proxy.");
};

export const analyzeAttorneyDictation = async (
    audioBase64: string,
    matter: Matter,
    firmDetails?: any 
): Promise<{ analysis: any; transcription: string }> => {

    const firmKey = firmDetails?.aiSettings?.firmGeminiApiKey;
    const audioPart = {
        inlineData: {
            mimeType: 'audio/webm',
            data: audioBase64.split(',')[1] || audioBase64,
        },
    };

    const textPart = {
        text: `Analyze the provided legal dictation for the matter: "${matter.title}". 
        Extract the full transcription and provide a strategy analysis in the specified JSON format.`
    };

    const modelName = AI_CONFIG.gemini.defaultModel;

    try {
        const response = await convex.action(api.ai.generateContent, {
            modelName: modelName,
            contents: [{ role: 'user', parts: [audioPart, textPart] }],
            generationConfig: {
                responseMimeType: "application/json",
            },
            firmGeminiApiKey: firmKey
        });

        const candidate = response?.candidates?.[0];
        const jsonString = candidate?.content?.parts?.find((p: any) => p.text)?.text || '{}';
        
        const result = JSON.parse(jsonString || '{}');
        // If the AI missed the schema, fallback gracefully
        return {
            analysis: result.analysis || { summary: "Analysis failed", facts: [], missingInfo: [], recommendations: [] },
            transcription: result.transcription || "Transcription failed"
        };
    } catch (error: any) {
        console.error(`Analysis Error (${modelName}):`, error);
        throw error;
    }
};

/**
 * Transcribes a raw audio recording using Gemini multimodal via backend proxy.
 */
export const transcribeAudio = async (
    audioBase64: string,
    mimeType: string = 'audio/webm',
    firmDetails?: any
): Promise<string> => {
    
    const firmKey = firmDetails?.aiSettings?.firmGeminiApiKey;
    const cleanBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;

    try {
        const response = await convex.action(api.ai.generateContent, {
            modelName: AI_CONFIG.gemini.defaultModel,
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType, data: cleanBase64 } },
                    {
                        text: `Transcribe the audio recording exactly as spoken.
Return ONLY the transcribed text with no preamble, no analysis, no commentary.
Preserve natural punctuation and paragraph breaks.
If the audio is inaudible or contains no speech, return an empty string.`
                    }
                ]
            }],
            firmGeminiApiKey: firmKey
        });

        const candidate = response?.candidates?.[0];
        const text = candidate?.content?.parts?.find((p: any) => p.text)?.text || '';
        return text.trim();
    } catch (e) {
        console.error("Transcription via proxy failed", e);
        throw new Error("Transcription failed.");
    }
};
