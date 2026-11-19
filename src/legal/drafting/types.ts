/**
 * legal/drafting/types.ts — the contract layer of the Voice → DraftPro
 * Litigation Drafting Pipeline (owner spec, 2026-11-19:
 * "VEGA: Quick Capture -> DraftPro Litigation Drafting Pipeline").
 *
 * ARCHITECTURE (spec §1): structure is deterministic code; the LLM only
 * fills bounded prose slots.
 *
 *   Voice -> DraftBlueprint (LLM, schema-constrained)
 *         -> HydratedDraftContext (DB merge, no LLM)
 *         -> DocumentAST (deterministic template + LLM fills ONLY typed
 *            prose slots)
 *         -> Editor (render AST) -> .docx / .pdf (render same AST)
 *
 * This module is PURE TYPES ONLY — zero runtime imports — so it is safe to
 * import from the client bundle, the Convex function bundle and unit tests
 * alike (same convention as src/services/voice/draftUtils.ts).
 */

// ─── Single source of truth for the document taxonomy ──────────────────────
// DocumentType is defined exactly once in documentTypes.ts (the const array
// DOCUMENT_TYPES) and re-exported here so every consumer can import it from
// either module. Never widen it at a call site.
import type { DocumentType } from "./documentTypes";

export type { DocumentType } from "./documentTypes";

/** The seven families a court/instrument document belongs to (spec §3). */
export type DocumentCategory =
  | "litigation_process"
  | "appellate_process"
  | "execution_and_enforcement"
  | "statutory_notice"
  | "formal_letter"
  | "commercial_or_property_instrument"
  | "standard_form";

/** Where a hydrated value came from — drives confidence chips and the
 *  "Save to matter/firm profile" offer in the editor (spec §7.3). */
export type ConfidenceSource = "voice" | "matter" | "firm" | "default" | "missing" | "manual";

/** A value plus its provenance. `null` value = not available. */
export interface FieldValue<T> {
  value: T | null;
  source: ConfidenceSource;
}

// ─── Party model ────────────────────────────────────────────────────────────

/** Capacity labels used across processes (spec §3 PartyCapacity). */
export type PartyCapacity =
  | "claimant"
  | "defendant"
  | "applicant"
  | "respondent"
  | "appellant"
  | "petitioner"
  | "judgment_creditor"
  | "judgment_debtor"
  | "garnishee"
  | "landlord"
  | "tenant"
  | "grantor"
  | "grantee"
  | "other";

/** One rendered party line in a parties block. */
export interface PartyLine {
  name: string;
  /** Rendered capacity label, e.g. "CLAIMANT" or "1ST DEFENDANT". */
  capacity: string;
  /** 1-based ordinal within the capacity group, or null when sole. */
  ordinal: number | null;
}

// ─── Stage 1: the DraftBlueprint (what voice extraction produces) ──────────

/** What the lawyer actually dictated — cleaned, never legalese-rewritten
 *  (that happens at assembly; spec §4.2). */
export interface DictatedContent {
  /** Each a discrete prayer, cleaned. */
  reliefs: string[];
  /** Discrete facts or grounds, in order spoken. */
  groundsOrFacts: string[];
  amounts: Array<{
    label: string;
    amount: number;
    currency: "NGN" | "USD" | "GBP" | "EUR";
  }>;
  periods: Array<{
    label: string;
    value: number;
    unit: "days" | "weeks" | "months" | "years";
  }>;
  dates: Array<{ label: string; iso: string }>;
  /** Deponent, witness, etc. */
  namedPeople: Array<{ name: string; role: string }>;
  specialInstructions: string[];
}

/** A required field the pipeline could not source (computed in CODE after
 *  hydration — never by the LLM; spec §4.6). */
export interface MissingField {
  /** Stable id, e.g. "deponent.fullName". */
  key: string;
  /** Human label, e.g. "Deponent Name". */
  label: string;
  /** Which document in the bundle needs it (0-based). */
  documentIndex: number;
}

