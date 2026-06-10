import { CourtType } from '../types';

export interface ProceduralRule {
    action: string;
    jurisdiction: CourtType;
    requirements: string[];
    deadlines: Record<string, string>;
    nextSteps: string[];
    complianceChecks: string[];
    conditions?: Array<{ if: string; then: string }>;
    strategicFlags?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCEDURAL RULES ENGINE — Nigerian Civil Procedure (v2)
// Covers: Writ, Originating Summons, Undefended List, Motion Practice,
//         Judgment Enforcement, Banking/Debt Recovery, Corporate Filings,
//         Tax Disputes, NICN Employment matters.
// ─────────────────────────────────────────────────────────────────────────────

export const PROCEDURAL_RULES: Record<string, Partial<Record<CourtType, ProceduralRule>>> = {

    // ── 1. WRIT OF SUMMONS ──────────────────────────────────────────────────
    'Writ of Summons': {
        [CourtType.StateHighCourt]: {
            action: 'Writ of Summons',
            jurisdiction: CourtType.StateHighCourt,
            requirements: [
                'Statement of Claim',
                'List of Witnesses',
                'Witness Statements on Oath',
                'List of Documents',
                'Pre-Action Protocol Form 01 (Lagos)',
            ],
            deadlines: {
                'Statement of Claim': '7 days after Writ is filed',
                'Statement of Defence': '42 days after service on Defendant',
            },
            nextSteps: [
                'Service of Writ on Defendant',
                'Defendant Entry of Appearance (8 days)',
                'Statement of Defence',
                'Pre-Trial Conference',
            ],
            complianceChecks: [
                'Missing Pre-Action Protocol Form 01',
                'Missing Witness Statements on Oath',
                'Claim may be better suited for Undefended List (liquidated sum)',
            ],
            conditions: [
                { if: 'claim_type == liquidated_sum', then: 'Suggest switching to Undefended List for faster resolution' },
                { if: 'claim_value > 100000000', then: 'Consider Commercial Division filing' },
            ],
            strategicFlags: [
                'File in Commercial Division for faster hearing if claim > ₦100M',
                'Lagos Pre-Action Protocol is MANDATORY — failure risks dismissal',
                'Consider Accelerated Hearing application if facts are straightforward',
            ],
        },
        [CourtType.FederalHighCourt]: {
            action: 'Writ of Summons',
            jurisdiction: CourtType.FederalHighCourt,
            requirements: [
                'Statement of Claim',
                'Witness Statements on Oath',
                'List of Documents',
            ],
            deadlines: {
                'Statement of Defence': '30 days after service on Defendant',
                'Reply to Defence': '14 days after Statement of Defence',
            },
            nextSteps: [
                'Service of Writ',
                'Entry of Appearance',
                'Statement of Defence',
                'Case Management Conference',
            ],
            complianceChecks: [
                'Missing Witness Statements',
                'Missing Statement of Claim',
                'Verify subject matter is within FHC jurisdiction (s. 251 CFRN)',
            ],
            strategicFlags: [
                'FHC has exclusive jurisdiction for Federal Revenue, Banking, IP, and Maritime matters',
                'Apply for Pre-Trial Conference scheduling immediately after Defence is filed',
            ],
        },
        [CourtType.NationalIndustrialCourt]: {
            action: 'Writ of Summons',
            jurisdiction: CourtType.NationalIndustrialCourt,
            requirements: [
                'Statement of Facts',
                'Witness Statements on Oath',
                'List of Documents',
                'Employee Contract / HR Records',
            ],
            deadlines: {
                'Statement of Defence': '14 days after service',
                'Pre-Trial Settlement Conference': '30 days after close of pleadings',
            },
            nextSteps: [
                'Service',
                'Statement of Defence',
                'Mandatory Mediation/Settlement Conference',
                'Trial',
            ],
            complianceChecks: [
                'Missing Statement of Facts',
                'Missing employment contract evidence',
                'Ensure right to sue letter obtained (if trade union dispute)',
            ],
            strategicFlags: [
                'NICN mandates pre-trial settlement conference — prepare settlement brief',
                'Wrongful dismissal claims: quantum of damages calculated on contract terms',
            ],
        },
    },

    // ── 2. ORIGINATING SUMMONS ──────────────────────────────────────────────
    'Originating Summons': {
        [CourtType.StateHighCourt]: {
            action: 'Originating Summons',
            jurisdiction: CourtType.StateHighCourt,
            requirements: [
                'Originating Summons (Form)',
                'Affidavit in Support',
                'Exhibits (attached to Affidavit)',
                'Written Address',
            ],
            deadlines: {
                'Counter-Affidavit': '14 days after service on Respondent',
                'Reply Affidavit': '7 days after Counter-Affidavit',
            },
            nextSteps: [
                'Service on all Respondents',
                'Counter-Affidavit from Respondent',
                'Oral Arguments / Hearing',
                'Ruling',
            ],
            complianceChecks: [
                'CRITICAL: Only use if there is NO substantial dispute of facts',
                'If facts are contested — use Writ of Summons instead',
                'All Exhibits must be certified / certified true copies',
            ],
            conditions: [
                { if: 'facts_disputed == true', then: 'SWITCH TO WRIT — Originating Summons will be struck out' },
                { if: 'constitutional_matter == true', then: 'Consider Fundamental Rights Enforcement (FRE)' },
            ],
            strategicFlags: [
                'Faster resolution than a full Writ — no oral witnesses',
                'Ideal for interpretation of contracts, deeds, or company matters',
                'All relief must be clearly stated in the Summons questions',
            ],
        },
        [CourtType.FederalHighCourt]: {
            action: 'Originating Summons',
            jurisdiction: CourtType.FederalHighCourt,
            requirements: [
                'Originating Summons',
                'Supporting Affidavit',
                'Written Address',
                'Proposed Order / Draft Judgment',
            ],
            deadlines: {
                'Counter-Affidavit': '21 days after service',
            },
            nextSteps: ['Service', 'Counter-Affidavit', 'Hearing', 'Ruling'],
            complianceChecks: [
                'Confirm FHC has jurisdiction over subject matter',
                'No disputed facts — if contested, action may be converted to Writ',
            ],
            strategicFlags: [
                'Include proposed orders to guide the court',
                'Suitable for enforcement of agreements, company disputes, IP matters',
            ],
        },
    },

    // ── 3. UNDEFENDED LIST (DEBT RECOVERY) ─────────────────────────────────
    'Undefended List (Debt Recovery)': {
        [CourtType.StateHighCourt]: {
            action: 'Undefended List',
            jurisdiction: CourtType.StateHighCourt,
            requirements: [
                'Specially Endorsed Writ of Summons',
                'Affidavit Verifying Debt (Affidavit of Debt)',
                'Exhibit: Loan/Contract Documents',
                'Exhibit: Statement of Account',
                'Written Address',
            ],
            deadlines: {
                'Notice of Intention to Defend': 'Within 5 days of service by Defendant',
                'Summary Judgment (if no notice filed)': 'Day 6+ after service — apply immediately',
            },
            nextSteps: [
                'File and obtain assignment to Undefended List',
                'Serve Defendant with Writ + Affidavit',
                'Monitor 5-day window for Notice of Intention to Defend',
                'If no notice — move for Summary Judgment',
                'If notice filed — matter moves to General Cause List (Writ)',
            ],
            complianceChecks: [
                'CRITICAL: Claim MUST be for a liquidated (certain) sum only',
                'Unliquidated damages (pain & suffering, loss of profit etc.) CANNOT use Undefended List',
                'Affidavit must personally verify the debt and all exhibits',
                'All loan/credit documents must be duly executed',
            ],
            conditions: [
                { if: 'claim_type != liquidated_sum', then: 'REMOVE FROM UNDEFENDED LIST — use General Cause List (Writ)' },
                { if: 'notice_of_intention_filed == true', then: 'Matter converts to Writ — file Statement of Claim within 14 days' },
            ],
            strategicFlags: [
                'FASTEST debt recovery path in Nigerian civil procedure',
                'Summary Judgment obtainable in 2–6 weeks if Defendant does not respond',
                'Prepare garnishee proceedings before obtaining judgment (identify Defendant\'s banks)',
                'File at same time as Undefended List: statutory demand letter for debt',
            ],
        },
        [CourtType.FederalHighCourt]: {
            action: 'Undefended List',
            jurisdiction: CourtType.FederalHighCourt,
            requirements: [
                'Specially Endorsed Writ',
                'Affidavit of Debt',
                'Exhibit: Source Documents',
                'Written Address',
            ],
            deadlines: {
                'Notice of Intention to Defend': '8 days after service',
            },
            nextSteps: ['Service', 'Monitor 8-day window', 'Apply for Summary Judgment if no response'],
            complianceChecks: [
                'Claim must be liquidated',
                'Verify FHC jurisdictional basis (banking, federal debt, etc.)',
            ],
            strategicFlags: [
                'FHC Undefended List used for banking debts, federal government claims',
                'Prepare Garnishee Order Nisi immediately after judgment',
            ],
        },
    },

    // ── 4. MOTION ON NOTICE ─────────────────────────────────────────────────
    'Motion on Notice': {
        [CourtType.StateHighCourt]: {
            action: 'Motion on Notice',
            jurisdiction: CourtType.StateHighCourt,
            requirements: [
                'Motion Paper (Statement of the Application)',
                'Supporting Affidavit',
                'Exhibits (all documents relied upon)',
                'Written Address',
            ],
            deadlines: {
                'Counter-Affidavit': '3 clear days before hearing date',
                'Reply on Points of Law': '1 clear day before hearing',
            },
            nextSteps: [
                'File Motion with Court Registry',
                'Obtain hearing date',
                'Serve on all parties with 5 clear days notice',
                'File Written Address',
                'Hearing and Ruling',
            ],
            complianceChecks: [
                'Counter-party must have minimum of 3 clear days notice',
                'All Exhibits must be numbered and certified',
                'Written Address must cite all relevant authorities',
                'Wrong if seeking emergency order — use Ex Parte instead',
            ],
            strategicFlags: [
                'Use for: Stay of Proceedings, Injunctions (inter partes), Amendment of Pleadings',
                'Most common interlocutory application — ensure complete affidavit evidence',
                'Attach all contract, correspondence & payment records as Exhibits',
            ],
        },
        [CourtType.FederalHighCourt]: {
            action: 'Motion on Notice',
            jurisdiction: CourtType.FederalHighCourt,
            requirements: [
                'Motion Paper',
                'Supporting Affidavit',
                'Written Address',
                'Exhibits',
            ],
            deadlines: {
                'Counter-Affidavit': '3 days before hearing',
            },
            nextSteps: ['File', 'Serve with 5 clear days notice', 'Hearing'],
            complianceChecks: [
                'Proof of service required before motion can be heard',
                'Ensure motion is within scope of pending substantive suit',
            ],
            strategicFlags: [
                'For freezing orders: must show risk of dissipation of assets',
                'FHC judges are strict on clear notice requirements',
            ],
        },
    },

    // ── 5. EX PARTE MOTION ──────────────────────────────────────────────────
    'Ex Parte Motion': {
        [CourtType.StateHighCourt]: {
            action: 'Ex Parte Motion',
            jurisdiction: CourtType.StateHighCourt,
            requirements: [
                'Motion Ex Parte',
                'Affidavit of Urgency',
                'Supporting Affidavit (full facts)',
                'Written Address',
                'Draft Order (proposed terms)',
            ],
            deadlines: {
                'Convert to Motion on Notice': 'Within time fixed by Court (usually 7–14 days)',
                'Pre-dating / Service': 'Immediately after Ex Parte Order is granted',
            },
            nextSteps: [
                'File Ex Parte application',
                'Argue before Judge (without other side)',
                'Obtain Temporary Injunction Order',
                'Serve Order on Defendant immediately',
                'File Motion on Notice to continue injunction',
                'Inter Partes Hearing',
            ],
            complianceChecks: [
                'CRITICAL: Full disclosure — must disclose all material facts including adverse facts',
                'Failure to disclose may result in discharge and cost order',
                'Must show extreme urgency — why other party cannot be served first',
                'Order is TEMPORARY — must convert to Motion on Notice immediately',
            ],
            strategicFlags: [
                'Ex Parte injunctions: Asset Freezing, Mareva Orders, Anton Piller',
                'Duty of full and frank disclosure is ABSOLUTE — non-disclosure is fatal',
                'Prepare Motion on Notice simultaneously — file same day or next day',
                'Include proposed undertaking as to damages in draft order',
            ],
        },
        [CourtType.FederalHighCourt]: {
            action: 'Ex Parte Motion',
            jurisdiction: CourtType.FederalHighCourt,
            requirements: [
                'Ex Parte Motion',
                'Affidavit of Urgency',
                'Supporting Affidavit',
                'Written Address',
                'Draft Interim Order',
            ],
            deadlines: {
                'Return Date for Inter Partes Hearing': 'Fixed by court at Ex Parte hearing (usually 7 days)',
            },
            nextSteps: ['File', 'Ex Parte hearing', 'Obtain order', 'Serve', 'Motion on Notice hearing'],
            complianceChecks: [
                'Full and frank disclosure is mandatory',
                'Must immediately notify other party once order is obtained',
            ],
            strategicFlags: [
                'Used in banking/asset recovery cases for freezing accounts',
                'Mareva injunction requires showing: good arguable case + risk of dissipation',
            ],
        },
    },

    // ── 6. ENFORCE JUDGMENT ─────────────────────────────────────────────────
    'Enforce Judgment': {
        [CourtType.StateHighCourt]: {
            action: 'Enforce Judgment',
            jurisdiction: CourtType.StateHighCourt,
            requirements: [
                'Certified True Copy of Judgment / Order',
                'Affidavit verifying judgment debt outstanding',
                'Garnishee Proceedings (Order Nisi): List of Garnishees (Defendant\'s banks)',
                'Writ of Fieri Facias (Fi.Fa.): Details of assets to be seized',
            ],
            deadlines: {
                'File Garnishee Order Nisi': 'Can file immediately after judgment',
                'Garnishee Show Cause Hearing': '14 days after service of Order Nisi',
                'Garnishee Order Absolute': 'After show cause hearing (if no challenge)',
                'Writ of Fi.Fa. Execution': 'Sheriffs must execute within 1 year of issuance',
            },
            nextSteps: [
                'Identify enforcement method: Garnishee vs Fi.Fa. vs Judgment Summons',
                'Intelligence: Identify Defendant\'s asset locations / bank accounts',
                'File Garnishee Application (Order Nisi) against all known banks',
                'Obtain Order Nisi — serve on all garnishee banks',
                'Banks respond at show cause hearing',
                'Apply for Order Absolute if bank holds funds',
                'Funds transferred to Judgment Creditor',
            ],
            complianceChecks: [
                'Judgment must be certified and not stayed pending appeal',
                'Check if Defendant has filed appeal + stay application',
                'Garnishee must be indebted to the Judgment Debtor',
                'Fi.Fa. execution — only movable, non-exempt property can be seized',
            ],
            conditions: [
                { if: 'defendant_has_bank_accounts == known', then: 'Use Garnishee — faster and more certain' },
                { if: 'defendant_is_company == true', then: 'Target Tier-1 banks + check CAC for assets' },
                { if: 'defendant_is_government == true', then: 'Need Executive Approval before enforcement (AG consent)' },
            ],
            strategicFlags: [
                'GARNISHEE STRATEGY: Target all Tier-1 banks simultaneously (GTB, Access, Zenith, UBA, FirstBank)',
                'Order Nisi served on multiple banks freezes all accounts — high success rate',
                'Identify if Defendant has real property — file Charging Order over land',
                'Government/Public Body Enforcement requires AG of Federation/State consent',
                'Consider examining Judgment Debtor on oath (Judgment Summons) to discover assets',
            ],
        },
        [CourtType.FederalHighCourt]: {
            action: 'Enforce Judgment',
            jurisdiction: CourtType.FederalHighCourt,
            requirements: [
                'Certified True Copy of Judgment',
                'Garnishee Application',
                'Affidavit in Support',
                'List of Garnishees (banks)',
            ],
            deadlines: {
                'Garnishee Show Cause': '14 days after Order Nisi served',
            },
            nextSteps: ['File Order Nisi', 'Serve banks', 'Show Cause Hearing', 'Order Absolute'],
            complianceChecks: [
                'FHC judgment enforcement uses same garnishee procedure',
                'For government agencies — requires separate AGF/AGS consent',
            ],
            strategicFlags: [
                'FHC judgments can be enforced against federal agencies with proper procedure',
                'Consider reciprocal enforcement if debtor has assets abroad',
            ],
        },
    },

    // ── 7. CAC FILING (CORPORATE) ────────────────────────────────────────────
    'CAC Filing (Corporate)': {
        [CourtType.StateHighCourt]: {
            action: 'CAC Filing',
            jurisdiction: CourtType.StateHighCourt,
            requirements: [
                'CAC Form CAC 1.1 (Application for Registration)',
                'Memorandum & Articles of Association',
                'Statement of Share Capital',
                'Particulars of Directors (CAC Form 7)',
                'Particulars of Shareholders',
                'Declaration of Compliance',
                'Payment of Filing Fees',
            ],
            deadlines: {
                'Name Reservation Validity': '60 days from reservation approval',
                'Annual Returns Filing': 'Within 42 days of Annual General Meeting',
                'Change of Directors Notification': '15 days after change',
                'Change of Address Notification': '14 days after change',
            },
            nextSteps: [
                'Reserve Company Name (CAC Online Portal)',
                'Draft Memorandum & Articles of Association',
                'File Incorporation Documents on CAC Portal',
                'Pay Stamp Duty and Filing Fees',
                'Obtain Certificate of Incorporation',
                'Obtain TIN from FIRS',
                'Open Corporate Bank Account',
            ],
            complianceChecks: [
                'Company name must not be identical or deceptively similar to existing companies',
                'Minimum share capital requirements vary by business type',
                'Professional services firms (Law, Medicine) have specific regulatory requirements',
                'Public Companies require minimum 50 members',
            ],
            strategicFlags: [
                'CAMA 2020 allows single-member, single-director companies',
                'Shelf companies available for immediate use — consider for time-sensitive transactions',
                'For M&A: conduct thorough CAC search before acquisition',
                'Ensure all directors provide valid ID and address proof',
            ],
        },
    },

    // ── 8. TAX OBJECTION (FIRS) ─────────────────────────────────────────────
    'Tax Objection (FIRS)': {
        [CourtType.FederalHighCourt]: {
            action: 'Tax Objection',
            jurisdiction: CourtType.FederalHighCourt,
            requirements: [
                'Tax Assessment Notice (from FIRS)',
                'Objection Letter (to FIRS) — within 30 days',
                'Supporting Financial Evidence (Audited Accounts, Returns)',
                'TCC (Tax Clearance Certificate) if applicable',
                'If TAT Appeal: Appeal Notice + Grounds of Appeal',
                'Written Submission to Tax Appeal Tribunal (TAT)',
            ],
            deadlines: {
                'Objection to FIRS Assessment': '30 days from receipt of Assessment Notice',
                'TAT Appeal (if FIRS rejects objection)': '30 days from FIRS rejection',
                'FHC Appeal (if TAT ruling adverse)': '30 days from TAT ruling',
            },
            nextSteps: [
                'File written Objection with FIRS (within 30 days)',
                'Obtain FIRS decision on Objection',
                'If rejected — file Appeal Notice at Tax Appeal Tribunal (TAT)',
                'TAT hearing and ruling',
                'If adverse — appeal to Federal High Court',
                'FHC to Court of Appeal to Supreme Court',
            ],
            complianceChecks: [
                'CRITICAL: 30-day objection deadline is STRICT — missing it may be fatal',
                'Pay "Taxes Not in Dispute" before objecting to avoid penalties',
                'Ensure all back returns are filed before objecting',
                'Assessment must be challenged on specific grounds (wrong computation, wrong year, etc.)',
            ],
            strategicFlags: [
                'LIMITATION: 30-day window for objection is NON-EXTENDABLE',
                'Consider Alternative Dispute Resolution (ADR) with FIRS before TAT',
                'TAT proceedings are less formal than courts — persuasive advocacy important',
                'FHC appeal only on points of law — facts must be settled at TAT level',
            ],
        },
    },

    // ── 9. NUPRC LICENSE APPLICATION ────────────────────────────────────────
    'NUPRC License Application': {
        [CourtType.FederalHighCourt]: {
            action: 'NUPRC License Application',
            jurisdiction: CourtType.FederalHighCourt,
            requirements: [
                'Application Letter to NUPRC Director General',
                'Technical Competence Evidence (Staff CVs, Equipment)',
                'Financial Capacity Statement (Audited Accounts)',
                'Company Incorporation Documents',
                'Environmental Impact Assessment (EIA) where applicable',
                'Local Content Plan',
                'Signature Bonus / Application Fee Payment',
            ],
            deadlines: {
                'NUPRC Response': '60–90 days from application',
                'License Renewal': '6 months before expiry',
                'Annual Performance Report': 'January 31 each year',
            },
            nextSteps: [
                'Prepare Technical & Financial Capacity Documents',
                'File Application with NUPRC',
                'Respond to Requests for Additional Information',
                'Technical Evaluation by NUPRC',
                'Ministerial Approval (for OPL/OML)',
                'Execution of License Agreement',
                'Ongoing Compliance Reporting',
            ],
            complianceChecks: [
                'Petroleum Industry Act (PIA) 2021 governs all licensing from 2021',
                'Local Content obligations under NOGIC Act are mandatory',
                'Environmental permits from NESREA required separately',
                'Community Development Agreement (CDA) required for host communities',
            ],
            strategicFlags: [
                'PIA 2021 introduced NUPRC (upstream) and NMDPRA (midstream/downstream)',
                'Block licenses (OPL) now through competitive bid rounds',
                'Frontier basins offer lower entry costs and tax incentives',
                'JV and PSC structures require separate negotiations with NNPC',
            ],
        },
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// LEGAL ACTIONS CATALOGUE
// ─────────────────────────────────────────────────────────────────────────────

export const LEGAL_ACTIONS = [
    'Writ of Summons',
    'Originating Summons',
    'Undefended List (Debt Recovery)',
    'Motion on Notice',
    'Ex Parte Motion',
    'Enforce Judgment',
    'CAC Filing (Corporate)',
    'Tax Objection (FIRS)',
    'NUPRC License Application',
];

// ─────────────────────────────────────────────────────────────────────────────
// JURISDICTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const JURISDICTIONS = [
    CourtType.StateHighCourt,
    CourtType.FederalHighCourt,
    CourtType.NationalIndustrialCourt,
    CourtType.MagistrateCourt,
    CourtType.CourtOfAppeal,
    CourtType.SupremeCourt,
];
