import { GoogleGenAI, FunctionDeclaration, Type, Content } from "@google/genai";
import { AppState, User, HistoryEntry, AloaMessage, Matter, TaskStatus, MatterStatus, FirmDetails, SubscriptionPlan, FirmActivity, FileDetails, Lead, Contact, WorkflowDefinition, ArchivedItem, InvoiceLineItem, BankAccount, InvoiceStatus, AttorneyNote, Email, Property, IntakeFormTemplate, AutomationRule, TaskPriority, ExternalCounselInvite, ResearchNotebook, StudioAnalysisResult } from '../types';
import { getGeminiApiKey, AI_CONFIG, stripPII } from '../utils/aiUtils';
import { getSystemInstruction } from '../agents/AgencyHub';
import { ALOA_PRECISION_PROTOCOL, DRAFTPRO_HTML_FORMATTING_RULES } from '../constants/aloaPrompts';
import { validateAIResponse } from '../config/identityGuardrails';

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
    },
    modelPreference: 'auto' | 'flash' | 'pro' = 'auto'
): Promise<{ text?: string; toolCalls?: any[]; modelUsed?: string }> => {

    const { appState, currentUser, currentHistoryEntry, localFiles, aloaXLibrary, isFirmSearchEnabled } = context;
    const isDemo = currentUser?.email === 'demo@practicepro.ng';
    const demoKey = import.meta.env.VITE_GEMINI_DEMO_KEY as string;
    
    const personalKey = isDemo ? (demoKey || 'AIzaSyAjPumBNTGi8Lzg457yKm4dD0jFAzefXo0') : getGeminiApiKey();
    const firmKey = appState.firmDetails?.aiSettings?.firmGeminiApiKey;
    const apiKey = personalKey || (firmKey && firmKey.trim() !== '' ? firmKey : undefined);

    if (!apiKey) {
        if (isDemo) {
            throw new Error("Demo AI configuration error. Please contact support.");
        }
        throw new Error("API Key is missing. Please configure it in Settings > AI Workforce.");
    }

    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });

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
        new Date().toISOString()
    );

    const preferredModelName = 
        modelPreference === 'pro' ? AI_CONFIG.gemini.proModel : 
        modelPreference === 'flash' ? (AI_CONFIG.gemini as any).flashModel : 
        AI_CONFIG.gemini.defaultModel;

    const contents: Content[] = history.map((msg): Content | null => {
        if (msg.role === 'tool' && msg.toolResult) {
            return {
                role: 'user', // In this SDK, tool responses are often sent as user role or specialized role
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

    // Try preferred model first, then fallback to other models
    const modelsToTry = [preferredModelName, ...AI_CONFIG.gemini.fallbackPlan.filter(m => m !== preferredModelName)];
    let lastError = null;

    for (const modelName of modelsToTry) {
        try {
            const response = await (ai.models as any).generateContent({
                model: modelName,
                contents,
                systemInstruction: stripPII(systemInstruction),
                tools: [{ functionDeclarations: tools }],
                config: {
                    temperature: 0.2,
                    topP: 0.1,
                    topK: 40
                }
            });

            const rawText = typeof response.text === 'function' ? (response as any).text() : response.text;
            const agent = currentHistoryEntry.view === 'atriumEngine' || ['properties', 'propertyDetail'].includes(currentHistoryEntry.view) ? 'ARIA' : 'ALOA';
            const { sanitized } = validateAIResponse(rawText || '', agent as 'ARIA' | 'ALOA');

            return {
                text: sanitized,
                toolCalls: response.functionCalls,
                modelUsed: modelName
            };
        } catch (error: any) {
            lastError = error;
            const errStr = String(error.message || JSON.stringify(error)).toLowerCase();
            const isRetryable = errStr.includes('404') ||
                errStr.includes('not found') ||
                errStr.includes('unavailable') ||
                errStr.includes('not available') ||
                errStr.includes('not supported') ||
                errStr.includes('invalid model') ||
                errStr.includes('v1beta') ||
                errStr.includes('quota') ||
                errStr.includes('exhausted') ||
                errStr.includes('429');

            if (isRetryable) {
                console.warn(`Model ${modelName} unavailable. Trying next fallback...`);
                continue; // Try next model
            }

            // For other errors (auth, quota, network), throw immediately
            throw error;
        }
    }

    // If all models failed, throw the last error
    console.error("All Gemini models failed:", lastError);
    throw lastError || new Error("All AI models are currently unavailable.");
};

export const streamDraft = async (
    history: { role: string, content: string }[],
    context: { appState: AppState; currentUser: User; },
    onChunk: (text: string) => void
) => {
    const isDemo = context.currentUser?.email === 'demo@practicepro.ng';
    const demoKey = import.meta.env.VITE_GEMINI_DEMO_KEY as string;
    
    const personalKey = isDemo ? (demoKey || 'AIzaSyAjPumBNTGi8Lzg457yKm4dD0jFAzefXo0') : getGeminiApiKey();
    const firmKey = context.appState.firmDetails?.aiSettings?.firmGeminiApiKey;
    const apiKey = personalKey || (firmKey && firmKey.trim() !== '' ? firmKey : undefined);

    if (!apiKey) throw new Error("API Key missing");

    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    const contents: Content[] = history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: typeof msg.content === 'string' ? msg.content : '' }]
    })).filter(c => c.parts[0].text);

    const systemInstruction = `
    ${ALOA_PRECISION_PROTOCOL}
    
    ${DRAFTPRO_HTML_FORMATTING_RULES}

    CONTEXT: The user is a legal practitioner based in Asaba, Delta State, Nigeria. 
    Unless explicitly instructed otherwise (e.g., "Lagos High Court"), ALL drafts must be tailored to the jurisdiction of the High Court of Delta State or relevant Delta State laws.
    
    TASK: Write a perfectly formatted, authoritative legal document.
    
    Adhere strictly to Nigerian Law, specifically Delta State Civil Procedure Rules where applicable for litigation, or general Nigerian statutes (CAMA 2020, Land Use Act).
    `;

    const modelsToTry = AI_CONFIG.gemini.fallbackPlan;
    let lastError = null;

        for (const modelToTest of modelsToTry) {
            try {
                const result = await (ai.models as any).generateContentStream({
                    model: modelToTest,
                    contents,
                    systemInstruction: systemInstruction
                });

            // Handle stream iteration safely for different SDK versions
            const streamIterable = (result as any).stream || result;

            for await (const chunk of streamIterable) {
                const chunkText = typeof (chunk as any).text === 'function' ? (chunk as any).text() : (chunk as any).text;
                if (chunkText) {
                    onChunk(chunkText);
                }
            }
            return; // Success, exit function
        } catch (error: any) {
            lastError = error;
            const errStr = String(error.message || JSON.stringify(error)).toLowerCase();
            const isUnavailable =
                errStr.includes('404') ||
                errStr.includes('not found') ||
                errStr.includes('unavailable') ||
                errStr.includes('not available') ||
                errStr.includes('not supported') ||
                errStr.includes('invalid model') ||
                errStr.includes('v1beta') ||
                errStr.includes('429') ||
                errStr.includes('quota') ||
                errStr.includes('overloaded');

            if (isUnavailable) {
                console.warn(`Drafting Model ${modelToTest} unavailable/rate-limited. Retrying...`);
                continue;
            }
            throw error;
        }
    }

    throw lastError || new Error("Drafting failed to initialize.");
};

