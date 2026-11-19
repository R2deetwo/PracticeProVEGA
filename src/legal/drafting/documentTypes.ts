/**
 * legal/drafting/documentTypes.ts — THE document taxonomy for the Voice →
 * DraftPro pipeline (owner spec 2026-11-19, §5c).
 *
 * Before this module the app had SEVEN disjoint document-type vocabularies
 * (skeleton keys, template names, free voice strings…). This file is now
 * the single source of truth: `DocumentType` is defined exactly once here
 * (as the const array DOCUMENT_TYPES) and imported everywhere else
 * (Phase-0 report, gap (a)–(g)).
 *
 * Contains, all deterministic and pure:
 *   - DOCUMENT_TYPES: the 52 enum values (snake_case, spec §5c verbatim)
 *   - DOCUMENT_TYPE_CATEGORIES / DOCUMENT_TYPE_LABELS
 *   - ALIAS_MAP: spoken names ("7 day notice", "NTQ", "SOC", "SOD",
 *     "brief", "fifa", "ex parte") resolved to the enum WITHOUT the LLM
 *     (spec §4.4: deterministic alias map first, LLM second)
 *   - BUNDLE_ORDER: filing-logic dependency order (processes → affidavit →
 *     written address; Notice to Quit before Seven Days' Notice; spec §4.3)
 *
 * Zero imports — shared verbatim by the client bundle, the Convex function
 * bundle (convex/voiceCapture.ts) and unit tests.
 */

import type { DocumentCategory } from "./types";

