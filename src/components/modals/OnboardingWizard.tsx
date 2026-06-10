
import React, { useState } from 'react';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { SubscriptionPlan } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { LogoutIcon, CheckIcon, LockClosedIcon, RevertIcon } from '../../constants';
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUI } from '../../contexts/UIContext';
import { getTiersForProduct, DISPLAY_TIER_IDS, ProductMode, TierId, TierDef } from '../../constants/tiers';

interface OnboardingWizardProps {
    onComplete: () => void;
}

const PlanOption: React.FC<{
    tier: TierDef;
    selected: boolean;
    onSelect: () => void;
    billingCycle: 'monthly' | 'annual';
}> = ({ tier, selected, onSelect, billingCycle }) => {
    const price = billingCycle === 'annual' ? tier.annualPriceDisplay : tier.monthlyPriceDisplay;
    const per   = tier.monthlyPrice === null ? '' : (billingCycle === 'annual' ? '/yr' : '/mo');
    const sce   = billingCycle === 'annual' ? tier.scePer_annual : tier.scePer;

    return (
        <div
            onClick={onSelect}
            className={`relative flex flex-col p-6 sm:p-8 rounded-[40px] border-2 cursor-pointer transition-all duration-300 ${selected ? 'border-primary-500 bg-primary-50/30 shadow-2xl shadow-primary-500/10 scale-[1.03] z-10' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50'}`}
        >
            {tier.recommended && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-emerald-600 text-white text-[10px] font-black px-5 py-1.5 rounded-full uppercase tracking-widest shadow-xl whitespace-nowrap">
                    Most Popular
                </div>
            )}
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-400">{tier.label}</h4>
                {selected && <div className="w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center text-white p-1"><CheckIcon className="w-full h-full" /></div>}
            </div>
            <div className="mb-4">
                <p className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{price}</p>
                <p className="text-[10px] font-bold text-slate-300 mt-1">{per || 'contact us'}</p>
            </div>

            {sce && (
                <div className="mb-4 p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex flex-col items-start gap-1">
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">SCE*</p>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                        <p className="text-sm font-black text-slate-900 leading-tight">{sce}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">/tenant</p>
                    </div>
                </div>
            )}

            <ul className="space-y-2.5 mb-2 flex-grow">
                {tier.features.map((f, i) => (
                    <li key={i} className="text-[10px] text-slate-500 font-bold flex items-start gap-2 leading-tight">
                        <CheckIcon className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                    </li>
                ))}
            </ul>
            {tier.requiresSetupFee && (
                <p className="text-[9px] text-amber-600 font-black uppercase tracking-widest mt-2 border-t border-slate-100 pt-2">+ ₦150k One-Time Setup Fee</p>
            )}
        </div>
    );
};

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
    const { createFirm, joinFirm } = useDataActions();
    const { currentUser, logout, refreshUser } = useAuth();
    const { navigateTo } = useUI();
    const repairAccountMutation = useMutation(api.myFunctions.repairAccountConnection);

    // Step 1: Workspace name  |  Step 2: Product  |  Step 3: Plan
    const [step, setStep] = useState(1);
    const [mode, setMode] = useState<'create' | 'join'>('create');
    const [firmName, setFirmName] = useState('');
    const [product, setProduct] = useState<ProductMode>('legal');
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
    const [selectedTierId, setSelectedTierId] = useState<TierId>('Pro');
    const [inviteCode, setInviteCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDataMigration, setIsDataMigration] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isRecovering, setIsRecovering] = useState(false);
    const [hasAgreed, setHasAgreed] = useState(false);

    // Derive plan display from tiers matrix
    const tiers = getTiersForProduct(product);
    const tierIds: TierId[] = DISPLAY_TIER_IDS;

    // Map TierId → SubscriptionPlan enum for backend
    const tierToSubscriptionPlan: Record<TierId, SubscriptionPlan> = {
        Core:       SubscriptionPlan.Core,
        Growth:     SubscriptionPlan.Growth,
        Pro:        SubscriptionPlan.Pro,
        Enterprise: SubscriptionPlan.Enterprise,
    };

    const isPropertyMode = product === 'property' || product === 'atrium';

    const handleCreate = async () => {
        if (!firmName.trim()) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const plan = tierToSubscriptionPlan[selectedTierId];
            const fid = await createFirm(
                firmName.trim(),
                'Address Pending',
                plan,
                { email: currentUser!.email, name: currentUser!.name },
                product,
                isDataMigration
            );
            if (fid) {
                await refreshUser();
                sessionStorage.removeItem('practicepro_demo_product');
                onComplete();
            } else {
                throw new Error('Firm creation returned no ID.');
            }
        } catch (e: any) {
            console.error('Setup Error:', e);
            setError(e.message || 'Failed to create workspace.');
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
            let msg = e.message || 'Failed to join firm.';
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
            setError('Recovery failed: ' + e.message);
        } finally {
            setIsRecovering(false);
        }
    };

    return (
        <div className="flex flex-col items-center h-full w-full bg-white overflow-y-auto scroll-smooth py-20 px-6">
            <div className="absolute top-6 right-6">
                <button onClick={logout} className="flex items-center gap-2 text-xs text-slate-400 hover:text-red-600 border border-slate-100 px-3 py-2 rounded-xl transition-colors shadow-sm"><LogoutIcon className="w-4 h-4" /> Sign Out</button>
            </div>

            <div className="w-full max-w-2xl space-y-8 animate-fade-in" style={{ animationDuration: '2s', animationDelay: '0.5s', animationFillMode: 'both' }}>
                {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm text-center border border-red-100 font-bold">{error}</div>}

                {/* ── STEP 1: Workspace Name ─────────────────────────────── */}
                {step === 1 && (
                    <div className="space-y-8">
                        <div className="text-center">
                            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Welcome, {currentUser?.name?.split(' ')[0]}</h2>
                            <p className="text-slate-500 mt-2 text-sm font-medium">Initialize your secure workspace.</p>
                        </div>

                        <div className="max-w-md mx-auto space-y-6">
                            <div className="flex p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
                                <button onClick={() => { setMode('create'); setError(null); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${mode === 'create' ? 'bg-white shadow-lg shadow-slate-200 text-primary-600' : 'text-slate-400'}`}>Create New</button>
                                <button onClick={() => { setMode('join'); setError(null); }} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${mode === 'join' ? 'bg-white shadow-lg shadow-slate-200 text-primary-600' : 'text-slate-400'}`}>Join Existing</button>
                            </div>

                            {mode === 'create' ? (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Firm / Organization Name</label>
                                        <input autoComplete="off" data-lpignore="true" type="text" placeholder="e.g. Adeyemi & Co." value={firmName} onChange={e => setFirmName(e.target.value)} className="w-full p-4 border border-slate-100 rounded-2xl bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none text-slate-900 placeholder:text-slate-300" autoFocus />
                                    </div>
                                    {/* Always go to Step 2 (product selection) first */}
                                    <button onClick={() => setStep(2)} disabled={!firmName.trim()} className="w-full py-4 bg-primary-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary-600/20 hover:bg-primary-700 hover:-translate-y-0.5 transition-all mt-4 active:scale-95 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none">Next: Choose Your Product</button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Invite Code</label>
                                        <input autoComplete="off" data-lpignore="true" type="text" placeholder="INV-XXXX" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} className="w-full p-4 text-center font-mono font-bold text-2xl border border-slate-100 rounded-2xl bg-white focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none text-slate-900 placeholder:text-slate-200 uppercase" autoFocus />
                                    </div>
                                    <button onClick={handleJoin} disabled={!inviteCode || isSubmitting} className="w-full py-4 bg-primary-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary-600/20 hover:bg-primary-700 hover:-translate-y-0.5 transition-all active:scale-95 flex justify-center disabled:opacity-50 disabled:translate-y-0">
                                        {isSubmitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Join Workspace'}
                                    </button>
                                </div>
                            )}

                            <div className="pt-8 border-t border-slate-50 text-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">System Recovery</p>
                                <button onClick={handleRecovery} disabled={isRecovering} className="text-xs font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest flex items-center justify-center gap-2 mx-auto transition-colors">
                                    {isRecovering ? <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> : <RevertIcon className="w-4 h-4" />}
                                    Recover Connection
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── STEP 2: Product Selection ──────────────────────────── */}
                {step === 2 && (
                    <div className="space-y-8 max-w-lg mx-auto">
                        <div className="text-center">
                            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Choose Your Solution</h2>
                            <p className="text-slate-500 mt-2 text-sm font-medium">What will you use the platform for at <span className="text-primary-600 font-bold">{firmName}</span>?</p>
                        </div>

                        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-6 duration-700 fill-mode-both">
                            {/* Vega */}
                            <button onClick={() => setProduct('legal')} className={`p-6 text-left border-2 rounded-[32px] transition-all flex items-start gap-4 group relative ${product === 'legal' ? 'border-amber-500 bg-amber-50/50 shadow-xl shadow-amber-500/10 scale-[1.02]' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                                <div className={`p-3 rounded-2xl transition-colors ${product === 'legal' ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400 group-hover:bg-amber-50 group-hover:text-amber-500'}`}><CheckIcon className="w-6 h-6" /></div>
                                <div>
                                    <div className="font-black text-xl text-slate-900">Vega <span className="text-[10px] uppercase font-bold text-slate-400 ml-1">Legal</span></div>
                                    <div className="text-xs text-slate-500 mt-1 font-medium">For law firms and legal departments.</div>
                                    <div className="text-[10px] text-amber-600 font-black uppercase tracking-widest mt-2">From Free · ₦45k/mo Growth · ₦80k/mo Pro</div>
                                </div>
                            </button>

                            {/* Atrium */}
                            <button onClick={() => setProduct('property')} className={`p-6 text-left border-2 rounded-[32px] transition-all flex items-start gap-4 group relative ${product === 'property' ? 'border-blue-500 bg-blue-50/50 shadow-xl shadow-blue-500/10 scale-[1.02]' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                                <div className={`p-3 rounded-2xl transition-colors ${product === 'property' ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}><CheckIcon className="w-6 h-6" /></div>
                                <div>
                                    <div className="font-black text-xl text-slate-900">Atrium <span className="text-[10px] uppercase font-bold text-slate-400 ml-1">Property</span></div>
                                    <div className="text-xs text-slate-500 mt-1 font-medium">For property managers and owners.</div>
                                    <div className="text-[10px] text-blue-600 font-black uppercase tracking-widest mt-2">₦190K/yr Core · ₦360K/yr Growth · ₦840K/yr Pro</div>
                                </div>
                            </button>

                            {/* Komplete Unified */}
                            <button onClick={() => setProduct('unified')} className={`p-6 text-left border-2 rounded-[32px] transition-all flex items-start gap-4 group relative ${product === 'unified' ? 'border-indigo-500 bg-indigo-50/50 shadow-xl shadow-indigo-500/10 scale-[1.02]' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                                <div className={`p-3 rounded-2xl transition-colors ${product === 'unified' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'}`}><CheckIcon className="w-6 h-6" /></div>
                                <div className="w-full relative">
                                    <div className="absolute top-0 right-0 bg-indigo-100 text-indigo-700 text-[9px] font-black px-4 py-1 rounded-full uppercase tracking-widest">Premium Bundle</div>
                                    <div className="font-black text-xl text-slate-900">Komplete <span className="text-[10px] uppercase font-bold text-slate-400 ml-1">Unified</span></div>
                                    <div className="text-xs text-slate-500 mt-1 font-medium pr-24">Full Vega (Legal) + Atrium (Property) in one workspace.</div>
                                    <div className="text-[10px] text-indigo-600 font-black uppercase tracking-widest mt-2">₦130K/mo · ₦1.248M/yr — All features, unlimited</div>
                                </div>
                            </button>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button onClick={() => setStep(1)} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-all">Back</button>
                            <button onClick={() => setStep(3)} className={`flex-[2] py-4 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl transition-all active:scale-95 ${product === 'unified' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20' : product === 'property' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'}`}>Next: Select Plan</button>
                        </div>
                    </div>
                )}

                {/* ── STEP 3: Plan Selection ─────────────────────────────── */}
                {step === 3 && (
                    <div className="space-y-6 max-w-5xl mx-auto">
                        <div className="text-center">
                            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Choose Your Plan</h2>
                            <p className="text-slate-500 mt-1 text-sm font-medium">All prices are for <span className="font-bold text-slate-700">{product === 'legal' ? 'Vega OS' : product === 'property' ? 'Atrium OS' : 'Komplet Unified'}</span>.</p>
                        </div>

                        {/* Billing Toggle — only for paid products */}
                        {product !== 'legal' && (
                            <div className="flex items-center justify-center gap-4">
                                <span className={`text-sm font-bold ${billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-400'}`}>Monthly</span>
                                <button onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')} className="relative w-14 h-7 bg-slate-200 rounded-full transition-colors">
                                    <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${billingCycle === 'annual' ? 'translate-x-7 bg-primary-500' : ''}`} />
                                </button>
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-bold ${billingCycle === 'annual' ? 'text-slate-900' : 'text-slate-400'}`}>Annual</span>
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[10px] font-black uppercase rounded-full border border-emerald-200">Save ~20%</span>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {tierIds.map(id => (
                                <PlanOption
                                    key={id}
                                    tier={tiers[id]}
                                    selected={selectedTierId === id}
                                    onSelect={() => setSelectedTierId(id)}
                                    billingCycle={billingCycle}
                                />
                            ))}
                        </div>

                        {isPropertyMode && (
                            <div className="text-[10px] text-slate-400 font-bold px-4">
                                * SCE: Service Charge Equivalent — estimated monthly cost per tenant unit.
                            </div>
                        )}

                        {/* Managed Migration opt-in */}
                        {isPropertyMode && (
                            <div className="max-w-md mx-auto p-6 rounded-3xl bg-amber-50 border border-amber-100">
                                <div className="flex items-center gap-3 mb-3">
                                    <input type="checkbox" id="data-migration" checked={isDataMigration} onChange={e => setIsDataMigration(e.target.checked)} className="w-5 h-5 rounded border-amber-200 text-amber-600 focus:ring-amber-500" />
                                    <label htmlFor="data-migration" className="text-sm font-black text-amber-900 uppercase tracking-tight">Request Managed Data Migration</label>
                                </div>
                                <p className="text-xs text-amber-700 font-medium leading-relaxed ml-8">
                                    Our team digitizes your existing property records. <strong>Adds a one-time ₦150,000 setup fee.</strong>
                                </p>
                            </div>
                        )}

                        {/* Setup fee notice */}
                        {isDataMigration && (
                            <div className="max-w-md mx-auto p-4 rounded-2xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">One-Time Setup Fee</p>
                                    <p className="text-[9px] text-slate-400 font-bold mt-0.5">Required for Managed Migration</p>
                                </div>
                                <span className="text-lg font-black text-slate-900">₦150,000</span>
                            </div>
                        )}

                        {/* DPA Agreement */}
                        <div className="max-w-md mx-auto pt-2 flex items-start gap-4">
                            <input autoComplete="off" data-lpignore="true" type="checkbox" id="agree-dpa" checked={hasAgreed} onChange={e => setHasAgreed(e.target.checked)} className="mt-1 w-5 h-5 text-primary-600 border-slate-200 rounded-lg focus:ring-primary-500 cursor-pointer transition-all" />
                            <label htmlFor="agree-dpa" className="text-[11px] text-slate-400 font-medium leading-relaxed cursor-pointer select-none">
                                I agree to the <button type="button" onClick={() => navigateTo('dataProcessingAgreement')} className="text-primary-600 hover:underline font-bold">Data Protection Agreement</button> and <button type="button" onClick={() => navigateTo('termsOfService')} className="text-primary-600 hover:underline font-bold">Terms of Service</button>. Data is processed per Nigerian standards.
                            </label>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto pt-2">
                            <button onClick={() => setStep(2)} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-all" disabled={isSubmitting}>Back</button>
                            <button onClick={handleCreate} disabled={isSubmitting || !hasAgreed} className={`flex-[2] py-4 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl flex justify-center items-center gap-2 transition-all ${isSubmitting || !hasAgreed ? 'bg-slate-200 cursor-not-allowed shadow-none' : 'bg-primary-600 hover:bg-primary-700 shadow-primary-600/20'}`}>
                                {isSubmitting && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                                {isSubmitting ? 'Creating...' : 'Create Workspace'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OnboardingWizard;
