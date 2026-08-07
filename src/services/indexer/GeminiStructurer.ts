// ARIA-X: Gemini Structurer — three-mode extraction engine
// ARCHITECTURE:
//   Phase 0: TOC Blueprint extraction from first chunk (source of truth)
//   Phase 1: Text-mode chunk extraction, anchored to TOC blueprint
//   Phase 2: Vision-mode for scanned/image pages
//   Phase 3: Pure regex fallback (offline, always succeeds)
//   Phase 4: reconstructAndRevise — Gemini cleans the final merged data

import { LegalDocType } from './indexerTypes';

const GEMINI_MODEL_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash-lite',
];
const TIMEOUT_MS = 90000;

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM CONTEXT (Master Prompt: Nigerian Legal Indexer)
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_CONTEXT = `You are an expert legal document indexer specifically trained on Nigerian legal materials. Your role is to extract and structure legal documents from various formats (PDF, Word, images, plaintext) into a precise, searchable index that serves Nigerian litigation lawyers.

CORE EXTRACTION RULES:
1. Preserve Hierarchical Relationships:
   - Court Rules: Order -> Rule -> Subrule -> Paragraph -> Clause
   - Legislation: Part/Chapter -> Section -> Subsection -> Paragraph
   - CRITICAL VALIDATION: Every Order must contain at least one Rule. If an Order has 0 children, the extraction has failed. Re-scan the source.
   - Do not skip rules due to formatting issues. If the text is messy, extract it anyway.
2. Citation Capture: Standardize citations using Nigerian legal conventions:
   - Rules: SCR 2011 O.1 r.1(1) (Supreme Court Rules 2011, Order 1, Rule 1, Subrule 1)
   - Legislation: CFRN 1999, s.36(2) (Constitution, Section 36, Subsection 2)
   - Cases: Gani Fawehinmi v. State (2006) LPELR-2240 @ 45
3. Distinguish Structure Levels: Primary (Orders/Parts), Secondary (Rules/Sections), Tertiary (Subrules/Subsections), Quaternary (Paragraphs).
4. Full Text Fidelity: Extract 100% of the body text for rules and sections. Do not truncate.
5. OCR Correction: Silently fix "Ru1e" to "Rule", "O.I" to "O.1", etc.
6. Chain of Thought: Analyze Type -> Map Structure -> Extract Every Elements -> Verify Accuracy -> Format JSON.`;

// ─────────────────────────────────────────────────────────────────────────────
// TOC BLUEPRINT EXTRACTION — runs on first chunk only, extracts the master TOC
// ─────────────────────────────────────────────────────────────────────────────
const TOC_EXTRACTION_PROMPT = (docType: LegalDocType) => `${SYSTEM_CONTEXT}

Your task: Extract the TABLE OF CONTENTS / ARRANGEMENT OF SECTIONS from the START of this document.

DOCUMENT TYPE: ${docType}

LOOK FOR (in priority order):
1. An explicit "ARRANGEMENT OF SECTIONS", "ARRANGEMENT OF RULES", "TABLE OF CONTENTS", or "INDEX" section near the start
2. If that doesn't exist, scan the first 20 numbered items visible in the text
3. Identify the document's formal title from the header/cover page

CRITICAL: The TOC is the BLUEPRINT. Every title you list here becomes the authoritative name for that section/order/rule throughout the entire document.

RETURN ONLY VALID JSON IN THIS FORMAT:
{
  "document_metadata": {
    "title": "Document Title",
    "type": "rules | legislation | judgment",
    "extraction_confidence": "high",
    "year": "YYYY",
    "jurisdiction": "e.g. Federal, Lagos State"
  },
  "content_tree": [
    {
      "level": 1,
      "identifier": "O.1",
      "type": "order",
      "title": "Order 1 Title",
      "children": [
        { "level": 2, "identifier": "O.1 r.1", "type": "rule", "title": "Rule 1 Title" }
      ]
    }
  ],
  "validation_report": {
    "total_items_found": 50,
    "empty_parents_detected": 0,
    "cross_references_broken": []
  }
}`;

