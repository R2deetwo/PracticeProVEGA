import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * SECURE AI PROXY
 * This action proxies requests to Google Gemini, keeping the Demo API key securely
 * on the backend and preventing client-side scraping.
 */
export const generateContent = action({
  args: {
    contents: v.any(),
    systemInstruction: v.optional(v.any()),
    tools: v.optional(v.any()),
    generationConfig: v.optional(v.any()),
    modelName: v.string(),
    firmGeminiApiKey: v.optional(v.string())
  },
  handler: async (ctx, args) => {
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

export const extractContactInfo = action({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    const prompt = `
Extract contact information from the following text. Return ONLY a JSON object with these fields (set to null if not found):
{
  "name": "Full name",
  "email": "Email address",
  "phone": "Phone number",
  "address": "Physical address"
}

Text to analyze:
${args.text}
`.trim();

    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_DEMO_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured in backend environment.");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    if (!response.ok) throw new Error("AI Extraction Failed");
    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;
    return JSON.parse(content);
  }
});
