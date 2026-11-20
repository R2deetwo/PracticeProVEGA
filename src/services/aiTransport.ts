/**
 * aiTransport — S2 (security spine): ONE place where Gemini HTTP calls are made.
 *
 * THE RULES (Round S2, "keys out of URLs / firm keys never round-trip"):
 *   1. NO Gemini API key EVER appears in a URL query string (`?key=...`).
 *      Keys travel in the `x-goog-api-key` request header over TLS. Query
 *      strings leak into browser devtools, network proxies, server access
 *      logs and error trackers; headers do not.
 *   2. The FIRM's Gemini key never reaches this (or any) client: firm reads
 *      are redacted server-side (`firmGeminiKeySet` flag), so when a firm
 *      key is active the client carries NO key material at all and every
 *      call routes through the authenticated platform proxy
 *      (`api.ai.generateContent` / the `/ai/stream` HTTP route), which
 *      resolves the firm's key server-side.
 *   3. The USER'S OWN key (BYO, in-memory since B2) may be used for direct
 *      calls — header-based, their key, their quota.
 *
 * Every direct-Gemini call site in the app goes through one of the helpers
 * below so the invariant is enforced once, not copy-pasted.
 */

const CONVEX_URL = (import.meta.env.VITE_CONVEX_URL as string) || "https://gregarious-malamute-537.convex.cloud";

/** HTTP actions are served on the .convex.site URL — .convex.cloud serves
 *  only the client API. /ai/stream on .convex.cloud 404s (verified live
 *  2026-11-18). Same pattern as geminiService.ts. */
const CONVEX_HTTP_URL = CONVEX_URL.replace('.convex.cloud', '.convex.site');

/** Session bearer — same read helper geminiService has always used; never stored, never logged. */
export const readSessionBearer = (): string | undefined =>
    (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('practicepro_session_bearer'))
    || (typeof localStorage !== 'undefined' && localStorage.getItem('practicepro_session_bearer'))
    || undefined;

/** Gemini request headers with the key in the HEADER, never the URL (S2). */
export const geminiHeaders = (apiKey: string): Record<string, string> => ({
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
});

/** Gemini endpoint URL WITHOUT any key material. */
export const geminiUrl = (modelTag: string, method: 'generateContent' | 'streamGenerateContent' | 'embedContent'): string =>
    `https://generativelanguage.googleapis.com/v1beta/${modelTag}:${method}${method === 'streamGenerateContent' ? '?alt=sse' : ''}`;

/**
 * Direct (BYO-key) Gemini call — header-based.
 * Returns a real Response; callers keep their existing .ok/.json()/.body handling.
 */
export const directGemini = (
    apiKey: string,
    modelTag: string,
    method: 'generateContent' | 'streamGenerateContent' | 'embedContent',
    body: unknown,
    signal?: AbortSignal
): Promise<Response> =>
    fetch(geminiUrl(modelTag, method), {
        method: 'POST',
        headers: geminiHeaders(apiKey),
        signal,
        body: JSON.stringify(body),
    });

/** Zero-cost key probe (models.list) with the key in the header (S2). */
export const directGeminiKeyProbe = (apiKey: string, signal?: AbortSignal): Promise<Response> =>
    fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
        headers: { 'x-goog-api-key': apiKey },
        signal,
    });

/**
 * Server-proxy NON-streaming generate (firm-key mode — no client key material).
 * Wraps the `api.ai.generateContent` Convex action result in a real Response
 * so providerGenerateContent's contract (`.ok` / `.json()`) is preserved.
 * HTTP-shaped errors are synthesized so the caller's model-ladder catch
 * treats them exactly like a direct-call failure.
 */
export const serverProxyGenerate = async (
    modelTag: string,
    body: unknown,
    signal?: AbortSignal
): Promise<Response> => {
    // Imported lazily to keep this module free of top-level convex coupling
    // (aiUtils/aiProvider/geminiService all import this file).
    const { ConvexHttpClient } = await import('convex/browser');
    const { api } = await import('../../convex/_generated/api');
    const client = new ConvexHttpClient(CONVEX_URL);
    try {
        const payload = body as { contents?: unknown; systemInstruction?: unknown; tools?: unknown; generationConfig?: unknown };
        const data = await client.action(api.ai.generateContent, {
            modelName: modelTag,
            contents: payload.contents,
            systemInstruction: payload.systemInstruction,
            tools: payload.tools,
            generationConfig: payload.generationConfig,
            // NOTE: no apiKey of any kind — the action resolves the firm key
            // (server-side) or the platform env key after session auth.
            sessionToken: readSessionBearer(),
        });
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: { message: e?.message || 'Proxy request failed', code: 502 } }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

/**
 * Server-proxy STREAMING generate (firm-key mode) — the authenticated
 * `/ai/stream` HTTP route on the Convex deployment. SSE pass-through: the
 * existing stream readers parse the response unchanged. The session bearer
 * rides in the `x-session-token` header (the route's documented auth gate);
 * no API key is present anywhere.
 */
export const serverProxyStream = async (
    modelTag: string,
    body: unknown,
    signal?: AbortSignal
): Promise<Response> => {
    const payload = body as {
        contents?: unknown;
        systemInstruction?: { parts: { text: string }[] };
        // 2026-11-20 (owner: "ALOA still fails to deliver the response after
        // thinking"): the proxy body used to carry ONLY contents +
        // systemInstruction — tools, generationConfig and safetySettings were
        // STRIPPED. Substantive legal questions then ran with Google's
        // DEFAULT safety thresholds (the direct path sends BLOCK_NONE), so
        // family-law / divorce intake questions were blocked or recitation-
        // filtered into EMPTY candidates — the model "finished thinking"
        // with no text and the chat showed nothing. All three fields now
        // travel with the request; the /ai/stream route forwards them.
        tools?: unknown;
        generationConfig?: unknown;
        safetySettings?: unknown;
    };
    const bearer = readSessionBearer();
    if (!bearer) {
        return new Response(JSON.stringify({ error: { message: 'No session — sign in to use the firm AI proxy.', code: 401 } }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    return fetch(`${CONVEX_HTTP_URL}/ai/stream`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-session-token': bearer,
        },
        signal,
        body: JSON.stringify({
            model: modelTag,
            contents: payload.contents,
            systemInstruction: payload.systemInstruction?.parts?.[0]?.text,
            ...(payload.tools ? { tools: payload.tools } : {}),
            ...(payload.generationConfig ? { generationConfig: payload.generationConfig } : {}),
            ...(payload.safetySettings ? { safetySettings: payload.safetySettings } : {}),
        }),
    });
};

export { CONVEX_URL };
