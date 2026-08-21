import React, { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { useProduct } from '../contexts/ProductContext';
import { XIcon } from '../constants';

/**
 * CompleteSetupBanner — top-of-Dashboard banner that nudges the user to finish
 * their onboarding checklist. Renders ONLY when:
 *   (a) the firm has at least one incomplete checklist item, AND
 *   (b) the user has not dismissed it (persisted in localStorage per firm).
 *
 * This is the in-content sibling of the GettingStartedChecklist sidebar
 * widget — the sidebar card is always-visible (until all done), while this
 * banner is a louder, dismissable CTA that catches attention on first load
 * of the Dashboard.
 *
 * Clicking the banner opens the first incomplete item's action (modal or view),
 * matching the sidebar widget's behavior.
 *
 * Reset affordance: Settings → Help exposes a "Reset Setup Checklist"
 * button that clears BOTH localStorage keys (sidebar + banner) per-firm.
 */

// Shared with GettingStartedChecklist.tsx — import from there so the reset
// affordance in HelpSettings only needs to import one constant source.
import { BANNER_DISMISSED_KEY_PREFIX } from './GettingStartedChecklist';

// Mirror of the item configs in GettingStartedChecklist — kept here so the
// banner doesn't need to import the sidebar component (avoids circular refs).
const VEGA_ITEMS = [
  { key: 'hasMatter',        label: 'Create your first matter',  action: { kind: 'modal', modalType: 'newMatter' } },
  { key: 'hasContact',       label: 'Add a client contact',      action: { kind: 'modal', modalType: 'newContact' } },
  { key: 'hasBankAccount',   label: 'Configure a bank account',  action: { kind: 'modal', modalType: 'newBankAccount' } },
  { key: 'hasBillingRate',   label: 'Set your billing rate',     action: { kind: 'view', view: 'billing' } },
  { key: 'hasCourtDateOnMatter', label: 'Add a court date',     action: { kind: 'view', view: 'matters' } },
  { key: 'hasInvitedUser',   label: 'Invite a team member',      action: { kind: 'view', view: 'settings' } },
] as const;

const ATRIUM_ITEMS = [
  { key: 'hasProperty',              label: 'Add your first property',     action: { kind: 'modal', modalType: 'newProperty' } },
  { key: 'hasTenantOnProperty',      label: 'Add a resident to a unit',    action: { kind: 'view', view: 'properties' } },
  { key: 'hasServiceCharge',         label: 'Set up service charges',      action: { kind: 'view', view: 'properties' } },
  { key: 'hasBankAccount',           label: 'Configure bank account',      action: { kind: 'modal', modalType: 'newBankAccount' } },
  { key: 'hasInvitedResidentToPortal', label: 'Invite a resident to portal', action: { kind: 'view', view: 'settings' } },
  { key: 'hasSentReminder',         label: 'Send your first rent reminder', action: { kind: 'view', view: 'messaging' } },
] as const;

const KOMPLETE_ITEMS = [...VEGA_ITEMS, ...ATRIUM_ITEMS.filter(a => !VEGA_ITEMS.some(v => v.key === a.key))];

const CompleteSetupBanner: React.FC = () => {
  const { currentUser } = useAuth();
  const { navigateTo, openModal, addToast } = useUI();
  const { isProperty, isUnified } = useProduct();
  const firmId = (currentUser as any)?.firmId || '';
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!firmId) return;
    try {
      const stored = localStorage.getItem(`${BANNER_DISMISSED_KEY_PREFIX}${firmId}`);
      if (stored === 'true') setIsDismissed(true);
    } catch {}
  }, [firmId]);

  const checklist = useQuery(
    api.myFunctions.getGettingStartedChecklist,
    firmId ? { firmId } : 'skip'
  );

  if (!firmId || !checklist || isDismissed) return null;

  const items = isUnified ? KOMPLETE_ITEMS : isProperty ? ATRIUM_ITEMS : VEGA_ITEMS;
  const incompleteItems = items.filter(item => (checklist as any)[item.key] !== true);
  const doneCount = items.length - incompleteItems.length;
  const totalCount = items.length;
  const progressPct = Math.round((doneCount / totalCount) * 100);

  // If everything is done, no banner needed.
  if (incompleteItems.length === 0) return null;

  const nextItem = incompleteItems[0];
  const handleCTA = () => {
    // BRIEF #1b: Prerequisite Interception — same logic as GettingStartedChecklist.
    // If the next incomplete item requires a property but none exists, prompt
    // the user to create a property first instead of navigating to an empty page.
    const requiresProperty = ['hasTenantOnProperty', 'hasServiceCharge', 'hasInvitedResidentToPortal'];
    if (requiresProperty.includes(nextItem.key) && !(checklist as any).hasProperty) {
      addToast('No properties found — add your first property to continue setup.', {
        type: 'info',
        duration: 6000,
        link: { text: 'Create Property', onClick: () => openModal('newProperty' as any) },
      });
      return;
    }

    if (nextItem.action.kind === 'view') {
      navigateTo(nextItem.action.view as any, null);
    } else {
      openModal(nextItem.action.modalType as any);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(`${BANNER_DISMISSED_KEY_PREFIX}${firmId}`, 'true');
    } catch {}
  };

  return (
    <div className="relative rounded-2xl bg-gradient-to-r from-primary-600 to-emerald-500 text-white shadow-lg shadow-primary-600/20 overflow-hidden">
      {/* Decorative check-circle pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/20" />
        <div className="absolute right-12 bottom-2 w-16 h-16 rounded-full bg-white/10" />
      </div>

      <div className="relative px-4 sm:px-6 py-4 flex items-center gap-4 flex-wrap">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
          <span className="text-sm font-black">{doneCount}/{totalCount}</span>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm sm:text-base font-bold tracking-tight">
            {progressPct >= 50
              ? 'Almost there — finish setting up your workspace'
              : 'Welcome to PracticePro — let\'s finish your setup'}
          </h3>
          <p className="text-2xs sm:text-xs font-medium text-white/80 mt-0.5 truncate">
            Next: <span className="font-bold text-white">{nextItem.label}</span>
            <span className="hidden sm:inline"> · {incompleteItems.length} step{incompleteItems.length === 1 ? '' : 's'} remaining</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCTA}
            className="px-4 py-2 bg-white text-primary-700 text-xs font-black uppercase tracking-widest rounded-lg shadow-sm hover:bg-white/90 transition-colors"
          >
            Continue Setup
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            title="Dismiss"
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar at the bottom of the banner */}
      <div className="h-1 bg-white/20">
        <div
          className="h-full bg-white transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
};

export default CompleteSetupBanner;
