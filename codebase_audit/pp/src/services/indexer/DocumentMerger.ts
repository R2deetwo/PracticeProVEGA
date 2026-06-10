// ALOA-X: Document Merger — client-side pre-merge + Gemini finalization

import { ChunkData, LegalDocType, IndexedDocument, ActIndex, RulesIndex, JudgmentIndex } from './indexerTypes';
import { GeminiStructurer } from './GeminiStructurer';

export class DocumentMerger {
  private structurer: GeminiStructurer;

  constructor(geminiApiKey: string) {
    this.structurer = new GeminiStructurer(geminiApiKey);
  }

  /**
   * Full merge pipeline:
   * 1. Client-side structural merge (combine chapters/orders)
   * 2. Gemini finalization pass (deduplicate, fix numbering)
   */
  async merge(
    chunks: ChunkData[],
    documentId: string,
    fileName: string,
    totalPages: number,
    classification: { type: LegalDocType; confidence: number; metadata?: any }
  ): Promise<IndexedDocument> {
    let { type: docType, confidence: initialConfidence, metadata } = classification;
    let completedChunks = chunks.filter(c => c.status === 'completed' && c.structuredData);

    // ── GAZETTE: detect inner type from chunk structured data ────────
    let gazettteInnerType: 'ACT' | 'RULES' | null = null;
    if (docType === 'GAZETTE') {
      for (const chunk of completedChunks) {
        if (chunk.structuredData?.type === 'RULES' || chunk.structuredData?.orders) {
          gazettteInnerType = 'RULES';
          break;
        }
        if (chunk.structuredData?.type === 'ACT' || chunk.structuredData?.chapters) {
          gazettteInnerType = 'ACT';
          break;
        }
      }
      if (!gazettteInnerType) gazettteInnerType = 'ACT'; // default fallback
      
      // Extract title from gazette chunks' structured data metadata
      if (!metadata?.title || metadata.title === 'Untitled Document') {
        for (const chunk of completedChunks) {
          const chunkTitle = chunk.structuredData?.metadata?.title;
          if (chunkTitle && chunkTitle.length > 5) {
            metadata = { ...metadata, title: chunkTitle };
            break;
          }
        }
      }
    }

    // ── FALLBACK: if ALL chunks failed AI parsing, do a combined raw-text extraction ──
    if (completedChunks.length === 0 && chunks.length > 0) {
      console.log('ALOA-X: All chunks failed AI parsing. Running combined fallback extraction…');
      const rawTextSample = chunks
        .filter(c => c.rawText && c.rawText.length > 50)
        .sort((a, b) => a.chunkId - b.chunkId)
        .map(c => c.rawText)
        .join('\n\n')
        .slice(0, 30000);

      if (rawTextSample) {
        try {
          const effectiveType = gazettteInnerType ?? docType;
          const directExtract = await this.structurer.structureChunk(rawTextSample, effectiveType, 1, totalPages);
          if (directExtract) {
            // Also try to rescue the title
            if (!metadata?.title && directExtract.metadata?.title) {
              metadata = { ...metadata, title: directExtract.metadata.title };
            }
            completedChunks = [{
              chunkId: 0,
              startPage: 1,
              endPage: totalPages,
              rawText: rawTextSample,
              structuredData: directExtract,
              timestamp: Date.now(),
              status: 'completed',
            }];
          }
        } catch (e) {
          console.error('Fallback extraction failed:', e);
        }
      }
    }

    // ── Step 1: Client-side merge ─────────────────────────────────────
    let premerged: any;
    const effectiveMergeType = gazettteInnerType ?? docType;
    
    // Check if chunks use the new schema
    const isNewSchema = completedChunks.some(c => c.structuredData?.content_tree);

    if (isNewSchema) {
      premerged = this.mergeNewSchemaChunks(completedChunks);
    } else {
      switch (effectiveMergeType) {
        case 'ACT':
        case 'LFN':
          premerged = this.mergeActChunks(completedChunks);
          break;
        case 'RULES':
          premerged = this.mergeRulesChunks(completedChunks);
          break;
        case 'JUDGMENT':
          premerged = this.mergeJudgmentChunks(completedChunks);
          break;
        default:
          premerged = this.mergeActChunks(completedChunks);
      }
    }

    // ── Step 2: Deep reconstruction pass ────────────────────────────────
    // Always run: even for single-chunk docs, this corrects OCR artifacts,
    // sentence-fragment titles, and missorting from the raw extraction.
    let finalized = premerged;
    const rawTextSample = chunks
      .sort((a, b) => a.chunkId - b.chunkId)
      .slice(0, 2)
      .map(c => c.rawText)
      .join('\n\n')
      .slice(0, 8000); // First ~8K chars of document for AI cross-reference

    const reconstructed = await this.structurer.reconstructAndRevise(effectiveMergeType, premerged, rawTextSample);
    if (reconstructed) finalized = reconstructed;

    // ── Build full text from all chunks ───────────────────────────────
    const fullText = chunks
      .sort((a, b) => a.chunkId - b.chunkId)
      .map(c => c.rawText)
      .join('\n\n');

    // ── Build stats ───────────────────────────────────────────────────
    const stats = this.buildStats(effectiveMergeType, finalized);

    // ── Dynamic confidence calculation ────────────────────────────────
    const reasons: string[] = [];
    let finalConfidence = Number(initialConfidence) || 50;

    reasons.push(`Classification: ${initialConfidence}% match for ${docType}`);
    
    const successRate = chunks.length > 0 ? (completedChunks.length / chunks.length) * 100 : 0;
    if (successRate === 0) {
      reasons.push(`Fallback Extraction: Combined raw text pass used (-20%)`);
      finalConfidence -= 20;
    } else if (successRate < 100) {
      const penalty = Math.round((100 - successRate) / 2);
      finalConfidence -= penalty;
      reasons.push(`${Math.round(successRate)}% Chunk Success: Loss of structural continuity (-${penalty}%)`);
    } else {
      reasons.push(`100% Chunk Success: Full document continuity (+5%)`);
      finalConfidence += 5;
    }

    if (metadata?.title && metadata.title !== 'Untitled Document') {
      reasons.push(`Title Authenticated: Formal identification successful (+10%)`);
      finalConfidence += 10;
    } else {
      reasons.push(`Title Ambiguous: Heuristic fallback used for labeling (-10%)`);
      finalConfidence -= 10;
    }

    if (stats.totalSections || stats.totalRules || stats.totalHoldings) {
      reasons.push(`Structural Extraction: Intelligence items identified and mapped (+15%)`);
      finalConfidence += 15;
    } else {
      reasons.push(`Structural Extraction: 0 items identified. PDF may be scanned/non-standard (-20%)`);
      finalConfidence -= 20;
    }

    finalConfidence = Math.max(10, Math.min(99, finalConfidence));

    const result: IndexedDocument = {
      documentId,
      fileName: metadata?.title || fileName,
      documentType: docType,
      totalPages,
      totalChunks: chunks.length,
      processedAt: Date.now(),
      sessionId: documentId,
      confidence: finalConfidence,
      confidenceReasons: reasons,
      metadata,
      fullText,
      stats,
    };

    // Assign New Schema Fields
    if (finalized.content_tree) result.content_tree = finalized.content_tree;
    if (finalized.index_entries) result.index_entries = finalized.index_entries;
    if (finalized.validation_report) result.validation_report = finalized.validation_report;
    
    // Persist raw source text for the UI viewer
    result.full_raw_text = fullText;

    // Backward Compatibility Mapping (Map New -> Legacy for UI)
    if (finalized.content_tree) {
      const legacy = this.mapToLegacySchema(effectiveMergeType, finalized);
      if (effectiveMergeType === 'RULES') result.rulesIndex = legacy;
      else if (effectiveMergeType === 'ACT' || effectiveMergeType === 'LFN') result.actIndex = legacy;
      else if (effectiveMergeType === 'JUDGMENT') result.judgmentIndex = legacy;
    } else {
      // Direct assignment for legacy chunks
      if (effectiveMergeType === 'ACT' || effectiveMergeType === 'LFN' || (docType === 'GAZETTE' && gazettteInnerType === 'ACT')) {
        result.actIndex = finalized as ActIndex;
      } else if (effectiveMergeType === 'RULES' || (docType === 'GAZETTE' && gazettteInnerType === 'RULES')) {
        result.rulesIndex = finalized as RulesIndex;
      } else if (effectiveMergeType === 'JUDGMENT') {
        result.judgmentIndex = finalized as JudgmentIndex;
      }
    }

    return result;
  }

