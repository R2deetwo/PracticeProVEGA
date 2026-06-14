// ARIA-X: Legal Chunker — three-mode extraction engine
//
// Mode selection per chunk:
//   A) Text density ≥ 80 chars/page  →  Text mode (Gemini text + JSON)
//   B) Text density 10-79 chars/page →  Text mode first, image fallback if empty
//   C) Text density < 10 chars/page  →  Image mode (Gemini Vision + JSON)
//
// Each mode has a regex offline fallback as last resort.

import { LegalDocType, ChunkData, ProcessingProgress } from './indexerTypes';
import { TextExtractor } from './TextExtractor';
import { GeminiStructurer } from './GeminiStructurer';
import { CheckpointManager } from './CheckpointManager';

export type ProgressCallback = (progress: ProcessingProgress) => void;

/** Pages per chunk in text mode vs image mode */
const TEXT_CHUNK_PAGES  = 15;
const IMAGE_CHUNK_PAGES = 4; // Images are token-heavy, keep smaller

export class LegalChunker {
  private textExtractor = new TextExtractor();
  private checkpointManager = new CheckpointManager();
  private structurer: GeminiStructurer;

  constructor(geminiApiKey: string) {
    this.structurer = new GeminiStructurer(geminiApiKey);
  }

  // ─────────────────────────────────────────────────────────────────
  // PUBLIC: processAllChunks
  // ─────────────────────────────────────────────────────────────────

  async processAllChunks(
    pdfDoc: any,
    documentId: string,
    docType: LegalDocType,
    totalPages: number,
    onProgress: ProgressCallback,
    startFromChunk = 0
  ): Promise<ChunkData[]> {
    // ── Detect PDF type (text vs scanned) ──────────────────────────
    const textDensity = await this.textExtractor.getTextDensity(pdfDoc, 1, Math.min(4, totalPages));
    const isScanned = textDensity < 10;
    const isHybrid  = textDensity >= 10 && textDensity < 80;
    const chunkSize = isScanned ? IMAGE_CHUNK_PAGES : TEXT_CHUNK_PAGES;
    const totalChunks = Math.ceil(totalPages / chunkSize);

    console.log(`ARIA-X: Text density=${Math.round(textDensity)} chars/page | Mode=${isScanned ? 'VISION' : isHybrid ? 'HYBRID' : 'TEXT'} | ${totalChunks} chunks`);

    const allChunks: ChunkData[] = [];

    // Reload already-completed chunks from checkpoint
    for (let i = 0; i < startFromChunk; i++) {
      const saved = this.checkpointManager.loadChunk(documentId, i);
      if (saved) allChunks.push(saved);
    }

    // Process remaining chunks
    for (let chunkId = startFromChunk; chunkId < totalChunks; chunkId++) {
      const startPage = chunkId * chunkSize + 1;
      const endPage   = Math.min((chunkId + 1) * chunkSize, totalPages);

      onProgress({
        status: 'processing',
        currentPage: startPage,
        totalPages,
        percentComplete: Math.round((startPage / totalPages) * 83),
        currentChunk: chunkId,
        totalChunks,
        message: `${isScanned ? '📷 Vision' : '📝 Text'} mode — chunk ${chunkId + 1}/${totalChunks} (pages ${startPage}–${endPage})`,
      });

      const chunk = await this.processChunk(
        pdfDoc, chunkId, documentId, docType, totalPages,
        startPage, endPage, chunkSize, isScanned, isHybrid, onProgress
      );

      allChunks.push(chunk);

      // Save checkpoint
      const meta = this.checkpointManager.loadMetadata(documentId);
      if (meta) {
        this.checkpointManager.saveMetadata({ ...meta, lastCompletedChunk: chunkId, updatedAt: Date.now() });
      }

      onProgress({
        status: 'processing',
        currentPage: endPage,
        totalPages,
        percentComplete: Math.round(((chunkId + 1) / totalChunks) * 85),
        currentChunk: chunkId,
        totalChunks,
        message: chunk.structuredData
          ? `✅ Chunk ${chunkId + 1}/${totalChunks} indexed`
          : `⚠️ Chunk ${chunkId + 1}/${totalChunks} — low signal, continuing…`,
      });

      // Rate-limit pause between chunks (skip after last)
      if (chunkId < totalChunks - 1) {
        await new Promise(r => setTimeout(r, 2500));
      }
    }

    return allChunks;
  }

  // ─────────────────────────────────────────────────────────────────
  // PRIVATE: processChunk — smart mode switching
  // ─────────────────────────────────────────────────────────────────

