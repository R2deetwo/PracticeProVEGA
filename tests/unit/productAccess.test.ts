/**
 * R13 regression suite — product feature access (src/utils/productAccess.ts).
 *
 * Locks the exact access matrix the FeatureGuard enforces, and the
 * auto-redirect behavior introduced to kill the "Feature not available"
 * dead-end wall (user report: a fresh Atrium signup's first screen was
 * the Vega wall because their tab carried a stale /matters URL).
 *
 * FeatureGuard now:
 *   1. consults this pure matrix (unchanged semantics from the pre-R13
 *      inline logic);
 *   2. AUTO-REDIRECTS blocked users to the dashboard with a friendly,
 *      product-named toast — never a dead end.
 */
import { describe, it, expect } from "vitest";
import { isFeatureAllowed, productDisplayName, featureRedirectMessage } from "../../src/utils/productAccess";

describe("isFeatureAllowed — the access matrix", () => {
  it("unified (Komplete) workspaces include every feature", () => {
    for (const req of ["legal", "property", "vega", "atrium", "unified"] as const) {
      expect(isFeatureAllowed(req, "unified")).toBe(true);
    }
  });

  it("undefined product (data still loading) allows everything — no flash of the wall", () => {
    expect(isFeatureAllowed("legal", undefined)).toBe(true);
    expect(isFeatureAllowed("property", undefined)).toBe(true);
  });

  it("vega workspaces: legal features allowed, property blocked", () => {
    expect(isFeatureAllowed("legal", "vega")).toBe(true);
    expect(isFeatureAllowed("vega", "vega")).toBe(true);
    expect(isFeatureAllowed("property", "vega")).toBe(false);
    expect(isFeatureAllowed("atrium", "vega")).toBe(false);
  });

  it("legal alias is accepted as the current product (legacy naming)", () => {
    expect(isFeatureAllowed("legal", "legal" as any)).toBe(true);
    expect(isFeatureAllowed("vega", "legal" as any)).toBe(true);
    expect(isFeatureAllowed("property", "legal" as any)).toBe(false);
  });

  it("atrium workspaces: property features allowed, legal blocked", () => {
    expect(isFeatureAllowed("property", "atrium")).toBe(true);
    expect(isFeatureAllowed("atrium", "atrium")).toBe(true);
    expect(isFeatureAllowed("legal", "atrium")).toBe(false);
    expect(isFeatureAllowed("vega", "atrium")).toBe(false);
  });

  it("property alias is accepted as the current product (legacy naming)", () => {
    expect(isFeatureAllowed("property", "property" as any)).toBe(true);
    expect(isFeatureAllowed("atrium", "property" as any)).toBe(true);
    expect(isFeatureAllowed("legal", "property" as any)).toBe(false);
  });

  it("array requirement: allowed if ANY listed product matches", () => {
    expect(isFeatureAllowed(["legal", "property"], "atrium")).toBe(true);
    expect(isFeatureAllowed(["legal", "property"], "vega")).toBe(true);
    expect(isFeatureAllowed(["legal", "property"], "unified")).toBe(true);
  });

  it("the fresh-Atrium-user-on-matters case (the reported bug) is blocked", () => {
    // FeatureGuard(requiredProduct="legal") with product="atrium" — the
    // exact state that produced the user's "Feature not available … part
    // of Vega" wall. Still blocked (correct) — but now auto-redirects.
    expect(isFeatureAllowed("legal", "atrium")).toBe(false);
  });
});

describe("productDisplayName", () => {
  it("maps every accepted identifier to the user-facing name", () => {
    expect(productDisplayName("legal")).toBe("Vega");
    expect(productDisplayName("vega")).toBe("Vega");
    expect(productDisplayName("property")).toBe("Atrium");
    expect(productDisplayName("atrium")).toBe("Atrium");
    expect(productDisplayName("unified")).toBe("Komplete");
  });
});

describe("featureRedirectMessage — the auto-redirect toast copy", () => {
  it("names the owning product and the user's workspace, never a dead end", () => {
    const msg = featureRedirectMessage("legal", "atrium");
    expect(msg).toContain("Vega");
    expect(msg).toContain("Atrium");
    expect(msg).toContain("dashboard");
    // The old wall said "Feature not available" / "does not include this
    // module" — the new copy must not reuse that dead-end framing.
    expect(msg).not.toMatch(/not available/i);
  });

  it("joins array requirements with 'or'", () => {
    const msg = featureRedirectMessage(["legal", "property"], "unified");
    expect(msg).toContain("Vega or Atrium");
  });
});
