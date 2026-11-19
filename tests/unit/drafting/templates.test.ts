/**
 * Template registry + hydrator tests — owner spec 2026-11-19, §5 "PHASE 3"
 * acceptance criteria: AC3.1 (every DocumentType builds from a full fixture
 * context), AC3.2 (structural validators pass for every template),
 * AC3.3 (affidavit prose rejects argument), AC3.4 (party capacity mapping
 * with ordinals), AC3.5 (notice periods computed in code, not by the LLM),
 * AC3.6 (bundle exhibit sharing), AC3.7 (no hard-coded year).
 */

import { describe, expect, it } from "vitest";
import { TEMPLATES } from "../../../src/legal/drafting/templates/registry";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from "../../../src/legal/drafting/documentTypes";
import { hydrate, mapPartyCapacities, renderPartyLines, collectExhibits } from "../../../src/legal/drafting/hydrate";
import {
  assembleBundle,
  computeMissingFields,
  validateAST,
  validateBundle,
  validateProseFill,
  affidavitParagraphs,
  findPlaceholders,
  fillSlot,
  insertNumberedItem,
  astPlainText,
} from "../../../src/legal/drafting/assemble";
import { astToHtml, bundleToHtml } from "../../../src/legal/drafting/astToHtml";
import { LAGOS_HIGH_COURT, COURT_OF_APPEAL, computeNoticePeriodDays, resolveTenancyType } from "../../../src/legal/drafting/jurisdictionProfiles";
import { minimalBlueprint, validateDraftBlueprint } from "../../../src/legal/drafting/blueprint";
import type { DraftBlueprint, HydratedDraftContext } from "../../../src/legal/drafting/types";
import * as fs from "fs";
import * as path from "path";

// ─── The full fixture context (AC3.1) ───────────────────────────────────────

const fixtureMatter = {
  id: "m1",
  title: "Chukwu v. First Bank of Nigeria Ltd",
  suitNumber: "LD/1283/2024",
  court: "High Court of Lagos State",
  judicialDivision: "Ikeja",
  courtLocation: "Ikeja",
  parties: [
    { name: "John Okafor Chukwu", role: "Claimant" },
    { name: "Adaeze Chukwu", role: "Claimant" },
    { name: "First Bank of Nigeria Ltd", role: "Defendant" },
  ],
  attorneyNotes: [{ text: "Client instructed recovery of ₦18m loan plus interest." }],
};

const fixtureDictated = {
  reliefs: ["The sum of ₦18,000,000.00 being the outstanding loan principal"],
  groundsOrFacts: [
    "The Claimant granted the Defendant a facility of ₦18,000,000.00 on 1 March 2024",
    "The facility fell due on 1 September 2024 and remains unpaid",
    "The agreement is exhibited as Exhibit A",
  ],
  amounts: [{ label: "outstanding principal", amount: 18_000_000, currency: "NGN" as const }],
  periods: [{ label: "notice period", value: 30, unit: "months" as const }],
  dates: [{ label: "facility maturity", iso: "2024-09-01" }],
  namedPeople: [{ name: "John Okafor Chukwu", role: "deponent" }],
  specialInstructions: [],
};

const blueprint: DraftBlueprint = {
  documents: [{ documentCategory: "litigation_process", documentType: "motion_on_notice", order: 1 }],
  matchedMatterId: "m1",
  matchConfidence: 0.9,
  matchAlternatives: [],
  dictated: fixtureDictated,
  missingCriticalFields: [],
  rawTranscript: "…",
};

const fullCtx: HydratedDraftContext = hydrate({
  blueprint,
  matter: fixtureMatter as never,
  firm: { name: "Adeyemi & Co.", address: "12 Marina, Lagos" } as never,
  user: { name: "Barr. Tunde Adeyemi", barNumber: "NBA/2015/1234" } as never,
});