export const analyzeAttorneyDictation = async (
    audioBase64: string,
    matter: Matter,
    firmDetails?: any // Pass firmDetails to access firm key
): Promise<{ analysis: any; transcription: string }> => {

    const isDemo = firmDetails?.id === 'demo-firm-id';
    const demoKey = import.meta.env.VITE_GEMINI_DEMO_KEY as string;
    
    const personalKey = isDemo ? (demoKey || 'AIzaSyAjPumBNTGi8Lzg457yKm4dD0jFAzefXo0') : getGeminiApiKey();
    const firmKey = firmDetails?.aiSettings?.firmGeminiApiKey;
    const apiKey = personalKey || (firmKey && firmKey.trim() !== '' ? firmKey : undefined);

    if (!apiKey) throw new Error("API Key missing");

    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });

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
        const response = await (ai.models as any).generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [audioPart, textPart] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        transcription: { type: Type.STRING },
                        analysis: {
                            type: Type.OBJECT,
                            properties: {
                                summary: { type: Type.STRING },
                                facts: { type: Type.ARRAY, items: { type: Type.STRING } },
                                missingInfo: { type: Type.ARRAY, items: { type: Type.STRING } },
                                recommendations: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            title: { type: Type.STRING },
                                            reason: { type: Type.STRING },
                                            readiness: { type: Type.STRING, enum: ['Ready', 'Needs Info'] }
                                        },
                                        required: ['title', 'reason', 'readiness']
                                    }
                                }
                            },
                            required: ['summary', 'facts', 'missingInfo', 'recommendations']
                        }
                    },
                    required: ['transcription', 'analysis']
                }
            }
        });

        const jsonString = response.text;
        const result = JSON.parse(jsonString || '{}');
        return {
            analysis: result.analysis,
            transcription: result.transcription
        };
    } catch (error: any) {
        console.error(`Analysis Error (${modelName}):`, error);
        throw error;
    }
};

/**
 * Transcribes a raw audio recording using Gemini multimodal.
 * This is the engine for the Note Taker voice feature.
 * It is lighter than analyzeAttorneyDictation — pure transcription only.
 */
export const transcribeAudio = async (
    audioBase64: string,
    mimeType: string = 'audio/webm',
    firmDetails?: any
): Promise<string> => {
    const isDemo = firmDetails?.id === 'demo-firm-id';
    const demoKey = import.meta.env.VITE_GEMINI_DEMO_KEY as string;
    
    const personalKey = isDemo ? (demoKey || 'AIzaSyDd5ib2A1562gO2PY1FQElSVzwyIaeBAN8') : getGeminiApiKey();
    const firmKey = firmDetails?.aiSettings?.firmGeminiApiKey;
    const apiKey = personalKey || (firmKey && firmKey.trim() !== '' ? firmKey : undefined);

    if (!apiKey) throw new Error("API Key missing. Please configure it in Settings > AI Workforce.");

    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
    const cleanBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;

    const response = await ai.models.generateContent({
        model: AI_CONFIG.gemini.defaultModel,
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
        }]
    });

    const text = typeof response.text === 'function' ? (response as any).text() : response.text;
    return (text || '').trim();
};
