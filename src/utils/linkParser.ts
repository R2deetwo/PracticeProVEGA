/**
 * linkParser — bidirectional linking system for PracticePro.
 *
 * Parses [[Entity Name]] syntax from note content, matches against
 * matters, contacts, properties, documents, and other notes, and
 * provides utilities for rendering clickable links and finding backlinks.
 *
 * USAGE:
 *   1. User types [[John Doe in a note
 *   2. LinkAutocomplete shows matching entities
 *   3. User selects one → [[John Doe v. State]] is inserted
 *   4. On save, extractLinks() parses the content and stores the links
 *   5. renderLinks() converts [[...]] to clickable <a> tags for display
 *   6. BacklinksPanel queries for notes that link to a given entity
 */

export interface BiLink {
  /** The entity type: matter, contact, property, document, note */
  type: 'matter' | 'contact' | 'property' | 'document' | 'note';
  /** The entity's ID */
  id: string;
  /** The display label (e.g. "John Doe v. State") */
  label: string;
}

export interface EntitySearchResult {
  type: BiLink['type'];
  id: string;
  label: string;
  subtitle?: string;
}

/**
 * Extract all [[...]] patterns from a text string.
 * Returns the raw labels (before entity matching).
 */
export function extractLinkLabels(content: string): string[] {
  const regex = /\[\[([^\]]+)\]\]/g;
  const labels: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    labels.push(match[1].trim());
  }
  return labels;
}

/**
 * Match a label against entities in the app state.
 * Returns the best match (first match by exact title, then by partial).
 */
export function matchLabelToEntity(
  label: string,
  entities: {
    matters?: any[];
    contacts?: any[];
    properties?: any[];
    documents?: any[];
    notes?: any[];
  }
): EntitySearchResult | null {
  const normalized = label.trim().toLowerCase();

  // Search matters
  if (entities.matters) {
    const exact = entities.matters.find(m => (m.title || '').toLowerCase() === normalized);
    if (exact) return { type: 'matter', id: exact.id, label: exact.title, subtitle: 'Matter' };
    const partial = entities.matters.find(m => (m.title || '').toLowerCase().includes(normalized));
    if (partial) return { type: 'matter', id: partial.id, label: partial.title, subtitle: 'Matter' };
  }

  // Search contacts
  if (entities.contacts) {
    const exact = entities.contacts.find(c => (c.name || '').toLowerCase() === normalized);
    if (exact) return { type: 'contact', id: exact.id, label: exact.name, subtitle: 'Contact' };
    const partial = entities.contacts.find(c => (c.name || '').toLowerCase().includes(normalized));
    if (partial) return { type: 'contact', id: partial.id, label: partial.name, subtitle: 'Contact' };
  }

  // Search properties
  if (entities.properties) {
    const exact = entities.properties.find(p =>
      (p.name || '').toLowerCase() === normalized || (p.address || '').toLowerCase() === normalized
    );
    if (exact) return { type: 'property', id: exact.id, label: exact.name || exact.address, subtitle: 'Property' };
    const partial = entities.properties.find(p =>
      (p.name || '').toLowerCase().includes(normalized) || (p.address || '').toLowerCase().includes(normalized)
    );
    if (partial) return { type: 'property', id: partial.id, label: partial.name || partial.address, subtitle: 'Property' };
  }

  // Search documents
  if (entities.documents) {
    const exact = entities.documents.find(d => (d.title || '').toLowerCase() === normalized);
    if (exact) return { type: 'document', id: exact.id, label: exact.title, subtitle: 'Document' };
    const partial = entities.documents.find(d => (d.title || '').toLowerCase().includes(normalized));
    if (partial) return { type: 'document', id: partial.id, label: partial.title, subtitle: 'Document' };
  }

  // Search notes
  if (entities.notes) {
    const exact = entities.notes.find(n => (n.title || '').toLowerCase() === normalized);
    if (exact) return { type: 'note', id: exact.id, label: exact.title, subtitle: 'Note' };
    const partial = entities.notes.find(n => (n.title || '').toLowerCase().includes(normalized));
    if (partial) return { type: 'note', id: partial.id, label: partial.title, subtitle: 'Note' };
  }

  return null;
}

/**
 * Extract and resolve all [[...]] links from content.
 * Returns an array of BiLink objects with entity IDs.
 */
