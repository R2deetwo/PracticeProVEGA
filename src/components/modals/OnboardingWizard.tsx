
import React, { useState, useEffect } from 'react';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { SubscriptionPlan } from '../../types';
import { translateError } from '../../utils/errorTranslator';
import { openLegalDocument } from '../../utils/legalLinks';
import { useAuth } from '../../contexts/AuthContext';
import { LogoutIcon, CheckIcon, LockClosedIcon, RevertIcon } from '../../constants';
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUI } from '../../contexts/UIContext';
import { getTiersForProduct, DISPLAY_TIER_IDS, ProductMode, TierId, TierDef, formatTierPrice, isKomplete } from '../../constants/tiers';

interface OnboardingWizardProps {
  onComplete: () => void;
}

const PlanCard: React.FC<{
  tier: TierDef;
  selected: boolean;
  onSelect: () => void;
  billingCycle: 'monthly' | 'annual';
  isAtrium: boolean;
}> = ({ tier, selected, onSelect, billingCycle, isAtrium }) => {
  const { price, per } = formatTierPrice(tier, billingCycle);
  const effectiveBilling = isAtrium ? 'annual' : billingCycle;
  const sce = effectiveBilling === 'annual' ? tier.scePer_annual : tier.scePer;

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
      {tier.recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-emerald-600 text-white text-3xs font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-lg whitespace-nowrap z-10">
          Most Popular
        </div>
      )}

      <div className="p-5 flex flex-col h-full">
        {/* Tier name + check */}
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-black text-2xs uppercase tracking-widest text-slate-400">{tier.label}</h4>
          {selected && <div className="w-4 h-4 bg-primary-600 rounded-full flex items-center justify-center text-white p-0.5"><CheckIcon className="w-full h-full" /></div>}
        </div>

        {/* Price */}
        <div className="mb-4">
          <p className="text-2xl font-black text-slate-900  tracking-tighter leading-none">{price}</p>
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
  const { createFirm, joinFirm } = useDataActions();
  const { currentUser, logout, refreshUser } = useAuth();
  const { navigateTo } = useUI();
  const repairAccountMutation = useMutation(api.myFunctions.repairAccountConnection);

  // Use the product the user selected during signup
  // This is stored on the user record by the backend
  const userProduct = (currentUser as any)?.product as ProductMode | undefined;

  // Step 1: Workspace name | Step 2: Plan selection (product already known from signup)
  const [step, setStep] = useState(1);
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

  const handleCreate = async () => {
    if (!firmName.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const plan = isKomplete(product) ? SubscriptionPlan.Komplete : tierToSubscriptionPlan[selectedTierId];
      const fid = await createFirm(
        firmName.trim(),
        'Address Pending',
        plan,
        { email: currentUser!.email, name: currentUser!.name },
        product,
        isDataMigration
      );
      if (fid) {
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
          onComplete();
        } catch (refreshErr) {
          // refreshUser timed out or failed — but the firm WAS created.
          // Force a page reload so the user's session picks up the new firmId.
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

  return (
    <div className="flex flex-col items-center h-full w-full bg-white overflow-y-auto scroll-smooth py-20 px-6">
      {/* Force light theme — onboarding should always be white with green PracticePro branding,
          regardless of system dark mode preference. */}
      <div className="absolute top-6 right-6">
        <button onClick={logout} className="flex items-center gap-2 text-xs text-slate-400 hover:text-red-600 border border-slate-100  px-3 py-2 rounded-xl transition-colors shadow-sm"><LogoutIcon className="w-4 h-4" /> Sign Out</button>
      </div>

      <div className="w-full max-w-3xl space-y-8 animate-fade-in" style={{ animationDuration: '2s', animationDelay: '0.5s', animationFillMode: 'both' }}>
        {error && <div className="p-3 bg-red-50  text-red-600  rounded-lg text-sm text-center border border-red-100  font-bold">{error}</div>}

        {/* ── Progress Indicator ── */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className={`h-2 rounded-full transition-all duration-500 ${step >= 1 ? 'w-8 bg-primary-500' : 'w-2 bg-slate-200 '}`} />
          <div className={`h-2 rounded-full transition-all duration-500 ${step >= 2 ? 'w-8 bg-primary-500' : 'w-2 bg-slate-200 '}`} />
        </div>
        <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Step {step} of 2</p>

        {/* ── STEP 1: Workspace Name ─────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-4xl font-black text-slate-900  tracking-tighter">Welcome, {currentUser?.name?.split(' ')[0]}</h2>
              <p className="text-slate-500 mt-2 text-sm font-medium">Initialize your secure workspace.</p>
            </div>

            <div className="max-w-md mx-auto space-y-6">
              <div className="flex p-1.5 bg-slate-50   rounded-2xl border border-slate-100 ">
                <button onClick={() => { setMode('create'); setError(null); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${mode === 'create' ? 'bg-white  shadow-lg shadow-slate-200 text-primary-600 ' : 'text-slate-400'}`}>Create New</button>
                <button onClick={() => { setMode('join'); setError(null); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${mode === 'join' ? 'bg-white  shadow-lg shadow-slate-200 text-primary-600 ' : 'text-slate-400'}`}>Join Existing</button>
              </div>

              {mode === 'create' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div>
                    <label className="block text-2xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Firm / Organization Name</label>
                    <input autoComplete="off" data-lpignore="true" type="text" placeholder="e.g. Adeyemi & Co." value={firmName} onChange={e => setFirmName(e.target.value)} className="w-full p-4 border border-slate-100  rounded-2xl bg-white  focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none text-slate-900  placeholder:text-slate-300" autoFocus />
                  </div>
                  <button onClick={() => { setStep(2); setShowAllPlans(false); }} disabled={!firmName.trim()} className="w-full py-4 bg-primary-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary-600/20 hover:bg-primary-700 hover:-translate-y-0.5 transition-all mt-4 active:scale-95 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none">Next: Confirm Plan</button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-2xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Invite Code</label>
                    <input autoComplete="off" data-lpignore="true" type="text" placeholder="INV-XXXX" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} className="w-full p-4 text-center font-mono font-bold text-2xl border border-slate-100  rounded-2xl bg-white  focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none text-slate-900  placeholder:text-slate-200 uppercase" autoFocus />
                  </div>
                  <button onClick={handleJoin} disabled={!inviteCode || isSubmitting} className="w-full py-4 bg-primary-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary-600/20 hover:bg-primary-700 hover:-translate-y-0.5 transition-all active:scale-95 flex justify-center disabled:opacity-50 disabled:translate-y-0">
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
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
                {showAllPlans ? 'Compare Plans' : `Your ${selectedTierId === 'Core' ? 'Core' : selectedTierId} Plan`}
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

            {/* Billing Toggle — Vega and Komplete only. Atrium is annual-only. */}
            {!isAtrium && !isKomplete(product) && (
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

            {/* Atrium annual-only badge */}
            {isAtrium && (
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
              <div className="max-w-md mx-auto p-4 rounded-xl bg-slate-50 border border-slate-200">
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
              const planPrice = isKompleteTier
                ? (billingCycle === 'annual' ? 1248000 : 130000)
                : (tiers[selectedTierId]?.[billingCycle === 'annual' ? 'annualPrice' : 'monthlyPrice'] || 0);

              return (
                <div className="max-w-md mx-auto pt-2 space-y-3">
                  {/* Back button */}
                  <button onClick={() => setStep(1)} className="w-full py-3 bg-slate-50 text-slate-400 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-all" disabled={isSubmitting}>
                    ← Back
                  </button>

                  {/* Pay Now — available on ALL tiers */}
                  <button
                    onClick={() => { setPaymentAction('pay_now'); setShowPaymentModal(true); }}
                    disabled={isSubmitting || !hasAgreed}
                    className={`w-full py-4 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl flex justify-center items-center gap-2 transition-all ${isSubmitting || !hasAgreed ? 'bg-slate-200 cursor-not-allowed shadow-none' : 'bg-primary-600 hover:bg-primary-700 shadow-primary-600/20'}`}
                  >
                    {isSubmitting && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {isSubmitting ? 'Creating...' : `Pay Now — ${planLabel}`}
                  </button>

                  {/* Start 14-Day Free Trial — NOT available on highest tier */}
                  {!isHighestTier && (
                    <>
                      <div className="flex items-center gap-3 py-1">
                        <div className="flex-1 h-px bg-slate-100" />
                        <span className="text-2xs text-slate-400 font-bold uppercase">or</span>
                        <div className="flex-1 h-px bg-slate-100" />
                      </div>
                      <button
                        onClick={() => { setPaymentAction('start_trial'); handleCreate(); }}
                        disabled={isSubmitting || !hasAgreed}
                        className="w-full py-3 bg-white border-2 border-primary-200 text-primary-600 font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-primary-50 transition-all disabled:opacity-50"
                      >
                        Start 14-Day Free Trial
                      </button>
                      {/* Subtle upsell for Core tier — suggest trying the highest tier */}
                      {selectedTierId === 'Core' && !isKompleteTier && (
                        <p className="text-center text-2xs text-slate-400 mt-1">
                          Want full features? <button onClick={() => { setSelectedTierId('Pro'); setShowAllPlans(false); }} className="text-primary-600 font-bold hover:underline">Try Pro free for 14 days</button> instead.
                        </p>
                      )}
                    </>
                  )}

                  {/* Highest tier — payment only, no trial */}
                  {isHighestTier && (
                    <p className="text-center text-2xs text-slate-400">
                      The {planLabel} tier requires payment to activate. Click "Pay Now" to proceed with bank transfer.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Payment Reported confirmation — replaces Create Workspace after payment */}
            {paymentAction === 'pay_now' && showPaymentModal && (
              <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/50">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Payment Reported</h3>
                    <p className="text-sm text-slate-500 mt-2">PracticePro will verify your bank transfer and update your organization invoice status within 24 hours.</p>
                  </div>
                  <button
                    onClick={() => { setShowPaymentModal(false); handleCreate(); }}
                    className="w-full py-3 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors"
                  >
                    Continue to Workspace
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingWizard;
