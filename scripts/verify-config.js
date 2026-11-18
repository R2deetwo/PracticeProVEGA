// SECURITY (2026-11-18): this file used to carry a hardcoded API key. That
// key was committed to a PUBLIC repo, so Google's leaked-credential scanner
// found it and disabled it — breaking every AI feature with 403
// PERMISSION_DENIED "API key was reported as leaked". NEVER commit API keys.
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error("Set GEMINI_API_KEY in your environment first:");
    console.error("  GEMINI_API_KEY=your_key node scripts/verify-config.js");
    process.exit(1);
}

async function verifyConfig() {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const models = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'models/gemini-2.0-flash'
    ];

    for (const m of models) {
        try {
            console.log(`Testing ${m}...`);
            const res = await ai.models.generateContent({
                model: m,
                contents: [{ role: 'user', parts: [{ text: 'Hi' }] }]
            });
            console.log(`✅ ${m} OK`);
        } catch (e) {
            console.log(`❌ ${m} FAILED: ${e.message}`);
        }
    }
}

verifyConfig();
