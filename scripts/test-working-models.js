// Test which Gemini models work with a given key.
// Usage: GEMINI_API_KEY=your_key node scripts/test-working-models.js
// (The key is read from the environment — never hardcode it here. The key
// that used to live in this file was auto-revoked by Google's leak
// detection because it was committed to the repo. Standard P6: secrets
// never live in the repo.)
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error("Set GEMINI_API_KEY in the environment first.");
    process.exit(1);
}

async function testWorkingModels() {
    console.log("Testing live Gemini models...\n");

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    // Current tiers (2026-10): 2.5 quality tier, 2.0 wide-availability
    // tier. gemini-1.5-* is RETIRED by Google — removed from this list.
    const modelsToTest = [
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-flash-latest',
    ];

    for (const modelName of modelsToTest) {
        try {
            console.log(`Testing: ${modelName}...`);
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [{ role: 'user', parts: [{ text: 'Say "Hello from ALOA"' }] }]
            });

            console.log(`SUCCESS: ${modelName}`);
            console.log(`   Response: ${response.text}`);
            console.log('');
        } catch (error) {
            console.log(`FAILED: ${modelName}`);
            console.log(`   Error: ${error.message}`);
            console.log('');
        }
    }
}

testWorkingModels().catch(console.error);
