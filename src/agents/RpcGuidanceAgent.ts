
import { GoogleGenAI, Type } from "@google/genai";

export interface RpcReviewResult {
  status: 'approved' | 'warning';
  commentary: string;
}

const SYSTEM_PROMPT = `You are the Rules of Professional Conduct (RPC) Guidance Agent, an expert in legal ethics and AI. Your mission is to review AI-generated content for potential ethical issues.

You will be given a document title and an AI-generated summary of that document. Your task is to analyze the summary based on the following principles:
1.  **Accuracy & Candor:** Does the summary's language sound overly confident, definitive, or like final legal advice? It should be presented as a summary, not a conclusion.
2.  **Avoiding Hallucinations:** Does the summary contain specific facts or legal assertions that might be plausible but are not verifiable without the source document? Flag language that seems overly specific or assertive.
3.  **Client Communication (Rule 1.4):** Is the summary clear and unlikely to mislead a client if shared? It should be neutral and objective.
4.  **Supervision (Rules 5.1 & 5.3):** The final commentary must remind the lawyer of their duty to independently verify all AI-generated content before use.

Based on your analysis, determine a status ('approved' or 'warning') and provide a brief commentary.
- Use 'warning' if you find any potential issues with tone, overconfidence, or potentially unverifiable claims.
- Use 'approved' if the summary appears neutral, objective, and appropriately framed as a preliminary analysis.
- The commentary MUST always conclude by reminding the lawyer of their duty to verify.

Return your response ONLY in the specified JSON format.`;

/**
 * Reviews an AI-generated document summary by calling Gemini directly.
 * @param summary - The AI-generated summary text.
 * @param documentTitle - The title of the source document for context.
 * @returns A promise that resolves to the RPC review result.
 */
export const reviewAiGeneratedSummary = async (
  summary: string,
  documentTitle: string
): Promise<RpcReviewResult> => {
  try {
    // FIX: Use shared utility for API key retrieval
    const { getGeminiApiKey } = await import('../utils/aiUtils');
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error("API Key missing");

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      // FIX: Using stable gemini-2.5-flash model
      model: 'gemini-2.5-flash',
      contents: `Document Title: "${documentTitle}"\n\nAI-Generated Summary to Review:\n"${summary}"`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, description: "The review status, either 'approved' or 'warning'." },
            commentary: { type: Type.STRING, description: 'Brief ethical commentary, including the mandatory reminder for the lawyer to verify the content.' }
          },
          required: ['status', 'commentary']
        },
      }
    });

    const jsonString = response.text;
    const result: RpcReviewResult = JSON.parse(jsonString || '{}');
    return result;

  } catch (error) {
    console.error("RPC Guidance Agent client failed to review summary:", error);
    return {
      status: 'warning',
      commentary: 'AI-driven ethical review could not be completed due to a system error. Please review this summary with extra caution and verify all facts and conclusions independently.'
    };
  }
};

