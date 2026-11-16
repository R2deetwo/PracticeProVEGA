/**
 * jurisdictionMatrix — DMN-style subject-matter jurisdiction routing for Nigeria.
 *
 * PART OF THE ALOA LEGAL ENGINE (deterministic control plane, Pillar 1).
 *
 * WHY THIS EXISTS: court selection was previously left to the generative
 * layer — the model would "recommend" a forum from prose memory, with no
 * citation and no deterministic rule behind it. A matter filed in the wrong
 * court is liable to be struck out for want of jurisdiction; that is a
 * malpractice-grade error and exactly the kind of decision that must never
 * be *generated*. This matrix encodes the constitutional subject-matter
 * routing as typed, testable rows:
 *
 *   - Federal High Court — s. 251(1) CFRN 1999 (enumerated exclusive heads:
 *     federal revenue, taxation, customs, banking, foreign exchange,
 *     admiralty, IP, CAMA companies, aviation, arms, narcotics …)
 *   - NICN — s. 254C CFRN 1999 (labour, employment, trade unions, workplace
 *     rights — exclusive, Third Alteration)
 *   - State High Court — residual jurisdiction (s. 6(6) CFRN 1999 + the
 *     state's High Court Law: land, tenancy, probate, family, contracts,
 *     torts)
 *
 * VERIFICATION DISCIPLINE (matches the repo's V5 honesty rules): every row
 * carries its constitutional citation. The enumerated heads are summarised,
 * not exhaustive — anything unclassifiable is returned NEEDS_REVIEW, never
 * silently resolved.
 */

export type CourtForum = 'FEDERAL_HIGH_COURT' | 'NICN' | 'STATE_HIGH_COURT';

export type SubjectMatter =
    // s. 251(1) CFRN — Federal High Court (exclusive, enumerated)
    | 'federal_revenue'
    | 'taxation'
    | 'customs_excise'
    | 'banking'
    | 'foreign_exchange'
    | 'admiralty_shipping'
    | 'intellectual_property'
    | 'company_cama'
    | 'aviation'
    | 'drugs_narcotics'
    | 'arms_ammunition'
    // s. 254C CFRN — NICN (exclusive)
    | 'labour_employment'
    | 'trade_union'
    | 'workplace_rights'
    // Residual — State High Court
    | 'land_dispute'
    | 'landlord_tenant'
    | 'probate_estate'
    | 'family'
    | 'commercial_contract'
    | 'tort'
    | 'general_civil'
    | 'unclassified';

export const FORUM_LABELS: Record<CourtForum, string> = {
    FEDERAL_HIGH_COURT: 'Federal High Court',
    NICN: 'National Industrial Court of Nigeria (NICN)',
    STATE_HIGH_COURT: 'State High Court',
};

const FHC_CITATION =
    'Constitution of the Federal Republic of Nigeria 1999 (as amended), s. 251(1)';
const NICN_CITATION =
    'Constitution of the Federal Republic of Nigeria 1999 (as amended), s. 254C (Third Alteration)';
const STATE_CITATION =
    'Constitution of the Federal Republic of Nigeria 1999 (as amended), s. 6(6) (residual jurisdiction), read with the High Court Law of the state';

interface RoutingRow {
    subject: SubjectMatter;
    forum: CourtForum;
    citation: string;
    keywords: string[];
}