// ─────────────────────────────────────────────────────────────────────────────
// CHUNK EXTRACTION PROMPTS — anchored to the TOC blueprint
// ─────────────────────────────────────────────────────────────────────────────

const buildChunkPrompt = (docType: LegalDocType, toc: string | null, startPage: number, endPage: number): string => {
  const blueprintContext = toc
    ? `\n\n📋 AUTHORITATIVE BLUEPRINT (Use these identifiers and titles):\n${toc}`
    : '\n\n(No blueprint available. Follow standard Nigerian legal hierarchy mapping.)';

  return `${SYSTEM_CONTEXT}
${blueprintContext}

TASK: Extract all legal elements (Orders, Rules, Sections) from pages ${startPage}–${endPage}.

WORKFLOW:
1. Identify Body vs. TOC: Are these pages part of the Arrangement of Rules (TOC) or the actual body text?
2. Anchor Search: You MUST search for Rule 1 (or the first child) of any Order mapped. If not found, explain why.
3. MANDATE: For each parent in TOC, find its first child. If missing, mark as "continues" in the audit report.
4. Messy Formatting: Ignore line numbers, page stamps, and headers. Focus on the core legal text.

RETURN ONLY VALID JSON IN THIS FORMAT:
{
  "full_raw_text": "THE RAW TEXT SOURCE PROVIDED BELOW",
  "content_tree": [
    {
      "level": 1,
      "identifier": "O.1",
      "type": "order",
      "title": "PRELIMINARY",
      "children": [
        { 
          "level": 2, 
          "identifier": "O.1 r.1", 
          "type": "rule", 
          "title": "Citation", 
          "full_text": "The full literal body text of the rule...",
          "children": [] 
        }
      ]
    }
  ],
  "index_entries": [
    {
      "citation": "SCR 2011 O.1 r.1",
      "hierarchy_path": "Order 1 > Rule 1",
      "element_type": "rule",
      "full_text": "...",
      "summary": "Rule governing the citation of these Rules.",
      "keywords": ["citation", "title"]
    }
  ],
  "audit_report": {
    "blueprint_items_expected": ["O.1"],
    "blueprint_items_found": ["O.1"],
    "total_rules_extracted": 5,
    "notes": "All 5 rules of Order 1 extracted. Order 2 continues on next chunk."
  },
  "validation_report": {
    "total_items_found": 5,
    "empty_parents_detected": 0,
    "cross_references_broken": []
  }
}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Client-side sort/dedup helpers
// ─────────────────────────────────────────────────────────────────────────────
function dedupeByNumber<T extends { number?: any }>(arr: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of arr) {
    const key = String(item.number ?? 'unknown');
    if (!seen.has(key)) {
      seen.set(key, item);
    } else {
      const existing = seen.get(key)!;
      const existTitle = String((existing as any).title ?? '');
      const currTitle = String((item as any).title ?? '');
      if (currTitle.length > existTitle.length) seen.set(key, item);
    }
  }
  return Array.from(seen.values());
}

function sortByNumber<T extends { number?: any }>(a: T, b: T): number {
  const numA = parseFloat(String(a.number ?? '0').replace(/[^\d.]/g, '')) || 0;
  const numB = parseFloat(String(b.number ?? '0').replace(/[^\d.]/g, '')) || 0;
  if (numA !== numB) return numA - numB;
  return String(a.number ?? '').localeCompare(String(b.number ?? ''), undefined, { numeric: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Regex Fallback Extractor — pure offline extraction, always returns something
// ─────────────────────────────────────────────────────────────────────────────
function regexExtract(text: string, docType: LegalDocType): any | null {
  if (!text || text.length < 50) return null;

  if (docType === 'JUDGMENT') {
    const suitMatch = text.match(/(?:suit|appeal|charge|case)\s+no[.:]?\s*([A-Z0-9/(). -]+)/i);
    const courtMatch = text.match(/(supreme court|court of appeal|high court|federal high court|magistrate court)[^.\n]{0,60}/i);
    const holdingMatches = [...text.matchAll(/(?:held[,:]?|it is (?:settled|trite) law that|the law is that|per\s+\w+\s+(?:j[sc]*|cjn)[,:])\s*([^.]{20,300}\.)/gi)];
    return {
      suitNumber: suitMatch?.[1]?.trim(),
      court: courtMatch?.[0]?.trim() ?? 'Nigerian Court',
      parties: [], judges: [],
      holdings: holdingMatches.slice(0, 15).map(m => m[1]?.trim()).filter(Boolean),
    };
  }

  if (docType === 'RULES' || docType === 'GAZETTE') {
    const orderMatches = [...text.matchAll(/\bORDER\s+([\dIVXLCivxlc]+)[\s.—–-]*([^\n]{0,80})/g)];
    const ruleMatches = [...text.matchAll(/\bRULE\s+(\d+(?:\.\d+)?)[.\s—–-]*([^\n]{0,80})/gi)];

    if (orderMatches.length > 0) {
      const ordersMap = new Map<string, any>();
      for (const [, num, title] of orderMatches) {
        const key = num.trim();
        if (!ordersMap.has(key) && key.length < 5) {
          const cleanTitle = title.replace(/[—–-]+$/, '').trim();
          ordersMap.set(key, { number: key, title: cleanTitle || `ORDER ${key}`, rules: [] });
        }
      }
      // Distribute rules to their order
      for (const [, rNum, rTitle] of ruleMatches) {
        const firstOrder = [...ordersMap.values()][0];
        if (firstOrder) {
          const existing = firstOrder.rules.find((r: any) => r.number === rNum);
          if (!existing) {
            firstOrder.rules.push({ number: rNum, title: rTitle.replace(/[—–-]+$/, '').trim() || `Rule ${rNum}` });
          }
        }
      }
      const orders = [...ordersMap.values()];
      if (orders.length > 0) return { orders, forms: [] };
    }
  }

  // ACT / LFN
  const arrangements = text.match(/ARRANGEMENT\s+OF\s+SECTIONS[\s\S]{0,5000}/i);
  const source = arrangements ? arrangements[0] : text;

  const sectionPatterns = [
    /^(\d+[A-Za-z]?)\.\s{1,5}([A-Z][^.\n]{5,100})/gm,
    /^(\d+[A-Za-z]?)\s{2,}([A-Z][^\n]{5,100})/gm,
    /section\s+(\d+[A-Za-z]?)[.\s—–-]+([A-Z][^.\n]{5,100})/gi,
  ];

  const sectionsFound: Array<{ number: string; title: string }> = [];
  const seen = new Set<string>();

  for (const pattern of sectionPatterns) {
    for (const m of [...source.matchAll(pattern)]) {
      const num = m[1]?.trim();
      const title = m[2]?.trim().replace(/[—–-]+$/, '').slice(0, 120);
      if (num && title && !seen.has(num) && title.length > 3) {
        seen.add(num);
        sectionsFound.push({ number: num, title });
      }
    }
    if (sectionsFound.length > 10) break;
  }

  if (sectionsFound.length === 0) return null;

  const titleMatch = text.match(/AN ACT[^\n]{0,200}/i) ?? text.match(/([A-Z][A-Z\s]{10,60}(?:ACT|LAW|DECREE))\s*\d{4}/);
  return {
    chapters: [{ number: 1, title: 'General Provisions', sections: sectionsFound.slice(0, 300) }],
    _regexExtracted: true,
    _extractedTitle: titleMatch?.[0]?.trim(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GeminiStructurer class
// ─────────────────────────────────────────────────────────────────────────────
export class GeminiStructurer {
  private apiKey: string;
  private tocBlueprint: any | null = null; // Extracted once from first chunk

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /** Check if a result has actual content */
  hasContent(result: any): boolean {
    if (!result) return false;
    // New Schema
    if ((result.content_tree?.length ?? 0) > 0) return true;
    if ((result.index_entries?.length ?? 0) > 0) return true;
    // Legacy
    if ((result.chapters?.length ?? 0) > 0) return result.chapters.some((c: any) => (c.sections?.length ?? 0) > 0);
    if ((result.orders?.length ?? 0) > 0) return true;
    if ((result.holdings?.length ?? 0) > 0) return true;
    if (result.suitNumber || result.court) return true;
    return false;
  }

  /** 
   * Phase 0: Extract the TOC Blueprint from the first chunk text.
   * This is the MASTER REFERENCE for all subsequent chunk extractions.
   */
  async extractTocBlueprint(firstChunkText: string, docType: LegalDocType): Promise<any | null> {
    const prompt = `${TOC_EXTRACTION_PROMPT(docType)}

--- DOCUMENT TEXT (first pages) ---
${firstChunkText.slice(0, 200000)}`;

    try {
      const result = await this.callGemini([{ text: prompt }], 8000);
      if (result && (result.content_tree || result.orders || result.chapters || result.suitNumber)) {
        this.tocBlueprint = result;
        return result;
      }
    } catch (err: any) {
      console.warn('ARIA-X: TOC extraction failed:', err?.message?.slice(0, 100));
    }

    this.tocBlueprint = null;
    return null;
  }

  /**
   * Mode 1: Text-based chunk extraction, anchored to TOC blueprint
   */
  async structureChunk(
    text: string,
    docType: LegalDocType,
    startPage: number,
    endPage: number,
    retries = 2
  ): Promise<any | null> {
    if (!text || text.length < 30) return null;

    // Build TOC context string for the prompt
    const tocString = this.tocBlueprint
      ? JSON.stringify(this.tocBlueprint, null, 2).slice(0, 4000)
      : null;

    const prompt = buildChunkPrompt(docType, tocString, startPage, endPage) +
      `\n\n--- DOCUMENT TEXT (Pages ${startPage}–${endPage}) ---\n${text.slice(0, 300000)}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.callGemini([{ text: prompt }], 6000);
        if (result && this.hasContent(result)) {
          // If TOC gave us names, enrich any rules missing titles from blueprint
          return this.enrichFromBlueprint(result, docType);
        }
      } catch (err: any) {
        const isRateLimit = err?.message?.includes('429');
        const delay = isRateLimit ? 6000 * attempt : 1500 * attempt;
        console.warn(`GeminiStructurer attempt ${attempt} failed: ${err?.message?.slice(0, 80)}`);
        if (attempt < retries) await new Promise(r => setTimeout(r, delay));
      }
    }

    // Gemini failed — use regex
    const regexResult = regexExtract(text, docType);
    if (regexResult && this.hasContent(regexResult)) {
      return regexResult;
    }

    return null;
  }

  /**
   * Mode 2: Vision-based extraction for scanned/image PDFs
   */
  async structureChunkFromImages(
    imageBase64s: string[],
    docType: LegalDocType,
    startPage: number,
    endPage: number,
    retries = 2
  ): Promise<any | null> {
    if (!imageBase64s.length) return null;

    const tocString = this.tocBlueprint
      ? JSON.stringify(this.tocBlueprint, null, 2).slice(0, 3000)
      : null;

    const prompt = buildChunkPrompt(docType, tocString, startPage, endPage) +
      `\n\nThese are ${imageBase64s.length} scanned pages (${startPage}–${endPage}). Read all visible text. Apply the same TITLE RULES above.`;

    const parts: any[] = [
      { text: prompt },
      ...imageBase64s.map(b64 => ({ inline_data: { mime_type: 'image/jpeg', data: b64 } }))
    ];

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.callGemini(parts, 6000);
        if (result && this.hasContent(result)) return this.enrichFromBlueprint(result, docType);
      } catch (err: any) {
        const delay = err?.message?.includes('429') ? 8000 * attempt : 2000 * attempt;
        console.warn(`Vision attempt ${attempt} failed: ${err?.message?.slice(0, 80)}`);
        if (attempt < retries) await new Promise(r => setTimeout(r, delay));
      }
    }

    return null;
  }

  /**
   * Enrich extracted chunk data with titles from the TOC blueprint.
   * If a rule/section has no title but is in the blueprint, use the blueprint title.
   */
  private enrichFromBlueprint(result: any, docType: LegalDocType): any {
    if (!this.tocBlueprint) return result;

    if (docType === 'RULES' && result.orders && this.tocBlueprint.orders) {
      result.orders = result.orders.map((order: any) => {
        const bpOrder = this.tocBlueprint.orders?.find((o: any) => String(o.number) === String(order.number));
        const enrichedOrder = {
          ...order,
          title: (order.title && order.title.length > 3) ? order.title : (bpOrder?.title ?? order.title),
          rules: (order.rules ?? []).map((rule: any) => {
            const bpRule = bpOrder?.rules?.find((r: any) => String(r.number) === String(rule.number));
            return {
              ...rule,
              title: (rule.title && rule.title.length > 3 && !isSentenceFragment(rule.title))
                ? rule.title
                : (bpRule?.title ?? rule.title ?? `Rule ${rule.number}`),
            };
          }),
        };
        return enrichedOrder;
      });
    }

    if ((docType === 'ACT' || docType === 'LFN') && result.chapters && this.tocBlueprint.chapters) {
      result.chapters = result.chapters.map((chapter: any) => {
        const bpChap = this.tocBlueprint.chapters?.find((c: any) => String(c.number) === String(chapter.number));
        return {
          ...chapter,
          title: (chapter.title && chapter.title.length > 3) ? chapter.title : (bpChap?.title ?? chapter.title),
          sections: (chapter.sections ?? []).map((section: any) => {
            const bpSec = bpChap?.sections?.find((s: any) => String(s.number) === String(section.number));
            return {
              ...section,
              title: (section.title && section.title.length > 3 && !isSentenceFragment(section.title))
                ? section.title
                : (bpSec?.title ?? section.title ?? `Section ${section.number}`),
            };
          }),
        };
      });
    }

    return result;
  }

  /**
   * Phase 4: Reconstruction pass — rebuilds the final merged index cleanly
   */
  async reconstructAndRevise(docType: LegalDocType, premergedData: any, rawTextSample: string): Promise<any> {
    if (!this.hasContent(premergedData)) return premergedData;

    // Phase 4a: client-side dedup+sort (Legacy clean - kept as safety)
    const cleaned = this.clientSideClean(docType, premergedData);

    const systemContext = `You are a senior Nigerian legal editor. Your task is to clean, deduplicate, and finalize a legal index.
RULES:
1. Preserve 100% of "full_text" / "content". Never summarize.
2. Enforce Hierarchy: Ensure tertiary levels (Subrules/Subsections) are nested appropriately.
3. Standardize Citations: All entries must use Nigerian legal notation (e.g. "O.1 r.1", "s.36").
4. CULL HALLUCINATIONS: Delete cross-reference paragraphs that were mistakenly indexed as rules.
5. Merge Duplicates: If multiple chunks scanned the same rule, combine their content to ensure completeness.`;

    const instructions = `RECONSTRUCT AND REVISE:
Type: ${docType}

RETURN ONLY VALID JSON IN THIS FORMAT:
{
  "full_raw_text": "...",
  "document_metadata": { ... },
  "content_tree": [
    {
      "level": 1,
      "identifier": "...",
      "type": "...",
      "title": "...",
      "children": [
        { "level": 2, "identifier": "...", "type": "rule/section", "full_text": "...", "children": [] }
      ]
    }
  ],
  "index_entries": [
    { "citation": "...", "hierarchy_path": "...", "element_type": "...", "full_text": "...", "summary": "...", "keywords": [] }
  ],
  "validation_report": { ... }
}`;

    // Self-Audit: Find what's in the TOC but missing in the cleaned data
    const missingNodes: { identifier: string, label: string }[] = [];
    if (this.tocBlueprint?.content_tree && cleaned.content_tree) {
      for (const tocItem of this.tocBlueprint.content_tree) {
        const found = cleaned.content_tree.find((t: any) => t.identifier === tocItem.identifier);
        if (!found || !found.children || found.children.length === 0) {
          missingNodes.push({ identifier: tocItem.identifier, label: tocItem.title || '' });
        }
      }
    }

    // PHASE 4: Dedicated Mandatory Recovery Call
    if (missingNodes.length > 0 && rawTextSample.length > 0) {
      const recoveryPrompt = `${SYSTEM_CONTEXT}
      
TASK: Recover missing rules.
EMPTY PARENTS TO RECOVER: ${JSON.stringify(missingNodes)}

For each empty parent above, search the RAW TEXT provided below, find the exact location of its actual text/rules, and extract them.

RETURN VALID JSON:
{
  "recovered_items": [
    {
      "parent_identifier": "O.1",
      "recovered_children": [
        { "level": 2, "identifier": "O.1 r.1", "type": "rule", "title": "...", "full_text": "...", "children": [] }
      ]
    }
  ]
}

--- RAW TEXT SOURCE ---
${rawTextSample.slice(0, 30000)}
`;

      try {
        const recResult = await this.callGemini([{ text: recoveryPrompt }], 15000);
        if (recResult?.recovered_items) {
          for (const rec of recResult.recovered_items) {
            const parent = cleaned.content_tree?.find((t: any) => t.identifier === rec.parent_identifier);
            if (parent) {
              parent.children = [...(parent.children || []), ...(rec.recovered_children || [])];
            } else {
              cleaned.content_tree.push({
                level: 1,
                identifier: rec.parent_identifier,
                type: 'order',
                title: 'Recovered Parent',
                children: rec.recovered_children || []
              });
            }
          }
        }
      } catch (err: any) {
        console.warn('Phase 4 Mandatory Recovery failed:', err?.message);
      }
    }

    // Now proceed with normal Phase 4 consolidation if needed, or just return the repaired data.
    const blueprintTitle = this.tocBlueprint?.document_metadata?.title || this.tocBlueprint?.title || null;
    const blueprintInstructions = blueprintTitle
      ? `\n\nDOCUMENT TITLE: "${blueprintTitle}" — use this in metadata.`
      : '';

    const finalPrompt = `${systemContext}\n\n${instructions}${blueprintInstructions}

--- RAW EXTRACTED DATA TO CLEAN ---
${JSON.stringify(cleaned, null, 2).slice(0, 300000)}

Output ONLY the cleaned JSON. Ensure all "children" arrays are populated.`;

    try {
      const result = await this.callGemini([{ text: finalPrompt }], 10000);
      if (result && this.hasContent(result)) {
        return this.clientSideClean(docType, result);
      }
    } catch (err: any) {
      console.warn('reconstructAndRevise finalize failed:', err?.message?.slice(0, 100));
    }

    return this.clientSideClean(docType, cleaned);
  }

  /** @deprecated Use reconstructAndRevise */
  async mergeAndFinalize(docType: LegalDocType, premergedData: any): Promise<any | null> {
    return this.reconstructAndRevise(docType, premergedData, '');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────────────────────────────────────

  private cleanNode(node: any): any {
    let title = node.title || '';
    if (isSentenceFragment(String(title))) {
      title = synthesizeTitle(String(title));
    }

    return {
      ...node,
      title,
      children: (node.children ?? []).map((c: any) => this.cleanNode(c))
    };
  }

  private clientSideClean(docType: LegalDocType, data: any): any {
    if (!data) return data;

    // Clean New Schema content_tree
    if (data.content_tree) {
      data.content_tree = data.content_tree.map((node: any) => this.cleanNode(node));
    }

    if ((docType === 'ACT' || docType === 'LFN') && data.chapters) {
      return {
        ...data,
        chapters: dedupeByNumber(data.chapters).sort(sortByNumber).map((ch: any) => ({
          ...ch,
          sections: dedupeByNumber(ch.sections ?? [])
            .filter((s: any) => !isSentenceFragment(String(s.title ?? '')))
            .sort(sortByNumber),
        })),
      };
    }

    if (docType === 'RULES' && data.orders) {
      return {
        ...data,
        orders: dedupeByNumber(data.orders).sort(sortByNumber).map((o: any) => ({
          ...o,
          rules: dedupeByNumber(o.rules ?? [])
            .map((r: any) => ({
              ...r,
              title: isSentenceFragment(String(r.title ?? '')) ? synthesizeTitle(String(r.title ?? '')) : r.title,
            }))
            .sort(sortByNumber),
        })),
        forms: dedupeByNumber(data.forms ?? []).sort(sortByNumber),
      };
    }

    if (docType === 'JUDGMENT') {
      return {
        ...data,
        holdings: (data.holdings ?? []).filter(Boolean).filter((h: string) => h.length > 20).slice(0, 25),
        parties: [...new Set<string>(data.parties ?? [])],
        judges: [...new Set<string>(data.judges ?? [])],
      };
    }

    return data;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Core Gemini API call — iterates through model chain
  // ───────────────────────────────────────────────────────────────────────────
  private async callGemini(parts: any[], maxOutputTokens: number): Promise<any | null> {
    let lastError: Error | null = null;

    for (const modelName of GEMINI_MODEL_CHAIN) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ role: 'user', parts }],
              generationConfig: {
                maxOutputTokens,
                temperature: 0.05,
                responseMimeType: 'application/json',
              },
            }),
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const body = await response.text();
          const isRetryable = response.status === 429 || response.status === 404 || response.status === 503;
          const err = new Error(`Gemini ${response.status} (${modelName}): ${body.slice(0, 200)}`);
          if (isRetryable) {
            console.warn(`ARIA-X: Model ${modelName} unavailable (${response.status}), trying next…`);
            lastError = err;
            await new Promise(r => setTimeout(r, response.status === 429 ? 5000 : 500));
            continue;
          }
          throw err;
        }

        const data = await response.json();
        const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (!rawText) { console.warn(`ARIA-X: Empty response from ${modelName}`); continue; }

        const parsed = this.parseJSON(rawText);
        if (parsed) {
          return parsed;
        }

        lastError = new Error(`JSON parse failed for ${modelName}`);
        continue;

      } catch (err: any) {
        clearTimeout(timeoutId);
        const msg = String(err?.message || err).toLowerCase();
        const isRetryable = msg.includes('abort') || msg.includes('429') || msg.includes('quota') ||
          msg.includes('unavailable') || msg.includes('404') || msg.includes('not found');

        if (isRetryable) {
          console.warn(`ARIA-X: ${modelName} retryable error: ${err?.message?.slice(0, 80)}`);
          lastError = err;
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        throw err;
      }
    }

    if (lastError) throw lastError;
    return null;
  }

  private parseJSON(text: string): any {
    let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    try {
      cleaned = cleaned
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/:\s*undefined/g, ': null')
        .replace(/\bNaN\b/g, 'null');
      return JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) { try { return JSON.parse(match[0]); } catch { /* ignore */ } }
      return null;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Detect sentence fragments (bad titles)
