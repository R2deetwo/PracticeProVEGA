/**
 * Integration tests — owner spec 2026-11-19, §8 "PHASE 5": the full
 * transcript → blueprint → hydrate → AST → export chain with ALL LLM calls
 * MOCKED (the fills are supplied, exactly what fillProseSlots would return).
 *
 * Fixtures (spec §8):
 *   (a) single motion on notice
 *   (b) 3-document bundle (motion + affidavit + written address)
 *   (c) statutory notice with unknown tenancy type (placeholder period)
 *   (d) appellate grounds + brief
 *   (e) unlinked matter (all case fields placeholders)
 *   (f) low-confidence matter match (never auto-linked)
 * plus the AC4.4 refusal rules and the retry-prompt contract.
 */

import { describe, expect, it } from "vitest";
import { validateDraftBlueprint, minimalBlueprint } from "../../../src/legal/drafting/blueprint";
import { hydrate } from "../../../src/legal/drafting/hydrate";
import { assembleBundle, validateBundle, computeMissingFields, astPlainText, affidavitParagraphs } from "../../../src/legal/drafting/assemble";
import { astToHtml, bundleToHtml } from "../../../src/legal/drafting/astToHtml";
import { voiceEditRefusalReason } from "../../../src/legal/drafting/voiceEditGuards";
import { BLUEPRINT_RETRY_SYSTEM_PROMPT } from "../../../convex/voiceCapture";
import { TEMPLATES } from "../../../src/legal/drafting/templates/registry";
import type { DraftBlueprint } from "../../../src/legal/drafting/types";

const MATTER = {
  id: "m1",
  title: "Chukwu v. First Bank of Nigeria Ltd",
  suitNumber: "LD/1283/2024",
  court: "High Court of Lagos State",
  judicialDivision: "Ikeja",
  courtLocation: "Ikeja",
  parties: [
    { name: "John Okafor Chukwu", role: "Claimant" },
    { name: "First Bank of Nigeria Ltd", role: "Defendant" },
  ],
  attorneyNotes: [{ text: "Facility of ₦18m granted 1 March 2024; due 1 September 2024." }],
};

/** The LLM-mocked pipeline: blueprint → hydrate → assemble → validated bundle. */
function runPipeline(
  raw: unknown,
  opts: {
    matches?: Array<{ matterId: string; confidence: number; label?: string }>;
    matter?: unknown | null;
    fills?: Record<number, Record<string, string>>;
  } = {}
) {
  const validation = validateDraftBlueprint(raw, {
    rawTranscript: "raw",
    matches: opts.matches || [],
  });
  expect(validation.ok).toBe(true);
  if (!validation.ok) throw new Error("blueprint failed");
  const blueprint = validation.value;
  const ctx = hydrate({
    blueprint,
    matter: (opts.matter === undefined ? MATTER : opts.matter) as never,
    firm: { name: "Adeyemi & Co.", address: "12 Marina, Lagos" } as never,
    user: { name: "Barr. Tunde Adeyemi", barNumber: "NBA/2015/1234" } as never,
  });
  const bundle = assembleBundle({ blueprint, ctx, fills: opts.fills || {} });
  const validations = validateBundle(bundle);
  const missing = computeMissingFields(ctx, blueprint.documents.map((d) => ({ documentType: d.documentType })));
  return { blueprint, ctx, bundle, validations, missing, html: bundleToHtml(bundle) };
}

// ─── (a) single motion on notice ────────────────────────────────────────────

describe("(a) transcript → single motion on notice", () => {
  const result = runPipeline(
    {
      documents: ["motion_on_notice"],
      reliefs: ["An order granting the Claimant leave to file the Statement of Claim out of time"],
      groundsOrFacts: [
        "The Claimant's counsel fell ill during the filing window",
        "The delay is neither willful nor in bad faith",
      ],
    },
    { matches: [{ matterId: "m1", confidence: 0.92, label: MATTER.title }] }
  );

  it("auto-links the matter at 0.92 and builds a valid motion", () => {
    expect(result.blueprint.matchedMatterId).toBe("m1");
    expect(result.validations.every((v) => v.v.ok)).toBe(true);
  });

  it("the motion HTML carries the full court furniture", () => {
    expect(result.html).toContain("IN THE HIGH COURT OF LAGOS STATE");
    expect(result.html).toContain("IKEJA JUDICIAL DIVISION");
    expect(result.html).toContain("HOLDEN AT IKEJA");
    expect(result.html).toContain("SUIT NO: LD/1283/2024");
    expect(result.html).toContain("MOTION NO:");
    expect(result.html).toContain("MOTION ON NOTICE");
    expect(result.html).toContain("TAKE NOTICE");
    expect(result.html).toContain("leave to file the Statement of Claim out of time");
    expect(result.html).toContain("Such further or other order");
    // A motion carries NO jurat (that is affidavit furniture).
    expect(result.html).not.toContain("COMMISSIONER FOR OATHS");
    expect(result.html).toContain("Barr. Tunde Adeyemi");
    expect(result.html).toContain("FOR SERVICE ON:");
  });

  it("reliefs come from the DICTATED content (dictated status, not LLM prose)", () => {
    const motion = result.bundle.documents[0];
    const text = astPlainText(motion);
    expect(text).toContain("counsel fell ill");
  });
});

