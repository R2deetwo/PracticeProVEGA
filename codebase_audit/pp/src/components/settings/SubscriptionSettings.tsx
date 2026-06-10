
import React, { useState, useMemo } from 'react';
import { FirmDetails, SubscriptionPlan, User, FirmSpecialty } from '../../types';
import { CheckIcon, UserCircleIcon, CalculatorIcon } from '../../constants';
import { ShieldCheckIcon } from '../../constants';
import { useUI } from '../../contexts/UIContext';
import NairaSymbol from '../NairaSymbol';
import { formatNaira } from '../../utils/formatting';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { VEGA_TIERS, ATRIUM_TIERS, KOMPLETE_TIER, getTiersForProduct, isPropertyCapable, isKomplete } from '../../constants/tiers';
import { TierId, TierDef } from '../../constants/tiers';

interface SubscriptionSettingsProps {
    firmDetails: FirmDetails;
    onUpdateFirmDetails: (details: FirmDetails) => void;
}

const TIER_ORDER: TierId[] = ['Core', 'Growth', 'Pro', 'Enterprise'];

const getPlanLevel = (plan: SubscriptionPlan | undefined): number => {
    switch (plan) {
        case SubscriptionPlan.Core: return 0;
        case SubscriptionPlan.Growth: return 1;
        case SubscriptionPlan.Pro: return 2;
        case SubscriptionPlan.Enterprise: return 3;
        case SubscriptionPlan.Komplete: return 4;
        default: return 0;
    }
};

const ENTERPRISE_MODALITIES: { specialty: FirmSpecialty; label: string; description: string; abbr: string; price: number }[] = [
    { specialty: FirmSpecialty.Maritime, label: 'Maritime & Admiralty', description: 'Ship arrest workflows, Writ in Rem drafting, vessel tracking & P&I insurer management built in.', abbr: 'MA', price: 35000 },
    { specialty: FirmSpecialty.OilGas, label: 'Oil & Gas', description: 'OML/OPL license lifecycle, PIA compliance alerts, NUPRC deadline tracking & farm-in/out management.', abbr: 'O&G', price: 50000 },
    { specialty: FirmSpecialty.Corporate, label: 'Corporate & Commercial', description: 'CAC compliance, M&A due diligence checklists, annual returns tracking & board resolution storage.', abbr: 'CC', price: 30000 },
    { specialty: FirmSpecialty.Tax, label: 'Tax Law', description: 'FIRS audit management, 30-day objection deadline alerts, TAT appeal tracking & TCC processing.', abbr: 'TX', price: 30000 },
    { specialty: FirmSpecialty.RealEstate, label: 'Real Estate & Property', description: "Title perfection stages, Governor's Consent tracking, Deed drafting & recovery of premises workflow.", abbr: 'RE', price: 25000 },
    { specialty: FirmSpecialty.Litigation, label: 'Civil Litigation', description: 'Court process tracking, hearing reminders, Rules of Court deadline automation & ALOA litigation briefing.', abbr: 'LIT', price: 20000 },
];

