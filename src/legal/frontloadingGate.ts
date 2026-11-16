/**
 * frontloadingGate — mandatory frontloading compliance for originating
 * processes.
 *
 * PART OF THE ALOA LEGAL ENGINE (deterministic control plane, Pillar 1).
 *
 * Under the frontloading regime of the High Court Civil Procedure Rules
 * (e.g. Lagos 2019 Rules), originating processes must be FILED TOGETHER
 * WITH the bundle of documents the trial will need. Filing a Writ without
 * the bundle invites a striking-out or a compliance order — so the bundle
 * is checked deterministically against the document titles the firm
 * actually has, before drafting/filing advice is given.
 *
 * HONESTY: the exact rule/order numbers vary by state and by rules
 * revision — the citation is carried with a verification note rather than
 * a fabricated pinpoint. The pre-action counselling certificate is
 * conditional (required only where the state's practice directions mandate
 * it), so it is reported as CONDITIONAL rather than MISSING.
 */

export interface FrontloadingRequirement {
    key: string;
    label: string;
    match: string[];
    /** Conditional items are reported separately — not hard-missing. */
    conditional?: boolean;
}

export const FRONTLOADING_REQUIREMENTS: FrontloadingRequirement[] = [
    {
        key: 'statement_of_claim',
        label: 'Statement of Claim (or Statement of Defence, as applicable)',
        match: ['statement of claim', 'statement of defence', 'statement of defense'],
    },
    {
        key: 'witness_statements',
        label: 'Written Statements on Oath of Witnesses',
        match: ['witness statement', 'statements on oath', 'statement on oath', 'witnesses on oath', 'deposition'],
    },
    {
        key: 'list_of_witnesses',
        label: 'List of Witnesses to be called at trial',
        match: ['list of witnesses', 'witness list'],
    },
    {
        key: 'list_of_documents',
        label: 'List of Documents / Exhibits to be relied upon at trial',
        match: ['list of documents', 'documents to be relied', 'schedule of documents', 'list of exhibits'],
    },
    {
        key: 'pre_action_counseling',
        label: 'Pre-Action Counseling Certificate (where required by the state\'s practice directions)',
        match: ['pre-action', 'preaction', 'pre-action counseling', 'pre-action counselling', 'counselling certificate', 'counseling certificate'],
        conditional: true,
    },
];

export const FRONTLOADING_CITATION =
    'High Court (Civil Procedure) Rules of the relevant state — frontloading provisions (e.g. High Court of Lagos State (Civil Procedure) Rules 2019)';

export interface FrontloadingResult {
    satisfied: string[];
    missing: string[];
    conditionalMissing: string[];
    complete: boolean;
    citation: string;
    notes: string[];
}

/**
 * Check a bundle of document titles against the mandatory frontloading
 * requirements for an originating process. Matching is keyword-based over
 * the titles (case-insensitive), in the spirit of ComplianceEngine's
 * requirement checks — deliberately permissive on phrasing, strict on the
 * five required items.
 */
export function checkFrontloadingBundle(input: {
    documentTitles: string[];
    processType?: string;
}): FrontloadingResult {
    const titles = (input.documentTitles || []).map(t => (t || '').toLowerCase());
    const satisfied: string[] = [];
    const missing: string[] = [];
    const conditionalMissing: string[] = [];

    for (const req of FRONTLOADING_REQUIREMENTS) {
        const hit = titles.some(t => req.match.some(m => t.includes(m)));
        if (hit) {
            satisfied.push(req.label);
        } else if (req.conditional) {
            conditionalMissing.push(req.label);
        } else {
            missing.push(req.label);
        }
    }

    const notes: string[] = [];
    if (input.processType && /originating summons/i.test(input.processType)) {
        notes.push(
            'For an Originating Summons, the supporting affidavit and written address take the place of pleadings — confirm the bundle composition with the applicable rules.',
        );
    }
    if (conditionalMissing.length > 0) {
        notes.push(
            'Conditional items apply only where the state\'s practice directions require them — confirm for your forum.',
        );
    }

    return {
        satisfied,
        missing,
        conditionalMissing,
        complete: missing.length === 0,
        citation: FRONTLOADING_CITATION,
        notes,
    };
}
