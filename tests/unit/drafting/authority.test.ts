/**
 * Authority-library guardrail tests — owner spec 2026-11-19, §6:
 * AC6.1 (an unverified citation NEVER reaches the AST as literal text)
 * and AC6.2 (the counsel-review banner never appears in exports).
 */

import { describe, expect, it } from "vitest";
import {
  extractCitations,
  parseAuthoritiesCsv,
  scrubUnverifiedCitations,
  CITATION_TO_VERIFY_PREFIX,
  type AuthorityEntry,
} from "../../../src/legal/drafting/authorityLibrary";
import { validateProseFill } from "../../../src/legal/drafting/assemble";
import { TEMPLATES } from "../../../src/legal/drafting/templates/registry";
import { astToHtml, bundleToHtml } from "../../../src/legal/drafting/astToHtml";
import { hydrate } from "../../../src/legal/drafting/hydrate";
import { minimalBlueprint } from "../../../src/legal/drafting/blueprint";
import { PAGE_CSS_PRINT } from "../../../src/utils/pageFormat";

const LIBRARY: AuthorityEntry[] = [
  {
    citation: "Okafor v. Bello (2023) LPELR-58880(SC)",
    court: "Supreme Court",
    year: "2023",
    proposition: "Affidavit evidence must be factual",
    verified: true,
  },
  {
    citation: "[2023] NWLR (Pt 1291) 1",
    court: "Supreme Court",
    year: "2023",
    proposition: "Limitation periods are procedural",
    verified: true,
  },
];

describe("citation extraction", () => {
  it("recognises LPELR citations", () => {
    expect(extractCitations("the holding in (2023) LPELR-58880(SC) is clear")).toContain(
      "(2023) LPELR-58880(SC)"
    );
  });

  it("recognises law-report citations", () => {
    expect(extractCitations("see [2023] NWLR (Pt 1291) 1 at 15")).toContain(
      "[2023] NWLR (Pt 1291) 1"
    );
  });

  it("recognises case-name-plus-year citations", () => {
    const out = extractCitations("In Okafor v. Bello (2023) the court held");
    expect(out.some((c) => c.includes("Okafor v. Bello"))).toBe(true);
  });

  it("does not flag ordinary sentences", () => {
    expect(extractCitations("The tenant failed to pay rent for six months")).toEqual([]);
  });
});

describe("AC6.1 — unverified citations never reach the AST as literal text", () => {
  it("replaces an out-of-library citation with a verification pill", () => {
    const { text, replaced } = scrubUnverifiedCitations(
      "The principle applies per Momoh v. Ibrahim (2019) LPELR-12345(CA)",
      LIBRARY
    );
    // The whole unverified citation is gone — whichever shape matched first.
    expect(replaced.join(" ")).toMatch(/Momoh v\. Ibrahim \(2019\)|LPELR-12345/);
    expect(text).toContain(CITATION_TO_VERIFY_PREFIX);
    expect(text).not.toContain("LPELR-12345");
    expect(text).not.toContain("Momoh v. Ibrahim (2019) LPELR");
  });

  it("keeps citations that ARE in the library", () => {
    const { replaced } = scrubUnverifiedCitations(
      "As held in (2023) LPELR-58880(SC) and [2023] NWLR (Pt 1291) 1",
      LIBRARY
    );
    expect(replaced).toEqual([]);
  });

  it("validateProseFill scrubs before any text reaches a prose slot", () => {
    const spec = TEMPLATES.written_address.proseSlots.find((s) => s.key.endsWith("argument"))!;
    const v = validateProseFill(
      spec,
      "ISSUE ONE: The court is bound by Adebayo v. State (2021) LPELR-55555(SC) which holds that…",
      LIBRARY
    );
    expect(v.ok).toBe(true);
    expect(v.text).toContain(CITATION_TO_VERIFY_PREFIX);
    expect(v.text).not.toContain("LPELR-55555");
  });
});

describe("AC6.2 — the counsel-review banner never appears in exports", () => {
  const BANNER = "Draft generated for counsel review";

  const ctx = hydrate({
    blueprint: minimalBlueprint(""),
    matter: {
      id: "m1",
      suitNumber: "LD/1/2024",
      court: "High Court of Lagos State",
      judicialDivision: "Ikeja",
      parties: [{ name: "A", role: "Claimant" }, { name: "B", role: "Defendant" }],
    } as never,
  });

  it("astToHtml / bundleToHtml never contain the banner", () => {
    const motion = TEMPLATES.motion_on_notice.build(ctx, {});
    expect(astToHtml(motion)).not.toContain(BANNER);
    expect(bundleToHtml({ bundleId: "b", documents: [motion] })).not.toContain(BANNER);
  });

  it("the banner text lives only in the editor-side component + shared note", () => {
    // The renderer modules themselves must not embed the banner.
    const renderer = require("fs").readFileSync(
      require("path").resolve(__dirname, "../../../src/legal/drafting/astToHtml.ts"),
      "utf8"
    );
    expect(renderer).not.toContain(BANNER);
    // The print stylesheet cannot carry it either.
    expect(PAGE_CSS_PRINT).not.toContain(BANNER);
  });

  it("the DOCX export pipeline has no banner injection point (source scan)", () => {
    const docxExport = require("fs").readFileSync(
      require("path").resolve(__dirname, "../../../src/utils/docxExport.ts"),
      "utf8"
    );
    expect(docxExport).not.toContain(BANNER);
  });
});

describe("CSV import path (spec §6.2)", () => {
  it("parses the import format and skips the header", () => {
    const rows = parseAuthoritiesCsv(
      "citation,court,year,proposition,verified\n" +
        'Okafor v. Bello (2023) LPELR-58880(SC),Supreme Court,2023,Affidavit facts,true\n' +
        "Ude v. Musa (2020) LPELR-9999(CA),Court of Appeal,2020,Service rules,false"
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ court: "Supreme Court", verified: true });
    expect(rows[1]).toMatchObject({ verified: false });
  });

  it("caps pathological input", () => {
    const many = Array.from({ length: 600 }, (_, i) => `Case ${i} v. X (200${i % 10})`).join("\n");
    expect(parseAuthoritiesCsv(many).length).toBeLessThanOrEqual(500);
  });
});