// ─────────────────────────────────────────────────────────────────────────────
function isSentenceFragment(text: string): boolean {
  if (!text || text.length < 5) return false;
  const lower = text.toLowerCase().trim();
  // Starts with subordinate clause openers
  if (/^(where|when|if a|if the|where a|where the|unless|provided that|notwithstanding|subject to|in the event|upon the|any person who|a party who)/.test(lower)) return true;
  // Contains rule/order self-references or common cross-reference fragments
  if (/of these rules|of this order|rule \d+\(\d+\)|order \d+ rule|under rule|refer to rule|pursuant to rule/i.test(lower)) return true;
  // Very long (>80 chars) and contains verbs — likely body text
  if (text.length > 80 && /\b(shall|may|must|is|are|was|were|have|has)\b/i.test(lower)) return true;
  return false;
}

function synthesizeTitle(fragment: string): string {
  // Extract key noun phrase from a sentence fragment
  const cleaned = fragment
    .replace(/^(where|when|if a|if the|provided that)\s+/i, '')
    .replace(/\s+(?:shall|may|must).+$/i, '')
    .replace(/\s+(?:is|are|was|were).+$/i, '')
    .trim();
  // Title-case it
  return cleaned.length > 5
    ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1, 60)
    : fragment.slice(0, 60);
}