/** Builds a bundle for ONE type with the fixture context (AC3.1). */
function buildOne(type: (typeof DOCUMENT_TYPES)[number]) {
  const bp: DraftBlueprint = {
    ...blueprint,
    documents: [{ documentCategory: TEMPLATES[type].category, documentType: type, order: 1 }],
  };
  const ctx = hydrate({
    blueprint: bp,
    matter: fixtureMatter as never,
    firm: { name: "Adeyemi & Co.", address: "12 Marina, Lagos" } as never,
    user: { name: "Barr. Tunde Adeyemi", barNumber: "NBA/2015/1234" } as never,
  });
  return { ast: TEMPLATES[type].build(ctx, {}), ctx };
}

// ─── AC3.1: every DocumentType builds ───────────────────────────────────────

describe("AC3.1 — every DocumentType builds from the full fixture context", () => {
  const failures: string[] = [];
  const built: string[] = [];
  for (const type of DOCUMENT_TYPES) {
    it(`builds ${DOCUMENT_TYPE_LABELS[type]} (${type})`, () => {
      const template = TEMPLATES[type];
      expect(template).toBeDefined();
      expect(template.documentType).toBe(type);
      const { ast } = buildOne(type);
      expect(ast.documentType).toBe(type);
      expect(ast.blocks.length).toBeGreaterThan(2);
      const html = astToHtml(ast);
      expect(html.length).toBeGreaterThan(100);
      expect(html).not.toContain("undefined");
      expect(html).not.toContain("NaN");
      built.push(type);
    });
  }
  it("covered every registry value (52 types)", () => {
    expect(built).toHaveLength(DOCUMENT_TYPES.length);
    expect(failures).toEqual([]);
  });
});

// ─── AC3.2: structural validation across every template ─────────────────────

describe("AC3.2 — validateAST structural contract", () => {
  it("every template passes its own structural validation", () => {
    const failures: string[] = [];
    for (const type of DOCUMENT_TYPES) {
      const { ast } = buildOne(type);
      const v = validateAST(ast);
      if (!v.ok) failures.push(`${type}: missing ${v.missing.join(", ")}`);
    }
    if (failures.length > 0) {
      throw new Error(`Structural validation failures:\n${failures.join("\n")}`);
    }
  });

  it("a caption-less motion FAILS (the validator has teeth)", () => {
    const { ast } = buildOne("motion_on_notice");
    const broken = { ...ast, blocks: ast.blocks.filter((b) => b.t !== "courtHeading") };
    expect(validateAST(broken).ok).toBe(false);
    expect(validateAST(broken).missing).toContain("courtHeading");
  });

  it("an affidavit without a jurat FAILS", () => {
    const { ast } = buildOne("supporting_affidavit");
    const broken = { ...ast, blocks: ast.blocks.filter((b) => b.t !== "jurat") };
    expect(validateAST(broken).ok).toBe(false);
  });
});

// ─── AC3.3: affidavit prose rejects argument (Evidence Act) ─────────────────

describe("AC3.3 — affidavit prose-slot validator rejects argument", () => {
  const factsSpec = TEMPLATES.supporting_affidavit.proseSlots[0];
  expect(factsSpec.factsOnly).toBe(true);

  it("rejects a fixture containing legal argument", () => {
    const v = validateProseFill(
      factsSpec,
      "1. It is respectfully submitted that the Claimant is entitled to judgment. 2. The authorities hold that…",
      []
    );
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("argument");
  });

  it("accepts pure facts", () => {
    const v = validateProseFill(
      factsSpec,
      "1. I am the Claimant and the deponent herein. 2. On 1 March 2024 I granted the Defendant a facility of ₦18,000,000.00.",
      []
    );
    expect(v.ok).toBe(true);
  });
});

// ─── AC3.4: party capacity mapping with ordinals ────────────────────────────