  // ── ACT/LFN MERGE ────────────────────────────────────────────────

  private mergeActChunks(chunks: ChunkData[]): ActIndex {
    const chaptersMap = new Map<string, any>();

    for (const chunk of chunks) {
      const chapterList: any[] = chunk.structuredData?.chapters ?? [];

      for (const chap of chapterList) {
        const key = String(chap.number ?? 'unknown');
        if (!chaptersMap.has(key)) {
          chaptersMap.set(key, {
            number: chap.number,
            title: chap.title,
            sections: [],
          });
        }
        const existing = chaptersMap.get(key);
        // Merge sections, avoiding duplicates by section number
        const existingSectionNums = new Set(existing.sections.map((s: any) => String(s.number)));
        for (const sec of chap.sections ?? []) {
          if (!existingSectionNums.has(String(sec.number))) {
            existing.sections.push(sec);
            existingSectionNums.add(String(sec.number));
          }
        }
      }
    }

    // Also handle flat sections (some Gemini outputs skip chapter nesting)
    const flatSections: any[] = [];
    for (const chunk of chunks) {
      if (!chunk.structuredData?.chapters && chunk.structuredData?.sections) {
        flatSections.push(...chunk.structuredData.sections);
      }
    }

    if (chaptersMap.size === 0 && flatSections.length > 0) {
      chaptersMap.set('1', {
        number: 1,
        title: undefined,
        sections: flatSections,
      });
    }

    const chapters = Array.from(chaptersMap.values()).sort(
      (a, b) => Number(a.number) - Number(b.number)
    );

    return { chapters };
  }

