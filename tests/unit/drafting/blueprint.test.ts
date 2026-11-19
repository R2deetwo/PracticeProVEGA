/**
 * Blueprint extraction tests — owner spec 2026-11-19, §4 "PHASE 2: Voice
 * Extraction" acceptance criteria (AC2.1–AC2.5) plus the alias map, the
 * 0.85 matter gate and the retry/fallback contract.
 */

import { describe, expect, it } from "vitest";
import {
  blueprintIsSubstantive,
  cleanDictatedItem,
  minimalBlueprint,
  resolveSelfCorrections,
  validateDraftBlueprint,
  MATTER_MATCH_AUTO_LINK_THRESHOLD,
} from "../../../src/legal/drafting/blueprint";
import { resolveDocumentTypeByAlias, sortBlueprintDocuments } from "../../../src/legal/drafting/documentTypes";
import * as fs from "fs";
import * as path from "path";

const TRANSCRIPT =
  "Please draft a motion on notice with a supporting affidavit and written address for the Chukwu matter, praying for leave to file out of time. The defendant shall pay within ten days, no, fourteen days.";

const MATCHES = [
  { matterId: "m1", confidence: 0.9, label: "Chukwu v. FBN" },
  { matterId: "m2", confidence: 0.6, label: "Chukwu Estate" },
  { matterId: "m3", confidence: 0.4, label: "Chukwu & Sons Ltd" },
];

// ─── AC2.1: self-corrections resolve to the corrected value ONLY ────────────

describe("resolveSelfCorrections (AC2.1)", () => {
  it("resolves the value-level correction fixture", () => {
    expect(resolveSelfCorrections("ten days, no, fourteen days")).toBe("fourteen days");
  });

  it("resolves stacked corrections", () => {
    expect(resolveSelfCorrections("seven days, no, ten days, no wait, fourteen days")).toBe(
      "fourteen days"
    );
  });

  it("resolves phrase retractions (scratch that)", () => {
    expect(
      resolveSelfCorrections("Tuesday at 2 PM — actually scratch that, Wednesday at 4 PM")
    ).toBe("Wednesday at 4 PM");
  });

  it("keeps the sentence lead and retracts only the trailing value", () => {
    expect(resolveSelfCorrections("The notice period is ten days, no, fourteen days")).toBe(
      "The notice period is fourteen days"
    );
  });

  it("keeps text without pivots untouched", () => {
    expect(resolveSelfCorrections("The defendant shall pay the sum claimed")).toBe(
      "The defendant shall pay the sum claimed"
    );
  });

  it("cleanDictatedItem strips known meta-speech and capitalises", () => {
    expect(cleanDictatedItem("From voice note: ten days, no, fourteen days")).toMatch(
      /^Fourteen days/
    );
  });
});

// ─── AC2.2: bundle detection + dependency ordering ──────────────────────────

describe("bundle detection and ordering (AC2.2)", () => {
  it("orders a 3-document bundle: motion → affidavit → written address", () => {
    const v = validateDraftBlueprint(
      {
        documents: ["motion_on_notice", "supporting_affidavit", "written_address"],
        reliefs: ["An order granting leave to file the defence out of time"],
        groundsOrFacts: [],
      },
      { rawTranscript: TRANSCRIPT, matches: MATCHES }
    );
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.documents.map((d) => d.documentType)).toEqual([
      "motion_on_notice",
      "supporting_affidavit",
      "written_address",
    ]);
    expect(v.value.documents.map((d) => d.order)).toEqual([1, 2, 3]);
  });

  it("accepts spoken names through the deterministic alias map", () => {
    const v = validateDraftBlueprint(
      { documents: ["motion on notice", "affidavit", "brief of argument"] },
      { rawTranscript: TRANSCRIPT, matches: MATCHES }
    );
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.documents.map((d) => d.documentType)).toEqual([
      "motion_on_notice",
      "supporting_affidavit",
      "final_written_address",
    ]);
  });

  it("orders Notice to Quit before Seven Days' Notice (spec §4.3)", () => {
    const ordered = sortBlueprintDocuments([
      { documentType: "seven_days_notice_of_intention" as const },
      { documentType: "notice_to_quit" as const },
    ]);
    expect(ordered.map((d) => d.documentType)).toEqual([
      "notice_to_quit",
      "seven_days_notice_of_intention",
    ]);
  });
});

// ─── AC2.3: the 0.85 matter gate ────────────────────────────────────────────

describe("matter gate (AC2.3)", () => {
  it("does NOT auto-link at 0.6 and returns alternatives", () => {
    const v = validateDraftBlueprint(
      { documents: ["notice_to_quit"], groundsOrFacts: ["tenant in arrears"] },
      {
        rawTranscript: TRANSCRIPT,
        matches: [
          { matterId: "m1", confidence: 0.6, label: "Chukwu Estate" },
          { matterId: "m2", confidence: 0.4, label: "Chukwu & Sons" },
        ],
      }
    );
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.matchedMatterId).toBeNull();
    expect(v.value.matchConfidence).toBe(0.6);
    expect(v.value.matchAlternatives).toHaveLength(2);
    expect(v.value.matchAlternatives[0]).toMatchObject({ matterId: "m1", score: 0.6 });
  });

  it("auto-links at ≥ 0.85 and suppresses alternatives", () => {
    const v = validateDraftBlueprint(
      { documents: ["notice_to_quit"], groundsOrFacts: ["x"] },
      { rawTranscript: TRANSCRIPT, matches: MATCHES }
    );
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.matchedMatterId).toBe("m1");
    expect(v.value.matchAlternatives).toEqual([]);
  });

  it("pins the auto-link threshold at 0.85", () => {
    expect(MATTER_MATCH_AUTO_LINK_THRESHOLD).toBe(0.85);
  });
});

