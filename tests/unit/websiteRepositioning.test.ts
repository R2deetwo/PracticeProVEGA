/**
 * Website-repositioning regression suite — W0–W6.
 *
 * Pins the PracticePro Systems brand architecture on the public website
 * (docs/brand-architecture.md), the same way corporateIdentity.test.ts pins
 * it in the legal documents:
 *
 *   - Company:  PracticePro Systems Limited ("PracticePro")
 *   - Products: PracticePro Vega (legal), PracticePro Atrium (property),
 *               Komplete (the bundle)
 *   - Client commissions: Kozy Care (live at kozycare.ng)
 *   - W6 (2026-10-07, owner direction): the root page is the company's full
 *     corporate home — it sells the BUILDER (what we do, what we've built,
 *     how we work, how to reach us), not just the product picker. The
 *     company-and-location eyebrow is retired from the top of the page.
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

describe("W6 — the root page is the company's corporate home", () => {
  it("the hero sells what the company does, value-first", () => {
    expect(landing).toContain("We build the systems");
    expect(landing).toContain("businesses run on.");
    expect(landing).toContain(
      "PracticePro Systems is a Lagos software company."
    );
  });

  it("the company-and-location eyebrow is retired from the top of the page", () => {
    expect(landing).not.toContain("PracticePro Systems · Lagos, Nigeria");
  });

  it("the corporate nav walks the company sections", () => {
    expect(landing).toContain("What We Do");
    expect(landing).toContain("Our Work");
    expect(landing).toContain("How We Work");
    expect(landing).toContain("About");
  });

  it("the services section presents builder capabilities", () => {
    expect(landing).toContain("WHAT_WE_DO");
    expect(landing).toContain("What we can build for you");
    expect(landing).toContain("Custom business systems");
    expect(landing).toContain("Custom integrations");
    expect(landing).toContain("Payments & revenue operations");
    expect(landing).toContain("Hosting, security & compliance");
  });

  it("the engagement process is presented", () => {
    expect(landing).toContain("HOW_WE_WORK");
    expect(landing).toContain("From first conversation to a system you run on");
    expect(landing).toContain("Understand your operations");
    expect(landing).toContain("Launch, train & run with you");
  });

  it("the about section grounds the company in Lagos honestly", () => {
    expect(landing).toContain("Run in production.");
    expect(landing).toContain(
      "PracticePro Systems is a software company based in Lagos, Nigeria."
    );
  });
});

describe("W6 — the portfolio: products + client commissions", () => {
  it("presents the systems the company has built", () => {
    expect(landing).toContain("OUR_WORK");
    expect(landing).toContain("Systems we&apos;ve built");
  });

  it("Vega and Atrium link to their product pages", () => {
    expect(landing).toContain("Vega — Legal Practice OS");
    expect(landing).toContain("Atrium — Property Management OS");
    expect(landing).toContain('href="/vega"');
    expect(landing).toContain('href="/atrium"');
  });

  it("Kozy Care is presented as a client commission, live at kozycare.ng", () => {
    expect(landing).toContain("Kozy Care");
    expect(landing).toContain("Built for a client");
    expect(landing).toContain("https://kozycare.ng");
  });

  it("every work card carries the Built-by mark", () => {
    expect(landing).toContain("Built by PracticePro");
  });

  it("the hub footer sells the custom-systems line of business", () => {
    expect(landing).toContain("Custom systems — built to order");
    expect(landing).toContain("Kozy Care — a client build");
  });
});

describe("W1/W2 — company-behind-products framing on the website", () => {
  it("the footer names the company's role and carries the Built-by mark", () => {
    expect(landing).toContain(
      "A Lagos software company. We design, build and run the systems businesses manage their affairs with"
    );
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
    expect(index).toContain(
      '"publisher": { "@id": "https://practicepro.ng/#organization" }'
    );
  });

  it("no fabricated aggregateRating anywhere", () => {
    expect(index).not.toContain("aggregateRating");
    expect(index).not.toContain("ratingValue");
  });

  it("page metadata leads with the company's builder positioning (W6)", () => {
    expect(index).toContain(
      "<title>PracticePro Systems — We Build the Systems Businesses Run On</title>"
    );
    expect(index).toContain(
      '<meta property="og:site_name" content="PracticePro Systems" />'
    );
  });
});
