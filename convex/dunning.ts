/**
 * R12 — Subscription dunning + grace + soft downgrade (pure decision logic).
 *
 * PROBLEM: `activateFirmSubscription` writes `nextBillingDate` (start + 1
 * cycle) and then NOTHING ever looks at it again. A firm that stops paying
 * keeps its plan forever — no reminders, no grace, no downgrade. The SaaS
 * hardening plan (Round 12) requires a full lifecycle:
 *
 *   paid ──7d before renewal──▶ pre7 reminder
 *       ──1d before renewal──▶ pre1 reminder
 *       ──renewal date passed─▶ PAST DUE (adminStatus='past_due', grace starts)
 *       ──7d into grace──────▶ grace7 reminder
 *       ──13d into grace─────▶ final warning
 *       ──14d into grace─────▶ SOFT DOWNGRADE to Core
 *
 * The downgrade is SOFT by design: data is NEVER deleted. The firm reverts
 * to the Core plan (the same revert semantic as the trial-expiry cron) and
 * existing tier gates enforce Core limits. The firm can restore its plan at
 * any time by paying — `activateFirmSubscription` resets the whole dunning
 * state on payment.
 *
 * This module is PURE (no ctx / no db) so the R12 regression suite can lock
 * the stage machine in: tests/unit/dunning.test.ts. The mutation that drives
 * it lives in convex/myFunctions.ts (runSubscriptionDunning) next to
 * expireTrials, and the cron registration is in convex/crons.ts.
 *
 * Stage ordering — the lifecycle only ever moves FORWARD:
 *   none(0) < pre7(1) < pre1(2) < past_due(3) < grace7(4) < final(5) < downgraded(6)
 * A stage advance is idempotent: re-running the cron after a notice was sent
 * is a no-op until the next threshold is crossed. A renewal that moves
 * `nextBillingDate` into the future without resetting the stage never sends
 * duplicate notices (the rank guard holds), and `activateFirmSubscription`
 * resets the stage explicitly on confirmed payment.
 */

export type DunningStage =
  | 'pre7'
  | 'pre1'
  | 'past_due'
  | 'grace7'
  | 'final'
  | 'downgraded';

const STAGE_RANK: Record<string, number> = {
  none: 0,
  pre7: 1,
  pre1: 2,
  past_due: 3,
  grace7: 4,
  final: 5,
  downgraded: 6,
};

export const GRACE_PERIOD_DAYS = 14;

/** The subset of a firm document the dunning decision consumes. */
export interface DunningFirm {
  nextBillingDate?: string | null;   // ISO string, set by activateFirmSubscription
  dunningStage?: string | null;      // lifecycle progress marker (this module)
  pastDueAt?: number | null;         // epoch ms — when the firm entered past-due
  adminStatus?: string | null;
  subscriptionPlan?: string | null;
  trialPlan?: string | null;         // active trial — expireTrials owns that lifecycle
}

export type DunningAction =
  | { kind: 'none' }
  | {
      kind: 'notify';
      stage: Exclude<DunningStage, 'downgraded'>;
      /** Fields to patch onto the firm when the notice is recorded. */
      patch: Partial<{
        dunningStage: DunningStage;
        pastDueAt: number;
        adminStatus: string;
      }>;
    }
  | {
      kind: 'downgrade';
      patch: Partial<{
        dunningStage: DunningStage;
        adminStatus: string;
        subscriptionPlan: string;
        downgradedFromPlan: string;
        downgradedAt: number;
        nextBillingDate: null;
      }>;
    };

function rank(stage: string | null | undefined): number {
  if (!stage) return 0;
  return STAGE_RANK[stage] ?? 0;
}

/**
 * Decide what the dunning cron should do for one firm.
 *
 * @param firm  firm doc subset (see DunningFirm)
 * @param nowMs current epoch ms
 * @param graceDays grace window after the renewal date (default 14)
 */
export function computeDunningAction(
  firm: DunningFirm,
  nowMs: number,
  graceDays: number = GRACE_PERIOD_DAYS,
): DunningAction {
  // No billing date → this firm was never activated through the payment
  // lifecycle (free/Core firms, portal-adjacent records) — not ours to touch.
  if (!firm.nextBillingDate) return { kind: 'none' };

  // Active trials are owned by the expireTrials cron; nextBillingDate on a
  // trial firm is inert until the trial resolves.
  if (firm.trialPlan) return { kind: 'none' };

  // Terminal state — downgraded firms exit the lifecycle until a confirmed
  // payment resets everything via activateFirmSubscription.
  if (firm.dunningStage === 'downgraded') return { kind: 'none' };

  const DAY = 24 * 60 * 60 * 1000;
  const nextBillingMs = Date.parse(firm.nextBillingDate);
  if (Number.isNaN(nextBillingMs)) return { kind: 'none' }; // malformed date — never act on garbage

  const currentRank = rank(firm.dunningStage);
  const advance = (stage: DunningStage): boolean => STAGE_RANK[stage] > currentRank;

  // ── Renewal still in the future → pre-expiry reminders ────────────────
  if (nowMs < nextBillingMs) {
    const daysLeft = (nextBillingMs - nowMs) / DAY;
    if (daysLeft <= 1 && advance('pre1')) {
      return {
        kind: 'notify',
        stage: 'pre1',
        patch: { dunningStage: 'pre1' },
      };
    }
    if (daysLeft <= 7 && advance('pre7')) {
      return {
        kind: 'notify',
        stage: 'pre7',
        patch: { dunningStage: 'pre7' },
      };
    }
    return { kind: 'none' };
  }

  // ── Renewal date has passed → grace ladder → soft downgrade ───────────
  const graceMs = graceDays * DAY;
  const daysPastDue = (nowMs - nextBillingMs) / DAY;

  // Grace exhausted → SOFT downgrade (never data deletion).
  if (nowMs >= nextBillingMs + graceMs) {
    return {
      kind: 'downgrade',
      patch: {
        dunningStage: 'downgraded',
        adminStatus: 'active',
        subscriptionPlan: 'Core',
        downgradedFromPlan: firm.subscriptionPlan || 'Core',
        downgradedAt: nowMs,
        // Clearing the billing date ends the lifecycle: the firm rests on
        // Core until a confirmed payment re-activates a paid plan.
        nextBillingDate: null,
      },
    };
  }

  // Final warning (1 day before grace ends).
  if (daysPastDue >= graceDays - 1 && advance('final')) {
    return {
      kind: 'notify',
      stage: 'final',
      patch: { dunningStage: 'final' },
    };
  }

  // Grace midpoint.
  if (daysPastDue >= 7 && advance('grace7')) {
    return {
      kind: 'notify',
      stage: 'grace7',
      patch: { dunningStage: 'grace7' },
    };
  }

  // Just entered past-due (grace starts).
  if (advance('past_due')) {
    return {
      kind: 'notify',
      stage: 'past_due',
      patch: {
        dunningStage: 'past_due',
        pastDueAt: nowMs,
        adminStatus: 'past_due',
      },
    };
  }

  return { kind: 'none' };
}
