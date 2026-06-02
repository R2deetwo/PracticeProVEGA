// List all available Gemini models
import { GoogleGenAI } from "@google/genai";

const API_KEY = "AIzaSyAHRNaN-z9DPm4wyNdvt2TQlBpTHHDyBkw";

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
