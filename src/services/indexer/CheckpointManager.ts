// ARIA-X: Checkpoint Manager — LocalStorage-based resume system

import { ChunkData } from './indexerTypes';

const CHUNK_SIZE = 15; // pages per chunk (fixed)
const STORAGE_PREFIX = 'aloax_';
const MAX_CHUNKS_STORED = 50; // safety cap

export interface CheckpointMeta {
  documentId: string;
  fileName: string;
  documentType: string;
  totalPages: number;
  totalChunks: number;
  lastCompletedChunk: number; // -1 if none
  confidence: number;
  startedAt: number;
  updatedAt: number;
}

export class CheckpointManager {
  // ── META ──────────────────────────────────────────────────────────

  saveMetadata(meta: CheckpointMeta): void {
    try {
      localStorage.setItem(
        `${STORAGE_PREFIX}meta_${meta.documentId}`,
        JSON.stringify(meta)
      );
    } catch (e) {
      console.warn('CheckpointManager: could not save metadata', e);
    }
  }

  loadMetadata(documentId: string): CheckpointMeta | null {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}meta_${documentId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  getLastCompletedChunk(documentId: string): number {
    return this.loadMetadata(documentId)?.lastCompletedChunk ?? -1;
  }

  // ── CHUNKS ────────────────────────────────────────────────────────

  saveChunk(documentId: string, chunk: ChunkData): void {
    try {
      const key = `${STORAGE_PREFIX}chunk_${documentId}_${chunk.chunkId}`;
      // Only store structuredData + minimal metadata (not full rawText, too large)
      const payload = {
        chunkId: chunk.chunkId,
        startPage: chunk.startPage,
        endPage: chunk.endPage,
        structuredData: chunk.structuredData,
        rawText: chunk.rawText.slice(0, 50000), // cap at ~50KB per chunk
        timestamp: chunk.timestamp,
        status: chunk.status,
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (e) {
      // LocalStorage full — try clearing oldest chunks
      this.evictOldestChunks(documentId, 5);
      console.warn('CheckpointManager: localStorage full, evicted old chunks');
    }
  }

  loadChunk(documentId: string, chunkId: number): ChunkData | null {
    try {
      const raw = localStorage.getItem(
        `${STORAGE_PREFIX}chunk_${documentId}_${chunkId}`
      );
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  loadAllChunks(documentId: string, totalChunks: number): ChunkData[] {
    const chunks: ChunkData[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunk = this.loadChunk(documentId, i);
      if (chunk) chunks.push(chunk);
    }
    return chunks;
  }

  /** Calculate 0-indexed chunk ranges for page → chunk mapping */
  static getChunkForPage(page: number): number {
    return Math.floor((page - 1) / CHUNK_SIZE);
  }

  static getPageRange(chunkId: number, totalPages: number): { start: number; end: number } {
    const start = chunkId * CHUNK_SIZE + 1;
    const end = Math.min(start + CHUNK_SIZE - 1, totalPages);
    return { start, end };
  }

  static getTotalChunks(totalPages: number): number {
    return Math.ceil(totalPages / CHUNK_SIZE);
  }

  // ── CLEANUP ───────────────────────────────────────────────────────

  clearAll(documentId: string): void {
    const meta = this.loadMetadata(documentId);
    const totalChunks = meta?.totalChunks ?? MAX_CHUNKS_STORED;

    localStorage.removeItem(`${STORAGE_PREFIX}meta_${documentId}`);
    for (let i = 0; i < totalChunks; i++) {
      localStorage.removeItem(`${STORAGE_PREFIX}chunk_${documentId}_${i}`);
    }
  }

  /** Find any document IDs that have in-progress checkpoints */
  findResumableSessions(): CheckpointMeta[] {
    const sessions: CheckpointMeta[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${STORAGE_PREFIX}meta_`)) {
        try {
          const meta: CheckpointMeta = JSON.parse(localStorage.getItem(key)!);
          // Only show sessions that are not fully completed
          if (meta.lastCompletedChunk < meta.totalChunks - 1) {
            sessions.push(meta);
          }
        } catch {
          // skip corrupted entries
        }
      }
    }
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  private evictOldestChunks(documentId: string, count: number): void {
    for (let i = 0; i < count; i++) {
      localStorage.removeItem(`${STORAGE_PREFIX}chunk_${documentId}_${i}`);
    }
  }
}
