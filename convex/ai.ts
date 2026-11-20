import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { resolveUserBySessionToken } from "./sessions";

/**
 * SECURE AI PROXY
 * This action proxies requests to Google Gemini, keeping the Demo API key securely
 * on the backend and preventing client-side scraping.
 *
 * ── ROUND QA (§3 API access): this action was PUBLIC — while it always kept
 *    the demo key server-side, ANY anonymous caller could spend that key's
 *    quota at unlimited rate through this endpoint. It now mirrors the
 *    /ai/stream httpAction gate (Round A H18): a valid bearer session is
 *    required, and each user is rate-limited (the model-ladder fallback path
 *    makes several calls per feature interaction, so the limit is generous
 *    but bounded).
 *
 * ── S2 (security spine, R2): FIRM KEYS NEVER ROUND-TRIP TO CLIENTS.
 *    Firm reads are redacted server-side (see myFunctions.getFirmData —
 *    clients see `aiSettings.firmGeminiKeySet`, never the material), so
 *    this action resolves the caller's FIRM key from the firms table
 *    ITSELF, after session auth. Priority: the caller's OWN key (the
 *    `firmGeminiApiKey` arg, kept for BYO-key clients — historically the
 *    field carried the firm key; clients no longer have it) → the caller's
 *    firm key (server-side) → the platform env key. And the Google call
 *    puts the key in the `x-goog-api-key` HEADER — never in a URL query
 *    string, where it would land in access logs and error trackers.
 */

/** INTERNAL: the caller's firm AI settings (server-side key custody, S2). */
export const getFirmAiSettingsInternal = internalQuery({
  args: { firmId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.firmId) return null;
    try {
      const firm: any = await ctx.db.get(args.firmId as any);
      if (!firm) return null;
      return {
        firmGeminiApiKey: (firm.aiSettings?.firmGeminiApiKey as string) || null,
        aiProvider: (firm.aiSettings?.aiProvider as string) || "gemini",
        openaiBaseUrl: (firm.aiSettings?.openaiBaseUrl as string) || null,
      };
    } catch {
      return null;
    }
  },
});

/**
 * INTERNAL: the operator/founder's stored Gemini key for ANONYMOUS surfaces
 * (the landing-page assistants ALOA/ARIA — owner bug report 2026-11-19:
 * "I even gave an API key as well so why is it still not working"). The
 * landing chat previously read ONLY the platform env key; the key the
 * founder set lives in Settings → AI Agent (firms.aiSettings), which the
 * anonymous endpoint could never see — every call returned 503 and the
 * panel silently regressed to the canned catalogue. This query walks the
 * firms table in creation order and returns the FIRST usable stored Gemini
 * key: in this founder-operated deployment the oldest firm IS the founder's
 * practice, so the key they configured is the key the website assistant
 * spends. Firms fully configured for a direct openai-compatible endpoint
 * are skipped — their key belongs to their own endpoint, not Google.
 * Server-side custody is unchanged: the key is never returned to any
 * client, only spent by convex/landingChat.ts behind its rate-limit fence.
 */
export const getOperatorGeminiKeyInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    try {
      // Table scan without an index returns documents in creation order —
      // the founder's firm is first. Bounded scan; deployments of this
      // scale have a handful of firms.
      const firms = await ctx.db.query("firms").take(200);
      for (const firm of firms) {
        const ai = (firm as any).aiSettings;
        const openaiFullyConfigured =
          ai?.aiProvider === "openai-compatible" &&
          !!(ai?.openaiBaseUrl || "").trim();
        if (openaiFullyConfigured) continue;
        const key = String(ai?.firmGeminiApiKey || "").trim();
        if (key) return { key };
      }
      return { key: null };
    } catch {
      return { key: null };
    }
  },
});

/**
 * Shared key resolution for every server-side AI surface (S2):
 * caller's own key → the caller's firm key (server-side) → platform env key.
 */
