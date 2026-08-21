import React, { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { useProduct } from '../contexts/ProductContext';
import { CheckCircleIcon, ChevronDownIcon, XIcon } from '../constants';
import { ChevronUp as ChevronUpIcon } from 'lucide-react';

/**
 * GettingStartedChecklist — persistent sidebar widget shown after the Setup
 * Wizard completes. Each item links to the relevant page/modal so the user
 * can complete it in any order. Auto-completes when the action is done
 * (detected via the getGettingStartedChecklist Convex query).
 *
 * Design reference: /home/z/my-project/download/SETUP_WIZARD_DESIGN.md
 * (Phase 2: Getting Started Checklist).
 *
 * The component is dismissible — once dismissed (or once ALL items are
 * complete) it disappears. Dismissal is persisted in localStorage keyed by
 * firmId so it doesn't reappear for that firm.
 *
 * Reset affordance: Settings → Help exposes a "Reset Setup Checklist"
 * button that clears BOTH localStorage keys (sidebar + banner) per-firm so
 * users who dismissed the checklist can bring it back.
 */

// Storage key constants — shared with CompleteSetupBanner.tsx so both
// dismissals can be reset together from Settings → Help.
export const CHECKLIST_DISMISSED_KEY_PREFIX = 'practicepro_checklist_dismissed_';
export const BANNER_DISMISSED_KEY_PREFIX = 'practicepro_setup_banner_dismissed_';

interface ChecklistItem {
  /** Key matches the boolean field returned by getGettingStartedChecklist. */
  key: string;
  label: string;
  /** View to navigate to, OR a modalType to open. */
  action: { kind: 'view'; view: string } | { kind: 'modal'; modalType: string };
  /** Optional short hint shown under the label. */
  hint?: string;
}

const VEGA_ITEMS: ChecklistItem[] = [
  { key: 'hasMatter',        label: 'Create your first matter',  action: { kind: 'modal', modalType: 'newMatter' },     hint: 'A matter is any case or engagement.' },
  { key: 'hasContact',       label: 'Add a client contact',      action: { kind: 'modal', modalType: 'newContact' },    hint: 'Clients you can bill and message.' },
  { key: 'hasBankAccount',   label: 'Configure a bank account',  action: { kind: 'modal', modalType: 'newBankAccount' }, hint: 'For trust and operating accounts.' },
  { key: 'hasBillingRate',   label: 'Set your billing rate',     action: { kind: 'view',  view: 'billing' },            hint: 'Hourly, fixed fee, or retainer.' },
  { key: 'hasCourtDateOnMatter', label: 'Add a court date',     action: { kind: 'view',  view: 'matters' },            hint: 'So you get reminders before hearings.' },
  { key: 'hasInvitedUser',   label: 'Invite a team member',      action: { kind: 'view',  view: 'settings' },            hint: 'Lawyers, paralegals, accountants.' },
];

const ATRIUM_ITEMS: ChecklistItem[] = [
  { key: 'hasProperty',              label: 'Add your first property',     action: { kind: 'modal', modalType: 'newProperty' },    hint: 'Residential, commercial, or estate.' },
  { key: 'hasTenantOnProperty',      label: 'Add a resident to a unit',    action: { kind: 'view',  view: 'properties' },           hint: 'So you can collect rent.' },
  { key: 'hasServiceCharge',         label: 'Set up service charges',      action: { kind: 'view',  view: 'properties' },           hint: 'Diesel, security, cleaning, etc.' },
  { key: 'hasBankAccount',           label: 'Configure bank account',       action: { kind: 'modal', modalType: 'newBankAccount' }, hint: 'For rent collections.' },
  { key: 'hasInvitedResidentToPortal', label: 'Invite a resident to portal', action: { kind: 'view', view: 'settings' },           hint: 'Residents self-serve rent payments.' },
  { key: 'hasSentReminder',         label: 'Send your first rent reminder', action: { kind: 'view', view: 'messaging' },          hint: 'WhatsApp or email nudge to a defaulter.' },
];

const KOMPLETE_ITEMS: ChecklistItem[] = [
  // Vega side first, then Atrium side — matches the wizard order
  ...VEGA_ITEMS,
  ...ATRIUM_ITEMS.filter(item => !VEGA_ITEMS.some(v => v.key === item.key)),
];

const GettingStartedChecklist: React.FC = () => {
  const { currentUser } = useAuth();
  const { navigateTo, openModal, addToast, setHighlightTarget } = useUI();
  const { isProperty, isUnified } = useProduct();
  const firmId = (currentUser as any)?.firmId || '';

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Load dismissal state from localStorage on mount.
  useEffect(() => {
    if (!firmId) return;
    try {
      const stored = localStorage.getItem(`${CHECKLIST_DISMISSED_KEY_PREFIX}${firmId}`);
      if (stored === 'true') setIsDismissed(true);
    } catch {
      // localStorage may be blocked — non-fatal, just don't persist dismissal.
    }
  }, [firmId]);

  const checklist = useQuery(
    api.myFunctions.getGettingStartedChecklist,
    firmId ? { firmId } : 'skip'
  );

  // Auto-dismiss once ALL items are complete — no point showing an empty list.
  useEffect(() => {
    if (!checklist || isDismissed) return;
    const items = isUnified ? KOMPLETE_ITEMS : isProperty ? ATRIUM_ITEMS : VEGA_ITEMS;
    const allDone = items.every(item => (checklist as any)[item.key] === true);
    if (allDone) {
      setIsDismissed(true);
      try {
        localStorage.setItem(`${CHECKLIST_DISMISSED_KEY_PREFIX}${firmId}`, 'true');
      } catch {}
    }
  }, [checklist, isDismissed, isProperty, isUnified, firmId]);

  // Don't render until checklist data is loaded — avoids a flash of empty items.
  if (!firmId || !checklist || isDismissed) return null;

  const items = isUnified ? KOMPLETE_ITEMS : isProperty ? ATRIUM_ITEMS : VEGA_ITEMS;
  const doneCount = items.filter(item => (checklist as any)[item.key] === true).length;
  const totalCount = items.length;
  const progressPct = Math.round((doneCount / totalCount) * 100);

  const handleItemClick = (item: ChecklistItem) => {
    if ((checklist as any)[item.key] === true) return; // already done — no-op

    // BRIEF #1b: Prerequisite Interception
    // If the user clicks "Add a resident to a unit" but no properties exist yet,
    // intercept with a prompt to create a property first. This prevents the
    // frustrating experience of landing on the properties page with no properties
    // to add a resident to.
    if (item.key === 'hasTenantOnProperty' && !(checklist as any).hasProperty) {
      addToast?.('No properties found — add your first property before assigning residents.', {
        type: 'info',
        duration: 6000,
        link: { text: 'Create Property', onClick: () => openModal('newProperty' as any) },
      });
      return;
    }

    // Also intercept "Set up service charges" if no properties exist — service
    // charges are per-property, so there's nothing to configure without a property.
    if (item.key === 'hasServiceCharge' && !(checklist as any).hasProperty) {
      addToast?.('No properties found — add a property before setting up service charges.', {
        type: 'info',
        duration: 6000,
        link: { text: 'Create Property', onClick: () => openModal('newProperty' as any) },
      });
      return;
    }

    // Also intercept "Invite a resident to portal" if no properties exist —
    // you can't invite a resident without a property/unit for them to live in.
    if (item.key === 'hasInvitedResidentToPortal' && !(checklist as any).hasProperty) {
      addToast?.('No properties found — add a property before inviting residents to the portal.', {
        type: 'info',
        duration: 6000,
        link: { text: 'Create Property', onClick: () => openModal('newProperty' as any) },
      });
      return;
    }

    if (item.action.kind === 'view') {
      // BRIEF #1a: Interactive Target Highlighting — set a highlight target
      // so the destination page can render a pulsed ring on the primary CTA.
      // The destination page uses the existing `useHighlight` hook which finds
      // elements by `data-item-id` attribute and applies a pulse animation.
      // Each target page's primary CTA has a `data-item-id` matching the key.
      setHighlightTarget({
        view: item.action.view as any,
        filter: { id: `checklist-cta-${item.key}` },
        color: 'shimmer',
      });
      navigateTo(item.action.view as any, null, { checklistAction: item.key });
    } else {
      openModal(item.action.modalType as any);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(`${CHECKLIST_DISMISSED_KEY_PREFIX}${firmId}`, 'true');
    } catch {}
  };

  const handleExpand = () => setIsCollapsed(false);

  return (
    <div className="mx-3 mb-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-primary-50 to-emerald-50 dark:from-zinc-800 dark:to-zinc-800 border-b border-slate-100 dark:border-zinc-800">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-3xs font-black">
            {doneCount}/{totalCount}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-800 dark:text-zinc-100 truncate">Getting Started</p>
            <p className="text-3xs text-slate-500 dark:text-zinc-500 font-medium truncate">
              {doneCount === totalCount ? 'All done!' : `${totalCount - doneCount} step${totalCount - doneCount === 1 ? '' : 's'} left`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => setIsCollapsed(c => !c)}
            className="p-1 rounded hover:bg-slate-200/50 dark:hover:bg-zinc-700/50 text-slate-400 dark:text-zinc-500 transition-colors"
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed
              ? <ChevronDownIcon className="w-3.5 h-3.5" />
              : <ChevronUpIcon className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 rounded hover:bg-slate-200/50 dark:hover:bg-zinc-700/50 text-slate-400 dark:text-zinc-500 transition-colors"
            aria-label="Dismiss checklist"
            title="Dismiss — I'll figure it out"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar (hidden when collapsed) */}
      {!isCollapsed && (
        <div className="h-1 bg-slate-100 dark:bg-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-emerald-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Items */}
      {!isCollapsed && (
        <ul className="py-1 max-h-[40vh] overflow-y-auto custom-scrollbar">
          {items.map((item, idx) => {
            const isDone = (checklist as any)[item.key] === true;
            return (
              <li key={`${item.key}-${idx}`}>
                <button
                  onClick={() => handleItemClick(item)}
                  disabled={isDone}
                  data-tour-id={`checklist-${item.key}`}
                  className={`
                    w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors group
                    ${isDone
                      ? 'opacity-60 cursor-default'
                      : 'hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer'}
                  `}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {isDone ? (
                      <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-zinc-600 group-hover:border-primary-400 transition-colors" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium leading-snug ${isDone ? 'text-slate-400 dark:text-zinc-500 line-through' : 'text-slate-700 dark:text-zinc-300'}`}>
                      {item.label}
                    </p>
                    {item.hint && !isDone && (
                      <p className="text-3xs text-slate-400 dark:text-zinc-500 font-normal mt-0.5 leading-snug">
                        {item.hint}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Collapsed-state "expand" hint */}
      {isCollapsed && (
        <button
          onClick={handleExpand}
          className="w-full px-3 py-2 text-3xs font-bold text-primary-600 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Show {totalCount - doneCount} remaining step{totalCount - doneCount === 1 ? '' : 's'}
        </button>
      )}
    </div>
  );
};

export default GettingStartedChecklist;
