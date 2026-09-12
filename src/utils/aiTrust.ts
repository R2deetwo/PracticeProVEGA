/**
 * aiTrust — trust signals for ALOA / ARIA (and every AI output surface).
 *
 * WHY THIS EXISTS: ALOA/ARIA answers arrived as polished prose with zero
 * signaling about reliability. A hedged guess, a statute hallucination and
 * a well-sourced answer all rendered identically, and nothing was recorded
 * anywhere — so there was no audit trail of what the AI told users, and no
 * visual cue that the output requires professional review.
 *
 * Item 3 delivers five signals, all derived from the response text itself
 * (deterministic + unit-tested — no extra API calls, no latency):
 *
 *   1. "Review Required" — a non-dismissible red header on every AI output
 *      (rendered by the UI; the copy lives here).
 *   2. Confidence indicator — assessConfidence() scores hedging language,
 *      verification refusals, statutory specificity and citation coverage
 *      into HIGH / MODERATE / LOW with the evidence listed.
 *   3. Per-session disclaimer banner — copy constant + the sessionStorage
 *      key that scopes it to one appearance per session.
 *   4. "⚠ Unverified citation" — findUnverifiedCitationNumbers() finds
 *      inline [n] markers with no matching source entry; the UI injects a
 *      warning marker next to each one in the rendered HTML.
 *   5. Audit log — buildAiAuditPayload() normalizes the record every
 *      finalized AI output writes to the `ai_output_logs` Convex table.
 */

// ─── Copy constants ─────────────────────────────────────────────────────────
export const REVIEW_REQUIRED_TITLE = 'Review Required';
export const REVIEW_REQUIRED_HINT =
    'AI-generated output. Verify every fact, citation, and legal position before relying on it or filing it.';

export const AI_DISCLAIMER_TEXT =
    'AI responses can be wrong, incomplete, or outdated. Nothing here is legal advice — review every output before acting on it.';

/** sessionStorage key — the disclaimer banner shows once per browser session. */
export const AI_DISCLAIMER_SESSION_KEY = 'ai_disclaimer_acknowledged';

// ─── Confidence assessment ──────────────────────────────────────────────────
export type ConfidenceLevel = 'high' | 'moderate' | 'low';

export interface ConfidenceAssessment {
    level: ConfidenceLevel;
    /** 0..100 — deterministic heuristic score, NOT a probability. */
    score: number;
    /** Human-readable evidence lines (shown in the chip tooltip). */
    indicators: string[];
}