async function resolveEffectiveApiKey(
  ctx: any,
  user: { firmId?: string | null },
  callerSuppliedKey?: string | null
): Promise<{ apiKey: string | null; source: "caller" | "firm" | "env" }> {
  const own = (callerSuppliedKey || "").trim();
  if (own) return { apiKey: own, source: "caller" };

  if (user.firmId) {
    const firmAi: any = await ctx.runQuery(internal.ai.getFirmAiSettingsInternal, {
      firmId: String(user.firmId),
    });
    // 2026-11-18: mirror of the CLIENT resolver (aiProvider.ts
    // resolveProvider). The firm's stored key applies to GEMINI calls unless
    // the firm is FULLY configured for a direct openai-compatible endpoint
    // (key + baseUrl) — in that case the key belongs to their own endpoint,
    // not Google, and is not spent through this proxy. The old
    // `aiProvider === "gemini"` gate skipped firms that had a stored key but
    // no explicit provider selection, silently dropping them onto the
    // platform env key — the Quick Capture 403 asymmetry (2026-11-18).
    const openaiFullyConfigured =
      firmAi?.aiProvider === "openai-compatible" &&
      !!(firmAi?.openaiBaseUrl || "").trim();
    const firmKey = openaiFullyConfigured
      ? ""
      : (firmAi?.firmGeminiApiKey || "").trim();
    if (firmKey) return { apiKey: firmKey, source: "firm" };
  }

  const envKey = process.env.GEMINI_API_KEY || process.env.GEMINI_DEMO_KEY;
  return { apiKey: envKey || null, source: "env" };
}

/** Google request headers — the key rides in the header, never the URL (S2). */
const googleHeaders = (apiKey: string): Record<string, string> => ({
  "Content-Type": "application/json",
  "x-goog-api-key": apiKey,
});

