import { GoogleGenAI } from "@google/genai";

const API_KEY = "AIzaSyAHRNaN-z9DPm4wyNdvt2TQlBpTHHDyBkw";

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
