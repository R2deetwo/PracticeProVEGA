/**
 * aiProvider — A2 provider abstraction: the escape hatch from the Google
 * lock-in (roadmap stage A2, queued since A0/A1).
 *
 * WHY THIS EXISTS: the ALOA/ARIA stack is hard-wired to Google's
 * generativelanguage REST API. When Google retires models for new
 * accounts (2.5-pro, R31), flags a chat-shared demo key as leaked (R32),
 * or a firm simply can't bill through Google from their region, the
 * assistant dies with it. A2 gives every firm a second door: any
 * OpenAI-COMPATIBLE endpoint — OpenAI, OpenRouter, Groq, Together, or a
 * self-hosted vLLM/Ollama box — with their own key and their own model
 * ladder.
 *
 * THE SEAM: every AI call in geminiService speaks the GEMINI wire format
 * (contents/parts/systemInstruction/functionDeclarations, SSE chunks of
 * {candidates:[{content:{parts:[...]}}]}). Rather than fork that brain,
 * this module is a PROTOCOL ADAPTER at the REST boundary: it accepts a
 * Gemini-shaped request body, translates it to the target provider's
 * protocol, and hands back a REAL Response object whose .json()/.body
 * speak Gemini shapes again. geminiService keeps its prompts, its tool
 * loop, its ladders, its thoughtSignature handling — unchanged parsing,
 * zero regression on the Gemini path (which remains the default and the
 * exact bytes it has always sent).
 *
 * Firm opt-in: Settings → AI Settings → Firm-Wide API Keys (admin) —
 * provider selector + base URL + model ladder, stored in
 * firmDetails.aiSettings. Existing firms default to Gemini, untouched.
 *
 * Server-side (Convex: proactive briefings, summarisation, dictation,
 * the demo-key proxy) remains Gemini-only for now — it runs on our key,
 * not the firm's, and is documented as such in the settings copy.
 */
import { AI_CONFIG, getGeminiApiKey } from '../utils/aiUtils';
import type { AiSettings } from '../types';

export type ProviderId = 'gemini' | 'openai-compatible';

export interface ProviderConfig {
    provider: ProviderId;
    apiKey: string;
    /** OpenAI-compatible base URL, no trailing slash — e.g. https://openrouter.ai/api/v1 */
    baseUrl?: string;
    /** The firm's model ladder, flash-first (fast → strong). */
    models?: string[];
}

// ── Resolution ─────────────────────────────────────────────────────────────

const normalizeBaseUrl = (u: string): string => u.trim().replace(/\/+$/, '');

/**
 * Resolve the active provider from the firm's AI settings (admin-set),
 * falling back to the user's own key on Gemini. Returns null when no key
 * exists at all — callers keep their existing "no key configured" UX.
 */
export const resolveProvider = (
    aiSettings?: AiSettings | null,
    clientKey?: string | null
): ProviderConfig | null => {
    const firmKey = aiSettings?.firmGeminiApiKey?.trim() || '';
    const ownKey = (clientKey ?? getGeminiApiKey())?.trim() || '';
    const provider: ProviderId =
        aiSettings?.aiProvider === 'openai-compatible' ? 'openai-compatible' : 'gemini';

    if (provider === 'openai-compatible') {
        // An OpenAI-compatible provider is a FIRM decision — it needs the
        // firm's base URL, so it only activates with a firm key.
        const baseUrl = normalizeBaseUrl(aiSettings?.openaiBaseUrl || '');
        if (!firmKey || !baseUrl) return null;
        const models = (aiSettings?.openaiModels || [])
            .map((m) => m.trim())
            .filter(Boolean);
        return { provider, apiKey: firmKey, baseUrl, models: models.length ? models : undefined };
    }
    const key = firmKey || ownKey;
    if (!key) return null;
    return { provider: 'gemini', apiKey: key };
};

/**
 * The model ladder for a purpose. Gemini keeps the tuned registries
 * (fallbackPlan / draftingPlan / flash chain). OpenAI-compatible firms
 * use their own configured ladder; the draft purpose runs it PRO-FIRST
 * (mirroring the Gemini draftingPlan's pro-first strategy), chat runs it
 * flash-first.
 */
