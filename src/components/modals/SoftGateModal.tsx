
import React from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatNaira } from '../../utils/formatting';
import NairaSymbol from '../NairaSymbol';

/**
 * SoftGateModal — CRO AUDIT Track C (C6)
 *
 * Surfaces an upgrade prompt when the user hits a tier limit (e.g. attempts
 * to create an 11th matter on Core, or invite a 2nd teammate). The prompt
 * names the specific value being unlocked and offers two paths:
 *   1. "Pay Now" — opens PaymentGatewayModal with bank transfer details.
 *   2. "Start 14-Day Free Trial" — creates the firm at the target tier with
 *      a 30-day trial window (via the createSubscriptionRequest flow OR
 *      direct trial activation, depending on whether the firm already exists).
 *
 * This is the contextual upgrade moment — the highest-intent moment for
 * conversion because the user has just demonstrated they want this specific
 * feature. Conversion rates at this moment are materially higher than at
 * cold onboarding.
 *
 * Usage:
 *   <SoftGateModal
 *     trigger="You've reached the 10-matter Core limit."
 *     targetPlan="Growth"
 *     monthlyPrice={45000}
 *     annualPrice={432000}
 *     onClose={() => setShowSoftGate(false)}
 *   />
 */

interface SoftGateModalProps {
  trigger: string;          // what the user tried to do, e.g. "You've reached the 10-matter Core limit."
  targetPlan: string;       // 'Growth' | 'Pro' | 'Enterprise' | 'Komplete'
  monthlyPrice: number;
  annualPrice: number;
  featureUnlocked: string;  // e.g. "unlimited matters and 5 seats"
  onClose: () => void;
  onUpgradeSuccess?: () => void;  // optional: called after user pays or starts trial
}

const SoftGateModal: React.FC<SoftGateModalProps> = ({
  trigger, targetPlan, monthlyPrice, annualPrice, featureUnlocked, onClose, onUpgradeSuccess,
}) => {
  const { openModal, closeModal } = useUI();
  const { currentUser } = useAuth();
  const [billingInterval, setBillingInterval] = React.useState<'monthly' | 'annual'>('annual');

  const price = billingInterval === 'annual' ? annualPrice : monthlyPrice;

  const handlePayNow = () => {
    closeModal();  // close this soft-gate modal
    openModal('paymentGateway', null, {
      amount: price,
      title: `Upgrade to ${targetPlan}`,
      description: `${billingInterval === 'annual' ? 'Annual' : 'Monthly'} subscription — unlock ${featureUnlocked}`,
      forcePracticeProAccount: true,
      subscriptionContext: {
        requestedPlan: targetPlan,
        billingInterval,
        firmId: currentUser?.firmId || '',
      },
      onConfirm: () => {
        onUpgradeSuccess?.();
      },
    });
  };

  // For the trial path on an EXISTING firm, we need a mutation that:
  //   1. Sets trialStartsAt/trialEndsAt/trialPlan on the existing firm.
  //   2. Leaves subscriptionPlan at Core.
  // For now, we route through the same PaymentGatewayModal flow but with
  // a note that says "trial" — the founder admin can approve the trial.
  // In a future iteration, we'll add a dedicated `startTrialForExistingFirm`
  // mutation that doesn't require founder approval for trials.

  const handleStartTrial = () => {
    closeModal();
    // For now, route trials through the same payment modal but with a note.
    // The founder admin will see the request and approve the trial.
    // TODO: add a `startTrialForExistingFirm` mutation that auto-activates
    // the trial without requiring founder approval (since trials are free).
    openModal('paymentGateway', null, {
      amount: 0,  // trial is free
      title: `Start 30-Day ${targetPlan} Trial`,
      description: `No charge for 30 days. After that, you'll need to set up payment to keep ${targetPlan} features.`,
      forcePracticeProAccount: true,
      subscriptionContext: {
        requestedPlan: targetPlan,
        billingInterval,
        firmId: currentUser?.firmId || '',
      },
      onConfirm: () => {
        onUpgradeSuccess?.();
      },
    });
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" />
            </svg>
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white">Upgrade to {targetPlan}</h3>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2">{trigger}</p>
          <p className="text-sm text-primary-600 dark:text-primary-400 font-bold mt-2">
            {targetPlan} unlocks {featureUnlocked}.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg">
          <button
            onClick={() => setBillingInterval('monthly')}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${billingInterval === 'monthly' ? 'bg-white dark:bg-zinc-700 shadow text-primary-600' : 'text-slate-400'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingInterval('annual')}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${billingInterval === 'annual' ? 'bg-white dark:bg-zinc-700 shadow text-primary-600' : 'text-slate-400'}`}
          >
            Annual <span className="text-emerald-600">Save 20%</span>
          </button>
        </div>

        {/* Price display */}
        <div className="text-center">
          <p className="text-3xl font-black text-slate-900 dark:text-white">
            <NairaSymbol />{formatNaira(price)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {billingInterval === 'annual' ? 'per year' : 'per month'}
          </p>
        </div>

        {/* CTAs */}
        <div className="space-y-2">
          <button
            onClick={handlePayNow}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-black text-xs uppercase tracking-wide-label rounded-lg shadow-lg transition-all hover:-translate-y-0.5 active:scale-95"
          >
            Pay Now — {targetPlan}
          </button>
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-slate-100 dark:bg-zinc-700" />
            <span className="text-2xs text-slate-400 font-bold uppercase">or</span>
            <div className="flex-1 h-px bg-slate-100 dark:bg-zinc-700" />
          </div>
          <button
            onClick={handleStartTrial}
            className="w-full py-3 bg-white dark:bg-zinc-800 border-2 border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 font-black text-xs uppercase tracking-wide-label rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all"
          >
            Start 14-Day Free Trial
          </button>
        </div>

        {/* Cancel */}
        <div className="text-center">
          <button onClick={onClose} className="text-sm text-slate-500 hover:underline">
            Not now
          </button>
        </div>

        {/* Disclaimer */}
        <p className="text-2xs text-center text-slate-400 leading-relaxed">
          {billingInterval === 'annual'
            ? 'Annual billing saves 20% vs monthly. Cancel anytime.'
            : 'Monthly billing. Cancel anytime. No long-term commitment.'}
        </p>
      </div>
    </div>
  );
};

export default SoftGateModal;
