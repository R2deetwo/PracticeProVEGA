/**
 * documentPacket — the DOCUMENT PACKET system for ALOA/ARIA (Task 69).
 *
 * ## Why this module exists
 *
 * 2026-09-24 user report: the user asked ALOA to "draft the documents
 * necessary" for a process. ALOA drafted ONE document; when the user said
 * "there are others", it drafted the next one *weakly* (a bare instruction
 * with none of the process context). The user's expectation — any lawyer's
 * expectation — is that the assistant ITEMISES the full set of documents
 * the job requires (ideally research-backed), gets a confirmation, and then
 * drafts each one with the full process context. That is a "document
 * packet".
 *
 * This module holds the packet data model and the prompt builder that makes
 * every packet draft a rich, context-carrying draft — no more thin
 * "draft the next document" prompts.
 */

// ─── Data model ─────────────────────────────────────────────────────────────

export interface PacketDocument {
    /** Document title, e.g. "Notice of Owner's Intention to Recover Possession". */
    name: string;
    /** What this document does in the process and why it is needed. */
    purpose: string;
    /** Statute/rule/section this document rests on (optional). */
    legalBasis?: string;
    /** Drafting notes: parties, timing, sequencing dependencies (optional). */
    notes?: string;
}

export interface PacketSource {
    type?: string;
    text: string;
    url?: string;
    jurisdiction?: string;
}

export interface DocumentPacket {
    /** Stable id for this packet instance. */
    jobId: string;
    /** Short name of the job/process, e.g. "Recovering possession of a tenanted flat in Lagos". */
    jobTitle: string;
    /** What the process is and the key steps, in order. */
    processSummary?: string;
    /** What the law requires of the person in this situation. */
    legalRequirements?: string;
    /** The itemised documents, in the order they are needed. */
    documents: PacketDocument[];
    /** Research sources backing the plan (optional). */
    sources?: PacketSource[];
    createdAt: string;
}

/** Result of preparing + opening one packet document in DraftPro.
 *  'ready' = the document is fully drafted and persisted (background
 *  pre-draft) — opening it loads the saved draft instantly. */
export interface PacketDraftResult {
    status: 'opened' | 'blocked' | 'ready' | 'error';
    draftKey: string;
    draftUrl: string;
    /** True when an existing saved draft was found (never re-drafted over). */
    hadContent: boolean;
    error?: string;
}

// ─── Detection heuristic ────────────────────────────────────────────────────

/**
 * True when a user message asks for a SET of documents for a process/job
 * ("the documents necessary", "all the documents to...", "paperwork for...").
 *
 * Used only for UX sugar (smarter status lines / research nudges) — the
 * decision to plan a packet is made by the model, guided by the identity
 * prompts. Keeping the heuristic loose is fine for that purpose.
 */
const DOCUMENT_SET_RE =
    /\b(documents?|paperwork|packets?|forms?)\b[^.?!]{0,40}\b(necessary|needed|required|need|to\s+(file|serve|submit|draft|prepare|process|complete|apply))|(all|every)\s+(the\s+)?(documents?|paperwork|forms?)|paperwork\s+for\b|what\s+do\s+i\s+need\b.{0,30}\b(file|serve|submit|apply|process|court|cac|probate|recover)/i;

export function mentionsDocumentSet(text: string): boolean {
    return DOCUMENT_SET_RE.test(text || '');
}

// ─── Prompt builder ─────────────────────────────────────────────────────────

/**
 * Build the rich, packet-aware drafting prompt for ONE document of a packet.
 *
 * This is the fix for the "rather weakly" second draft: every packet draft
 * carries the job, the process, the legal requirements, the document's own
 * purpose + legal basis, its position in the sequence, and the facts the
 * user has given in the conversation — so no packet document is ever drafted
 * from a bare instruction.
 */
