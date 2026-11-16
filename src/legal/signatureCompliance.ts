/**
 * signatureCompliance — legal practitioner signature-block requirements.
 *
 * PART OF THE ALOA LEGAL ENGINE (deterministic control plane, Pillar 1).
 *
 * Filed processes must carry the legal practitioner's identifying
 * particulars: full name, Call-to-Bar number, and the NBA Seal & Stamp on
 * processes that require it. A process signed without these is liable to
 * be rejected at the registry or treated as improperly signed — so the
 * draft text is scanned for all three elements before export/filing.
 *
 * HONESTY (deliberate): the governing instrument is cited generically.
 * The Rules of Professional Conduct and the NBA Seal & Stamp regime are
 * the sources, but the exact instrument, edition and rule number must be
 * confirmed by the firm for the relevant period and forum — no rule number
 * is fabricated here. This mirrors the repo's V5 rule: never assert a
 * pinpoint that has not been verified.
 */

export interface SignatureComplianceResult {
    present: {
        fullName: boolean;
        callToBarNumber: boolean;
        nbaSealStamp: boolean;
    };
    missing: string[];
    checkedPatterns: string[];
    citation: string;
    verifyNote: string;
}

export const SIGNATURE_CITATION =
    'Rules of Professional Conduct for Legal Practitioners; NBA Seal & Stamp requirements for filed processes';
export const SIGNATURE_VERIFY_NOTE =
    'Confirm the current instrument, edition and rule number for your forum before relying on this check — the engine does not assert a pinpoint.';

// ─── Detection patterns ─────────────────────────────────────────────────────

/** Full name: "Esq." after a name, or an explicit name label in the block. */
const FULL_NAME_PATTERNS: RegExp[] = [
    /\bEsq\.?\b/i,
    /\b(?:name|counsel|solicitor)\s*:\s*[A-Z][a-z]+/i,
    /\bsigned\s*:?\s*[A-Z][a-z]+/i,
];

/** Call-to-Bar: explicit label, or an NBA/SC number token. */
const CALL_TO_BAR_PATTERNS: RegExp[] = [
    /\bcall\s*to\s*bar\b/i,
    /\bNBA\s*\/?\s*SC\s*[-/]?\s*\d{3,}/i,
    /\bSC\s*\/\s*\d{3,}\b/,
    /\bbar\s*(?:no|number|#)\s*[:.]?\s*\d{3,}/i,
];

/** NBA Seal & Stamp: the seal/stamp mention on filed processes. */
const NBA_SEAL_PATTERNS: RegExp[] = [
    /\bnba\b[^.\n]{0,40}\b(seal|stamp)\b/i,
    /\b(seal|stamp)\b[^.\n]{0,40}\bnba\b/i,
    /\bseal\s+and\s+stamp\b/i,
];

const anyMatch = (text: string, patterns: RegExp[]): boolean =>
    patterns.some(p => p.test(text));

/**
 * Scan a draft's text for the three signature-block elements. The input is
 * plain text (callers strip HTML first). Advisory by design — the result
 * lists what is missing so the lawyer can complete the block; nothing is
 * auto-inserted.
 */
export function checkSignatureBlock(text: string): SignatureComplianceResult {
    const t = text || '';

    const present = {
        fullName: anyMatch(t, FULL_NAME_PATTERNS),
        callToBarNumber: anyMatch(t, CALL_TO_BAR_PATTERNS),
        nbaSealStamp: anyMatch(t, NBA_SEAL_PATTERNS),
    };

    const missing: string[] = [];
    if (!present.fullName) {
        missing.push('Legal practitioner\'s full name (e.g. "Jane Doe, Esq.") in the signature block.');
    }
    if (!present.callToBarNumber) {
        missing.push('Call-to-Bar number (e.g. "Call to Bar: 2015" or "NBA/SC/1234567").');
    }
    if (!present.nbaSealStamp) {
        missing.push('NBA Seal & Stamp indication on the process.');
    }

    return {
        present,
        missing,
        checkedPatterns: [
            'Full name (Esq. / name label / signed line)',
            'Call-to-Bar number (label or NBA/SC number token)',
            'NBA Seal & Stamp mention',
        ],
        citation: SIGNATURE_CITATION,
        verifyNote: SIGNATURE_VERIFY_NOTE,
    };
}
