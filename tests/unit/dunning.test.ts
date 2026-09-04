/**
 * R12 regression suite — subscription dunning stage machine.
 *
 * Locks in the lifecycle driven by convex/dunning.ts (computeDunningAction):
 * the cron (runSubscriptionDunning) must never delete data, never re-send a
 * stage it already sent, never touch firms it doesn't own (no billing date /
 * active trials), and must soft-downgrade exactly at grace exhaustion.
 */
import { describe, it, expect } from "vitest";
import { computeDunningAction, GRACE_PERIOD_DAYS } from "../../convex/dunning";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-09-05T00:00:00.000Z");

// Renewal date 30 days out — a healthy, freshly-activated firm.
const baseFirm = {
  subscriptionPlan: "Pro",
  adminStatus: "active",
  trialPlan: null,
  dunningStage: null,
  pastDueAt: null,
  nextBillingDate: new Date(NOW + 30 * DAY).toISOString(),
};

describe("computeDunningAction — guards (firms the cron must NOT touch)", () => {
  it("ignores firms with no nextBillingDate (never activated through payment lifecycle)", () => {
    expect(computeDunningAction({ ...baseFirm, nextBillingDate: null }, NOW).kind).toBe("none");
  });

  it("ignores firms on active trials (expireTrials owns that lifecycle)", () => {
    const trial = {
      ...baseFirm,
      trialPlan: "Pro",
      nextBillingDate: new Date(NOW - 5 * DAY).toISOString(), // stale date on a trial — still not ours
    };
    expect(computeDunningAction(trial, NOW).kind).toBe("none");
  });

  it("ignores malformed nextBillingDate rather than acting on garbage", () => {
    expect(computeDunningAction({ ...baseFirm, nextBillingDate: "not-a-date" }, NOW).kind).toBe("none");
  });

  it("terminal 'downgraded' stage — the lifecycle is over until payment resets it", () => {
    const downgraded = {
      ...baseFirm,
      dunningStage: "downgraded" as const,
      nextBillingDate: new Date(NOW - 40 * DAY).toISOString(),
    };
    expect(computeDunningAction(downgraded, NOW).kind).toBe("none");
  });

  it("healthy firm mid-cycle (30 days to renewal) — nothing to do", () => {
    expect(computeDunningAction(baseFirm, NOW).kind).toBe("none");
  });
});

describe("computeDunningAction — pre-expiry reminders", () => {
  it("7 days out (inclusive) → pre7", () => {
    const firm = { ...baseFirm, nextBillingDate: new Date(NOW + 7 * DAY).toISOString() };
    const action = computeDunningAction(firm, NOW);
    expect(action.kind).toBe("notify");
    if (action.kind === "notify") {
      expect(action.stage).toBe("pre7");
      expect(action.patch.dunningStage).toBe("pre7");
    }
  });

  it("8 days out → still quiet (scan horizon matches: only ≤7 days warn)", () => {
    const firm = { ...baseFirm, nextBillingDate: new Date(NOW + 8 * DAY).toISOString() };
    expect(computeDunningAction(firm, NOW).kind).toBe("none");
  });

  it("already sent pre7 → no re-send on the next daily run", () => {
    const firm = {
      ...baseFirm,
      dunningStage: "pre7",
      nextBillingDate: new Date(NOW + 6 * DAY).toISOString(),
    };
    expect(computeDunningAction(firm, NOW).kind).toBe("none");
  });

  it("1 day out → pre1", () => {
    const firm = { ...baseFirm, nextBillingDate: new Date(NOW + 1 * DAY).toISOString() };
    const action = computeDunningAction(firm, NOW);
    expect(action.kind).toBe("notify");
    if (action.kind === "notify") expect(action.stage).toBe("pre1");
  });

  it("pre7 sent, now 1 day out → advances to pre1", () => {
    const firm = {
      ...baseFirm,
      dunningStage: "pre7",
      nextBillingDate: new Date(NOW + 1 * DAY).toISOString(),
    };
    const action = computeDunningAction(firm, NOW);
    expect(action.kind).toBe("notify");
    if (action.kind === "notify") expect(action.stage).toBe("pre1");
  });
});

