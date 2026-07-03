
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey } from '../utils/aiUtils';

import { ALOA_PRECISION_PROTOCOL } from '../constants/aloaPrompts';

export const rewriteText = async (
    text: string,
    instruction: string
): Promise<string> => {
    try {
        const apiKey = getGeminiApiKey();
        if (!apiKey) throw new Error("API Key missing");

        const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });

        const systemInstruction = `
            ${ALOA_PRECISION_PROTOCOL}
            
            You are an expert legal editor. Your goal is to rewrite the provided text following specific instructions while maintaining extreme precision and the ARIA professional standard.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            systemInstruction,
            contents: `
Original Text:
"${text}"

Instruction: ${instruction}

Please rewrite the text following the instruction. Maintain legal precision. Do not include conversational filler, just the rewritten text.`
        } as any);

        return response.text || text;
    } catch (error) {
        console.error("Drafting Agent Error:", error);
        throw error;
    }
};

