/**
 * statuteLibrary — the Regulatory & Compliance Cross-Referencing engine (R48).
 *
 * MODULE 2 of the R48 pair — the high-value modular add-on / Enterprise
 * tier. Deep statutory audit of commercial drafts against Nigerian federal
 * and state legislation, with exact section citations in the audit log
 * ("Violation of Section 4 of the Lagos Tenancy Law 2011").
 *
 * The library is authored from the statutes as verified during R48:
 *   - CAMA 2020, s.18(1)  — pre-incorporation contracts are conditional on
 *                            the company being formed.
 *   - Labour Act, s.7(1)  — written particulars of terms within three
 *                            months of commencement.
 *   - Labour Act, s.18(1) — statutory minimum notice of termination by
 *                            length of service (from one day for service of
 *                            three months or less).
 *   - FCCPA 2018, s.17    — agreements in restraint of competition
 *                            prohibited; s.24 — abuse of a dominant
 *                            position prohibited.
 *   - Lagos Tenancy Law 2011, s.4 — advance rent capped (not more than 6
 *                            months for a monthly tenant; s.4(2) caps a
 *                            yearly tenancy at 12 months).
 *   - Lagos Tenancy Law 2011, s.25 — notice to quit by tenancy type.
 *
 * Every entry carries a `summary` in plain language and a `citation` built
 * as "Section {n} of {statute}". Severity is either 'Violation' (the clause
 * as drafted offends the provision) or 'Advisory' (statutory exposure that
 * needs a facts analysis — dominance, reasonableness of restraint).
 *
 * Like contractAnalysis.ts, this is synchronous, deterministic and pinned
 * by tests/unit/regulatoryAudit.test.ts — the mock API data structure for
 * the future backend call is:
 *   POST /api/contracts/regulatory-audit
 *     body:    { clauses: { id: string; text: string }[]; docType: ContractDocType; statuteIds: string[] }
 *     returns: StatuteViolation[]
 */

import type { ContractDocType } from './contractAnalysis';

export type StatuteJurisdiction = 'federal' | 'lagos';

export const JURISDICTION_OPTIONS: Array<{
    value: StatuteJurisdiction;
    label: string;
    description: string;
}> = [
    { value: 'federal', label: 'Federal statutes', description: 'Corporate, employment and competition law of the Federation — CAMA 2020, the Labour Act, FCCPA 2018.' },
    { value: 'lagos', label: 'Lagos State', description: 'Property and tenancy law of Lagos State — the Tenancy Law 2011.' },
];

export interface StatuteSection {
    id: string;
    jurisdiction: StatuteJurisdiction;
    statute: string;
    area: string;
    section: string;
    heading: string;
    /** Plain-language summary of what the provision requires. */
    summary: string;
    appliesTo: ContractDocType[];
}