describe("computeDunningAction — past due + grace ladder", () => {
  const pastDue = { ...baseFirm, nextBillingDate: new Date(NOW - 1 * DAY).toISOString() };

  it("renewal date just passed → past_due + adminStatus marker + pastDueAt", () => {
    const action = computeDunningAction(pastDue, NOW);
    expect(action.kind).toBe("notify");
    if (action.kind === "notify") {
      expect(action.stage).toBe("past_due");
      expect(action.patch.adminStatus).toBe("past_due");
      expect(action.patch.pastDueAt).toBe(NOW);
    }
  });

  it("day 3 of grace (past_due sent) → quiet", () => {
    const firm = { ...baseFirm, dunningStage: "past_due", pastDueAt: NOW - 3 * DAY, nextBillingDate: new Date(NOW - 3 * DAY).toISOString() };
    expect(computeDunningAction(firm, NOW).kind).toBe("none");
  });

  it("day 7 of grace → grace7 reminder", () => {
    // The grace clock runs from the RENEWAL date (nextBillingDate), 7 days ago.
    const firm = { ...baseFirm, dunningStage: "past_due", pastDueAt: NOW - 7 * DAY, nextBillingDate: new Date(NOW - 7 * DAY).toISOString() };
    const action = computeDunningAction(firm, NOW);
    expect(action.kind).toBe("notify");
    if (action.kind === "notify") expect(action.stage).toBe("grace7");
  });

  it("day 13 of grace → final warning (grace closes tomorrow)", () => {
    const firm = { ...baseFirm, dunningStage: "grace7", pastDueAt: NOW - 13 * DAY, nextBillingDate: new Date(NOW - 13 * DAY).toISOString() };
    const action = computeDunningAction(firm, NOW);
    expect(action.kind).toBe("notify");
    if (action.kind === "notify") expect(action.stage).toBe("final");
  });

  it("custom grace window is respected (7-day grace downgrades on day 7, not 14)", () => {
    const firm = { ...baseFirm, dunningStage: "final", nextBillingDate: new Date(NOW - 7 * DAY).toISOString() };
    const action = computeDunningAction(firm, NOW, 7);
    expect(action.kind).toBe("downgrade");
  });
});

describe("computeDunningAction — soft downgrade (the revenue-critical invariant)", () => {
  const expired = { ...baseFirm, nextBillingDate: new Date(NOW - GRACE_PERIOD_DAYS * DAY).toISOString() };

  it("grace exhausted → downgrade to Core with the from-plan recorded", () => {
    const action = computeDunningAction(expired, NOW);
    expect(action.kind).toBe("downgrade");
    if (action.kind === "downgrade") {
      expect(action.patch.subscriptionPlan).toBe("Core");
      expect(action.patch.downgradedFromPlan).toBe("Pro");
      expect(action.patch.dunningStage).toBe("downgraded");
      expect(action.patch.downgradedAt).toBe(NOW);
      expect(action.patch.nextBillingDate).toBeNull(); // lifecycle ends — rests on Core
    }
  });

  it("downgrade NEVER appears before grace exhaustion (day 13 is still a warning)", () => {
    const firm = {
      ...baseFirm,
      nextBillingDate: new Date(NOW - (GRACE_PERIOD_DAYS - 1) * DAY).toISOString(),
      dunningStage: "grace7",
    };
    expect(computeDunningAction(firm, NOW).kind).toBe("notify");
  });

  it("renewal (nextBillingDate moved to the future) without a stage reset → no duplicate notices", () => {
    // activateFirmSubscription resets the stage; this guards the path where
    // an admin manually pushed the date forward and the stage lingered.
    const firm = {
      ...baseFirm,
      dunningStage: "pre1",
      nextBillingDate: new Date(NOW + 30 * DAY).toISOString(),
    };
    expect(computeDunningAction(firm, NOW).kind).toBe("none");
  });

  it("a firm that re-entered past-due after a reset re-runs the ladder from the top", () => {
    const firm = {
      ...baseFirm,
      dunningStage: null, // reset by activateFirmSubscription on payment
      nextBillingDate: new Date(NOW - 2 * DAY).toISOString(),
    };
    const action = computeDunningAction(firm, NOW);
    expect(action.kind).toBe("notify");
    if (action.kind === "notify") expect(action.stage).toBe("past_due");
  });
});
