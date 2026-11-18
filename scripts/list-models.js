// List all available Gemini models
//
// SECURITY (2026-11-18): this file used to carry a hardcoded API key. That
// key was committed to a PUBLIC repo, so Google's leaked-credential scanner
// found it and disabled it — breaking every AI feature (ALOA, transcription,
// Quick Ask) with 403 PERMISSION_DENIED "API key was reported as leaked".
// NEVER commit API keys. Keys live ONLY in Convex env vars / GitHub secrets.
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error("Set GEMINI_API_KEY in your environment first:");
    console.error("  GEMINI_API_KEY=your_key node scripts/list-models.js");
    process.exit(1);
}

async function listAvailableModels() {
    console.log("🔍 Listing all available Gemini models...\n");

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    try {
        const models = await ai.models.list();

        console.log("✅ Available Models:");
        console.log(JSON.stringify(models, null, 2));

        console.log("\n📋 Model Names:");
        if (models && Array.isArray(models)) {
            models.forEach(model => {
                console.log(`  - ${model.name || model}`);
            });
        }

    } catch (error) {
        console.log("❌ Error listing models:");
        console.log(error);
    }
}

listAvailableModels().catch(console.error);