export const generateContent = action({
  args: {
    contents: v.any(),
    systemInstruction: v.optional(v.any()),
    tools: v.optional(v.any()),
    generationConfig: v.optional(v.any()),
    // 2026-11-20 (ALOA empty-response fix): safety parity with the direct
    // path. The client's BLOCK_NONE thresholds now travel through the
    // action too — without them, substantive legal questions (divorce
    // petitions, family-law intake) hit Google's DEFAULT filters and came
    // back as EMPTY candidates (finishReason SAFETY / RECITATION), which
    // the chat rendered as "thinking ended, no response".
    safetySettings: v.optional(v.any()),
    modelName: v.string(),
    /** DEPRECATED AS A FIRM-KEY CHANNEL (S2): now carries only the caller's
     *  OWN BYO key when present. Firm keys resolve server-side above. */
    firmGeminiApiKey: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // ── Auth: possession of a live session, never caller-supplied identity.
    const user = args.sessionToken
      ? await resolveUserBySessionToken(ctx, args.sessionToken)
      : null;
    if (!user) {
      throw new Error(
        "Unauthorized: a valid session is required to use the AI proxy."
      );
    }

    // ── Per-user throttle: 30 generations/min. Generous for the model
    //    ladder (≤6 calls per feature interaction) but bounded against
    //    scripted abuse of the platform key.
    const allowed = await ctx.runMutation(
      internal.securityHelpers.consumeRateLimit,
      { key: `ai_generate:${user._id}`, maxRequests: 30 }
    );
    if (!allowed) {
      throw new Error("Rate limit exceeded. Please wait a moment and try again.");
    }

    // ── Coarse payload cap (6 MB): the vision path legitimately posts
    //    base64 images, so this is deliberately generous — but a bound
    //    exists, where none did before.
    const payload = JSON.stringify(args.contents ?? null);
    if (payload.length > 6_000_000) {
      throw new Error("Payload too large for the AI proxy.");
    }

    // S2: caller's own key → firm key (server-side) → env key.
    const { apiKey } = await resolveEffectiveApiKey(ctx, user, args.firmGeminiApiKey);
    if (!apiKey) {
      throw new ConvexError("AI is not configured yet — the platform AI key is being set up. Please try again shortly.");
    }

    const modelName = args.modelName;
    const modelTag = modelName.includes('models/') ? modelName : `models/${modelName}`;
    // S2: NO key in the URL — x-goog-api-key header.
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelTag}:generateContent`;

    const body: any = {
        contents: args.contents,
    };

    if (args.systemInstruction) body.systemInstruction = args.systemInstruction;
    if (args.tools) body.tools = args.tools;
    if (args.generationConfig) body.generationConfig = args.generationConfig;
    // Safety parity with the direct path — see the args comment above.
    body.safetySettings = Array.isArray(args.safetySettings) && args.safetySettings.length
        ? args.safetySettings
        : [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
          ];

    const response = await fetch(url, {
      method: "POST",
      headers: googleHeaders(apiKey),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
       const errorData = await response.json().catch(() => ({}));
       const status = response.status;
       const msg = String(errorData.error?.message || response.statusText || "");
       const t = msg.toLowerCase();
       // 2026-11-18: Google disables keys committed to public repos
       // ("reported as leaked"). Surface a clean, actionable message via
       // ConvexError — plain Error crosses the boundary as
       // "[Request ID …] Uncaught Error …", which users saw and feared.
       if (status === 401 || status === 403 || t.includes("leaked") || t.includes("permission_denied") || t.includes("api key")) {
         throw new ConvexError("AI is temporarily unavailable — the platform's AI key needs to be rotated. Please try again once it's updated.");
       }
       if (status === 429) {
         throw new ConvexError("The AI service is rate-limited right now. Please wait a moment and try again.");
       }
       if (status >= 500) {
         throw new ConvexError("The AI service had a temporary problem. Please try again in a moment.");
       }
       throw new ConvexError(`AI request failed: ${msg.slice(0, 160)}`);
    }

    // Process and return exactly what the client expects from the raw API
    const data = await response.json();
    return data;
  }
});

/**
 * S2/R1: server-side EMBEDDINGS — the Legal Index builder ("Build Legal
 * Index") and the Brain previously required the OPERATOR's personal Gemini
 * key client-side (the firm key was never wired into embeddings, and after
 * redaction it cannot be). This action embeds text with the same key
 * resolution as generateContent (firm key → env key), so indexing works
 * with NO client-side key material at all. Model is pinned to the
 * platform embedding model so vectors stay dimension-compatible
 * (text-embedding-004, 768-dim — see AI_CONFIG.embeddingModel).
 */
export const embedContent = action({
  args: {
    text: v.string(),
    sessionToken: v.optional(v.string()),
    firmGeminiApiKey: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = args.sessionToken
      ? await resolveUserBySessionToken(ctx, args.sessionToken)
      : null;
    if (!user) {
      throw new Error("Unauthorized: a valid session is required to embed content.");
    }
    if (args.text.length > 100_000) {
      throw new Error("Text too large for embedding (100 KB limit).");
    }

    const allowed = await ctx.runMutation(
      internal.securityHelpers.consumeRateLimit,
      { key: `ai_embed:${user._id}`, maxRequests: 120 }
    );
    if (!allowed) {
      throw new Error("Rate limit exceeded. Please wait a moment and try again.");
    }

    const { apiKey } = await resolveEffectiveApiKey(ctx, user, args.firmGeminiApiKey);
    if (!apiKey) {
      throw new ConvexError("AI is not configured yet — the platform AI key is being set up. Please try again shortly.");
    }

    const model = args.model || "text-embedding-004";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`,
      {
        method: "POST",
        headers: googleHeaders(apiKey),
        body: JSON.stringify({ model, content: { parts: [{ text: args.text }] } }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = String(errorData.error?.message || response.statusText || "");
      const t = msg.toLowerCase();
      if (response.status === 401 || response.status === 403 || t.includes("leaked") || t.includes("permission_denied") || t.includes("api key")) {
        throw new ConvexError("AI is temporarily unavailable — the platform's AI key needs to be rotated. Please try again once it's updated.");
      }
      throw new ConvexError(`Embedding failed: ${msg.slice(0, 160)}`);
    }

    const data: any = await response.json();
    return { embedding: data?.embedding?.values ?? [] };
  }
});

/**
 * ROUND D (D8) — DELETION RECORD (Wave 3b, R81, 2026-11-10).
 *
 * extractContactInfo removed: an UNGATED public AI action (bare text arg, no session) — unauthenticated AI spend. Zero product callers.
 */
