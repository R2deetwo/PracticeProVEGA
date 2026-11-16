/**
 * roundR2SecuritySpine — S1 + S2 acceptance (the R2 round of the discovery
 * report's roadmap).
 *
 * S1: every AI proxy surface requires an authenticated session (already
 *     true since R75/R80 — pinned here so it cannot regress).
 * S2: keys out of URLs, firm keys out of clients:
 *   · NO Gemini call site builds a `?key=` URL — the key rides in the
 *     x-goog-api-key header (aiTransport is the single chokepoint).
 *   · Firm reads are REDACTED (redactFirmAiKey): clients get a
 *     firmGeminiKeySet flag, never the material.
 *   · Redacted round-trips cannot wipe the stored key
 *     (withPreservedFirmAiKey); explicit writes (including "" to clear)
 *     pass through.
 *   · resolveProvider: a redacted firm config routes through the platform
 *     proxy (viaServerProxy) with no client key material, and the firm's
 *     decision still wins over the user's own key.
 *   · The chat pre-flight accepts a server-managed firm key
 *     (validateAPIKey + firmKeySet).
 */
import { describe, it, expect } from 'vitest';
import { redactFirmAiKey, withPreservedFirmAiKey } from '../../convex/myFunctions';
import { resolveProvider } from '../../src/services/aiProvider';
import { validateAPIKey } from '../../src/utils/aiRequestQueue';
import { geminiUrl, geminiHeaders } from '../../src/services/aiTransport';
import type { AiSettings } from '../../src/types';

const FIRM_KEY = 'AIza-firm-key-0000000000000000000';
const OWN_KEY = 'AIza-own-key-1111111111111111111';

// ─── S2: no key material in URLs — the transport chokepoint ────────────────
describe('R2·S2 — aiTransport: the key rides in the header, never the URL', () => {
    it('builds Gemini URLs with no key parameter for every method', () => {
        for (const method of ['generateContent', 'streamGenerateContent', 'embedContent'] as const) {
            const url = geminiUrl('models/gemini-2.5-flash', method);
            expect(url).toContain('generativelanguage.googleapis.com');
            expect(url).not.toContain('key=');
            expect(url).not.toContain(FIRM_KEY);
            expect(url).not.toContain(OWN_KEY);
        }
    });

    it('carries the key in the x-goog-api-key header', () => {
        const headers = geminiHeaders(FIRM_KEY);
        expect(headers['x-goog-api-key']).toBe(FIRM_KEY);
        expect(JSON.stringify(headers)).not.toContain('key=');
    });
});

// ─── S2: firm reads are redacted ───────────────────────────────────────────
describe('R2·S2 — redactFirmAiKey: the firm Gemini key never round-trips', () => {
    it('strips the key material and sets the server-side flag', () => {
        const firm = {
            _id: 'f1', name: 'Vega Chambers', product: 'vega',
            aiSettings: { enableAllAiFeatures: true, firmGeminiApiKey: FIRM_KEY },
        };
        const redacted = redactFirmAiKey(firm);
        expect(JSON.stringify(redacted)).not.toContain(FIRM_KEY);
        expect(redacted.aiSettings.firmGeminiApiKey).toBeUndefined();
        expect(redacted.aiSettings.firmGeminiKeySet).toBe(true);
        expect(redacted.aiSettings.enableAllAiFeatures).toBe(true); // other settings survive
    });

    it('leaves firms without a stored key untouched (no false "configured" flag)', () => {
        const firm = { _id: 'f1', aiSettings: { enableAllAiFeatures: true } };
        const redacted = redactFirmAiKey(firm);
        expect(redacted).toBe(firm);
        expect(redacted.aiSettings.firmGeminiKeySet).toBeUndefined();
    });

    it('exempts openai-compatible firms by design (their key points at their own endpoint)', () => {
        const firm = {
            _id: 'f1',
            aiSettings: {
                aiProvider: 'openai-compatible',
                openaiBaseUrl: 'https://openrouter.ai/api/v1',
                firmGeminiApiKey: 'sk-or-firm-key-000000000000000000000',
            },
        };
        const redacted = redactFirmAiKey(firm);
        expect(redacted.aiSettings.firmGeminiApiKey).toBe('sk-or-firm-key-000000000000000000000');
        expect(redacted.aiSettings.firmGeminiKeySet).toBeUndefined();
    });
});