export function buildPacketDraftPrompt(
    packet: DocumentPacket,
    docIndex: number,
    opts: {
        /** Recent user messages carrying the facts/parties. */
        conversationContext?: string;
        /** Atrium/property mode — the principal is a property manager. */
        isProperty?: boolean;
        /** Firm research knowledge from past web research (playbooks) —
         *  process order, legal requirements, document lists. Injected so
         *  the firm's accumulated research makes every draft sharper
         *  (2026-09-24 “learn from the web, never from user data”). */
        playbookContext?: string;
    } = {}
): string {
    const doc = packet.documents[docIndex];
    if (!doc) throw new Error(`buildPacketDraftPrompt: no document at index ${docIndex}`);

    const total = packet.documents.length;
    const lines: string[] = [];

    lines.push(`You are drafting ONE document from an approved document packet.`);
    lines.push('');
    lines.push(`THE JOB: ${packet.jobTitle}`);
    if (packet.processSummary) {
        lines.push(`THE PROCESS: ${packet.processSummary}`);
    }
    if (packet.legalRequirements) {
        lines.push(`WHAT THE LAW REQUIRES: ${packet.legalRequirements}`);
    }
    lines.push('');
    lines.push(`THIS DOCUMENT (${docIndex + 1} of ${total}): ${doc.name}`);
    if (doc.purpose) {
        lines.push(`PURPOSE IN THE PROCESS: ${doc.purpose}`);
    }
    if (doc.legalBasis) {
        lines.push(`LEGAL BASIS: ${doc.legalBasis}`);
    }
    if (doc.notes) {
        lines.push(`NOTES: ${doc.notes}`);
    }
    lines.push('');
    lines.push('INSTRUCTIONS:');
    lines.push(`- Draft the "${doc.name}" to fulfil the purpose stated above, as document ${docIndex + 1} of ${total} in the process described.`);
    lines.push('- Use [BRACKETED PLACEHOLDERS] for any fact not supplied below — never invent parties, dates, amounts, or addresses.');
    lines.push('- Apply the legal basis above; where you are not certain of an exact section number, cite the statute by name only — never fabricate a section.');
    lines.push(opts.isProperty
        ? '- The user is the property manager (drafting on the landlord/owner side) unless the facts below say otherwise.'
        : '- The user is the lawyer/solicitor (drafting for their client) unless the facts below say otherwise.');
    lines.push('- Structure the document according to its type (letter, notice, agreement, court process) — no court captions on non-court documents, no decorative recitals.');
    lines.push('- Zero vertical gaps: no empty paragraphs, no <br><br>, no spacer lines — the editor supplies all paragraph spacing at a fixed professional 1.5 line spacing.');
    lines.push('');
    if (opts.playbookContext && opts.playbookContext.trim()) {
        lines.push(opts.playbookContext.trim());
        lines.push('');
    }
    lines.push('FACTS FROM THE CONVERSATION:');
    lines.push(opts.conversationContext?.trim()
        ? opts.conversationContext.trim()
        : '(none supplied — use descriptive [BRACKETED PLACEHOLDERS] for every party, date, amount, and address.)');

    return lines.join('\n');
}

// ─── Keys ───────────────────────────────────────────────────────────────────

/**
 * Stable, collision-free draft-session key for one document of a packet.
 * Includes the packet job id so two different packets containing a document
 * with the same name never overwrite each other, and the doc name so two
 * documents within one packet never collide.
 */
export function packetDocDraftKey(packet: DocumentPacket, docIndex: number): string {
    const doc = packet.documents[docIndex];
    const jobToken = (packet.jobId || 'pkt').replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase();
    const docToken = (doc?.name || `doc-${docIndex}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
    return `draft:pkt-${jobToken}:${docToken || `doc-${docIndex}`}`;
}

/** Editor URL for a packet document draft (query params only — hash-free). */
export function packetDocDraftUrl(draftKey: string, title: string): string {
    return `/editor?draftKey=${encodeURIComponent(draftKey)}&title=${encodeURIComponent(title)}`;
}

// ─── Normalisation ──────────────────────────────────────────────────────────

/**
 * Normalise the raw `plan_document_packet` tool args into a DocumentPacket.
 * Returns null when the args carry no usable documents (caller should
 * reject the tool call with a corrective message).
 */
export function normalizePacketArgs(args: any): DocumentPacket | null {
    if (!args || typeof args !== 'object') return null;
    const rawDocs = Array.isArray(args.documents) ? args.documents : [];
    const documents: PacketDocument[] = rawDocs
        .filter((d: any) => d && typeof d.name === 'string' && d.name.trim())
        .map((d: any) => ({
            name: String(d.name).trim().slice(0, 200),
            purpose: String(d.purpose || '').trim().slice(0, 600),
            legalBasis: String(d.legalBasis || '').trim().slice(0, 400) || undefined,
            notes: String(d.notes || '').trim().slice(0, 600) || undefined,
        }));
    if (documents.length === 0) return null;

    const sources: PacketSource[] | undefined = Array.isArray(args.citations)
        ? (args.citations as any[])
            .filter((c: any) => c && typeof c.text === 'string' && c.text.trim())
            .slice(0, 12)
            .map((c: any) => ({
                type: String(c.type || 'other'),
                text: String(c.text).trim().slice(0, 400),
                url: c.url ? String(c.url).slice(0, 500) : undefined,
                jurisdiction: c.jurisdiction ? String(c.jurisdiction).slice(0, 80) : undefined,
            }))
        : undefined;

    return {
        jobId: `pkt${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        jobTitle: String(args.jobTitle || 'Document Packet').trim().slice(0, 200) || 'Document Packet',
        processSummary: String(args.processSummary || '').trim().slice(0, 1500) || undefined,
        legalRequirements: String(args.legalRequirements || '').trim().slice(0, 2000) || undefined,
        documents,
        sources: sources && sources.length > 0 ? sources : undefined,
        createdAt: new Date().toISOString(),
    };
}