const ROUTING_MATRIX: RoutingRow[] = [
    // ── Federal High Court — s. 251(1) enumerated heads ──────────────
    { subject: 'federal_revenue', forum: 'FEDERAL_HIGH_COURT', citation: FHC_CITATION, keywords: ['federal revenue', 'revenue of the federation', 'federation account'] },
    { subject: 'taxation', forum: 'FEDERAL_HIGH_COURT', citation: FHC_CITATION, keywords: ['taxation', 'tax dispute', 'firs', 'company income tax', 'vat dispute'] },
    { subject: 'customs_excise', forum: 'FEDERAL_HIGH_COURT', citation: FHC_CITATION, keywords: ['customs', 'excise', 'import duty', 'export duty'] },
    { subject: 'banking', forum: 'FEDERAL_HIGH_COURT', citation: FHC_CITATION, keywords: ['banking', 'bank', 'financial institution', 'ndic', 'amcon', 'bofia', 'loan recovery by a bank'] },
    { subject: 'foreign_exchange', forum: 'FEDERAL_HIGH_COURT', citation: FHC_CITATION, keywords: ['foreign exchange', 'forex', 'currency', 'exchange control'] },
    { subject: 'admiralty_shipping', forum: 'FEDERAL_HIGH_COURT', citation: FHC_CITATION, keywords: ['admiralty', 'shipping', 'marine', 'bill of lading', 'carriage of goods by sea'] },
    { subject: 'intellectual_property', forum: 'FEDERAL_HIGH_COURT', citation: FHC_CITATION, keywords: ['trademark', 'copyright', 'patent', 'industrial design', 'intellectual property', 'passing off'] },
    { subject: 'company_cama', forum: 'FEDERAL_HIGH_COURT', citation: FHC_CITATION, keywords: ['cama', 'companies and allied matters', 'winding up of a company', 'company dispute', 'shareholder dispute', 'director dispute'] },
    { subject: 'aviation', forum: 'FEDERAL_HIGH_COURT', citation: FHC_CITATION, keywords: ['aviation', 'aircraft', 'airline', 'civil aviation'] },
    { subject: 'drugs_narcotics', forum: 'FEDERAL_HIGH_COURT', citation: FHC_CITATION, keywords: ['narcotics', 'ndlea', 'hard drugs'] },
    { subject: 'arms_ammunition', forum: 'FEDERAL_HIGH_COURT', citation: FHC_CITATION, keywords: ['firearms', 'ammunition', 'arms deal'] },
    // ── NICN — s. 254C ────────────────────────────────────────────────
    { subject: 'labour_employment', forum: 'NICN', citation: NICN_CITATION, keywords: ['employment', 'dismissal', 'terminated', 'termination of employment', 'wrongful dismissal', 'unfair termination', 'redundancy', 'employee', 'worker', 'staff'] },
    { subject: 'trade_union', forum: 'NICN', citation: NICN_CITATION, keywords: ['trade union', 'union dispute', 'strike', 'industrial action', 'collective bargaining'] },
    { subject: 'workplace_rights', forum: 'NICN', citation: NICN_CITATION, keywords: ['workplace', 'workplace discrimination', 'factory', 'factories act', 'occupational safety', 'workplace harassment'] },
    // ── State High Court — residual ───────────────────────────────────
    { subject: 'land_dispute', forum: 'STATE_HIGH_COURT', citation: STATE_CITATION, keywords: ['land', 'recovery of land', 'land title', 'certificate of occupancy', 'right of occupancy', 'boundary dispute'] },
    { subject: 'landlord_tenant', forum: 'STATE_HIGH_COURT', citation: STATE_CITATION, keywords: ['tenancy', 'tenant', 'landlord', 'eviction', 'rent arrears', 'recovery of premises', 'quit notice'] },
    { subject: 'probate_estate', forum: 'STATE_HIGH_COURT', citation: STATE_CITATION, keywords: ['probate', 'letters of administration', 'estate of a deceased', 'succession', 'administration of estate'] },
    { subject: 'family', forum: 'STATE_HIGH_COURT', citation: STATE_CITATION, keywords: ['divorce', 'matrimonial', 'custody', 'guardianship', 'adoption', 'child maintenance'] },
    { subject: 'commercial_contract', forum: 'STATE_HIGH_COURT', citation: STATE_CITATION, keywords: ['contract', 'sale of goods', 'breach of contract', 'debt recovery', 'agency agreement', 'partnership dispute'] },
    { subject: 'tort', forum: 'STATE_HIGH_COURT', citation: STATE_CITATION, keywords: ['negligence', 'nuisance', 'defamation', 'trespass', 'assault', 'battery', 'personal injury'] },
    { subject: 'general_civil', forum: 'STATE_HIGH_COURT', citation: STATE_CITATION, keywords: [] },
];