const PlanCard: React.FC<{
    tier: TierDef;
    currentPlan: SubscriptionPlan;
    isCurrentTier: boolean;
    onSelect: () => void;
    isDowngrade: boolean;
    isAnnual: boolean;
    isAtriumProduct: boolean;
}> = ({ tier, currentPlan, isCurrentTier, onSelect, isDowngrade, isAnnual, isAtriumProduct }) => {
    let buttonText = 'Switch Plan';
    let buttonClass = '';

    if (isCurrentTier) {
        buttonText = 'Current Plan';
        buttonClass = 'bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 cursor-default';
    } else if (isDowngrade) {
        buttonText = 'Downgrade';
        buttonClass = 'bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-600';
    } else {
        buttonText = 'Upgrade';
        if (tier.recommended) {
            buttonClass = 'bg-primary-600 text-white hover:bg-primary-700 shadow-md';
        } else {
            buttonClass = 'bg-slate-800 text-white hover:bg-slate-700';
        }
    }

    // Determine price display
    let priceDisplay: string;
    let perLabel: string;

    if (tier.monthlyPrice === 0) {
        priceDisplay = 'Free';
        perLabel = '';
    } else if (tier.monthlyPrice === null && tier.annualPrice === null) {
        priceDisplay = 'Custom';
        perLabel = 'contact us';
    } else if (isAtriumProduct) {
        // Atrium: annual only
        priceDisplay = tier.annualPriceDisplay;
        perLabel = '/yr';
    } else {
        // VEGA: monthly or annual
        if (isAnnual) {
            priceDisplay = tier.annualPriceDisplay;
            perLabel = '/yr';
        } else {
            priceDisplay = tier.monthlyPriceDisplay;
            perLabel = '/mo';
        }
    }

    return (
        <div className={`relative flex flex-col p-6 rounded-2xl border transition-all duration-300 ${isCurrentTier ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-lg ring-1 ring-primary-500' : 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-primary-300 hover:shadow-md'}`}>
            {tier.recommended && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-primary-600 text-white text-xs font-bold uppercase tracking-wide rounded-full shadow-sm">
                    Most Popular
                </div>
            )}
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{tier.label}</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 h-10">{tier.features[0]}</p>

            <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">{priceDisplay}</span>
                {perLabel && (
                    <span className="text-sm text-slate-500 dark:text-zinc-400">{perLabel}</span>
                )}
            </div>

            {/* SCE display for Atrium */}
            {isAtriumProduct && tier.scePer && (
                <div className="mb-4 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/30">
                    <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Service Charge Equiv.</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{tier.scePer}</span>
                        <span className="text-[10px] text-slate-500">/unit</span>
                    </div>
                </div>
            )}

            <div className="flex-grow">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Includes:</p>
                <ul className="space-y-3 mb-8">
                    {tier.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-zinc-300">
                            <CheckIcon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${tier.recommended ? 'text-primary-500' : 'text-slate-400'}`} />
                            <span>{feat}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <button
                onClick={onSelect}
                disabled={isCurrentTier}
                className={`w-full py-2.5 px-4 rounded-lg font-bold text-sm transition-colors ${buttonClass}`}
            >
                {buttonText}
            </button>
        </div>
    );
};

// --- BILLING CALCULATOR WIDGET ---
const BillingCalculator: React.FC<{
    users: User[],
    currentPlan: SubscriptionPlan,
    isAnnual: boolean,
    viewAsMonthlyCost: boolean,
    simulationCount: number,
    setSimulationCount: (n: number) => void,
    selectedModalities: FirmSpecialty[],
    productMode: string,
}> = ({ users, currentPlan, isAnnual, viewAsMonthlyCost, simulationCount, setSimulationCount, selectedModalities, productMode }) => {
    const tiers = getTiersForProduct(productMode as any);
    const isAtrium = isPropertyCapable(productMode);

    // Get tier price for current plan
    const currentTier = Object.values(tiers).find(t => {
        if (currentPlan === SubscriptionPlan.Komplete) return t.label === 'Komplete';
        return t.id === currentPlan;
    });

    const getPrice = (): number => {
        if (!currentTier) return 0;
        if (isAtrium) {
            // Atrium: annual only
            return currentTier.annualPrice ?? 0;
        }
        // VEGA: monthly or annual
        if (isAnnual) {
            return currentTier.annualPrice ?? 0;
        }
        return currentTier.monthlyPrice ?? 0;
    };

    const baseCost = getPrice();
    const totalActualUsers = users.length;
    const isSimulating = simulationCount > 0;

    if (currentPlan === SubscriptionPlan.Enterprise) {
        const baseRate = isAnnual ? 120000 : 150000;
        const modalityCost = selectedModalities.reduce((sum, s) => {
            const found = ENTERPRISE_MODALITIES.find(m => m.specialty === s);
            return sum + (found ? (isAnnual ? Math.round(found.price * 0.8) : found.price) : 0);
        }, 0);
        const total = baseRate + modalityCost;
        return (
            <div className="relative rounded-2xl overflow-hidden mb-8 shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-zinc-900 to-slate-800" />
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #d4a85422 0%, transparent 60%), radial-gradient(circle at 80% 20%, #a8855822 0%, transparent 50%)' }} />
                <div className="relative p-6 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-sm">
                            <ShieldCheckIcon className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-amber-400/70 uppercase tracking-[0.2em]">Enterprise</p>
                            <h3 className="text-lg font-black text-white">Projected Subscription Billing</h3>
                        </div>
                    </div>

                    <div className="space-y-3 mb-4">
                        <div className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/10">
                            <div>
                                <p className="text-sm font-bold text-white">Enterprise Platform Base</p>
                                <p className="text-[10px] text-zinc-400">Unlimited users · Full ALOA suite · All core features</p>
                            </div>
                            <p className="font-mono font-bold text-amber-400">₦{baseRate.toLocaleString()}</p>
                        </div>
                        {selectedModalities.map(s => {
                            const m = ENTERPRISE_MODALITIES.find(m => m.specialty === s);
                            if (!m) return null;
                            const rate = isAnnual ? Math.round(m.price * 0.8) : m.price;
                            return (
                                <div key={s} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/10">
                                    <div>
                                        <p className="text-sm font-bold text-white">{ModalityIcons[m.specialty]} {m.label} Modality</p>
                                        <p className="text-[10px] text-zinc-400">Specialist dashboards · Statutory forms · ALOA Expert Mode</p>
                                    </div>
                                    <p className="font-mono font-bold text-amber-400">₦{rate.toLocaleString()}</p>
                                </div>
                            );
                        })}
                    </div>
                    <div className="border-t border-white/10 pt-4 flex justify-between items-end">
                        <p className="text-sm text-zinc-400">Total Billed {isAnnual ? 'Annually' : 'Monthly'}{isAnnual && <span className="text-amber-400 font-bold ml-2">20% annual discount applied</span>}</p>
                        <p className="text-3xl font-black text-amber-400">₦{total.toLocaleString()}</p>
                    </div>
                </div>
            </div>
        );
    }

    // Standard plan calculator
    const displayCost = isAtrium ? baseCost : (viewAsMonthlyCost && isAnnual ? Math.round(baseCost / 12) : baseCost);
    const periodLabel = isAtrium
        ? (viewAsMonthlyCost ? '/mo avg' : '/yr')
        : (isAnnual ? (viewAsMonthlyCost ? '/mo avg' : '/yr') : '/mo');

    return (
        <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isSimulating ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
                        <CalculatorIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {isSimulating ? 'Simulated' : 'Estimated'} Cost
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                            {isAtrium
                                ? `Atrium is billed annually. ${viewAsMonthlyCost ? 'Showing monthly average.' : 'Showing annual total.'}`
                                : `Based on your current team size (${totalActualUsers} users).`}
                        </p>
                    </div>
                </div>
                {!isAtrium && (
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-zinc-700/30 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Simulate Growth</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setSimulationCount(Math.max(0, simulationCount - 1))} disabled={simulationCount === 0} className="w-6 h-6 flex items-center justify-center rounded-md bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-600 text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-all font-bold">-</button>
                            <span className={`w-8 text-center font-mono font-bold text-sm ${isSimulating ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>+{simulationCount}</span>
                            <button onClick={() => setSimulationCount(Math.min(50, simulationCount + 1))} className="w-6 h-6 flex items-center justify-center rounded-md bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-600 text-slate-600 hover:bg-slate-50 transition-all font-bold">+</button>
                        </div>
                        {isSimulating && <button onClick={() => setSimulationCount(0)} className="text-[10px] font-bold text-primary-600 hover:underline ml-1">Reset</button>}
                    </div>
                )}
            </div>
            <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-zinc-700/30 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary-100 dark:bg-primary-900/30 text-primary-600 p-1.5 rounded-full"><UserCircleIcon className="w-4 h-4" /></div>
                        <div><p className="font-bold text-sm text-slate-800 dark:text-white">{currentTier?.label || currentPlan} Plan</p><p className="text-xs text-slate-500">{isAtrium ? 'Annual subscription' : (isAnnual ? 'Annual billing' : 'Monthly billing')}</p></div>
                    </div>
                    <p className="font-mono font-bold text-slate-900 dark:text-white"><NairaSymbol />{formatNaira(displayCost)}<span className="text-xs font-normal text-slate-500 ml-1">{periodLabel}</span></p>
                </div>
                <div className="border-t border-slate-200 dark:border-zinc-700 pt-4 flex justify-between items-end">
                    <div className="flex flex-col">
                        <p className="text-sm font-medium text-slate-500">Total Billed {isAtrium ? 'Annually' : (isAnnual ? 'Annually' : 'Monthly')}</p>
                        {isAnnual && !isAtrium && <p className="text-xs text-green-600 font-bold">Includes 20% annual discount.</p>}
                    </div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400"><NairaSymbol />{formatNaira(baseCost)}</p>
                </div>
            </div>
        </div>
    );
};