export const STATUTE_LIBRARY: StatuteSection[] = [
    {
        id: 'cama-s18', jurisdiction: 'federal', statute: 'CAMA 2020', area: 'Corporate',
        section: '18(1)', heading: 'Pre-incorporation contracts conditional on incorporation',
        summary: 'A contract purportedly made by or on behalf of a company before it is formed takes effect only as one conditional on the company being incorporated.',
        appliesTo: ['shareholders', 'joint_venture', 'nda', 'general'],
    },
    {
        id: 'labour-s7', jurisdiction: 'federal', statute: 'Labour Act', area: 'Employment',
        section: '7(1)', heading: 'Written particulars of terms within three months',
        summary: 'Not later than three months after employment begins, the employer must give the worker written particulars of the terms of employment.',
        appliesTo: ['employment'],
    },
    {
        id: 'labour-s18', jurisdiction: 'federal', statute: 'Labour Act', area: 'Employment',
        section: '18(1)', heading: 'Minimum notice of termination by length of service',
        summary: 'The statutory notice of termination scales with length of service — from one day where service is three months or less, rising to longer periods for longer service.',
        appliesTo: ['employment'],
    },
    {
        id: 'fccpa-s17', jurisdiction: 'federal', statute: 'FCCPA 2018', area: 'Competition',
        section: '17', heading: 'Agreements in restraint of competition prohibited',
        summary: 'Agreements which have as their object or effect the prevention, restriction or distortion of competition in the Nigerian market are prohibited.',
        appliesTo: ['employment', 'shareholders', 'joint_venture', 'nda', 'general'],
    },
    {
        id: 'fccpa-s24', jurisdiction: 'federal', statute: 'FCCPA 2018', area: 'Competition',
        section: '24', heading: 'Abuse of a dominant position prohibited',
        summary: 'It is prohibited for one or more undertakings to abuse a dominant position in the market — including by tying or exclusive dealing.',
        appliesTo: ['general', 'joint_venture', 'commercial_lease'],
    },
    {
        id: 'lagos-tenancy-s4', jurisdiction: 'lagos', statute: 'Lagos Tenancy Law 2011', area: 'Tenancy',
        section: '4', heading: 'Advance rent capped — 6 months (monthly) / 12 months (yearly)',
        summary: 'It is unlawful for a landlord or agent to demand or receive from a sitting tenant rent in advance beyond the statutory limits: not more than 6 months for a monthly tenant, and not more than 12 months for a yearly tenancy (s.4(2)).',
        appliesTo: ['commercial_lease', 'general'],
    },
    {
        id: 'lagos-tenancy-s25', jurisdiction: 'lagos', statute: 'Lagos Tenancy Law 2011', area: 'Tenancy',
        section: '25', heading: 'Notice to quit by tenancy type',
        summary: 'The notice periods for determining a tenancy run by tenancy type; a term cannot shorten or waive the statutory notice to quit.',
        appliesTo: ['commercial_lease', 'general'],
    },
];

export function listStatutesForJurisdiction(j: StatuteJurisdiction): StatuteSection[] {
    return STATUTE_LIBRARY.filter((s) => s.jurisdiction === j);
}

export function getStatute(id: string): StatuteSection | undefined {
    return STATUTE_LIBRARY.find((s) => s.id === id);
}

// ─── The audit ──────────────────────────────────────────────────────────────

export type AuditSeverity = 'Violation' | 'Advisory';

export interface StatuteViolation {
    id: string;
    statute: StatuteSection;
    /** The clause the finding attaches to (null = whole-document). */
    clauseId: string | null;
    /** One line: what is wrong with the clause as drafted. */
    finding: string;
    /** Exact citation for the audit log, e.g. "Violation of Section 4 of the Lagos Tenancy Law 2011". */
    citation: string;
    severity: AuditSeverity;
    /** The fix the redline should carry. */
    requiredFix: string;
}

function citationFor(severity: AuditSeverity, s: StatuteSection): string {
    return severity === 'Violation'
        ? `Violation of Section ${s.section} of ${s.statute}`
        : `Flag under Section ${s.section} of ${s.statute}`;
}

const WORD_NUMBERS: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
    nine: 9, ten: 10, eleven: 11, twelve: 12, eighteen: 18, twenty: 20, twentyfour: 24,
};

