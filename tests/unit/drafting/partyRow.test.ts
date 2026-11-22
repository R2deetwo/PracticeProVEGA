/**
 * partyRow.test.ts — the Nigerian court-process party-line geometry
 * (2026-11-22 owner direction, the DraftPro demo review):
 *
 *   "the word claimant should be a bit more to the right, sort of under
 *    where that suit number is… the word claimant shouldn't be under
 *    BETWEEN, it should be across the screen. The dotted lines — have
 *    them uniform and then bring them across the screen."
 *
 * The parties block must render as STRUCTURAL rows — name at the left
 * margin, ONE uniform dotted leader, designation in a right-hand column —
 * in the editor HTML (astToHtml) and export to the Word-native construct
 * (a right tab stop with a dot leader) in DOCX.
 *
 * jsdom environment: the DOCX converter needs a DOM.
 */
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";

import { TEMPLATES } from "../../../src/legal/drafting/templates/registry";
import { astToHtml } from "../../../src/legal/drafting/astToHtml";
import type { HydratedDraftContext } from "../../../src/legal/drafting/types";
import { LAGOS_HIGH_COURT } from "../../../src/legal/drafting/jurisdictionProfiles";
import { convertHtmlToOoxml } from "../../../src/utils/docxExport";

const baseCtx = (parties: Array<{ name: string; role: string }>): HydratedDraftContext => ({
  matter: {
    id: "m-1",
    court: {
      value: { courtName: "High Court of Lagos State", division: "Lagos", location: "Lagos" },
      source: "matter",
    },
    caseNumber: { value: { kind: "suit", number: "LD/1234/2025" }, source: "matter" },
    parties: [],
    caseNotes: [],
    endorsements: [],
  },
  firm: {
    counselName: { value: "Seun Badejo, Esq.", source: "firm" },
    enrollmentNumber: { value: "NBA/1998/1417", source: "firm" },
    firmName: { value: "Badejo & Associates", source: "firm" },
    firmAddress: { value: "14B A.J. Marinho Drive, Lagos", source: "firm" },
    firmEmail: { value: "chambers@badejo.ng", source: "firm" },
    firmPhone: { value: "+234 803 000 0000", source: "firm" },
  },
  jurisdiction: LAGOS_HIGH_COURT,
  dictated: {
    reliefs: [],
    groundsOrFacts: [],
    amounts: [],
    periods: [],
    dates: [],
    namedPeople: [],
    specialInstructions: [],
  },
  rawParties: parties,
  noticePeriodDays: null,
  noticePeriodConflict: false,
  exhibits: [],
});

const LONG_NAME = "Meridian Agro Processing Ltd.";
const SHORT_NAME = "Savannah Haulage Ltd.";

function partiesHtml(): string {
  const ast = TEMPLATES.statement_of_claim.build(baseCtx([
    { name: LONG_NAME, role: "Claimant" },
    { name: SHORT_NAME, role: "Defendant" },
  ]), {});
  return astToHtml(ast);
}

// ─── The editor/print geometry ───────────────────────────────────────────────

