
import React, { useState, useEffect } from 'react';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { SubscriptionPlan } from '../../types';
import { translateError } from '../../utils/errorTranslator';
import { openLegalDocument } from '../../utils/legalLinks';
import { useAuth } from '../../contexts/AuthContext';
import { LogoutIcon, CheckIcon, LockClosedIcon, RevertIcon } from '../../constants';
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUI } from '../../contexts/UIContext';
import { getTiersForProduct, DISPLAY_TIER_IDS, ProductMode, TierId, TierDef, formatTierPrice, isKomplete } from '../../constants/tiers';
import { NIGERIAN_STATES, PORTFOLIO_TYPE_OPTIONS, ATRIUM_FOCUS_OPTIONS } from '../../utils/jurisdictionConfig';
import { FirmSpecialty } from '../../types';
// PRACTICE-PROFILE ENGINE — pre-populates the firm's configuration (matter
// types with sub-categories & stages, contact types, document folders,
// event types, starter checklists) from the practice areas / portfolio
// composition picked on Step 3. Additive + idempotent; runs on wizard
// completion BEFORE the firm-settings save so blueprintAppliedAt can be
// persisted in the same write.
import { usePracticeProfile, mergePlans, type ApplyPlan } from '../../hooks/usePracticeProfile';
import { useDataState } from '../../contexts/DataContext';
// CRO AUDIT Track A — A3: use the real PaymentGatewayModal instead of the stub.
import PaymentGatewayModal from './PaymentGatewayModal';

// SETUP WIZARD EXTENSION (Steps 3-5):
// Channel-relevance copy for Step 3 (Communication Channels).
// IMPORTANT: per user spec, we ask the user which channels they INTEND to use
// and explain why each matters — but we do NOT collect phone numbers,
// WhatsApp Business API tokens, or Brevo/Sendgrid API keys during onboarding.
// Those credentials are configured later in Settings → Integrations.
const WHATSAPP_RELEVANCE =
  'Rent reminders, overdue notices, and lease-expiry nudges to tenants. Matter status updates, court-date alerts, and document-signing requests to clients. Best for time-sensitive, two-way conversations — most Nigerian recipients read WhatsApp within minutes.';
const EMAIL_RELEVANCE =
  'Invoice delivery, monthly statements, formal letters, and engagement letters. Best for documents the recipient needs to keep on file. Email is also the fallback channel when WhatsApp is undelivered.';

interface OnboardingWizardProps {
  onComplete: () => void;
}

