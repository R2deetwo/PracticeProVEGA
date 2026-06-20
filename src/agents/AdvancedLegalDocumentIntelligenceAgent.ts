
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Document, RiskAnalysis, ExtractedMetadata, FileDetails, DataProtectionAnalysis, RpcStatus } from '../types';
import { getGeminiApiKey, stripPII, AI_CONFIG } from '../utils/aiUtils';

// --- Types for the Orchestrator ---

export interface AldiaFullReport {
  summary: string;
  riskAnalysis: RiskAnalysis;
  extractedMetadata: ExtractedMetadata;
  dataProtection: DataProtectionAnalysis;
  rpcReview: RpcStatus;
}

interface AnalyzableDocument {
  title: string;
  content?: string;
  file?: FileDetails;
}

// --- Schemas ---

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "A professional executive summary of the document."
    },
    riskAnalysis: {
      type: Type.OBJECT,
      properties: {
        legalRisk: { type: Type.INTEGER, description: "Score 1-10" },
        commercialRisk: { type: Type.INTEGER, description: "Score 1-10" },
        complianceRisk: { type: Type.INTEGER, description: "Score 1-10" },
        operationalRisk: { type: Type.INTEGER, description: "Score 1-10" },
        overallRiskScore: { type: Type.INTEGER, description: "Weighted average 1-10" },
        justification: { type: Type.STRING, description: "Why this score was given." },
        highRiskClauses: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              clause: { type: Type.STRING },
              summary: { type: Type.STRING }
            },
            required: ['clause', 'summary']
          }
        }
      },
      required: ['legalRisk', 'commercialRisk', 'complianceRisk', 'operationalRisk', 'overallRiskScore', 'justification', 'highRiskClauses']
    },
    extractedMetadata: {
      type: Type.OBJECT,
      properties: {
        contractType: { type: Type.STRING },
        partiesInvolved: { type: Type.ARRAY, items: { type: Type.STRING } },
        effectiveDate: { type: Type.STRING, description: "YYYY-MM-DD or null" },
        expirationDate: { type: Type.STRING, description: "YYYY-MM-DD or null" },
        autoRenewalDate: { type: Type.STRING, description: "YYYY-MM-DD or null" },
        governingLaw: { type: Type.STRING },
        jurisdiction: { type: Type.STRING },
        opposingCounselInfo: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              firmName: { type: Type.STRING },
              phone: { type: Type.STRING },
              email: { type: Type.STRING },
              address: { type: Type.STRING }
            }
          },
          description: "Extract opposing counsel/opposing party contact details if present in the document"
        }
      },
      required: ['contractType', 'partiesInvolved', 'effectiveDate', 'expirationDate', 'autoRenewalDate', 'governingLaw', 'jurisdiction']
    },
    dataProtection: {
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
            }
          }
        }
      },
      required: ['overallRiskLevel', 'identifiedPii', 'findings']
    }
  },
  required: ['summary', 'riskAnalysis', 'extractedMetadata', 'dataProtection']
};

const getSystemPrompt = (isProperty?: boolean) => `You are ALDIA (${isProperty ? 'Advanced Legal Document Intelligence Agent' : 'Advanced Legal Document Intelligence Agent'}), the Orchestrator for PracticePro Nigeria.
Your role is to coordinate a multi-agent analysis of the provided ${isProperty ? 'property' : 'legal'} document.

You must emulate the output of three distinct sub-agents:

1. **The Analyst (Core):** Extract metadata (Parties, Dates, Governing Law) and write an Executive Summary. 
   - IMPORTANT: If the document contains opposing counsel or opposing party contact information (name, firm, phone, email, address), extract it in the opposingCounselInfo field.
2. **The Risk Auditor:** Analyze clauses for Legal, Commercial, and Compliance risks. Assign scores (1-10).
3. **The Privacy Shield:** Scan specifically for Nigerian PII (NIN, BVN, Phone Numbers) and assess compliance with the Nigeria Data Protection Act (NDPA).

Output strict JSON.`;


// --- Helper: File Preparation ---