/** "eighteen months' rent in advance" → 18. Returns null when unparseable. */
function parseAdvanceMonths(clauseText: string): number | null {
    // R48 fix: the possessive apostrophe in "months' rent" was not consumed
    // by the original ('s)?\s* segment, so "twenty-four months' rent in
    // advance" never matched while "two years rent in advance" did.
    const m = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|eighteen|twenty(?:[\s-]four)?)\s*(months?|years?)(['’]s?)?\s*(rent\s*)?(?:in advance|upfront|as advance)/i.exec(clauseText);
    if (!m) return null;
    const raw = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : WORD_NUMBERS[m[1].replace(/[\s-]/g, '').toLowerCase()] ?? null;
    if (raw == null) return null;
    return /years?/i.test(m[2]) ? raw * 12 : raw;
}

/**
 * Run the statutory audit. Pure and deterministic: given the same clauses,
 * docType and statute selection, the audit log is identical.
 */
export function runRegulatoryAudit(
    clauses: Array<{ id: string; text: string }>,
    docType: ContractDocType,
    selectedStatuteIds: string[],
): StatuteViolation[] {
    const out: StatuteViolation[] = [];
    const whole = clauses.map((c) => c.text).join('\n\n');

    for (const id of selectedStatuteIds) {
        const s = getStatute(id);
        if (!s) continue;

        switch (id) {
            case 'cama-s18': {
                const executedEarly = /prior to (its|the) incorporation|before the company (was|is) incorporated|to be incorporated|in the process of (registration|incorporation)/i;
                const hasConditional = /conditional (on|upon)|take[s]? effect (only )?(upon|when).{0,60}incorporat|ratif(y|ication) by the company/i;
                if (executedEarly.test(whole)) {
                    const conditional = hasConditional.test(whole);
                    out.push({
                        id: `${id}-1`, statute: s, clauseId: null,
                        finding: conditional
                            ? 'The draft is signed for a company not yet formed and carries the s.18(1) conditional mechanism — confirm the company is incorporated before reliance.'
                            : 'The draft is signed for a company that does not yet exist, with no conditional-on-incorporation mechanism — as drafted it is unenforceable against the company.',
                        citation: citationFor(conditional ? 'Advisory' : 'Violation', s),
                        severity: conditional ? 'Advisory' : 'Violation',
                        requiredFix: 'Adopt the Section 18(1) CAMA 2020 mechanism: the contract takes effect only upon incorporation, and the promoter remains liable for obligations incurred before the company exists.',
                    });
                }
                break;
            }

            case 'labour-s7': {
                if (docType !== 'employment') break;
                const hasParticulars = /particulars of|statement of terms|job description|schedule of duties|duties of the (employee|worker)|remuneration/i;
                if (!hasParticulars.test(whole)) {
                    out.push({
                        id: `${id}-1`, statute: s, clauseId: null,
                        finding: 'No written particulars of the terms of employment in the draft — the contract itself should carry them.',
                        citation: citationFor('Violation', s),
                        severity: 'Violation',
                        requiredFix: 'Insert a particulars schedule (role, remuneration, hours, place of work, notice) or an express obligation to issue it within three months, as Section 7(1) requires.',
                    });
                }
                break;
            }

            case 'labour-s18': {
                if (docType !== 'employment') break;
                for (const c of clauses) {
                    if (/terminate[^.;]{0,80}(at will|without notice|forthwith|summary)/i.test(c.text)) {
                        out.push({
                            id: `${id}-${c.id}`, statute: s, clauseId: c.id,
                            finding: 'The termination clause dispenses with notice — the statutory minimum cannot be contracted away.',
                            citation: citationFor('Violation', s),
                            severity: 'Violation',
                            requiredFix: 'State the notice in writing and not less than the statutory minimum under s.18(1) (which scales with length of service, from one day for service of three months or less).',
                        });
                        break;
                    }
                    const noticeM = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(day|days|week|weeks|month|months)'?\s*notice/i.exec(c.text);
                    if (noticeM) {
                        const n = /^\d+$/.test(noticeM[1]) ? parseInt(noticeM[1], 10) : WORD_NUMBERS[noticeM[1].toLowerCase()] ?? parseInt(noticeM[1], 10);
                        const unit = noticeM[2].toLowerCase();
                        const weeks = unit.startsWith('week') ? n : unit.startsWith('month') ? n * 4 : n / 7;
                        if (weeks < 1 && unit.startsWith('day')) {
                            out.push({
                                id: `${id}-${c.id}`, statute: s, clauseId: c.id,
                                finding: `The stated notice (${noticeM[1]} ${noticeM[2]}) may fall below the statutory minimum for longer-serving staff — s.18(1) scales notice with length of service.`,
                                citation: citationFor('Advisory', s),
                                severity: 'Advisory',
                                requiredFix: 'Confirm the stated notice is not less than the s.18(1) minimum for the employee\'s length of service at the date notice would be given.',
                            });
                        }
                        break;
                    }
                }
                break;
            }

            case 'fccpa-s17': {
                const blanket = /not.{0,40}engage in (any|the) (business|trade) whatsoever|carry on (any|the) (business|trade) (of any kind|whatsoever)/i;
                const scoped = /non-compete|shall not[^.;]{0,60}(compete|solicit)|exclusively (with|from)/i;
                for (const c of clauses) {
                    if (blanket.test(c.text)) {
                        out.push({
                            id: `${id}-${c.id}`, statute: s, clauseId: c.id,
                            finding: 'A blanket restraint with no scope, geography or duration — void as an agreement in restraint of competition.',
                            citation: citationFor('Violation', s),
                            severity: 'Violation',
                            requiredFix: 'Limit the restraint to what reasonably protects a legitimate interest: a stated business line, a geography, and a duration (e.g. 6 months).',
                        });
                        break;
                    }
                    if (scoped.test(c.text)) {
                        out.push({
                            id: `${id}-${c.id}`, statute: s, clauseId: c.id,
                            finding: 'A restraint clause is present — enforceability turns on reasonableness (duration, geography, business line).',
                            citation: citationFor('Advisory', s),
                            severity: 'Advisory',
                            requiredFix: 'Scope the restraint by business line, geography and duration, and keep it to what is reasonably necessary to protect legitimate interests.',
                        });
                        break;
                    }
                }
                break;
            }

            case 'fccpa-s24': {
                for (const c of clauses) {
                    if (/exclusively (from|with)|shall purchase only from|tying|tied to the purchase/i.test(c.text)) {
                        out.push({
                            id: `${id}-${c.id}`, statute: s, clauseId: c.id,
                            finding: 'Exclusive-dealing / tying language detected — an abuse exposure if either party is dominant in the relevant market.',
                            citation: citationFor('Advisory', s),
                            severity: 'Advisory',
                            requiredFix: 'Assess the parties\' market shares; if either is dominant, soften exclusivity or build in an opt-out on market-power change.',
                        });
                        break;
                    }
                }
                break;
            }

            case 'lagos-tenancy-s4': {
                for (const c of clauses) {
                    const months = parseAdvanceMonths(c.text);
                    if (months == null) continue;
                    if (months > 12) {
                        out.push({
                            id: `${id}-${c.id}`, statute: s, clauseId: c.id,
                            finding: `Advance rent of ${months} months is demanded — beyond the lawful limit (6 months for a monthly tenant; 12 months for a yearly tenancy under s.4(2)).`,
                            citation: citationFor('Violation', s),
                            severity: 'Violation',
                            requiredFix: 'Reduce the advance demand to not more than 6 months (monthly tenancy) or 12 months (yearly tenancy); a security deposit or other lawful instrument covers the rest.',
                        });
                    } else if (months > 6) {
                        out.push({
                            id: `${id}-${c.id}`, statute: s, clauseId: c.id,
                            finding: `Advance rent of ${months} months is lawful only for a yearly tenancy (s.4(2) caps it at 12 months); it exceeds the 6-month limit that binds a monthly tenant.`,
                            citation: citationFor('Advisory', s),
                            severity: 'Advisory',
                            requiredFix: 'Confirm the tenancy type on the face of the lease; if monthly, the advance cannot exceed 6 months.',
                        });
                    }
                    break;
                }
                break;
            }

            case 'lagos-tenancy-s25': {
                for (const c of clauses) {
                    if (/waives?[^.;]{0,40}(notice to quit|right to notice)|no notice (to quit|of determination)|notice[^.;]{0,30}less than the (statutory|prescribed)/i.test(c.text)) {
                        out.push({
                            id: `${id}-${c.id}`, statute: s, clauseId: c.id,
                            finding: 'The lease purports to waive or shorten the statutory notice to quit — a term cannot contract below the s.25 notice.',
                            citation: citationFor('Violation', s),
                            severity: 'Violation',
                            requiredFix: 'State the notice to quit by tenancy type as s.25 prescribes, and delete any waiver of the tenant\'s right to notice.',
                        });
                        break;
                    }
                }
                break;
            }
        }
    }

    // Violations first, then advisories; stable order within each.
    const rank = (v: StatuteViolation) => (v.severity === 'Violation' ? 0 : 1);
    return out.sort((a, b) => rank(a) - rank(b));
}
