
import { GoogleGenAI, Type } from "@google/genai";
import { Expense } from '../types';

const SYSTEM_PROMPT = `You are the Nigerian Tax Compliance Agent, an expert in Nigerian tax law. Your knowledge base includes the Companies Income Tax Act (CITA) and Personal Income Tax Act (PITA). Your mission is to analyze an expense description from a Nigerian law firm and determine if it is tax-deductible.

Analyze the user's input, which is an expense description. Based on the "Wholly, Exclusively, Necessarily, and Reasonably" (WENR) principle of deductibility in Nigerian tax law, decide if the expense is likely deductible.

Return your response ONLY in the specified JSON format.`;

/**
 * Analyzes an expense description to determine if it is likely tax-deductible
 * under Nigerian law by calling Gemini directly.
 * @param expense - The expense object to analyze.
 * @returns A promise that resolves to the tax analysis result.
 */
export const analyzeExpenseDeductibility = async (
  expense: Expense
): Promise<{ isDeductible: boolean; reason: string }> => {
  try {
    // FIX: Use shared utility for API key retrieval
    const { getGeminiApiKey } = await import('../utils/aiUtils');
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error("API Key missing");

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Expense Description: "${expense.description}"`,
      systemInstruction: SYSTEM_PROMPT,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isDeductible: { type: Type.BOOLEAN, description: 'Whether the expense is likely tax-deductible.' },
            reason: { type: Type.STRING, description: 'A brief justification for the decision, citing the WENR principle where applicable.' }
          },
          required: ['isDeductible', 'reason']
        },
      }
    } as any);

    const jsonString = response.text;
    const result = JSON.parse(jsonString || '{}');
    return result;

  } catch (error) {
    console.error("Failed to analyze expense for tax deductibility (client-side):", error);
    return {
      isDeductible: false,
      reason: 'AI analysis could not be completed.'
    };
  }
};

