/**
 * Task 64 — ALOA/ARIA account, tier & onboarding context.
 *
 * The bug: the user asked ALOA to help with Getting Started and got nothing
 * useful — the system prompt had no idea which product the firm runs, what
 * plan they pay for, or which setup steps remain. buildAccountContext turns
 * the firm record + live checklist into a compact prompt block.
 */
import { describe, it, expect } from 'vitest';
import { buildAccountContext } from '../../src/utils/aloaAccountContext';

const NOW = Date.UTC(2026, 8, 20, 12, 0, 0); // fixed clock: 2026-09-20

describe('buildAccountContext (Task 64 — Aloa onboarding awareness)', () => {
  it('identifies the product and plan', () => {
    const ctx = buildAccountContext(
      { product: 'vega', subscriptionPlan: 'Growth' },
      { dismissed: true },
      { now: NOW }
    );
    expect(ctx).toContain('PRODUCT: Vega (legal practice)');
    expect(ctx).toContain('PLAN: Growth');
  });

  it('maps the property product to Atrium and unified to Komplete', () => {
    expect(
      buildAccountContext({ product: 'property', subscriptionPlan: 'Core' }, null, { now: NOW })
    ).toContain('Atrium (property management)');
    expect(
      buildAccountContext({ product: 'unified', subscriptionPlan: 'Core' }, null, { now: NOW })
    ).toContain('Komplete (legal + property)');
  });

  it('falls back to Core plan and the product fallback when the firm record is thin', () => {
    const ctx = buildAccountContext({}, null, { productFallback: 'atrium', now: NOW });
    expect(ctx).toContain('PLAN: Core');
    expect(ctx).toContain('Atrium (property management)');
  });

  it('reports remaining onboarding steps with HOW guidance for each', () => {
    const ctx = buildAccountContext(
      { product: 'vega', subscriptionPlan: 'Core' },
      { hasPracticeProfile: true, hasMatter: false, hasContact: true, hasBankAccount: false },
      { now: NOW }
    );
    expect(ctx).toContain('5 step(s) remaining on the Getting Started checklist');
    expect(ctx).toContain('Create your first matter');
    expect(ctx).toContain('create_matter tool');
    expect(ctx).toContain('Add a court date');
    // Completed steps are NOT listed.
    expect(ctx).not.toContain('Pre-configure your practice →');
    // The behavioral instruction is present.
    expect(ctx).toContain('OFFER to do the step for them');
  });

  it('counts a skipped team invite as not remaining (solo practitioners)', () => {
    const ctx = buildAccountContext(
      { product: 'vega', subscriptionPlan: 'Core' },
      { skippedTeamInvite: true },
      { now: NOW }
    );
    expect(ctx).not.toContain('Invite a team member →');
  });

  it('reports a complete checklist without the walk-through instruction', () => {
    const ctx = buildAccountContext(
      { product: 'vega', subscriptionPlan: 'Core' },
      {
        hasPracticeProfile: true, hasMatter: true, hasContact: true, hasBankAccount: true,
        hasBillingRate: true, hasCourtDateOnMatter: true, hasInvitedUser: true,
      },
      { now: NOW }
    );
    expect(ctx).toContain('Getting Started checklist is complete');
    expect(ctx).not.toContain('OFFER to do the step for them');
  });

  it('omits onboarding lines entirely when the checklist is dismissed', () => {
    const ctx = buildAccountContext(
      { product: 'vega', subscriptionPlan: 'Core' },
      { dismissed: true, hasMatter: false },
      { now: NOW }
    );
    expect(ctx).not.toContain('ONBOARDING:');
  });

  it('reports trial days remaining with an injected clock', () => {
    const ctx = buildAccountContext(
      {
        product: 'vega', subscriptionPlan: 'Core',
        trialPlan: 'Pro', trialEndsAt: NOW + 3 * 86_400_000 + 1,
      },
      null,
      { now: NOW }
    );
    expect(ctx).toContain('PLAN: Core (trialing Pro)');
    expect(ctx).toContain('TRIAL: 4 day(s) remaining on the Pro trial');
  });

  it('drops the trial line once the trial window has passed', () => {
    const ctx = buildAccountContext(
      { product: 'vega', subscriptionPlan: 'Core', trialPlan: 'Pro', trialEndsAt: NOW - 1000 },
      null,
      { now: NOW }
    );
    expect(ctx).not.toContain('TRIAL:');
  });

  it('always includes the plan-awareness guardrail', () => {
    const ctx = buildAccountContext({ product: 'vega', subscriptionPlan: 'Core' }, null, { now: NOW });
    expect(ctx).toContain('PLAN AWARENESS:');
    expect(ctx).toContain('the firm is on the Core plan');
  });
});
