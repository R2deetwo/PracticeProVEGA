/**
 * contractAnalysis — DraftPro's contract analysis engine (R48).
 *
 * MODULE 1 of the two R48 AI modules ("DraftPro: Smart Document / Contract
 * Analyzer", included standard in the core tier). This module is the PURE
 * engine + the mock API data structures: it takes the contract's extracted
 * text, splits it into clauses, and returns a deterministic analysis —
 * defined-terms hygiene, missing standard clauses (with a Nigerian-law
 * compliant standard draft for each), risk scoring (Low/Medium/High) and
 * redline suggestions (original vs suggested, side by side).
 *
 * MODULE 2 (the Regulatory & Compliance Cross-Referencing engine, the
 * Enterprise add-on) lives in statuteLibrary.ts — same shape, same rules.
 *
 * MOCK API SURFACE (for wiring a real backend later):
 *   The engine is synchronous and deterministic so the UI can call it
 *   directly today. When the AI backend lands, swap analyzeContract() for:
 *
 *     POST /api/contracts/analyze
 *       body:    { text: string; docType: ContractDocType }
 *       returns: ContractAnalysisResult        (this exact shape)
 *
 *     POST /api/contracts/regulatory-audit
 *       body:    { clauses: { id: string; text: string }[]; docType; statuteIds: string[] }
 *       returns: StatuteViolation[]            (see statuteLibrary.ts)
 *
 *   Until then both run client-side; the hooks (useContractAnalysis) own
 *   the phase machine (idle → extracting → analyzing → ready) so the swap
 *   is a one-function change.
 *
 * Determinism: no Date, no Math.random — every output is a pure function
 * of (text, docType), pinned by tests/unit/contractAnalysis.test.ts.
 */

export type ContractDocType =
    | 'shareholders'
    | 'joint_venture'
    | 'employment'
    | 'commercial_lease'
    | 'nda'
    | 'general';

export const DOC_TYPE_OPTIONS: Array<{
    value: ContractDocType;
    label: string;
    blurb: string;
}> = [
    { value: 'shareholders', label: "Shareholders' Agreement", blurb: 'Equity, board control, transfer restrictions, exit.' },
    { value: 'joint_venture', label: 'Joint Venture Agreement', blurb: 'Profit sharing, IP, deadlock, exit.' },
    { value: 'employment', label: 'Employment Contract', blurb: 'Particulars, notice, restraints, benefits.' },
    { value: 'commercial_lease', label: 'Commercial Lease', blurb: 'Rent, advance limits, forfeiture, repair.' },
    { value: 'nda', label: 'NDA / Confidentiality', blurb: 'Purpose, duration, return, remedies.' },
    { value: 'general', label: 'General commercial contract', blurb: 'Supply, services, distribution, consultancy.' },
];

// ─── Result shapes (the mock API data structures) ───────────────────────────

export interface ContractClause {
    id: string;
    index: number;
    /** Clause heading if the paragraph opens with one, else null. */
    heading: string | null;
    text: string;
}

export interface DefinedTerm {
    term: string;
    definition: string;
}

export interface UndefinedUse {
    term: string;
    occurrences: number;
    sample: string;
}

export interface MissingClause {
    id: string;
    label: string;
    why: string;
    /** The Nigerian-law compliant standard draft to insert. */
    nigerianStandard: string;
    severity: 'High' | 'Medium';
}

export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface RedlineSuggestion {
    id: string;
    clauseId: string;
    label: string;
    original: string;
    /** Suggested Nigerian-law compliant replacement draft. */
    suggested: string;
    rationale: string;
}

export interface RiskFlag {
    id: string;
    clauseId: string;
    clauseIndex: number;
    level: RiskLevel;
    issue: string;
    excerpt: string;
    redline: RedlineSuggestion | null;
}

export interface ContractAnalysisResult {
    docType: ContractDocType;
    clauseCount: number;
    wordCount: number;
    definedTerms: DefinedTerm[];
    undefinedUses: UndefinedUse[];
    missingClauses: MissingClause[];
    riskFlags: RiskFlag[];
    overallRisk: RiskLevel;
    /** Deterministic estimate of first-pass review hours saved (vs manual). */
    reviewHoursSaved: number;
}

// ─── Clause splitting ───────────────────────────────────────────────────────

const MIN_CLAUSE_CHARS = 40;
const HEADING_MAX = 90;