describe("AC3.4 — party capacity mapping", () => {
  it("renders CLAIMANT/DEFENDANT for a claim process", () => {
    const lines = renderPartyLines(fixtureMatter.parties as never, "claim");
    expect(lines.map((l) => l.capacity)).toEqual([
      "1ST CLAIMANT",
      "2ND CLAIMANT",
      "DEFENDANT",
    ]);
  });

  it("renders APPLICANT/RESPONDENT for a motion", () => {
    const lines = renderPartyLines(fixtureMatter.parties as never, "motion");
    expect(lines.map((l) => l.capacity)).toEqual([
      "1ST APPLICANT",
      "2ND APPLICANT",
      "RESPONDENT",
    ]);
  });

  it("renders APPELLANT/RESPONDENT on appeal", () => {
    const lines = renderPartyLines(fixtureMatter.parties as never, "appeal");
    expect(lines.map((l) => l.capacity)).toEqual([
      "1ST APPELLANT",
      "2ND APPELLANT",
      "RESPONDENT",
    ]);
  });

  it("renders JUDGMENT CREDITOR/JUDGMENT DEBTOR for enforcement", () => {
    const lines = renderPartyLines(fixtureMatter.parties as never, "enforcement");
    expect(lines.map((l) => l.capacity)).toEqual([
      "1ST JUDGMENT CREDITOR",
      "2ND JUDGMENT CREDITOR",
      "JUDGMENT DEBTOR",
    ]);
  });

  it("mapPartyCapacities assigns ordinals per capacity group", () => {
    const mapped = mapPartyCapacities(fixtureMatter.parties as never, "claim");
    expect(mapped.map((m) => [m.capacity, m.ordinal])).toEqual([
      ["claimant", 1],
      ["claimant", 2],
      ["defendant", 1],
    ]);
  });

  it("the SAME matter renders different labels per process kind in built documents", () => {
    const soc = buildOne("statement_of_claim").ast;
    const motion = buildOne("motion_on_notice").ast;
    const appeal = buildOne("notice_of_appeal").ast;
    const cap = (ast: typeof soc) => {
      const parties = ast.blocks.find((b) => b.t === "partiesBlock");
      return parties && parties.t === "partiesBlock" ? parties.parties[0].capacity : "";
    };
    expect(cap(soc)).toBe("1ST CLAIMANT");
    expect(cap(motion)).toBe("1ST APPLICANT");
    expect(cap(appeal)).toBe("1ST APPELLANT");
  });
});

// ─── AC3.5: notice periods computed in code (never by the LLM) ──────────────

describe("AC3.5 — notice-period computation", () => {
  it("monthly tenancy in the configured jurisdiction yields the statutory period", () => {
    expect(resolveTenancyType("monthly")).toBe("monthly");
    expect(computeNoticePeriodDays("monthly", LAGOS_HIGH_COURT)).toBe(30);
    expect(computeNoticePeriodDays("yearly", LAGOS_HIGH_COURT)).toBe(180);
  });

  it("an UNKNOWN tenancy type renders a placeholder, never a guess", () => {
    expect(computeNoticePeriodDays("unknown", LAGOS_HIGH_COURT)).toBeNull();
    const bp: DraftBlueprint = {
      ...blueprint,
      documents: [
        {
          documentCategory: "statutory_notice",
          documentType: "notice_to_quit",
          order: 1,
        },
      ],
    };
    const ctx = hydrate({ blueprint: bp, matter: null, firm: null, user: null });
    expect(ctx.noticePeriodDays).toBeNull();
    const ast = TEMPLATES.notice_to_quit.build(ctx, {});
    const text = astPlainText(ast);
    expect(text).toContain("[[STATUTORY NOTICE PERIOD]]");
    expect(text).not.toMatch(/notice period of (one|two|three|six) /i);
  });

  it("the LLM cannot influence the period: a dictated conflicting period warns, never overrides", () => {
    const bp: DraftBlueprint = {
      ...blueprint,
      documents: [
        { documentCategory: "statutory_notice", documentType: "notice_to_quit", order: 1 },
      ],
      dictated: {
        ...fixtureDictated,
        periods: [{ label: "notice period", value: 1, unit: "weeks" }],
      },
    };
    const ctx = hydrate({
      blueprint: bp,
      matter: fixtureMatter as never,
      property: { rentalDetails: { tenancyPeriod: "monthly" } } as never,
    });
    // Code-computed from the profile (30 days), regardless of the dictated 1 week.
    expect(ctx.noticePeriodDays).toBe(30);
    expect(ctx.noticePeriodConflict).toBe(true);
    const text = astPlainText(TEMPLATES.notice_to_quit.build(ctx, {}));
    expect(text).toContain("one (1) month");
  });
});