// ─── (b) 3-document bundle ──────────────────────────────────────────────────

describe("(b) transcript → motion + affidavit + written address bundle", () => {
  const result = runPipeline(
    {
      documents: ["motion on notice", "supporting_affidavit", "written_address"],
      reliefs: ["An order granting leave to file out of time"],
      groundsOrFacts: [
        "I am the Claimant's counsel and have conduct of this matter",
        "The Claimant was hospitalised from 1 to 20 August 2024",
        "The draft Statement of Claim is exhibited as Exhibit A",
      ],
      namedPeople: [{ name: "Barr. Tunde Adeyemi", role: "deponent" }],
    },
    {
      matches: [{ matterId: "m1", confidence: 0.92, label: MATTER.title }],
      fills: {
        2: {
          "written_address.introduction":
            "This address is filed in support of the Applicant's motion on notice dated the same date herewith, seeking leave to file the Statement of Claim out of time.",
          "written_address.facts":
            "The deponent, counsel to the Applicant, was hospitalised during the filing window as pleaded in the supporting affidavit at paragraphs 2 and 3.",
          "written_address.issues": "ISSUE: Whether the delay in filing was due to sufficient cause.",
          "written_address.argument":
            "ISSUE ONE: The discretion to extend time is exercised judicially where the delay is explained and no prejudice ensues. This is a settled principle.",
          "written_address.conclusion":
            "We respectfully urge the court to grant the reliefs sought.",
        },
      },
    }
  );

  it("renders three documents in dependency order", () => {
    expect(result.bundle.documents.map((d) => d.documentType)).toEqual([
      "motion_on_notice",
      "supporting_affidavit",
      "written_address",
    ]);
  });

  it("all three documents pass structural validation", () => {
    expect(result.validations.every((v) => v.v.ok)).toBe(true);
  });

  it("exhibit letters are shared across the bundle (AC3.6)", () => {
    expect(result.ctx.exhibits).toContain("A");
    const affidavitText = astPlainText(result.bundle.documents[1]);
    expect(affidavitText).toContain("EXHIBIT A");
  });

  it("the affidavit's numbered paragraphs feed the address (sibling consistency)", () => {
    const paras = affidavitParagraphs(result.bundle);
    expect(paras.length).toBeGreaterThanOrEqual(3);
    expect(paras.some((p) => /hospitalised/i.test(p))).toBe(true);
    const addressText = astPlainText(result.bundle.documents[2]);
    expect(addressText).toContain("2.0 BRIEF STATEMENT OF FACTS");
    expect(addressText).toContain("4.0 LEGAL ARGUMENT");
  });

  it("the bundle HTML separates documents with page breaks", () => {
    expect(result.html).toContain('class="page-break"');
    expect(result.html).toMatch(/page-break[\s\S]*page-break/);
  });
});

// ─── (c) statutory notice with unknown tenancy type ────────────────────────

describe("(c) transcript → statutory notice, unknown tenancy type", () => {
  const result = runPipeline(
    {
      documents: ["notice_to_quit"],
      groundsOrFacts: ["The tenant is in arrears of rent"],
      namedPeople: [{ name: "Mrs. Ede", role: "tenant" }],
    },
    { matter: null }
  );

  it("builds a valid notice with a PLACEHOLDER notice period (never a guess)", () => {
    expect(result.validations[0].v.ok).toBe(true);
    const text = astPlainText(result.bundle.documents[0]);
    expect(text).toContain("NOTICE TO QUIT");
    expect(text).toContain("[[STATUTORY NOTICE PERIOD]]");
    expect(text).toContain("[[PREMISES]]");
  });

  it("a letter format NEVER carries a court caption (document-type honesty)", () => {
    expect(result.html).not.toContain("IN THE HIGH COURT");
    expect(result.html).not.toContain("SUIT NO");
  });
});

// ─── (d) appellate grounds + brief ─────────────────────────────────────────