  // ── RULES MERGE ───────────────────────────────────────────────────

  private mergeRulesChunks(chunks: ChunkData[]): RulesIndex {
    const ordersMap = new Map<string, any>();
    const formsMap = new Map<string, any>();

    for (const chunk of chunks) {
      const orderList: any[] = chunk.structuredData?.orders ?? [];

      for (const order of orderList) {
        const key = String(order.number ?? 'unknown');
        if (!ordersMap.has(key)) {
          ordersMap.set(key, {
            number: order.number,
            title: order.title,
            rules: [],
          });
        }
        const existing = ordersMap.get(key);
        const existingRuleNums = new Set(existing.rules.map((r: any) => String(r.number)));
        for (const rule of order.rules ?? []) {
          if (!existingRuleNums.has(String(rule.number))) {
            existing.rules.push(rule);
            existingRuleNums.add(String(rule.number));
          }
        }
      }

      // Collect forms
      for (const form of chunk.structuredData?.forms ?? []) {
        const key = String(form.number ?? form.title);
        if (!formsMap.has(key)) formsMap.set(key, form);
      }
    }

    const orders = Array.from(ordersMap.values()).sort(
      (a, b) => Number(a.number) - Number(b.number)
    );

    return {
      orders,
      forms: Array.from(formsMap.values()),
    };
  }

  // ── NEW SCHEMA MERGE ──────────────────────────────────────────────

  private mergeNewSchemaChunks(chunks: ChunkData[]): any {
    const treeMap = new Map<string, any>();
    const entriesSet = new Map<string, any>();
    let metadata = {};

    for (const chunk of chunks) {
      const d = chunk.structuredData;
      if (!d) continue;

      if (d.document_metadata) metadata = { ...metadata, ...d.document_metadata };

      // Merge tree nodes by identifier
      for (const node of d.content_tree ?? []) {
        const key = `${node.level}-${node.identifier}`;
        if (!treeMap.has(key)) {
          treeMap.set(key, { ...node, children: node.children ?? [] });
        } else {
          const existing = treeMap.get(key);
          // Merge children recursively or by identifier
          node.children?.forEach((child: any) => {
            const childKey = `${child.level}-${child.identifier}`;
            if (!existing.children.find((c: any) => `${c.level}-${c.identifier}` === childKey)) {
              existing.children.push(child);
            }
          });
        }
      }

      // Merge index entries by citation
      for (const entry of d.index_entries ?? []) {
        if (!entriesSet.has(entry.citation)) {
          entriesSet.set(entry.citation, entry);
        }
      }
    }

    return {
      document_metadata: metadata,
      content_tree: Array.from(treeMap.values()),
      index_entries: Array.from(entriesSet.values()),
    };
  }

