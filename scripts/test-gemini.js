// Test script to diagnose Gemini API issues
import { GoogleGenAI } from "@google/genai";

const API_KEY = "AIzaSyAHRNaN-z9DPm4wyNdvt2TQlBpTHHDyBkw";

async function testGeminiModels() {
    console.log("🔍 Testing Gemini API Models...\n");

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const modelsToTest = [
        'gemini-1.5-flash-002',
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro-002',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-2.0-flash-exp',
        'models/gemini-1.5-flash',
        'models/gemini-1.5-flash-002',
    ];

    for (const modelName of modelsToTest) {
        try {
            console.log(`Testing: ${modelName}...`);
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [{ role: 'user', parts: [{ text: 'Say "Hello"' }] }]
            });

            console.log(`✅ SUCCESS: ${modelName}`);
            console.log(`   Response: ${response.text}\n`);

        } catch (error) {
            console.log(`❌ FAILED: ${modelName}`);
            console.log(`   Error: ${error.message}`);
            console.log(`   Full Error:`, JSON.stringify(error, null, 2));
            console.log('');
        }
    }
}

testGeminiModels().catch(console.error);