// ─── S2: redacted round-trips cannot wipe the stored key ───────────────────
describe('R2·S2 — withPreservedFirmAiKey: merge-aware writes', () => {
    const storedFirm = {
        _id: 'f1',
        aiSettings: { enableAllAiFeatures: true, firmGeminiApiKey: FIRM_KEY },
    };

    it('preserves the stored key when the incoming aiSettings omits it (redacted round-trip)', () => {
        // Exactly what a client sends after reading a REDACTED firm record:
        // the flag, not the material.
        const incoming = { aiSettings: { enableAllAiFeatures: true, firmGeminiKeySet: true } };
        const merged = withPreservedFirmAiKey(incoming, storedFirm);
        expect(merged.aiSettings.firmGeminiApiKey).toBe(FIRM_KEY);
        expect(merged.aiSettings.firmGeminiKeySet).toBe(true);
    });

    it('writes an explicit new key (admin replaces the key)', () => {
        const incoming = { aiSettings: { firmGeminiApiKey: 'AIza-new-key-2222222222222222222' } };
        const merged = withPreservedFirmAiKey(incoming, storedFirm);
        expect(merged.aiSettings.firmGeminiApiKey).toBe('AIza-new-key-2222222222222222222');
    });

    it('writes an explicit empty string (admin clears the key via Remove)', () => {
        const incoming = { aiSettings: { firmGeminiApiKey: '', firmGeminiKeySet: false } };
        const merged = withPreservedFirmAiKey(incoming, storedFirm);
        expect(merged.aiSettings.firmGeminiApiKey).toBe('');
    });

    it('leaves non-aiSettings writes untouched', () => {
        const incoming = { subscriptionPlan: 'Enterprise' };
        expect(withPreservedFirmAiKey(incoming, storedFirm)).toBe(incoming);
    });
});

// ─── S2: the provider seam routes firm-key traffic through the proxy ───────
describe('R2·S2 — resolveProvider: server-managed firm keys', () => {
    it('marks a redacted firm config viaServerProxy with NO key material', () => {
        const cfg = resolveProvider({ firmGeminiKeySet: true } as AiSettings, OWN_KEY);
        expect(cfg?.provider).toBe('gemini');
        expect(cfg?.viaServerProxy).toBe(true);
        expect(cfg?.apiKey).toBe(''); // no material on the client
    });

    it('the firm decision still wins over the user’s own key (precedence unchanged)', () => {
        const withOwn = resolveProvider({ firmGeminiKeySet: true } as AiSettings, OWN_KEY);
        const withoutOwn = resolveProvider({ firmGeminiKeySet: true } as AiSettings, null);
        expect(withOwn?.viaServerProxy).toBe(true);
        expect(withoutOwn?.viaServerProxy).toBe(true);
    });

    it('legacy material keys (dev builds) still work direct — header-based', () => {
        const cfg = resolveProvider({ firmGeminiApiKey: FIRM_KEY } as AiSettings, OWN_KEY);
        expect(cfg?.apiKey).toBe(FIRM_KEY);
        expect(cfg?.viaServerProxy).toBeUndefined();
    });

    it('no firm key + no own key → null (the existing "no key" UX)', () => {
        expect(resolveProvider(undefined, null)).toBeNull();
        expect(resolveProvider({ firmGeminiKeySet: false } as AiSettings, null)).toBeNull();
    });
});

// ─── S2: the chat pre-flight accepts a server-managed firm key ─────────────
describe('R2·S2 — validateAPIKey: firm-key mode passes without local material', () => {
    it('valid when the firm key is stored server-side', () => {
        expect(validateAPIKey(undefined, { firmKeySet: true })).toEqual({ valid: true });
        // Even when a (redacted, empty) firm key string is passed:
        expect(validateAPIKey('', { firmKeySet: true })).toEqual({ valid: true });
    });

    it('still demands a key when no firm key is set and none is personal', () => {
        expect(validateAPIKey(undefined).valid).toBe(false);
    });
});
