
import React, { useState, useEffect } from 'react';
import { useDataState } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';

/**
 * TrialNudgeBanner — CRO Audit Track B (B8)
 *
 * Surfaces automated, value-driven in-app milestones during the 30-day trial.
 * The backend expireTrials cron already sends Day-4 and Day-1 notifications;
 * this component adds the in-app banner layer for milestone-based nudges.
 *
 * Milestones (updated for 30-day trial):
 *   Day 0:  Welcome + first setup nudge
 *   Day 1:  First property/matter added nudge
 *   Day 3:  First rent/invoice recorded nudge
 *   Day 7:  First invoice sent nudge
 *   Day 14: Trial midpoint check-in
 *   Day 23: Trial ending soon (7 days)
 *   Day 29: Last-chance nudge (1 day)
 *   Day 30: Trial expired (handled by expireTrials cron)
 *
 * The banner is dismissible per-day (stored in localStorage with key
 * `practicepro_trial_nudge_dismissed_${day}`) so it doesn't re-fire on
 * every render but will reappear the next day if the trial is still active.
 */

const TrialNudgeBanner: React.FC = () => {
  const { appState } = useDataState();
  const { currentUser } = useAuth();
  const { navigateTo, openModal } = useUI();
  const [dismissed, setDismissed] = useState(false);

  const trialEndsAt = (appState.firmDetails as any)?.trialEndsAt;
  const trialPlan = (appState.firmDetails as any)?.trialPlan;
  const trialStartsAt = (appState.firmDetails as any)?.trialStartsAt;

  // If no active trial, render nothing.
  if (!trialEndsAt || !trialPlan || !trialStartsAt) return null;
  const now = Date.now();
  if (trialEndsAt <= now) return null;  // expired — handled by cron

  const daysElapsed = Math.floor((now - trialStartsAt) / (24 * 60 * 60 * 1000));
  const daysRemaining = Math.ceil((trialEndsAt - now) / (24 * 60 * 60 * 1000));

  // Determine the milestone message for the current day.
  const milestone = (() => {
    if (daysElapsed === 0) {
      return {
        title: `Welcome to your ${trialPlan} trial`,
        body: 'Add your first property or matter to get started. The trial gives you full access for 30 days.',
        cta: 'Get Started',
        ctaAction: () => openModal('newMatter'),
        urgency: 'info' as const,
      };
    }
    if (daysElapsed === 1) {
      return {
        title: 'Day 1 — Try recording a payment',
        body: 'Record your first rent payment or invoice to see how Atrium/Vega tracks cash flow automatically.',
        cta: 'Record Payment',
        ctaAction: () => navigateTo('finance'),
        urgency: 'info' as const,
      };
    }
    if (daysElapsed === 3) {
      return {
        title: 'Day 3 — Send your first invoice',
        body: 'Send a tenant or client invoice to unlock automated reminders and tracking.',
        cta: 'Create Invoice',
        ctaAction: () => openModal('newInvoice'),
        urgency: 'info' as const,
      };
    }
    if (daysElapsed === 7) {
      return {
        title: 'Day 7 — Try WhatsApp messaging',
        body: 'Send your first WhatsApp rent reminder or court date notification. WhatsApp messaging is included in your trial (requires integration setup).',
        cta: 'Send Message',
        ctaAction: () => navigateTo('messages'),
        urgency: 'info' as const,
      };
    }
    if (daysElapsed === 14) {
      return {
        title: 'Trial midpoint check-in',
        body: `You're halfway through your ${trialPlan} trial. Have you tried the AI assistant, automated billing, or the resident portal yet?`,
        cta: 'Explore Features',
        ctaAction: () => navigateTo('settings', null, { settingsTargetId: 'subscription-management' }),
        urgency: 'info' as const,
      };
    }
    if (daysRemaining <= 7 && daysRemaining > 1) {
      return {
        title: `Trial ends in ${daysRemaining} days`,
        body: `Your ${trialPlan} trial ends soon. Locked features after expiry: AI document generation, bulk invoicing, WhatsApp integration. Upgrade now to keep them.`,
        cta: 'Upgrade Now',
        ctaAction: () => navigateTo('settings', null, { settingsTargetId: 'subscription-management' }),
        urgency: 'warning' as const,
      };
    }
    if (daysRemaining === 1) {
      return {
        title: 'Trial ends tomorrow',
        body: `Set up bank transfer now to avoid losing ${trialPlan} features tomorrow.`,
        cta: 'Set Up Payment',
        ctaAction: () => navigateTo('settings', null, { settingsTargetId: 'subscription-management' }),
        urgency: 'critical' as const,
      };
    }
    return null;
  })();

  // Check if this day's nudge was already dismissed.
  useEffect(() => {
    if (!milestone) return;
    const dismissedKey = `practicepro_trial_nudge_dismissed_${daysElapsed}`;
    if (localStorage.getItem(dismissedKey) === '1') {
      setDismissed(true);
    } else {
      setDismissed(false);
    }
  }, [daysElapsed, milestone]);

  if (!milestone || dismissed) return null;

  const handleDismiss = () => {
    const dismissedKey = `practicepro_trial_nudge_dismissed_${daysElapsed}`;
    localStorage.setItem(dismissedKey, '1');
    setDismissed(true);
  };

  const urgencyClasses = {
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
    critical: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
  };

  const ctaButtonClasses = {
    info: 'bg-blue-600 hover:bg-blue-700 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white',
    critical: 'bg-red-600 hover:bg-red-700 text-white',
  };

  return (
    <div className={`${urgencyClasses[milestone.urgency]} border rounded-lg p-3 sm:p-4 mb-4 flex items-start gap-3 animate-fade-in`}>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-sm">{milestone.title}</h4>
        <p className="text-xs mt-1 opacity-90">{milestone.body}</p>
        <button
          onClick={milestone.ctaAction}
          className={`mt-2 px-4 py-1.5 ${ctaButtonClasses[milestone.urgency]} text-xs font-bold rounded-lg transition-all hover:-translate-y-0.5 active:scale-95`}
        >
          {milestone.cta}
        </button>
      </div>
      <button
        onClick={handleDismiss}
        className="text-current opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default TrialNudgeBanner;
