// ARIA-X: Nigerian Legal Document Indexer - Type Definitions

export type LegalDocType = 'JUDGMENT' | 'RULES' | 'ACT' | 'LFN' | 'GAZETTE';

export type ProcessingStatus =
  | 'idle'
  | 'classifying'
  | 'processing'
  | 'merging'
  | 'saving'
  | 'completed'
  | 'error'
  | 'resuming'
  | 'reviewing';

export interface DocumentMetadata {
  title: string;
  year?: string;
  jurisdiction?: string;
  source?: string; // e.g. Gazette No. X, Court Division
  number?: string; // e.g. Act No. X, Suit No. X
}

export interface ClassificationResult {
  type: LegalDocType;
  confidence: number; // 0-100
  metadata?: DocumentMetadata;
}

export interface ChunkData {
  chunkId: number;
  startPage: number;
  endPage: number;
  rawText: string;
  structuredData: any | null;
  timestamp: number;
  status: 'completed' | 'error';
  errorLog?: string;
}

export interface ProcessingProgress {
  status: ProcessingStatus;
  currentPage: number;
  totalPages: number;
  percentComplete: number;
  currentChunk?: number;
  totalChunks?: number;
  message?: string;
  errorMessage?: string;
}

export interface ActSection {
  number: string;
  title?: string;
  content?: string;
  repealed?: boolean;
}

export interface ActChapter {
  number: number | string;
  title?: string;
  sections: ActSection[];
}

export interface ActIndex {
  chapters: ActChapter[];
}

export interface RulesRule {
  number: string;
  title?: string;
  content?: string;
}

export interface RulesOrder {
  number: number | string;
  title?: string;
  rules: RulesRule[];
}

export interface RulesIndex {
  orders: RulesOrder[];
  forms?: Array<{ number: string; title: string }>;
}

export interface JudgmentIndex {
  suitNumber?: string;
  parties: string[];
  judges: string[];
  court?: string;
  dateDelivered?: string;
  holdings?: string[];
}

export interface ContentNode {
  level: number;
  identifier: string; // e.g. "O.1", "O.1 r.1", "s.36"
  type: string; // e.g. "order", "rule", "subrule", "section", "part"
  title: string;
  full_text?: string;
  children?: ContentNode[];
}

export interface IndexEntry {
  citation: string;
  hierarchy_path: string;
  element_type: string;
  full_text: string;
  summary?: string;
  keywords?: string[];
}

export interface ValidationReport {
  total_items_found: number;
  empty_parents_detected: number;
  cross_references_broken: string[];
}

export interface IndexedDocument {
  documentId: string;
  fileName: string;
  documentType: LegalDocType;
  totalPages: number;
  totalChunks: number;
  processedAt: number;
  sessionId: string;
  firmId?: string;
  confidence: number;
  confidenceReasons?: string[];
  metadata?: DocumentMetadata;

  // Master Prompt Schema (New)
  content_tree?: ContentNode[];
  index_entries?: IndexEntry[];
  validation_report?: ValidationReport;

  // Type-specific indexes (Legacy/Compat)
  actIndex?: ActIndex;
  rulesIndex?: RulesIndex;
  judgmentIndex?: JudgmentIndex;
  fullText: string;
  full_raw_text?: string;

  // Stats
  stats: {
    totalSections?: number;
    totalChapters?: number;
    totalOrders?: number;
    totalRules?: number;
    totalHoldings?: number;
    totalItems?: number;
  };
}

// Flat searchable item used by Fuse.js
export interface SearchableItem {
  id: string;
  type: string;
  label: string;  // Human-readable label
  text: string;   // Searchable text
  citation?: string;
  summary?: string;
  number?: string;
  parentLabel?: string;
  repealed?: boolean;
  documentId: string;
}

export interface SearchResult {
  item: SearchableItem;
  score?: number;
}

// Convex-compatible save payload
export interface ConvexDocumentPayload {
  sessionId: string;
  firmId?: string;
  fileName: string;
  documentType: string;
  totalPages: number;
  indexData: any;
  processedAt: number;
  status: string;
}
