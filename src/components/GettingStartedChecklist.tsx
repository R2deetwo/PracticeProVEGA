import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { useProduct } from '../contexts/ProductContext';
import { CheckCircleIcon, ChevronDownIcon, XIcon, InfoIcon, ChevronRightIcon, LightbulbIcon } from '../constants';
import { ChevronUp as ChevronUpIcon } from 'lucide-react';

/**
 * GettingStartedChecklist — persistent sidebar widget shown after the Setup
 * Wizard completes. Each item links to the relevant page/modal so the user
 * can complete it in any order. Auto-completes when the action is done
 * (detected via the getGettingStartedChecklist Convex query).
 *
 * Design reference: docs/archive/specs/SETUP_WIZARD_DESIGN.md
 * (Phase 2: Getting Started Checklist).
 *
 * The component is dismissible — once dismissed (or once ALL items are
 * complete) it disappears. Dismissal is persisted in localStorage keyed by
 * firmId so it doesn't reappear for that firm, AND durably on the firm
 * record (firms.checklistDismissedAt) so it survives reinstalls/devices.
 *
 * Reset affordance: Settings → Help exposes a "Reset Setup Checklist"
 * button that clears the localStorage keys (sidebar + banner + why-floater)
 * per-firm AND the durable server-side dismissal.
 *
 * WHY FLOATER (user feedback, post-Task 64): the "why" guidance is NOT
 * rendered inline in the sidebar — neither the old text-3xs hints nor the
 * Task 64 "Why do this?" expander (both illegibly small at 8px). Instead,
 * each incomplete row has a ⓘ button that opens a dismissible floater: a
 * readable, portal-mounted card fixed to the bottom-right (above the Aloa
 * FAB, below toasts). It auto-opens ONCE per firm for the first incomplete
 * step, then strictly on demand. Dismiss via X, Escape, or starting the
 * step. The Task 64 "why" copy (richer, product-informed) is preserved in
 * the floater; the inline WhyDetail component is deleted.
 */

// Storage key constants — shared with CompleteSetupBanner.tsx so both
// dismissals can be reset together from Settings → Help.
export const CHECKLIST_DISMISSED_KEY_PREFIX = 'practicepro_checklist_dismissed_';
export const BANNER_DISMISSED_KEY_PREFIX = 'practicepro_setup_banner_dismissed_';
// Set once the why-floater has auto-opened for a firm — after that it only
// opens on demand (ⓘ), so it never nags on every page load. localStorage
// only (cosmetic nicety — worst case on a new device it auto-opens once
// more), unlike the checklist dismissal which is server-durable.
export const CHECKLIST_WHY_SEEN_KEY_PREFIX = 'practicepro_checklist_why_seen_';

interface ChecklistItem {
  /** Key matches the boolean field returned by getGettingStartedChecklist. */
  key: string;
  label: string;
  /** View to navigate to, OR a modalType to open. */
  action: { kind: 'view'; view: string } | { kind: 'modal'; modalType: string };
  /** TASK 64 WHY COPY — richer WHAT/WHY context: one or two sentences
   *  telling the user what this step means, what they'll get out of it,
   *  and roughly what to expect. Now shown ONLY in the readable floater
   *  (never inline — the inline renderings were too small to read). */
  why: string;
  /** Optional how-to pointer shown beneath the why in the floater
   *  (carried over from the old per-item hints). */
  how?: string;
}