const PlanCard: React.FC<{
  tier: TierDef;
  selected: boolean;
  onSelect: () => void;
  billingCycle: 'monthly' | 'annual';
  isAtrium: boolean;
  productName?: 'Vega' | 'Atrium' | 'Komplete';
}> = ({ tier, selected, onSelect, billingCycle, isAtrium, productName = 'Vega' }) => {
  const { price, per } = formatTierPrice(tier, billingCycle);
  // PRICING AUDIT: Atrium now supports monthly billing too (was annual-only)
  const effectiveBilling = billingCycle;
  const sce = effectiveBilling === 'annual' ? tier.scePer_annual : tier.scePer;

  // CRO AUDIT Track C — C1: portfolio-size anchors per tier, per product.
  // Collapses the tier-choice decision from a feature-comparison task to a
  // self-identification task (cognitively cheaper, converts better).
  const portfolioAnchor = (() => {
    if (productName === 'Atrium') {
      switch (tier.id) {
        case 'Core': return 'For portfolios up to 10 units';
        case 'Growth': return 'For portfolios of 10–25 units';
        case 'Pro': return 'For portfolios of 25–100 units — most estate surveyors';
        case 'Enterprise': return 'For developers and PMs with 100+ units';
      }
    } else if (productName === 'Vega') {
      switch (tier.id) {
        case 'Core': return 'For solo practitioners getting started';
        case 'Growth': return 'For small teams of 2–5 lawyers';
        case 'Pro': return 'For firms with active litigation pipelines';
        case 'Enterprise': return 'For multi-branch firms with 50+ matters/month';
      }
    } else { // Komplete
      return 'Unified property + legal for diversified firms';
    }
    return null;
  })();

  // CRO AUDIT Track C — C5: tier label badges. "Recommended" badge moves to
  // Atrium Growth (the modal Nigerian portfolio size) instead of always
  // being on Pro.
  const badgeText = (() => {
    if (tier.id === 'Growth' && productName === 'Atrium') return 'Recommended for most firms';
    if (tier.id === 'Growth' && productName === 'Vega') return 'Most Popular';
    if (tier.id === 'Pro' && productName === 'Vega') return 'For active practices';
    return null;
  })();

  return (
    <div
      onClick={onSelect}
      className={`relative flex flex-col rounded-2xl border-2 cursor-pointer transition-all duration-200 h-full ${
        selected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30/20 shadow-lg shadow-primary-500/10'
          : 'border-slate-200  bg-white  hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      {/* Recommended badge */}
      {badgeText && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-emerald-600 text-white text-3xs font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-lg whitespace-nowrap z-10">
          {badgeText}
        </div>
      )}

      <div className="p-5 flex flex-col h-full">
        {/* Tier name + check */}
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-black text-2xs uppercase tracking-widest text-slate-400">{tier.label}</h4>
          {selected && <div className="w-4 h-4 bg-primary-600 rounded-full flex items-center justify-center text-white p-0.5"><CheckIcon className="w-full h-full" /></div>}
        </div>

        {/* CRO AUDIT Track C — C1: portfolio-size anchor */}
        {portfolioAnchor && (
          <p className="text-3xs font-bold text-primary-600  mb-2 leading-snug">{portfolioAnchor}</p>
        )}

        {/* Price */}
        <div className="mb-4">
          <p className="text-2xl font-bold text-slate-900  tracking-tight leading-none">{price}</p>
          <p className="text-2xs font-bold text-slate-400 mt-1">{per || (tier.annualPrice === null && tier.monthlyPrice === null ? 'Contact sales' : isAtrium ? '/yr' : '')}</p>
        </div>

        {/* SCE block */}
        {sce && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40/80 border border-emerald-100">
            <p className="text-3xs font-black text-emerald-600  uppercase tracking-widest">SCE*</p>
            <div className="flex items-baseline gap-1">
              <p className="text-xs font-black text-slate-900  leading-tight">{sce}</p>
              <p className="text-3xs font-bold text-slate-400 uppercase">/tenant</p>
            </div>
          </div>
        )}

        {/* Features — scrollable if tall */}
        <ul className="space-y-1.5 flex-grow overflow-y-auto custom-scrollbar text-left pr-1" style={{ maxHeight: '180px' }}>
          {tier.features.map((f, i) => (
            <li key={i} className="text-2xs text-slate-500 font-medium flex items-start gap-1.5 leading-snug">
              <CheckIcon className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
              <span className="break-words">{f}</span>
            </li>
          ))}
        </ul>

        {/* Setup fee notice */}
        {tier.requiresSetupFee && (
          <p className="text-3xs text-amber-600  font-black uppercase tracking-widest mt-3 border-t border-slate-100  pt-2">+ ₦150k One-Time Setup Fee</p>
        )}
      </div>
    </div>
  );
};

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const { createFirm, joinFirm, handleUpdateFirmDetails, addItem, updateItem, deleteItem } = useDataActions();
  const { currentUser, logout, refreshUser } = useAuth();
  const { navigateTo, addToast } = useUI();
  const repairAccountMutation = useMutation(api.myFunctions.repairAccountConnection);

  // Use the product the user selected during signup
  // This is stored on the user record by the backend
  const userProduct = (currentUser as any)?.product as ProductMode | undefined;

  // ── WIZARD-IN-PROGRESS FLAG ────────────────────────────────────────────
  // PROBLEM: App.tsx mounts this wizard only while `!currentUser.firmId`.
  // The moment createFirm + refreshUser() land the firmId, the App re-renders
  // and the wizard UNMOUNTS mid-flow — users were dumped into the app with
  // steps 3-6 (practice profile, channels, team, review) never shown.
  // FIX: once the firm exists, mark the wizard as "in progress" so App keeps
  // it mounted until the user explicitly finishes (onComplete clears it).
  // Stale-flag safety: timestamped — a flag older than 1 hour is ignored
  // (e.g. crash mid-wizard, user returns later, wizard resumes at step 3).
  const WIZARD_FLAG_KEY = 'practicepro_wizard_in_progress';
  const WIZARD_FLAG_TTL_MS = 60 * 60 * 1000;
  const readWizardFlag = (): boolean => {
    try {
      const ts = sessionStorage.getItem(WIZARD_FLAG_KEY + '_ts');
      if (!ts) return false;
      return Date.now() - parseInt(ts, 10) < WIZARD_FLAG_TTL_MS;
    } catch { return false; }
  };

  // Step 1: Workspace name | Step 2: Plan selection (product already known from signup)
  // Step 3: Practice profile (state(s) + practice/portfolio config) | Step 4: Communication
  // channels | Step 5: Team setup | Step 6: Review & confirm
  const [step, setStep] = useState(() => {
    // Resuming a wizard that already created the firm → skip workspace/plan.
    return (currentUser?.firmId && readWizardFlag()) ? 3 : 1;
  });
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [firmName, setFirmName] = useState('');
  const [product, setProduct] = useState<ProductMode>(userProduct || 'legal');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [selectedTierId, setSelectedTierId] = useState<TierId>('Pro');
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDataMigration, setIsDataMigration] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Show all plans or just the pre-selected one
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  // Payment/trial flow state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAction, setPaymentAction] = useState<'pay_now' | 'start_trial' | null>(null);

  // SETUP WIZARD EXTENSION — Steps 3-5 state:
  // createdFirmId is the ID returned by createFirm (used to look up the
  // invite code on Step 4 even before DataProvider has finished syncing).
  const [createdFirmId, setCreatedFirmId] = useState<string | null>(null);
  // Communication channel intent — recorded to firmDetails.settings on Step 5.
  const [useWhatsapp, setUseWhatsapp] = useState<boolean | null>(null);
  const [useEmail, setUseEmail] = useState<boolean | null>(null);
  // "Will anyone else be working in this workspace?" (Step 5)
  const [willInviteTeam, setWillInviteTeam] = useState<boolean | null>(null);
  const [isSavingFinal, setIsSavingFinal] = useState(false);
  // ROUND 9 — live setup-stage label while the practice blueprint is being
  // applied on wizard completion ("Setting up contact types… (4/9)") so the
  // user sees what is actually happening instead of a frozen spinner.
  const [setupStageLabel, setSetupStageLabel] = useState<string | null>(null);

  // ── PRACTICE PROFILE (Step 3) ─────────────────────────────────────────
  // "What kind of practice are you running?" — captures the practice-type
  // configuration that tailors the AI (ALOA/ARIA jurisdiction + focus),
  // the Getting-Started checklist, and workflow defaults from day one.
  const [primaryState, setPrimaryState] = useState<string>('Lagos');
  const [additionalStates, setAdditionalStates] = useState<string[]>([]);
  const [practiceAreas, setPracticeAreas] = useState<string[]>([]);
  const [portfolioTypes, setPortfolioTypes] = useState<string[]>([]);
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [unitsUnderManagement, setUnitsUnderManagement] = useState<string>('');

  const toggleInArray = (arr: string[], setArr: (v: string[]) => void, value: string, max = 12) => {
    if (arr.includes(value)) setArr(arr.filter(v => v !== value));
    else if (arr.length < max) setArr([...arr, value]);
  };

  // If user already chose product during signup, set it immediately
  useEffect(() => {
    if (userProduct) {
      setProduct(userProduct);
    }
  }, [userProduct]);

  // Derive plan display from tiers matrix
  const tiers = getTiersForProduct(product);
  const tierIds: TierId[] = isKomplete(product) ? ['Core'] : DISPLAY_TIER_IDS;
  const isAtrium = product === 'property' || product === 'atrium';
  const productName = product === 'legal' ? 'Vega' : product === 'property' ? 'Atrium' : 'Komplete';

  // Map TierId → SubscriptionPlan enum for backend
  const tierToSubscriptionPlan: Record<TierId, SubscriptionPlan> = {
    Core:    SubscriptionPlan.Core,
    Growth:   SubscriptionPlan.Growth,
    Pro:    SubscriptionPlan.Pro,
    Enterprise: SubscriptionPlan.Enterprise,
  };

  const handleCreate = async (trial = false) => {
    if (!firmName.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const plan = isKomplete(product) ? SubscriptionPlan.Komplete : tierToSubscriptionPlan[selectedTierId];
      // CRO AUDIT FIX (Track B — B2): pass trial flag to createFirm so the
      // backend sets trialStartsAt/trialEndsAt/trialPlan. The firm is created
      // at Core for billing but granted the selected plan's entitlements
      // during the 30-day trial window (see useFeatures.ts).
      const fid = await createFirm(
        firmName.trim(),
        'Address Pending',
        plan,
        { email: currentUser!.email, name: currentUser!.name },
        product,
        isDataMigration,
        trial,
      );
      if (fid) {
        // WIZARD-IN-PROGRESS: flag BEFORE refreshUser so the App's unmount
        // condition (`!firmId`) no longer kills the wizard mid-flow.
        try {
          sessionStorage.setItem(WIZARD_FLAG_KEY, 'true');
          sessionStorage.setItem(WIZARD_FLAG_KEY + '_ts', String(Date.now()));
        } catch { /* sessionStorage unavailable — wizard may unmount early, tolerable */ }
        // CRITICAL FIX: refreshUser() can hang if Convex is slow to sync
        // the new firmId onto the user record. Add a 10-second timeout —
        // if it takes too long, force-reload the page (the firm WAS
        // created successfully, the user just needs a fresh session).
        try {
          await Promise.race([
            refreshUser(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
          ]);
          sessionStorage.removeItem('practicepro_demo_product');
          // SETUP WIZARD EXTENSION: do NOT call onComplete() here — instead
          // advance the user to Step 3 (Communication Channels) so they can
          // record their WhatsApp/Email intent and team setup before landing
          // in the app. We keep the firmId so Step 4 can fetch the invite code
          // without waiting for the full DataProvider sync.
          setCreatedFirmId(fid);
          setStep(3);
        } catch (refreshErr) {
          // refreshUser timed out or failed — but the firm WAS created.
          // Force a page reload so the user's session picks up the new firmId.
          // After reload the App routes them into the main app (firm exists),
          // and they can configure communication channels / team from Settings.
          console.warn('[Onboarding] refreshUser timed out, force-reloading...', refreshErr);
          sessionStorage.removeItem('practicepro_demo_product');
          window.location.reload();
        }
      } else {
        throw new Error('Firm creation returned no ID.');
      }
    } catch (e: any) {
      console.error('Setup Error:', e);
      setError(translateError(e, 'create workspace'));
      setIsSubmitting(false);
    }
  };

  const handleJoin = async () => {
    const cleanCode = inviteCode.trim().toUpperCase();
    if (!cleanCode) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const fid = await joinFirm(cleanCode);
      if (fid) {
        setTimeout(() => window.location.reload(), 800);
      } else {
        throw new Error('Invalid Invite Code or Firm not found.');
      }
    } catch (e: any) {
      let msg = translateError(e, 'join workspace');
      if (msg.includes('Invalid')) msg = 'Invalid Invite Code. Please check and try again.';
      setError(msg);
      setIsSubmitting(false);
    }
  };

  const handleRecovery = async () => {
    if (!currentUser?.email) return;
    setIsRecovering(true);
    setError(null);
    try {
      const result = await repairAccountMutation({ email: currentUser.email });
      if (result.success) { await refreshUser(); onComplete(); }
      else setError(result.message || 'Could not recover. Please create a new workspace.');
    } catch (e: any) {
      setError(translateError(e, 'recover connection'));
    } finally {
      setIsRecovering(false);
    }
  };

  // ── SETUP WIZARD EXTENSION ────────────────────────────────────────────
  // Fetch the firm record so Step 4 can display the invite code immediately
  // (DataProvider may not have synced firmDetails yet when the user lands
  // on Step 4 right after creating the firm).
  const lookupFirmId = createdFirmId || currentUser?.firmId || '';
  const firmBasicInfo = useQuery(
    api.myFunctions.getFirmBasicInfo,
    lookupFirmId ? { firmId: lookupFirmId } : 'skip'
  );
  const firmInviteCode: string | undefined =
    (firmBasicInfo as any)?.inviteCode || undefined;

  // ── PRACTICE-PROFILE ENGINE (Step 3 selections → workspace blueprint) ──
  // Uses the RAW appState collections (DB truth) — NOT coreState, whose
  // product-mode fallback lists would produce false "duplicates" for rows
  // that only exist as hardcoded display defaults. By wizard completion the
  // DataProvider has synced the firm-scoped seeded rows (createFirm seeds
  // contactCategories/documentCategories/eventTypes), so dedupe is exact.
  const { appState } = useDataState();
  const blueprint = usePracticeProfile({
    contactCategories: (appState as any).contactCategories || [],
    documentCategories: (appState as any).documentCategories || [],
    eventTypes: (appState as any).eventTypes || [],
    workflows: (appState as any).workflows || [],
    checklistTemplates: (appState as any).checklistTemplates || [],
    firmId: lookupFirmId,
    addItem: addItem as any,
    updateItem: updateItem as any,
  });

  // The plan for the current Step-3 selections, used by the Step-6 review
  // row (what will be pre-configured) and by the apply on completion.
  const blueprintPlan: ApplyPlan | null = React.useMemo(() => {
    if (isAtrium && !isKomplete(product)) {
      // Pure Atrium: portfolio blueprint only.
      return blueprint.buildPlan({ kind: 'atrium', portfolioTypes, focusAreas });
    }
    if (isKomplete(product)) {
      // Komplete: legal + portfolio blueprints merged and de-duplicated.
      return mergePlans(
        blueprint.buildPlan({ kind: 'legal', areas: practiceAreas }),
        blueprint.buildPlan({ kind: 'atrium', portfolioTypes, focusAreas }),
      );
    }
    // Vega: legal blueprint.
    return blueprint.buildPlan({ kind: 'legal', areas: practiceAreas });
  }, [blueprint, isAtrium, product, portfolioTypes, focusAreas, practiceAreas]);

  /**
   * Apply the practice blueprint, then prune the generic seeded
   * contact/document categories that the curated profile does not use
   * (WIZARD-ONLY — this runs seconds after createFirm, so nothing can
   * reference the seeded rows yet; the Settings modal never prunes).
   * Returns true when the blueprint was applied (created or merged > 0).
   */
  const applyBlueprint = async (): Promise<boolean> => {
    if (!lookupFirmId) return false;
    const hasSelection =
      practiceAreas.length > 0 || portfolioTypes.length > 0 || focusAreas.length > 0;
    if (!blueprintPlan || !hasSelection) return false;
    try {
      const res = await blueprint.applyPlan(blueprintPlan, lookupFirmId, (p) => {
        setSetupStageLabel(
          p.completed
            ? 'Finishing up…'
            : p.total > 0
              ? `${p.label} (${p.done}/${p.total})`
              : p.label,
        );
      });
      const applied = res.created + res.merged > 0;

      // PRUNE: remove seeded (isSystem) contact/document categories the
      // curated plan does NOT contain. The plan's items cover both "new"
      // and "already existing" (duplicate) names, so anything seeded but
      // absent from the plan is a stock default the profile doesn't want
      // — e.g. "Court Staff"/"Judiciary" for a property manager.
      const planContacts = new Set(
        blueprintPlan.items
          .filter(i => i.table === 'contactCategories')
          .map(i => (i.label || '').trim().toLowerCase()),
      );
      const planDocs = new Set(
        blueprintPlan.items
          .filter(i => i.table === 'documentCategories')
          .map(i => (i.label || '').trim().toLowerCase()),
      );
      const prunable: { table: string; id: string; name: string }[] = [
        ...((appState as any).contactCategories || [])
          .filter((c: any) => c.isSystem === true && !planContacts.has(String(c.name || '').trim().toLowerCase()))
          .map((c: any) => ({ table: 'contactCategories', id: c.id, name: c.name })),
        ...((appState as any).documentCategories || [])
          .filter((d: any) => d.isSystem === true && !planDocs.has(String(d.name || '').trim().toLowerCase()))
          .map((d: any) => ({ table: 'documentCategories', id: d.id, name: d.name })),
      ];
      for (const row of prunable) {
        if (!row.id) continue;
        try {
          await deleteItem(row.table as any, row.id, row.name);
        } catch { /* non-blocking — a leftover stock row is cosmetic */ }
      }

      if (applied) {
        const c = blueprintPlan.counts;
        addToast?.(
          `Workspace pre-configured: ${c.matterTypes} matter types (${c.subCategories} sub-categories), ${c.contactTypes} contact types, ${c.documentCategories} document folders, ${c.checklists} checklists.`,
          { type: 'success', duration: 8000 },
        );
      }
      if (res.errors.length > 0) {
        console.warn('[OnboardingWizard] blueprint apply errors:', res.errors);
      }
      return applied;
    } catch (e) {
      // Non-blocking: the firm can always apply the blueprint later from
      // Settings → Firm Configuration (the checklist links there too).
      console.warn('[OnboardingWizard] blueprint apply failed:', e);
      return false;
    }
  };

  // Step 5 handler — persists the communication channel intent AND the
  // team-invite intent to firmDetails.settings, then calls onComplete().
  // Uses the patched handleUpdateFirmDetails which now falls back to
  // currentUser.firmId if firmDetails.id isn't loaded yet (the immediate
  // post-createFirm window).
  //
  // TEAM-INVITE INTENT FIX: Previously, choosing "Yes — invite my team" on
  // Step 4 only displayed the invite code — nothing was written to the
  // backend. The Getting Started Checklist item "Invite a team member"
  // (hasInvitedUser) checks usersInFirm.length > 1 || portalInvitesSent.length > 0,
  // neither of which the wizard creates. So the checklist item never ticked
  // off even though the admin had explicitly expressed invite intent.
  //
  // Now we record the intent as `settings.teamInviteIntent`:
  //   - 'invited'   → admin chose "Yes — invite my team" and got the code
  //   - 'solo'      → admin chose "Just me for now" (deliberate opt-out)
  //   - undefined   → wizard not yet completed (backward compat for old firms)
  //
  // The checklist's hasInvitedUser now recognizes 'invited' as fulfilling
  // the item, and 'solo' firms see the item marked as "skipped" rather
  // than perpetually incomplete.
  const handleCompleteWizard = async () => {
    setIsSavingFinal(true);
    // PRACTICE BLUEPRINT: apply BEFORE the firm-settings save so the
    // blueprintAppliedAt flag (which the Getting-Started checklist reads)
    // can be persisted in the same single write. Non-blocking on failure.
    const blueprintApplied = await applyBlueprint();
    try {
      if (handleUpdateFirmDetails && lookupFirmId) {
        const now = Date.now();
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        await handleUpdateFirmDetails({
          id: lookupFirmId,
          // ── Practice Profile (Step 3) — jurisdictional + practice-type config ──
          // These feed the AI drafting/chat prompts (correct state captions,
          // procedural rules, and practice focus) and the firm settings UI.
          defaultStateOfPractice: primaryState,
          statesOfPractice: [primaryState, ...additionalStates.filter(s => s !== primaryState)],
          ...( practiceAreas.length > 0 ? { firmSpecialties: practiceAreas } : {} ),
          practiceProfile: {
            practiceAreas: practiceAreas.length > 0 ? practiceAreas : undefined,
            portfolioTypes: (isAtrium || isKomplete(product)) && portfolioTypes.length > 0 ? portfolioTypes : undefined,
            focusAreas: (isAtrium || isKomplete(product)) && focusAreas.length > 0 ? focusAreas : undefined,
            unitsUnderManagement: (isAtrium || isKomplete(product)) && unitsUnderManagement ? parseInt(unitsUnderManagement, 10) || undefined : undefined,
            completedAt: new Date().toISOString(),
            // Blueprint applied by the Practice Profile Engine — the Getting
            // Started checklist's "Pre-configure your practice/portfolio"
            // item reads this flag (getGettingStartedChecklist). If this run
            // didn't apply anything, preserve any earlier applied timestamp
            // (resumed wizard / idempotent re-run) instead of wiping it.
            blueprintAppliedAt: blueprintApplied
              ? new Date().toISOString()
              : (firmBasicInfo as any)?.practiceProfile?.blueprintAppliedAt,
          },
          settings: {
            communicationChannels: {
              whatsapp: useWhatsapp === true,
              email: useEmail === true,
            },
            // If the user opted into either channel but hasn't connected
            // credentials, set a reminder 7 days out. The reminder cron can
            // pick this up to nudge them via in-app notification.
            communicationSetupReminderAt:
              (useWhatsapp === true || useEmail === true)
                ? now + SEVEN_DAYS_MS
                : null,
            onboardingCompletedAt: new Date(now).toISOString(),
            // Record the team-invite intent so the checklist can credit
            // the admin's action of choosing to invite, not just the
            // eventual join of a teammate.
            teamInviteIntent: willInviteTeam === true ? 'invited' : 'solo',
            teamInviteIntentAt: now,
          },
        }, {
          // ROUND 9: silent success — the wizard already shows its own rich
          // "Workspace pre-configured: …" toast; a second "Firm settings
          // updated." toast here was noise (and a failure toast right
          // after a success toast was actively confusing).
          successToast: null,
        });
      }
    } catch (e) {
      // Non-blocking — user can always configure channels later.
      console.warn('[OnboardingWizard] failed to persist communication channels:', e);
    } finally {
      setIsSavingFinal(false);
      onComplete();
    }
  };

  const copyInviteCode = async () => {
    if (!firmInviteCode) return;
    try {
      await navigator.clipboard.writeText(firmInviteCode);
      addToast?.('Invite code copied — share it with your team.', { type: 'success' });
    } catch {
      // Clipboard API can be blocked by permissions — fallback to select hint.
      addToast?.('Could not copy automatically — please copy the code manually.', { type: 'info' });
    }
  };

  return (
    <div className="flex flex-col items-center h-full w-full bg-white overflow-y-auto scroll-smooth py-20 px-6">
      {/* Force light theme — onboarding should always be white with green PracticePro branding,
          regardless of system dark mode preference. */}
      {/* SETUP WIZARD EXTENSION: hide the Sign Out button once the firm has
          been created (Steps 3-5) — signing out mid-wizard would lose the
          freshly-created firm's local state and confuse the user. */}
      {step <= 2 && (
        <div className="absolute top-6 right-6">
          <button onClick={() => { try { sessionStorage.removeItem(WIZARD_FLAG_KEY); sessionStorage.removeItem(WIZARD_FLAG_KEY + '_ts'); } catch {} logout(); }} className="flex items-center gap-2 text-xs text-slate-400 hover:text-red-600 border border-slate-100  px-3 py-2 rounded-lg transition-colors shadow-sm"><LogoutIcon className="w-4 h-4" /> Sign Out</button>
        </div>
      )}

      <div className="w-full max-w-3xl space-y-8 animate-fade-in" style={{ animationDuration: '2s', animationDelay: '0.5s', animationFillMode: 'both' }}>
        {error && <div className="p-3 bg-red-50  text-red-600  rounded-lg text-sm text-center border border-red-100  font-bold">{error}</div>}

        {/* ── Progress Indicator — 6 steps total ── */}
        <div className="flex items-center justify-center gap-2 mb-2">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <div key={n} className={`h-2 rounded-full transition-all duration-500 ${step >= n ? 'w-8 bg-primary-500' : 'w-2 bg-slate-200 '}`} />
          ))}
        </div>
        <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
          {`Step ${step} of 6 — ${step <= 2 ? 'Workspace' : step === 3 ? 'Practice Profile' : step === 4 ? 'Communication' : step === 5 ? 'Team' : 'Review'}`}
        </p>

        {/* ── STEP 1: Workspace Name ─────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-8">
            <div className="text-center">
              {/* CRO AUDIT Track C — C5: fork Step 1 copy by product.
                  Vega: "Welcome, {name}. Let's set up your practice."
                  Atrium: "Welcome, {name}. Let's set up your portfolio."
                  Komplete: "Welcome, {name}. Let's set up your unified workspace." */}
              <h2 className="text-4xl font-bold text-slate-900  tracking-tight">Welcome, {currentUser?.name?.split(' ')[0]}</h2>
              <p className="text-slate-500 mt-2 text-sm font-medium">
                {productName === 'Atrium'
                  ? "Let's set up your property portfolio. Atrium tracks rents, invoicing, and tenants across all your properties."
                  : productName === 'Vega'
                  ? "Let's set up your practice. Vega manages matters, deadlines, documents, and billable hours."
                  : "Let's set up your unified workspace. Komplete bridges property assets and legal matters in one place."}
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-6">
              <div className="flex p-1.5 bg-slate-50   rounded-2xl border border-slate-100 ">
                <button onClick={() => { setMode('create'); setError(null); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'create' ? 'bg-white  shadow-lg shadow-slate-200 text-primary-600 ' : 'text-slate-400'}`}>Create New</button>
                <button onClick={() => { setMode('join'); setError(null); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'join' ? 'bg-white  shadow-lg shadow-slate-200 text-primary-600 ' : 'text-slate-400'}`}>Join Existing</button>
              </div>

              {mode === 'create' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div>
                    <label className="block text-2xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                      {productName === 'Atrium'
                        ? 'Property Company / PM Firm Name'
                        : productName === 'Vega'
                        ? 'Law Firm / Practice Name'
                        : 'Firm / Organization Name'}
                    </label>
                    <input autoComplete="off" data-lpignore="true" type="text" placeholder={
                      productName === 'Atrium' ? 'e.g. Landmark Properties, Adeyemi Surveyors'
                      : productName === 'Vega' ? 'e.g. Adeyemi & Co. Solicitors'
                      : 'e.g. Adeyemi & Co.'
                    } value={firmName} onChange={e => setFirmName(e.target.value)} className="w-full p-4 border border-slate-100  rounded-2xl bg-white  focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none text-slate-900  placeholder:text-slate-300" autoFocus />
                  </div>
                  <button onClick={() => { setStep(2); setShowAllPlans(false); }} disabled={!firmName.trim()} className="w-full py-4 bg-primary-600 text-white font-black text-xs uppercase tracking-wide-label rounded-2xl shadow-xl shadow-primary-600/20 hover:bg-primary-700 hover:-translate-y-0.5 transition-all mt-4 active:scale-95 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none">Next: Confirm Plan</button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-2xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Invite Code</label>
                    <input autoComplete="off" data-lpignore="true" type="text" placeholder="INV-XXXX" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} className="w-full p-4 text-center font-mono font-bold text-2xl border border-slate-100  rounded-2xl bg-white  focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none text-slate-900  placeholder:text-slate-200 uppercase" autoFocus />
                  </div>
                  <button onClick={handleJoin} disabled={!inviteCode || isSubmitting} className="w-full py-4 bg-primary-600 text-white font-black text-xs uppercase tracking-wide-label rounded-2xl shadow-xl shadow-primary-600/20 hover:bg-primary-700 hover:-translate-y-0.5 transition-all active:scale-95 flex justify-center disabled:opacity-50 disabled:translate-y-0">
                    {isSubmitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Join Workspace'}
                  </button>
                </div>
              )}

              <div className="pt-8 border-t border-slate-50 text-center">
                <p className="text-2xs font-bold text-slate-400 uppercase tracking-widest mb-3">System Recovery</p>
                <button onClick={handleRecovery} disabled={isRecovering} className="text-xs font-black text-blue-600 dark:text-blue-400 hover:text-blue-700 uppercase tracking-widest flex items-center justify-center gap-2 mx-auto transition-colors">
                  {isRecovering ? <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> : <RevertIcon className="w-4 h-4" />}
                  Recover Connection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Plan Selection ─────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                {showAllPlans ? 'Compare Plans — Pick What Fits Your Practice' : `You've Selected ${tiers[selectedTierId as keyof typeof tiers]?.label || selectedTierId}`}
              </h2>
              <p className="text-slate-500 mt-1 text-sm font-medium">
                For your <span className="font-bold text-slate-700">{productName}</span> workspace{firmName ? ` at ${firmName}` : ''}
              </p>
            </div>

            {/* Product switcher — only if no product was pre-selected from signup */}
            {!userProduct && (
              <div className="flex justify-center gap-3">
                {(['legal', 'property', 'unified'] as ProductMode[]).map(p => {
                  const name = p === 'legal' ? 'Vega' : p === 'property' ? 'Atrium' : 'Komplete';
                  const active = product === p;
                  return (
                    <button key={p} onClick={() => setProduct(p)} className={`px-5 py-2 text-2xs font-black uppercase tracking-widest rounded-full border-2 transition-all ${active ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 ' : 'border-slate-200  text-slate-400 hover:border-slate-300'}`}>
                      {name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Billing Toggle — PRICING AUDIT: now available for Vega AND Atrium (Komplete is annual-only) */}
            {!isKomplete(product) && (
              <div className="flex items-center justify-center gap-4">
                <span className={`text-xs font-bold ${billingCycle === 'monthly' ? 'text-slate-900 ' : 'text-slate-400'}`}>Monthly</span>
                <button onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')} className="relative w-12 h-6 bg-slate-200  rounded-full transition-colors" aria-label="Toggle billing cycle">
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white  rounded-full shadow-sm transition-transform duration-300 ${billingCycle === 'annual' ? 'translate-x-6 bg-primary-500' : ''}`} />
                </button>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${billingCycle === 'annual' ? 'text-slate-900 ' : 'text-slate-400'}`}>Annual</span>
                  <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600  text-3xs font-black uppercase rounded-full border border-emerald-200">Save ~20%</span>
                </div>
              </div>
            )}

            {/* Komplete annual-only badge (Komplete is the only annual-only product now) */}
            {isKomplete(product) && (
              <div className="flex justify-center">
                <span className="px-4 py-1.5 bg-slate-100 text-slate-700 text-2xs font-black uppercase tracking-widest rounded-full border border-slate-200">
                  Annual Billing Only
                </span>
              </div>
            )}

            {/* Komplete single-tier display */}
            {isKomplete(product) ? (
              <div className="max-w-md mx-auto">
                <PlanCard
                  tier={tiers.Core}
                  selected={selectedTierId === 'Core'}
                  onSelect={() => setSelectedTierId('Core')}
                  billingCycle={billingCycle}
                  isAtrium={false}
                  productName="Komplete"
                />
              </div>
            ) : (
              /* Plan display — pre-selected plan front and center by default.
                 'View other plans' button reveals the full 3-tier grid. */
              <div className="max-w-3xl mx-auto">
                {!showAllPlans ? (
                  <div className="space-y-3">
                    {/* Show only the selected plan */}
                    {tierIds.filter(id => id === selectedTierId).map(id => (
                      <div key={id} className="max-w-md mx-auto transition-all duration-300">
                        <PlanCard
                          tier={tiers[id]}
                          selected={true}
                          onSelect={() => setSelectedTierId(id)}
                          billingCycle={billingCycle}
                          isAtrium={isAtrium}
                          productName={productName}
                        />
                      </div>
                    ))}
                    {/* View other plans toggle */}
                    <div className="text-center">
                      <button
                        onClick={() => setShowAllPlans(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-500 hover:text-primary-600 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        Compare with other plans
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Full 3-tier grid with smooth cascade transition */
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
                    {tierIds.map(id => (
                      <PlanCard
                        key={id}
                        tier={tiers[id]}
                        selected={selectedTierId === id}
                        onSelect={() => { setSelectedTierId(id); setShowAllPlans(false); }}
                        billingCycle={billingCycle}
                        isAtrium={isAtrium}
                        productName={productName}
                      />
                    ))}
                  </div>
                )}
                {/* Collapse button when showing all plans */}
                {showAllPlans && (
                  <div className="text-center mt-3">
                    <button
                      onClick={() => setShowAllPlans(false)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-500 hover:text-primary-600 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                      Show selected plan only
                    </button>
                  </div>
                )}
              </div>
            )}

            {isAtrium && (
              <div className="text-2xs text-slate-400 font-bold text-center">
                * SCE: Service Charge Equivalent — estimated monthly cost per tenant unit.
              </div>
            )}

            {/* Managed Migration opt-in */}
            {isAtrium && (
              <div className="max-w-md mx-auto p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="data-migration" checked={isDataMigration} onChange={e => setIsDataMigration(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                  <label htmlFor="data-migration" className="text-xs font-bold text-slate-700 cursor-pointer flex-1">
                    Managed Data Migration <span className="font-normal text-slate-500">(+₦150k)</span>
                  </label>
                  <details className="group/det">
                    <summary className="text-2xs font-semibold text-primary-600 cursor-pointer hover:text-primary-800 transition-colors list-none inline-flex items-center gap-1">
                      What's included
                      <svg className="w-3 h-3 transition-transform group-open/det:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </summary>
                    <div className="absolute mt-2 p-3 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-w-xs space-y-1.5 text-2xs text-slate-600 leading-relaxed">
                      <p>We digitize your existing property records and upload them into Atrium so you can start immediately.</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-primary-400 flex-shrink-0" />
                            <span>Up to <strong>50 tenant/unit</strong> entries</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-primary-400 flex-shrink-0" />
                            <span><strong>Lease terms</strong> & rent cycles</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-primary-400 flex-shrink-0" />
                            <span><strong>Property details</strong> & unit specs</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-primary-400 flex-shrink-0" />
                            <span><strong>Opening balances</strong> if available</span>
                          </div>
                        </div>
                        <p className="text-slate-500 mt-1.5">Additional entries beyond 50 units: ₦2,500 per entry.</p>
                      </div>
                    </details>
                </div>
              </div>
            )}

            {/* DPA Agreement */}
            <div className="max-w-md mx-auto pt-2 flex items-start gap-3">
              <input autoComplete="off" data-lpignore="true" type="checkbox" id="agree-dpa" checked={hasAgreed} onChange={e => setHasAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 text-primary-600  border-slate-200  rounded focus:ring-primary-500 cursor-pointer transition-all" />
              <label htmlFor="agree-dpa" className="text-2xs text-slate-400 font-medium leading-relaxed cursor-pointer select-none">
                I agree to the <button type="button" onClick={() => openLegalDocument('dpa')} className="text-primary-600  hover:underline font-bold">Data Protection Agreement</button> and <button type="button" onClick={() => openLegalDocument('terms')} className="text-primary-600  hover:underline font-bold">Terms of Service</button>. Data is processed per Nigerian standards.
              </label>
            </div>

            {/* Tier-specific action buttons */}
            {(() => {
              const isKompleteTier = isKomplete(product);
              const isHighestTier = isKompleteTier || selectedTierId === 'Pro' || selectedTierId === 'Enterprise';
              const planLabel = isKompleteTier ? 'Komplete' : selectedTierId;
              // CRO AUDIT FIX: Komplete is annual-only at ₦2.5M/yr. Always use annualPrice
              // from the tier definition (never hardcode). For Komplete, billingCycle is
              // forced to 'annual' regardless of the toggle.
              const effectiveBilling = isKompleteTier ? 'annual' : billingCycle;
              const planPrice = isKompleteTier
                ? (tiers.Core?.annualPrice || 0)
                : (tiers[selectedTierId]?.[effectiveBilling === 'annual' ? 'annualPrice' : 'monthlyPrice'] || 0);

              return (
                <div className="max-w-md mx-auto pt-2 space-y-3">
                  {/* Back button */}
                  <button onClick={() => {
                    setStep(1);
                    // CRO AUDIT FIX (Track C — C2): auto-reset showAllPlans to false
                    // when the user returns to the plan step, so they see their
                    // selected tier centered rather than the full comparison grid.
                    setShowAllPlans(false);
                  }} className="w-full py-3 bg-slate-50 text-slate-400 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-all" disabled={isSubmitting}>
                    ← Back
                  </button>

                  {/* CRO AUDIT FIX (Track C — C2): renamed "Pay Now" → "Confirm Plan".
                      The Step 1 CTA already says "Next: Confirm Plan", so the Step 2
                      primary CTA must match that language. */}
                  <button
                    onClick={() => { setPaymentAction('pay_now'); setShowPaymentModal(true); }}
                    disabled={isSubmitting || !hasAgreed}
                    className={`w-full py-4 text-white font-black text-xs uppercase tracking-wide-label rounded-2xl shadow-xl flex justify-center items-center gap-2 transition-all ${isSubmitting || !hasAgreed ? 'bg-slate-200 cursor-not-allowed shadow-none' : 'bg-primary-600 hover:bg-primary-700 shadow-primary-600/20'}`}
                  >
                    {isSubmitting && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {isSubmitting ? 'Creating...' : `Confirm Plan — ${planLabel}`}
                  </button>

                  {/* Start 30-Day Free Trial — NOT available on highest tier */}
                  {!isHighestTier && (
                    <>
                      <div className="flex items-center gap-3 py-1">
                        <div className="flex-1 h-px bg-slate-100" />
                        <span className="text-2xs text-slate-400 font-bold uppercase">or</span>
                        <div className="flex-1 h-px bg-slate-100" />
                      </div>
                      <button
                        onClick={() => { setPaymentAction('start_trial'); handleCreate(true); }}
                        disabled={isSubmitting || !hasAgreed}
                        className="w-full py-3 bg-white border-2 border-primary-200 text-primary-600 font-black text-xs uppercase tracking-wide-label rounded-2xl hover:bg-primary-50 transition-all disabled:opacity-50"
                      >
                        Start 30-Day Free Trial
                      </button>
                      {/* Subtle upsell for Core tier — suggest trying the highest tier */}
                      {selectedTierId === 'Core' && !isKompleteTier && (
                        <p className="text-center text-2xs text-slate-400 mt-1">
                          Want full features? <button onClick={() => { setSelectedTierId('Pro'); setShowAllPlans(false); }} className="text-primary-600 font-bold hover:underline">Try Pro free for 30 days</button> instead.
                        </p>
                      )}
                    </>
                  )}

                  {/* Highest tier — payment only, no trial */}
                  {isHighestTier && (
                    <p className="text-center text-2xs text-slate-400">
                      The {planLabel} tier requires payment to activate. Click "Confirm Plan" to proceed with bank transfer.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* CRO AUDIT FIX (Track A — A3): replaced the stub "Payment Reported"
                modal with the real PaymentGatewayModal component. Users now see
                actual bank details, amount, and a generated transaction reference.
                The modal calls createSubscriptionRequest to write a pending row
                (no immediate plan flip) — the founder admin or Paystack webhook
                activates the subscription after verification. */}
            {paymentAction === 'pay_now' && showPaymentModal && (
              <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/50">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                  <PaymentGatewayModal
                    amount={(() => {
                      const isKompleteTier = isKomplete(product);
                      // CRO AUDIT FIX: Komplete is annual-only at ₦2.5M/yr (no monthly option).
                      const planPrice = isKompleteTier
                        ? (tiers.Core?.annualPrice || 0)
                        : (tiers[selectedTierId]?.[billingCycle === 'annual' ? 'annualPrice' : 'monthlyPrice'] || 0);
                      return planPrice;
                    })()}
                    email={currentUser?.email || ''}
                    title={`Confirm Plan — ${isKomplete(product) ? 'Komplete' : selectedTierId}`}
                    description={`${isKomplete(product) ? 'Annual' : (billingCycle === 'annual' ? 'Annual' : 'Monthly')} subscription — ${firmName}`}
                    forcePracticeProAccount={true}
                    // No subscriptionContext for onboarding — the firm doesn't exist yet.
                    // The user pays AFTER workspace creation via the in-app SubscriptionSettings.
                    // For onboarding, "Confirm Plan" just creates the firm at Core (or trial).
                    onSuccess={() => {
                      setShowPaymentModal(false);
                      // After the user reports payment, create the firm at Core.
                      // The founder admin will see the pending payment and activate
                      // the requested plan once verified.
                      handleCreate(false);
                    }}
                    onClose={() => setShowPaymentModal(false)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Practice Profile ─────────────────────────────── */}
        {/* The "type of practice" configuration step. Atrium users describe
            their portfolio composition + what their firm actually does;
            Vega users pick practice areas; everyone picks their state(s) of
            operation. Persisted to firmDetails and consumed by the AI
            (jurisdiction captions, procedural rules, drafting focus),
            workflow defaults, and the Getting-Started checklist. */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                {isAtrium ? 'What kind of properties do you manage?' : 'What kind of practice do you run?'}
              </h2>
              <p className="text-slate-500 mt-2 text-sm font-medium max-w-lg mx-auto">
                This configures {productName === 'Atrium' ? 'ARIA, your AI property assistant' : productName === 'Vega' ? 'ALOA, your AI legal assistant' : 'your AI assistants'} — the right state's laws, court captions, and drafting style from your very first document. It also tailors your workspace defaults.
              </p>
            </div>

            {/* ── State(s) of operation — ALL products ── */}
            <div className="max-w-lg mx-auto space-y-4">
              <div>
                <label className="block text-2xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  Primary State of Operation
                </label>
                <select
                  value={primaryState}
                  onChange={e => {
                    const v = e.target.value;
                    setPrimaryState(v);
                    // If the new primary was in additional states, drop it there
                    setAdditionalStates(prev => prev.filter(s => s !== v));
                  }}
                  className="w-full p-3.5 border border-slate-100 rounded-2xl bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none text-slate-900 font-medium"
                >
                  {NIGERIAN_STATES.map(s => (
                    <option key={s.key} value={s.key}>{s.name}</option>
                  ))}
                </select>
                <p className="text-2xs text-slate-400 font-medium mt-1.5 ml-1">
                  {isAtrium
                    ? 'Where most of your portfolio sits — notices will cite this state\u2019s tenancy law by default.'
                    : 'Your default judicial division — court processes use this state\u2019s captions and rules.'}
                </p>
              </div>

              <div>
                <label className="block text-2xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  Also operate in… <span className="normal-case font-medium">(optional — pick all that apply)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {NIGERIAN_STATES.filter(s => s.key !== primaryState).slice(0, 12).map(s => (
                    <button
                      key={s.key}
                      onClick={() => toggleInArray(additionalStates, setAdditionalStates, s.key, 6)}
                      className={`px-3 py-1.5 text-2xs font-bold rounded-full border-2 transition-all ${additionalStates.includes(s.key) ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                    >
                      {s.name.replace(' State', '').replace('Federal Capital Territory (Abuja)', 'FCT')}
                    </button>
                  ))}
                  {additionalStates.length >= 6 && (
                    <span className="text-2xs text-slate-400 font-medium self-center">Max 6 additional states</span>
                  )}
                </div>
                {additionalStates.length > 0 && (
                  <p className="text-2xs text-emerald-600 font-bold mt-2 ml-1">
                    ✓ Multi-state mode: drafts will switch to the correct state\u2019s rules when a matter or property is located there.
                  </p>
                )}
              </div>
            </div>

            {/* ── Vega: practice areas ── */}
            {!isAtrium && (
              <div className="max-w-lg mx-auto">
                <label className="block text-2xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  Practice Areas <span className="normal-case font-medium">(select all that apply)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    FirmSpecialty.Litigation,
                    FirmSpecialty.Corporate,
                    FirmSpecialty.RealEstate,
                    'Family Law & Probate',
                    'Criminal Defence',
                    'Employment & Labour',
                    'Banking & Finance',
                    'Intellectual Property',
                    FirmSpecialty.Tax,
                    FirmSpecialty.OilGas,
                    FirmSpecialty.Maritime,
                    'Tech, Data & Compliance',
                    FirmSpecialty.General,
                  ].map(area => (
                    <button
                      key={area}
                      onClick={() => toggleInArray(practiceAreas, setPracticeAreas, area)}
                      className={`px-3.5 py-2 text-xs font-bold rounded-full border-2 transition-all ${practiceAreas.includes(area) ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Atrium: portfolio composition ── */}
            {(isAtrium || isKomplete(product)) && (
              <div className="max-w-lg mx-auto">
                <label className="block text-2xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  Portfolio Composition <span className="normal-case font-medium">(select all that apply)</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PORTFOLIO_TYPE_OPTIONS.map(pt => (
                    <button
                      key={pt.value}
                      onClick={() => toggleInArray(portfolioTypes, setPortfolioTypes, pt.value)}
                      className={`p-3 text-left rounded-xl border-2 transition-all ${portfolioTypes.includes(pt.value) ? 'border-primary-400 bg-primary-50/60' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                      <p className={`text-xs font-bold ${portfolioTypes.includes(pt.value) ? 'text-primary-700' : 'text-slate-700'}`}>{pt.label}</p>
                      <p className="text-2xs text-slate-400 font-medium mt-0.5">{pt.hint}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Atrium: focus areas + scale ── */}
            {(isAtrium || isKomplete(product)) && (
              <div className="max-w-lg mx-auto space-y-4">
                <div>
                  <label className="block text-2xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                    What does your firm focus on? <span className="normal-case font-medium">(select all that apply)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ATRIUM_FOCUS_OPTIONS.map(f => (
                      <button
                        key={f.value}
                        onClick={() => toggleInArray(focusAreas, setFocusAreas, f.value)}
                        className={`px-3.5 py-2 text-xs font-bold rounded-full border-2 transition-all ${focusAreas.includes(f.value) ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-2xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                    Units under management <span className="normal-case font-medium">(optional)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 40"
                    value={unitsUnderManagement}
                    onChange={e => setUnitsUnderManagement(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-40 p-3 border border-slate-100 rounded-2xl bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none text-slate-900 placeholder:text-slate-300"
                  />
                </div>
              </div>
            )}

            <div className="max-w-lg mx-auto pt-2 space-y-3">
              <button
                onClick={() => setStep(4)}
                disabled={!primaryState}
                className="w-full py-4 bg-primary-600 text-white font-black text-xs uppercase tracking-wide-label rounded-2xl shadow-xl shadow-primary-600/20 hover:bg-primary-700 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
              >
                Next: Communication Channels
              </button>
              <p className="text-center text-2xs text-slate-400">
                You can refine this anytime from Settings → Firm Details.
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 4: Communication Channels ─────────────────────────── */}
        {/* Per user spec: ask whether the user will use email or WhatsApp,
            clarify the relevance of both, and do NOT ask for their phone
            number, WhatsApp Business API token, or Brevo/Sendgrid API key.
            We record intent only — credentials are configured later in
            Settings → Integrations. */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                How will you reach {productName === 'Atrium' ? 'tenants' : productName === 'Vega' ? 'clients' : 'clients & tenants'}?
              </h2>
              <p className="text-slate-500 mt-2 text-sm font-medium max-w-md mx-auto">
                Pick the channels you intend to use. You can connect credentials later from <span className="font-bold text-slate-700">Settings → Integrations</span> — we'll send a friendly reminder in 7 days if you haven't.
              </p>
            </div>

            {/* WhatsApp channel card */}
            <div className={`max-w-md mx-auto p-5 rounded-2xl border-2 transition-all ${useWhatsapp === true ? 'border-emerald-400 bg-emerald-50/40' : useWhatsapp === false ? 'border-slate-100 opacity-60' : 'border-slate-100'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.967-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.27 9.27 0 01-4.726-1.293l-.339-.202-3.511.921.938-3.426-.219-.351a9.264 9.264 0 01-1.421-4.951c.002-5.12 4.165-9.282 9.286-9.282 2.481 0 4.811.967 6.563 2.721a9.244 9.244 0 012.72 6.569c-.002 5.118-4.165 9.282-9.286 9.282"/></svg>
                    <h3 className="text-base font-bold text-slate-900">WhatsApp</h3>
                  </div>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1.5">
                    {WHATSAPP_RELEVANCE}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setUseWhatsapp(true)}
                  className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-md transition-all ${useWhatsapp === true ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                  Yes — I'll use WhatsApp
                </button>
                <button
                  onClick={() => setUseWhatsapp(false)}
                  className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-md transition-all ${useWhatsapp === false ? 'bg-slate-200 text-slate-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                  Not yet
                </button>
              </div>
            </div>

            {/* Email channel card */}
            <div className={`max-w-md mx-auto p-5 rounded-2xl border-2 transition-all ${useEmail === true ? 'border-blue-400 bg-blue-50/40' : useEmail === false ? 'border-slate-100 opacity-60' : 'border-slate-100'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <h3 className="text-base font-bold text-slate-900">Email</h3>
                  </div>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1.5">
                    {EMAIL_RELEVANCE}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setUseEmail(true)}
                  className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-md transition-all ${useEmail === true ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                  Yes — I'll use Email
                </button>
                <button
                  onClick={() => setUseEmail(false)}
                  className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-md transition-all ${useEmail === false ? 'bg-slate-200 text-slate-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                  Not yet
                </button>
              </div>
            </div>

            {/* Soft note if both are skipped */}
            {useWhatsapp === false && useEmail === false && (
              <p className="text-center text-2xs text-slate-500 font-medium max-w-md mx-auto">
                No problem — we'll send in-app notifications only. You can connect WhatsApp and Email anytime from <span className="font-bold text-slate-700">Settings → Integrations</span>.
              </p>
            )}

            <div className="max-w-md mx-auto pt-2 space-y-3">
              <button
                onClick={() => setStep(5)}
                disabled={useWhatsapp === null || useEmail === null}
                className="w-full py-4 bg-primary-600 text-white font-black text-xs uppercase tracking-wide-label rounded-2xl shadow-xl shadow-primary-600/20 hover:bg-primary-700 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
              >
                Next: Team Setup
              </button>
              <button
                onClick={() => setStep(3)}
                className="w-full py-3 bg-slate-50 text-slate-400 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-all"
              >
                ← Back
              </button>
              <p className="text-center text-2xs text-slate-400">
                You can change these anytime from Settings → Integrations.
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 5: Team Setup ─────────────────────────────────────── */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                Will anyone else work in this workspace?
              </h2>
              <p className="text-slate-500 mt-2 text-sm font-medium max-w-md mx-auto">
                Invite teammates now, or skip and add them later from <span className="font-bold text-slate-700">Settings → Team</span>.
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-3">
              <button
                onClick={() => setWillInviteTeam(true)}
                className={`w-full p-4 text-left rounded-2xl border-2 transition-all ${willInviteTeam === true ? 'border-primary-500 bg-primary-50/40' : 'border-slate-100 hover:border-slate-200'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Yes — invite my team</p>
                    <p className="text-2xs text-slate-500 font-medium mt-0.5">Lawyers, paralegals, property officers, accountants — anyone who'll work in PracticePro.</p>
                  </div>
                  {willInviteTeam === true && <CheckIcon className="w-5 h-5 text-primary-600 flex-shrink-0" />}
                </div>
              </button>
              <button
                onClick={() => setWillInviteTeam(false)}
                className={`w-full p-4 text-left rounded-2xl border-2 transition-all ${willInviteTeam === false ? 'border-primary-500 bg-primary-50/40' : 'border-slate-100 hover:border-slate-200'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Not right now — it's just me</p>
                    <p className="text-2xs text-slate-500 font-medium mt-0.5">You can invite team members anytime from Settings → Team.</p>
                  </div>
                  {willInviteTeam === false && <CheckIcon className="w-5 h-5 text-primary-600 flex-shrink-0" />}
                </div>
              </button>
            </div>

            {/* Invite code panel — shown whenever the user has answered the question.
                Either way, we surface the code so they can copy & share it now
                or come back to it later. */}
            {willInviteTeam !== null && (
              <div className="max-w-md mx-auto p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xs font-black text-slate-400 uppercase tracking-widest">Your Workspace Invite Code</p>
                    <p className="text-2xs text-slate-500 font-medium mt-0.5">
                      {willInviteTeam
                        ? 'Share this code with your team — they enter it on the signup page to join your workspace.'
                        : 'Save this code in case you want to invite someone later.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 px-4 py-3 bg-white rounded-md border border-slate-200 font-mono font-bold text-lg text-center text-slate-900 tracking-widest">
                    {firmInviteCode || (firmBasicInfo === undefined ? 'Loading…' : '—')}
                  </div>
                  <button
                    onClick={copyInviteCode}
                    disabled={!firmInviteCode}
                    className="px-4 py-3 bg-primary-600 text-white text-xs font-black uppercase tracking-widest rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    Copy
                  </button>
                </div>
                {willInviteTeam && (
                  <p className="text-2xs text-slate-500 font-medium leading-relaxed">
                    Team members join with the role <span className="font-bold">Lawyer</span> by default — you can change roles and permissions from <span className="font-bold">Settings → Team</span> once they're in.
                  </p>
                )}
              </div>
            )}

            <div className="max-w-md mx-auto pt-2 space-y-3">
              <button
                onClick={() => setStep(6)}
                disabled={willInviteTeam === null}
                className="w-full py-4 bg-primary-600 text-white font-black text-xs uppercase tracking-wide-label rounded-2xl shadow-xl shadow-primary-600/20 hover:bg-primary-700 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
              >
                Next: Review & Confirm
              </button>
              <button
                onClick={() => setStep(4)}
                className="w-full py-3 bg-slate-50 text-slate-400 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-all"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 6: Review & Confirm ───────────────────────────────── */}
        {step === 6 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                You're all set, {currentUser?.name?.split(' ')[0] || 'there'}!
              </h2>
              <p className="text-slate-500 mt-2 text-sm font-medium max-w-md mx-auto">
                Review your setup below. You can change any of this from Settings once you're in.
              </p>
            </div>

            <div className="max-w-md mx-auto rounded-2xl border border-slate-100 overflow-hidden">
              {/* Workspace row */}
              <div className="px-5 py-4 border-b border-slate-50">
                <p className="text-2xs font-black text-slate-400 uppercase tracking-widest">Workspace</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{firmName || 'My Workspace'}</p>
                <p className="text-2xs text-slate-500 font-medium">
                  {productName === 'Atrium' ? 'Atrium · Property Management' : productName === 'Vega' ? 'Vega · Legal Practice' : 'Komplete · Unified Workspace'}
                </p>
              </div>

              {/* Plan row */}
              <div className="px-5 py-4 border-b border-slate-50">
                <p className="text-2xs font-black text-slate-400 uppercase tracking-widest">Plan</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {isKomplete(product) ? 'Komplete' : selectedTierId}
                  <span className="text-2xs text-slate-500 font-medium ml-1.5">
                    ({billingCycle === 'annual' && !isKomplete(product) ? 'Annual' : isKomplete(product) ? 'Annual (only)' : 'Monthly'})
                  </span>
                </p>
              </div>

              {/* Practice Profile row */}
              <div className="px-5 py-4 border-b border-slate-50">
                <p className="text-2xs font-black text-slate-400 uppercase tracking-widest">Practice Profile</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {NIGERIAN_STATES.find(s => s.key === primaryState)?.name || primaryState}
                  {additionalStates.length > 0 && (
                    <span className="text-2xs text-slate-500 font-medium"> + {additionalStates.length} more state{additionalStates.length > 1 ? 's' : ''}</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {practiceAreas.slice(0, 4).map(a => (
                    <span key={a} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-2xs font-bold rounded-full border border-indigo-100">{a}</span>
                  ))}
                  {portfolioTypes.map(pt => {
                    const opt = PORTFOLIO_TYPE_OPTIONS.find(o => o.value === pt);
                    return <span key={pt} className="px-2 py-0.5 bg-teal-50 text-teal-700 text-2xs font-bold rounded-full border border-teal-100">{opt?.label || pt}</span>;
                  })}
                  {focusAreas.slice(0, 3).map(f => (
                    <span key={f} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-2xs font-bold rounded-full border border-amber-100">{ATRIUM_FOCUS_OPTIONS.find(o => o.value === f)?.label || f}</span>
                  ))}
                  {unitsUnderManagement && (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-2xs font-bold rounded-full border border-slate-200">{unitsUnderManagement}+ units</span>
                  )}
                  {practiceAreas.length === 0 && portfolioTypes.length === 0 && focusAreas.length === 0 && (
                    <span className="text-2xs text-slate-400 font-medium">General practice — configure later if needed</span>
                  )}
                </div>
              </div>

              {/* Workspace Blueprint row — what the engine will pre-configure */}
              {blueprintPlan && (practiceAreas.length > 0 || portfolioTypes.length > 0 || focusAreas.length > 0) && (
                <div className="px-5 py-4 border-b border-slate-50 bg-emerald-50/40">
                  <p className="text-2xs font-black text-emerald-600 uppercase tracking-widest">Workspace Blueprint</p>
                  <p className="text-2xs text-slate-500 font-medium mt-1 leading-relaxed">
                    When you press finish we pre-configure your workspace — nothing to do manually. You can refine everything later.
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {blueprintPlan.counts.matterTypes > 0 && (
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-2xs font-bold rounded-full border border-indigo-100">
                        {blueprintPlan.counts.matterTypes} matter types · {blueprintPlan.counts.subCategories} sub-categories
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-2xs font-bold rounded-full border border-emerald-100">
                      {blueprintPlan.counts.contactTypes} contact types
                    </span>
                    <span className="px-2 py-0.5 bg-teal-50 text-teal-700 text-2xs font-bold rounded-full border border-teal-100">
                      {blueprintPlan.counts.documentCategories} document folders
                    </span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-2xs font-bold rounded-full border border-blue-100">
                      {blueprintPlan.counts.eventTypes} event types
                    </span>
                    {blueprintPlan.counts.checklists > 0 && (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-2xs font-bold rounded-full border border-amber-100">
                        {blueprintPlan.counts.checklists} checklists
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Communication channels row */}
              <div className="px-5 py-4 border-b border-slate-50">
                <p className="text-2xs font-black text-slate-400 uppercase tracking-widest">Communication Channels</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {useWhatsapp === true && (
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-2xs font-bold uppercase tracking-widest rounded-full border border-emerald-200">WhatsApp</span>
                  )}
                  {useEmail === true && (
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-2xs font-bold uppercase tracking-widest rounded-full border border-blue-200">Email</span>
                  )}
                  {useWhatsapp !== true && useEmail !== true && (
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-2xs font-bold uppercase tracking-widest rounded-full border border-slate-200">In-app only</span>
                  )}
                </div>
                {(useWhatsapp === true || useEmail === true) && (
                  <p className="text-2xs text-slate-500 font-medium mt-2">
                    We'll remind you to connect credentials in 7 days if you haven't yet.
                  </p>
                )}
              </div>

              {/* Team row */}
              <div className="px-5 py-4">
                <p className="text-2xs font-black text-slate-400 uppercase tracking-widest">Team</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {willInviteTeam ? 'Invite my team now' : 'Just me for now'}
                </p>
                {firmInviteCode && (
                  <p className="text-2xs text-slate-500 font-medium mt-1">
                    Invite code: <span className="font-mono font-bold text-slate-700">{firmInviteCode}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="max-w-md mx-auto pt-2 space-y-3">
              <button
                onClick={handleCompleteWizard}
                disabled={isSavingFinal}
                className="w-full py-4 bg-primary-600 text-white font-black text-xs uppercase tracking-wide-label rounded-2xl shadow-xl shadow-primary-600/20 hover:bg-primary-700 hover:-translate-y-0.5 transition-all active:scale-95 flex justify-center disabled:opacity-50"
              >
                {isSavingFinal ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {setupStageLabel || 'Configuring your workspace…'}
                  </span>
                ) : (
                  'Start using PracticePro'
                )}
              </button>
              {isSavingFinal && (
                <p className="text-center text-2xs text-slate-400 font-medium">
                  Keep this page open — we are creating your matter types, contact
                  types, folders and checklists. This usually takes under a minute.
                </p>
              )}
              <button
                onClick={() => setStep(5)}
                disabled={isSavingFinal}
                className="w-full py-3 bg-slate-50 text-slate-400 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-all disabled:opacity-50"
              >
                ← Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingWizard;
