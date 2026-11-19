/**
 * legal/drafting/jurisdictionProfiles.ts — JurisdictionProfile configs for
 * the Voice → DraftPro pipeline (owner spec 2026-11-19, §6.1).
 *
 * These are CONFIG, not prompt text: templates read structure (headings,
 * enabling rules, notice-period tables, frontloading requirements, brief
 * headings) from here, so the LLM never decides court furniture.
 *
 * ANTI-FABRICATION CONTRACT (spec §6.1 + §0.5): every populated rule
 * reference carries `verifyBy: "counsel"` and an EMPTY `lastReviewed` —
 * the lawyer must verify each reference before filing. Lagos High Court,
 * Court of Appeal and Supreme Court ship populated; FCT / Federal High
 * Court / NICN / default ship as stubs (DEFERRED — full population
 * requires counsel-verified rule references per court).
 *
 * Pure data + pure functions; zero imports besides ./types.
 */

import type { JurisdictionProfile, RuleReference, TenancyType } from "./types";

/** Shorthand for an unverified-but-populated rule reference. */
function rule(text: string): RuleReference {
  return { text, verifyBy: "counsel", lastReviewed: "" };
}

/** A stub rule reference (court not yet populated). */
const STUB_RULE = rule("[RULE REFERENCE TO BE VERIFIED FOR THIS COURT]");

// ─── Lagos High Court (populated) ───────────────────────────────────────────

export const LAGOS_HIGH_COURT: JurisdictionProfile = {
  key: "lagos_high_court",
  label: "High Court of Lagos State",
  headingTemplates: [
    "IN THE HIGH COURT OF LAGOS STATE",
    "IN THE {{DIVISION}} JUDICIAL DIVISION",
    "HOLDEN AT {{LOCATION}}",
  ],
  motionEnablingRule: rule("Order 29 of the High Court of Lagos State (Civil Procedure) Rules 2019"),
  inherentJurisdictionClause: rule(
    "the inherent jurisdiction of this Honourable Court"
  ),
  frepRules: rule(
    "the Fundamental Rights (Enforcement Procedure) Rules 2009"
  ),
  garnisheeProvisions: rule(
    "Order 77 of the High Court of Lagos State (Civil Procedure) Rules 2019 and Section 83(1) of the Sheriff and Civil Process Act"
  ),
  noticePeriodDays: {
    fixed_term: 0, // expires by effluxion of time — no notice required
    weekly: 7,
    monthly: 30,
    quarterly: 90,
    half_yearly: 90,
    yearly: 180,
    at_will: 7,
    // unknown → placeholder (computed at hydration)
  },
  noticePeriodRule: rule(
    "Section 13 of the Tenancy Law of Lagos State 2011 and Section 7 of the Recovery of Premises Act (as applicable)"
  ),
  frontloading: {
    required: true,
    accompanyingDocuments: [
      "witness_statement_on_oath",
      "list_of_witnesses",
      "list_of_documents",
    ],
    rule: rule(
      "Order 3 Rule 2 of the High Court of Lagos State (Civil Procedure) Rules 2019 (frontloading of accompanying processes)"
    ),
  },
  addressHeadings: [
    "1.0 INTRODUCTION",
    "2.0 BRIEF STATEMENT OF FACTS",
    "3.0 ISSUE(S) FOR DETERMINATION",
    "4.0 LEGAL ARGUMENT",
    "5.0 CONCLUSION",
  ],
  briefHeadings: [
    "1.0 INTRODUCTION",
    "2.0 STATEMENT OF FACTS",
    "3.0 ISSUES FOR DETERMINATION",
    "4.0 ARGUMENT OF ISSUES",
    "5.0 CONCLUSION",
    "6.0 LIST OF AUTHORITIES",
  ],
  defaultLocation: "Ikeja",
};

// ─── Court of Appeal (populated) ────────────────────────────────────────────

export const COURT_OF_APPEAL: JurisdictionProfile = {
  key: "court_of_appeal",
  label: "Court of Appeal of Nigeria",
  headingTemplates: [
    "IN THE COURT OF APPEAL OF NIGERIA",
    "IN THE {{DIVISION}} JUDICIAL DIVISION",
    "HOLDEN AT {{LOCATION}}",
  ],
  motionEnablingRule: rule(
    "Order 6 of the Court of Appeal Rules 2021"
  ),
  inherentJurisdictionClause: rule(
    "the inherent powers of this Honourable Court"
  ),
  frepRules: null,
  garnisheeProvisions: null,
  noticePeriodDays: {},
  noticePeriodRule: null,
  frontloading: { required: false, accompanyingDocuments: [], rule: null },
  addressHeadings: [
    "1.0 INTRODUCTION",
    "2.0 BRIEF STATEMENT OF FACTS",
    "3.0 ISSUE(S) FOR DETERMINATION",
    "4.0 LEGAL ARGUMENT",
    "5.0 CONCLUSION",
  ],
  briefHeadings: [
    "1.0 INTRODUCTION",
    "2.0 STATEMENT OF FACTS",
    "3.0 ISSUES FOR DETERMINATION",
    "4.0 ARGUMENT OF ISSUES",
    "5.0 CONCLUSION",
    "6.0 LIST OF AUTHORITIES",
  ],
  defaultLocation: "Lagos",
};