export const resolveModelLadder = (
    cfg: ProviderConfig | null,
    purpose: 'chat' | 'draft' | 'flash',
    preferredModelName?: string
): string[] => {
    if (cfg?.provider === 'openai-compatible' && cfg.models?.length) {
        const ladder = [...cfg.models];
        if (purpose === 'draft') ladder.reverse(); // pro-first for precision drafting
        return ladder;
    }
    const g = AI_CONFIG.gemini as any;
    if (purpose === 'draft') return g.draftingPlan || g.fallbackPlan;
    if (purpose === 'flash') return [g.flashModel || g.defaultModel, 'gemini-flash-latest', 'gemini-3.8-flash'];
    const plan: string[] = g.fallbackPlan || [];
    return preferredModelName
        ? [preferredModelName, ...plan.filter((m) => m !== preferredModelName)]
        : plan;
};

export const isGeminiProvider = (cfg: ProviderConfig | null | undefined): boolean =>
    !cfg || cfg.provider === 'gemini';

// ── Gemini → OpenAI request translation ───────────────────────────────────

type AnyPart = Record<string, any>;

const partIsText = (p: AnyPart) => typeof p.text === 'string';
const partIsImage = (p: AnyPart) => !!p.inlineData && String(p.inlineData.mimeType || '').startsWith('image/');
const partIsAudio = (p: AnyPart) => !!p.inlineData && String(p.inlineData.mimeType || '').startsWith('audio/');
const partIsFunctionCall = (p: AnyPart) => !!p.functionCall;
const partIsFunctionResponse = (p: AnyPart) => !!p.functionResponse;

/** Convert Gemini functionDeclarations to OpenAI tools (mechanical:
 *  Gemini's Type enum values ARE JSON-schema type strings). */
const convertTools = (body: any): any[] | undefined => {
    const decls: any[] | undefined = body?.tools?.[0]?.functionDeclarations;
    if (!decls?.length) return undefined;
    return decls.map((d) => ({
        type: 'function',
        function: {
            name: d.name,
            description: d.description || '',
            parameters: d.parameters || { type: 'object', properties: {} },
        },
    }));
};

