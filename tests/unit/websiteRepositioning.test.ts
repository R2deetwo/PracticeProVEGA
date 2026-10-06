/**
 * Website-repositioning regression suite — W0–W5 (2026-10-07).
 *
 * Pins the PracticePro Systems brand architecture on the public website
 * (docs/brand-architecture.md), the same way corporateIdentity.test.ts pins
 * it in the legal documents:
 *
 *   - Company:  PracticePro Systems Limited ("PracticePro")
 *   - Products: PracticePro Vega (legal), PracticePro Atrium (property),
 *               Komplete (the bundle)
 *   - The hub speaks as the COMPANY; product pages name the PRODUCT and
 *     credit the builder ("Built by PracticePro").
 *   - Honest marketing (P8): no fabricated testimonial personas, no
 *     fabricated structured-data ratings.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(repoRoot, ...p), "utf-8");
const landing = read("src", "components", "LandingPage.tsx");
const index = read("index.html");

describe("W1/W2 — company-behind-products framing on the website", () => {
  it("the hub speaks as the company (eyebrow + company sub-copy)", () => {
    expect(landing).toContain("PracticePro Systems · Lagos, Nigeria");
    expect(landing).toContain(
      "We build dedicated operating systems for the organizations that run modern Africa."
    );
  });

  it("the footer names the company's role and carries the Built-by mark", () => {
    expect(landing).toContain("The company behind Vega and Atrium");
    expect(landing).toContain("Vega &amp; Atrium · Built by PracticePro");
  });

  it("product heroes carry the Built-by attribution eyebrow", () => {
    expect(landing).toContain("'Vega · Built by PracticePro'");
    expect(landing).toContain("'Atrium · Built by PracticePro'");
  });

  it("sections name the product, never 'run on PracticePro'", () => {
    expect(landing).toContain("'Why firms run on Vega'");
    expect(landing).toContain("'Why portfolios run on Atrium'");
    expect(landing).not.toContain("run on PracticePro");
  });

  it("the hub footer presents the product portfolio", () => {
    expect(landing).toContain("Vega — Legal Practice OS");
    expect(landing).toContain("Atrium — Property Management OS");
    expect(landing).toContain("Komplete — both, for real-estate attorneys");
  });
});

describe("W3 — honest social proof (P8)", () => {
  it("no invented testimonial personas survive", () => {
    const personas = [
      "Adebayo Ogundimu",
      "Adaeze Nwosu",
      "Chidi Okafor",
      "Tunde Bakare",
      "Funmi Adewale",
      "Emeka Obi",
    ];
    for (const name of personas) {
      expect(landing).not.toContain(name);
    }
  });

  it("no five-star testimonial markup; capability cards instead", () => {
    expect(landing).not.toContain("Star rating");
    expect(landing).not.toContain("M9.049 2.927"); // the deleted star SVG path
    expect(landing).toContain("WHY_RUN_ON");
    expect(landing).toContain("Drafted for Nigerian courts");
    expect(landing).toContain("Every state's tenancy law, applied");
  });
});

describe("W4 — structured data: Organization + per-product apps", () => {
  it("declares the company as an Organization", () => {
    expect(index).toContain('"@type": "Organization"');
    expect(index).toContain("PracticePro Systems Limited");
    expect(index).toContain('"@id": "https://practicepro.ng/#organization"');
  });

  it("one SoftwareApplication per product, published by the company", () => {
    expect(index).toContain('"PracticePro Vega"');
    expect(index).toContain('"PracticePro Atrium"');
    expect(index).toContain('"url": "https://practicepro.ng/vega"');
    expect(index).toContain('"url": "https://practicepro.ng/atrium"');
    expect(index).toContain('"publisher": { "@id": "https://practicepro.ng/#organization" }');
  });

  it("no fabricated aggregateRating anywhere", () => {
    expect(index).not.toContain("aggregateRating");
    expect(index).not.toContain("ratingValue");
  });

  it("page metadata leads with the company", () => {
    expect(index).toContain(
      "<title>PracticePro Systems — Vega for Law Firms, Atrium for Property Managers</title>"
    );
    expect(index).toContain('<meta property="og:site_name" content="PracticePro Systems" />');
  });
});