// ─── Supreme Court (populated) ──────────────────────────────────────────────

export const SUPREME_COURT: JurisdictionProfile = {
  key: "supreme_court",
  label: "Supreme Court of Nigeria",
  headingTemplates: [
    "IN THE SUPREME COURT OF NIGERIA",
    "HOLDEN AT {{LOCATION}}",
  ],
  motionEnablingRule: rule("the Supreme Court Rules 2023"),
  inherentJurisdictionClause: rule(
    "the inherent powers of this Honourable Court"
  ),
  frepRules: null,
  garnisheeProvisions: null,
  noticePeriodDays: {},
  noticePeriodRule: null,
  frontloading: { required: false, accompanyingDocuments: [], rule: null },
  addressHeadings: [
    "1.0 INTRODUCTION",
    "2.0 BRIEF STATEMENT OF FACTS",
    "3.0 ISSUE(S) FOR DETERMINATION",
    "4.0 LEGAL ARGUMENT",
    "5.0 CONCLUSION",
  ],
  briefHeadings: [
    "1.0 INTRODUCTION",
    "2.0 STATEMENT OF FACTS",
    "3.0 ISSUES FOR DETERMINATION",
    "4.0 ARGUMENT OF ISSUES",
    "5.0 CONCLUSION",
    "6.0 LIST OF AUTHORITIES",
  ],
  defaultLocation: "Abuja",
};

// ─── Stubs (DEFERRED — full population needs counsel-verified rules) ────────

function stub(key: string, label: string, location: string): JurisdictionProfile {
  return {
    key,
    label,
    headingTemplates: ["IN THE {{DIVISION}}", "HOLDEN AT {{LOCATION}}"],
    motionEnablingRule: STUB_RULE,
    inherentJurisdictionClause: STUB_RULE,
    frepRules: null,
    garnisheeProvisions: null,
    noticePeriodDays: {},
    noticePeriodRule: null,
    frontloading: { required: false, accompanyingDocuments: [], rule: null },
    addressHeadings: LAGOS_HIGH_COURT.addressHeadings,
    briefHeadings: LAGOS_HIGH_COURT.briefHeadings,
    defaultLocation: location,
  };
}

export const FEDERAL_HIGH_COURT = stub("federal_high_court", "Federal High Court of Nigeria", "Lagos");
export const FCT_HIGH_COURT = stub("fct_high_court", "High Court of the Federal Capital Territory", "Abuja");
export const NICN = stub("nicn", "National Industrial Court of Nigeria", "Abuja");
export const DEFAULT_PROFILE = stub("default", "High Court", "Lagos");

// ─── Resolution ─────────────────────────────────────────────────────────────

/** Resolve the jurisdiction profile from a free-text court string. */
export function resolveJurisdictionProfile(
  court: string | null | undefined
): JurisdictionProfile {
  const c = (court || "").toLowerCase();
  if (!c) return DEFAULT_PROFILE;
  if (c.includes("supreme court")) return SUPREME_COURT;
  if (c.includes("court of appeal") || c.includes("appeal court")) return COURT_OF_APPEAL;
  if (c.includes("federal high court") || /\bfhc\b/.test(c)) return FEDERAL_HIGH_COURT;
  if (c.includes("industrial")) return NICN;
  if (c.includes("federal capital") || c.includes("fct") || c.includes("abuja")) {
    return FCT_HIGH_COURT;
  }
  if (c.includes("lagos")) return LAGOS_HIGH_COURT;
  return DEFAULT_PROFILE;
}

// ─── Notice-period computation (spec §5c — CODE, never the LLM) ────────────

/** Map a free-text tenancy description to a TenancyType. */
export function resolveTenancyType(
  spoken: string | null | undefined
): TenancyType {
  const s = (spoken || "").toLowerCase();
  if (!s) return "unknown";
  if (s.includes("fixed") || s.includes("term certain") || s.includes("lease term")) {
    return "fixed_term";
  }
  if (s.includes("week")) return "weekly";
  if (s.includes("month")) return s.includes("quarter") ? "quarterly" : "monthly";
  if (s.includes("quarter")) return "quarterly";
  if (s.includes("half") || s.includes("semi")) return "half_yearly";
  if (s.includes("year") || s.includes("annual")) return "yearly";
  if (s.includes("will") || s.includes("sufferance") || s.includes("at will")) {
    return "at_will";
  }
  return "unknown";
}

/**
 * Compute the statutory notice period (days) from the tenancy type and the
 * jurisdiction profile. Null → unknown → the template renders a placeholder
 * (never a guess; spec §5c). A FIXED-TERM tenancy needs no notice (0 days —
 * it expires by effluxion), which the statutory-notice templates state.
 */
export function computeNoticePeriodDays(
  tenancyType: TenancyType,
  profile: JurisdictionProfile
): number | null {
  if (tenancyType === "unknown") return null;
  if (tenancyType === "fixed_term") return 0;
  const days = profile.noticePeriodDays[tenancyType];
  return typeof days === "number" ? days : null;
}
