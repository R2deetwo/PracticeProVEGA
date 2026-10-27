/**
 * aiProvider.test — A2 provider abstraction (the Google escape hatch).
 *
 * Pins the protocol adapter at the wire level:
 *  - resolveProvider: firm OpenAI-compatible settings activate the second
 *    door; everything else stays Gemini (zero-change default).
 *  - resolveModelLadder: Gemini keeps its tuned registries; OpenAI firms
 *    run their own ladder (chat flash-first, draft pro-first).
 *  - geminiBodyToOpenAI: system instruction → system message, roles,
 *    functionDeclarations → OpenAI tools, functionResponse → role:'tool'
 *    bound to the matching call id, generationConfig mapping, inline
 *    image parts → image_url content parts.
 *  - openAIResponseToGemini: text + tool_calls come back as Gemini-shaped
 *    candidates parts — the exact shape geminiService parses downstream.
 *  - openAIStreamToGeminiSSE: an OpenAI SSE stream (deltas, tool-argument
 *    fragments split across chunks) re-emits GEMINI-shaped SSE lines the
 *    streamMessage/streamDraft readers already understand.
 */
import { describe, it, expect } from 'vitest';
import {
    resolveProvider,
    resolveModelLadder,
    geminiBodyToOpenAI,
    openAIResponseToGemini,
    openAIStreamToGeminiSSE,
} from '../../src/services/aiProvider';
import type { AiSettings } from '../../src/types';

const GEMINI_SETTINGS: AiSettings = { firmGeminiApiKey: 'AIza-firm-key-0000000000000000000' };

const OPENAI_SETTINGS: AiSettings = {
    aiProvider: 'openai-compatible',
    openaiBaseUrl: 'https://openrouter.ai/api/v1',
    openaiModels: ['llama-3.3-70b-instruct', 'gpt-4o'],
    firmGeminiApiKey: 'sk-or-firm-key-000000000000000000000',
};

describe('A2 · resolveProvider — the second door, off by default', () => {
    it('defaults to Gemini when the firm has not chosen a provider', () => {
        const cfg = resolveProvider(GEMINI_SETTINGS, 'AIza-own-key');
        expect(cfg?.provider).toBe('gemini');
        expect(cfg?.apiKey).toBe('AIza-firm-key-0000000000000000000'); // firm key wins
    });

    it('falls back to the personal key on Gemini when no firm key exists', () => {
        const cfg = resolveProvider(undefined, 'AIza-own-key');
        expect(cfg?.provider).toBe('gemini');
        expect(cfg?.apiKey).toBe('AIza-own-key');
    });

    it('returns null with no key at all — the existing "no key" UX', () => {
        expect(resolveProvider(undefined, null)).toBeNull();
    });

    it('activates the OpenAI-compatible provider from firm settings', () => {
        const cfg = resolveProvider(OPENAI_SETTINGS, 'AIza-own-key');
        expect(cfg?.provider).toBe('openai-compatible');
        expect(cfg?.baseUrl).toBe('https://openrouter.ai/api/v1');
        expect(cfg?.apiKey).toBe('sk-or-firm-key-000000000000000000000'); // firm key required
        expect(cfg?.models).toEqual(['llama-3.3-70b-instruct', 'gpt-4o']);
    });

    it('refuses OpenAI-compatible without a base URL or firm key (misconfiguration)', () => {
        expect(resolveProvider({ ...OPENAI_SETTINGS, openaiBaseUrl: '' })).toBeNull();
        expect(resolveProvider({ ...OPENAI_SETTINGS, firmGeminiApiKey: '' })).toBeNull();
    });
});

describe('A2 · resolveModelLadder — tuned registries stay, firms own their ladder', () => {
    it('chat: preferred model first, then the Gemini fallback plan', () => {
        const cfg = resolveProvider(GEMINI_SETTINGS)!;
        const ladder = resolveModelLadder(cfg, 'chat', 'gemini-2.5-flash');
        expect(ladder[0]).toBe('gemini-2.5-flash');
        expect(ladder.length).toBeGreaterThan(1);
    });

    it('draft: the pro-first drafting plan', () => {
        const cfg = resolveProvider(GEMINI_SETTINGS)!;
        const ladder = resolveModelLadder(cfg, 'draft');
        expect(ladder[0]).toContain('pro'); // pro-first for precision drafting
    });

    it('openai-compatible: chat runs the firm ladder fast-first, draft pro-first', () => {
        const cfg = resolveProvider(OPENAI_SETTINGS)!;
        expect(resolveModelLadder(cfg, 'chat')).toEqual(['llama-3.3-70b-instruct', 'gpt-4o']);
        expect(resolveModelLadder(cfg, 'draft')).toEqual(['gpt-4o', 'llama-3.3-70b-instruct']);
        expect(resolveModelLadder(cfg, 'flash')[0]).toBe('llama-3.3-70b-instruct');
    });
});