// ─── AC2.4: schema validation → retry/fallback contract ─────────────────────

describe("schema validation (AC2.4)", () => {
  it("rejects a non-object payload", () => {
    expect(validateDraftBlueprint("motion", { rawTranscript: "", matches: [] }).ok).toBe(false);
  });

  it("rejects an empty blueprint (no documents, no dictated content)", () => {
    expect(
      validateDraftBlueprint({ documents: [], reliefs: [] }, { rawTranscript: "", matches: [] })
        .ok
    ).toBe(false);
  });

  it("the minimal fallback preserves the transcript and asks for clarification", () => {
    const bp = minimalBlueprint("draft me the, um, that thing for the court");
    expect(bp.documents).toEqual([]);
    expect(bp.rawTranscript).toContain("that thing");
    expect(bp.missingCriticalFields[0].key).toBe("documents.clarification");
    expect(blueprintIsSubstantive(bp)).toBe(false);
  });

  it("never guesses an unresolvable document type — it flags it", () => {
    const v = validateDraftBlueprint(
      { documents: ["the usual court paper"], reliefs: ["relief one"] },
      { rawTranscript: "", matches: [] }
    );
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.documents).toEqual([]);
    expect(
      v.value.missingCriticalFields.some((m) => m.key === "documents.clarification")
    ).toBe(true);
  });

  it("keeps partially-resolvable bundles and flags only the unmapped name", () => {
    const v = validateDraftBlueprint(
      { documents: ["motion on notice", "the usual court paper"], reliefs: ["r"] },
      { rawTranscript: "", matches: [] }
    );
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.documents).toHaveLength(1);
    expect(v.value.documents[0].documentType).toBe("motion_on_notice");
    expect(v.value.missingCriticalFields[0].label).toContain("the usual court paper");
  });
});

// ─── The alias map (spec §4.4) ──────────────────────────────────────────────

describe("deterministic alias map", () => {
  const cases: Array<[string, string]> = [
    ["7 day notice", "seven_days_notice_of_intention"],
    ["NTQ", "notice_to_quit"],
    ["quit notice", "notice_to_quit"],
    ["SOC", "statement_of_claim"],
    ["SOD", "statement_of_defence"],
    ["brief", "appellants_brief"],
    ["fifa", "writ_of_fi_fa"],
    ["ex parte", "motion_ex_parte"],
    ["exparte", "motion_ex_parte"],
    ["tenancy agreement", "tenancy_or_lease_agreement"],
    ["deed of assignment", "deed_of_assignment"],
    ["garnishee", "garnishee_application"],
  ];
  for (const [spoken, expected] of cases) {
    it(`maps "${spoken}" → ${expected}`, () => {
      expect(resolveDocumentTypeByAlias(spoken)).toBe(expected);
    });
  }

  it("maps longest alias first (defence and counterclaim beats defence)", () => {
    expect(resolveDocumentTypeByAlias("statement of defence and counterclaim")).toBe(
      "statement_of_defence_and_counterclaim"
    );
  });
});

// ─── AC2.5: missing fields are computed in CODE, never requested from the LLM

describe("missing fields are code-computed (AC2.5)", () => {
  it("the extractor prompt never asks the LLM for missing fields", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../../../convex/voiceCapture.ts"),
      "utf8"
    );
    // The extraction prompt section (rule 14 + retry prompt) must not ask
    // the model to compute missing fields — that is assemble.ts's job.
    const promptStart = source.indexOf("14. \"draftBlueprint\"");
    const promptEnd = source.indexOf("15. \"financialEntry\"");
    const rule14 = source.slice(promptStart, promptEnd);
    expect(rule14).not.toContain("missingCriticalFields");
    const retryStart = source.indexOf("BLUEPRINT_RETRY_SYSTEM_PROMPT = ");
    const retryEnd = source.indexOf(";", retryStart);
    const retryPrompt = source.slice(retryStart, retryEnd);
    expect(retryPrompt).not.toContain("missingCriticalFields");
  });

  it("blueprint validation runs the code-side cleaner on dictated items", () => {
    const v = validateDraftBlueprint(
      {
        documents: ["motion_on_notice"],
        reliefs: ["From voice note: ten days, no, fourteen days to pay"],
      },
      { rawTranscript: "", matches: [] }
    );
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.dictated.reliefs[0]).toMatch(/^Fourteen days/);
    expect(v.value.dictated.reliefs[0]).not.toContain("From voice note");
  });
});