/** A single Gemini content turn → one or more OpenAI messages. */
const contentToOpenAIMessages = (c: any, nameToCallId: Map<string, string>): any[] => {
    const out: any[] = [];
    const isModel = c.role === 'model';
    let text = '';
    const toolCalls: any[] = [];
    const functionResponses: any[] = [];
    const contentParts: any[] = [];

    for (const p of c.parts || []) {
        if (partIsText(p)) {
            text += (text ? '\n' : '') + p.text;
            contentParts.push({ type: 'text', text: p.text });
        } else if (partIsImage(p)) {
            contentParts.push({
                type: 'image_url',
                image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` },
            });
        } else if (partIsAudio(p)) {
            contentParts.push({
                type: 'input_audio',
                input_audio: { data: p.inlineData.data, format: 'wav' },
            });
        } else if (partIsFunctionCall(p)) {
            toolCalls.push(p.functionCall);
        } else if (partIsFunctionResponse(p)) {
            functionResponses.push(p.functionResponse);
        }
        // Other inline data (PDFs etc.): dropped — a text note is already
        // appended upstream by the attachment processor when extractable.
    }

    if (isModel) {
        if (toolCalls.length) {
            const calls = toolCalls.map((fc, i) => {
                const id = `call_${fc.name}_${Date.now().toString(36)}_${i}`;
                nameToCallId.set(fc.name, id);
                return {
                    id,
                    type: 'function',
                    function: { name: fc.name, arguments: JSON.stringify(fc.args ?? {}) },
                };
            });
            out.push({
                role: 'assistant',
                content: text || null,
                tool_calls: calls,
            });
        } else if (text || contentParts.length) {
            out.push({
                role: 'assistant',
                content: contentParts.length > 1
                    ? contentParts
                    : text,
            });
        }
    } else {
        // User turn: function responses become role:'tool' messages bound to
        // the matching call id (ALOA's tool loop sends them back by name).
        for (const fr of functionResponses) {
            out.push({
                role: 'tool',
                tool_call_id: nameToCallId.get(fr.name) || `call_${fr.name}_unknown`,
                content: JSON.stringify(fr.response ?? {}),
            });
        }
        if (text || contentParts.length) {
            out.push({
                role: 'user',
                content: contentParts.length > 1 ? contentParts : (text || ''),
            });
        }
    }
    return out;
};

/** Translate a full Gemini request body to an OpenAI chat.completions body. */
export const geminiBodyToOpenAI = (body: any): any => {
    const messages: any[] = [];
    const sysText = body?.systemInstruction?.parts?.find((p: any) => partIsText(p))?.text;
    if (sysText) messages.push({ role: 'system', content: sysText });

    const nameToCallId = new Map<string, string>();
    for (const c of body?.contents || []) {
        messages.push(...contentToOpenAIMessages(c, nameToCallId));
    }

    const out: any = { messages, stream: !!body.__stream };
    const tools = convertTools(body);
    if (tools?.length) out.tools = tools;

    const gc = body?.generationConfig || {};
    if (typeof gc.temperature === 'number') out.temperature = gc.temperature;
    if (typeof gc.topP === 'number') out.top_p = gc.topP;
    if (typeof gc.maxOutputTokens === 'number') out.max_tokens = gc.maxOutputTokens;
    if (gc.responseMimeType === 'application/json') out.response_format = { type: 'json_object' };
    // topK and safetySettings have no OpenAI equivalent — dropped.

    return out;
};

// ── OpenAI → Gemini response translation ──────────────────────────────────

const safeParseArgs = (raw: string | undefined): any => {
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return { _raw: raw }; }
};

/** One OpenAI non-stream response → Gemini {candidates:[...]} shape. */
export const openAIResponseToGemini = (data: any): any => {
    const choice = data?.choices?.[0];
    const msg = choice?.message;
    const parts: AnyPart[] = [];
    if (msg?.content) parts.push({ text: msg.content });
    for (const tc of msg?.tool_calls || []) {
        parts.push({
            functionCall: {
                name: tc.function?.name,
                args: safeParseArgs(tc.function?.arguments),
            },
        });
    }
    if (!parts.length) parts.push({ text: '' });
    return {
        candidates: [
            {
                content: { role: 'model', parts },
                finishReason: choice?.finish_reason === 'tool_calls' ? 'STOP' : 'STOP',
            },
        ],
    };
};

/** Re-emit an OpenAI SSE stream as GEMINI-shaped SSE: the existing
 *  streamMessage/streamDraft readers parse `data:` lines for
 *  candidates[0].content.parts[] (text / functionCall) — this translated
 *  stream speaks exactly that, so those readers stay untouched.
 *  OpenAI streams tool-call ARGUMENTS as string fragments across chunks;
 *  they are accumulated per index and emitted as complete functionCall
 *  parts when the stream finishes. */
export const openAIStreamToGeminiSSE = async (response: Response): Promise<Response> => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8');

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const reader = response.body!.getReader();
            let buffer = '';
            const emit = (geminiChunk: any) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(geminiChunk)}\n\n`));
            };
            // name → fragment accumulator per tool call index
            const toolAcc = new Map<number, { id: string; name: string; args: string }>();

            const flushTools = () => {
                for (const { name, args } of toolAcc.values()) {
                    emit({
                        candidates: [{ content: { role: 'model', parts: [{ functionCall: { name, args: safeParseArgs(args) } }] } }],
                    });
                }
                toolAcc.clear();
            };

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const rawLine of lines) {
                        const line = rawLine.trim();
                        if (!line.startsWith('data:')) continue;
                        const dataStr = line.slice(5).trim();
                        if (!dataStr || dataStr === '[DONE]') continue;
                        let chunk: any;
                        try { chunk = JSON.parse(dataStr); } catch { continue; }
                        const delta = chunk?.choices?.[0]?.delta;
                        if (!delta) continue;
                        if (typeof delta.content === 'string' && delta.content) {
                            emit({
                                candidates: [{ content: { role: 'model', parts: [{ text: delta.content }] } }],
                            });
                        }
                        for (const tc of delta.tool_calls || []) {
                            const idx = typeof tc.index === 'number' ? tc.index : 0;
                            const acc = toolAcc.get(idx) || {
                                id: tc.id || `call_${idx}`,
                                name: tc.function?.name || '',
                                args: '',
                            };
                            if (tc.function?.name) acc.name = tc.function.name;
                            if (tc.function?.arguments) acc.args += tc.function.arguments;
                            toolAcc.set(idx, acc);
                        }
                    }
                }
                flushTools();
            } catch (e) {
                // Surface the failure to the reader as a Gemini-style error
                // chunk — the callers' existing catch handles the rest.
                emit({ error: { message: e instanceof Error ? e.message : 'Stream failed' } });
            } finally {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
            }
        },
    });

    return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
    });
};

// ── The seam — Gemini-shaped requests in, Gemini-shaped Responses out ─────

const openAIError = async (res: Response, what: string): Promise<never> => {
    let message = res.statusText;
    try {
        const j = await res.json();
        message = j?.error?.message || j?.message || message;
    } catch { /* keep statusText */ }
    throw new Error(`${what} failed (${res.status}): ${message}`);
};

const geminiUrl = (modelTag: string, method: 'generateContent' | 'streamGenerateContent', key: string): string =>
    `https://generativelanguage.googleapis.com/v1beta/${modelTag}:${method}${method === 'streamGenerateContent' ? '?alt=sse' : ''}&key=${key}`;