const VEGA_ITEMS: ChecklistItem[] = [
  // PRACTICE-PROFILE ENGINE: first-class item — drives adoption of the
  // blueprint (auto-applied during onboarding, retroactive for existing
  // firms). Deep-links to Settings → Firm Configuration → Practice
  // Blueprint modal via the 'practice-blueprint' target.
  {
    key: 'hasPracticeProfile',
    label: 'Pre-configure your practice',
    action: { kind: 'view', view: 'settings' },
    why: 'Takes ~1 minute: choose your areas of law and default state, and we pre-create the matter types, stages, document folders and event types most firms like yours use — so your workspace is ready to work with on day one instead of empty.',
  },
  {
    key: 'hasMatter',
    label: 'Create your first matter',
    action: { kind: 'modal', modalType: 'newMatter' },
    why: 'Every piece of work in your practice lives in a matter: documents, tasks, court dates, notes and billing all attach to it. Create one and you will immediately see the timeline, stage tracker and billing tools that come with it.',
  },
  {
    key: 'hasContact',
    label: 'Add a client contact',
    action: { kind: 'modal', modalType: 'newContact' },
    why: 'Contacts are the people and companies behind your matters. Adding them unlocks client portals, billing profiles, and one-click communication — and lets you link multiple matters to the same client over time.',
  },
  {
    key: 'hasBankAccount',
    label: 'Configure a bank account',
    action: { kind: 'modal', modalType: 'newBankAccount' },
    why: 'Your firm\'s accounts are where money movements are recorded: client funds you hold in trust stay separable from firm operating income, and invoices/payments get tied to the right account. Add one now — you can add more later (e.g. a dedicated Trust account).',
  },
  {
    key: 'hasBillingRate',
    label: 'Set your billing rate',
    action: { kind: 'view', view: 'billing' },
    why: 'Billing rates power every invoice: time entries are multiplied by the rate on each matter (or per team member). Setting yours now means the first invoice you generate is accurate without manual math.',
    how: 'Create a matter with an hourly rate, or set rates in Settings.',
  },
  {
    key: 'hasCourtDateOnMatter',
    label: 'Add a court date',
    action: { kind: 'view', view: 'matters' },
    why: 'Court dates (hearings, mentions, trials) added as events give you reminders before every appearance, a clean chronological timeline per matter, and an at-a-glance calendar of what\'s coming up — so nothing sneaks up on you.',
    how: 'Open a matter → Tasks & Events → Events tab → New Event.',
  },
  {
    key: 'hasInvitedUser',
    label: 'Invite a team member',
    action: { kind: 'view', view: 'settings' },
    why: 'Practice is a team sport. Invite colleagues to share matters, assign tasks and split billing credit — each person gets their own login, and you control what they can see and do.',
  },
];

const ATRIUM_ITEMS: ChecklistItem[] = [
  // PRACTICE-PROFILE ENGINE: first-class item — see VEGA_ITEMS note.
  {
    key: 'hasPortfolioProfile',
    label: 'Pre-configure your portfolio',
    action: { kind: 'view', view: 'settings' },
    why: 'Takes ~1 minute: choose your portfolio composition and we pre-create the contact types, folders and checklists most portfolios like yours use.',
  },
  {
    key: 'hasProperty',
    label: 'Add your first property',
    action: { kind: 'modal', modalType: 'newProperty' },
    why: 'Properties are the backbone of your portfolio: units, residents, rent schedules and service charges all hang off them.',
  },
  {
    key: 'hasTenantOnProperty',
    label: 'Add a resident to a unit',
    action: { kind: 'view', view: 'properties' },
    why: 'A property only earns when someone lives in it. Adding residents unlocks rent ledgers, reminders and the resident portal per unit.',
    how: 'Open a property → edit a unit → enter the resident name.',
  },
  {
    key: 'hasServiceCharge',
    label: 'Set up service charges',
    action: { kind: 'view', view: 'properties' },
    why: 'Service charges (dues, levies, facility fees) are billed separately from rent. Setting them up means accurate demand notices and automatic arrears tracking from day one.',
    how: 'Open a property → Units tab → edit a unit → set the service charge.',
  },
  {
    key: 'hasBankAccount',
    label: 'Configure bank account',
    action: { kind: 'modal', modalType: 'newBankAccount' },
    why: 'Bank accounts are where collections are recorded and reconciled — keeping rent income separable from other money makes your books (and your accountants) happy.',
  },
  {
    key: 'hasInvitedResidentToPortal',
    label: 'Invite a resident to portal',
    action: { kind: 'view', view: 'settings' },
    why: 'Portal residents can see their balance, download receipts and pay without calling you — fewer “how much do I owe?” conversations.',
  },
  {
    key: 'hasSentReminder',
    label: 'Send your first rent reminder',
    action: { kind: 'view', view: 'messaging' },
    why: 'Reminders are how arrears get paid before they become disputes. Send one and see the delivery status tracked per resident.',
    how: 'Email/portal nudge to a defaulter (or a one-tap WhatsApp share).',
  },
];

const KOMPLETE_ITEMS: ChecklistItem[] = [
  // Vega side first, then Atrium side — matches the wizard order
  ...VEGA_ITEMS,
  ...ATRIUM_ITEMS.filter(item => !VEGA_ITEMS.some(v => v.key === item.key)),
];

/** Active checklist for the current product (Komplete merges both sides).
 *  Single source of truth — never inline the ternary, the hydration-window
 *  bugs (Round 15) came from item-set selection drifting between effects. */
