/**
 * complianceGate — the orchestrator of the deterministic control plane.
 *
 * PART OF THE ALOA LEGAL ENGINE (Pillar 1).
 *
 * This is the pre-drafting/pre-filing gate the master architecture calls
 * for: every deterministic legal check runs HERE, BEFORE any generative
 * step, and its output — with citations — is what the assistant is allowed
 * to quote. The gate is pure: same inputs, same outputs, no model in the
 * loop, no I/O.
 *
 * SAFE_STOP SEMANTICS: a time-barred claim (limitation engine) sets
 * safeStop=true. Downstream, the assistant must STOP short of drafting the
 * filing and instead present the statutory/equitable exceptions to the
 * lawyer. Advisory findings (frontloading gaps, signature gaps, an
 * unclassifiable subject matter) do NOT stop the gate — they surface for
 * professional judgment.
 */

import { routeJurisdiction, JurisdictionRouting } from './jurisdictionMatrix';
import { calculateLimitation, LimitationResult } from './limitationEngine';
import { checkFrontloadingBundle, FrontloadingResult } from './frontloadingGate';
import { checkSignatureBlock, SignatureComplianceResult } from './signatureCompliance';

export interface ComplianceGateInput {
    /** Subject of the dispute (a SubjectMatter key or free-text description). */
    subjectMatter?: string;
    /** Optional extra free text to classify against (e.g. the user's message). */
    text?: string;
    /** Nigerian state, e.g. 'Lagos' or 'FCT'. */
    state?: string;
    causeOfAction?: string;
    /** ISO date the cause of action accrued. */
    accrualDate?: string;
    /** ISO date of intended filing — defaults to today. */
    proposedFilingDate?: string;
    originatingProcess?: string;
    /** Titles of the documents in the filing bundle. */
    documentTitles?: string[];
    /** Draft text to scan for signature-block compliance. */
    documentText?: string;
}

export interface ComplianceGateResult {
    checks: {
        jurisdiction?: JurisdictionRouting;
        limitation?: LimitationResult;
        frontloading?: FrontloadingResult;
        signature?: SignatureComplianceResult;
    };
    /** True when the limitation engine found a time bar — halt drafting. */
    safeStop: boolean;
    safeStopReasons: string[];
    /** Non-blocking findings for the lawyer's judgment. */
    advisory: string[];
    /** Every citation the gate relied on, for the decision trace. */
    citationTrace: Array<{ check: string; citation: string }>;
}

/** Strip HTML tags so signature scanning sees plain text. */
const htmlToText = (html: string): string =>
    (html || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ');

/**
 * Run every deterministic check whose inputs are present. Pure function —
 * safe to run client-side (instant) and to re-run server-side for the
 * audit trail later.
 */
export function runComplianceGate(input: ComplianceGateInput): ComplianceGateResult {
    const checks: ComplianceGateResult['checks'] = {};
    const advisory: string[] = [];
    const citationTrace: ComplianceGateResult['citationTrace'] = [];
    const safeStopReasons: string[] = [];

    // ── 1. Jurisdiction routing (needs a subject matter or text) ───────
    if (input.subjectMatter || input.text) {
        checks.jurisdiction = routeJurisdiction({
            subjectMatter: input.subjectMatter,
            text: input.text,
            state: input.state,
        });
        citationTrace.push({ check: 'jurisdiction', citation: checks.jurisdiction.citation });
        if (checks.jurisdiction.confidence === 'NEEDS_REVIEW') {
            advisory.push(
                `Forum classification needs review: ${checks.jurisdiction.notes[0] || 'confirm the correct court with counsel.'}`,
            );
        }
    }

    // ── 2. Limitation (needs a recognised cause of action + accrual) ───
    if (input.causeOfAction) {
        checks.limitation = calculateLimitation({
            causeOfAction: input.causeOfAction,
            accrualDate: input.accrualDate,
            proposedFilingDate: input.proposedFilingDate,
            state: input.state,
        });
        citationTrace.push({ check: 'limitation', citation: checks.limitation.citation });
        if (checks.limitation.status === 'TIME_BARRED') {
            safeStopReasons.push(
                `Claim appears TIME-BARRED (${checks.limitation.period.years
                    ? `${checks.limitation.period.years} year(s)`
                    : `${checks.limitation.period.months} month(s)`} under ${checks.limitation.citation}; deadline ${checks.limitation.limitationDeadline}, ${Math.abs(checks.limitation.daysRemaining)} day(s) past).`,
            );
        } else if (checks.limitation.status === 'EXPIRING_SOON') {
            advisory.push(
                `Limitation window closing: ${checks.limitation.daysRemaining} day(s) remain (deadline ${checks.limitation.limitationDeadline} under ${checks.limitation.citation}).`,
            );
        } else if (checks.limitation.status === 'NEEDS_REVIEW') {
            advisory.push(
                checks.limitation.verifyNote || 'Limitation position could not be computed — confirm manually.',
            );
        }
    }

    // ── 3. Frontloading bundle (needs document titles + a process) ─────
    if (input.originatingProcess && Array.isArray(input.documentTitles)) {
        checks.frontloading = checkFrontloadingBundle({
            documentTitles: input.documentTitles,
            processType: input.originatingProcess,
        });
        citationTrace.push({ check: 'frontloading', citation: checks.frontloading.citation });
        for (const m of checks.frontloading.missing) {
            advisory.push(`Frontloading bundle incomplete — missing: ${m}`);
        }
    }

    // ── 4. Signature block (needs draft text) ──────────────────────────
    if (input.documentText) {
        checks.signature = checkSignatureBlock(htmlToText(input.documentText));
        citationTrace.push({ check: 'signature', citation: checks.signature.citation });
        for (const m of checks.signature.missing) {
            advisory.push(`Signature block incomplete — missing: ${m}`);
        }
    }

    return {
        checks,
        safeStop: safeStopReasons.length > 0,
        safeStopReasons,
        advisory,
        citationTrace,
    };
}
