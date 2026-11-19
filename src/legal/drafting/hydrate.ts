/**
 * legal/drafting/hydrate.ts — Stage 2 of the Voice → DraftPro pipeline:
 * the Hydrator (owner spec 2026-11-19, §5a "PHASE 3: Hydrator + Template
 * Registry + Assembly"). Pure DB merge, NO LLM.
 *
 *   hydrate(blueprint, records) -> HydratedDraftContext
 *
 * Every value carries its ConfidenceSource. An unfiled matter renders as
 * `[SUIT NO: …]` placeholder slots downstream — never literal underscores.
 *
 * PARTY CAPACITY MAPPING (spec §5a + AC3.4) is a pure function: the same
 * matter's parties render as CLAIMANT/DEFENDANT in a Statement of Claim,
 * APPLICANT/RESPONDENT in a motion, APPELLANT/RESPONDENT on appeal (with
 * ordinals: 1ST DEFENDANT / 1ST RESPONDENT …), and
 * JUDGMENT CREDITOR/JUDGMENT DEBTOR in enforcement processes.
 *
 * Zero imports besides ./types + ./jurisdictionProfiles — shared by the
 * client bundle and unit tests.
 */

import type {
  ConfidenceSource,
  DictatedContent,
  DraftBlueprint,
  FieldValue,
  HydratedDraftContext,
  HydratedFirm,
  HydratedMatter,
  PartyCapacity,
  PartyLine,
  TenancyType,
} from "./types";
import {
  computeNoticePeriodDays,
  COURT_OF_APPEAL,
  resolveJurisdictionProfile,
  resolveTenancyType,
} from "./jurisdictionProfiles";

// ─── Structural inputs (the client records; kept structural so the module
//     stays testable without importing app state) ────────────────────────────

export interface MatterLike {
  id: string;
  title?: string | null;
  suitNumber?: string | null;
  court?: string | null;
  judicialDivision?: string | null;
  /** Free-text location of the registry (HOLDEN AT) — often absent. */
  courtLocation?: string | null;
  parties?: Array<{
    name: string;
    role?: string;
    capacity?: string;
    isRepresentative?: boolean;
  }> | null;
  originatingProcess?: string | null;
  attorneyNotes?: Array<{ text?: string; summary?: string; transcription?: string } | string> | null;
}