// --- ENTERPRISE UPGRADE SECTION ---
const GlassIcon: React.FC<{ children: React.ReactNode; selected: boolean }> = ({ children, selected }) => (
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 border transition-all ${selected ? 'bg-amber-400/15 border-amber-400/40' : 'bg-white/5 border-white/10'}`}
        style={{ backdropFilter: 'blur(8px)' }}>
        {children}
    </div>
);

const ModalityIcons: Record<string, React.ReactNode> = {
    [FirmSpecialty.Maritime]: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-500 drop-shadow" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="3" />
            <line x1="12" y1="22" x2="12" y2="8" />
            <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
        </svg>
    ),
    [FirmSpecialty.OilGas]: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-500 drop-shadow" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
    ),
    [FirmSpecialty.Corporate]: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-500 drop-shadow" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
    ),
    [FirmSpecialty.Tax]: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-500 drop-shadow" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 2v20l2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2V2z" />
            <path d="M16 8h-6" />
            <path d="M16 12h-6" />
            <path d="M16 16h-6" />
        </svg>
    ),
    [FirmSpecialty.RealEstate]: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-500 drop-shadow" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    ),
    [FirmSpecialty.Litigation]: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-500 drop-shadow" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
            <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
            <path d="M7 21h10" />
            <path d="M12 3v18" />
            <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
        </svg>
    ),
};

const EnterpriseSection: React.FC<{
    currentPlan: SubscriptionPlan;
    isAnnual: boolean;
    firmDetails: FirmDetails;
    selectedModalities: FirmSpecialty[];
    onToggleModality: (s: FirmSpecialty) => void;
    onActivate: () => void;
}> = ({ currentPlan, isAnnual, selectedModalities, onToggleModality, onActivate }) => {
    const isEnterprise = currentPlan === SubscriptionPlan.Enterprise;
    const baseRate = isAnnual ? 120000 : 150000;
    const modalityTotal = selectedModalities.reduce((sum, s) => {
        const m = ENTERPRISE_MODALITIES.find(m => m.specialty === s);
        return sum + (m ? (isAnnual ? Math.round(m.price * 0.8) : m.price) : 0);
    }, 0);
    const totalMonthly = baseRate + modalityTotal;

    return (
        <div className="relative rounded-2xl overflow-hidden mt-6 border border-amber-400/10">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0d0d0f] via-[#141418] to-[#0a0a0c]" />
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(ellipse at 10% 50%, rgba(212,168,84,0.07) 0%, transparent 50%)' }} />
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
            <div className="relative p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-md">
                            <svg viewBox="0 0 24 24" className="w-4 h-4 text-black" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-amber-400/60 uppercase tracking-[0.2em]">PracticePro</p>
                            <h3 className="text-lg font-black text-white leading-tight">Enterprise</h3>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-black text-amber-400">&#x20A6;{totalMonthly.toLocaleString()}<span className="text-zinc-500 text-xs font-normal">/mo</span></p>
                        <p className="text-[10px] text-zinc-500">{isAnnual ? 'Annual (20% off)' : 'Monthly'}{selectedModalities.length > 0 ? ` · ${selectedModalities.length} module${selectedModalities.length > 1 ? 's' : ''}` : ' · Base'}</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {['Unlimited users', 'Custom Storage', 'Audit Logs & SSO', 'SLA Guarantee', 'Account manager'].map(f => (
                        <span key={f} className="text-[10px] font-semibold text-zinc-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">{f}</span>
                    ))}
                </div>
                <p className="text-[9px] font-black text-amber-400/50 uppercase tracking-[0.2em] mb-2">Add Practice Modules</p>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                    {ENTERPRISE_MODALITIES.map(mod => {
                        const isSelected = selectedModalities.includes(mod.specialty);
                        const displayPrice = isAnnual ? Math.round(mod.price * 0.8) : mod.price;
                        return (
                            <button
                                key={mod.specialty}
                                onClick={() => onToggleModality(mod.specialty)}
                                className={`relative text-left p-3 rounded-xl border transition-all duration-150 ${isSelected ? 'border-amber-400/40 bg-amber-400/5' : 'border-white/5 bg-white/[0.02] hover:border-white/10'}`}
                            >
                                {isSelected && (
                                    <div className="absolute top-2 right-2 w-3.5 h-3.5 rounded-full bg-amber-400 flex items-center justify-center">
                                        <svg viewBox="0 0 12 12" className="w-2 h-2" fill="none" stroke="black" strokeWidth="2"><polyline points="2,6 5,9 10,3"/></svg>
                                    </div>
                                )}
                                <GlassIcon selected={isSelected}>{ModalityIcons[mod.specialty]}</GlassIcon>
                                <p className={`font-bold text-xs mb-1 ${isSelected ? 'text-amber-300' : 'text-zinc-200'}`}>{mod.label}</p>
                                <p className="text-[10px] text-zinc-500 leading-relaxed mb-1.5">{mod.description}</p>
                                <p className={`text-[10px] font-black ${isSelected ? 'text-amber-400' : 'text-zinc-500'}`}>+&#x20A6;{displayPrice.toLocaleString()}/mo</p>
                            </button>
                        );
                    })}
                </div>
                {isEnterprise ? (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-400/5 border border-amber-400/20">
                        <svg viewBox="0 0 24 24" className="w-4 h-4 text-amber-400 flex-shrink-0" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                        <div>
                            <p className="font-black text-white text-xs">You are on the Enterprise Plan</p>
                            <p className="text-zinc-500 text-[10px]">Contact your account manager to adjust modules or billing.</p>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={onActivate}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-black font-black text-xs uppercase tracking-[0.12em] shadow-lg hover:opacity-95 hover:scale-[1.005] active:scale-[0.99] transition-all duration-150"
                    >
                        {selectedModalities.length > 0
                            ? `Activate Enterprise with ${selectedModalities.length} Module${selectedModalities.length > 1 ? 's' : ''}`
                            : 'Select Modules Above to Activate Enterprise'}
                    </button>
                )}
            </div>
        </div>
    );
};



const SubscriptionSettings: React.FC<SubscriptionSettingsProps> = ({ firmDetails, onUpdateFirmDetails }) => {
    const { addToast, openModal, closeModal } = useUI();
    const { coreState, isDataLoaded } = useCoreState();
    const { logActivity } = useDataActions();
    const isAtrium = isPropertyCapable(firmDetails.product);
    const isUnified = isKomplete(firmDetails.product);
    const [isAnnual, setIsAnnual] = useState(true);
    const [viewAsMonthlyCost, setViewAsMonthlyCost] = useState(true);
    const [simulationCount, setSimulationCount] = useState(0);
    const [selectedModalities, setSelectedModalities] = useState<FirmSpecialty[]>(firmDetails.firmSpecialties || []);

    const handleToggleModality = (s: FirmSpecialty) => {
        setSelectedModalities(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    };

    const processUpgrade = (newPlan: SubscriptionPlan, price: number) => {
        const currentLevel = getPlanLevel(firmDetails.subscriptionPlan);
        const targetLevel = getPlanLevel(newPlan);
        const isDowngrade = targetLevel < currentLevel;
        const title = isDowngrade ? `Downgrade to ${newPlan}` : `Upgrade to ${newPlan}`;
        if (isDowngrade) {
            openModal('deleteConfirmation', null, {
                title,
                message: `You are switching from ${firmDetails.subscriptionPlan} to ${newPlan}. Some high-tier features may be locked. ${newPlan === SubscriptionPlan.Core ? 'NOTE: Core plan is single-user only. Team access will be paused.' : ''}`,
                confirmText: 'Confirm Switch',
                confirmButtonClass: 'bg-slate-600 hover:bg-slate-700',
                onConfirm: () => {
                    onUpdateFirmDetails({ ...firmDetails, subscriptionPlan: newPlan, aiSettings: { ...firmDetails.aiSettings, ...(newPlan === SubscriptionPlan.Core ? { enableAllAiFeatures: false } : {}) } });
                    addToast(`Successfully switched to ${newPlan} plan.`, { type: 'success' });
                    closeModal();
                }
            });
        } else {
            openModal('deleteConfirmation', null, {
                title,
                message: `You are requesting to upgrade your firm to the ${newPlan} plan (${isAtrium ? 'Annual' : (isAnnual ? 'Annual' : 'Monthly')}).\n\nSince direct billing is in beta, a PracticePro team member will contact you shortly at ${coreState.users.find(u => u.role === 'Admin')?.email || 'your registered email'} to finalize the transition.`,
                confirmText: `Request ${newPlan} Access`,
                confirmButtonClass: 'bg-primary-600 hover:bg-primary-700',
                onConfirm: () => {
                    logActivity(`Requested upgrade to ${newPlan} plan`, 'User', coreState.users.find(u => u.role === 'Admin')?.id, coreState.users.find(u => u.role === 'Admin')?.name);
                    addToast(`Plan Change Requested. Our team will contact you shortly.`, { type: 'success' });
                    closeModal();
                }
            });
        }
    };

    const handleActivateEnterprise = () => {
        if (selectedModalities.length === 0) {
            addToast('Please select at least one Practice Modality to activate Enterprise.', { type: 'error' });
            return;
        }
        openModal('deleteConfirmation', null, {
            title: 'Activate Enterprise Plan',
            message: `You are requesting Enterprise access with ${selectedModalities.length} practice modalit${selectedModalities.length > 1 ? 'ies' : 'y'}: ${selectedModalities.join(', ')}.\n\nA PracticePro specialist will contact you to finalize onboarding and billing. For testing, Enterprise features will be unlocked immediately.`,
            confirmText: 'Activate Enterprise',
            confirmButtonClass: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black hover:opacity-90',
            onConfirm: () => {
                onUpdateFirmDetails({ ...firmDetails, subscriptionPlan: SubscriptionPlan.Enterprise, firmSpecialties: selectedModalities, aiSettings: { ...firmDetails.aiSettings, enableAllAiFeatures: true } });
                logActivity('Activated Enterprise plan', 'User', coreState.users.find(u => u.role === 'Admin')?.id);
                addToast('Enterprise plan activated. Welcome to the next level.', { type: 'success' });
                closeModal();
            }
        });
    };

    const activeFirmUsers = coreState.users.filter(u => u.role !== 'Client' && u.role !== 'External Counsel');

    // Get the correct tiers for this product
    const tiers = isUnified ? { Komplete: KOMPLETE_TIER } as any : getTiersForProduct(firmDetails.product as any || 'legal');
    const tierEntries = isUnified
        ? [{ key: 'Komplete', tier: KOMPLETE_TIER }]
        : TIER_ORDER.map(key => ({ key, tier: tiers[key] })).filter(e => e.tier);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Subscription & Billing</h3>
                    <p className="text-slate-500 dark:text-zinc-400 max-w-2xl">
                        {isAtrium
                            ? 'Manage your estate\'s annual subscription plan.'
                            : isUnified
                                ? 'Manage your Komplete subscription — all features, unlimited capacity.'
                                : 'Manage your Firm\'s plan and seat allocation.'}
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    {/* Only show Monthly/Annual toggle for VEGA (not Atrium, not Komplete) */}
                    {!isAtrium && !isUnified && (
                        <>
                            <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg">
                                <button onClick={() => setIsAnnual(false)} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${!isAnnual ? 'bg-white dark:bg-zinc-700 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700'}`}>Monthly</button>
                                <button onClick={() => setIsAnnual(true)} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${isAnnual ? 'bg-white dark:bg-zinc-700 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700'}`}>Yearly <span className="text-xs text-green-600 ml-1">-20%</span></button>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mt-2">
                                <span className={viewAsMonthlyCost ? 'font-bold text-slate-700 dark:text-slate-200' : ''}>Show Monthly Avg</span>
                                <div onClick={() => setViewAsMonthlyCost(!viewAsMonthlyCost)} className={`relative w-8 h-4 bg-slate-300 dark:bg-zinc-600 rounded-full cursor-pointer transition-colors ${!viewAsMonthlyCost ? 'bg-primary-500' : ''}`}>
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 ${!viewAsMonthlyCost ? 'translate-x-4' : 'translate-x-0.5'}`}></div>
                                </div>
                                <span className={!viewAsMonthlyCost ? 'font-bold text-slate-700 dark:text-slate-200' : ''}>Show Total Billed</span>
                            </div>
                        </>
                    )}
                    {isAtrium && (
                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm font-semibold border border-emerald-200 dark:border-emerald-800/50">
                            Billed Annually
                        </span>
                    )}
                </div>
            </div>

            {/* Billing Widget */}
            <BillingCalculator
                users={activeFirmUsers}
                currentPlan={firmDetails.subscriptionPlan || SubscriptionPlan.Core}
                isAnnual={isAnnual}
                viewAsMonthlyCost={viewAsMonthlyCost}
                simulationCount={simulationCount}
                setSimulationCount={setSimulationCount}
                selectedModalities={selectedModalities.length > 0 ? selectedModalities : (firmDetails.firmSpecialties || [])}
                productMode={firmDetails.product || 'legal'}
            />

            {/* Standard Plan Cards */}
            <div className={`grid grid-cols-1 ${isUnified ? 'max-w-md mx-auto' : 'md:grid-cols-3'} gap-6`}>
                {tierEntries.map(({ key, tier }) => {
                    const planEnum = key === 'Komplete' ? SubscriptionPlan.Komplete : SubscriptionPlan[key as keyof typeof SubscriptionPlan];
                    const currentLevel = getPlanLevel(firmDetails.subscriptionPlan);
                    const targetLevel = getPlanLevel(planEnum as SubscriptionPlan);
                    return (
                        <PlanCard
                            key={key}
                            tier={tier}
                            currentPlan={firmDetails.subscriptionPlan || SubscriptionPlan.Core}
                            isCurrentTier={firmDetails.subscriptionPlan === planEnum}
                            isDowngrade={targetLevel < currentLevel}
                            onSelect={() => processUpgrade(planEnum as SubscriptionPlan, tier.annualPrice ?? tier.monthlyPrice ?? 0)}
                            isAnnual={isAnnual}
                            isAtriumProduct={isAtrium}
                        />
                    );
                })}
            </div>

            {/* Enterprise Section — Only for VEGA product */}
            {!isAtrium && !isUnified && (
                <EnterpriseSection currentPlan={firmDetails.subscriptionPlan} isAnnual={isAnnual} firmDetails={firmDetails} selectedModalities={selectedModalities} onToggleModality={handleToggleModality} onActivate={handleActivateEnterprise} />
            )}
        </div>
    );
};

export default SubscriptionSettings;
