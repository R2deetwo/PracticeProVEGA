/**
 * bannerCoalescing — ONE attention slot for the Dashboard's onboarding
 * banners (2026-11-25, Antigravity audit response: "Banner Fatigue —
 * BroadcastBanner, CompleteSetupBanner, TrialNudgeBanner and
 * FirstRunWelcome can stack vertically, pushing operational widgets below
 * the fold").
 *
 * The zero-records case was already coalesced by the SIMPLIFY FIX (welcome
 * banner only; setup/trial suppressed while records are zero). What stacked
 * was the WITH-records case: CompleteSetupBanner + TrialNudgeBanner render
 * together whenever the checklist was dismissed. This module gives them a
 * single attention slot with a deterministic winner:
 *
 *   setup > trial — finishing onboarding is the activation driver; the
 *   trial nudge returns on its next milestone day (Days 1, 3, 5, 7, 10, 13)
 *   once setup completes or the setup banner is dismissed.
 *
 * Deliberately OUT of the slot (they are not duplicates of anything):
 *   - TierAccessBanner (downgraded-plan state — account-level, must stay);
 *   - BroadcastBanner (founder comms — content lane, never suppressed);
 *   - FirstRunWelcome (zero-records only, already exclusive by the
 *     SIMPLIFY FIX + 50% progress suppression).
 *
 * PURE module — the Dashboard wires the flags, tests pin the grammar.
 */

export type AttentionBannerSlot = 'setup' | 'trial' | null;

export function pickAttentionBanner(visible: {
  setup: boolean;
  trial: boolean;
}): AttentionBannerSlot {
  if (visible.setup) return 'setup';
  if (visible.trial) return 'trial';
  return null;
}
