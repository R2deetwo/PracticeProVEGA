/**
 * preflight — deterministic court-process checks before DraftPro export.
 *
 * PART OF THE ALOA LEGAL ENGINE (Pillar 1, applied at the export surface).
 *
 * Runs on the editor's HTML at export/print time. Advisory by design —
 * the lawyer decides — but the findings are deterministic and specific:
 *
 *   - Signature-block compliance (full name, Call-to-Bar, NBA Seal & Stamp)
 *   - Citation completeness (via the citation classifier taxonomy)
 *   - The standing evidential-closure disclosure: nothing in-app can be
 *     authority-verified while no law-report corpus is connected.
 *
 * WHY ADVISORY HERE: the export path already hard-blocks on unfilled
 * placeholders (the one case where an incomplete document is NEVER
 * exportable). Everything this preflight finds is a professional-judgment
 * matter — surfacing it loudly, not silently blocking, matches the
 * ComplianceEngine V5 philosophy (advisory, cause-aware wording).
 */

import { checkSignatureBlock } from './signatureCompliance';
import { classifyAndCheckCitation } from '../utils/citationClassifier';

export interface PreflightFinding {
    severity: 'HIGH' | 'MEDIUM' | 'INFO';
    check: string;
    message: string;
}

export interface PreflightResult {
    isCourtProcess: boolean;
    findings: PreflightFinding[];
    citationCount: number;
    outcome: 'PASS' | 'WARN' | 'NOT_COURT_PROCESS';
}

/** Court-process markers in the title or body. */
const COURT_PROCESS_RE =
    /(suit no|suit number|motion on notice|motion ex parte|originating summons|writ of summons|statement of claim|statement of defence|affidavit|in the high court|in the federal high court|in the magistrate|before the national industrial court|court of appeal|supreme court of nigeria)/i;

/** Case-law citation candidates: "Somebody v. Somebody (year) …". */
const CASE_CITE_RE =
    /\b[A-Z][\p{L}'&.\-]*(?:\s+[\p{L}'&.\-]+){0,6}\s+v\.?\s+[A-Z][\p{L}'&.\-]*(?:\s+[\p{L}'&.\-]+){0,6}\s*\((?:19|20)\d{2}\)[^\n<;]{0,60}/gu;

/** Nigerian electronic-law-report identifiers (LPELR). */
const LPELR_RE = /\(\s*(?:19|20)\d{2}\s*\)\s*LPELR-\d{4,6}-[A-Z]{2,6}/gi;

const htmlToText = (html: string): string =>
    (html || '')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ');

/**
 * Run the export pre-flight on a document. Pure and synchronous so it can
 * sit directly in the export/print handlers without risk to the pipeline.
 */
export function runCourtProcessPreflight(
    html: string,
    opts: { title?: string } = {},
): PreflightResult {
    const text = htmlToText(html);
    const isCourtProcess = COURT_PROCESS_RE.test(`${opts.title || ''} ${text}`);

    if (!isCourtProcess) {
        return { isCourtProcess: false, findings: [], citationCount: 0, outcome: 'NOT_COURT_PROCESS' };
    }

    const findings: PreflightFinding[] = [];

    // ── 1. Signature block ─────────────────────────────────────────────
    const signature = checkSignatureBlock(text);
    for (const missing of signature.missing) {
        findings.push({
            severity: 'HIGH',
            check: 'signature_block',
            message: `Signature block: ${missing}`,
        });
    }

    // ── 2. Citation completeness ───────────────────────────────────────
    const candidates = new Set<string>();
    for (const m of text.match(CASE_CITE_RE) || []) candidates.add(m.trim());
    for (const m of text.match(LPELR_RE) || []) candidates.add(m.trim());
    const citations = Array.from(candidates);

    for (const citation of citations) {
        const result = classifyAndCheckCitation(citation);
        if (!result.isComplete) {
            const missing = result.issues.map(i => i.field).join(', ');
            findings.push({
                severity: 'MEDIUM',
                check: 'citation_completeness',
                message: `Citation may be incomplete: "${citation.slice(0, 90)}${citation.length > 90 ? '…' : ''}" — missing: ${missing}.`,
            });
        } else if (result.needsManualReview) {
            findings.push({
                severity: 'MEDIUM',
                check: 'citation_completeness',
                message: `Citation needs manual review: "${citation.slice(0, 90)}${citation.length > 90 ? '…' : ''}".`,
            });
        }
    }

    // ── 3. Evidential-closure disclosure (standing honesty rule) ──────
    if (citations.length > 0) {
        findings.push({
            severity: 'INFO',
            check: 'evidential_closure',
            message: `${citations.length} case citation${citations.length > 1 ? 's' : ''} detected. No law-report corpus is connected — none can be authority-verified in-app; confirm against a law report before filing.`,
        });
    }

    const outcome: PreflightResult['outcome'] = findings.some(f => f.severity !== 'INFO')
        ? 'WARN'
        : 'PASS';

    return { isCourtProcess: true, findings, citationCount: citations.length, outcome };
}
