
import { GoogleGenAI, Type } from "@google/genai";
import { Matter } from '../types';

interface ScaleFeeAnalysis {
    applies: boolean;
    scaleCategory: 'Scale I' | 'Scale II' | 'None';
    legalBasis: string;
    calculationGuidance: string;
    complianceNote: string;
    transactionValueRequired: boolean;
}

const SYSTEM_PROMPT = `You are a Nigerian legal billing compliance agent embedded in a LegalTech application.
Jurisdiction is strictly Nigeria.
Do not apply foreign law or assumptions.

Your role is to determine whether a statutory scale of charges applies to a legal matter
and, where applicable, guide or calculate fees in compliance with Nigerian law.

You must follow this logic:

1. Identify the nature of the legal matter from the matter title and description.
2. Determine whether the matter involves legal documentation relating to land.
3. If the matter involves land documentation:
   a. Apply the Legal Practitioners (Remuneration for Legal Documentation and Other Land Matters) Order 2023.
   b. Use progressive percentage bands.
   c. Warn that deviation from the scale may constitute professional misconduct.
4. If the matter does NOT involve land documentation:
   a. State clearly that no statutory scale of charges applies.
   b. Explain that fees are discretionary, subject to agreement and reasonableness.
5. Never invent a scale where none exists.
6. Always explain your reasoning in concise professional language.
7. Note: Courts do not apply taxes. Tax is payable to FIRS or State IRS.

Return your response ONLY in the specified JSON format.`;

export const analyzeScaleCompliance = async (
    matter: Matter
): Promise<ScaleFeeAnalysis> => {
    try {
        // FIX: Use shared utility for API key retrieval
        const { getGeminiApiKey } = await import('../utils/aiUtils');
        const apiKey = getGeminiApiKey();
        if (!apiKey) throw new Error("API Key missing");

        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze this legal matter for Scale of Charges applicability:
            Title: "${matter.title}"
            Type: "${matter.type}"
            Sub-Category: "${matter.subCategory || ''}"`,
            config: {
                systemInstruction: SYSTEM_PROMPT,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        applies: { type: Type.BOOLEAN, description: "True if Scale of Charges applies (Land matters)." },
                        scaleCategory: { type: Type.STRING, enum: ['Scale I', 'Scale II', 'None'], description: "Scale I for Sales/Mortgages, Scale II for Leases/Tenancy." },
                        legalBasis: { type: Type.STRING, description: "Citation of the relevant Order or reason for non-applicability." },
                        calculationGuidance: { type: Type.STRING, description: "Brief explanation of how the fee should be calculated (e.g. percentages)." },
                        complianceNote: { type: Type.STRING, description: "Warning about professional misconduct or advice on billing discretion." },
                        transactionValueRequired: { type: Type.BOOLEAN, description: "True if we need a transaction value to calculate the exact fee." }
                    },
                    required: ['applies', 'scaleCategory', 'legalBasis', 'calculationGuidance', 'complianceNote', 'transactionValueRequired']
                }
            }
        });

        const jsonString = response.text;
        if (!jsonString) throw new Error("Empty response");
        return JSON.parse(jsonString);

    } catch (error) {
        console.error("Scale of Charges Analysis Failed:", error);
        return {
            applies: false,
            scaleCategory: 'None',
            legalBasis: "Analysis Failed",
            calculationGuidance: "Could not determine automatically.",
            complianceNote: "Please verify compliance manually.",
            transactionValueRequired: false
        };
    }
};