export interface FirmLike {
  name?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface UserLike {
  name?: string | null;
  barNumber?: string | null;
}

export interface PropertyLike {
  rentalDetails?: {
    tenancyPeriod?: string | null;
    rentFrequency?: string | null;
    leaseStart?: string | null;
    leaseEnd?: string | null;
  } | null;
}

export interface HydrateInputs {
  blueprint: DraftBlueprint;
  matter?: MatterLike | null;
  firm?: FirmLike | null;
  user?: UserLike | null;
  property?: PropertyLike | null;
  /** Structured case notes / endorsements the caller wants in context. */
  caseNotes?: string[];
  endorsements?: string[];
}

// ─── Party capacity mapping (AC3.4) ─────────────────────────────────────────

export type ProcessKind = "claim" | "motion" | "appeal" | "enforcement" | "tenancy";

/** Which SIDE of a dispute a stored role string belongs to. */
function sideOf(role: string | undefined | null): "claimant" | "defendant" | "landlord" | "tenant" | "neutral" {
  const r = (role || "").toLowerCase();
  if (r.includes("claimant") || r.includes("applicant") || r.includes("petitioner") || r.includes("appellant")) {
    return "claimant";
  }
  if (r.includes("defendant") || r.includes("respondent") || r.includes("garnishee")) return "defendant";
  if (r.includes("landlord") || r.includes("lessor") || r.includes("owner")) return "landlord";
  if (r.includes("tenant") || r.includes("lessee")) return "tenant";
  if (r.includes("client")) return "claimant"; // voice-created matters
  if (r.includes("opposing")) return "defendant";
  return "neutral";
}

/** The capacity a side renders as, per process kind (AC3.4). */
const CAPACITY_BY_PROCESS: Record<ProcessKind, Record<string, PartyCapacity>> = {
  claim: { claimant: "claimant", defendant: "defendant", landlord: "claimant", tenant: "defendant", neutral: "other" },
  motion: { claimant: "applicant", defendant: "respondent", landlord: "applicant", tenant: "respondent", neutral: "other" },
  appeal: { claimant: "appellant", defendant: "respondent", landlord: "appellant", tenant: "respondent", neutral: "other" },
  enforcement: {
    claimant: "judgment_creditor",
    defendant: "judgment_debtor",
    landlord: "judgment_creditor",
    tenant: "judgment_debtor",
    neutral: "other",
  },
  tenancy: { landlord: "landlord", tenant: "tenant", claimant: "landlord", defendant: "tenant", neutral: "other" },
};

/** Rendered capacity label per PartyCapacity. */
const CAPACITY_LABELS: Record<PartyCapacity, string> = {
  claimant: "CLAIMANT",
  defendant: "DEFENDANT",
  applicant: "APPLICANT",
  respondent: "RESPONDENT",
  appellant: "APPELLANT",
  petitioner: "PETITIONER",
  judgment_creditor: "JUDGMENT CREDITOR",
  judgment_debtor: "JUDGMENT DEBTOR",
  garnishee: "GARNISHEE",
  landlord: "LANDLORD",
  tenant: "TENANT",
  grantor: "GRANTOR",
  grantee: "GRANTEE",
  other: "PARTY",
};

/** 1 → 1ST, 2 → 2ND, 3 → 3RD, 4 → 4TH … */
export function ordinalLabel(n: number): string {
  const s = ["TH", "ST", "ND", "RD"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/**
 * Map stored parties to capacities for a given process kind, assigning
 * ordinals within each capacity group in stored order. Pure (AC3.4).
 */
export function mapPartyCapacities(
  parties: NonNullable<MatterLike["parties"]>,
  processKind: ProcessKind
): Array<{ name: string; capacity: PartyCapacity; ordinal: number }> {
  const table = CAPACITY_BY_PROCESS[processKind];
  const counts = new Map<PartyCapacity, number>();
  return (parties || [])
    .filter((p) => (p?.name || "").trim().length > 0)
    .map((p) => {
      const capacity = table[sideOf(p.role)] ?? "other";
      const n = (counts.get(capacity) || 0) + 1;
      counts.set(capacity, n);
      return { name: p.name.trim(), capacity, ordinal: n };
    });
}

/** Render party LINES ("… 1ST DEFENDANT") for a parties block. Sole parties
 *  in a group carry no ordinal. */
export function renderPartyLines(
  parties: NonNullable<MatterLike["parties"]>,
  processKind: ProcessKind
): PartyLine[] {
  const mapped = mapPartyCapacities(parties, processKind);
  const groupSizes = new Map<PartyCapacity, number>();
  for (const m of mapped) groupSizes.set(m.capacity, (groupSizes.get(m.capacity) || 0) + 1);
  return mapped.map((m) => ({
    name: m.name,
    capacity:
      (groupSizes.get(m.capacity) || 0) > 1
        ? `${ordinalLabel(m.ordinal)} ${CAPACITY_LABELS[m.capacity]}`
        : CAPACITY_LABELS[m.capacity],
    ordinal: (groupSizes.get(m.capacity) || 0) > 1 ? m.ordinal : null,
  }));
}

// ─── Exhibits (auto-numbered A, B, C in order of reference; AC3.6) ─────────

/** Collect exhibit references from dictated content, in spoken order. */
export function collectExhibits(dictated: DictatedContent): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const texts = [
    ...dictated.groundsOrFacts,
    ...dictated.reliefs,
    ...dictated.specialInstructions,
  ];
  for (const t of texts) {
    // Named: "Exhibit B", "exhibit 'C'", "Exhibit CB1".
    const named = t.match(/\bexhibit\s+'?"?([A-Z](?:[A-Z0-9]{0,3}))'?"?\b/gi) || [];
    for (const m of named) {
      const letter = (m.replace(/\bexhibit\s+'?"?/i, "").replace(/'?"$/, "") || "").toUpperCase();
      if (letter && !seen.has(letter)) {
        seen.add(letter);
        out.push(letter);
      }
    }
  }
  // Anonymous mentions ("the agreement as Exhibit") get sequential letters.
  let next = 0;
  for (const t of texts) {
    const anon = /\bexhibits?\b(?!\s+'?"?[A-Z]\b)/i;
    if (anon.test(t)) {
      // Find the next unused letter.
      while (out.includes(letterForIndex(next)) && next < 26) next++;
      if (next < 26) {
        out.push(letterForIndex(next));
        next++;
      }
    }
  }
  return out.slice(0, 12);
}

function letterForIndex(i: number): string {
  return String.fromCharCode(65 + (i % 26));
}

// ─── The Hydrator ───────────────────────────────────────────────────────────

function fieldValue<T>(value: T | null | undefined, source: ConfidenceSource): FieldValue<T> {
  return value === null || value === undefined || value === "" ? { value: null, source: "missing" } : { value, source };
}

/** Normalise attorney notes entries to plain strings (last 8). */
function notesToTexts(notes: MatterLike["attorneyNotes"]): string[] {
  return (notes || [])
    .map((n) =>
      typeof n === "string" ? n : n.text || n.summary || n.transcription || ""
    )
    .filter((s) => (s || "").trim().length > 0)
    .slice(-8);
}

export function hydrate(inputs: HydrateInputs): HydratedDraftContext {
  const { blueprint } = inputs;
  const matter = inputs.matter || null;
  const firm = inputs.firm || null;
  const user = inputs.user || null;

  const isAppellate = blueprint.documents.some((d) =>
    ["notice_of_appeal", "grounds_of_appeal", "appellants_brief", "respondents_brief", "reply_brief"].includes(
      d.documentType
    )
  );
  const isEnforcement = blueprint.documents.some((d) =>
    ["garnishee_application", "writ_of_fi_fa", "judgment_debtor_summons"].includes(d.documentType)
  );
  const isTenancy = blueprint.documents.some((d) =>
    ["notice_to_quit", "seven_days_notice_of_intention", "notice_of_breach_of_covenant", "tenancy_or_lease_agreement"].includes(
      d.documentType
    )
  );
  // Appellate bundles head at the appellate registry even when the linked
  // matter's stored court is the trial court.
  const jurisdiction = isAppellate
    ? COURT_OF_APPEAL
    : resolveJurisdictionProfile(matter?.court);

  const caseKind: "suit" | "appeal" | "motion" = isAppellate ? "appeal" : "motion";

  const hydratedMatter: HydratedMatter | null = matter
    ? {
        id: matter.id,
        court: {
          value: matter.court
            ? {
                courtName: matter.court,
                division: matter.judicialDivision || "",
                location: matter.courtLocation || "",
              }
            : null,
          source: matter.court ? "matter" : "missing",
        },
        caseNumber: {
          value: matter.suitNumber ? { kind: caseKind, number: matter.suitNumber } : null,
          source: matter.suitNumber ? "matter" : "missing",
        },
        parties: mapPartyCapacities(
          matter.parties || [],
          isAppellate ? "appeal" : isEnforcement ? "enforcement" : isTenancy ? "tenancy" : "claim"
        ),
        caseNotes: [...(inputs.caseNotes || []), ...notesToTexts(matter.attorneyNotes)].slice(-12),
        endorsements: (inputs.endorsements || []).slice(-8),
      }
    : null;

  const hydratedFirm: HydratedFirm = {
    counselName: fieldValue(user?.name || null, user?.name ? "firm" : "missing"),
    enrollmentNumber: fieldValue(
      user?.barNumber && user.barNumber !== "N/A" ? user.barNumber : null,
      user?.barNumber && user.barNumber !== "N/A" ? "firm" : "missing"
    ),
    firmName: fieldValue(firm?.name || null, firm?.name ? "firm" : "missing"),
    firmAddress: fieldValue(firm?.address || null, firm?.address ? "firm" : "missing"),
    firmEmail: fieldValue(firm?.email || null, firm?.email ? "firm" : "missing"),
    firmPhone: fieldValue(firm?.phone || null, firm?.phone ? "firm" : "missing"),
  };

  // Notice period: CODE from tenancy type + profile — never the LLM (AC3.5).
  const tenancyType: TenancyType = resolveTenancyType(
    inputs.property?.rentalDetails?.tenancyPeriod ||
      inputs.property?.rentalDetails?.rentFrequency ||
      null
  );
  const noticePeriodDays = isTenancy ? computeNoticePeriodDays(tenancyType, jurisdiction) : null;
  // Conflict check: a dictated period below the statutory minimum warns —
  // never silently overrides (spec §5c).
  let noticePeriodConflict = false;
  if (noticePeriodDays !== null && noticePeriodDays > 0) {
    for (const p of blueprint.dictated.periods) {
      const dictatedDays =
        p.unit === "days" ? p.value : p.unit === "weeks" ? p.value * 7 : p.unit === "months" ? p.value * 30 : p.value * 365;
      if (dictatedDays < noticePeriodDays) {
        noticePeriodConflict = true;
        break;
      }
    }
  }

  return {
    matter: hydratedMatter,
    firm: hydratedFirm,
    jurisdiction,
    dictated: blueprint.dictated,
    rawParties: (matter?.parties || [])
      .filter((p) => (p?.name || "").trim().length > 0)
      .map((p) => ({
        name: p.name.trim(),
        role: p.role,
        capacity: p.capacity,
        isRepresentative: p.isRepresentative,
      })),
    noticePeriodDays,
    noticePeriodConflict,
    exhibits: collectExhibits(blueprint.dictated),
  };
}
