/**
 * aloaAccountContext — builds the ACCOUNT / TIER / ONBOARDING context block
 * for the ALOA/ARIA system prompt (Task 64).
 *
 * WHY: the user asked ALOA for help with Getting Started and got nothing
 * useful — the system prompt had no idea which product the firm is on, what
 * plan they pay for, or which onboarding steps remain. This pure builder
 * turns the firm record + the live Getting Started checklist into a compact
 * prompt block that teaches the assistant to:
 *   (a) answer setup questions concretely,
 *   (b) offer to DO each step via its create_matter / create_contact /
 *       create_event tools,
 *   (c) never recommend features the current plan doesn't include.
 *
 * Pure by design (clock injectable) so the prompt contract is unit-testable.
 */

export interface AccountContextChecklist {
  dismissed?: boolean;
  hasPracticeProfile?: boolean;
  hasPortfolioProfile?: boolean;
  hasMatter?: boolean;
  hasContact?: boolean;
  hasBankAccount?: boolean;
  hasBillingRate?: boolean;
  hasCourtDateOnMatter?: boolean;
  hasInvitedUser?: boolean;
  skippedTeamInvite?: boolean;
}

export interface AccountContextFirm {
  product?: string | null;
  subscriptionPlan?: string | null;
  trialPlan?: string | null;
  trialEndsAt?: number | null;
}

interface StepSpec {
  label: string;
  key: string;
  how: string;
}

const STEPS: StepSpec[] = [
  { key: 'hasPracticeProfile', label: 'Pre-configure your practice', how: 'Settings → Firm Configuration → Practice Blueprint (or navigate there via navigate_to settings)' },
  { key: 'hasMatter', label: 'Create your first matter', how: 'Offer to create it NOW via the create_matter tool' },
  { key: 'hasContact', label: 'Add a client contact', how: 'Offer to create it NOW via the create_contact tool' },
  { key: 'hasBankAccount', label: 'Configure a bank account', how: 'Settings → Firm Configuration → bank accounts (Admin only); explain trust vs operating separation' },
  { key: 'hasBillingRate', label: 'Set your billing rate', how: 'Set an hourly rate when creating a matter, or Settings → Billing' },
  { key: 'hasCourtDateOnMatter', label: 'Add a court date', how: 'Open a matter → Tasks & Events → Events tab → New Event; offer to create it NOW via the create_event tool (type "Court Hearing")' },
  { key: 'hasInvitedUser', label: 'Invite a team member', how: 'Settings → User Management → invite with code' },
];

const DAY_MS = 86_400_000;

export const buildAccountContext = (
  firm: AccountContextFirm | undefined | null,
  checklist: AccountContextChecklist | undefined | null,
  opts?: { productFallback?: string | null; now?: number }
): string => {
  const f = firm || {};
  const now = opts?.now ?? Date.now();
  const plan = f.subscriptionPlan || 'Core';
  const product = f.product || opts?.productFallback || 'vega';
  const productName =
    product === 'property' || product === 'atrium'
      ? 'Atrium (property management)'
      : product === 'unified'
        ? 'Komplete (legal + property)'
        : 'Vega (legal practice)';

  const lines: string[] = [
    `PRODUCT: ${productName}`,
    `PLAN: ${plan}${f.trialPlan && f.trialEndsAt ? ` (trialing ${f.trialPlan})` : ''}`,
  ];

  if (typeof f.trialEndsAt === 'number' && now < f.trialEndsAt) {
    const daysLeft = Math.max(0, Math.ceil((f.trialEndsAt - now) / DAY_MS));
    lines.push(`TRIAL: ${daysLeft} day(s) remaining on the ${f.trialPlan || plan} trial`);
  }

  if (checklist && !checklist.dismissed) {
    const remaining = STEPS.filter(s => {
      if (s.key === 'hasInvitedUser' && checklist.skippedTeamInvite) return false;
      return (checklist as any)[s.key] !== true;
    });
    lines.push(
      `ONBOARDING: ${remaining.length === 0 ? 'Getting Started checklist is complete' : `${remaining.length} step(s) remaining on the Getting Started checklist`}`
    );
    remaining.forEach(s => lines.push(`  - ${s.label} → ${s.how}`));
    if (remaining.length > 0) {
      lines.push(
        'If the user asks for help with setup, getting started, or onboarding: walk them through the remaining steps above in order, explain the WHY briefly, and OFFER to do the step for them with your tools when possible. You may also point them to the Getting Started checklist in the sidebar.'
      );
    }
  }

  lines.push(
    `PLAN AWARENESS: before recommending a feature, remember the firm is on the ${plan} plan — if a capability (e.g. advanced automations, retainer auto-billing, premium AI) is gated above this tier, say so plainly and suggest upgrading instead of giving instructions that will not work.`
  );

  return lines.join('\n');
};
