/**
 * citationRegistry — unified citation store shared across ALOA, DraftPro,
 * and the Research module.
 *
 * WHY THIS EXISTS
 * ---------------
 * When users combine AI-generated content with manual drafting, citations
 * can collide — the AI might add [1] [2] and the user might manually add
 * [1] for a different source. This registry ensures all citations map to
 * a single shared schema, preventing duplicates and enabling cross-module
 * citation persistence.
 *
 * HOW IT WORKS
 * ------------
 * - Citations are stored as objects with a unique ID, source text, and
 *   metadata (type, jurisdiction, URL, date accessed)
 * - Each citation gets a sequential number within the document context
 * - The registry is context-scoped (per document or per chat session)
 * - When content moves from ALOA to DraftPro, the citation payload
 *   travels with it and remains editable
 */

export type CitationType = 'case' | 'statute' | 'regulation' | 'journal' | 'book' | 'web' | 'other';

export interface Citation {
  id: string;
  number: number;
  type: CitationType;
  text: string;           // Full citation text in the requested style
  rawText: string;        // Original text as entered or generated
  jurisdiction?: string;   // e.g., "Nigeria", "UK", "US"
  url?: string;            // Source URL if available
  dateAccessed?: string;   // ISO date when the source was accessed
  pinReference?: string;   // Page or paragraph number (e.g., "at 45" or "para 12")
}

export class CitationRegistry {
  private citations: Map<string, Citation> = new Map();
  private nextNumber: number = 1;

  /**
   * Add a citation to the registry. If the same rawText already exists,
   * returns the existing citation's number (deduplication).
   */
  add(params: Omit<Citation, 'id' | 'number'>): Citation {
    // Check for duplicates by rawText
    for (const existing of this.citations.values()) {
      if (existing.rawText.trim().toLowerCase() === params.rawText.trim().toLowerCase()) {
        return existing;
      }
    }

    const id = `cite-${Date.now()}-${this.nextNumber}`;
    const citation: Citation = {
      ...params,
      id,
      number: this.nextNumber,
    };
    this.citations.set(id, citation);
    this.nextNumber++;
    return citation;
  }

  /**
   * Get a citation by its number (e.g., [1] → citation with number 1).
   */
  getByNumber(num: number): Citation | undefined {
    for (const c of this.citations.values()) {
      if (c.number === num) return c;
    }
    return undefined;
  }

  /**
   * Get all citations, sorted by number.
   */
  getAll(): Citation[] {
    return Array.from(this.citations.values()).sort((a, b) => a.number - b.number);
  }

  /**
   * Update a citation's text (e.g., when user edits it in DraftPro).
   */
  update(id: string, updates: Partial<Citation>): void {
    const existing = this.citations.get(id);
    if (existing) {
      this.citations.set(id, { ...existing, ...updates });
    }
  }

  /**
   * Remove a citation and renumber the remaining ones.
   */
  remove(id: string): void {
    this.citations.delete(id);
    // Renumber
    const sorted = this.getAll();
    this.citations.clear();
    this.nextNumber = 1;
    for (const c of sorted) {
      c.number = this.nextNumber;
      this.citations.set(c.id, c);
      this.nextNumber++;
    }
  }

  /**
   * Export the registry as a JSON payload (for persisting with the document).
   */
  toJSON(): { citations: Citation[] } {
    return { citations: this.getAll() };
  }

  /**
   * Import a JSON payload (e.g., when opening a document with existing citations).
   */
  static fromJSON(data: { citations: Citation[] }): CitationRegistry {
    const registry = new CitationRegistry();
    for (const c of data.citations) {
      registry.citations.set(c.id, c);
      if (c.number >= registry.nextNumber) {
        registry.nextNumber = c.number + 1;
      }
    }
    return registry;
  }

  /**
   * Render the citations as a formatted reference list.
   */
  renderReferenceList(style: 'bluebook' | 'oscola' | 'nigerian' | 'plain' = 'nigerian'): string {
    const citations = this.getAll();
    if (citations.length === 0) return '';

    const lines = citations.map((c) => {
      const prefix = `[${c.number}]`;
      switch (style) {
        case 'bluebook':
          return `${prefix} ${c.text}`;
        case 'oscola':
          return `${c.number}. ${c.text}`;
        case 'nigerian':
          return `${prefix} ${c.text}`;
        default:
          return `${prefix} ${c.text}`;
      }
    });

    return `Sources:\n${lines.join('\n')}`;
  }

  /**
   * Clear all citations.
   */
  clear(): void {
    this.citations.clear();
    this.nextNumber = 1;
  }
}

/**
 * Detect citation type from raw text.
 */
export function detectCitationType(text: string): CitationType {
  const lower = text.toLowerCase();
  if (lower.includes('v.') || lower.includes(' v ') || lower.includes('vs.')) {
    return 'case';
  }
  if (lower.includes('act') || lower.includes('law') || lower.includes('decree') || lower.includes('ordinance')) {
    return 'statute';
  }
  if (lower.includes('regulation') || lower.includes('rule') || lower.includes('order')) {
    return 'regulation';
  }
  if (lower.includes('journal') || lower.includes('review') || lower.includes('quarterly')) {
    return 'journal';
  }
  if (lower.includes('book') || lower.includes('treatise') || lower.includes('textbook')) {
    return 'book';
  }
  if (lower.includes('http') || lower.includes('www.') || lower.includes('.com') || lower.includes('.org')) {
    return 'web';
  }
  return 'other';
}
