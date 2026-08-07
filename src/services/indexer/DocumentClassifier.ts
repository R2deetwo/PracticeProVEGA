// ARIA-X: Document Classifier (Enhanced with Vision fallback)
import { ClassificationResult, LegalDocType, DocumentMetadata } from './indexerTypes';
// NOTE: streamGemini was removed from geminiService; using @google/genai directly instead
import { TextExtractor } from './TextExtractor';

export class DocumentClassifier {
  /**
   * Classify a PDF document by analyzing text from the first 3 pages.
   * No vision API — pure text heuristics. Fast (<5s).
   */
  async classify(pdfDoc: any, apiKey?: string): Promise<ClassificationResult> {
    const extractor = new TextExtractor();
    const isScanned = await extractor.isLikelyScanned(pdfDoc);
    
    let metadata: any = null;
    let combinedText = '';

    // Always try to get text for heuristics anyway
    const pagesToScan = Math.min(5, pdfDoc.numPages);
    for (let i = 1; i <= pagesToScan; i++) {
      try {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        combinedText += pageText + '\n';
      } catch { /* skip */ }
    }

    const heuristicResult = this.scoreAndClassify(combinedText);

    if (isScanned && apiKey) {
      const imageBase64 = await extractor.renderPageToImage(pdfDoc, 1, 1.5);
      if (imageBase64) {
        metadata = await this.extractMetadataMultimodal(imageBase64, apiKey);
      }
    } else {
      try {
        metadata = await this.extractMetadata(combinedText.slice(0, 4000), apiKey);
      } catch (err) {
        console.warn('Text metadata extraction failed:', err);
      }

      // VITAL FIX: If text extraction failed or returned no title, fallback to VISION
      // This solves the issue where Gazettes have a heavily watermarked/garbled cover page
      if ((!metadata || !metadata.title || metadata.title === 'Unknown Document') && apiKey) {
        const imageBase64 = await extractor.renderPageToImage(pdfDoc, 1, 1.5);
        if (imageBase64) {
          const visionMeta = await this.extractMetadataMultimodal(imageBase64, apiKey);
          if (visionMeta && visionMeta.title) {
            metadata = visionMeta;
          }
        }
      }
    }

    if (metadata && metadata.title) {
      const textForHeuristics = metadata.title ? `${metadata.title} ${metadata.type}` : '';
      const fallbackHeuristic = this.scoreAndClassify(textForHeuristics);
      return {
        type: (metadata.type as LegalDocType) || fallbackHeuristic.type || heuristicResult.type,
        confidence: 85,
        metadata
      };
    }

    return heuristicResult;
  }

  private getPromptParams(): string {
    return `
      Analyze the provided content (text or image) from the START of a Nigerian legal document.
      Extract the Title, Year, Jurisdiction, and Document Type.
      
      Valid Types: JUDGMENT, RULES, ACT, LFN, GAZETTE.
      
      🚨 CRITICAL NIGERIAN GAZETTE RULES:
      1. Gazettes are usually wrappers (e.g., "Supplement to the Official Gazette...").
      2. If the Gazette explicitly contains, introduces, or publishes a specific law, rule, regulation, or act (e.g., "Corrupt Practices and Other Related Offences Act 2000" or "Federal High Court Rules"), you MUST extract that EXACT law as the "title" and NOT simply "Official Gazette".
      3. Set the type to ACT or RULES depending on what the Gazette is actually publishing.
      4. If it's just a general notice with no specific law body, set type to GAZETTE.

      For JUDGMENTS: look for "IN THE SUPREME COURT", "COURT OF APPEAL", or "SUIT NO".

      Respond ONLY with a valid JSON object. Do NOT include markdown blocks or any other text.
      {
        "title": "Full formal title (e.g. Finance Act 2023 or Delta State High Court Rules)",
        "year": "YYYY",
        "jurisdiction": "e.g. Nigeria, Lagos State",
        "type": "ACT | RULES | JUDGMENT | LFN | GAZETTE",
        "number": "Act No., Suit No., etc."
      }`;
  }

