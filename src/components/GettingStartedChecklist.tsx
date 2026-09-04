import React, { useState, useEffect, useRef } from 'react';
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
  // PRACTICE-PROFILE ENGINE: first-class item — drives adoption of the
  // blueprint (auto-applied during onboarding, retroactive for existing
  // firms). Deep-links to Settings → Firm Configuration → Practice
  // Blueprint modal via the 'practice-blueprint' target.
  { key: 'hasPracticeProfile', label: 'Pre-configure your practice', action: { kind: 'view', view: 'settings' }, hint: 'Pick your areas of law — we set up matching matter types, contact types and checklists.' },
  { key: 'hasMatter',        label: 'Create your first matter',  action: { kind: 'modal', modalType: 'newMatter' },     hint: 'A matter is any case or engagement.' },
  { key: 'hasContact',       label: 'Add a client contact',      action: { kind: 'modal', modalType: 'newContact' },    hint: 'Clients you can bill and message.' },
  { key: 'hasBankAccount',   label: 'Configure a bank account',  action: { kind: 'modal', modalType: 'newBankAccount' }, hint: 'For trust and operating accounts.' },
  { key: 'hasBillingRate',   label: 'Set your billing rate',     action: { kind: 'view',  view: 'billing' },            hint: 'Create a matter with an hourly rate, or configure in Settings.' },
  { key: 'hasCourtDateOnMatter', label: 'Add a court date',     action: { kind: 'view',  view: 'matters' },            hint: 'Open a matter → Tasks & Events tab → New Event (Court Hearing).' },
  { key: 'hasInvitedUser',   label: 'Invite a team member',      action: { kind: 'view',  view: 'settings' },            hint: 'Lawyers, paralegals, accountants.' },
];