const getActiveItems = (isProperty: boolean, isUnified: boolean): ChecklistItem[] =>
  isUnified ? KOMPLETE_ITEMS : isProperty ? ATRIUM_ITEMS : VEGA_ITEMS;

const GettingStartedChecklist: React.FC = () => {
  const { currentUser, bearerToken } = useAuth();
  const { navigateTo, openModal, addToast, setHighlightTarget } = useUI();
  const { isProperty, isUnified, isProductResolved } = useProduct();
  const firmId = (currentUser as any)?.firmId || '';

  // SERVER-SIDE DISMISSAL (2026-09-14): firms.checklistDismissedAt is the
  // durable source of truth. localStorage alone was wiped by every update
  // refresh / APK reinstall / device change — resurrecting the checklist and
  // re-firing the "You're all set!" celebration on firms that finished
  // onboarding long ago. Local state mirrors the server flag (and keeps the
  // localStorage copy for offline snappiness), and BOTH dismiss paths
  // (celebration + manual X) persist to the server.
  const setDismissedOnServer = useMutation(api.myFunctions.setGettingStartedChecklistDismissed);
  const persistDismissal = (dismissed: boolean) => {
    setDismissedOnServer({
      dismissed,
      sessionToken: bearerToken ?? undefined,
      userEmail: currentUser?.email,
    }).catch((e) => {
      // Non-fatal: localStorage still holds the local copy; the server flag
      // catches up on the next dismiss/restore action.
      console.warn('[GettingStartedChecklist] server dismissal persist failed:', e?.message);
    });
  };

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  // WHY FLOATER — the item key currently shown (null = closed).
  const [whyStepKey, setWhyStepKey] = useState<string | null>(null);

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

  // Celebration machinery refs — declared BEFORE every effect that uses
  // them (the server-dismissal adoption effect below cancels an armed
  // confirmation timer, so the ref must already exist when it runs).
  const allDoneConfirmedRef = useRef(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest evaluation snapshot — updated every relevant render so the
  // delayed confirmation re-verifies against CURRENT data, not the
  // closure captured when the timer was armed.
  const latestEvalRef = useRef<{ checklist: any; items: ChecklistItem[] } | null>(null);
  // P1 SUPPRESSION (2026-09-15), two more refs:
  //   • isDismissedRef — mirrors isDismissed so the DELAYED confirmation
  //     callback can observe the LATEST dismissal state (the server flag
  //     can land inside the 1s window; the old callback only re-verified
  //     item doneness and toasted anyway).
  //   • sawIncompleteRef — latches true the first time a SETTLED
  //     evaluation finds any item incomplete. The celebration toast now
  //     fires ONLY for genuine in-session completions; a firm that was
  //     already all-done before this session (new device, cleared
  //     storage, first run post-deploy) is silently auto-dismissed
  //     instead of getting a spurious "You're all set!" for onboarding
  //     finished long ago.
  const isDismissedRef = useRef(false);
  const sawIncompleteRef = useRef(false);
  useEffect(() => { isDismissedRef.current = isDismissed; }, [isDismissed]);

  // Adopt the SERVER dismissal flag whenever it says dismissed (covers new
  // devices, reinstalls and cleared storage). Mirrored into localStorage so
  // the very next mount on this device skips even before the query lands.
  useEffect(() => {
    if (checklist?.dismissed === true && !isDismissed) {
      setIsDismissed(true);
      // P1: the server-dismissed flag can arrive while a celebration
      // confirmation is armed (localStorage-miss mount) — cancel it, or
      // the 1s callback would still toast over the arrived dismissal.
      if (confirmTimerRef.current !== null) {
        clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = null;
      }
      try {
        localStorage.setItem(`${CHECKLIST_DISMISSED_KEY_PREFIX}${firmId}`, 'true');
      } catch {}
    }
  }, [checklist, isDismissed, firmId]);

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

  useEffect(() => {
    if (!checklist || isDismissed) return;
    // GATE 1: flags must be settled — the hydration-default window can
    // briefly evaluate the wrong (KOMPLETE) item set for VEGA/ATRIUM firms.
    if (!isProductResolved) return;

    const items = getActiveItems(isProperty, isUnified);
    latestEvalRef.current = { checklist, items };
    const allDone = items.every(item => isItemDone(checklist, item));
    if (!allDone) {
      // Latch the in-session "was incomplete" observation — the
      // celebration below only toasts when this is true.
      sawIncompleteRef.current = true;
    }

    if (allDone) {
      // GATE 2 + GATE 3: arm a delayed confirmation the FIRST time we see
      // all-done; the toast/dismiss/persist only happens after it holds.
      if (!allDoneConfirmedRef.current && confirmTimerRef.current === null) {
        confirmTimerRef.current = setTimeout(() => {
          confirmTimerRef.current = null;
          // GATE 4 (P1): dismissal may have landed while the window was
          // armed (server flag adoption or manual X) — never toast then.
          if (isDismissedRef.current) return;
          // Re-verify with the LATEST snapshot — a transient flicker that
          // reverted (or new data marking an item incomplete again)
          // cancels the celebration entirely and re-arms the transition.
          const snap = latestEvalRef.current;
          if (!snap) return;
          if (!snap.items.every(item => isItemDone(snap.checklist, item))) return;
          allDoneConfirmedRef.current = true;
          // GATE 5 (P1): CELEBRATION SUPPRESSION — only toast for a
          // genuine in-session completion (we watched the checklist
          // incomplete earlier in THIS mounted session). Firms that were
          // already all-done when the session started get the SILENT
          // path: auto-dismiss + persist, no toast.
          if (sawIncompleteRef.current) {
            addToast?.('🎉 You\'re all set! You\'ve completed the Getting Started checklist. Explore the rest of PracticePro at your own pace.', { type: 'success', duration: 8000 });
          }
          setIsDismissed(true);
          try {
            localStorage.setItem(`${CHECKLIST_DISMISSED_KEY_PREFIX}${firmId}`, 'true');
          } catch {}
          // Durable dismissal — survives reinstalls and new devices.
          persistDismissal(true);
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
    const currentItems = getActiveItems(isProperty, isUnified);
    for (const item of currentItems) {
      const wasDone = (prev as any)[item.key] === true;
      const isDone = (checklist as any)[item.key] === true;
      if (!wasDone && isDone) {
        addToast?.(`✓ ${item.label} — complete!`, { type: 'success', duration: 4000 });
      }
    }
    prevChecklistRef.current = checklist;
  }, [checklist, isProperty, isUnified, isProductResolved, addToast]);

  // WHY FLOATER — auto-open once per firm for the first incomplete step,
  // when the checklist is expanded and product flags are settled (same
  // GATE 1 as the celebration: the hydration window would select the
  // wrong item set). After the first auto-open it is strictly on demand
  // via the ⓘ button on each row, so it never nags on every page load.
  useEffect(() => {
    if (!checklist || !firmId || isDismissed || isCollapsed || !isProductResolved) return;
    try {
      if (localStorage.getItem(`${CHECKLIST_WHY_SEEN_KEY_PREFIX}${firmId}`) === 'true') return;
    } catch {
      // localStorage blocked — show it anyway (session-only, no persistence).
    }
    const activeItems = getActiveItems(isProperty, isUnified);
    const firstIncomplete = activeItems.find(item => !isItemDone(checklist, item));
    if (firstIncomplete) {
      setWhyStepKey(firstIncomplete.key);
      try {
        localStorage.setItem(`${CHECKLIST_WHY_SEEN_KEY_PREFIX}${firmId}`, 'true');
      } catch {}
    }
  }, [checklist, firmId, isDismissed, isCollapsed, isProperty, isUnified, isProductResolved]);

  // WHY FLOATER — Escape closes it.
  useEffect(() => {
    if (!whyStepKey) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setWhyStepKey(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [whyStepKey]);

  // WHY FLOATER — if the shown step completes while the card is open, slide
  // forward to the next incomplete step instead of explaining a finished one.
  useEffect(() => {
    if (!whyStepKey || !checklist || !isProductResolved) return;
    const activeItems = getActiveItems(isProperty, isUnified);
    const shown = activeItems.find(item => item.key === whyStepKey);
    if (!shown || !isItemDone(checklist, shown)) return;
    const remaining = activeItems.filter(item => !isItemDone(checklist, item));
    setWhyStepKey(remaining.length > 0 ? remaining[0].key : null);
  }, [checklist, whyStepKey, isProperty, isUnified, isProductResolved]);

  // Don't render until checklist data is loaded AND product flags are
  // settled — avoids a flash of empty items AND a flash of WRONG items
  // (the hydration window's provisional 'unified' default would briefly
  // render KOMPLETE items on a VEGA/ATRIUM sidebar).
  if (!firmId || !checklist || isDismissed || !isProductResolved) return null;

  const items = getActiveItems(isProperty, isUnified);
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
    persistDismissal(true);
  };

  const handleExpand = () => setIsCollapsed(false);

  // WHY FLOATER — derived state + handlers.
  const whyItem = whyStepKey ? items.find(i => i.key === whyStepKey) : undefined;
  const incompleteItems = items.filter(item => !isItemDone(checklist, item));
  const whyIndex = whyItem ? incompleteItems.findIndex(i => i.key === whyItem.key) : -1;
  const closeWhy = () => setWhyStepKey(null);
  const startWhyStep = (item: ChecklistItem) => {
    setWhyStepKey(null);
    handleItemClick(item);
  };

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
              <li key={`${item.key}-${idx}`} className="relative">
                <button
                  onClick={() => handleItemClick(item)}
                  disabled={isDone || isSkipped}
                  data-tour-id={`checklist-${item.key}`}
                  className={`
                    w-full flex items-start gap-2.5 px-3 py-2 pr-8 text-left transition-colors group
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
                    {/* The why/how copy lives in the FLOATER (ⓘ button to the
                        right) — never inline; inline renderings (old text-3xs
                        hint + Task 64 "Why do this?" expander) were barely
                        legible at 8px and cluttered the sidebar. */}
                  </div>
                </button>
                {/* ⓘ — opens the "Why this matters" floater for this step.
                    A sibling (not nested) button, so the HTML stays valid. */}
                {!isDone && !isSkipped && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setWhyStepKey(item.key); }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-300 dark:text-zinc-600 hover:text-primary-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                    aria-label={`Why this matters: ${item.label}`}
                    title="Why this matters"
                  >
                    <InfoIcon className="w-3.5 h-3.5" />
                  </button>
                )}
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

      {/* WHY FLOATER — dismissible "Why this matters" card. Portal-mounted so
          it escapes the sidebar's stacking/transform context and sits fixed
          over the viewport: above the Aloa FAB (bottom-20/right-6), below
          toasts (z-[9999]). */}
      {whyItem && createPortal(
        <div
          role="dialog"
          aria-label={`Why this matters: ${whyItem.label}`}
          className="fixed z-[9990] bottom-[9.5rem] md:bottom-[7rem] left-4 right-4 sm:left-auto sm:w-[350px] animate-slide-up"
        >
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="relative px-4 pt-3.5 pb-3 bg-gradient-to-r from-primary-50 to-emerald-50 dark:from-zinc-800 dark:to-zinc-800 border-b border-slate-100 dark:border-zinc-700/60">
              <div className="flex items-center gap-1.5">
                <LightbulbIcon className="w-3.5 h-3.5 text-primary-600 dark:text-emerald-400 flex-shrink-0" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary-600 dark:text-emerald-400">
                  Why this matters
                </p>
              </div>
              <p className="mt-1 pr-7 text-sm font-bold text-slate-800 dark:text-zinc-100 leading-snug">
                {whyItem.label}
              </p>
              <button
                onClick={closeWhy}
                className="absolute top-2.5 right-2.5 p-1 rounded-md text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60 transition-colors"
                aria-label="Dismiss"
                title="Dismiss"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Body — readable size; that is the entire point of the floater. */}
            <div className="px-4 py-3.5">
              <p className="text-[13px] leading-relaxed text-slate-600 dark:text-zinc-300">
                {whyItem.why}
              </p>
              {whyItem.how && (
                <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                  <ChevronRightIcon className="w-3.5 h-3.5 mt-px flex-shrink-0 text-primary-500 dark:text-emerald-500" />
                  <span>{whyItem.how}</span>
                </p>
              )}
            </div>

            {/* Footer — cycle remaining tips + start the step */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40">
              {incompleteItems.length > 1 ? (
                <button
                  onClick={() => {
                    const next = incompleteItems[(whyIndex + 1) % incompleteItems.length];
                    if (next) setWhyStepKey(next.key);
                  }}
                  className="text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-primary-600 dark:hover:text-emerald-400 transition-colors"
                >
                  Next tip ({whyIndex + 1}/{incompleteItems.length})
                </button>
              ) : (
                <span className="text-xs font-medium text-slate-400 dark:text-zinc-500">
                  {incompleteItems.length === 1 ? 'Last remaining step' : 'All done'}
                </span>
              )}
              <button
                onClick={() => startWhyStep(whyItem)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-colors shadow-sm"
              >
                Start this step
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default GettingStartedChecklist;