/**
 * Split extracted contract text into clauses. A clause is any paragraph
 * (blank-line separated) of meaningful length; headings are detected when
 * the first line is short, or opens with a clause number, or is a recital
 * (WHEREAS / IT IS AGREED / NOW THEREFORE).
 */
export function splitClauses(text: string): ContractClause[] {
    const paragraphs = text
        .replace(/\r\n/g, '\n')
        .split(/\n\s*\n+/)
        .map((p) => p.replace(/\s+/g, ' ').trim())
        .filter((p) => p.length >= MIN_CLAUSE_CHARS);

    return paragraphs.map((p, i) => {
        const firstLine = p.split(/[.:(]/)[0] || p;
        const numbered = /^(?:\d+|[A-Z][A-Z\s]{3,}|WHEREAS|IT IS (?:HEREBY )?AGREED|NOW (?:THEREFORE|IT IS))/.test(firstLine.trim());
        const heading = (firstLine.length <= HEADING_MAX || numbered) ? firstLine.trim() : null;
        return { id: `c${i + 1}`, index: i + 1, heading, text: p };
    });
}

// ─── Doc-type detection ─────────────────────────────────────────────────────

const DOC_TYPE_SIGNALS: Record<ContractDocType, RegExp[]> = {
    shareholders: [/shareholders?' agreement/i, /shall be held by the shareholders/i, /transfer of (his |the |any )?shares/i, /board of directors/i, /tag-along|drag-along|pre-emption/i],
    joint_venture: [/joint venture/i, /jv agreement/i, /contributions? of the parties/i, /profit.{0,20}sharing/i],
    employment: [/employment (agreement|contract)/i, /the (employee|worker) (shall|agrees)/i, /salary|remuneration|wages/i, /notice of termination/i],
    commercial_lease: [/lease (agreement|of)/i, /landlord|lessor/i, /tenant|lessee/i, /demise[sd]? (all|that|the)/i, /premises/i],
    nda: [/non-disclosure|confidentiality (agreement|deed)/i, /confidential information/i, /disclosing party/i],
    general: [],
};

/** Best-effort doc-type detection for the "auto" selector option. */
export function detectDocType(text: string): ContractDocType {
    let best: ContractDocType = 'general';
    let bestScore = 0;
    (Object.keys(DOC_TYPE_SIGNALS) as ContractDocType[]).forEach((t) => {
        const score = DOC_TYPE_SIGNALS[t].reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);
        if (score > bestScore) { bestScore = score; best = t; }
    });
    return bestScore >= 2 ? best : 'general';
}

// ─── Defined terms ──────────────────────────────────────────────────────────

const DEFINED_AS = [
    // "Chilmark Logistics Limited (the "Company")"
    /\b([A-Z][\w &/,-]{2,60}?)\s*\(\s*(?:the\s+)?["“]([^"”]{2,60})["”]\s*\)/g,
    // ""Services" shall mean ..." / ""Services" means ..."
    /["“]([^"”]{2,60})["”]\s+(?:shall mean|means|shall have the meaning)\s+([^.;]{10,240})[.;]/g,
];

/** Extract terms defined via the "(the "X")" and ""X" shall mean" forms. */
export function extractDefinedTerms(text: string): DefinedTerm[] {
    const found: DefinedTerm[] = [];
    const seen = new Set<string>();
    for (const re of DEFINED_AS) {
        const rx = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
        let m: RegExpExecArray | null;
        while ((m = rx.exec(text)) !== null) {
            if (re.source.startsWith('\\b(')) {
                const term = m[2].trim();
                if (!seen.has(term.toLowerCase())) { seen.add(term.toLowerCase()); found.push({ term, definition: m[1].trim() }); }
            } else {
                const term = m[1].trim();
                if (!seen.has(term.toLowerCase())) { seen.add(term.toLowerCase()); found.push({ term, definition: m[2].trim() }); }
            }
        }
    }
    return found;
}

const COMMON_UNDEFINED = [
    'Effective Date', 'Confidential Information', 'Services', 'Deliverables',
    'Premises', 'Term', 'Business Day', 'Affiliate', 'Group Company',
    'Works', 'Products', 'Parties', 'Goods',
];

/** Quoted/labelled capitalised terms in use but never defined. */
export function findUndefinedUses(text: string, defined: DefinedTerm[]): UndefinedUse[] {
    const definedLower = new Set(defined.map((d) => d.term.toLowerCase()));
    const out: UndefinedUse[] = [];
    for (const term of COMMON_UNDEFINED) {
        if (definedLower.has(term.toLowerCase())) continue;
        const rx = new RegExp(`\\b${term}\\b`, 'g');
        let occurrences = 0;
        let sample = '';
        let m: RegExpExecArray | null;
        while ((m = rx.exec(text)) !== null) {
            occurrences++;
            if (!sample) sample = text.slice(Math.max(0, m.index - 40), m.index + term.length + 40).trim();
        }
        if (occurrences >= 2) out.push({ term, occurrences, sample });
    }
    return out;
}

// ─── Missing standard clauses ───────────────────────────────────────────────

interface ClauseCheck {
    id: string;
    label: string;
    why: string;
    nigerianStandard: string;
    severity: 'High' | 'Medium';
    /** Present = the clause exists (not missing). */
    present: RegExp;
}

const NG_GOVERNING_LAW =
    'This Agreement shall be governed by the laws of the Federal Republic of Nigeria. ' +
    'The parties submit to the exclusive jurisdiction of the High Court of Lagos State, ' +
    'provided that either party may elect arbitration in Lagos under the Arbitration and ' +
    'Mediation Act 2023.';

const CLAUSE_CHECKS: Record<ContractDocType, ClauseCheck[]> = {
    shareholders: [
        { id: 'governing_law', label: 'Governing law & forum', why: 'No clause selects Nigerian law or a forum — disputes default to wherever service can be founded.', nigerianStandard: NG_GOVERNING_LAW, severity: 'High', present: /governing law|laws of (the federal republic of )?nigeria|lagos court of arbitration|arbitration and mediation act/i },
        { id: 'indemnity', label: 'Indemnity & warranties', why: 'No indemnity for breach of representations — the company carries the counterparty\'s defaults.', nigerianStandard: 'Each party indemnifies the other against losses arising from its breach of this Agreement or its representations and warranties, limited to direct losses and capped as agreed under the liability clause.', severity: 'High', present: /indemnif|warrant(ies|y) (as )?(to|that)/i },
        { id: 'share_transfer', label: 'Share transfer restrictions', why: 'Shares can walk out the door freely — no first offer, no tag/drag protection for continuing holders.', nigerianStandard: 'No share may be transferred without first being offered to the other shareholders at the same terms (pre-emption). On a sale to a third party, minority holders tag along on identical terms; on an approved sale of the company, holders drag together.', severity: 'High', present: /pre-emption|right of first refusal|tag-along|drag-along|transfer of (his |the |any )?shares|shares (shall|may) not be transferred/i },
        { id: 'deadlock', label: 'Deadlock resolution', why: 'A 50/50 board that cannot agree has no exit path — the company seizes before it dies.', nigerianStandard: 'If the board cannot resolve a matter within 30 days, it is referred to the shareholders; if still unresolved after a further 30 days, either party may trigger the buy-sell procedure (shotgun clause) at a valuation set by an independent accountant.', severity: 'Medium', present: /deadlock|dead-lock|impasse|buy-sell|shotgun/i },
        { id: 'valuation', label: 'Exit / buyout valuation', why: 'No mechanism to price a departing holder\'s stake — every exit becomes a negotiation from scratch.', nigerianStandard: 'On any exit event, the departing holder\'s shares are valued at fair value by an independent chartered accountant or, failing agreement, by the Nigerian Stock Exchange listing rules for unlisted securities.', severity: 'Medium', present: /valuation|fair value|independent accountant/i },
    ],
    joint_venture: [
        { id: 'governing_law', label: 'Governing law & forum', why: 'No Nigerian governing-law or forum clause.', nigerianStandard: NG_GOVERNING_LAW, severity: 'High', present: /governing law|laws of (the federal republic of )?nigeria/i },
        { id: 'profit_sharing', label: 'Profit & loss sharing', why: 'The venture earns but never says who keeps what.', nigerianStandard: 'The profits and losses of the venture shall be shared by the parties in proportion to their respective contributions, as recorded in the contribution schedule, and distributed within 30 days of each quarter.', severity: 'High', present: /profit.{0,30}(sharing|split|ratio)|sharing of profits|profit and loss/i },
        { id: 'ip_ownership', label: 'IP ownership', why: 'Works created in the venture belong to nobody in particular — the most expensive silence in a JV.', nigerianStandard: 'All intellectual property created in the course of the venture vests in the joint venture (or as the parties direct in writing); on termination, IP created for a party\'s business line vests in that party.', severity: 'High', present: /intellectual property|copyright (in|of)|ownership of (the )?(work|ip|invention)/i },
        { id: 'termination', label: 'Termination & exit', why: 'No exit: the venture cannot be wound up cleanly on breach or by agreement.', nigerianStandard: 'Either party may terminate on 60 days\' written notice for an unremedied material breach, or by mutual written agreement; on termination the venture\'s assets are realised and distributed in proportion to contributions.', severity: 'High', present: /terminat(e|ion) (of|upon|by)|expiry of the term/i },
        { id: 'deadlock', label: 'Deadlock resolution', why: 'No mechanism for unresolvable disagreement.', nigerianStandard: 'Deadlock on a fundamental matter unresolved after 60 days triggers mediation in Lagos, failing which either party may buy out the other at fair value set by an independent accountant.', severity: 'Medium', present: /deadlock|impasse|mediation/i },
    ],
    employment: [
        { id: 'written_particulars', label: 'Written particulars of terms', why: 'No particulars of the role, pay or hours — a drafting gap against Section 7(1) of the Labour Act.', nigerianStandard: 'The employer shall issue written particulars of the terms of employment (role, remuneration, hours, place of work and notice) not later than three months after commencement, as required by Section 7(1) of the Labour Act.', severity: 'High', present: /particulars of|statement of terms|job description|schedule of duties|duties of the (employee|worker)/i },
        { id: 'termination_notice', label: 'Notice of termination', why: 'The contract is silent on notice — statutory minimums under s.18(1) of the Labour Act will imply what the draft should state.', nigerianStandard: 'Either party may terminate on written notice not less than the statutory minimum under Section 18(1) of the Labour Act (which scales with length of service), and the clause states the notice in writing rather than leaving it to implication.', severity: 'High', present: /notice of termination|termination notice|period of notice|notice period/i },
        { id: 'restraints', label: 'Post-employment restraints', why: 'No restraint clause — or none scoped to what a court would enforce.', nigerianStandard: 'The employee shall not, for 6 months after termination, solicit the employer\'s clients or staff in the business line in which they worked, in Lagos and states where the employer trades — restraints are limited to what is reasonably necessary to protect legitimate interests (Section 17, FCCPA 2018).', severity: 'Medium', present: /non-compete|shall not.{0,50}(compete|solicit)|restraint/i },
        { id: 'grievance', label: 'Grievance & discipline procedure', why: 'No internal path for disputes — everything becomes a confrontation or a claim.', nigerianStandard: 'Complaints are raised in writing to the line manager, acknowledged within 5 working days, and resolved or escalated to the managing partner within 21 days before either party resorts to external process.', severity: 'Medium', present: /grievance|complaints? procedure|disciplinary/i },
        { id: 'governing_law', label: 'Governing law', why: 'No governing-law clause.', nigerianStandard: 'This contract is governed by the laws of the Federal Republic of Nigeria; the parties submit to the National Industrial Court of Nigeria.', severity: 'Medium', present: /governing law|laws of (the federal republic of )?nigeria|national industrial court/i },
    ],
    commercial_lease: [
        { id: 'rent_terms', label: 'Rent & payment terms', why: 'No rent clause at all — the lease does not state its own price.', nigerianStandard: 'The tenant pays rent of the stated amount, in advance, in the manner stated; the landlord shall not demand or receive advance rent beyond the limits of Section 4 of the Lagos Tenancy Law 2011 (not more than 6 months for a monthly tenant, 12 months for a yearly tenancy).', severity: 'High', present: /rent/i },
        { id: 'notice_to_quit', label: 'Determination / notice to quit', why: 'No clause determines the tenancy or states the notice to quit — recovery of possession depends on the statutory implication.', nigerianStandard: 'The tenancy is determined by the notice periods prescribed by Section 25 of the Lagos Tenancy Law 2011 for the relevant tenancy type, and the lease states the notice in writing; no term purports to shorten the statutory notice.', severity: 'High', present: /notice to quit|determination of the tenancy|terminat(e|ion) of (the|this) (lease|tenancy)/i },
        { id: 'forfeiture', label: 'Forfeiture & re-entry', why: 'No remedy on default — no right of re-entry for breach.', nigerianStandard: 'On a breach unremedied 14 days after written notice, the landlord may re-enter (subject to relief against forfeiture as the High Court may grant) and recover possession as the law allows.', severity: 'Medium', present: /forfeit|re-enter|right of re-entry|re-entry/i },
        { id: 'repair', label: 'Repair & maintenance obligations', why: 'No allocation of repair duties between landlord and tenant.', nigerianStandard: 'The landlord keeps the structure, roof and external fabric in repair; the tenant keeps the interior, installations and fixtures in good condition, fair wear and tear excepted.', severity: 'Medium', present: /repair|maintain (the|in)|maintenance (of|obligations)/i },
        { id: 'rent_review', label: 'Rent review', why: 'No mechanism for review — the rent is frozen or revisable at will.', nigerianStandard: 'The rent may be reviewed not more than once in 12 months, on 3 months\' written notice, to a level not above the open-market rent for comparable premises; any increase follows the procedure permitted by Lagos State rent-control regulations.', severity: 'Medium', present: /rent review|review of the rent|increase (in|of) (the )?rent/i },
        { id: 'governing_law', label: 'Governing law & forum', why: 'No governing-law or forum clause.', nigerianStandard: 'This lease is governed by the laws of the Federal Republic of Nigeria; the parties submit to the exclusive jurisdiction of the High Court of Lagos State.', severity: 'High', present: /governing law|laws of (the federal republic of )?nigeria|high court of lagos/i },
    ],
    nda: [
        { id: 'purpose', label: 'Purpose limitation', why: 'Confidential information can be used for anything — the disclosure has no boundary.', nigerianStandard: 'The receiving party may use the confidential information solely for the stated purpose (evaluating the proposed transaction) and for no other purpose.', severity: 'High', present: /purpose (of|as|set out|specified|defined)/i },
        { id: 'duration', label: 'Term & survival', why: 'The obligations have no stated life.', nigerianStandard: 'This agreement continues for 2 years, and the confidentiality obligations survive for 5 years after termination or disclosure, whichever ends later.', severity: 'Medium', present: /shall expire|remain in force|term of this agreement|survive/i },
        { id: 'return_destroy', label: 'Return or destruction', why: 'No obligation to hand the information back at the end.', nigerianStandard: 'On written request, the receiving party returns or destroys all confidential information and certifies destruction within 7 days.', severity: 'Medium', present: /return or destroy|return (all|the)|destroy/i },
        { id: 'injunctive', label: 'Injunctive relief', why: 'Damages after a leak is cold comfort — the draft should say so.', nigerianStandard: 'The parties agree that damages may not adequately remedy a breach of this agreement; the disclosing party may seek injunctive or equitable relief without posting security for costs.', severity: 'Medium', present: /injunct|injunction|equitable relief/i },
        { id: 'governing_law', label: 'Governing law', why: 'No governing-law clause.', nigerianStandard: NG_GOVERNING_LAW, severity: 'Medium', present: /governing law|laws of (the federal republic of )?nigeria/i },
    ],
    general: [
        { id: 'governing_law', label: 'Governing law & forum', why: 'No clause selects Nigerian law or a forum.', nigerianStandard: NG_GOVERNING_LAW, severity: 'High', present: /governing law|laws of (the federal republic of )?nigeria/i },
        { id: 'indemnity', label: 'Indemnity', why: 'No indemnity for breach — losses from the other side\'s default land on you.', nigerianStandard: 'Each party indemnifies the other against direct losses arising from its breach of this Agreement or its warranties.', severity: 'High', present: /indemnif/i },
        { id: 'dispute_resolution', label: 'Dispute resolution', why: 'No agreed path for disputes — straight to first-instance litigation by default.', nigerianStandard: 'Disputes are referred to a single arbitrator in Lagos under the Arbitration and Mediation Act 2023; interim relief may be sought from the High Court of Lagos State.', severity: 'Medium', present: /arbitration|mediation|dispute (shall|will) be (referred|resolved)/i },
        { id: 'termination', label: 'Termination', why: 'No termination right — the contract cannot be exited cleanly.', nigerianStandard: 'Either party may terminate on 30 days\' written notice for an unremedied material breach, with accrued rights preserved.', severity: 'Medium', present: /terminat(e|ion) (of|this|upon)/i },
    ],
};

export function checkMissingClauses(text: string, docType: ContractDocType): MissingClause[] {
    return CLAUSE_CHECKS[docType]
        .filter((c) => !c.present.test(text))
        .map(({ id, label, why, nigerianStandard, severity }) => ({ id, label, why, nigerianStandard, severity }));
}

// ─── Risk rules (scoring + redlines) ────────────────────────────────────────

interface RiskRule {
    id: string;
    level: RiskLevel;
    label: string;
    /** Trigger — matched against a single clause. */
    trigger: RegExp;
    /** Suppress when the contract already contains the protection. */
    unless?: RegExp;
    issue: string;
    excerptFrom: 'clause' | 'match';
    suggested: string;
    rationale: string;
}

const RISK_RULES: RiskRule[] = [
    {
        id: 'unlimited_liability', level: 'High', label: 'Uncapped liability',
        trigger: /unlimited liability|liable (for|in respect of) (all|any|every)|howsoever arising/i,
        unless: /shall not exceed|aggregate liability|limited to/i,
        issue: 'Exposure is unlimited — one incident lands on this party in full, however it arises.',
        excerptFrom: 'clause',
        suggested: 'Each party\'s aggregate liability under this Agreement shall not exceed the total fees paid or payable in the 12 months before the claim. Neither party is liable for indirect or consequential loss, howsoever arising.',
        rationale: 'Caps aggregate exposure and carves out indirect loss — the baseline a commercial counterparty should insist on before signing.',
    },
    {
        id: 'one_sided_indemnity', level: 'High', label: 'One-way indemnity',
        trigger: /indemnif(y|ies)[^.;]{0,120}(all claims|any and all|howsoever|against every)/i,
        unless: /mutual|each party (shall )?indemnif/i,
        issue: 'The indemnity runs one way and swallows "all claims" — the drafting expects only one side to be wrong.',
        excerptFrom: 'match',
        suggested: 'Each party shall indemnify the other against direct losses caused by its breach of this Agreement or its warranties, subject to the liability cap. Neither party indemnifies the other for indirect or consequential loss.',
        rationale: 'Mutualises the indemnity, ties it to breach, and brings it under the cap.',
    },
    {
        id: 'sole_discretion', level: 'Medium', label: 'Unilateral discretion',
        trigger: /sole (and absolute )?discretion|as it (deems|thinks|considers) fit/i,
        unless: /reasonabl|not to be unreasonably/i,
        issue: 'A party may act "as it deems fit" with no reasonableness check — consent rights that are rights in name only.',
        excerptFrom: 'clause',
        suggested: 'such consent or decision to be made reasonably and not to be unreasonably withheld, delayed or conditioned.',
        rationale: 'Converts an absolute right into a qualified one — the standard read Nigerian courts give to consent clauses in commercial relationships.',
    },
    {
        id: 'termination_without_notice', level: 'High', label: 'Termination without notice',
        trigger: /terminate (this|the) (agreement|contract|employment|lease)[^.;]{0,80}(at any time|immediately|forthwith|without (notice|cause|liability))/i,
        unless: /notice period|prior written notice|days' notice/i,
        issue: 'The contract can be ended on the spot — no notice, no runway, statutory minimums left to implication.',
        excerptFrom: 'clause',
        suggested: 'Either party may terminate only on written notice not less than the applicable statutory minimum (for employment, Section 18(1) of the Labour Act; for tenancies, Section 25 of the Lagos Tenancy Law 2011), and in any event not less than 30 days.',
        rationale: 'States the notice in writing and pegs it to the statutory floor instead of leaving it to be implied in a dispute.',
    },
    {
        id: 'penalty_forfeit', level: 'Medium', label: 'Penalty-style forfeiture',
        trigger: /shall be forfeited|as liquidated damages/i,
        unless: /genuine pre-estimate/i,
        issue: 'The clause operates as a penalty — forfeiture beyond a genuine pre-estimate of loss risks being unenforceable.',
        excerptFrom: 'clause',
        suggested: 'The defaulting party shall pay as liquidated damages a genuine pre-estimate of the loss caused, and not by way of penalty; the innocent party must mitigate its loss.',
        rationale: 'Reframes the remedy as a genuine pre-estimate — the form Nigerian courts enforce.',
    },
    {
        id: 'auto_renewal', level: 'Low', label: 'Evergreen auto-renewal',
        trigger: /automatically renew|renewed for (a|an) (further|additional)/i,
        unless: /written notice[^.;]{0,60}(not|at least)/i,
        issue: 'The term rolls over silently — the exit window is whatever the drafter forgot to say.',
        excerptFrom: 'clause',
        suggested: 'This agreement renews for successive 12-month terms unless either party gives at least 3 months\' written notice before the current term ends.',
        rationale: 'Gives the renewal a visible off-ramp instead of a trapdoor.',
        // no redline builder needed — Low rules carry an advisory note only
    },
    {
        id: 'pre_incorporation', level: 'High', label: 'Pre-incorporation execution',
        trigger: /prior to (its|the) incorporation|before the company (was|is) incorporated|to be incorporated/i,
        unless: /conditional (on|upon)|take[s]? effect (only )?(upon|when)/i,
        issue: 'The agreement is signed for a company that does not yet exist — without the conditional mechanism it is unenforceable as drafted (CAMA 2020, s.18(1)).',
        excerptFrom: 'clause',
        suggested: 'This Agreement takes effect only upon the incorporation of the Company; until incorporation it is conditional as provided by Section 18(1) of CAMA 2020, and the signatory promoter remains liable for obligations incurred before incorporation.',
        rationale: 'Adopts the CAMA 2020 s.18(1) conditional-on-formation mechanism and names the promoter\'s exposure until the company exists.',
    },
    {
        id: 'open_ended_standard', level: 'Low', label: 'Open-ended standard',
        trigger: /as (the|it) may (reasonably )?(determine|decide|require|direct)/i,
        issue: 'Performance is measured against one party\'s own opinion — there is no objective standard to test it.',
        excerptFrom: 'clause',
        suggested: 'measured against the standard of a reasonably competent professional in the same field, acting reasonably.',
        rationale: 'Anchors the standard to an objective benchmark a court can apply.',
    },
];

export function scoreRisks(clauses: ContractClause[], fullText: string): RiskFlag[] {
    const flags: RiskFlag[] = [];
    for (const rule of RISK_RULES) {
        for (const clause of clauses) {
            const m = rule.trigger.exec(clause.text);
            if (!m) continue;
            if (rule.unless && (rule.unless.test(clause.text) || rule.unless.test(fullText))) continue;
            const excerpt = (rule.excerptFrom === 'match'
                ? clause.text.slice(Math.max(0, (m.index ?? 0) - 60), (m.index ?? 0) + 160)
                : clause.text.slice(0, 200)).trim();
            const redline: RedlineSuggestion | null = rule.level === 'Low'
                ? null
                : {
                    id: `${rule.id}-${clause.id}`,
                    clauseId: clause.id,
                    label: rule.label,
                    original: clause.text,
                    suggested: rule.suggested,
                    rationale: rule.rationale,
                };
            flags.push({
                id: `${rule.id}-${clause.id}`,
                clauseId: clause.id,
                clauseIndex: clause.index,
                level: rule.level,
                issue: rule.issue,
                excerpt,
                redline,
            });
            break; // first matching clause per rule — one finding per rule type
        }
    }
    return flags;
}

// ─── The composed analysis ──────────────────────────────────────────────────

const LEVEL_VALUE: Record<RiskLevel, number> = { Low: 1, Medium: 2, High: 3 };

export function analyzeContract(text: string, docType: ContractDocType): ContractAnalysisResult {
    const clauses = splitClauses(text);
    const definedTerms = extractDefinedTerms(text);
    const undefinedUses = findUndefinedUses(text, definedTerms);
    const missingClauses = checkMissingClauses(text, docType);
    const riskFlags = scoreRisks(clauses, text);

    const wordCount = (text.match(/\S+/g) || []).length;
    const maxFlag = riskFlags.reduce((m, f) => Math.max(m, LEVEL_VALUE[f.level]), 0);
    const highMissing = missingClauses.filter((c) => c.severity === 'High').length;
    let overallRisk: RiskLevel = 'Low';
    if (maxFlag >= 3 || highMissing >= 1) overallRisk = 'High';
    else if (maxFlag >= 2 || missingClauses.length >= 2 || undefinedUses.length >= 5) overallRisk = 'Medium';

    const reviewHoursSaved = Math.min(
        12,
        Math.round((1.5 + clauses.length * 0.1 + missingClauses.length * 0.4) * 10) / 10,
    );

    return {
        docType,
        clauseCount: clauses.length,
        wordCount,
        definedTerms,
        undefinedUses,
        missingClauses,
        riskFlags,
        overallRisk,
        reviewHoursSaved,
    };
}
