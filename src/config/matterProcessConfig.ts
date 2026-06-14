/**
 * matterProcessConfig.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Master configuration for PracticePro VEGA's Dynamic Matter Intake System.
 *
 * This file is the single source of truth that drives the SmartMatterModal.
 * When a user selects a legal process (e.g. "Notice of Appeal"), the modal
 * reads this config to:
 *   1. Show the correct party labels (Appellant / Respondent, not Claimant / Defendant)
 *   2. Show the correct secondary party options (Co-Appellant, Cross-Respondent, etc.)
 *   3. Render the specific intake fields required for that process
 *   4. Surface the correct ARIA drafting expectation metadata
 *
 * Generated from the comprehensive Nigerian Legal Procedure schema (April 2026).
 */

export type IntakeFieldType = 'text' | 'textarea' | 'number' | 'date' | 'boolean_select';

export interface IntakeField {
  fieldId:   string;
  label:     string;
  type:      IntakeFieldType;
  required:  boolean;
  /** If true, format value with NGN (₦) currency mask */
  isCurrency?: boolean;
  placeholder?: string;
}

export interface MatterProcessConfig {
  processId:                   string;
  processCategoryName:         string;
  primaryPartyLabel:           string;    // e.g. "Appellant"
  opposingPartyLabel:          string | null; // null = hide opposing party row (ex parte, CAC)
  secondaryParties:            string[];  // additional party chips to show
  keyIntakeFields:             IntakeField[];
  draftingExpectations:        string;
  /** Used to map from the old LITIGATION_ACTIONS dropdown strings */
  legacyDropdownAlias?:        string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// LITIGATION & CONTENTIOUS
// ─────────────────────────────────────────────────────────────────────────────

export const MATTER_PROCESS_CONFIGS: MatterProcessConfig[] = [
  {
    processId: 'writ_of_summons',
    processCategoryName: 'Writ of Summons (General Civil)',
    primaryPartyLabel: 'Claimant',
    opposingPartyLabel: 'Defendant',
    secondaryParties: ['Co-Claimant', 'Co-Defendant', 'Third Party'],
    legacyDropdownAlias: ['Writ of Summons'],
    keyIntakeFields: [
      { fieldId: 'brief_facts',   label: 'Brief Facts of the Claim',    type: 'textarea', required: true,  placeholder: 'Summarise the cause of action...' },
      { fieldId: 'principal_sum', label: 'Principal Sum Claimed (₦)',   type: 'number',   required: false, isCurrency: true, placeholder: '0' },
      { fieldId: 'reliefs_sought',label: 'Specific Reliefs Sought',     type: 'textarea', required: true,  placeholder: 'List each relief on a new line...' },
    ],
    draftingExpectations: 'Draft Writ of Summons, Statement of Claim, List of Witnesses, Witness Depositions, and List of Documents to be relied upon.',
  },

  {
    processId: 'originating_summons',
    processCategoryName: 'Originating Summons',
    primaryPartyLabel: 'Applicant',
    opposingPartyLabel: 'Respondent',
    secondaryParties: ['Co-Applicant', 'Co-Respondent', 'AG of the Federation', 'AG of the State'],
    legacyDropdownAlias: ['Originating Summons'],
    keyIntakeFields: [
      { fieldId: 'questions_for_determination', label: 'Questions for Determination', type: 'textarea', required: true,  placeholder: 'State each question on a new line...' },
      { fieldId: 'exhibit_list',                label: 'Summary of Key Exhibits',      type: 'textarea', required: true,  placeholder: 'List documentary evidence to be relied upon...' },
      { fieldId: 'ag_joinder',                  label: 'Is the AGF / AGS joined?',     type: 'text',     required: true,  placeholder: 'Yes / No — state which AG and why' },
    ],
    draftingExpectations: 'Draft Originating Summons, Affidavit in Support, Written Address, and List of Exhibits.',
  },

  {
    processId: 'undefended_list',
    processCategoryName: 'Undefended List Procedure',
    primaryPartyLabel: 'Claimant',
    opposingPartyLabel: 'Defendant',
    secondaryParties: [],
    legacyDropdownAlias: ['Undefended List (Debt Recovery)'],
    keyIntakeFields: [
      { fieldId: 'principal_debt',   label: 'Principal Debt Sum (₦)',                   type: 'number', required: true,  isCurrency: true, placeholder: '0' },
      { fieldId: 'date_of_demand',   label: 'Date of Demand Notice',                    type: 'date',   required: true },
      { fieldId: 'liquidated_claim', label: 'Confirm claim is for a liquidated sum?',   type: 'text',   required: true,  placeholder: 'Yes / No — if No, use Writ of Summons instead' },
    ],
    draftingExpectations: "Draft Writ of Summons endorsed 'Undefended List', Statement of Claim, and Affidavit verifying the cause of action.",
  },

  {
    processId: 'fundamental_rights',
    processCategoryName: 'Fundamental Rights Enforcement (FRE)',
    primaryPartyLabel: 'Applicant',
    opposingPartyLabel: 'Respondent',
    secondaryParties: ['Interested Party', 'Attorney-General (Mandatory Joinder)'],
    legacyDropdownAlias: ['Fundamental Rights Enforcement'],
    keyIntakeFields: [
      { fieldId: 'right_infringed',     label: 'Specific Right Infringed',                             type: 'text',   required: true,  placeholder: 'e.g. Right to Life (s.33), Fair Hearing (s.36)' },
      { fieldId: 'date_of_infringement',label: 'Date of Infringement',                                 type: 'date',   required: true },
      { fieldId: 'relief_type',         label: 'Type of Relief',                                       type: 'text',   required: true,  placeholder: 'e.g. Declaration, Injunction, Damages, Committal' },
    ],
    draftingExpectations: 'Draft Originating Motion on Notice, Affidavit in Support, Written Address, and ensure mandatory joinder of the AG.',
  },

  {
    processId: 'motion_on_notice',
    processCategoryName: 'Motion on Notice (Interlocutory)',
    primaryPartyLabel: 'Applicant',
    opposingPartyLabel: 'Respondent',
    secondaryParties: ['Interested Party'],
    legacyDropdownAlias: ['Motion on Notice'],
    keyIntakeFields: [
      { fieldId: 'relief_sought',        label: 'Relief(s) Sought in the Motion',  type: 'textarea', required: true,  placeholder: 'State each relief...' },
      { fieldId: 'parent_suit_no',       label: 'Parent Suit No.',                 type: 'text',     required: false, placeholder: 'If filed in existing proceedings' },
      { fieldId: 'grounds_of_motion',    label: 'Grounds of the Motion',           type: 'textarea', required: true,  placeholder: 'Summarise grounds...' },
    ],
    draftingExpectations: 'Draft Motion on Notice, Affidavit in Support, and Written Address.',
  },

  {
    processId: 'ex_parte_motion',
    processCategoryName: 'Ex Parte Application',
    primaryPartyLabel: 'Applicant',
    opposingPartyLabel: null,  // No opposing party shown
    secondaryParties: [],
    legacyDropdownAlias: ['Ex Parte Motion'],
    keyIntakeFields: [
      { fieldId: 'urgency_justification', label: 'Justification for Urgency',  type: 'textarea', required: true,  placeholder: 'Why cannot the other side be put on notice?' },
      { fieldId: 'proposed_order',        label: 'Proposed Terms of Order',    type: 'textarea', required: true,  placeholder: 'Draft the exact order you seek...' },
      { fieldId: 'return_date',           label: 'Proposed Return Date',       type: 'date',     required: true },
    ],
    draftingExpectations: 'Draft Motion Ex Parte, Affidavit in Support, and Written Address. No opposing party named at this stage.',
  },

  {
    processId: 'enforce_judgment',
    processCategoryName: 'Enforcement of Judgment',
    primaryPartyLabel: 'Judgment Creditor',
    opposingPartyLabel: 'Judgment Debtor',
    secondaryParties: [],
    legacyDropdownAlias: ['Enforce Judgment'],
    keyIntakeFields: [
      { fieldId: 'judgment_suit_no',    label: 'Original Judgment Suit No.',         type: 'text',   required: true,  placeholder: 'e.g. FHC/L/CS/000/2024' },
      { fieldId: 'judgment_sum',        label: 'Unsatisfied Judgment Sum (₦)',        type: 'number', required: true,  isCurrency: true, placeholder: '0' },
      { fieldId: 'enforcement_method',  label: 'Method of Enforcement',              type: 'text',   required: true,  placeholder: 'e.g. Garnishee, Writ of FIFA, Committal' },
    ],
    draftingExpectations: 'Draft application for chosen enforcement method, supporting affidavit, and hearing notice.',
  },

  {
    processId: 'garnishee_proceedings',
    processCategoryName: 'Garnishee Proceedings',
    primaryPartyLabel: 'Judgment Creditor',
    opposingPartyLabel: 'Garnishee (Bank / Institution)',
    secondaryParties: ['Judgment Debtor'],
    legacyDropdownAlias: [],
    keyIntakeFields: [
      { fieldId: 'judgment_sum',           label: 'Unsatisfied Judgment Sum (₦)',  type: 'number', required: true, isCurrency: true, placeholder: '0' },
      { fieldId: 'judgment_debtors_bank',  label: 'Name of Garnishee Bank',        type: 'text',   required: true, placeholder: 'Full bank name' },
      { fieldId: 'judgment_suit_no',       label: 'Original Judgment Suit No.',    type: 'text',   required: true, placeholder: 'e.g. FHC/L/CS/000/2024' },
    ],
    draftingExpectations: 'Draft Garnishee Order Nisi, Affidavit in Support, and Motion to make the Nisi Absolute.',
  },

  // ── APPEALS ────────────────────────────────────────────────────────────────

  {
    processId: 'notice_of_appeal_civil',
    processCategoryName: 'Notice of Appeal (Civil)',
    primaryPartyLabel: 'Appellant',
    opposingPartyLabel: 'Respondent',
    secondaryParties: ['Co-Appellant', 'Co-Respondent', 'Cross-Appellant', 'Cross-Respondent'],
    legacyDropdownAlias: ['Notice of Appeal'],
    keyIntakeFields: [
      { fieldId: 'lower_court_suit_no', label: 'Lower Court Suit No.',                   type: 'text',     required: true,  placeholder: 'e.g. FHC/L/CS/000/2024' },
      { fieldId: 'judgment_date',       label: 'Date of Lower Court Decision / Judgment', type: 'date',     required: true },
      { fieldId: 'draft_grounds',       label: 'Draft Grounds of Appeal',                 type: 'textarea', required: true,  placeholder: 'State each ground on a new line...' },
    ],
    draftingExpectations: "Draft Notice of Appeal, Record of Appeal (Compilation), Appellant's Brief of Argument.",
  },

  {
    processId: 'cross_appeal',
    processCategoryName: 'Cross-Appeal',
    primaryPartyLabel: 'Cross-Appellant',
    opposingPartyLabel: 'Cross-Respondent',
    secondaryParties: ['Appellant (Main)', 'Respondent (Main)'],
    legacyDropdownAlias: ['Cross-Appeal'],
    keyIntakeFields: [
      { fieldId: 'main_appeal_no',              label: 'Main Appeal Number',                            type: 'text',     required: true,  placeholder: 'e.g. CA/L/000/2025' },
      { fieldId: 'date_main_appeal_filed',      label: 'Date Main Notice of Appeal was Filed',         type: 'date',     required: true },
      { fieldId: 'cross_appeal_grounds',        label: 'Grounds of Cross-Appeal',                      type: 'textarea', required: true,  placeholder: 'State parts of the judgment you are also dissatisfied with...' },
    ],
    draftingExpectations: "Draft Notice of Cross-Appeal, Cross-Appellant's Brief of Argument.",
  },

  {
    processId: 'notice_of_appeal_criminal',
    processCategoryName: 'Notice of Appeal (Criminal)',
    primaryPartyLabel: 'Appellant',
    opposingPartyLabel: 'Respondent (State)',
    secondaryParties: ['Co-Appellant'],
    legacyDropdownAlias: ['Notice of Appeal (Criminal)'],
    keyIntakeFields: [
      { fieldId: 'charge_no',         label: 'Charge Sheet Number',          type: 'text', required: true,  placeholder: 'e.g. CR/000/2024' },
      { fieldId: 'conviction_date',   label: 'Date of Conviction / Sentence', type: 'date', required: true },
      { fieldId: 'sentence_imposed',  label: 'Sentence Imposed',             type: 'text', required: true,  placeholder: 'e.g. 5 years IHL, ₦500,000 fine' },
    ],
    draftingExpectations: "Draft Notice of Appeal (Criminal), Application for Bail pending Appeal, Appellant's Brief.",
  },

  // ── SPECIALISED PROCEEDINGS ────────────────────────────────────────────────

  {
    processId: 'election_petition',
    processCategoryName: 'Election Petition',
    primaryPartyLabel: 'Petitioner',
    // Nigerian election law mandates three named respondents
    opposingPartyLabel: '1st Respondent (Winner) / 2nd Respondent (INEC) / 3rd Respondent (Political Party)',
    secondaryParties: ['4th Respondent (If applicable)'],
    legacyDropdownAlias: ['Election Petition'],
    keyIntakeFields: [
      { fieldId: 'election_date',      label: 'Date of Election',            type: 'date',     required: true },
      { fieldId: 'constituency',       label: 'Constituency / State / FCT',  type: 'text',     required: true, placeholder: 'e.g. Lagos State Governorship, Eti-Osa Federal Constituency' },
      { fieldId: 'electoral_relief',   label: 'Specific Electoral Relief',   type: 'textarea', required: true, placeholder: 'e.g. Nullification of election, Return of Petitioner as winner' },
    ],
    draftingExpectations: 'Draft Election Petition, List of Witnesses, Witness Statements on Oath, List of Documents.',
  },

  {
    processId: 'divorce_petition',
    processCategoryName: 'Divorce / Matrimonial Cause',
    primaryPartyLabel: 'Petitioner',
    opposingPartyLabel: 'Respondent',
    secondaryParties: ['Co-Respondent (Adultery)'],
    legacyDropdownAlias: ['Divorce Petition', 'Matrimonial Cause'],
    keyIntakeFields: [
      { fieldId: 'marriage_date',       label: 'Date of Marriage',                     type: 'date', required: true },
      { fieldId: 'marriage_cert_no',    label: 'Marriage Certificate No. / Place',    type: 'text', required: true, placeholder: 'e.g. Lagos Registry — Cert No. 0000' },
      { fieldId: 'ground_for_divorce',  label: 'Ground for Dissolution',              type: 'text', required: true, placeholder: 'e.g. Irreconcilable differences, Adultery, Cruelty' },
    ],
    draftingExpectations: "Draft Petition for Dissolution, Affidavit in Support, Children's matters form (if applicable).",
  },

  {
    processId: 'winding_up_petition',
    processCategoryName: 'Winding Up Petition',
    primaryPartyLabel: 'Petitioner',
    opposingPartyLabel: 'Company (Respondent)',
    secondaryParties: ['Contributories', 'Official Receiver'],
    legacyDropdownAlias: ['Winding Up Petition'],
    keyIntakeFields: [
      { fieldId: 'company_rc_no',      label: 'Company RC Number',      type: 'text', required: true,  placeholder: 'RC 0000000' },
      { fieldId: 'company_name',       label: 'Exact Registered Name',  type: 'text', required: true,  placeholder: 'As registered with CAC' },
      { fieldId: 'winding_up_ground',  label: 'Ground for Winding Up',  type: 'text', required: true,  placeholder: 'e.g. Inability to pay debts, Just & Equitable' },
    ],
    draftingExpectations: 'Draft Petition for Winding Up, Affidavit Verifying Petition, List of Contributories.',
  },

  // ── CORPORATE / NON-CONTENTIOUS ────────────────────────────────────────────

  {
    processId: 'cac_incorporation',
    processCategoryName: 'CAC Corporate Filing (Incorporation)',
    primaryPartyLabel: 'Applicant / Subscriber',
    opposingPartyLabel: null, // No opposing party — regulatory filing
    secondaryParties: ['Proposed Directors', 'Proposed Secretary'],
    legacyDropdownAlias: ['CAC Filing (Corporate)'],
    keyIntakeFields: [
      { fieldId: 'proposed_name_1', label: 'First Choice Company Name',         type: 'text',     required: true,  placeholder: 'Exact name as you want registered' },
      { fieldId: 'share_capital',   label: 'Authorized Share Capital (₦)',       type: 'number',   required: true,  isCurrency: true, placeholder: '1000000' },
      { fieldId: 'company_objects', label: 'Brief Statement of Company Objects', type: 'textarea', required: true,  placeholder: 'e.g. To carry on the business of...' },
    ],
    draftingExpectations: 'Draft CAC Form (e.g. CAC1.1), Memorandum of Association (MOA), Articles of Association (AOA).',
  },

  {
    processId: 'tax_objection',
    processCategoryName: 'Tax Objection (FIRS / SIRS)',
    primaryPartyLabel: 'Taxpayer / Objector',
    opposingPartyLabel: 'FIRS / SIRS',
    secondaryParties: [],
    legacyDropdownAlias: ['Tax Objection (FIRS)'],
    keyIntakeFields: [
      { fieldId: 'assessment_no',    label: 'Tax Assessment Reference No.',     type: 'text',   required: true,  placeholder: 'FIRS assessment reference' },
      { fieldId: 'tax_year',         label: 'Tax Year Under Review',            type: 'text',   required: true,  placeholder: 'e.g. 2022 – 2023' },
      { fieldId: 'disputed_sum',     label: 'Disputed Tax Sum (₦)',             type: 'number', required: true,  isCurrency: true, placeholder: '0' },
    ],
    draftingExpectations: 'Draft Notice of Objection, supporting schedule of computation, and Written Address for TAT appeal if needed.',
  },

  {
    processId: 'other_bespoke',
    processCategoryName: 'Other / Bespoke Action',
    primaryPartyLabel: 'Initiating Party',
    opposingPartyLabel: 'Opposing Party',
    secondaryParties: ['Additional Party'],
    legacyDropdownAlias: ['Other / Bespoke Action'],
    keyIntakeFields: [
      { fieldId: 'action_description', label: 'Describe the Legal Action',  type: 'textarea', required: true, placeholder: 'Briefly describe the nature of this matter...' },
    ],
    draftingExpectations: 'ARIA will use the matter description to suggest appropriate documents.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Lookup a config by processId */
export function getProcessConfig(processId: string): MatterProcessConfig | undefined {
  return MATTER_PROCESS_CONFIGS.find(c => c.processId === processId);
}

/** Get config by a legacy dropdown label (for backwards compat) */
export function getProcessConfigByLabel(label: string): MatterProcessConfig | undefined {
  return MATTER_PROCESS_CONFIGS.find(c =>
    c.processCategoryName === label ||
    c.legacyDropdownAlias?.some(a => a.toLowerCase() === label.toLowerCase())
  );
}

/** Returns the list of process names to render in the dropdown */
export const LITIGATION_PROCESS_OPTIONS = MATTER_PROCESS_CONFIGS.map(c => ({
  processId: c.processId,
  label:     c.processCategoryName,
}));