describe('A2 · geminiBodyToOpenAI — request translation', () => {
    const body = {
        contents: [
            { role: 'user', parts: [{ text: 'Draft a motion for Adjournment' }] },
            { role: 'model', parts: [{ functionCall: { name: 'start_drafting', args: { docType: 'motion' } } }] },
            {
                role: 'user',
                parts: [{ functionResponse: { name: 'start_drafting', response: { ok: true } } }],
            },
            { role: 'user', parts: [{ text: 'Thanks — go ahead.' }] },
        ],
        systemInstruction: { parts: [{ text: 'You are ALOA.' }] },
        tools: [
            {
                functionDeclarations: [
                    {
                        name: 'start_drafting',
                        description: 'Begins a draft',
                        parameters: { type: 'object', properties: { docType: { type: 'string' } } },
                    },
                ],
            },
        ],
        generationConfig: { temperature: 0.45, topP: 0.1, topK: 40, maxOutputTokens: 32768 },
    };

    it('maps system instruction, roles and generation config', () => {
        const out = geminiBodyToOpenAI(body);
        expect(out.messages[0]).toEqual({ role: 'system', content: 'You are ALOA.' });
        expect(out.messages[1]).toEqual({ role: 'user', content: 'Draft a motion for Adjournment' });
        expect(out.temperature).toBe(0.45);
        expect(out.top_p).toBe(0.1);
        expect(out.max_tokens).toBe(32768);
        expect(out.topK).toBeUndefined(); // no OpenAI equivalent
    });

    it('converts functionDeclarations to OpenAI tools', () => {
        const out = geminiBodyToOpenAI(body);
        expect(out.tools).toEqual([
            {
                type: 'function',
                function: {
                    name: 'start_drafting',
                    description: 'Begins a draft',
                    parameters: { type: 'object', properties: { docType: { type: 'string' } } },
                },
            },
        ]);
    });

    it('carries the tool round-trip: call → assistant tool_calls, response → role:tool with the matching id', () => {
        const out = geminiBodyToOpenAI(body);
        const assistant = out.messages.find((m: any) => m.role === 'assistant' && m.tool_calls);
        expect(assistant.tool_calls[0].function.name).toBe('start_drafting');
        expect(JSON.parse(assistant.tool_calls[0].function.arguments)).toEqual({ docType: 'motion' });
        const tool = out.messages.find((m: any) => m.role === 'tool');
        expect(tool.tool_call_id).toBe(assistant.tool_calls[0].id); // bound by name
        expect(JSON.parse(tool.content)).toEqual({ ok: true });
        expect(out.messages.at(-1)).toEqual({ role: 'user', content: 'Thanks — go ahead.' });
    });

    it('translates inline image parts to image_url content parts', () => {
        const out = geminiBodyToOpenAI({
            contents: [
                {
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: 'image/png', data: 'QUJD' } },
                        { text: 'What is in this picture?' },
                    ],
                },
            ],
        });
        const user = out.messages[0];
        expect(Array.isArray(user.content)).toBe(true);
        expect(user.content[0]).toEqual({
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,QUJD' },
        });
        expect(user.content[1]).toEqual({ type: 'text', text: 'What is in this picture?' });
    });
});

describe('A2 · openAIResponseToGemini — response translation', () => {
    it('returns the exact shape geminiService parses', () => {
        const gemini = openAIResponseToGemini({
            choices: [
                {
                    message: {
                        content: 'Filed to its matter.',
                        tool_calls: [
                            { function: { name: 'navigate_to', arguments: '{"view":"matters"}' } },
                        ],
                    },
                    finish_reason: 'tool_calls',
                },
            ],
        });
        const parts = gemini.candidates[0].content.parts;
        expect(parts[0]).toEqual({ text: 'Filed to its matter.' });
        expect(parts[1].functionCall).toEqual({ name: 'navigate_to', args: { view: 'matters' } });
    });

    it('tolerates malformed tool arguments', () => {
        const gemini = openAIResponseToGemini({
            choices: [{ message: { content: null, tool_calls: [{ function: { name: 'x', arguments: '{oops' } }] } }],
        });
        expect(gemini.candidates[0].content.parts[0].functionCall.args).toEqual({ _raw: '{oops' });
    });
});

describe('A2 · openAIStreamToGeminiSSE — the stream reader stays untouched', () => {
    const sseOf = (events: any[]) =>
        new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n\n', {
            headers: { 'Content-Type': 'text/event-stream' },
        });

    const readAll = async (res: Response): Promise<string[]> => {
        const out: string[] = [];
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            out.push(...decoder.decode(value, { stream: true }).split('\n\n').filter(Boolean));
        }
        return out;
    };

    it('re-emits text deltas as Gemini-shaped SSE chunks', async () => {
        const translated = await openAIStreamToGeminiSSE(
            sseOf([
                { choices: [{ delta: { content: 'The ' } }] },
                { choices: [{ delta: { content: 'order is filed.' } }] },
            ])
        );
        const lines = await readAll(translated);
        expect(lines[0]).toBe('data: ' + JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: 'The ' }] } }] }));
        expect(lines[1]).toContain('"text":"order is filed."');
        expect(lines.at(-1)).toBe('data: [DONE]');
    });

    it('accumulates tool-call argument fragments and emits complete functionCall parts', async () => {
        const translated = await openAIStreamToGeminiSSE(
            sseOf([
                { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'start_drafting', arguments: '{"docType":' } } ] } }] },
                { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"motion"}' } }] } }] },
                { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
            ])
        );
        const lines = await readAll(translated);
        const fnLine = lines.find((l) => l.includes('functionCall'));
        expect(fnLine).toBeDefined();
        expect(JSON.parse(fnLine!.slice(6)).candidates[0].content.parts[0].functionCall).toEqual({
            name: 'start_drafting',
            args: { docType: 'motion' },
        });
    });
});
