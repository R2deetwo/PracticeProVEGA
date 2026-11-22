/**
 * jurisdictionProfiles.test.ts — the FHC and FCT profiles are POPULATED
 * (2026-11-22), with verified citations:
 *
 *   - FHC: caption "IN THE FEDERAL HIGH COURT OF NIGERIA"; motions cite the
 *     FHC (CP) Rules 2019; frontloading under Order 3 Rule 3(1).
 *   - FCT: caption "IN THE HIGH COURT OF THE FEDERAL CAPITAL TERRITORY,
 *     ABUJA"; the 2025 Rules (superseding the 2018 Rules) are cited.
 *
 * Both previously shipped as stubs ("[RULE REFERENCE TO BE VERIFIED FOR
 * THIS COURT]") — the stub text must not return for these two courts.
 */
import { describe, it, expect } from "vitest";

import {
  FEDERAL_HIGH_COURT,
  FCT_HIGH_COURT,
  LAGOS_HIGH_COURT,
  resolveJurisdictionProfile,
} from "../../../src/legal/drafting/jurisdictionProfiles";

describe("Federal High Court profile — populated", () => {
  it("carries the real caption (not the stub's bare IN THE {{DIVISION}})", () => {
    expect(FEDERAL_HIGH_COURT.headingTemplates[0]).toBe("IN THE FEDERAL HIGH COURT OF NIGERIA");
    expect(FEDERAL_HIGH_COURT.headingTemplates).not.toEqual(
      expect.arrayContaining(["IN THE {{DIVISION}}"])
    );
  });

  it("motions cite the FHC (CP) Rules 2019 — never the stub placeholder", () => {
    expect(FEDERAL_HIGH_COURT.motionEnablingRule.text).toContain(
      "Federal High Court (Civil Procedure) Rules 2019"
    );
    expect(FEDERAL_HIGH_COURT.motionEnablingRule.text).not.toContain("TO BE VERIFIED");
    expect(FEDERAL_HIGH_COURT.motionEnablingRule.verifyBy).toBe("counsel");
  });

  it("frontloading is required with the Order 3 Rule 3(1) citation", () => {
    expect(FEDERAL_HIGH_COURT.frontloading.required).toBe(true);
    expect(FEDERAL_HIGH_COURT.frontloading.rule?.text).toContain("Order 3 Rule 3(1)");
    expect(FEDERAL_HIGH_COURT.frontloading.accompanyingDocuments).toContain(
      "witness_statement_on_oath"
    );
  });

  it("resolves from free-text court strings incl. 'fhc'", () => {
    expect(resolveJurisdictionProfile("Federal High Court, Lagos")).toBe(FEDERAL_HIGH_COURT);
    expect(resolveJurisdictionProfile("FHC Abuja")).toBe(FEDERAL_HIGH_COURT);
  });
});

describe("FCT High Court profile — populated", () => {
  it("carries the real FCT caption", () => {
    expect(FCT_HIGH_COURT.headingTemplates[0]).toBe(
      "IN THE HIGH COURT OF THE FEDERAL CAPITAL TERRITORY, ABUJA"
    );
  });

  it("cites the 2025 Rules (the 2018 Rules were superseded)", () => {
    expect(FCT_HIGH_COURT.motionEnablingRule.text).toContain("Rules 2025");
    expect(FCT_HIGH_COURT.motionEnablingRule.text).not.toContain("Rules 2018");
    expect(FCT_HIGH_COURT.frontloading.rule?.text).toContain("Rules 2025");
    expect(FCT_HIGH_COURT.frontloading.required).toBe(true);
  });

  it("resolves from free-text court strings (FCT / Abuja)", () => {
    expect(resolveJurisdictionProfile("High Court of the Federal Capital Territory")).toBe(FCT_HIGH_COURT);
    expect(resolveJurisdictionProfile("FCT High Court")).toBe(FCT_HIGH_COURT);
    // 'Federal High Court' wins over the Abuja keyword (checked earlier).
    expect(resolveJurisdictionProfile("Federal High Court Abuja")).toBe(FEDERAL_HIGH_COURT);
  });
});

describe("Lagos stays populated (regression pin)", () => {
  it("the caption and the 2019 citation hold", () => {
    expect(LAGOS_HIGH_COURT.headingTemplates[0]).toBe("IN THE HIGH COURT OF LAGOS STATE");
    expect(LAGOS_HIGH_COURT.motionEnablingRule.text).toContain(
      "Order 29 of the High Court of Lagos State (Civil Procedure) Rules 2019"
    );
  });
});