/** The complete enum (spec §5c — every listed value, exactly once). */
export const DOCUMENT_TYPES = [
  // Originating / commencement
  "writ_of_summons",
  "indorsement_of_claim",
  "statement_of_claim",
  "originating_summons",
  "petition",
  "originating_motion",
  // Pleadings
  "statement_of_defence",
  "statement_of_defence_and_counterclaim",
  "reply_to_statement_of_defence",
  "reply_and_defence_to_counterclaim",
  // Interlocutory
  "motion_on_notice",
  "motion_ex_parte",
  "notice_of_preliminary_objection",
  "counter_affidavit",
  "further_and_better_affidavit",
  "supporting_affidavit",
  "written_address",
  "final_written_address",
  // Case management / evidence
  "witness_statement_on_oath",
  "list_of_witnesses",
  "list_of_documents",
  "pre_trial_information_sheet",
  "subpoena",
  "notice_to_produce",
  "notice_to_admit",
  // Execution and enforcement
  "garnishee_application",
  "writ_of_fi_fa",
  "judgment_debtor_summons",
  "stay_of_execution",
  "terms_of_settlement",
  // Appellate
  "notice_of_appeal",
  "grounds_of_appeal",
  "appellants_brief",
  "respondents_brief",
  "reply_brief",
  "motion_for_leave_or_extension",
  // Statutory notices
  "notice_to_quit",
  "seven_days_notice_of_intention",
  "statutory_demand_notice",
  "pre_action_notice",
  "notice_of_breach_of_covenant",
  // Letters / instruments
  "formal_demand_letter",
  "engagement_letter",
  "official_correspondence",
  "tenancy_or_lease_agreement",
  "deed_of_assignment",
  "power_of_attorney",
  "mou_or_heads_of_terms",
  // Forms
  "memorandum_of_appearance",
  "conditional_memorandum_of_appearance",
  "certificate_of_pre_action_counselling",
  "undertaking_as_to_costs",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Category lookup (spec §3 DocumentCategory). */
export const DOCUMENT_TYPE_CATEGORIES: Record<DocumentType, DocumentCategory> = {
  writ_of_summons: "litigation_process",
  indorsement_of_claim: "litigation_process",
  statement_of_claim: "litigation_process",
  originating_summons: "litigation_process",
  petition: "litigation_process",
  originating_motion: "litigation_process",
  statement_of_defence: "litigation_process",
  statement_of_defence_and_counterclaim: "litigation_process",
  reply_to_statement_of_defence: "litigation_process",
  reply_and_defence_to_counterclaim: "litigation_process",
  motion_on_notice: "litigation_process",
  motion_ex_parte: "litigation_process",
  notice_of_preliminary_objection: "litigation_process",
  counter_affidavit: "litigation_process",
  further_and_better_affidavit: "litigation_process",
  supporting_affidavit: "litigation_process",
  written_address: "litigation_process",
  final_written_address: "litigation_process",
  witness_statement_on_oath: "litigation_process",
  list_of_witnesses: "litigation_process",
  list_of_documents: "litigation_process",
  pre_trial_information_sheet: "litigation_process",
  subpoena: "litigation_process",
  notice_to_produce: "litigation_process",
  notice_to_admit: "litigation_process",
  garnishee_application: "execution_and_enforcement",
  writ_of_fi_fa: "execution_and_enforcement",
  judgment_debtor_summons: "execution_and_enforcement",
  stay_of_execution: "execution_and_enforcement",
  terms_of_settlement: "execution_and_enforcement",
  notice_of_appeal: "appellate_process",
  grounds_of_appeal: "appellate_process",
  appellants_brief: "appellate_process",
  respondents_brief: "appellate_process",
  reply_brief: "appellate_process",
  motion_for_leave_or_extension: "appellate_process",
  notice_to_quit: "statutory_notice",
  seven_days_notice_of_intention: "statutory_notice",
  statutory_demand_notice: "statutory_notice",
  pre_action_notice: "statutory_notice",
  notice_of_breach_of_covenant: "statutory_notice",
  formal_demand_letter: "formal_letter",
  engagement_letter: "formal_letter",
  official_correspondence: "formal_letter",
  tenancy_or_lease_agreement: "commercial_or_property_instrument",
  deed_of_assignment: "commercial_or_property_instrument",
  power_of_attorney: "commercial_or_property_instrument",
  mou_or_heads_of_terms: "commercial_or_property_instrument",
  memorandum_of_appearance: "standard_form",
  conditional_memorandum_of_appearance: "standard_form",
  certificate_of_pre_action_counselling: "standard_form",
  undertaking_as_to_costs: "standard_form",
};

/** Human labels (triage card, bundle tabs, editor title). */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  writ_of_summons: "Writ of Summons",
  indorsement_of_claim: "Indorsement of Claim",
  statement_of_claim: "Statement of Claim",
  originating_summons: "Originating Summons",
  petition: "Petition",
  originating_motion: "Originating Motion (FREP)",
  statement_of_defence: "Statement of Defence",
  statement_of_defence_and_counterclaim: "Statement of Defence and Counterclaim",
  reply_to_statement_of_defence: "Reply to Statement of Defence",
  reply_and_defence_to_counterclaim: "Reply and Defence to Counterclaim",
  motion_on_notice: "Motion on Notice",
  motion_ex_parte: "Motion Ex Parte",
  notice_of_preliminary_objection: "Notice of Preliminary Objection",
  counter_affidavit: "Counter-Affidavit",
  further_and_better_affidavit: "Further and Better Affidavit",
  supporting_affidavit: "Supporting Affidavit",
  written_address: "Written Address",
  final_written_address: "Final Written Address",
  witness_statement_on_oath: "Witness Statement on Oath",
  list_of_witnesses: "List of Witnesses",
  list_of_documents: "List of Documents",
  pre_trial_information_sheet: "Pre-Trial Information Sheet",
  subpoena: "Subpoena",
  notice_to_produce: "Notice to Produce",
  notice_to_admit: "Notice to Admit",
  garnishee_application: "Garnishee Application",
  writ_of_fi_fa: "Writ of Fi Fa",
  judgment_debtor_summons: "Judgment Debtor Summons",
  stay_of_execution: "Stay of Execution",
  terms_of_settlement: "Terms of Settlement",
  notice_of_appeal: "Notice of Appeal",
  grounds_of_appeal: "Grounds of Appeal",
  appellants_brief: "Appellant's Brief",
  respondents_brief: "Respondent's Brief",
  reply_brief: "Reply Brief",
  motion_for_leave_or_extension: "Motion for Leave / Extension of Time",
  notice_to_quit: "Notice to Quit",
  seven_days_notice_of_intention: "Seven Days' Notice of Intention",
  statutory_demand_notice: "Statutory Demand Notice",
  pre_action_notice: "Pre-Action Notice",
  notice_of_breach_of_covenant: "Notice of Breach of Covenant",
  formal_demand_letter: "Formal Demand Letter",
  engagement_letter: "Engagement Letter",
  official_correspondence: "Official Correspondence",
  tenancy_or_lease_agreement: "Tenancy / Lease Agreement",
  deed_of_assignment: "Deed of Assignment",
  power_of_attorney: "Power of Attorney",
  mou_or_heads_of_terms: "MOU / Heads of Terms",
  memorandum_of_appearance: "Memorandum of Appearance",
  conditional_memorandum_of_appearance: "Conditional Memorandum of Appearance",
  certificate_of_pre_action_counselling: "Certificate of Pre-Action Counselling",
  undertaking_as_to_costs: "Undertaking as to Costs",
};

