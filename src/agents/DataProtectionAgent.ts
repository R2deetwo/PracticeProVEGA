
import { GoogleGenAI, Type } from "@google/genai";
import { Document, DataProtectionAnalysis } from '../types';

export interface DataProtectionResult {
  analysis: DataProtectionAnalysis;
  redactedContent: string;
}

const SYSTEM_PROMPT = `You are the Nigerian Data Protection Agent, an expert in the Nigeria Data Protection Act (NDPA). Your mission is to scan document text for Personally Identifiable Information (PII) and assess data protection risks.

PII includes, but is not limited to:
- Full Names
- National Identification Number (NIN)
- Bank Verification Number (BVN)
- Phone Numbers
- Home Addresses
- Email Addresses
- Passport Numbers
- Bank Account Numbers

Analyze the provided document content. Your tasks are:
1.  **Identify PII:** List all types of PII found in the text.
2.  **Assess Risk:** Determine an overall risk level (Low, Medium, High) based on the quantity and sensitivity of the PII.
3.  **Provide Findings:** For each identified risk, provide a brief recommendation for mitigation (e.g., "Redact NIN before sharing").
4.  **Redact Content:** Return a version of the original content where all identified PII is replaced with '[REDACTED]'.

Return your response ONLY in the specified JSON format.`;

/**
 * Analyzes a document for data protection risks and returns the analysis
 * along with a redacted version of the document's content.
 * @param document The document object to analyze.
 * @returns A promise resolving to the data protection analysis and redacted content.
 */
export const analyzeDataProtection = async (
  document: Document
): Promise<DataProtectionResult> => {
  try {
    const contentToAnalyze = document?.content || '';

    if (!contentToAnalyze) {
      return {
        analysis: {
          overallRiskLevel: 'Low',
          identifiedPii: [],
          findings: [{ risk: 'No text content provided for analysis.', recommendation: 'N/A' }]
        },
        redactedContent: ''
      };
    }

    // FIX: Use shared utility for API key retrieval
    const { getGeminiApiKey } = await import('../utils/aiUtils');
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error("API Key missing");

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze and redact the following text according to NDPA principles:\n\n---\n\n${contentToAnalyze}`,
      systemInstruction: SYSTEM_PROMPT,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: {
              type: Type.OBJECT,
              properties: {
                overallRiskLevel: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
                identifiedPii: { type: Type.ARRAY, items: { type: Type.STRING } },
                findings: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      risk: { type: Type.STRING },
                      recommendation: { type: Type.STRING }
                    },
                    required: ['risk', 'recommendation']
                  }
                }
              },
              required: ['overallRiskLevel', 'identifiedPii', 'findings']
            },
            redactedContent: { type: Type.STRING, description: 'The original content with all identified PII replaced by "[REDACTED]".' }
          },
          required: ['analysis', 'redactedContent']
        },
      }
    } as any);

    const jsonString = response.text;
    const result: DataProtectionResult = JSON.parse(jsonString || '{}');
    return result;

  } catch (error) {
    console.error("Data Protection Agent client failed:", error);
    return {
      analysis: {
        overallRiskLevel: 'Medium',
        identifiedPii: [],
        findings: [{
          risk: 'AI analysis could not be completed due to a system error.',
          recommendation: 'Please manually review this document for any Personally Identifiable Information (PII) and ensure compliance with the NDPA.'
        }]
      },
      redactedContent: document.content || ''
    };
  }
};

