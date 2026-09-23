/**
 * legalPlaybookStore — ALOA's firm-scoped LEGAL KNOWLEDGE memory built
 * from WEB RESEARCH (2026-09-24, user feedback round 3).
 *
 * ## The user's requirement, verbatim intent
 *   "let us ensure that anything it gets from the web it LEARNS FROM in
 *    terms of legal drafting and law — but it should not use USER DATA
 *    to learn."
 *
 * ## What this store does
 * When ALOA researches a process on the web and plans a document packet,
 * the PROCESS KNOWLEDGE (what the process is, what the law requires of
 * the person, which documents the job needs, and the sources) is saved
 * as a "playbook" scoped to the firm. The NEXT time the firm handles a
 * similar job, the playbook is injected into the drafting prompt — so
 * drafts get sharper and better-anchored over time.
 *
 * ## What this store NEVER does
 *   - It never stores the user's facts: no conversation text, no party
 *     names, no addresses, no amounts from the user. `scrubUserIdentifiers`
 *     defensively strips anything that smells like personal data from the
 *     research-side text before it is persisted.
 *   - It never sends this data anywhere — it is a localStorage store on
 *     the firm's own devices (mirrors draftSession's storage strategy).
 */

export interface PlaybookDocument {
    name: string;
    purpose: string;
    legalBasis?: string;
}

export interface PlaybookSource {
    text: string;
    url?: string;
}

export interface LegalPlaybook {
    id: string;
    /** Short job/process name, e.g. "Recovering possession of a tenanted flat in Lagos". */
    jobTitle: string;
    /** Lowercased keyword tokens for retrieval scoring. */
    keywords: string[];
    /** What the process is, in order — from research. */
    processSummary: string;
    /** What the law requires — from research. */
    legalRequirements: string;
    /** The document list the job needs — from research. */
    documents: PlaybookDocument[];
    /** Research sources backing the playbook. */
    sources: PlaybookSource[];
    createdAt: string;
    updatedAt: string;
    useCount: number;
}

const MAX_PLAYBOOKS = 20;
const STOPWORDS = new Set([
    'the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'and', 'or', 'with',
    'what', 'which', 'who', 'how', 'do', 'does', 'i', 'we', 'my', 'our',
    'is', 'are', 'be', 'need', 'needs', 'necessary', 'required', 'require',
    'documents', 'document', 'paperwork', 'process', 'processes', 'please',
    'draft', 'drafts', 'prepare', 'me', 'you', 'it', 'this', 'that',
]);

function storageKey(firmId: string) {
    return `legalplaybooks:${firmId}`;
}

/**
 * Defensive scrub of user-identifying material from research text before
 * it is persisted. The packet fields this runs over should already be
 * process knowledge (they come from the model's research synthesis, not
 * from the user's messages) — but one over-eager model paragraph quoting
 * "Chidi Okafor of 12 Marina Road" must never end up in the firm's
 * knowledge base.
 */
export function scrubUserIdentifiers(text: string): string {
    if (!text) return '';
    return text
        // Emails
        .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[CONTACT]')
        // Phone numbers (Nigerian and generic digit runs of 7+)
        .replace(/(?:\+234|0)\d[\d\s-]{8,13}\d/g, '[CONTACT]')
        // Anything still in [BRACKETED PLACEHOLDER] form (model-side
        // placeholders usually wrap user facts it was told to insert)
        .replace(/\[[^\]\n]{1,120}\]/g, '[DETAIL]')
        // Long digit runs that look like account/matter numbers
        .replace(/\b\d{7,}\b/g, '[REF]');
}

function tokenize(text: string): string[] {
    return (text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 2 && !STOPWORDS.has(t));
}