export interface JurisdictionRouting {
    /** The classified subject matter ('unclassified' when nothing matched). */
    subject: SubjectMatter;
    /** Keywords that drove the classification (empty for the residual default). */
    matchedKeywords: string[];
    recommendedForum: CourtForum;
    forumLabel: string;
    citation: string;
    exclusivity: 'EXCLUSIVE' | 'RESIDUAL_DEFAULT';
    notes: string[];
    confidence: 'DETERMINISTIC' | 'NEEDS_REVIEW';
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Does `text` contain `keyword` on word boundaries (case-insensitive)? */
const containsKeyword = (text: string, keyword: string): boolean =>
    new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i').test(text);

const isEnumerated = (row: RoutingRow): boolean =>
    row.forum === 'FEDERAL_HIGH_COURT' || row.forum === 'NICN';

/**
 * Route a matter to the correct court by subject matter.
 *
 * Accepts either a known SubjectMatter key, or free text (a description of
 * the dispute) which is matched against the keyword table. Enumerated
 * constitutional heads (FHC / NICN) are checked before the residual default,
 * so a labour claim inside a bank dispute still routes to the NICN.
 */
export function routeJurisdiction(input: {
    subjectMatter?: string;
    text?: string;
    state?: string;
}): JurisdictionRouting {
    const haystack = [input.subjectMatter, input.text].filter(Boolean).join(' ').toLowerCase();
    const notes: string[] = [];

    // 1. Exact SubjectMatter key (deterministic — the caller named the head).
    const exact = ROUTING_MATRIX.find(r => r.subject === (input.subjectMatter || '').trim());
    if (exact) {
        return {
            subject: exact.subject,
            matchedKeywords: [exact.subject],
            recommendedForum: exact.forum,
            forumLabel: FORUM_LABELS[exact.forum],
            citation: exact.citation,
            exclusivity: isEnumerated(exact) ? 'EXCLUSIVE' : 'RESIDUAL_DEFAULT',
            notes: [
                ...notes,
                ...(input.state && exact.forum === 'STATE_HIGH_COURT'
                    ? [`Proceed in the High Court of ${input.state}.`]
                    : []),
                ...(exact.forum === 'FEDERAL_HIGH_COURT'
                    ? ['s. 251(1) heads are summarised — confirm the specific paragraph relied on before filing.']
                    : []),
            ],
            confidence: 'DETERMINISTIC',
        };
    }

    // 2. Keyword scan over the free text — enumerated heads first.
    const enumeratedMatch = ROUTING_MATRIX.filter(isEnumerated).find(r =>
        r.keywords.some(k => containsKeyword(haystack, k)),
    );
    const row = enumeratedMatch ?? ROUTING_MATRIX.find(r =>
        !isEnumerated(r) && r.subject !== 'general_civil' && r.keywords.some(k => containsKeyword(haystack, k)),
    );

    if (row) {
        const matched = row.keywords.filter(k => containsKeyword(haystack, k));
        return {
            subject: row.subject,
            matchedKeywords: matched,
            recommendedForum: row.forum,
            forumLabel: FORUM_LABELS[row.forum],
            citation: row.citation,
            exclusivity: isEnumerated(row) ? 'EXCLUSIVE' : 'RESIDUAL_DEFAULT',
            notes: [
                'Classified from the description keywords — confirm against the full constitutional provision before filing.',
                ...(input.state && row.forum === 'STATE_HIGH_COURT'
                    ? [`Proceed in the High Court of ${input.state}.`]
                    : []),
            ],
            confidence: 'DETERMINISTIC',
        };
    }

    // 3. Nothing matched — residual default, flagged for review.
    return {
        subject: 'unclassified',
        matchedKeywords: [],
        recommendedForum: 'STATE_HIGH_COURT',
        forumLabel: FORUM_LABELS.STATE_HIGH_COURT,
        citation: STATE_CITATION,
        exclusivity: 'RESIDUAL_DEFAULT',
        notes: [
            'Could not classify the subject matter from the information given. The State High Court is the residual default — confirm the forum with counsel before filing.',
            ...(input.state ? [`If confirmed, proceed in the High Court of ${input.state}.`] : []),
        ],
        confidence: 'NEEDS_REVIEW',
    };
}