// ─── Alias resolution (deterministic FIRST, LLM second — spec §4.4) ─────────

/** Normalise a spoken phrase for alias matching. */
function aliasNorm(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Alias table. Keys are normalised spoken forms. Longest keys win when
 *  several match (see resolveDocumentTypeByAlias). */
const ALIAS_ENTRIES: Array<[string, DocumentType]> = [
  // Originating processes
  ["writ of summons", "writ_of_summons"],
  ["writ", "writ_of_summons"],
  ["statement of claim", "statement_of_claim"],
  ["soc", "statement_of_claim"],
  ["claims", "statement_of_claim"],
  ["indorsement of claim", "indorsement_of_claim"],
  ["endorsement of claim", "indorsement_of_claim"],
  ["originating summons", "originating_summons"],
  ["os", "originating_summons"],
  ["petition", "petition"],
  ["originating motion", "originating_motion"],
  ["frep motion", "originating_motion"],
  ["fundamental rights motion", "originating_motion"],
  ["fundamental rights enforcement", "originating_motion"],
  // Pleadings
  ["statement of defence", "statement_of_defence"],
  ["statement of defense", "statement_of_defence"],
  ["sod", "statement_of_defence"],
  ["defence", "statement_of_defence"],
  ["defense", "statement_of_defence"],
  ["statement of defence and counterclaim", "statement_of_defence_and_counterclaim"],
  ["defence and counterclaim", "statement_of_defence_and_counterclaim"],
  ["counterclaim", "statement_of_defence_and_counterclaim"],
  ["reply to statement of defence", "reply_to_statement_of_defence"],
  ["reply", "reply_to_statement_of_defence"],
  ["reply and defence to counterclaim", "reply_and_defence_to_counterclaim"],
  // Motions / interlocutory
  ["motion on notice", "motion_on_notice"],
  ["motion", "motion_on_notice"],
  ["mon", "motion_on_notice"],
  ["ex parte motion", "motion_ex_parte"],
  ["motion ex parte", "motion_ex_parte"],
  ["exparte", "motion_ex_parte"],
  ["ex parte", "motion_ex_parte"],
  ["preliminary objection", "notice_of_preliminary_objection"],
  ["notice of preliminary objection", "notice_of_preliminary_objection"],
  ["counter affidavit", "counter_affidavit"],
  ["counteraffidavit", "counter_affidavit"],
  ["further and better affidavit", "further_and_better_affidavit"],
  ["further affidavit", "further_and_better_affidavit"],
  ["supporting affidavit", "supporting_affidavit"],
  ["affidavit", "supporting_affidavit"],
  ["written address", "written_address"],
  ["final written address", "final_written_address"],
  ["final address", "final_written_address"],
  ["address", "written_address"],
  ["brief of argument", "final_written_address"],
  // Evidence / case management
  ["witness statement", "witness_statement_on_oath"],
  ["witness statement on oath", "witness_statement_on_oath"],
  ["statement on oath", "witness_statement_on_oath"],
  ["list of witnesses", "list_of_witnesses"],
  ["witness list", "list_of_witnesses"],
  ["list of documents", "list_of_documents"],
  ["document list", "list_of_documents"],
  ["pre trial information sheet", "pre_trial_information_sheet"],
  ["pretrial information sheet", "pre_trial_information_sheet"],
  ["subpoena", "subpoena"],
  ["sub poena", "subpoena"],
  ["witness summons", "subpoena"],
  ["notice to produce", "notice_to_produce"],
  ["notice to admit", "notice_to_admit"],
  // Execution
  ["garnishee", "garnishee_application"],
  ["garnishee application", "garnishee_application"],
  ["garnishee proceedings", "garnishee_application"],
  ["nisi", "garnishee_application"],
  ["fi fa", "writ_of_fi_fa"],
  ["fifa", "writ_of_fi_fa"],
  ["writ of fifa", "writ_of_fi_fa"],
  ["writ of fi fa", "writ_of_fi_fa"],
  ["judgment debtor summons", "judgment_debtor_summons"],
  ["judgement debtor summons", "judgment_debtor_summons"],
  ["jds", "judgment_debtor_summons"],
  ["stay of execution", "stay_of_execution"],
  ["terms of settlement", "terms_of_settlement"],
  ["settlement terms", "terms_of_settlement"],
  // Appellate
  ["notice of appeal", "notice_of_appeal"],
  ["noa", "notice_of_appeal"],
  ["grounds of appeal", "grounds_of_appeal"],
  ["ground of appeal", "grounds_of_appeal"],
  ["appellants brief", "appellants_brief"],
  ["appellant brief", "appellants_brief"],
  ["appellants brief of argument", "appellants_brief"],
  ["brief", "appellants_brief"], // D5: Nigerian appellate usage dominates
  ["respondents brief", "respondents_brief"],
  ["respondent brief", "respondents_brief"],
  ["reply brief", "reply_brief"],
  ["leave to appeal", "motion_for_leave_or_extension"],
  ["extension of time", "motion_for_leave_or_extension"],
  ["motion for leave", "motion_for_leave_or_extension"],
  // Statutory notices
  ["notice to quit", "notice_to_quit"],
  ["ntq", "notice_to_quit"],
  ["quit notice", "notice_to_quit"],
  ["7 day notice", "seven_days_notice_of_intention"],
  ["seven day notice", "seven_days_notice_of_intention"],
  ["seven days notice", "seven_days_notice_of_intention"],
  ["seven days notice of intention", "seven_days_notice_of_intention"],
  ["notice of intention to enforce", "seven_days_notice_of_intention"],
  ["owners intention", "seven_days_notice_of_intention"],
  ["statutory demand", "statutory_demand_notice"],
  ["statutory demand notice", "statutory_demand_notice"],
  ["pre action notice", "pre_action_notice"],
  ["preaction notice", "pre_action_notice"],
  ["breach of covenant", "notice_of_breach_of_covenant"],
  ["notice of breach", "notice_of_breach_of_covenant"],
  // Letters / instruments
  ["demand letter", "formal_demand_letter"],
  ["letter of demand", "formal_demand_letter"],
  ["pre action demand letter", "formal_demand_letter"],
  ["engagement letter", "engagement_letter"],
  ["retainer letter", "engagement_letter"],
  ["letter", "formal_demand_letter"],
  ["correspondence", "official_correspondence"],
  ["official letter", "official_correspondence"],
  ["tenancy agreement", "tenancy_or_lease_agreement"],
  ["lease agreement", "tenancy_or_lease_agreement"],
  ["tenancy", "tenancy_or_lease_agreement"],
  ["lease", "tenancy_or_lease_agreement"],
  ["deed of assignment", "deed_of_assignment"],
  ["deed", "deed_of_assignment"],
  ["power of attorney", "power_of_attorney"],
  ["poa", "power_of_attorney"],
  ["mou", "mou_or_heads_of_terms"],
  ["heads of terms", "mou_or_heads_of_terms"],
  ["memorandum of understanding", "mou_or_heads_of_terms"],
  // Forms
  ["memorandum of appearance", "memorandum_of_appearance"],
  ["conditional memorandum of appearance", "conditional_memorandum_of_appearance"],
  ["certificate of pre action counselling", "certificate_of_pre_action_counselling"],
  ["pre action counselling certificate", "certificate_of_pre_action_counselling"],
  ["undertaking as to costs", "undertaking_as_to_costs"],
];

/** Exact-match alias lookup after normalisation. */
export function resolveDocumentTypeByAlias(spoken: string): DocumentType | null {
  const n = aliasNorm(spoken);
  if (!n) return null;
  // Longest matching alias wins ("statement of defence and counterclaim"
  // before "statement of defence").
  const sorted = [...ALIAS_ENTRIES].sort((a, b) => b[0].length - a[0].length);
  for (const [alias, type] of sorted) {
    if (n === alias) return type;
  }
  // Contained forms: "draft me a motion on notice for stay" contains
  // "motion on notice".
  for (const [alias, type] of sorted) {
    if (alias.length >= 5 && n.includes(alias)) return type;
  }
  return null;
}

// ─── Bundle dependency order (spec §4.3) ────────────────────────────────────

/**
 * Filing-logic order table: lower sorts first. The spec pins two rules —
 * processes → affidavit → written address, and Notice to Quit before Seven
 * Days' Notice — and the rest follow Nigerian filing practice.
 */
export const BUNDLE_ORDER: Record<DocumentType, number> = {
  // Originating processes first
  writ_of_summons: 10,
  indorsement_of_claim: 11,
  statement_of_claim: 12,
  originating_summons: 13,
  petition: 14,
  originating_motion: 15,
  notice_to_quit: 16, // NTQ precedes the 7-day notice (spec §4.3)
  seven_days_notice_of_intention: 17,
  // Pleadings
  statement_of_defence: 20,
  statement_of_defence_and_counterclaim: 21,
  reply_to_statement_of_defence: 22,
  reply_and_defence_to_counterclaim: 23,
  // Motions and their supporting papers
  motion_on_notice: 30,
  motion_ex_parte: 31,
  notice_of_preliminary_objection: 32,
  motion_for_leave_or_extension: 33,
  stay_of_execution: 34,
  garnishee_application: 35,
  judgment_debtor_summons: 36,
  // Affidavits (after the process they support)
  supporting_affidavit: 40,
  counter_affidavit: 41,
  further_and_better_affidavit: 42,
  witness_statement_on_oath: 43,
  // Addresses / briefs (after the affidavit they argue)
  written_address: 50,
  final_written_address: 51,
  appellants_brief: 52,
  respondents_brief: 53,
  reply_brief: 54,
  grounds_of_appeal: 55,
  notice_of_appeal: 56,
  // Evidence lists
  list_of_witnesses: 60,
  list_of_documents: 61,
  notice_to_produce: 62,
  notice_to_admit: 63,
  subpoena: 64,
  pre_trial_information_sheet: 65,
  // Execution instruments
  writ_of_fi_fa: 70,
  terms_of_settlement: 71,
  // Letters / instruments
  formal_demand_letter: 80,
  statutory_demand_notice: 81,
  pre_action_notice: 82,
  notice_of_breach_of_covenant: 83,
  engagement_letter: 84,
  official_correspondence: 85,
  tenancy_or_lease_agreement: 86,
  deed_of_assignment: 87,
  power_of_attorney: 88,
  mou_or_heads_of_terms: 89,
  // Registry forms last
  memorandum_of_appearance: 90,
  conditional_memorandum_of_appearance: 91,
  certificate_of_pre_action_counselling: 92,
  undertaking_as_to_costs: 93,
};

/** Dependency-order the blueprint's documents and renumber 1-based. */
export function sortBlueprintDocuments<T extends { documentType: DocumentType }>(
  documents: T[]
): T[] {
  return [...documents].sort(
    (a, b) => (BUNDLE_ORDER[a.documentType] ?? 99) - (BUNDLE_ORDER[b.documentType] ?? 99)
  );
}
