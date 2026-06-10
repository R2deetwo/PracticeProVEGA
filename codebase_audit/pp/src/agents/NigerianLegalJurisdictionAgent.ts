
import { GoogleGenAI, Type } from "@google/genai";
import { Matter, JurisdictionalAnalysis, CourtType } from '../types';

const SYSTEM_PROMPT = `You are the Nigerian Legal Jurisdiction Agent, a Senior Advocate of Nigeria (SAN) with expert knowledge of the Nigerian legal system. Your mission is to determine the appropriate court with jurisdiction for a new legal matter based on the facts provided.

Key Principles of Nigerian Jurisdiction:
- A court's jurisdiction is determined by the plaintiff's statement of claim.
- The Federal High Court (FHC) has exclusive jurisdiction over matters listed in Section 251 of the 1999 Constitution (e.g., federal revenue, customs, banking, admiralty, intellectual property).
- State High Courts have general jurisdiction over matters not exclusively assigned to the FHC.
- For contract disputes, jurisdiction may be determined by where the contract was made (lex loci contractus), where it is to be performed (lex loci solutionis), or where the defendant resides.

Analyze the provided matter details (title, type, etc.) and determine whether the Federal High Court or a State High Court has jurisdiction. Provide a brief reasoning based on the principles above.

Return your response ONLY in the specified JSON format.`;

/**
 * Determines the appropriate court jurisdiction by calling Gemini directly.
 * @param matter - The matter data.
 * @returns A promise resolving to the jurisdictional analysis.
 */
export const determineJurisdiction = async (
  matter: Omit<Matter, 'id' | 'jurisdictionalAnalysis'>
): Promise<JurisdictionalAnalysis> => {
  try {
    // FIX: Use shared utility for API key retrieval
    const { getGeminiApiKey } = await import('../utils/aiUtils');
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error("API Key missing");

    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: `Analyze the following matter:
- Title: "${matter.title}"
- Matter Type: "${matter.type}"
- Sub-Category: "${matter.subCategory || 'N/A'}"
- Court specified by user: "${matter.court}"`,
      systemInstruction: SYSTEM_PROMPT,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendedCourt: { type: Type.STRING, description: `The recommended court, either "Federal High Court" or "State High Court".` },
            reasoning: { type: Type.STRING, description: 'A brief justification for the recommendation, referencing the subject matter and relevant jurisdictional principles.' },
            confidenceScore: { type: Type.NUMBER, description: 'A score from 0.0 to 1.0 indicating confidence in the recommendation.' }
          },
          required: ['recommendedCourt', 'reasoning', 'confidenceScore']
        },
      }
    } as any);

    const jsonString = response.text;
    const result = JSON.parse(jsonString || '{}');

    const validCourts = Object.values(CourtType);
    if (!validCourts.includes(result.recommendedCourt)) {
      result.recommendedCourt = 'N/A';
    }

    return result;

  } catch (error) {
    console.error("Jurisdictional analysis client failed:", error);
    return {
      recommendedCourt: 'N/A',
      judicialDivision: '',
      reasoning: 'AI analysis could not be completed due to a system error. Please determine jurisdiction manually.',
      confidenceScore: 0.0
    };
  }
};