  private async processChunk(
    pdfDoc: any,
    chunkId: number,
    documentId: string,
    docType: LegalDocType,
    totalPages: number,
    startPage: number,
    endPage: number,
    chunkSize: number,
    isScanned: boolean,
    isHybrid: boolean,
    onProgress: ProgressCallback
  ): Promise<ChunkData> {
    const totalChunks = Math.ceil(totalPages / chunkSize);
    let rawText = '';
    let structuredData: any = null;

    // ── Step 1: Always extract raw text (needed for fallbacks and full text) ──
    try {
      rawText = await this.textExtractor.extractFromPages(pdfDoc, startPage, endPage);
    } catch (err) {
      console.error(`TextExtractor failed chunk ${chunkId}:`, err);
    }

    const chunkTextDensity = rawText.length / Math.max(endPage - startPage + 1, 1);

    // ── Step 1.5: Extract TOC Blueprint on first chunk ────────
    if (chunkId === 0 && chunkTextDensity >= 20) {
      onProgress({
        status: 'processing', currentPage: startPage, totalPages,
        percentComplete: Math.round((startPage / totalPages) * 83),
        currentChunk: chunkId, totalChunks,
        message: `🔍 Anchoring blueprint to Table of Contents…`,
      });
      await this.structurer.extractTocBlueprint(rawText, docType);
    }

    // ── Step 2: Choose extraction mode ────────────────────────────
    if (!isScanned && chunkTextDensity >= 80) {
      // ── MODE A: Text mode ──────────────────────────────────────
      try {
        structuredData = await this.structurer.structureChunk(rawText, docType, startPage, endPage);
      } catch (err) {
        console.error(`Text structuring failed chunk ${chunkId}:`, err);
      }

    } else if (isScanned || chunkTextDensity < 10) {
      // ── MODE C: Vision mode (scanned PDF) ─────────────────────
      onProgress({
        status: 'processing', currentPage: endPage, totalPages,
        percentComplete: Math.round((startPage / totalPages) * 83),
        currentChunk: chunkId, totalChunks,
        message: `📷 Vision scanning pages ${startPage}–${endPage}…`,
      });

      const imageBase64s = await this.renderChunkPages(pdfDoc, startPage, endPage);

      if (imageBase64s.length > 0) {
        try {
          structuredData = await this.structurer.structureChunkFromImages(imageBase64s, docType, startPage, endPage);
        } catch (err) {
          console.error(`Vision structuring failed chunk ${chunkId}:`, err);
        }
      }

      // Also store OCR-like text from vision if rawText is empty
      if (!rawText || rawText.length < 50) {
        rawText = `[Pages ${startPage}–${endPage}: Vision-processed, text not extractable]`;
      }

    } else {
      // ── MODE B: Hybrid (sparse text — try text first, image fallback) ───
      try {
        structuredData = await this.structurer.structureChunk(rawText, docType, startPage, endPage);
      } catch (err) {
        console.warn(`Hybrid text mode failed chunk ${chunkId}, trying vision…`);
      }

      if (!structuredData || !this.structurer.hasContent(structuredData)) {
        const imageBase64s = await this.renderChunkPages(pdfDoc, startPage, endPage);
        if (imageBase64s.length > 0) {
          try {
            const visionResult = await this.structurer.structureChunkFromImages(imageBase64s, docType, startPage, endPage);
            if (visionResult && this.structurer.hasContent(visionResult)) {
              structuredData = visionResult;
            }
          } catch (err) {
            console.error(`Vision fallback failed chunk ${chunkId}:`, err);
          }
        }
      }
    }

    // ── Step 3: Save checkpoint ────────────────────────────────────
    const chunk: ChunkData = {
      chunkId,
      startPage,
      endPage,
      rawText,
      structuredData,
      timestamp: Date.now(),
      status: (structuredData && this.structurer.hasContent(structuredData)) ? 'completed' : 'error',
      errorLog: structuredData
        ? (this.structurer.hasContent(structuredData) ? undefined : 'AI returned empty structure')
        : 'All extraction modes returned null',
    };

    this.checkpointManager.saveChunk(documentId, chunk);
    return chunk;
  }

  // ─────────────────────────────────────────────────────────────────
  // PRIVATE: renderChunkPages — PDF pages → base64 images
  // ─────────────────────────────────────────────────────────────────

  private async renderChunkPages(pdfDoc: any, startPage: number, endPage: number): Promise<string[]> {
    const images: string[] = [];
    const limit = Math.min(endPage, pdfDoc.numPages);

    for (let pageNum = startPage; pageNum <= limit; pageNum++) {
      try {
        const b64 = await this.textExtractor.renderPageToImage(pdfDoc, pageNum, 1.2);
        if (b64) images.push(b64);
      } catch (err) {
        console.warn(`Image render failed for page ${pageNum}:`, err);
      }

      // Small delay between page renders to avoid memory spikes
      await new Promise(r => setTimeout(r, 100));
    }

    return images;
  }
}
