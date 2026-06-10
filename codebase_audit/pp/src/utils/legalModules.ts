import { CourtType, MatterType } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// LEGAL INTELLIGENCE MODULE ARCHITECTURE
//
// This is the "plug-in" system for legal rules. Every procedural rule,
// court practice direction, statute, or case law database is a "module"
// that can be:
//   - Bundled (included with Enterprise plan at no extra cost)
//   - Licensed (purchasable add-on)
//   - Coming Soon (in development)
//
// The app queries this registry to determine what guidance it can provide
// for a given legal action + jurisdiction combination. If a module is
// not 'active', the app gracefully degrades (shows generic guidance or 
// prompts the firm to enquire about the module).
// ─────────────────────────────────────────────────────────────────────────────

export type ModuleCategory =
    | 'civil_procedure'
    | 'criminal_procedure'
    | 'arbitration'
    | 'regulatory'
    | 'case_law'
    | 'practice_directions'
    | 'legislation';

export type ModuleStatus = 'active' | 'locked' | 'coming_soon';

export interface LegalModule {
    id: string;
    moduleKey?: string;
    name: string;
    shortName: string;
    category: ModuleCategory;
    /** The CourtType this module covers (undefined for non-court-specific modules) */
    court?: CourtType;
    /** Human-readable jurisdiction description */
    jurisdiction: string;
    version: string;
    description: string;
    /** Which legal actions (from LEGAL_ACTIONS) this module can advise on */
    coverageAreas: string[];
    /** Which MatterTypes benefit most from this module */
    primaryMatterTypes: MatterType[];
    status: ModuleStatus;
    /** If true, included in Enterprise plan at no additional cost */
    isBundled: boolean;
    lastUpdated: string;
    /** Publisher / source authority */
    authority: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export const LEGAL_MODULES: LegalModule[] = [
    // ── Nigerian Civil Procedure (Active / Bundled) ──────────────────────────
    {
        id: 'lagos_hc_civil_2019',
        name: 'Lagos State High Court Civil Procedure Rules 2019',
        shortName: 'Lagos HC Rules',
        category: 'civil_procedure',
        court: CourtType.StateHighCourt,
        jurisdiction: 'Lagos State',
        version: '2019 Edition',
        authority: 'Lagos State Judiciary',
        description:
            'Covers all originating processes (Writ, Originating Summons, Undefended List), motion practice, pre-trial case management, trial procedure, and judgment enforcement under the Lagos State High Court Civil Procedure Rules 2019.',
        coverageAreas: [
            'Writ of Summons',
            'Originating Summons',
            'Undefended List (Debt Recovery)',
            'Motion on Notice',
            'Ex Parte Motion',
            'Enforce Judgment',
        ],
        primaryMatterTypes: [MatterType.CivilLitigation, MatterType.CorporateCommercial],
        status: 'active',
        isBundled: true,
        lastUpdated: '2024-01-01',
    },
    {
        id: 'fhc_civil_2019',
        name: 'Federal High Court (Civil Procedure) Rules 2019',
        shortName: 'FHC Rules',
        category: 'civil_procedure',
        court: CourtType.FederalHighCourt,
        jurisdiction: 'Federal (All States)',
        version: '2019 Edition',
        authority: 'Federal High Court of Nigeria',
        description:
            'Covers civil originating processes, motion practice, admiralty proceedings, intellectual property matters, banking & finance disputes, and judgment enforcement in the Federal High Court.',
        coverageAreas: [
            'Writ of Summons',
            'Originating Summons',
            'Undefended List (Debt Recovery)',
            'Motion on Notice',
            'Ex Parte Motion',
            'Enforce Judgment',
            'Tax Objection (FIRS)',
            'NUPRC License Application',
        ],
        primaryMatterTypes: [
            MatterType.CivilLitigation,
            MatterType.MaritimeAdmiralty,
            MatterType.Tax,
            MatterType.OilGas,
        ],
        status: 'active',
        isBundled: true,
        lastUpdated: '2024-01-01',
    },
    {
        id: 'nicn_2017',
        name: 'National Industrial Court (Civil Procedure) Rules 2017',
        shortName: 'NICN Rules',
        category: 'civil_procedure',
        court: CourtType.NationalIndustrialCourt,
        jurisdiction: 'Federal — Employment & Labour',
        version: '2017 Edition',
        authority: 'National Industrial Court of Nigeria',
        description:
            'Employment disputes, wrongful dismissal, trade union matters, and fundamental rights in the employment context under the NICN Rules. Includes mandatory pre-trial settlement procedure.',
        coverageAreas: ['Writ of Summons', 'Motion on Notice', 'Ex Parte Motion'],
        primaryMatterTypes: [MatterType.EmploymentLabor],
        status: 'active',
        isBundled: true,
        lastUpdated: '2024-01-01',
    },

    // ── Regulatory Modules (Active / Bundled) ────────────────────────────────
    {
        id: 'cama_2020',
        name: 'Companies and Allied Matters Act 2020 — Corporate Filings',
        shortName: 'CAMA 2020',
        category: 'legislation',
        jurisdiction: 'Federal — Corporate Registry (CAC)',
        version: '2020',
        authority: 'Corporate Affairs Commission',
        description:
            'Incorporation, annual returns, director/shareholder changes, share capital restructuring, and winding-up under CAMA 2020. Includes CAMA 2020 single-member/director provisions.',
        coverageAreas: ['CAC Filing (Corporate)'],
        primaryMatterTypes: [MatterType.CorporateCommercial],
        status: 'active',
        isBundled: true,
        lastUpdated: '2024-01-01',
    },
    {
        id: 'firs_tax_2023',
        name: 'FIRS Tax Dispute Resolution — Objection & TAT Procedure',
        shortName: 'FIRS Tax Module',
        category: 'regulatory',
        jurisdiction: 'Federal — Tax (FIRS / TAT / FHC)',
        version: '2023',
        authority: 'Federal Inland Revenue Service',
        description:
            'Federal tax assessments, objection procedure (30-day window), Tax Appeal Tribunal (TAT) appeals, and escalation to FHC. Covers CITA, PITA, VATA, and transfer pricing disputes.',
        coverageAreas: ['Tax Objection (FIRS)'],
        primaryMatterTypes: [MatterType.Tax],
        status: 'active',
        isBundled: true,
        lastUpdated: '2024-01-01',
    },
    {
        id: 'pia_2021_nuprc',
        name: 'Petroleum Industry Act 2021 — NUPRC Regulatory Licensing',
        shortName: 'PIA 2021 / NUPRC',
        category: 'regulatory',
        jurisdiction: 'Federal — Upstream Oil & Gas (NUPRC)',
        version: '2021',
        authority: 'Nigerian Upstream Petroleum Regulatory Commission',
        description:
            'Upstream petroleum licensing (OPL/OML), exploration programmes, field development plans, and local content obligations under the Petroleum Industry Act 2021.',
        coverageAreas: ['NUPRC License Application'],
        primaryMatterTypes: [MatterType.OilGas],
        status: 'active',
        isBundled: true,
        lastUpdated: '2024-01-01',
    },

    // ── Additional Court Rules (Locked — Licenseable Add-ons) ───────────────
    {
        id: 'abuja_hc_2018',
        name: 'FCT High Court (Civil Procedure) Rules 2018',
        shortName: 'Abuja HC Rules',
        category: 'civil_procedure',
        court: CourtType.StateHighCourt,
        jurisdiction: 'FCT Abuja',
        version: '2018 Edition',
        authority: 'High Court of the Federal Capital Territory',
        description:
            'Civil procedure for the FCT High Court in Abuja — the most common forum for federal-facing litigation outside the FHC.',
        coverageAreas: ['Writ of Summons', 'Originating Summons', 'Motion on Notice', 'Ex Parte Motion', 'Enforce Judgment'],
        primaryMatterTypes: [MatterType.CivilLitigation],
        status: 'locked',
        isBundled: false,
        lastUpdated: '2024-01-01',
    },
    {
        id: 'rivers_hc',
        name: 'Rivers State High Court Civil Procedure Rules',
        shortName: 'Rivers HC Rules',
        category: 'civil_procedure',
        jurisdiction: 'Rivers State',
        version: 'Current Edition',
        authority: 'Rivers State Judiciary',
        description: 'Civil procedure rules for the Rivers State High Court — key for Port Harcourt-based litigation and energy disputes.',
        coverageAreas: ['Writ of Summons', 'Originating Summons', 'Motion on Notice'],
        primaryMatterTypes: [MatterType.CivilLitigation, MatterType.OilGas],
        status: 'coming_soon',
        isBundled: false,
        lastUpdated: '2024-01-01',
    },
    {
        id: 'kano_hc',
        name: 'Kano State High Court Civil Procedure Rules',
        shortName: 'Kano HC Rules',
        category: 'civil_procedure',
        jurisdiction: 'Kano State',
        version: 'Current Edition',
        authority: 'Kano State Judiciary',
        description: 'Civil procedure for the Kano State High Court — the principal commercial court in Northern Nigeria.',
        coverageAreas: ['Writ of Summons', 'Originating Summons', 'Motion on Notice'],
        primaryMatterTypes: [MatterType.CivilLitigation],
        status: 'coming_soon',
        isBundled: false,
        lastUpdated: '2024-01-01',
    },
    {
        id: 'court_of_appeal_rules_2021',
        name: 'Court of Appeal Rules 2021',
        shortName: 'Court of Appeal Rules',
        category: 'civil_procedure',
        court: CourtType.CourtOfAppeal,
        jurisdiction: 'Federal (All Divisions)',
        version: '2021 Edition',
        authority: 'Court of Appeal of Nigeria',
        description:
            'Governs appellate procedure including filing of records of appeal, briefs of argument, and hearing at the Court of Appeal.',
        coverageAreas: [],
        primaryMatterTypes: [MatterType.CivilLitigation],
        status: 'coming_soon',
        isBundled: false,
        lastUpdated: '2024-01-01',
    },

    // ── Case Law Databases (Future Premium Add-ons) ──────────────────────────
    {
        id: 'nwlr',
        name: 'Nigerian Weekly Law Reports (NWLR)',
        shortName: 'NWLR Case Law',
        category: 'case_law',
        jurisdiction: 'Federal & All States',
        version: 'Current',
        authority: 'Nigerian Law Publications',
        description:
            'Full-text access to Nigerian Weekly Law Reports — searchable by court, subject matter, year, and principle. Powers ALOA case law reasoning.',
        coverageAreas: [],
        primaryMatterTypes: Object.values(MatterType),
        status: 'coming_soon',
        isBundled: false,
        lastUpdated: '2024-01-01',
    },
    {
        id: 'supreme_court_reports',
        name: 'Supreme Court of Nigeria Law Reports',
        shortName: 'SCNLR',
        category: 'case_law',
        jurisdiction: 'Federal (Apex Court)',
        version: 'Current',
        authority: 'Supreme Court of Nigeria',
        description:
            'Official Supreme Court judgments — searchable full text for citation, precedent analysis, and ALOA legal reasoning.',
        coverageAreas: [],
        primaryMatterTypes: Object.values(MatterType),
        status: 'coming_soon',
        isBundled: false,
        lastUpdated: '2024-01-01',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// QUERY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Get all active modules (bundled with Enterprise) */
export const getActiveModules = (): LegalModule[] =>
    LEGAL_MODULES.filter(m => m.status === 'active');

/** For a given legal action, which courts have active rule modules? */
export const getActiveCourtsForAction = (legalAction: string): CourtType[] =>
    LEGAL_MODULES.filter(m => m.status === 'active' && m.court && m.coverageAreas.includes(legalAction))
        .map(m => m.court as CourtType);

/** Does this court + action combination have an active module? */
export const hasActiveModule = (court: CourtType, legalAction: string, state?: string): boolean =>
    LEGAL_MODULES.some(m => 
        m.status === 'active' && 
        m.court === court && 
        m.coverageAreas.includes(legalAction) &&
        (!state || (m.jurisdiction && m.jurisdiction.includes(state)))
    );

/** Get the active module for a court + action (first match, factoring in state) */
export const getModuleForCourtAndAction = (court: CourtType, legalAction: string, state?: string): LegalModule | undefined =>
    LEGAL_MODULES.find(m => 
        m.status === 'active' && 
        m.court === court && 
        m.coverageAreas.includes(legalAction) &&
        (!state || (m.jurisdiction && m.jurisdiction.includes(state)))
    );

/** Infer the best MatterType from a legal action */
export const inferMatterType = (legalAction?: string): MatterType => {
    const map: Record<string, MatterType> = {
        'CAC Filing (Corporate)': MatterType.CorporateCommercial,
        'Tax Objection (FIRS)': MatterType.Tax,
        'NUPRC License Application': MatterType.OilGas,
    };
    return legalAction ? (map[legalAction] || MatterType.CivilLitigation) : MatterType.CivilLitigation;
};

/** Count active modules */
export const getActiveModuleCount = (): number =>
    LEGAL_MODULES.filter(m => m.status === 'active').length;

/** Count locked (purchasable) modules */
export const getLockedModuleCount = (): number =>
    LEGAL_MODULES.filter(m => m.status === 'locked').length;