  private mapToLegacySchema(type: LegalDocType, data: any): any {
    if (type === 'RULES') {
      const orders = data.content_tree
        ?.filter((n: any) => n.type === 'order')
        .map((o: any) => ({
          number: o.identifier.replace(/^O\./i, ''),
          title: o.title,
          rules: o.children?.map((r: any) => ({
            number: r.identifier.split('r.').pop() || r.identifier,
            title: r.title,
            content: r.full_text,
          })) ?? [],
        }));
      return { orders };
    }

    if (type === 'ACT' || type === 'LFN') {
      const chapters = data.content_tree
        ?.filter((n: any) => n.type === 'chapter' || n.type === 'part')
        .map((c: any) => ({
          number: c.identifier.replace(/[^\d]/g, ''),
          title: c.title,
          sections: c.children?.map((s: any) => ({
            number: s.identifier.replace(/[^\d]/g, ''),
            title: s.title,
            content: s.full_text,
          })) ?? [],
        }));
      return { chapters };
    }

    return data;
  }

  // ── JUDGMENT MERGE ────────────────────────────────────────────────

  private mergeJudgmentChunks(chunks: ChunkData[]): JudgmentIndex {
    // Judgments: collect info across all chunks
    let suitNumber: string | undefined;
    let court: string | undefined;
    let dateDelivered: string | undefined;
    const partiesSet = new Set<string>();
    const judgesSet = new Set<string>();
    const holdingsArr: string[] = [];

    for (const chunk of chunks) {
      const d = chunk.structuredData;
      if (!d) continue;
      if (!suitNumber && d.suitNumber) suitNumber = d.suitNumber;
      if (!court && d.court) court = d.court;
      if (!dateDelivered && d.dateDelivered) dateDelivered = d.dateDelivered;
      (d.parties ?? []).forEach((p: string) => partiesSet.add(p));
      (d.judges ?? []).forEach((j: string) => judgesSet.add(j));
      (d.holdings ?? []).forEach((h: string) => holdingsArr.push(h));
    }

    return {
      suitNumber,
      court,
      dateDelivered,
      parties: Array.from(partiesSet),
      judges: Array.from(judgesSet),
      holdings: holdingsArr.slice(0, 20), // cap at 20 holdings
    };
  }

  // ── STATS ─────────────────────────────────────────────────────────

  private buildStats(docType: LegalDocType, index: any): IndexedDocument['stats'] {
    // New Schema Support
    if (index?.content_tree || index?.index_entries) {
      const entries = index.index_entries || [];
      const tree = index.content_tree || [];
      
      if (docType === 'RULES') {
        const totalOrders = tree.filter((n: any) => n.type === 'order').length;
        const totalRules = entries.filter((e: any) => e.element_type === 'rule').length;
        return { totalOrders, totalRules };
      }
      if (docType === 'ACT' || docType === 'LFN') {
        const totalChapters = tree.filter((n: any) => n.type === 'chapter').length;
        const totalSections = entries.filter((e: any) => e.element_type === 'section').length;
        return { totalChapters, totalSections };
      }
      return { totalItems: entries.length };
    }

    // Legacy Support
    if (docType === 'ACT' || docType === 'LFN') {
      const chapters = index?.chapters ?? [];
      const totalSections = chapters.reduce(
        (sum: number, c: any) => sum + (c.sections?.length ?? 0),
        0
      );
      return { totalSections };
    }
    if (docType === 'RULES') {
      const orders = index?.orders ?? [];
      const totalRules = orders.reduce(
        (sum: number, o: any) => sum + (o.rules?.length ?? 0),
        0
      );
      return { totalOrders: orders.length, totalRules };
    }
    if (docType === 'JUDGMENT') {
      return { totalHoldings: index?.holdings?.length ?? 0 };
    }
    return { totalItems: 0 };
  }
}
