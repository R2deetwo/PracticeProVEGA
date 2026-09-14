/**
 * Corporate-identity regression suite — the 2026-09-14 naming complaint.
 *
 * The user (founder) flagged: the Privacy Policy read "Welcome to
 * PracticePro (also known as 'PracticePro VEGA')" — a misnomer that treats
 * the COMPANY as an alias of ONE of its PRODUCTS, and framed the whole
 * document around Vega rather than the company that owns both products.
 *
 * Official naming model (consistent with src/constants/products.ts and all
 * six legal documents):
 *   - Company:  PracticePro Systems Limited ("PracticePro")
 *   - Products: PracticePro Vega (legal), PracticePro Atrium (property),
 *               Komplete (the bundle of both)
 *   - AI assistant: ALOA™ only for Vega; ARIA™ only for Atrium
 *
 * Also unified: email footers said "PracticePro Legal Technologies
 * Ltd/Limited" (6 occurrences in convex/) — now PracticePro Systems
 * Limited everywhere.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(repoRoot, ...p), "utf-8");
const privacySrc = read("src", "components", "PrivacyPolicy.tsx");
const myFunctionsSrc = read("convex", "myFunctions.ts");
const portalsSrc = read("convex", "portals.ts");

describe("PrivacyPolicy — company owns products (no misnomer)", () => {
  it("never says PracticePro is 'also known as' one of its products", () => {
    expect(privacySrc).not.toContain("also known as");
  });

  it("introduces the company and BOTH products by name", () => {
    expect(privacySrc).toContain("PracticePro Systems Limited");
    expect(privacySrc).toContain("PracticePro Vega");
    expect(privacySrc).toContain("PracticePro Atrium");
    // The company-behind-products framing (not product-as-alias):
    expect(privacySrc).toContain("is the company behind two");
  });

  it("Who We Are lists the products under the company name", () => {
    expect(privacySrc).toMatch(/Products:.*PracticePro Vega \(legal practice\).*PracticePro Atrium \(property management\)/s);
  });

  it("uses ARIA™ (not ALOA™) for the Atrium assistant in shared sentences", () => {
    // Every place where the same sentence renders for both products must
    // switch the assistant name — the old text called Atrium's assistant ALOA.
    const shared = privacySrc.match(/isProperty \?[^']*ARIA/g) || [];
    expect(privacySrc).not.toMatch(/isProperty[^']*'[^']*assistant ALOA/);
    expect(shared.length).toBeGreaterThanOrEqual(0); // structural no-op; below is the real pin
    expect(privacySrc).toMatch(/\{isVega \? 'ALOA™' : 'ARIA™'\}/);
  });
});

describe("email footers — one company name everywhere", () => {
  it("no 'Legal Technologies' variant survives", () => {
    for (const src of [myFunctionsSrc, portalsSrc]) {
      expect(src).not.toContain("Legal Technologies");
    }
    expect(myFunctionsSrc).toContain("PracticePro Systems Limited. All rights reserved.");
    expect(portalsSrc).toContain("PracticePro Systems Limited &middot; Lagos, Nigeria");
  });
});