describe("(d) transcript → appellate grounds + brief", () => {
  const result = runPipeline(
    {
      documents: ["grounds_of_appeal", "appellants_brief"],
      groundsOrFacts: ["The trial judge failed to evaluate the documentary evidence"],
      reliefs: [],
    },
    { matches: [{ matterId: "m1", confidence: 0.9, label: MATTER.title }] }
  );

  it("renders the appellate caption and APPEAL NO", () => {
    expect(result.html).toContain("IN THE COURT OF APPEAL OF NIGERIA");
    expect(result.html).toContain("APPEAL NO:");
  });

  it("the parties render with appellate capacities", () => {
    const grounds = result.bundle.documents.find((d) => d.documentType === "grounds_of_appeal")!;
    const text = astPlainText(grounds);
    expect(text).toContain("APPELLANT");
    expect(text).toContain("RESPONDENT");
  });

  it("the brief uses the profile's brief headings incl. LIST OF AUTHORITIES", () => {
    const brief = result.bundle.documents.find((d) => d.documentType === "appellants_brief")!;
    const briefText = astPlainText(brief);
    expect(briefText).toContain("1.0 INTRODUCTION");
    expect(briefText).toContain("4.0 ARGUMENT OF ISSUES");
    expect(briefText).toContain("6.0 LIST OF AUTHORITIES");
  });
});

// ─── (e) unlinked matter: all case fields placeholders ──────────────────────

describe("(e) transcript with NO linked matter", () => {
  const result = runPipeline(
    { documents: ["statement_of_claim"], groundsOrFacts: ["The defendant owes the claimant ₦5,000,000"] },
    { matter: null, matches: [] }
  );

  it("every case field renders as a placeholder pill, never literal underscores", () => {
    const text = astPlainText(result.bundle.documents[0]);
    expect(text).toContain("[[SUIT NO]]");
    expect(text).toContain("[[CLAIMANT NAME]]");
    expect(text).not.toMatch(/SUIT NO: _+/);
    const missing = result.missing.map((m) => m.key);
    expect(missing).toContain("matter.caseNumber");
    expect(missing).toContain("matter.parties");
  });

  it("generation did not block on the missing fields (spec §5d)", () => {
    expect(result.bundle.documents[0].blocks.length).toBeGreaterThan(8);
    expect(result.html.length).toBeGreaterThan(500);
  });
});

// ─── (f) low-confidence match: never auto-linked ────────────────────────────

describe("(f) low-confidence matter match", () => {
  const result = runPipeline(
    { documents: ["formal_demand_letter"], groundsOrFacts: ["unpaid consultancy fees"] },
    {
      matches: [
        { matterId: "m9", confidence: 0.62, label: "Chukwu Estate" },
        { matterId: "m8", confidence: 0.4, label: "Chukwu & Sons" },
      ],
      matter: null,
    }
  );

  it("the blueprint is NOT auto-linked and carries alternatives", () => {
    expect(result.blueprint.matchedMatterId).toBeNull();
    expect(result.blueprint.matchAlternatives.length).toBe(2);
  });

  it("the letter still builds (letterhead, subject, signature — no court caption)", () => {
    expect(result.validations[0].v.ok).toBe(true);
    const text = astPlainText(result.bundle.documents[0]);
    expect(text).toContain("RE: FORMAL DEMAND");
    expect(result.html).not.toContain("IN THE HIGH COURT");
  });
});

// ─── AC4.4: voice-edit refusal rules ────────────────────────────────────────

describe("AC4.4 — voice edits targeting the suit number are refused", () => {
  it("refuses a selection that IS the suit number", () => {
    const reason = voiceEditRefusalReason({
      selectedText: "SUIT NO: LD/1283/2024",
      instruction: "make this clearer",
      alignments: [],
    });
    expect(reason).toContain("court record data");
  });

  it("refuses an instruction that targets the suit number", () => {
    const reason = voiceEditRefusalReason({
      selectedText: "1. The Claimant granted the Defendant a facility.",
      instruction: "also change the suit number to LD/9999/2024",
      alignments: [],
    });
    expect(reason).toContain("cannot change the suit/case number");
  });

  it("refuses selections inside structural (aligned) blocks", () => {
    const reason = voiceEditRefusalReason({
      selectedText: "IN THE HIGH COURT OF LAGOS STATE",
      instruction: "tighten this",
      alignments: ["center"],
    });
    expect(reason).toContain("fixed structure");
  });

  it("allows ordinary prose edits", () => {
    expect(
      voiceEditRefusalReason({
        selectedText: "The Claimant granted the Defendant a facility of ₦18,000,000.00.",
        instruction: "tighten this",
        alignments: [undefined],
      })
    ).toBeNull();
  });
});

// ─── The retry prompt contract (AC2.4 companion) ────────────────────────────

describe("the focused blueprint retry prompt", () => {
  it("is exported from the backend and pins the strict-JSON shape", () => {
    expect(BLUEPRINT_RETRY_SYSTEM_PROMPT).toContain('"documents"');
    expect(BLUEPRINT_RETRY_SYSTEM_PROMPT).toContain('"reliefs"');
    expect(BLUEPRINT_RETRY_SYSTEM_PROMPT).toContain("STRICT JSON");
    expect(BLUEPRINT_RETRY_SYSTEM_PROMPT).toContain("never invent");
  });

  it("the minimal fallback is importable and audit-safe", () => {
    const bp = minimalBlueprint("the raw dictated note text");
    expect(bp.rawTranscript).toBe("the raw dictated note text");
    expect(bp.documents).toEqual([]);
  });
});