const openAIBase = (cfg: ProviderConfig): string => {
    const base = cfg.baseUrl || 'https://api.openai.com/v1';
    return base.endsWith('/v1') || /\/v\d+$/.test(base) ? base : `${base}/v1`;
};

/**
 * Non-streaming generate. Takes a Gemini request body (+ model), returns a
 * REAL Response whose .json() is Gemini-shaped. Throws on HTTP error (the
 * callers' model-ladder catch blocks handle it, same as fetch failures).
 */
export const providerGenerateContent = async (
    cfg: ProviderConfig,
    model: string,
    geminiBody: any,
    signal?: AbortSignal
): Promise<Response> => {
    if (cfg.provider === 'gemini') {
        const modelTag = model.includes('models/') ? model : `models/${model}`;
        return fetch(geminiUrl(modelTag, 'generateContent', cfg.apiKey), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal,
            body: JSON.stringify(geminiBody),
        });
    }
    const body = { ...geminiBodyToOpenAI(geminiBody), stream: false };
    delete (body as any).__stream;
    const res = await fetch(`${openAIBase(cfg)}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.apiKey}`,
        },
        signal,
        body: JSON.stringify(body),
    });
    if (!res.ok) await openAIError(res, 'Request');
    const data = await res.json();
    return new Response(JSON.stringify(openAIResponseToGemini(data)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
};

/**
 * Streaming generate (SSE). Takes a Gemini request body (+ model), returns a
 * REAL Response whose .body is an SSE stream of GEMINI-shaped chunks. The
 * existing stream readers (streamMessage / streamDraft) parse it unchanged.
 */
export const providerStreamGenerateContent = async (
    cfg: ProviderConfig,
    model: string,
    geminiBody: any,
    signal?: AbortSignal
): Promise<Response> => {
    if (cfg.provider === 'gemini') {
        const modelTag = model.includes('models/') ? model : `models/${model}`;
        return fetch(geminiUrl(modelTag, 'streamGenerateContent', cfg.apiKey), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal,
            body: JSON.stringify(geminiBody),
        });
    }
    const body = { ...geminiBodyToOpenAI({ ...geminiBody, __stream: true }), stream: true };
    const res = await fetch(`${openAIBase(cfg)}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.apiKey}`,
            Accept: 'text/event-stream',
        },
        signal,
        body: JSON.stringify(body),
    });
    if (!res.ok) await openAIError(res, 'Stream');
    return openAIStreamToGeminiSSE(res);
};

// ── Key health — provider-aware ───────────────────────────────────────────

export interface ProviderKeyHealth {
    status: 'valid' | 'invalid' | 'quota' | 'region' | 'unknown';
    note: string;
}

/**
 * Zero-cost provider probe (no generation tokens). Gemini: the free
 * models.list call (same probe as checkGeminiKeyHealth). OpenAI-compatible:
 * GET /models with the key. Classifies invalid / quota / region the same
 * way the R32 chip does.
 */
export const checkProviderKeyHealth = async (cfg: ProviderConfig): Promise<ProviderKeyHealth> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
        const res = cfg.provider === 'gemini'
            ? await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(cfg.apiKey)}`,
                { signal: controller.signal }
            )
            : await fetch(`${openAIBase(cfg)}/models`, {
                headers: { Authorization: `Bearer ${cfg.apiKey}` },
                signal: controller.signal,
            });
        if (res.ok) {
            return {
                status: 'valid',
                note: cfg.provider === 'gemini'
                    ? 'Key is active and accepted by Google.'
                    : 'Endpoint and key are active.',
            };
        }
        const bodyText = await res.text().catch(() => '');
        const l = bodyText.toLowerCase();
        if (res.status === 401 || res.status === 403) {
            return { status: 'invalid', note: 'The endpoint rejected this key (unauthorized).' };
        }
        if (res.status === 429) {
            return { status: 'quota', note: 'Quota or rate limit reached at the provider.' };
        }
        if (l.includes('location') || l.includes('region') || l.includes('country')) {
            return { status: 'region', note: 'The provider is not available from this region.' };
        }
        return { status: 'unknown', note: `Endpoint answered HTTP ${res.status}.` };
    } catch (e: any) {
        return {
            status: 'unknown',
            note: e?.name === 'AbortError'
                ? 'Probe timed out — the endpoint did not answer in 12s.'
                : 'Could not reach the endpoint.',
        };
    } finally {
        clearTimeout(timer);
    }
};