// ─── AC3.6: bundles share exhibit letters + paragraph references ────────────

describe("AC3.6 — bundle consistency", () => {
  const bundleBlueprint: DraftBlueprint = validateDraftBlueprint(
    {
      documents: ["motion_on_notice", "supporting_affidavit", "written_address"],
      reliefs: fixtureDictated.reliefs,
      groundsOrFacts: fixtureDictated.groundsOrFacts,
    },
    { rawTranscript: "…", matches: [{ matterId: "m1", confidence: 0.9, label: "Chukwu" }] }
  ).ok
    ? (validateDraftBlueprint(
        {
          documents: ["motion_on_notice", "supporting_affidavit", "written_address"],
          reliefs: fixtureDictated.reliefs,
          groundsOrFacts: fixtureDictated.groundsOrFacts,
        },
        { rawTranscript: "…", matches: [{ matterId: "m1", confidence: 0.9, label: "Chukwu" }] }
      ) as { ok: true; value: DraftBlueprint }).value
    : minimalBlueprint("");

  it("collects exhibits from dictated content", () => {
    expect(collectExhibits(fixtureDictated)).toContain("A");
  });

  it("the motion + affidavit + written address bundle shares exhibit letters", () => {
    const ctx = hydrate({
      blueprint: bundleBlueprint,
      matter: fixtureMatter as never,
      firm: { name: "Adeyemi & Co." } as never,
    });
    expect(ctx.exhibits).toContain("A");
    const bundle = assembleBundle({ blueprint: bundleBlueprint, ctx, fills: {} });
    expect(bundle.documents).toHaveLength(3);
    const affidavitText = astPlainText(bundle.documents[1]);
    expect(affidavitText).toContain("EXHIBIT A");
    // Every document in the bundle sees the SAME exhibit letters via ctx.
    const listAst = TEMPLATES.list_of_documents.build(ctx, {});
    expect(astPlainText(listAst)).toContain("EXHIBIT A");
  });

  it("affidavitParagraphs extracts the sibling affidavit's numbered paragraphs", () => {
    const ctx = hydrate({ blueprint: bundleBlueprint, matter: fixtureMatter as never });
    const bundle = assembleBundle({ blueprint: bundleBlueprint, ctx, fills: {} });
    const paras = affidavitParagraphs(bundle);
    expect(paras.length).toBeGreaterThan(0);
    expect(paras[0]).toContain("facility");
  });

  it("the whole bundle validates structurally", () => {
    const ctx = hydrate({ blueprint: bundleBlueprint, matter: fixtureMatter as never });
    const bundle = assembleBundle({ blueprint: bundleBlueprint, ctx, fills: {} });
    const validations = validateBundle(bundle);
    expect(validations.every((v) => v.v.ok)).toBe(true);
  });
});

// ─── AC3.7: no hard-coded year ──────────────────────────────────────────────