describe("party rows — the editor HTML geometry", () => {
  const html = partiesHtml();

  it("renders each party as a STRUCTURAL party-row div (not a dot-count text run)", () => {
    expect(html).toContain('<div data-type="party-row"');
    expect(html).not.toMatch(/\.{8,}/); // no character-counted dot leaders
  });

  it("the designation rides the row as data-designation (CLAIMANT / DEFENDANT)", () => {
    expect(html).toContain('data-designation="CLAIMANT"');
    expect(html).toContain('data-designation="DEFENDANT"');
  });

  it("one uniform dotted leader per row, spanning the middle (a border rule, not dots)", () => {
    expect((html.match(/border-bottom:1\.5pt dotted/g) || []).length).toBe(2);
    expect(html).toContain("flex:1 1 auto");
  });

  it("BETWEEN / AND stay centred connectors; the name sits in the row's first span", () => {
    expect(html).toMatch(/<p data-align="center"[^>]*>BETWEEN<\/p>/);
    expect(html).toMatch(/<p data-align="center"[^>]*>AND<\/p>/);
    expect(html).toContain(`<span style="white-space:nowrap;">${LONG_NAME}</span>`);
    expect(html).toContain(`<span style="white-space:nowrap;">${SHORT_NAME}</span>`);
  });

  it("the designation column is right-side under the suit number: the row is a flex row and the suit number is right-aligned", () => {
    // Suit number right-aligned above…
    expect(html).toMatch(/<p data-align="right"[^>]*>SUIT NO: LD\/1234\/2025<\/p>/);
    // …and the party row lays name | leader | designation out in one line.
    const row = html.match(/<div data-type="party-row"[^>]*>/)![0];
    expect(row).toContain("display:flex");
    expect(row).toContain("align-items:baseline");
  });

  it("the designation text appears exactly twice (attr + span) — never mid-page text runs", () => {
    // Once as the attribute, once as the rendered span — and NOT inside a
    // plain <p>NAME ..... CLAIMANT</p> paragraph.
    expect((html.match(/CLAIMANT/g) || []).length).toBe(2);
    expect(html).not.toMatch(/<p>[^<]*CLAIMANT<\/p>/);
  });
});

describe("party rows — ordinals and placeholders", () => {
  it("multiple claimants carry ordinals into the designation column", () => {
    const ast = TEMPLATES.statement_of_claim.build(baseCtx([
      { name: "Ade Ojo", role: "Claimant" },
      { name: "Bola Ojo", role: "Claimant" },
      { name: "C ltd", role: "Defendant" },
    ]), {});
    const html = astToHtml(ast);
    expect(html).toContain('data-designation="1ST CLAIMANT"');
    expect(html).toContain('data-designation="2ND CLAIMANT"');
    expect(html).toContain('data-designation="DEFENDANT"');
  });

  it("missing party names render placeholder pills INSIDE the name span", () => {
    const ast = TEMPLATES.statement_of_claim.build(baseCtx([]), {});
    const html = astToHtml(ast);
    expect(html).toMatch(
      /<span style="white-space:nowrap;"><span data-type="legal-placeholder" data-label="CLAIMANT NAME"><\/span><\/span>/
    );
  });
});

// ─── The DOCX export — Word's native party-line construct ───────────────────

describe("party rows — the DOCX export", () => {
  it("exports as ONE paragraph with a RIGHT TAB + DOT LEADER at the text width (9072 twips)", () => {
    const { paragraphs } = convertHtmlToOoxml(partiesHtml());
    const partyParas = paragraphs.filter((p) => p.includes('w:leader="dot"'));
    expect(partyParas.length).toBe(2);
    for (const p of partyParas) {
      expect(p).toContain('<w:tab w:val="right" w:leader="dot" w:pos="9072"/>');
      expect(p).toContain("<w:r><w:tab/></w:r>");
    }
  });

  it("the name runs lead and the designation lands AFTER the tab — once, not duplicated", () => {
    const { paragraphs } = convertHtmlToOoxml(partiesHtml());
    const claimantRow = paragraphs.find((p) => p.includes("w:leader") && p.includes(LONG_NAME))!;
    const tabIdx = claimantRow.indexOf("<w:tab/>");
    const nameIdx = claimantRow.indexOf(LONG_NAME);
    const designationIdx = claimantRow.indexOf(">CLAIMANT<");
    expect(nameIdx).toBeGreaterThan(-1);
    expect(nameIdx).toBeLessThan(tabIdx);
    expect(designationIdx).toBeGreaterThan(tabIdx);
    // The designation appears exactly once (the span's own text is not
    // re-collected from the row div).
    expect((claimantRow.match(/CLAIMANT/g) || []).length).toBe(1);
  });
});
