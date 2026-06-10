import { GoogleGenAI, Type, Schema } from "@google/genai";
import { getGeminiApiKey, AI_CONFIG } from '../utils/aiUtils';
import JSZip from 'jszip';

// --- Types ---

export interface IngestedMetadata {
    matterTitle: string;
    primaryClient: string;
    matterType: string;
    suitNumber: string;
    opposingParties: string;
}

const metadataSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        matterTitle: {
            type: Type.STRING,
            description: "A professional and accurate title for this legal matter based on the documents. (e.g. John Doe v. State Government)"
        },
        primaryClient: {
            type: Type.STRING,
            description: "The name of the primary client we are representing or the party whose files these belong to. Often the Claimant or the Defendant."
        },
        matterType: {
            type: Type.STRING,
            enum: ["Civil Litigation", "Criminal Defense", "Corporate Commercial", "Real Estate", "Intellectual Property", "Family Law", "Employment", "Other"],
            description: "The broad category of law this matter falls under."
        },
        suitNumber: {
            type: Type.STRING,
            description: "The specific suit number, charge number, or reference number if mentioned in the documents (e.g. Suit No: FHC/ABJ/CS/123/2023). Leave blank if none."
        },
        opposingParties: {
            type: Type.STRING,
            description: "The name of the opposing parties (e.g. The State, Jane Doe, XYZ Corp). Leave blank if none."
        }
    },
    required: ['matterTitle', 'primaryClient', 'matterType', 'suitNumber', 'opposingParties']
};

// --- Extractors ---

/**
 * Extracts raw text from a .docx file using JSZip
 */
const extractTextFromDocx = async (file: File): Promise<string> => {
    try {
        const zip = new JSZip();
        const loadedZip = await zip.loadAsync(file);

        const documentXml = loadedZip.file("word/document.xml");
        if (!documentXml) return "";

        const xmlText = await documentXml.async("text");

        // Very basic XML tag stripping to get raw text
        // <w:p> indicates a paragraph, <w:t> is text.
        const paragraphs = xmlText.match(/<w:p.*?>.*?<\/w:p>/g) || [];

        let extractedText = "";
        for (const p of paragraphs) {
            const textNodes = p.match(/<w:t.*?>.*?<\/w:t>/g) || [];
            if (textNodes.length > 0) {
                const pText = textNodes.map(t => t.replace(/<[^>]+>/g, '')).join('');
                extractedText += pText + "\n";
            }
        }

        return extractedText.substring(0, 15000); // Cap at 15k chars for prompt health
    } catch (err) {
        console.warn("Docx extraction failed:", err);
        return ""; // Fail gracefully
    }
};

/**
 * Reads a File to a Base64 string for Gemini
 */
const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * Reads a text file natively
 */
const extractTextFromTxt = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).substring(0, 15000));
        reader.onerror = reject;
        reader.readAsText(file);
    });
};

// --- Public Analyzing Function ---

export const analyzeIngestedMatterFiles = async (
    files: File[],
    fallbackTitle: string
): Promise<IngestedMetadata> => {
    try {
        const apiKey = getGeminiApiKey();
        if (!apiKey) throw new Error("API Key missing");

        const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
        const model = AI_CONFIG.gemini.defaultModel;

        const parts: any[] = [{
            text: `You are ALOA, an elite Legal Ingestion Engine. 
Review the following document streams or text extracts provided by the user.
Your job is to determine the precise Matter Title, Primary Client Name, Matter Type, Suit Number, and Opposing Parties.

Instructions:
1. "Matter Title" should usually be "Claimant v. Defendant" or a clear descriptive title. DO NOT just use the filename like "Statement of Claim".
2. "Primary Client" must be the party that appears to own these files.
3. Output strictly in the requested JSON schema.`
        }];

        let hasContent = false;

        // Process up to first 3 documents max to save time/bandwidth
        const filesToProcess = files.slice(0, 3);

        for (const file of filesToProcess) {
            const ext = file.name.slice((file.name.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();

            if (ext === 'docx' || ext === 'doc') {
                const text = await extractTextFromDocx(file);
                if (text) {
                    parts.push({ text: `\n\n--- Start of ${file.name} (Text Extract) ---\n${text}\n--- End of ${file.name} ---\n` });
                    hasContent = true;
                }
            } else if (ext === 'txt' || ext === 'rtf' || ext === 'csv') {
                const text = await extractTextFromTxt(file);
                if (text) {
                    parts.push({ text: `\n\n--- Start of ${file.name} (Text file) ---\n${text}\n--- End of ${file.name} ---\n` });
                    hasContent = true;
                }
            } else if (ext === 'pdf' || ['png', 'jpg', 'jpeg'].includes(ext)) {
                try {
                    const base64 = await readFileAsBase64(file);
                    let mimeType = ext === 'pdf' ? 'application/pdf' : 'image/jpeg';
                    parts.push({
                        inlineData: {
                            data: base64,
                            mimeType: mimeType
                        }
                    });
                    parts.push({ text: `\n\n(This is the content of ${file.name})\n` });
                    hasContent = true;
                } catch (e) {
                    console.warn(`Could not read ${file.name} as base64`, e);
                }
            }
        }

        if (!hasContent) {
            parts.push({ text: `Could not extract text from files. Please fallback to guessing based on this folder/file path name: ${fallbackTitle}` });
        }

        const response = await ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts }],
            config: {
                responseMimeType: "application/json",
                responseSchema: metadataSchema,
                temperature: 0.1,
            }
        });

        const rawResult = JSON.parse(response.text || '{}');

        return {
            matterTitle: rawResult.matterTitle || fallbackTitle,
            primaryClient: rawResult.primaryClient || 'Unknown Client',
            matterType: rawResult.matterType || 'Civil Litigation',
            suitNumber: rawResult.suitNumber || '',
            opposingParties: rawResult.opposingParties || ''
        };

    } catch (error: any) {
        console.error("ALOA Ingestion Analysis Failed:", error);

        // Fallback
        const isVersus = fallbackTitle.toLowerCase().includes(' v. ') || fallbackTitle.toLowerCase().includes(' vs ');
        const client = isVersus ? fallbackTitle.split(/ v\. | vs /i)[0] : 'Unknown';

        return {
            matterTitle: fallbackTitle.trim() === 'General Legal Matter' ? 'New Uploaded Matter' : fallbackTitle,
            primaryClient: client,
            matterType: 'Civil Litigation',
            suitNumber: '',
            opposingParties: ''
        };
    }
};