const ATRIUM_ITEMS: ChecklistItem[] = [
  // PRACTICE-PROFILE ENGINE: first-class item — see VEGA_ITEMS note.
  { key: 'hasPortfolioProfile', label: 'Pre-configure your portfolio', action: { kind: 'view', view: 'settings' }, hint: 'Pick your portfolio mix — we set up matching contact types, folders and checklists.' },
  { key: 'hasProperty',              label: 'Add your first property',     action: { kind: 'modal', modalType: 'newProperty' },    hint: 'Residential, commercial, or estate.' },
  { key: 'hasTenantOnProperty',      label: 'Add a resident to a unit',    action: { kind: 'view',  view: 'properties' },           hint: 'Open a property → edit a unit → enter resident name.' },
  { key: 'hasServiceCharge',         label: 'Set up service charges',      action: { kind: 'view',  view: 'properties' },           hint: 'Open a property → Units tab → edit a unit → set service charge.' },
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
  const { isProperty, isUnified, isProductResolved } = useProduct();
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

  // ROUND 15 — CELEBRATION CORRECTNESS. The user reported the "You're
  // all set!" toast firing while one checklist step was still incomplete.
  // Root cause class: the celebration effect evaluated `allDone` on EVERY
  // pass — including passes where the product flags were still in their
  // hydration window (ProductContext's rawProduct defaults to 'unified'
  // until firm/user data lands), so the WRONG item set could transiently
  // look complete. Three gates now make the celebration provably correct:
  //
  //   GATE 1 — settled flags: never evaluate while !isProductResolved.
  //   GATE 2 — genuine transition: allDone must flip false → true
  //            (tracked in allDoneConfirmedRef), not merely be true.
  //   GATE 3 — stability: after the transition, re-verify against the
  //            LATEST checklist + item set 1s later before toasting,
  //            auto-dismissing, or persisting the dismissal to
  //            localStorage. A flicker that reverts cancels everything.
  //
  // SKIPPED-STATE (unchanged): 'hasInvitedUser' counts as done when the
  // admin chose "Just me for now" (skippedTeamInvite) so solo
  // practitioners can legitimately reach 100%.
  const isItemDone = (cl: any, item: ChecklistItem): boolean => {
    if (cl[item.key] === true) return true;
    if (item.key === 'hasInvitedUser' && cl.skippedTeamInvite === true) return true;
    return false;
  };

  const allDoneConfirmedRef = useRef(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest evaluation snapshot — updated every relevant render so the
  // delayed confirmation re-verifies against CURRENT data, not the
  // closure captured when the timer was armed.
  const latestEvalRef = useRef<{ checklist: any; items: ChecklistItem[] } | null>(null);

  useEffect(() => {
    if (!checklist || isDismissed) return;
    // GATE 1: flags must be settled — the hydration-default window can
    // briefly evaluate the wrong (KOMPLETE) item set for VEGA/ATRIUM firms.
    if (!isProductResolved) return;

    const items = isUnified ? KOMPLETE_ITEMS : isProperty ? ATRIUM_ITEMS : VEGA_ITEMS;
    latestEvalRef.current = { checklist, items };
    const allDone = items.every(item => isItemDone(checklist, item));

    if (allDone) {
      // GATE 2 + GATE 3: arm a delayed confirmation the FIRST time we see
      // all-done; the toast/dismiss/persist only happens after it holds.
      if (!allDoneConfirmedRef.current && confirmTimerRef.current === null) {
        confirmTimerRef.current = setTimeout(() => {
          confirmTimerRef.current = null;
          // Re-verify with the LATEST snapshot — a transient flicker that
          // reverted (or new data marking an item incomplete again)
          // cancels the celebration entirely and re-arms the transition.
          const snap = latestEvalRef.current;
          if (!snap) return;
          if (!snap.items.every(item => isItemDone(snap.checklist, item))) return;
          allDoneConfirmedRef.current = true;
          // PHASE 1 FIX: Show celebration before auto-dismissing.
          addToast?.('🎉 You\'re all set! You\'ve completed the Getting Started checklist. Explore the rest of PracticePro at your own pace.', { type: 'success', duration: 8000 });
          setIsDismissed(true);
          try {
            localStorage.setItem(`${CHECKLIST_DISMISSED_KEY_PREFIX}${firmId}`, 'true');
          } catch {}
        }, 1000);
      }
    } else {
      // Not all done — reset the transition state and cancel any pending
      // confirmation (the flicker-revert case).
      allDoneConfirmedRef.current = false;
      if (confirmTimerRef.current !== null) {
        clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = null;
      }
    }
  }, [checklist, isDismissed, isProperty, isUnified, isProductResolved, firmId, addToast]);

  // Cancel a pending confirmation if the component unmounts mid-delay.
  useEffect(() => () => {
    if (confirmTimerRef.current !== null) {
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
  }, []);

  // BRIEF #7: Completion celebration toast — when an item transitions from
  // incomplete → complete, show a brief success toast acknowledging the
  // progress. This gives the user immediate feedback that their action was
  // registered and the checklist updated reactively.
  //
  // ROUND 15: gated on isProductResolved — during the hydration window the
  // provisional 'unified' default evaluates KOMPLETE_ITEMS, and flag flips
  // would otherwise re-run this effect against the wrong item set.
  const prevChecklistRef = useRef(checklist);
  useEffect(() => {
    if (!prevChecklistRef.current || !checklist || !isProductResolved) {
      prevChecklistRef.current = checklist;
      return;
    }
    const prev = prevChecklistRef.current;
    const currentItems = isUnified ? KOMPLETE_ITEMS : isProperty ? ATRIUM_ITEMS : VEGA_ITEMS;
    for (const item of currentItems) {
      const wasDone = (prev as any)[item.key] === true;
      const isDone = (checklist as any)[item.key] === true;
      if (!wasDone && isDone) {
        addToast?.(`✓ ${item.label} — complete!`, { type: 'success', duration: 4000 });
      }
    }
    prevChecklistRef.current = checklist;
  }, [checklist, isProperty, isUnified, isProductResolved, addToast]);

  // Don't render until checklist data is loaded AND product flags are
  // settled — avoids a flash of empty items AND a flash of WRONG items
  // (the hydration window's provisional 'unified' default would briefly
  // render KOMPLETE items on a VEGA/ATRIUM sidebar).
  if (!firmId || !checklist || isDismissed || !isProductResolved) return null;

  const items = isUnified ? KOMPLETE_ITEMS : isProperty ? ATRIUM_ITEMS : VEGA_ITEMS;
  // SKIPPED-STATE: 'skipped' counts toward progress so solo practitioners
  // can reach 100% without being blocked by a deliberate opt-out.
  const doneCount = items.filter(item => isItemDone(checklist, item)).length;
  const totalCount = items.length;
  const progressPct = Math.round((doneCount / totalCount) * 100);

  const handleItemClick = (item: ChecklistItem) => {
    if ((checklist as any)[item.key] === true) return; // already done — no-op

    // PRACTICE-PROFILE ENGINE: deep-link to Settings → Firm Configuration
    // with the Practice Blueprint modal auto-opened.
    if (item.key === 'hasPracticeProfile' || item.key === 'hasPortfolioProfile') {
      setHighlightTarget({
        view: 'settings' as any,
        filter: { id: 'checklist-cta-blueprint' },
        color: 'shimmer',
      });
      navigateTo('settings' as any, null, {
        settingsTargetId: 'practice-blueprint',
        checklistAction: item.key,
      });
      return;
    }

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

    // BRIEF #2: Intercept "Add a court date" if no matters exist yet —
    // you can't add a court date without a matter to attach it to.
    if (item.key === 'hasCourtDateOnMatter' && !(checklist as any).hasMatter) {
      addToast?.('No matters found — create your first matter before adding a court date.', {
        type: 'info',
        duration: 6000,
        link: { text: 'Create Matter', onClick: () => openModal('newMatter' as any) },
      });
      return;
    }

    if (item.action.kind === 'view') {
      // PHASE 1 ONBOARDING FIX: Each checklist item now deep-links to the right
      // page AND passes the right tab/context so the user lands exactly where
      // they need to take action. Previously items navigated to bare list pages
      // with no guidance.

      // "Add a court date" → deep-link to first matter's detail with Tasks & Events tab
      if (item.key === 'hasCourtDateOnMatter' && (checklist as any).firstMatterId) {
        setHighlightTarget({
          view: 'matterDetail' as any,
          filter: { id: 'checklist-cta-hasCourtDateOnMatter' },
          color: 'shimmer',
        });
        navigateTo('matterDetail' as any, (checklist as any).firstMatterId, {
          initialTab: 'schedule_tasks',
          initialSubView: 'events',
          checklistAction: item.key,
        });
        return;
      }

      // "Add a resident to a unit" → deep-link to first property's Units tab
      if (item.key === 'hasTenantOnProperty' && (checklist as any).firstPropertyId) {
        setHighlightTarget({
          view: 'propertyDetail' as any,
          filter: { id: 'checklist-cta-hasTenantOnProperty' },
          color: 'shimmer',
        });
        navigateTo('propertyDetail' as any, (checklist as any).firstPropertyId, {
          tab: 'units',
          checklistAction: item.key,
        });
        return;
      }

      // "Set up service charges" → deep-link to first property's Units tab
      if (item.key === 'hasServiceCharge' && (checklist as any).firstPropertyId) {
        setHighlightTarget({
          view: 'propertyDetail' as any,
          filter: { id: 'checklist-cta-hasServiceCharge' },
          color: 'shimmer',
        });
        navigateTo('propertyDetail' as any, (checklist as any).firstPropertyId, {
          tab: 'units',
          checklistAction: item.key,
        });
        return;
      }

      // "Invite a team member" → deep-link to Settings → User Management
      if (item.key === 'hasInvitedUser') {
        navigateTo('settings' as any, null, {
          settingsTargetId: 'user-management',
          checklistAction: item.key,
        });
        return;
      }

      // "Invite a resident to portal" → deep-link to Settings → Portal Access
      if (item.key === 'hasInvitedResidentToPortal') {
        navigateTo('settings' as any, null, {
          settingsTargetId: 'portal-access',
          checklistAction: item.key,
        });
        return;
      }

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
    <div className="mx-3 mb-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
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
            // SKIPPED-STATE: 'hasInvitedUser' can be skipped if the admin chose
            // "Just me for now" in the wizard. Render with a distinct visual
            // (dashed circle instead of empty, "Skipped" label) so solo
            // practitioners see this is a deliberate opt-out, not an
            // incomplete task they need to revisit.
            const isSkipped = item.key === 'hasInvitedUser' && (checklist as any).skippedTeamInvite === true && !isDone;
            return (
              <li key={`${item.key}-${idx}`}>
                <button
                  onClick={() => handleItemClick(item)}
                  disabled={isDone || isSkipped}
                  data-tour-id={`checklist-${item.key}`}
                  className={`
                    w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors group
                    ${isDone
                      ? 'opacity-60 cursor-default'
                      : isSkipped
                        ? 'opacity-50 cursor-default'
                        : 'hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer'}
                  `}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {isDone ? (
                      <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                    ) : isSkipped ? (
                      // Dashed circle = skipped (deliberate opt-out)
                      <div className="w-4 h-4 rounded-full border-2 border-dashed border-slate-300 dark:border-zinc-600 flex items-center justify-center">
                        <span className="text-3xs text-slate-400 dark:text-zinc-500 font-bold leading-none">—</span>
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-zinc-600 group-hover:border-primary-400 transition-colors" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium leading-snug ${isDone ? 'text-slate-400 dark:text-zinc-500 line-through' : isSkipped ? 'text-slate-400 dark:text-zinc-500' : 'text-slate-700 dark:text-zinc-300'}`}>
                      {item.label}
                      {isSkipped && <span className="ml-1.5 text-3xs text-slate-400 dark:text-zinc-500 font-normal italic">(skipped)</span>}
                    </p>
                    {item.hint && !isDone && !isSkipped && (
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