export function extractLinks(
  content: string,
  entities: {
    matters?: any[];
    contacts?: any[];
    properties?: any[];
    documents?: any[];
    notes?: any[];
  }
): BiLink[] {
  const labels = extractLinkLabels(content);
  const links: BiLink[] = [];
  const seen = new Set<string>();

  for (const label of labels) {
    const match = matchLabelToEntity(label, entities);
    if (match) {
      const key = `${match.type}:${match.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        links.push({ type: match.type, id: match.id, label: match.label });
      }
    }
  }

  return links;
}

/**
 * Search entities for autocomplete suggestions.
 * Returns up to 10 results matching the query.
 */
export function searchEntities(
  query: string,
  entities: {
    matters?: any[];
    contacts?: any[];
    properties?: any[];
    documents?: any[];
    notes?: any[];
  },
  maxResults = 10
): EntitySearchResult[] {
  if (!query || query.trim().length < 1) return [];
  const q = query.trim().toLowerCase();
  const results: EntitySearchResult[] = [];

  const addResult = (type: BiLink['type'], id: string, label: string, subtitle: string) => {
    if (results.length >= maxResults) return;
    if (label.toLowerCase().includes(q)) {
      results.push({ type, id, label, subtitle });
    }
  };

  if (entities.matters) {
    for (const m of entities.matters) {
      addResult('matter', m.id, m.title || 'Untitled', 'Matter');
    }
  }
  if (entities.contacts) {
    for (const c of entities.contacts) {
      addResult('contact', c.id, c.name || 'Unknown', 'Contact');
    }
  }
  if (entities.properties) {
    for (const p of entities.properties) {
      addResult('property', p.id, p.name || p.address || 'Untitled', 'Property');
    }
  }
  if (entities.documents) {
    for (const d of entities.documents) {
      addResult('document', d.id, d.title || 'Untitled', 'Document');
    }
  }
  if (entities.notes) {
    for (const n of entities.notes) {
      addResult('note', n.id, n.title || 'Untitled', 'Note');
    }
  }

  return results.slice(0, maxResults);
}

/**
 * Convert [[...]] patterns in HTML content to clickable <a> tags.
 * Called when rendering note content for display.
 */
export function renderLinksAsHtml(content: string): string {
  if (!content) return '';
  // Replace [[Entity Name]] with clickable links
  // The data-type and data-id attributes are used for click handling
  return content.replace(/\[\[([^\]]+)\]\]/g, (_, label) => {
    const trimmed = label.trim();
    return `<a class="bi-link" data-label="${trimmed}" style="color: #2563eb; text-decoration: underline; cursor: pointer; font-weight: 600;">${trimmed}</a>`;
  });
}

/**
 * Find all notes that reference a given entity (backlinks).
 * Returns notes that have a link pointing to the entity.
 */
export function findBacklinks(
  entityId: string,
  entityType: BiLink['type'],
  notes: any[]
): { note: any; link: BiLink }[] {
  const backlinks: { note: any; link: BiLink }[] = [];

  for (const note of notes) {
    // Check the note's stored links array (if available)
    if (note.links && Array.isArray(note.links)) {
      const link = note.links.find((l: BiLink) => l.type === entityType && l.id === entityId);
      if (link) {
        backlinks.push({ note, link });
      }
    }
    // Also check the note's content for [[...]] patterns as a fallback
    if (note.content) {
      const labels = extractLinkLabels(note.content);
      for (const label of labels) {
        // If we already found this note via stored links, skip
        if (backlinks.some(b => b.note.id === note.id)) continue;
        // We can't match without entities, but the stored links should cover this
      }
    }
  }

  return backlinks;
}

/**
 * Get the view name and ID for navigating to an entity.
 */
export function getEntityNavigation(link: BiLink): { view: string; id: string } {
  switch (link.type) {
    case 'matter': return { view: 'matterDetail', id: link.id };
    case 'contact': return { view: 'contactDetail', id: link.id };
    case 'property': return { view: 'propertyDetail', id: link.id };
    case 'document': return { view: 'documentDetail', id: link.id };
    case 'note': return { view: 'notes', id: link.id };
    default: return { view: 'dashboard', id: '' };
  }
}

/**
 * Get an icon for an entity type.
 */
export function getEntityIcon(type: BiLink['type']): string {
  switch (type) {
    case 'matter': return 'briefcase';
    case 'contact': return 'user';
    case 'property': return 'building';
    case 'document': return 'document';
    case 'note': return 'pencil';
    default: return 'link';
  }
}
