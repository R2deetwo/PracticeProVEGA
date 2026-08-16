
import { streamGemini, streamGeminiMultipart } from '../utils/aiUtils';
import { ResearchSource, ResearchMessage, ResearchCitation } from '../types';

export type AnalysisType = 'Chronology' | 'Brief' | 'Digest' | 'Gap' | 'Adversarial';

// --- CONSTANTS ---
const SENIOR_ASSOCIATE_PERSONA = `You are ARIA (Asset & Revenue Intelligence Assistant), a Senior Associate at a top-tier law firm. 
Your goal is to provide precise, rigorous, and strategically sound legal analysis based *only* on the provided sources.

STRICT GROUNDING RULES:
1. Every claim must be supported by a citation to a source.
2. If the answer is not in the sources, state: "The provided case files do not contain information regarding [X]."
3. Use a formal, objective, and analytical tone.
4. Format citations using blue pill tags: [Source Name].
5. Organize complex answers into clear headings (e.g., Facts, Issues, Rule, Analysis, Conclusion).`;

// Helper: detect PDF sources (both new __PDF_BASE64__ format and legacy empty-content + file.dataUrl)
const isPdfSource = (s: ResearchSource): boolean =>
    !!(s.content?.startsWith('__PDF_BASE64__') ||
        ((s.type === 'pdf' || s.name?.toLowerCase().endsWith('.pdf')) && !s.content?.trim() && (s as any).file?.dataUrl));

// Helper: extract dataUrl from a PDF source
const getPdfDataUrl = (s: ResearchSource): string => {
    if (s.content?.startsWith('__PDF_BASE64__')) {
        return s.content.replace('__PDF_BASE64__', '');
    }
    return (s as any).file?.dataUrl || '';
};

/**
 * Perform specialized analysis on a set of sources.
 */
export const analyzeSources = async (sources: ResearchSource[], typeOrPrompt: string): Promise<string> => {
    if (sources.length === 0) return "No sources provided for analysis.";

    // Separate PDFs from text sources
    const pdfSources = sources.filter(isPdfSource);
    const textSources = sources.filter(s => !isPdfSource(s));

    const textContext = textSources.length > 0
        ? textSources.map(s => `--- SOURCE: ${s.name} ---\n${s.content || '(No content)'}`).join('\n\n')
        : '';

    try {
        // Build multipart request for Gemini when PDFs are present
        if (pdfSources.length > 0) {
            const parts: any[] = [];
            for (const pdfSource of pdfSources) {
                const dataUrl = getPdfDataUrl(pdfSource);
                if (!dataUrl) continue;
                const base64Data = dataUrl.split(',')[1];
                const mimeType = dataUrl.split(';')[0].replace('data:', '') || 'application/pdf';
                parts.push({ text: `[PDF Document: ${pdfSource.name}]` });
                parts.push({ inlineData: { mimeType, data: base64Data } });
            }
            const prompt = `${SENIOR_ASSOCIATE_PERSONA}\n\n${textContext ? `TEXT SOURCES:\n${textContext}\n\n` : ''}TASK: ${typeOrPrompt}\n\nRESPONSE:`;
            parts.push({ text: prompt });
            const response = await streamGeminiMultipart(parts);
            return response;
        }

        const prompt = `${SENIOR_ASSOCIATE_PERSONA}\n\nCONTEXT:\n${textContext}\n\nTASK: ${typeOrPrompt}\n\nRESPONSE:`;
        const response = await streamGemini(prompt);
        return response;
    } catch (error) {
        console.error("Analysis failed:", error);
        return "I encountered an error while analyzing the sources. Please check your API configuration.";
    }
};

/**
 * Chat with a set of sources, optionally focusing on specific IDs.
 */
export const chatWithSources = async (
    messages: ResearchMessage[],
    sources: ResearchSource[],
    selectedSourceIds?: string[]
): Promise<{ content: string; citations: ResearchCitation[] }> => {

    const activeSources = selectedSourceIds && selectedSourceIds.length > 0
        ? sources.filter(s => selectedSourceIds.includes(s.id))
        : sources;

    const sourceContext = activeSources.map(s => `SOURCE ID: ${s.id}\nSOURCE NAME: ${s.name}\nCONTENT: ${s.content}`).join('\n\n');

    // Only send the last few messages to the AI to save tokens/context
    const chatHistory = messages.slice(-10).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');

    const prompt = `${SENIOR_ASSOCIATE_PERSONA}

SOURCES:
${sourceContext}

HISTORY:
${chatHistory}

USER: ${messages[messages.length - 1].content}

INSTRUCTIONS:
Response in markdown. For every fact extracted, append the source ID in brackets like [[source_id]].
I will post-process these into interactive citation bubbles.

ARIA:`;

    try {
        // Build multipart request for Gemini when PDFs are present
        const pdfSources = activeSources.filter(isPdfSource);
        const textSources = activeSources.filter(s => !isPdfSource(s));

        const textContext = textSources.map(s => `SOURCE ID: ${s.id}\nSOURCE NAME: ${s.name}\nCONTENT: ${s.content}`).join('\n\n');
        
        const prompt = `${SENIOR_ASSOCIATE_PERSONA}

SOURCES:
${textContext}

HISTORY:
${chatHistory}

USER: ${messages[messages.length - 1].content}

INSTRUCTIONS:
Response in markdown. For every fact extracted, append the source ID in brackets like [[source_id]].
I will post-process these into interactive citation bubbles.

ARIA:`;

        let fullResponse: string;

        if (pdfSources.length > 0) {
            const parts: any[] = [];
            for (const pdfSource of pdfSources) {
                const dataUrl = getPdfDataUrl(pdfSource);
                if (!dataUrl) continue;
                const base64Data = dataUrl.split(',')[1];
                const mimeType = dataUrl.split(';')[0].replace('data:', '') || 'application/pdf';
                parts.push({ text: `[PDF Document: ${pdfSource.name}, ID: ${pdfSource.id}]` });
                parts.push({ inlineData: { mimeType, data: base64Data } });
            }
            parts.push({ text: prompt });
            fullResponse = await streamGeminiMultipart(parts);
        } else {
            fullResponse = await streamGemini(prompt);
        }

        // Extract citations from [[source_id]] pattern
        const citations: ResearchCitation[] = [];
        const sourceIdRegex = /\[\[(source_\d+)\]\]/g;
        let match;

        while ((match = sourceIdRegex.exec(fullResponse)) !== null) {
            const sourceId = match[1];
            const source = sources.find(s => s.id === sourceId);
            if (source && !citations.find(c => c.sourceId === sourceId)) {
                citations.push({
                    sourceId: source.id,
                    snippet: `Reference from ${source.name}`
                });
            }
        }

        // Clean up the response text for display
        const displayContent = fullResponse.replace(/\[\[source_\d+\]\]/g, (match: string) => {
            const sid = match.slice(2, -2);
            const source = sources.find(s => s.id === sid);
            return source ? `[${source.name}]` : '';
        });

        return { content: displayContent, citations };
    } catch (error) {
        console.error("Chat failed:", error);
        return {
            content: "I'm sorry, I couldn't process that request right now. Please check your connection or API key.",
            citations: []
        };
    }
};