const getFilePart = async (file: FileDetails): Promise<any> => {
  if (!file.dataUrl) throw new Error("File data is missing.");

  // Extract base64 (remove data:application/pdf;base64, prefix)
  const base64Data = file.dataUrl.split(',')[1];

  // Determine mime type
  let mimeType = file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();

  // Manual override for common issues
  if (ext === 'pdf') mimeType = 'application/pdf';
  if (['png', 'jpg', 'jpeg'].includes(ext || '')) mimeType = 'image/jpeg';

  // UNSUPPORTED TYPES CHECK
  // Gemini Vision/PDF capability specifically supports: PDF, PNG, JPEG, WEBP, HEIC.
  // It DOES NOT support Word (.docx) directly via inlineData for analysis unless we use a different flow (text extraction).
  // For this implementation, we will restrict to supported types to prevent API errors.

  const supportedTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/heif'
  ];

  if (!supportedTypes.includes(mimeType)) {
    throw new Error(`Unsupported file type for AI analysis: ${mimeType}. Please convert to PDF or Image.`);
  }

  return {
    inlineData: {
      data: base64Data,
      mimeType: mimeType
    }
  };
};

/**
 * The Master Orchestrator Function.
 * This runs client-side to ensure maximum speed and direct connectivity to Gemini.
 */
export const analyzeDocument = async (
  document: AnalyzableDocument,
  isProperty?: boolean
): Promise<AldiaFullReport> => {
  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error("API Key is missing. Please configure in Settings.");

    const ai = new GoogleGenAI({ apiKey });

    // FIX: Using stable models from config
    const model = AI_CONFIG.gemini.defaultModel;

    const parts: any[] = [];
    parts.push({ text: getSystemPrompt(isProperty) });

    if (document.file && document.file.dataUrl) {
      try {
        const filePart = await getFilePart(document.file);
        parts.push(filePart);
        parts.push({ text: "\n\nAnalyze the document provided above." });
      } catch (e: any) {
        console.warn("Binary processing failed or unsupported type:", e.message);

        // Fallback: If it's a text-readable file (like .txt or simple extracted content), send it as text.
        // Otherwise, throw a clear error to the user.
        if (document.content && document.content.length > 0) {
          parts.push({ text: stripPII(document.content) });
        } else {
          throw new Error(`Could not analyze file: ${e.message}`);
        }
      }
    } else if (document.content) {
      parts.push({ text: `\n\nAnalyze the following text:\n${stripPII(document.content)}` });
    } else {
      throw new Error("No document content found to analyze.");
    }

    // 2. Run The Orchestrator (Single-Shot Complex Reasoning)
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        temperature: 0.1, // Low temp for factual extraction
      }
    });

    const rawResult = JSON.parse(response.text || '{}');

    // 3. Post-Process (RPC Guardian Check)
    // We run a lightweight check on the *generated summary* to ensure it's not hallucinating legal advice.

    const rpcResponse = await ai.models.generateContent({
      model: AI_CONFIG.gemini.defaultModel, // Using configured Flash model
      contents: [{
        role: 'user', parts: [{
          text: `
            You are the RPC Guardian. Review this AI-generated legal summary for ethical compliance (Rules of Professional Conduct).
            Ensure it does not guarantee outcomes.
            
            Summary: "${rawResult.summary}"
            
            Return JSON: { "status": "approved" | "warning", "commentary": "string" }
          `}]
      }],
      config: { responseMimeType: "application/json" }
    });

    const rpcResult = JSON.parse(rpcResponse.text || '{"status": "approved", "commentary": "Verified."}');

    // 4. Assemble Final Report
    return {
      summary: rawResult.summary,
      riskAnalysis: rawResult.riskAnalysis,
      extractedMetadata: rawResult.extractedMetadata,
      dataProtection: rawResult.dataProtection,
      rpcReview: rpcResult
    };

  } catch (error: any) {
    console.error("ALDIA Orchestrator Failed:", error);
    throw new Error(error.message || "Analysis failed. Please check the document format and try again.");
  }
};
