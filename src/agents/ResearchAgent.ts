import { streamGemini, streamGeminiMultipart } from '../utils/aiUtils';
import { ResearchSource } from '../types';

// V5: widened to match the tool names the Studio actually sends (the old
// union was missing 'Legal Matrix' / 'Gap Analysis' / 'Case Brief' /
// 'Pleading Digest', which the caller had to force-cast over).
export type AnalysisType = 'Chronology' | 'Brief' | 'Digest' | 'Gap' | 'Adversarial' | 'Case Brief' | 'Pleading Digest' | 'Legal Matrix' | 'Gap Analysis';

// --- CONSTANTS ---
const SENIOR_ASSOCIATE_PERSONA = `You are ALOA (Advanced Legal Office Assistant), a Senior Associate at a top-tier law firm.
Your goal is to provide precise, rigorous, and strategically sound legal analysis based *only* on the provided sources.

STRICT GROUNDING RULES:
1. Every claim must be supported by a citation to a source.
2. If the answer is not in the sources, state: "The provided case files do not contain information regarding [X]."
3. Use a formal, objective, and analytical tone.
4. Format citations using blue pill tags: [Source Name].
5. Organize complex answers into clear headings (e.g., Facts, Issues, Rule, Analysis, Conclusion).

V5 (EVIDENCE INTEGRITY — applies to EVERY analysis):
6. Every date, party, event or amount you mention must come from the provided sources. If the sources do not establish it, write [not established in sources] instead of inventing it — never guess a date, a party, or an event into the record.
7. OPEN your output with this line: "AI-generated analysis — derived from the connected sources; verify against the underlying documents before relying on it."
8. Close with a "Source gaps" section listing anything the sources do NOT establish (missing documents, undated events, unnamed parties) so the gaps stay visible.`;

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
 *
 * V5 (evidence integrity): on failure this now THROWS instead of returning
 * an error string — the Studio used to save that string as a "Chronology"
 * / "Gap Analysis" result. An empty run is also an error, not a "result".
 */
export const analyzeSources = async (sources: ResearchSource[], typeOrPrompt: string): Promise<string> => {
    if (sources.length === 0) {
        throw new Error('No sources provided for analysis.');
    }

    // Separate PDFs from text sources
    const pdfSources = sources.filter(isPdfSource);
    const textSources = sources.filter(s => !isPdfSource(s));

    const textContext = textSources.length > 0
        ? textSources.map(s => `--- SOURCE: ${s.name} ---\n${s.content || '(No content)'}${s.url ? `\n(fetched from: ${s.url})` : ''}`).join('\n\n')
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
        console.error('Analysis failed:', error);
        throw error instanceof Error ? error : new Error(String(error));
    }
};
