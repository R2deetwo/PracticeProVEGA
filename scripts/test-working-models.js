// Test with actual available models
import { GoogleGenAI } from "@google/genai";

const API_KEY = "AIzaSyAHRNaN-z9DPm4wyNdvt2TQlBpTHHDyBkw";

async function testWorkingModels() {
    console.log("🔍 Testing WORKING Gemini models...\n");

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    // Based on the list output, these models should work:
    const modelsToTest = [
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-2.0-flash',
        'gemini-2.0-flash-001',
        'gemini-2.0-flash-lite',
        'gemini-2.0-flash-lite-001',
    ];

    for (const modelName of modelsToTest) {
        try {
            console.log(`Testing: ${modelName}...`);
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [{ role: 'user', parts: [{ text: 'Say "Hello from ALOA"' }] }]
            });

            console.log(`✅ SUCCESS: ${modelName}`);
            console.log(`   Response: ${response.text}`);
            console.log('');

        } catch (error) {
            console.log(`❌ FAILED: ${modelName}`);
            console.log(`   Error: ${error.message}`);
            console.log('');
        }
    }
}

testWorkingModels().catch(console.error);
