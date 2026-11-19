/**
 * LIVE-CALL suite (opt-in, excluded from CI) — owner spec 2026-11-19, §8:
 * "Mock all LLM calls in tests; add a small separate opt-in suite for live
 * calls that is excluded from CI."
 *
 * Every test here is skipped unless RUN_LIVE_DRAFTING=1 is set, so `vitest
 * run` (the CI gate) never spends tokens. Run manually with:
 *
 *   RUN_LIVE_DRAFTING=1 npx vitest run tests/unit/drafting/liveCalls.test.ts
 */

import { describe, expect, it } from "vitest";
import { buildProseFillPrompt, validateProseFill } from "../../../src/legal/drafting/assemble";
import { fillProseSlots } from "../../../src/services/geminiService";

const LIVE = !!process.env.RUN_LIVE_DRAFTING;

describe.skipIf(!LIVE)("live prose-slot filling (opt-in)", () => {
  it("fills a written-address slot from dictated facts through the real model", async () => {
    const spec = {
      key: "written_address.facts",
      label: "Brief statement of facts",
      contract: "A concise statement of facts derived from the affidavit in the same bundle.",
      maxLength: 6000,
      shape: "paragraphs" as const,
    };
    const prompt = buildProseFillPrompt({
      documentType: "written_address",
      specs: [spec],
      dictated: {
        reliefs: [],
        groundsOrFacts: [
          "The Claimant granted the Defendant a facility of ₦18,000,000.00 on 1 March 2024",
          "The facility fell due on 1 September 2024 and remains unpaid",
        ],
        amounts: [],
        periods: [],
        dates: [],
        namedPeople: [],
        specialInstructions: [],
      },
      matterNotes: [],
    });
    const fills = await fillProseSlots({ system: prompt.system, user: prompt.user });
    expect(Object.keys(fills)).toContain(spec.key);
    const validation = validateProseFill(spec, fills[spec.key], []);
    expect(validation.ok).toBe(true);
    expect(validation.text).toContain("₦18,000,000.00");
  }, 120_000);
});