/** Hedging phrases — each hit lowers the score. */
const HEDGING_PATTERNS: Array<[RegExp, string]> = [
    [/\b(i think| i believe|i'm not sure|it seems|it appears|perhaps|possibly|potentially)\b/gi, 'hedging language'],
    [/\b(may|might|could)\s+(be|mean|apply|suggest)\b/gi, 'tentative phrasing'],
    [/\b(generally|typically|usually|in most cases|as far as i know)\b/gi, 'qualifier language'],
    [/\b(approximately|roughly|around|about)\s+\d/gi, 'approximate figures'],
];

/** Self-reported uncertainty — strong signal the output is NOT verified. */
const UNCERTAINTY_PATTERNS: Array<[RegExp, string]> = [
    [/\b(i cannot verify|cannot verify|unable to verify|could not verify|i don't (?:have|know)|not able to confirm)\b/gi, 'states it cannot verify'],
    [/\b(as an ai|i am an ai|language model)\b/gi, 'AI self-reference'],
    [/\b(i was unable to (?:find|locate|access)|no (?:record|source|document) (?:was )?found)\b/gi, 'source not found'],
    [/\b(unverified|unconfirmed|not (?:yet )?confirmed|unclear whether)\b/gi, 'explicit unverified flag'],
];

/** Specificity — statutory anchors raise confidence. */
const SPECIFICITY_PATTERNS: Array<[RegExp, string]> = [
    [/\b(?:section|s\.?)\s?\d+[a-z]?\b/gi, 'statutory section reference'],
    [/\b(?:cap\.|ch\.|chapter|vol\.)\s?\d+/gi, 'volume/chapter reference'],
    [/\b(?:laws? of (?:the federation|nigeria)|LFN|constitution)\b/gi, 'named statute'],
    [/\b(?:act|decree|regulation|rules)\s+(?:of|no\.?)?\s*\d{2,4}\b/gi, 'named enactment'],
    [/\b(?:19|20)\d{2}\b/g, 'specific year'],
    [/\b(?:supra|infra|ibid|at\s+\d+)\b/gi, 'pin-point reference'],
];

export interface AssessConfidenceArgs {
    /** Inline citation markers found in the text (e.g. from [1], [2]). */
    citationMarkers?: number[];
    /** Citation numbers that actually resolve to a parsed source entry. */
    verifiedCitationNumbers?: number[];
    /** Whether the response carried a "## Sources" block. */
    hasSourcesBlock?: boolean;
}

/**
 * Deterministic confidence heuristic. Score starts at 60 and moves:
 *   − hedging/uncertainty signals lower it; specificity anchors and
 *   citation coverage raise it. Level: ≥70 HIGH, ≥40 MODERATE, else LOW.
 */
export function assessConfidence(text: string, args: AssessConfidenceArgs = {}): ConfidenceAssessment {
    const indicators: string[] = [];
    let score = 60;

    for (const [pattern, label] of UNCERTAINTY_PATTERNS) {
        const hits = (text.match(pattern) || []).length;
        if (hits > 0) {
            score -= Math.min(24, hits * 12);
            indicators.push(`${label} (×${hits})`);
        }
    }
    for (const [pattern, label] of HEDGING_PATTERNS) {
        const hits = (text.match(pattern) || []).length;
        if (hits > 0) {
            score -= Math.min(12, hits * 3);
            indicators.push(`${label} (×${hits})`);
        }
    }
    let specificHits = 0;
    for (const [pattern, label] of SPECIFICITY_PATTERNS) {
        const hits = (text.match(pattern) || []).length;
        if (hits > 0) {
            specificHits += hits;
            if (!indicators.includes(`${label} (×${hits})`)) indicators.push(`${label} (×${hits})`);
        }
    }
    if (specificHits >= 2) score += Math.min(18, specificHits * 5);
    else if (specificHits === 1) score += 4;

    const markers = args.citationMarkers?.length ?? 0;
    const verified = args.verifiedCitationNumbers?.length ?? 0;
    if (markers > 0) {
        const coverage = verified / markers;
        if (coverage >= 0.999) {
            score += 12;
            indicators.push(`all ${markers} citation markers resolve to sources`);
        } else if (coverage > 0) {
            score += Math.round(8 * coverage);
            indicators.push(`${verified}/${markers} citation markers resolve to sources`);
        } else {
            score -= 8;
            indicators.push('citation markers present but no sources given');
        }
    } else if (args.hasSourcesBlock && verified > 0) {
        score += 6;
        indicators.push(`${verified} source${verified > 1 ? 's' : ''} listed`);
    } else {
        indicators.push('no citations provided');
    }

    score = Math.max(0, Math.min(100, score));
    const level: ConfidenceLevel = score >= 70 ? 'high' : score >= 40 ? 'moderate' : 'low';
    if (indicators.length === 0) indicators.push('plain expository response, no risk markers');
    return { level, score, indicators };
}

// ─── Unverified citations ───────────────────────────────────────────────────
/** Inline [n] citation markers used in the text, in order. */
export function findCitationMarkers(text: string): number[] {
    const out: number[] = [];
    const re = /\[(\d{1,3})\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        const n = parseInt(m[1], 10);
        if (!out.includes(n)) out.push(n);
    }
    return out;
}

/** Marker numbers with no matching parsed source — the "⚠ Unverified" set. */
export function findUnverifiedCitationNumbers(
    text: string,
    verifiedNumbers: number[],
): number[] {
    const verified = new Set(verifiedNumbers);
    return findCitationMarkers(text).filter(n => !verified.has(n));
}

/**
 * Inject a "⚠" warning marker after each unverified [n] in RENDERED HTML.
 * Only touches plain `[n]` text occurrences — never attributes, tags or
 * URLs — and HTML-escapes nothing new (the marker is a fixed safe string).
 */
const UNVERIFIED_SUP = '<sup data-unverified-citation="true" class="ai-unverified-cite" title="Unverified citation — no source was provided for this reference.">⚠</sup>';

export function markUnverifiedCitationsInHtml(html: string, unverifiedNumbers: number[]): string {
    if (!html || unverifiedNumbers.length === 0) return html;
    let out = html;
    for (const n of unverifiedNumbers) {
        // Only replace the bare bracketed number (not inside tags/attrs):
        // followed by a non-"[" boundary and NOT already wrapped by our sup.
        const marker = `[${n}]`;
        // Build a safe replacement one occurrence at a time, skipping
        // occurrences that live inside an HTML tag (<...>).
        let idx = out.indexOf(marker);
        while (idx !== -1) {
            const before = out.lastIndexOf('<', idx);
            const after = out.lastIndexOf('>', idx);
            const insideTag = before > after;
            if (!insideTag) {
                out = out.slice(0, idx) + marker + UNVERIFIED_SUP + out.slice(idx + marker.length);
                idx = out.indexOf(marker, idx + marker.length + UNVERIFIED_SUP.length);
            } else {
                idx = out.indexOf(marker, idx + marker.length);
            }
        }
    }
    return out;
}

// ─── Audit log payload ──────────────────────────────────────────────────────
export interface AiAuditInput {
    assistant: string;            // 'ARIA' | 'ALOA' | 'ALDIA' | ...
    text: string;
    model?: string;
    conversationId?: string;
    confidence?: ConfidenceAssessment;
    citationCount?: number;
    unverifiedCitationCount?: number;
    messageKind?: string;         // 'chat' | 'research' | 'draft'
}

export interface AiAuditPayload {
    assistant: string;
    model: string;
    conversationId: string;
    messageKind: string;
    confidenceLevel: string;
    confidenceScore: number;
    citationCount: number;
    unverifiedCitationCount: number;
    charCount: number;
    /** First 400 chars — enough to identify the output, never the whole PII. */
    preview: string;
}

export function buildAiAuditPayload(input: AiAuditInput): AiAuditPayload {
    const text = input.text || '';
    return {
        assistant: String(input.assistant || 'AI').slice(0, 24),
        model: String(input.model || 'unknown').slice(0, 80),
        conversationId: String(input.conversationId || '').slice(0, 80),
        messageKind: String(input.messageKind || 'chat').slice(0, 24),
        confidenceLevel: input.confidence?.level ?? 'unassessed',
        confidenceScore: Math.round(input.confidence?.score ?? -1),
        citationCount: Math.max(0, Math.min(999, Number(input.citationCount) || 0)),
        unverifiedCitationCount: Math.max(0, Math.min(999, Number(input.unverifiedCitationCount) || 0)),
        charCount: text.length,
        preview: text.slice(0, 400).replace(/\s+/g, ' ').trim(),
    };
}