function readAll(firmId: string): LegalPlaybook[] {
    try {
        const raw = localStorage.getItem(storageKey(firmId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as LegalPlaybook[]) : [];
    } catch {
        return [];
    }
}

function writeAll(firmId: string, books: LegalPlaybook[]) {
    try {
        localStorage.setItem(storageKey(firmId), JSON.stringify(books));
    } catch (e) {
        console.warn('[legalPlaybookStore] save failed', e);
    }
}

export interface SavePlaybookInput {
    jobTitle: string;
    processSummary?: string;
    legalRequirements?: string;
    documents: PlaybookDocument[];
    sources?: PlaybookSource[];
}

/**
 * Save (or merge into) a playbook built from web research. Only
 * process-level knowledge is stored — the input comes from the packet
 * PLAN (research side), never from the user's conversation facts, and
 * every text field is scrubbed regardless.
 */
export function savePlaybook(firmId: string, input: SavePlaybookInput): LegalPlaybook | null {
    if (!firmId || !input || !input.jobTitle || !Array.isArray(input.documents) || input.documents.length === 0) {
        return null;
    }

    const jobTitle = scrubUserIdentifiers(input.jobTitle.trim()).slice(0, 200);
    const processSummary = scrubUserIdentifiers(input.processSummary || '').slice(0, 1500);
    const legalRequirements = scrubUserIdentifiers(input.legalRequirements || '').slice(0, 2000);
    const documents = input.documents.slice(0, 24).map(d => ({
        name: scrubUserIdentifiers(String(d.name || '').trim()).slice(0, 200),
        purpose: scrubUserIdentifiers(String(d.purpose || '').trim()).slice(0, 600),
        legalBasis: d.legalBasis ? scrubUserIdentifiers(String(d.legalBasis).trim()).slice(0, 400) : undefined,
    })).filter(d => d.name);
    const sources = (input.sources || []).slice(0, 12).map(s => ({
        text: scrubUserIdentifiers(String(s.text || '').trim()).slice(0, 400),
        url: s.url ? String(s.url).slice(0, 500) : undefined,
    })).filter(s => s.text || s.url);

    if (documents.length === 0) return null;

    const books = readAll(firmId);
    const now = new Date().toISOString();

    // Merge on job-title similarity (>60% token overlap) — re-researching
    // a job the firm has done before REFRESHES the playbook instead of
    // piling up near-duplicates.
    const titleTokens = new Set(tokenize(jobTitle));
    let target: LegalPlaybook | undefined;
    let bestOverlap = 0;
    for (const b of books) {
        const bTokens = new Set([...tokenize(b.jobTitle), ...b.keywords]);
        let overlap = 0;
        titleTokens.forEach(t => { if (bTokens.has(t)) overlap++; });
        const score = titleTokens.size > 0 ? overlap / titleTokens.size : 0;
        if (score > bestOverlap) { bestOverlap = score; target = b; }
    }

    if (target && bestOverlap >= 0.6) {
        target.jobTitle = jobTitle;
        if (processSummary) target.processSummary = processSummary;
        if (legalRequirements) target.legalRequirements = legalRequirements;
        target.documents = documents;
        if (sources.length > 0) target.sources = sources;
        target.keywords = Array.from(new Set([...tokenize(jobTitle), ...documents.map(d => tokenize(d.name)).flat()])).slice(0, 60);
        target.updatedAt = now;
    } else {
        target = {
            id: `pbk${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
            jobTitle,
            keywords: Array.from(new Set([...tokenize(jobTitle), ...documents.map(d => tokenize(d.name)).flat()])).slice(0, 60),
            processSummary,
            legalRequirements,
            documents,
            sources,
            createdAt: now,
            updatedAt: now,
            useCount: 0,
        };
        books.unshift(target);
    }

    // LRU cap — drop the least-recently-updated beyond the cap.
    if (books.length > MAX_PLAYBOOKS) {
        books.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        books.length = MAX_PLAYBOOKS;
    }

    writeAll(firmId, books);
    return target;
}

/**
 * Find playbooks relevant to a job description / drafting request.
 * Token-overlap scoring against jobTitle + keywords + document names.
 * The most relevant playbook is bumped (useCount) so the firm's common
 * jobs float to the top over time.
 */
export function findRelevantPlaybooks(firmId: string, query: string, limit = 2): LegalPlaybook[] {
    if (!firmId || !query) return [];
    const books = readAll(firmId);
    if (books.length === 0) return [];

    const qTokens = tokenize(query);
    if (qTokens.length === 0) return [];

    const scored = books.map(b => {
        const bTokens = new Set([
            ...tokenize(b.jobTitle),
            ...b.keywords,
            ...b.documents.flatMap(d => tokenize(d.name)),
        ]);
        let hits = 0;
        qTokens.forEach(t => { if (bTokens.has(t)) hits++; });
        return { book: b, score: hits / qTokens.length };
    });

    const relevant = scored
        .filter(s => s.score >= 0.25)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(s => s.book);

    if (relevant.length > 0) {
        const ids = new Set(relevant.map(b => b.id));
        for (const b of books) if (ids.has(b.id)) b.useCount += 1;
        writeAll(firmId, books);
    }
    return relevant;
}

/**
 * Render playbooks into a prompt-injectable knowledge block. Short,
 * capped, and clearly labelled so the model treats it as reference
 * knowledge (not user facts).
 */
export function renderPlaybookContext(playbooks: LegalPlaybook[]): string {
    if (!playbooks || playbooks.length === 0) return '';
    const blocks = playbooks.map((b, i) => {
        const lines: string[] = [];
        lines.push(`PLAYBOOK ${i + 1} — ${b.jobTitle} (from this firm's past research)`);
        if (b.processSummary) lines.push(`Process: ${b.processSummary}`);
        if (b.legalRequirements) lines.push(`What the law requires: ${b.legalRequirements}`);
        if (b.documents.length > 0) {
            lines.push(`Documents this job needs: ${b.documents.map(d => d.name).join('; ')}.`);
        }
        return lines.join('\n');
    });
    return [
        'FIRM RESEARCH KNOWLEDGE (learned from public legal research — NOT user facts):',
        ...blocks,
        'Use this as background knowledge for structure, process order and legal basis. It does NOT replace the user\'s instructions — where they conflict, the user wins. Do NOT copy user-specific details from anywhere except the FACTS given below.',
    ].join('\n');
}

/** Test/debug helper. */
export function clearPlaybooks(firmId: string) {
    try { localStorage.removeItem(storageKey(firmId)); } catch { /* ignore */ }
}