  private async extractMetadataMultimodal(base64Image: string, apiKey: string): Promise<any | null> {
    try {
      const { GoogleGenAI: GeminiSDK } = await import('@google/genai');
      const ai = new GeminiSDK({ apiKey, apiVersion: 'v1beta' });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [
            { text: this.getPromptParams() },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
          ]
        }],
        config: { responseMimeType: 'application/json' }
      });

      const rawText = typeof response.text === 'function'
        ? (response as any).text()
        : response.text;

      if (!rawText) return null;
      const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      console.error('Vision Prompt Failed:', e);
      return null;
    }
  }

  private async extractMetadata(text: string, apiKey?: string): Promise<any | null> {
    const prompt = `${this.getPromptParams()}
      
      TEXT SNIPPET:
      ${text}
    `;

    try {
      const { GoogleGenAI: GeminiSDK } = await import('@google/genai');
      const key = apiKey || (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_GEMINI_API_KEY : '') || '';
      const ai = new GeminiSDK({ apiKey: key });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      const rawText = typeof response.text === 'function' ? (response as any).text() : response.text;
      if (!rawText) return null;
      const cleanJson = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      return JSON.parse(cleanJson);
    } catch {
      return null;
    }
  }

  private scoreAndClassify(text: string): ClassificationResult {
    const lower = text.toLowerCase();
    const scores: Record<LegalDocType, number> = {
      JUDGMENT: 0,
      RULES: 0,
      ACT: 0,
      LFN: 0,
      GAZETTE: 0,
    };

    // ── JUDGMENT signals ──────────────────────────────────────────
    if (/suit\s+no\.?/i.test(lower)) scores.JUDGMENT += 35;
    if (/judgment|judgement/i.test(lower)) scores.JUDGMENT += 25;
    if (/\bappellant\b/i.test(lower)) scores.JUDGMENT += 20;
    if (/\brespondent\b/i.test(lower)) scores.JUDGMENT += 15;
    if (/\bclaimant\b/i.test(lower)) scores.JUDGMENT += 15;
    if (/\bdefendant\b/i.test(lower)) scores.JUDGMENT += 10;
    if (/in the .*(court|tribunal)/i.test(lower)) scores.JUDGMENT += 10;
    if (/coram|j\.s\.c\.|j\.c\.a\.|j\.f\.c\./i.test(lower)) scores.JUDGMENT += 20;
    if (/ratio\s+decidendi/i.test(lower)) scores.JUDGMENT += 15;
    if (/\bper\b.*\bj\b/i.test(lower)) scores.JUDGMENT += 10;
    if (/appeal\s+(no|number)/i.test(lower)) scores.JUDGMENT += 15;

    // ── RULES signals ─────────────────────────────────────────────
    if (/order\s+\d+/i.test(lower)) scores.RULES += 35;
    if (/rule\s+\d+\.\d+/i.test(lower)) scores.RULES += 30;
    if (/rules\s+of\s+court/i.test(lower)) scores.RULES += 25;
    if (/rules\s+of\s+(the\s+)?(superior|federal|civil|criminal|magistrate)/i.test(lower)) scores.RULES += 20;
    if (/form\s+\d+/i.test(lower)) scores.RULES += 10;
    if (/\bwrit\b/i.test(lower) && /order\s+\d+/i.test(lower)) scores.RULES += 10;

    // ── ACT signals ───────────────────────────────────────────────
    if (/section\s+\d+/i.test(lower)) scores.ACT += 20;
    if (/chapter\s+[ivxl\d]+/i.test(lower)) scores.ACT += 15;
    if (/part\s+(i|1|[ivx]+)\b/i.test(lower)) scores.ACT += 10;
    if (/\bact\b.*\d{4}/i.test(lower) || /\d{4}.*\bact\b/i.test(lower)) scores.ACT += 25;
    if (/short\s+title.*act/i.test(lower)) scores.ACT += 20;
    if (/\bschedule\b/i.test(lower)) scores.ACT += 5;
    if (/commencement/i.test(lower)) scores.ACT += 10;
    if (/minister.*shall/i.test(lower)) scores.ACT += 8;

    // ── LFN signals ───────────────────────────────────────────────
    if (/laws\s+of\s+the\s+federation/i.test(lower)) scores.LFN += 50;
    if (/l\.f\.n\.?/i.test(lower)) scores.LFN += 35;
    if (/\blfn\b/i.test(lower)) scores.LFN += 30;
    if (/\[repealed\]|\(repealed\)/i.test(lower)) scores.LFN += 20;
    if (/cap\.\s*[a-z]\d+/i.test(lower)) scores.LFN += 25;
    if (/2004\s+edition/i.test(lower)) scores.LFN += 15;

    // ── GAZETTE signals ───────────────────────────────────────────
    if (/official\s+gazette/i.test(lower)) scores.GAZETTE += 60;
    if (/federal\s+republic\s+of\s+nigeria/i.test(lower) && /no\.\s+\d+/i.test(lower)) scores.GAZETTE += 30;
    if (/supplement\s+to\s+official/i.test(lower)) scores.GAZETTE += 40;
    if (/extraordinary/i.test(lower) && /gazette/i.test(lower)) scores.GAZETTE += 30;
    if (/\b Lagos \b|\b Abuja \b|\b Rivers \b/i.test(text)) scores.GAZETTE += 10; // State signals
    if (/printed\s+and\s+published\s+by\s+the\s+federal\s+government/i.test(lower)) scores.GAZETTE += 25;

    // Find highest score
    const entries = Object.entries(scores) as [LegalDocType, number][];
    const maxEntry = entries.reduce((best, curr) => (curr[1] > best[1] ? curr : best));
    const [type, maxScore] = maxEntry;

    // If no signals at all, default to ACT
    if (maxScore === 0) {
      return { type: 'ACT', confidence: 35 };
    }

    // Calculate confidence as ratio of winner to total points
    const totalScores = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = Math.min(97, Math.round((maxScore / totalScores) * 100));

    return { type, confidence };
  }
}