describe("AC3.7 — no hard-coded year in legal/drafting", () => {
  it("grep for the CURRENT year (e.g. 2026) returns nothing outside tests", () => {
    const currentYear = String(new Date().getFullYear());
    const dir = path.resolve(__dirname, "../../../src/legal/drafting");
    const files = fs.readdirSync(dir, { recursive: true }).filter(
      (f) => String(f).endsWith(".ts") || String(f).endsWith(".tsx")
    );
    const offenders: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, String(f)), "utf8");
      // Allow year mentions only inside comments; statutory years inside
      // rule-reference DATA ("…Rules 2019") are profile config, not
      // hard-coded generation years — the spec pins only the current year.
      const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      if (withoutComments.includes(currentYear)) offenders.push(String(f));
    }
    expect(offenders).toEqual([]);
  });

  it("the motion TAKE NOTICE clause uses the CURRENT year", () => {
    const { ast } = buildOne("motion_on_notice");
    const text = astPlainText(ast);
    expect(text).toContain(String(new Date().getFullYear()));
  });
});

// ─── Editor transforms (spec §7.3/§7.4, AC4.3) ─────────────────────────────

describe("editor AST transforms", () => {
  const ctx = hydrate({ blueprint, matter: fixtureMatter as never });
  const bundle = assembleBundle({ blueprint, ctx, fills: {} });

  it("findPlaceholders lists every unresolved pill", () => {
    const refs = findPlaceholders(bundle);
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.every((r) => r.label.length > 0)).toBe(true);
  });

  it("fillSlot resolves a placeholder and reduces the count (AC4.2 flow)", () => {
    const before = findPlaceholders(bundle).length;
    const target = findPlaceholders(bundle)[0];
    const filled = fillSlot(bundle, target.documentIndex, target.slotKey, "Filled value", "manual");
    expect(findPlaceholders(filled).length).toBe(before - 1);
  });

  it("computeMissingFields reports code-side gaps (AC2.5 companion)", () => {
    const missing = computeMissingFields(
      hydrate({ blueprint, matter: null, firm: null, user: null }),
      blueprint.documents
    );
    expect(missing.some((m) => m.key === "matter.caseNumber")).toBe(true);
  });

  it("insertNumberedItem adds exactly one relief; every other line is byte-identical (AC4.3)", () => {
    const motionIndex = bundle.documents.findIndex((d) => d.documentType === "motion_on_notice");
    const lines = (t: string) => t.split("\n").filter((l) => l.trim().length > 0);
    const before = astPlainText(bundle.documents[motionIndex]);
    const afterBundle = insertNumberedItem(
      bundle,
      motionIndex,
      "Interest at 10% per annum on the judgment sum until final liquidation"
    );
    const after = astPlainText(afterBundle.documents[motionIndex]);
    const beforeLines = lines(before);
    const afterLines = lines(after);
    // Exactly ONE new line, inserted before the omnibus prayer.
    expect(afterLines.length).toBe(beforeLines.length + 1);
    const added = afterLines.find((l) => l.includes("Interest at 10%"));
    expect(added).toBeTruthy();
    expect(added).toMatch(/^\d+\. /);
    // Every other line is byte-identical (AC4.3 diff) — modulo the automatic
    // renumbering of the lines AFTER the insertion point, which the spec
    // requires ("renumbering and cross-references update automatically").
    const stripNo = (l: string) => l.replace(/^\d+\.\s+/, "");
    // …and modulo that renumbering, the line CONTENT is preserved.
    const beforeContent = beforeLines.map(stripNo);
    const afterContent = afterLines.map(stripNo);
    expect(afterContent.length).toBe(beforeContent.length + 1);
    for (const l of beforeContent) expect(afterContent).toContain(l);
    // The omnibus prayer moved from #2 to #3 (inserted before it).
    const omnibus = afterLines.find((l) => /further or other order/i.test(l));
    expect(omnibus).toMatch(/^3\. /);
    // The other documents are untouched.
    bundle.documents.forEach((d, i) => {
      if (i === motionIndex) return;
      expect(astPlainText(afterBundle.documents[i])).toBe(astPlainText(d));
    });
  });
});
