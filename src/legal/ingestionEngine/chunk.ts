/**
 * chunk.ts — legal-boundary hierarchical chunking for the in-Convex
 * ingestion engine (the TS port of
 * tools/legal_ingester/legal_ingester/chunker.py — spec §4).
 *
 * STATUTES  : Part → Section → Subsection (+ Proviso). Each chunk carries
 *             its full boundary path so retrieval returns COMPLETE legal
 *             context ("Part C / Section 18 / (3) / proviso").
 * RULES OF COURT : Order → Rule → Sub-rule (2026-11-24, Workstream B —
 *             the High Court Civil Procedure Rules family chunks along
 *             its own hierarchy, not the statute one; "Order 28 Rule 3(2)"
 *             is exactly what a practitioner cites).
 * JUDGMENTS : Issue → Reasoning → Ratio heuristics; paragraph fallback
 *             windows never split mid-sentence.
 *
 * Chunks are bounded ~200–800 words: small enough for precise citation,
 * large enough to carry a whole provision. The Python regexes are ported
 * 1:1 so both engines produce the same boundary paths.
 */

export const MAX_CHUNK_WORDS = 800;
export const MIN_CHUNK_WORDS = 15;

export interface Chunk {
    boundaryPath: string[];
    heading: string;
    text: string;
    citations: string[];
}

const PART_RE = /^\s*PART\s+([A-Z0-9]+)\s*[—\-–:]?\s*(.*)$/i;
const SECTION_RE = /^\s*(?:SECTION|Section|s\.|S\.)\s*(\d+[A-Za-z]?)\.?\s*[—\-–:]?\s*(.*)$/;
const SUBSECTION_RE = /^\s*\((\d+[a-z]?)\)\s+(.*)$/;
const PROVISO_RE = /^\s*Provided\s+that\b/i;
const SCHEDULE_RE = /^\s*SCHEDULE\s+([0-9A-Z]*)/i;

// High Court Civil Procedure Rules family (2026-11-24, Workstream B):
// Order → Rule → Sub-rule. "ORDER 28" / "ORDER XXVIII" (roman numerals in
// older prints), "RULE 3", sub-rules as "(2)" under a rule (same visual
// shape as a statute subsection, so the RULE context must already be on
// the path). Kept 1:1 with the Python chunker.
const ORDER_RE = /^\s*ORDER\s+([0-9IVXLC]+[A-Za-z]?)\s*[—\-–:]?\s*(.*)$/i;
const RULE_RE = /^\s*(?:RULE|RULES)\s+(\d+[A-Za-z]?)\.?\s*[—\-–:]?\s*(.*)$/i;
// Sub-rule under a rule: "(2)" — only meaningful when the path already
// ends with a Rule (mirrors SUBSECTION_RE's path.length >= 2 guard).
const SUBRULE_RE = /^\s*\((\d+[a-z]?)\)\s+(.*)$/;

const ISSUES_RE = /^\s*(?:ISSUES?\s+FOR\s+DETERMINATION|ISSUES?\s+RAISED|THE\s+ISSUES?)\b/i;
const RATIO_RE = /^\s*(?:RATIO\s+DECIDENDI|RESOLUTION|HOLD\s*:|I\s+RESOLVE|APPEAL\s+DISMISSED|APPEAL\s+ALLOWED)\b/i;
const HEADING_RE = /^\s*(ISSUE\s+\w+|ARGUMENTS?|CONCLUSION|SUMMARY|BACKGROUND|FACTS|ANALYSIS)\b/i;

const CITATION_PATTERNS: RegExp[] = [
    /\[\d{4}\]\s*LPELR-\d+\s*\([A-Z]{2,4}\)/g,
    /\(\d{4}\)\s*\d+\s*N?W?L?R\s*\([^)]+\)\s*\d+/gi,
    /\bSection\s+\d+[A-Za-z]?\s+of\s+the\s+[A-Z][\w\s Act(),]{3,80}/g,
    /\bS\.\s*\d+\s+\([^)]{2,30}\)/g,
];

export function extractCitations(text: string): string[] {
    const found: string[] = [];
    for (const pattern of CITATION_PATTERNS) {
        pattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = pattern.exec(text)) !== null) found.push(m[0].trim());
    }
    const seen: string[] = [];
    for (const c of found) if (!seen.includes(c)) seen.push(c);
    return seen.slice(0, 10);
}

function flush(chunks: Chunk[], path: string[], heading: string, buf: string[]): void {
    const text = buf.join("\n").trim();
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words >= MIN_CHUNK_WORDS) {
        chunks.push({ boundaryPath: [...path], heading, text, citations: extractCitations(text) });
    } else if (words > 0) {
        // Short remainders merge upward ONLY within the same boundary —
        // never across a heading boundary (a short legal provision is
        // legitimately short; merging it into its parent would destroy
        // the citation boundary).
        const last = chunks[chunks.length - 1];
        if (last && last.boundaryPath.join("\u0000") === path.join("\u0000")) {
            last.text += "\n" + text;
            last.citations = extractCitations(last.text);
        } else {
            chunks.push({ boundaryPath: [...path], heading, text, citations: extractCitations(text) });
        }
    }
}