/** The schema-constrained product of voice extraction (spec §3). */
export interface DraftBlueprint {
  documents: Array<{
    documentCategory: DocumentCategory;
    documentType: DocumentType;
    /** Position in a bundle, 1-based (dependency order applied in code). */
    order: number;
  }>;
  matchedMatterId: string | null;
  /** 0..1 from the fuzzy matcher. */
  matchConfidence: number;
  /** Top 3 alternatives shown when confidence < 0.85. */
  matchAlternatives: Array<{ matterId: string; label: string; score: number }>;
  dictated: DictatedContent;
  missingCriticalFields: MissingField[];
  /** Retained for audit; never shown in the document. */
  rawTranscript: string;
}

// ─── Stage 2: hydration (DB merge, no LLM) ─────────────────────────────────

/** A matter as the hydrator sees it — every value carries provenance. */
export interface HydratedMatter {
  id: string;
  court: FieldValue<{ courtName: string; division: string; location: string }>;
  caseNumber: FieldValue<{ kind: "suit" | "appeal" | "motion"; number: string }>;
  parties: Array<{ name: string; capacity: PartyCapacity; ordinal?: number }>;
  caseNotes: string[];
  endorsements: string[];
}

export interface HydratedFirm {
  counselName: FieldValue<string>;
  enrollmentNumber: FieldValue<string>;
  firmName: FieldValue<string>;
  firmAddress: FieldValue<string>;
  firmEmail: FieldValue<string>;
  firmPhone: FieldValue<string>;
}

/** Everything the templates build from (spec §5a). */
export interface HydratedDraftContext {
  matter: HydratedMatter | null;
  firm: HydratedFirm;
  /** See jurisdictionProfiles.ts — config, never prompt text (spec §6.1). */
  jurisdiction: JurisdictionProfile;
  dictated: DictatedContent;
  /** The stored party list AS STORED (role strings) — templates re-render
   *  capacities per process kind (CLAIMANT/DEFENDANT in a pleading,
   *  APPLICANT/RESPONDENT in a motion …; AC3.4). */
  rawParties: Array<{ name: string; role?: string; capacity?: string; isRepresentative?: boolean }>;
  /** Resolved notice period (days) computed in code from the tenancy type
   *  and the jurisdiction profile — the LLM never sets this (spec §5c). */
  noticePeriodDays: number | null;
  /** True when the dictated period conflicts with the statutory minimum —
   *  the editor shows a warning chip, never a silent override. */
  noticePeriodConflict: boolean;
  /** Auto-numbered exhibits across the whole bundle (A, B, C …). */
  exhibits: string[];
}

// ─── Jurisdiction profiles (spec §6.1) ─────────────────────────────────────

/** A rule/section reference the pipeline prints or relies on. Every
 *  populated reference MUST carry verifyBy: "counsel" and an empty
 *  lastReviewed for the lawyer to fill after checking. */
export interface RuleReference {
  /** The reference as printed/used, e.g. "Order 29 of the High Court of
   *  Lagos State (Civil Procedure) Rules 2019". */
  text: string;
  verifyBy: "counsel";
  /** ISO date the lawyer last verified this reference; "" until then. */
  lastReviewed: string;
}

/** Tenancy types the notice-period table is keyed by. */
export type TenancyType =
  | "fixed_term"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "half_yearly"
  | "yearly"
  | "at_will"
  | "unknown";

/** Pure config per court system (Lagos HC, Court of Appeal, Supreme Court
 *  populated; others stubs — see DEFERRED in the phase report). */
export interface JurisdictionProfile {
  key: string;
  label: string;
  /** Centered caption lines; {{DIVISION}} and {{LOCATION}} are replaced
   *  from the matter at build time. */
  headingTemplates: string[];
  /** Enabling rule cited by motions ("...brought pursuant to..."). */
  motionEnablingRule: RuleReference;
  /** Inherent-jurisdiction fallback clause for motions. */
  inherentJurisdictionClause: RuleReference;
  /** Fundamental-rights (FREP) procedure reference, when applicable. */
  frepRules: RuleReference | null;
  /** Garnishee proceedings reference, when applicable. */
  garnisheeProvisions: RuleReference | null;
  /** Statutory notice periods by tenancy type (days; null = placeholder). */
  noticePeriodDays: Partial<Record<TenancyType, number>>;
  /** The authority behind the notice-period table. */
  noticePeriodRule: RuleReference | null;
  /** Frontloading requirements for originating processes. */
  frontloading: {
    required: boolean;
    accompanyingDocuments: DocumentType[];
    rule: RuleReference | null;
  };
  /** Written address section headings (trial). */
  addressHeadings: string[];
  /** Appellate brief section headings. */
  briefHeadings: string[];
  /** Registry location default (HOLDEN AT) when the matter has none. */
  defaultLocation: string;
}

