import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { resolveUserBySessionToken } from "./sessions";

/**
 * SECURE AI PROXY
 * This action proxies requests to Google Gemini, keeping the Demo API key securely
 * on the backend and preventing client-side scraping.
 *
 * ── ROUND QA (§3 API access): this action was PUBLIC — while it always kept
 * the demo key server-side, ANY anonymous caller could spend that key's
 * quota at unlimited rate through this endpoint. It now mirrors the
 * /ai/stream httpAction gate (Round A H18): a valid bearer session is
 * required, and each user is rate-limited (the model-ladder fallback path
 * makes several calls per feature interaction, so the limit is generous
 * but bounded).
 */
export const generateContent = action({
  args: {
    contents: v.any(),
    systemInstruction: v.optional(v.any()),
    tools: v.optional(v.any()),
    generationConfig: v.optional(v.any()),
    modelName: v.string(),
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

    // The demo key must be set as an environment variable (GEMINI_API_KEY or GEMINI_DEMO_KEY)
    // in the Convex dashboard. Hardcoded fallbacks are removed for security.
    
    // Check for environment variable first (Convex Dashboard) -> Firm Key -> Demo Key
    const envKey = process.env.GEMINI_API_KEY || process.env.GEMINI_DEMO_KEY;
    const apiKey = args.firmGeminiApiKey || envKey;

    if (!apiKey) {
      throw new Error("No API key available. Please configure the firm's AI key in Settings.");
    }

    const modelName = args.modelName;
    const modelTag = modelName.includes('models/') ? modelName : `models/${modelName}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelTag}:generateContent?key=${apiKey}`;

    const body: any = {
        contents: args.contents,
    };
    
    if (args.systemInstruction) body.systemInstruction = args.systemInstruction;
    if (args.tools) body.tools = args.tools;
    if (args.generationConfig) body.generationConfig = args.generationConfig;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
       const errorData = await response.json().catch(() => ({}));
       throw new Error(`AI Request Failed: ${errorData.error?.message || response.statusText}`);
    }
    
    // Process and return exactly what the client expects from the raw API
    const data = await response.json();
    return data;
  }
});

/**
 * ROUND D (D8) — DELETION RECORD (Wave 3b, R81, 2026-11-10).
 *
 * extractContactInfo removed: an UNGATED public AI action (bare text arg, no session) — unauthenticated AI spend. Zero product callers.
 */