/** Oversized blocks split on sentence boundaries, never mid-sentence. */
export function splitLong(text: string): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= MAX_CHUNK_WORDS) return [text];
    const sentences = text.split(/(?<=[.!?])\s+/);
    const out: string[] = [];
    let cur: string[] = [];
    let count = 0;
    for (const sentence of sentences) {
        const sw = sentence.split(/\s+/).filter(Boolean).length;
        if (count + sw > MAX_CHUNK_WORDS && cur.length > 0) {
            out.push(cur.join(" "));
            cur = [];
            count = 0;
        }
        cur.push(sentence);
        count += sw;
    }
    if (cur.length > 0) out.push(cur.join(" "));
    return out;
}

function finalize(chunks: Chunk[], continuationPrefix: string): Chunk[] {
    const final: Chunk[] = [];
    for (const c of chunks) {
        const parts = splitLong(c.text);
        parts.forEach((part, i) => {
            final.push({
                boundaryPath: [...c.boundaryPath, ...(i ? [`${continuationPrefix}${i + 1}`] : [])],
                heading: c.heading,
                text: part,
                citations: extractCitations(part),
            });
        });
    }
    return final;
}

/** Part → Section → Subsection (+ Proviso) chunking. */
export function chunkInstrument(text: string): Chunk[] {
    const chunks: Chunk[] = [];
    let path: string[] = [];
    let heading = "Preamble";
    let buf: string[] = [];

    for (const rawLine of text.split("\n")) {
        const stripped = rawLine.trim();
        if (!stripped) {
            buf.push("");
            continue;
        }

        let m: RegExpExecArray | null;
        if ((m = PART_RE.exec(stripped))) {
            flush(chunks, path, heading, buf);
            path = [`PART ${m[1]}`];
            heading = (m[2] || `Part ${m[1]}`).trim();
            buf = [`PART ${m[1]} — ${heading}`];
            continue;
        }
        if ((m = SCHEDULE_RE.exec(stripped))) {
            flush(chunks, path, heading, buf);
            path = [`SCHEDULE ${m[1]}`.trim()];
            heading = stripped;
            buf = [stripped];
            continue;
        }
        // High Court Civil Procedure Rules family — checked BEFORE the
        // statute patterns: an "ORDER 28" line never matches SECTION_RE
        // anyway, but RULE_RE must not be shadowed by SUBSECTION-style
        // parses, and a rules-of-court sub-rule "(2)" must attach to the
        // enclosing Rule rather than a Section.
        if ((m = ORDER_RE.exec(stripped))) {
            flush(chunks, path, heading, buf);
            path = [`ORDER ${m[1]}`];
            heading = (m[2] || `Order ${m[1]}`).trim();
            buf = [`ORDER ${m[1]} — ${heading}`];
            continue;
        }
        if ((m = RULE_RE.exec(stripped)) && path.length >= 1 && /^ORDER /i.test(path[0])) {
            flush(chunks, path, heading, buf);
            path = [...path.slice(0, 1), `Rule ${m[1]}`];
            heading = (m[2] || `Rule ${m[1]}`).trim();
            buf = [`Rule ${m[1]} — ${heading}`];
            continue;
        }
        if ((m = SUBRULE_RE.exec(stripped)) && path.length >= 2 && /^Rule /i.test(path[1] || "")) {
            flush(chunks, path, heading, buf);
            path = [...path.slice(0, 2), `(${m[1]})`];
            heading = `${path[1]} (${m[1]})`;
            buf = [stripped];
            continue;
        }
        if ((m = SECTION_RE.exec(stripped))) {
            flush(chunks, path, heading, buf);
            path = [...path.slice(0, 1), `Section ${m[1]}`];
            heading = (m[2] || `Section ${m[1]}`).trim();
            buf = [`Section ${m[1]} — ${heading}`];
            continue;
        }
        if ((m = SUBSECTION_RE.exec(stripped)) && path.length >= 2) {
            flush(chunks, path, heading, buf);
            path = [...path.slice(0, 2), `(${m[1]})`];
            heading = path.length > 1 ? `${path[1]} (${m[1]})` : `(${m[1]})`;
            buf = [stripped];
            continue;
        }
        if (PROVISO_RE.test(stripped)) {
            // A proviso is its own chunk — it carves exceptions and is
            // exactly what practitioners cite.
            flush(chunks, path, heading, buf);
            chunks.push({
                boundaryPath: [...path, "proviso"],
                heading: "Proviso",
                text: stripped,
                citations: extractCitations(stripped),
            });
            buf = [];
            continue;
        }
        buf.push(stripped);
    }

    flush(chunks, path, heading, buf);
    return finalize(chunks, "cont.");
}

/** Issue → Reasoning → Ratio chunking with paragraph fallback. */
export function chunkJudgment(text: string): Chunk[] {
    const chunks: Chunk[] = [];
    let section = "Introduction";
    let buf: string[] = [];

    for (const rawLine of text.split("\n")) {
        const stripped = rawLine.trim();
        if (!stripped) {
            buf.push("");
            continue;
        }
        if (ISSUES_RE.test(stripped) || HEADING_RE.test(stripped) || RATIO_RE.test(stripped)) {
            flush(chunks, [section], section, buf);
            // Python .title() — capitalize each word group.
            section = stripped.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).slice(0, 80);
            buf = [stripped];
            continue;
        }
        buf.push(stripped);
    }
    flush(chunks, [section], section, buf);
    return finalize(chunks, "¶");
}

export function chunkDocument(documentType: string, text: string): Chunk[] {
    return documentType === "judgment" ? chunkJudgment(text) : chunkInstrument(text);
}