// ─── The DocumentAST — the only thing templates produce ────────────────────

/** Provenance-tagged text cells. `prose` is the ONLY LLM-written content
 *  (spec §3 Slot contract). */
export type Slot =
  | { kind: "literal"; text: string }
  | { kind: "hydrated"; key: string; text: string; source: ConfidenceSource }
  | { kind: "prose"; key: string; text: string; status: "generated" | "dictated" }
  | { kind: "placeholder"; key: string; label: string };

/** Structural building blocks (spec §3 Block union, verbatim). */
export type Block =
  | { t: "courtHeading"; lines: string[] } // centered, bold, caps
  | { t: "caseNumber"; label: string; value: Slot } // right-aligned
  | { t: "partiesBlock"; parties: PartyLine[]; connectors: "BETWEEN" | "AND" }
  | { t: "processTitle"; text: string } // centered, bold, caps, underlined
  | { t: "clause"; text: Slot } // unnumbered operative clause
  | { t: "numbered"; items: Slot[]; style: "arabic" | "roman" | "alpha" }
  | { t: "section"; number: string; heading: string; children: Block[] } // e.g. "1.0 INTRODUCTION"
  | { t: "dateLine"; value: Slot }
  | { t: "frankingBlock"; counsel: Slot; firm: Slot; address: Slot; email: Slot; phone: Slot }
  | { t: "serviceBlock"; recipients: Slot[] } // FOR SERVICE ON:
  | { t: "jurat"; place: Slot; commissioner: true }
  | { t: "signature"; label: string; name: Slot }
  | { t: "letterhead"; firm: Slot }
  | { t: "recipient"; lines: Slot[] }
  | { t: "subjectLine"; text: Slot } // bold underlined RE:
  | { t: "pageBreak" };

export interface DocumentAST {
  id: string;
  documentType: DocumentType;
  blocks: Block[];
}

export interface DraftBundle {
  bundleId: string;
  documents: DocumentAST[];
}

// ─── Template registry contract (spec §5b) ─────────────────────────────────

/** A required (non-prose) field a template cannot render without; the
 *  hydrator diffs these against what voice + matter + firm supplied. */
export interface FieldSpec {
  /** Stable id, e.g. "matter.caseNumber", "deponent.fullName". */
  key: string;
  /** Human label for the placeholder pill + missing-field list. */
  label: string;
}

/** A bounded prose slot the LLM is allowed to write (the ONLY LLM-authored
 *  content in any document). */
export interface ProseSlotSpec {
  /** Stable id, e.g. "statementOfClaim.materialFacts". */
  key: string;
  label: string;
  /** The prompt contract: what this slot must contain. */
  contract: string;
  /** Hard char cap enforced after generation. */
  maxLength: number;
  /** Expected shape — validators check it. */
  shape: "paragraphs" | "numbered" | "bullets";
  /** Affidavit slots: reject argument, opinion or legal conclusions
   *  (Evidence Act affidavit requirements; spec §5c). */
  factsOnly?: boolean;
}

/** One template per DocumentType. `build` is deterministic code. */
export interface DocumentTemplate {
  documentType: DocumentType;
  category: DocumentCategory;
  requiredFields: FieldSpec[];
  proseSlots: ProseSlotSpec[];
  /** Renders prose slots as `prose` Slots when a fill exists, placeholder
   *  pills when it does not (generation never blocks on missing fields). */
  build: (ctx: HydratedDraftContext, fills: Record<string, string>) => DocumentAST;
}
