
import React, { useState, useMemo } from 'react';
import { FirmDetails, SubscriptionPlan, User, FirmSpecialty } from '../../types';
import { CheckIcon, UserCircleIcon, CalculatorIcon } from '../../constants';
import { ShieldCheckIcon } from '../../constants';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import NairaSymbol from '../NairaSymbol';
import { formatNaira } from '../../utils/formatting';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useProduct } from '../../contexts/ProductContext';
import {
    getTiersForProduct,
    DISPLAY_TIER_IDS,
    VEGA_TIERS,
    KOMPLETE_TIER,
    type ProductMode,
    type TierId,
    type TierDef,
} from '../../constants/tiers';
// CRO AUDIT — add-ons catalog for the Add-Ons section.
import { getAddonsForProduct, formatAddonPrice, type AddonDef } from '../../constants/addons';

interface SubscriptionSettingsProps {
    firmDetails: FirmDetails;
    onUpdateFirmDetails: (details: FirmDetails) => void;
}

const getPlanLevel = (plan: SubscriptionPlan | undefined): number => {
    switch (plan) {
        case SubscriptionPlan.Core: return 1;
        case SubscriptionPlan.Growth: return 2;
        case SubscriptionPlan.Pro: return 3;
        case SubscriptionPlan.Enterprise: return 4;
        case SubscriptionPlan.Komplete: return 5;
        default: return 0;
    }
};

const resolveProductMode = (product?: string | null): ProductMode => {
    if (product === 'property' || product === 'atrium') return 'property';
    if (product === 'unified') return 'unified';
    return 'legal';
};

const tierIdToSubscriptionPlan = (id: TierId): SubscriptionPlan => {
    switch (id) {
        case 'Core': return SubscriptionPlan.Core;
        case 'Growth': return SubscriptionPlan.Growth;
        case 'Pro': return SubscriptionPlan.Pro;
        case 'Enterprise': return SubscriptionPlan.Enterprise;
    }
};

const TIER_SETTINGS_COPY: Record<TierId, { description: string; userLimit: string }> = {
    Core: { description: 'Solo practitioners or small portfolios starting out.', userLimit: '1 User Account' },
    Growth: { description: 'AI and automation for growing firms and agencies.', userLimit: 'Up to 3 Users' },
    Pro: { description: 'Full-scale legal or property operations.', userLimit: 'Up to 10 Users' },
    Enterprise: { description: 'Custom limits and onboarding.', userLimit: 'Unlimited Users' },
};

const formatSettingsPrice = (
    tier: TierDef,
    isAnnual: boolean,
    viewAsMonthlyCost: boolean
): string => {
    if (tier.monthlyPrice === 0 && (tier.annualPrice ?? 0) === 0) return 'Free';
    // Only show "Custom" when BOTH prices are null (Enterprise tier)
    if (tier.monthlyPrice === null && tier.annualPrice === null) return 'Custom';
    // Atrium tiers have monthlyPrice=null but valid annualPrice — show annual price
    if (tier.monthlyPrice === null && tier.annualPrice !== null) {
        if (viewAsMonthlyCost) {
            const monthlyFromAnnual = Math.round(tier.annualPrice / 12);
            return `₦${monthlyFromAnnual.toLocaleString('en-NG')}`;
        }
        return tier.annualPriceDisplay;
    }
    if (!isAnnual) return tier.monthlyPriceDisplay;
    if (viewAsMonthlyCost) {
        const monthlyFromAnnual = Math.round((tier.annualPrice ?? 0) / 12);
        return `₦${monthlyFromAnnual.toLocaleString('en-NG')}`;
    }
    return tier.annualPriceDisplay;
};

const ENTERPRISE_MODALITIES: { specialty: FirmSpecialty; label: string; description: string; abbr: string; price: number }[] = [
    { specialty: FirmSpecialty.Maritime, label: 'Maritime & Admiralty', description: 'Ship arrest workflows, Writ in Rem drafting, vessel tracking & P&I insurer management built in.', abbr: 'MA', price: 35000 },
    { specialty: FirmSpecialty.OilGas, label: 'Oil & Gas', description: 'OML/OPL license lifecycle, PIA compliance alerts, NUPRC deadline tracking & farm-in/out management.', abbr: 'O&G', price: 50000 },
    { specialty: FirmSpecialty.Corporate, label: 'Corporate & Commercial', description: 'CAC compliance, M&A due diligence checklists, annual returns tracking & board resolution storage.', abbr: 'CC', price: 30000 },
    { specialty: FirmSpecialty.Tax, label: 'Tax Law', description: 'FIRS audit management, 30-day objection deadline alerts, TAT appeal tracking & TCC processing.', abbr: 'TX', price: 30000 },
    { specialty: FirmSpecialty.RealEstate, label: 'Real Estate & Property', description: "Title perfection stages, Governor's Consent tracking, Deed drafting & recovery of premises workflow.", abbr: 'RE', price: 25000 },
    { specialty: FirmSpecialty.Litigation, label: 'Civil Litigation', description: 'Court process tracking, hearing reminders, Rules of Court deadline automation & ALOA litigation briefing.', abbr: 'LIT', price: 20000 },
];


const ENTERPRISE_BASE_PRICE = { monthly: 120000, annual: 96000 };

const PlanCard: React.FC<{
    plan: SubscriptionPlan;
    currentPlan: SubscriptionPlan;
    price: string;
    features: (string | React.ReactNode)[];
    onSelect: () => void;
    isPopular?: boolean;
    isKomplete?: boolean;
    description: string;
    userLimit?: string;
    viewAsMonthlyCost: boolean;
    isAnnual: boolean;
}> = ({ plan, currentPlan, price, features, onSelect, isPopular, isKomplete, description, userLimit, viewAsMonthlyCost, isAnnual }) => {
    const isCurrent = plan === currentPlan;
    const currentLevel = getPlanLevel(currentPlan);
    const targetLevel = getPlanLevel(plan);
    const isDowngrade = targetLevel < currentLevel;

    let buttonText = 'Switch Plan';
    let buttonClass = '';

    if (isCurrent) {
        buttonText = 'Current Plan';
        buttonClass = 'bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 cursor-default';
    } else if (isDowngrade) {
        buttonText = 'Downgrade';
        buttonClass = 'bg-white dark:bg-zinc-900 dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-600';
    } else {
        buttonText = 'Upgrade';
        if (isKomplete) {
            buttonClass = 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:opacity-90 shadow-md';
        } else if (isPopular) {
            buttonClass = 'bg-primary-600 text-white hover:bg-primary-700 shadow-md';
        } else {
            buttonClass = 'bg-slate-800 text-white hover:bg-slate-700';
        }
    }

    return (
        <div className={`relative flex flex-col p-6 rounded-2xl border transition-all duration-300 ${isCurrent ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-lg ring-1 ring-primary-500' : isKomplete ? 'border-indigo-500/50 bg-indigo-50/10 dark:bg-indigo-900/10' : 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:bg-zinc-800 hover:border-primary-300 hover:shadow-md'}`}>
            {isPopular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-primary-600 text-white text-xs font-bold uppercase tracking-wide rounded-full shadow-sm">
                    Most Popular
                </div>
            )}
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{plan}</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 h-10">{description}</p>

            <div className="flex items-baseline gap-1 mb-2">
                <span className={`text-3xl font-bold ${isKomplete ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>{price}</span>
                {price !== 'Free' && price !== 'Custom' && !isKomplete && (
                    <span className="text-sm text-slate-500 dark:text-zinc-400">
                        {isAnnual && !viewAsMonthlyCost ? '/yr' : '/mo'}
                    </span>
                )}
                {isKomplete && price !== 'Custom' && (
                    <span className="text-sm text-slate-500 dark:text-zinc-400">
                        {isAnnual && !viewAsMonthlyCost ? '/yr' : '/mo'}
                    </span>
                )}
            </div>

            {userLimit && (
                <div className="mb-6 inline-block bg-slate-100 dark:bg-zinc-800 dark:bg-zinc-700 px-2 py-0.5 rounded text-2xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                    {userLimit}
                </div>
            )}

            <div className="flex-grow">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Includes:</p>
                <ul className="space-y-3 mb-8">
                    {features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-zinc-300">
                            <CheckIcon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isKomplete ? 'text-indigo-500' : isPopular ? 'text-primary-500' : 'text-slate-400'}`} />
                            <span>{feat}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <button
                onClick={onSelect}
                disabled={isCurrent}
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
    // CRO AUDIT: toggle controls moved INTO the calculator (next to "Estimated
    // Monthly Cost" header) instead of a giant toggle at the top of the page.
    showBillingToggle?: boolean,
    isAnnualState?: boolean,
    onToggleBilling?: () => void,
    viewAsMonthlyCostState?: boolean,
    onToggleViewMode?: () => void,
}> = ({ users, currentPlan, isAnnual, viewAsMonthlyCost, simulationCount, setSimulationCount, selectedModalities, showBillingToggle = false, isAnnualState, onToggleBilling, viewAsMonthlyCostState, onToggleViewMode }) => {
    const seatRateForTier = (tier: TierDef): number => {
        if (!isAnnual) return tier.monthlyPrice ?? 0;
        return Math.round((tier.annualPrice ?? 0) / 12);
    };

    const multiplier = (isAnnual && !viewAsMonthlyCost) ? 12 : 1;
    const totalActualUsers = users.length;
    const additionalSeats = Math.max(0, (totalActualUsers + simulationCount) - 1);
    const isSimulating = simulationCount > 0;

    let baseCost = 0, addOnCost = 0, addOnLabel = 'Additional Seats', baseSeatLabel = 'Admin Seat (You)';

    if (currentPlan === SubscriptionPlan.Enterprise) {
        const baseRate = isAnnual ? ENTERPRISE_BASE_PRICE.annual : ENTERPRISE_BASE_PRICE.monthly;
        const modalityCost = selectedModalities.reduce((sum, s) => {
            const found = ENTERPRISE_MODALITIES.find(m => m.specialty === s);
            return sum + (found ? (isAnnual ? Math.round(found.price * 0.8) : found.price) : 0);
        }, 0);
        const total = (baseRate + modalityCost) * multiplier;
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
                            <p className="text-2xs font-black text-amber-400/70 uppercase tracking-[0.2em]">Enterprise</p>
                            <h3 className="text-lg font-black text-white">Projected Billing</h3>
                        </div>
                    </div>

                    <div className="space-y-3 mb-4">
                        <div className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/10">
                            <div>
                                <p className="text-sm font-bold text-white">Enterprise Platform Base</p>
                                <p className="text-2xs text-zinc-400">Unlimited users · Full AI suite · All core features</p>
                            </div>
                            <p className="font-mono font-bold text-amber-400">₦{(baseRate * multiplier).toLocaleString()}</p>
                        </div>
                        {selectedModalities.map(s => {
                            const m = ENTERPRISE_MODALITIES.find(m => m.specialty === s);
                            if (!m) return null;
                            const rate = isAnnual ? Math.round(m.price * 0.8) : m.price;
                            return (
                                <div key={s} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/10">
                                    <div>
                                        <p className="text-sm font-bold text-white">{ModalityIcons[m.specialty]} {m.label} Modality</p>
                                        <p className="text-2xs text-zinc-400">Specialist dashboards · Statutory forms · AI Expert Mode</p>
                                    </div>
                                    <p className="font-mono font-bold text-amber-400">₦{(rate * multiplier).toLocaleString()}</p>
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

    if (currentPlan === SubscriptionPlan.Core) {
        baseCost = 0; addOnCost = 0;
    } else if (currentPlan === SubscriptionPlan.Growth) {
        const rate = seatRateForTier(VEGA_TIERS.Growth);
        baseCost = rate; addOnCost = additionalSeats * rate; addOnLabel = "Addt'l Seats (Growth Rate)";
    } else if (currentPlan === SubscriptionPlan.Komplete) {
        // CRO AUDIT FIX: Komplete is annual-only at ₦2.5M/yr with 10 seats included.
        // Seats 2-10 are included in the base price (no extra charge).
        // Seats 11+ are billed pro-rata at the Komplete annual rate / 10 / 12 per seat per month.
        const kompleteAnnual = KOMPLETE_TIER.annualPrice ?? 2500000;
        const baseRate = Math.round(kompleteAnnual / 12);  // monthly-equiv for display
        baseCost = baseRate;
        // First 9 additional seats (positions 2-10) are included; only bill beyond 10
        const billableExtraSeats = Math.max(0, additionalSeats - 9);
        const extraSeatRate = Math.round(baseRate / 10);  // pro-rata: 1/10th of monthly-equiv
        addOnCost = billableExtraSeats * extraSeatRate;
        addOnLabel = billableExtraSeats > 0
            ? `Addt'l Seats (Komplete Pro-Rata) — ${additionalSeats - billableExtraSeats} included`
            : `Addt'l Seats (Included in Komplete — ${10 - (1 + additionalSeats)} remaining)`;
    } else if (currentPlan === SubscriptionPlan.Pro) {
        const rate = seatRateForTier(VEGA_TIERS.Pro);
        baseCost = rate; addOnCost = additionalSeats * rate; addOnLabel = "Addt'l Seats (Pro Rate)";
    }

    const totalCost = (baseCost + addOnCost) * multiplier;
    const baseDisplay = baseCost * multiplier;
    const addOnDisplay = addOnCost * multiplier;

    return (
        <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isSimulating ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
                        <CalculatorIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {isSimulating ? 'Simulated' : 'Estimated'} {viewAsMonthlyCost ? 'Monthly' : 'Total'} Cost
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                            {isSimulating ? `Showing cost for ${totalActualUsers + simulationCount} seats (${totalActualUsers} current + ${simulationCount} simulated).` : `Based on your current team size (${totalActualUsers} seats).`}
                        </p>
                    </div>
                </div>
                {/* CRO AUDIT FIX: compact monthly/yearly toggle moved INSIDE the
                    billing calculator (between "Simulate Growth" and the cost display).
                    Smaller pill toggle with -20% badge. Hidden for annual-only products
                    (Komplete, Atrium) — showBillingToggle prop controls visibility. */}
                <div className="flex items-center gap-3 flex-wrap">
                    {showBillingToggle && onToggleBilling && (
                        <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded-full p-0.5 text-2xs font-bold">
                            <button
                                onClick={() => { if (isAnnualState) onToggleBilling(); }}
                                className={`px-2.5 py-1 rounded-full transition-all ${!isAnnualState ? 'bg-white dark:bg-zinc-700 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-zinc-400'}`}
                            >Monthly</button>
                            <button
                                onClick={() => { if (!isAnnualState) onToggleBilling(); }}
                                className={`px-2.5 py-1 rounded-full transition-all flex items-center gap-1 ${isAnnualState ? 'bg-white dark:bg-zinc-700 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-zinc-400'}`}
                            >Yearly <span className="text-emerald-600 text-3xs">-20%</span></button>
                        </div>
                    )}
                    {!showBillingToggle && (
                        <span className="px-2.5 py-1 bg-slate-100 dark:bg-zinc-800 rounded-full text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                            Annual Billing Only
                        </span>
                    )}
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-700/30 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700">
                        <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Simulate Growth</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setSimulationCount(Math.max(0, simulationCount - 1))} disabled={simulationCount === 0} className="w-6 h-6 flex items-center justify-center rounded-md bg-white dark:bg-zinc-900 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-600 text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-all font-bold">-</button>
                            <span className={`w-8 text-center font-mono font-bold text-sm ${isSimulating ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>+{simulationCount}</span>
                            <button onClick={() => setSimulationCount(Math.min(50, simulationCount + 1))} className="w-6 h-6 flex items-center justify-center rounded-md bg-white dark:bg-zinc-900 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-600 text-slate-600 hover:bg-slate-50 transition-all font-bold">+</button>
                        </div>
                        {isSimulating && <button onClick={() => setSimulationCount(0)} className="text-2xs font-bold text-primary-600 hover:underline ml-1">Reset</button>}
                    </div>
                </div>
            </div>
            {/* CRO AUDIT FIX: compact view-mode toggle (Show Monthly Avg / Show Total Billed)
                moved into the calculator header area too. Only shown when billing toggle
                is visible (i.e. for monthly/annual-capable plans). */}
            {showBillingToggle && onToggleViewMode && (
                <div className="flex items-center justify-end gap-2 text-xs text-slate-500 dark:text-zinc-400 mb-4 -mt-3">
                    <span className={viewAsMonthlyCostState ? 'font-bold text-slate-700 dark:text-slate-200' : ''}>Show Monthly Avg</span>
                    <div onClick={onToggleViewMode} className={`relative w-8 h-4 bg-slate-300 dark:bg-zinc-600 rounded-full cursor-pointer transition-colors ${!viewAsMonthlyCostState ? 'bg-primary-500' : ''}`}>
                        <div className={`absolute top-0.5 w-3 h-3 bg-white dark:bg-zinc-900 rounded-full shadow-sm transition-transform duration-200 ${!viewAsMonthlyCostState ? 'translate-x-4' : 'translate-x-0.5'}`}></div>
                    </div>
                    <span className={!viewAsMonthlyCostState ? 'font-bold text-slate-700 dark:text-slate-200' : ''}>Show Total Billed</span>
                </div>
            )}
            <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-700/30 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary-100 dark:bg-primary-900/30 text-primary-600 p-1.5 rounded-full"><UserCircleIcon className="w-4 h-4" /></div>
                        <div><p className="font-bold text-sm text-slate-800 dark:text-white">{baseSeatLabel}</p><p className="text-xs text-slate-500">{currentPlan} Rate</p></div>
                    </div>
                    <p className="font-mono font-bold text-slate-900 dark:text-white"><NairaSymbol />{formatNaira(baseDisplay)}</p>
                </div>
                {additionalSeats > 0 && (
                    <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-700/30 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 p-1.5 rounded-full"><span className="font-bold text-xs">+{additionalSeats}</span></div>
                            <div><p className="font-bold text-sm text-slate-800 dark:text-white">Team Members</p><p className="text-xs text-slate-500">{addOnLabel}</p></div>
                        </div>
                        <p className="font-mono font-bold text-slate-900 dark:text-white"><NairaSymbol />{formatNaira(addOnDisplay)}</p>
                    </div>
                )}
                <div className="border-t border-slate-200 dark:border-zinc-700 pt-4 flex justify-between items-end">
                    <div className="flex flex-col">
                        <p className="text-sm font-medium text-slate-500">Total Billed {isAnnual ? 'Annually' : 'Monthly'}</p>
                        {isAnnual && <p className="text-xs text-green-600 font-bold">Includes 20% discount applied.</p>}
                    </div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400"><NairaSymbol />{formatNaira(totalCost)}</p>
                </div>
            </div>
        </div>
    );
};

// --- ENTERPRISE UPGRADE SECTION ---
// SVG icon components — glassmorphic, no emojis
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
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-md">
                            <svg viewBox="0 0 24 24" className="w-4 h-4 text-black" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                        </div>
                        <div>
                            <p className="text-3xs font-black text-amber-400/60 uppercase tracking-[0.2em]">PracticePro</p>
                            <h3 className="text-lg font-black text-white leading-tight">Enterprise</h3>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-black text-amber-400">&#x20A6;{totalMonthly.toLocaleString()}<span className="text-zinc-500 text-xs font-normal">/mo</span></p>
                        <p className="text-2xs text-zinc-500">{isAnnual ? 'Annual (20% off)' : 'Monthly'}{selectedModalities.length > 0 ? ` · ${selectedModalities.length} module${selectedModalities.length > 1 ? 's' : ''}` : ' · Base'}</p>
                    </div>
                </div>
                {/* Included */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {['Unlimited users', 'Custom Storage', 'Audit Logs & SSO', 'SLA Guarantee', 'Account manager'].map(f => (
                        <span key={f} className="text-2xs font-semibold text-zinc-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">{f}</span>
                    ))}
                </div>
                {/* Modules */}
                <p className="text-3xs font-black text-amber-400/50 uppercase tracking-[0.2em] mb-2">Add Practice Modules</p>
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
                                <p className="text-2xs text-zinc-500 leading-relaxed mb-1.5">{mod.description}</p>
                                <p className={`text-2xs font-black ${isSelected ? 'text-amber-400' : 'text-zinc-500'}`}>+&#x20A6;{displayPrice.toLocaleString()}/mo</p>
                            </button>
                        );
                    })}
                </div>
                {/* CTA */}
                {isEnterprise ? (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-400/5 border border-amber-400/20">
                        <svg viewBox="0 0 24 24" className="w-4 h-4 text-amber-400 flex-shrink-0" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                        <div>
                            <p className="font-black text-white text-xs">You are on the Enterprise Plan</p>
                            <p className="text-zinc-500 text-2xs">Contact your account manager to adjust modules or billing.</p>
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
                    // CRO AUDIT FIX (Track A — A1): downgrades still go through the
                    // secure updateItem path, BUT updateItem now strips the protected
                    // 'subscriptionPlan' field. So we need to use a dedicated mutation
                    // for downgrades too. For now, log the request and notify founder.
                    // TODO: add a `requestPlanDowngrade` mutation that mirrors
                    // createSubscriptionRequest but for downgrades.
                    // For now, we'll route downgrades through the same pending flow
                    // as upgrades — the founder admin can approve/reject.
                    openModal('paymentGateway', null, {
                        amount: price,
                        title: `Switch to ${newPlan}`,
                        description: `${isAnnual ? 'Annual' : 'Monthly'} subscription — ${firmDetails.name}`,
                        forcePracticeProAccount: true,
                        subscriptionContext: {
                            requestedPlan: newPlan,
                            billingInterval: isAnnual ? 'annual' : 'monthly',
                            firmId: firmDetails.id,
                        },
                        onConfirm: () => {
                            logActivity(`Requested switch to ${newPlan} plan (bank transfer)`, 'User',
                                coreState.users.find(u => u.role === 'Admin')?.id,
                                coreState.users.find(u => u.role === 'Admin')?.name);
                            addToast(`Switch request logged. Our team will verify and update your workspace within 24 hours.`, { type: 'success', duration: 6000 });
                        }
                    });
                    closeModal();
                }
            });
        } else {
            // Upgrading — show the payment modal with bank transfer details.
            // CRO AUDIT FIX (Track A — A1): NO LONGER flips subscriptionPlan client-side.
            // Instead, opens PaymentGatewayModal with subscriptionContext, which calls
            // createSubscriptionRequest to write a pending row. The firm's plan is only
            // flipped when (a) the founder admin approves OR (b) the Paystack webhook
            // confirms payment (via activateFirmSubscription).
            openModal('paymentGateway', null, {
                amount: price,
                title: `Upgrade to ${newPlan}`,
                description: `${isAnnual ? 'Annual' : 'Monthly'} subscription — ${firmDetails.name}`,
                forcePracticeProAccount: true,   // CRO AUDIT A4 — always PracticePro's account
                subscriptionContext: {
                    requestedPlan: newPlan,
                    billingInterval: isAnnual ? 'annual' : 'monthly',
                    firmId: firmDetails.id,
                },
                onConfirm: () => {
                    // This fires AFTER the user clicks "Done" on the PaymentGatewayModal's
                    // confirmed state. The createSubscriptionRequest mutation has already
                    // been called inside the modal — we just log the activity here.
                    logActivity(`Requested upgrade to ${newPlan} plan (bank transfer)`, 'User',
                        coreState.users.find(u => u.role === 'Admin')?.id,
                        coreState.users.find(u => u.role === 'Admin')?.name);
                    addToast(`Upgrade request logged. Our team will verify your payment within 24 hours. You'll get an email when ${newPlan} is active.`, { type: 'success', duration: 6000 });
                }
            });
        }
    };

    const handleActivateEnterprise = () => {
        if (selectedModalities.length === 0) {
            addToast('Please select at least one Practice Modality to activate Enterprise.', { type: 'error' });
            return;
        }
        // CRO AUDIT FIX (Track A — A1): Enterprise is a paid tier. Cannot be
        // self-activated without payment. Route through the same pending flow.
        openModal('deleteConfirmation', null, {
            title: 'Activate Enterprise Plan',
            message: `You are requesting Enterprise access with ${selectedModalities.length} practice modalit${selectedModalities.length > 1 ? 'ies' : 'y'}: ${selectedModalities.join(', ')}.\n\nEnterprise requires a setup fee and annual billing. Click continue to see bank-transfer details. Your workspace will be activated once payment is verified.`,
            confirmText: 'Continue to Payment',
            confirmButtonClass: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black hover:opacity-90',
            onConfirm: () => {
                closeModal();
                // Open the payment modal with Enterprise pricing
                const enterprisePrice = (getTiersForProduct(resolveProductMode(firmDetails.product)) as any)?.Enterprise?.annualPrice || 5000000;
                openModal('paymentGateway', null, {
                    amount: enterprisePrice,
                    title: 'Activate Enterprise',
                    description: `Annual subscription — ${firmDetails.name}`,
                    forcePracticeProAccount: true,
                    subscriptionContext: {
                        requestedPlan: SubscriptionPlan.Enterprise,
                        billingInterval: 'annual',
                        firmId: firmDetails.id,
                    },
                    onConfirm: () => {
                        logActivity('Requested Enterprise activation (bank transfer)', 'User',
                            coreState.users.find(u => u.role === 'Admin')?.id);
                        addToast('Enterprise activation request logged. Our team will contact you within 24 hours.', { type: 'success' });
                    }
                });
            }
        });
    };

    const activeFirmUsers = coreState.users.filter(u =>
        u.role !== 'Client' && u.role !== 'Tenant' && u.role !== 'External Counsel' && u.role !== 'Pending'
    );
    const productMode = resolveProductMode(firmDetails.product);
    const tiers = getTiersForProduct(productMode);
    const currentPlan = firmDetails.subscriptionPlan || SubscriptionPlan.Core;
    const normalizedCurrent = currentPlan;

    // ─── Fix Product Mode ──────────────────────────────────────────────
    // If the firm is on a Komplete/Enterprise plan but the product field
    // says 'vega' or 'atrium', show a warning + fix button. This handles
    // the recurring bug where Komplete firms lose property features because
    // their product field is stale.
    const { product: activeProduct, isUnified } = useProduct();
    const { currentUser } = useAuth();
    const [isFixingProduct, setIsFixingProduct] = useState(false);
    const fixProductModeMutation = useMutation(api.myFunctions.fixProductMode);
    const needsProductFix = !isUnified && (
        currentPlan === SubscriptionPlan.Komplete ||
        currentPlan === SubscriptionPlan.Enterprise
    );
    const handleFixProductMode = async () => {
        if (!currentUser?.firmId) return;
        setIsFixingProduct(true);
        try {
            const result = await fixProductModeMutation({
                firmId: currentUser.firmId,
                product: 'unified',
            });
            addToast(`✓ Product mode fixed to Komplete (unified). Updated ${result.updatedUsers} user(s). Please refresh the page.`, { type: 'success' });
            // Force a page refresh so all components pick up the new product mode
            setTimeout(() => window.location.reload(), 1500);
        } catch (err: any) {
            addToast(`Failed to fix product mode: ${err.message}`, { type: 'error' });
        } finally {
            setIsFixingProduct(false);
        }
    };

    // CRO AUDIT FIX: detect if current plan supports monthly billing.
    // Komplete (unified) is annual-only. Atrium (property) is annual-only.
    // Only Vega (legal) firms on Core/Growth/Pro can toggle monthly/yearly.
    const isAnnualOnlyProduct = isUnified || productMode === 'property' || productMode === 'atrium';

    // CRO AUDIT FIX: detect if the user is already on the highest available
    // plan for their product. If so, hide upgrade CTAs and show downgrade +
    // seat-usage info instead.
    const isOnHighestPlan = isUnified
        ? (currentPlan === SubscriptionPlan.Komplete || currentPlan === SubscriptionPlan.Enterprise)
        : (currentPlan === SubscriptionPlan.Pro || currentPlan === SubscriptionPlan.Enterprise);

    return (
        <div className="space-y-5">
            {/* Header — CRO AUDIT FIX: show current plan immediately.
                "Billing & Plans: Komplete" instead of just "Billing & Plans".
                Also moved higher on the page (removed mb-6, tighter spacing). */}
            <div className="flex flex-col gap-3 mb-2">
                <div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                            Billing &amp; Plans: <span className="text-primary-600 dark:text-primary-400">{currentPlan}</span>
                        </h3>
                    </div>
                    <p className="text-slate-500 dark:text-zinc-400 max-w-2xl text-sm mt-1">
                        Manage your plan, billing cycle, and seat allocation.
                        {!isAnnualOnlyProduct && (
                            <span className="ml-1 text-slate-400">Switch between monthly and yearly billing below.</span>
                        )}
                        {isAnnualOnlyProduct && (
                            <span className="ml-1 text-slate-400">Your plan is billed annually.</span>
                        )}
                    </p>
                </div>
            </div>

            {/* ─── Fix Product Mode Warning ─────────────────────────── */}
            {needsProductFix && (
                <div className="w-full bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="text-sm">
                            <p className="font-bold text-amber-800 dark:text-amber-200">Product Mode Mismatch Detected</p>
                            <p className="text-amber-700 dark:text-amber-300 text-xs mt-1">
                                Your plan is <strong>{currentPlan}</strong> but your product mode is <strong>{activeProduct}</strong>.
                                This means property features (Properties page, Units on dashboard) are hidden.
                                Click below to fix this permanently.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleFixProductMode}
                        disabled={isFixingProduct}
                        className="w-full md:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isFixingProduct ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Fixing...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                Fix Product Mode → Komplete
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Billing Widget — CRO AUDIT FIX: monthly/yearly toggle is now INSIDE
                the BillingCalculator (passed as props), not a giant toggle at the top.
                For annual-only products (Komplete, Atrium), the toggle is hidden entirely. */}
            <BillingCalculator
                users={activeFirmUsers}
                currentPlan={firmDetails.subscriptionPlan || SubscriptionPlan.Core}
                isAnnual={isAnnual}
                viewAsMonthlyCost={viewAsMonthlyCost}
                simulationCount={simulationCount}
                setSimulationCount={setSimulationCount}
                selectedModalities={selectedModalities.length > 0 ? selectedModalities : (firmDetails.firmSpecialties || [])}
                // CRO AUDIT: pass toggle controls into the calculator so they sit
                // in the "estimated monthly cost" area, not at the top of the page.
                showBillingToggle={!isAnnualOnlyProduct}
                isAnnualState={isAnnual}
                onToggleBilling={() => setIsAnnual(!isAnnual)}
                viewAsMonthlyCostState={viewAsMonthlyCost}
                onToggleViewMode={() => setViewAsMonthlyCost(!viewAsMonthlyCost)}
            />

            {/* Standard Plan Cards — Core / Growth / Pro from tiers.ts.
                For Komplete (unified) firms, all three tiers are the same
                (KOMPLETE_TIER), so we show a single card instead of three
                identical ones. */}
            {productMode === 'unified' ? (
                <div className="grid grid-cols-1 gap-6 max-w-md mx-auto">
                    <PlanCard
                        plan={SubscriptionPlan.Komplete}
                        currentPlan={normalizedCurrent}
                        price={formatSettingsPrice(tiers.Core, true, viewAsMonthlyCost)}
                        description={TIER_SETTINGS_COPY.Core.description}
                        userLimit={TIER_SETTINGS_COPY.Core.userLimit}
                        viewAsMonthlyCost={viewAsMonthlyCost}
                        isAnnual={true}
                        features={tiers.Core.features}
                        isPopular={true}
                        isKomplete={true}
                        // CRO AUDIT FIX: Komplete is annual-only — always pass annualPrice
                        onSelect={() => processUpgrade(SubscriptionPlan.Komplete, tiers.Core.annualPrice ?? 0)}
                    />
                    {/* CRO AUDIT FIX: For Komplete users, show downgrade options.
                        Komplete users can downgrade to Atrium Pro or Vega Pro if they
                        no longer need the unified product. This prevents churn —
                        we'd rather keep them on a lower plan than lose them entirely. */}
                    {isOnHighestPlan && (
                        <div className="mt-4 p-4 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-xl">
                            <h4 className="text-sm font-bold text-slate-700 dark:text-zinc-300 mb-2">Need to downsize?</h4>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">
                                You can downgrade to a single-product plan (Atrium Pro or Vega Pro) if you no longer need the unified Komplete experience. Your data is preserved.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => processUpgrade('Pro' as any, 2100000)}
                                    className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-200 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    Downgrade to Atrium Pro (₦2.1M/yr)
                                </button>
                                <button
                                    onClick={() => processUpgrade('Pro' as any, 768000)}
                                    className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-200 text-xs font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    Downgrade to Vega Pro (₦768K/yr)
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {DISPLAY_TIER_IDS.map((tierId) => {
                    const tier = tiers[tierId];
                    const plan = tierIdToSubscriptionPlan(tierId);
                    const copy = TIER_SETTINGS_COPY[tierId];
                    const price = formatSettingsPrice(tier, isAnnual, viewAsMonthlyCost);
                    const upgradePrice = isAnnual ? (tier.annualPrice ?? 0) : (tier.monthlyPrice ?? 0);
                    return (
                <PlanCard
                            key={tierId}
                            plan={plan}
                            currentPlan={normalizedCurrent}
                            price={price}
                            description={copy.description}
                            userLimit={copy.userLimit}
                    viewAsMonthlyCost={viewAsMonthlyCost}
                    isAnnual={isAnnual}
                            features={tier.features}
                            isPopular={tier.recommended}
                            isKomplete={currentPlan === SubscriptionPlan.Komplete}
                            onSelect={() => processUpgrade(plan, upgradePrice)}
                        />
                    );
                })}
            </div>
            )}

            {firmDetails.subscriptionPlan === SubscriptionPlan.Enterprise && (
                <p className="text-center text-sm text-slate-500 dark:text-zinc-400 py-4 border-t border-slate-200 dark:border-zinc-700">
                    Your firm is on a custom Enterprise plan. Contact{' '}
                    <a href="mailto:practiceprosystems@gmail.com" className="text-primary-600 font-semibold hover:underline">practiceprosystems@gmail.com</a>
                    {' '}to change billing or modalities.
                </p>
            )}

            {/* ─── ADD-ONS SECTION (CRO AUDIT — Revenue Expansion) ──────────
                Shows upsellable extras (extra WhatsApp, extra seats, storage,
                AI priority, custom integrations, data migration). Users can
                purchase add-ons, which create pending requests for founder
                approval. Active add-ons are also shown. */}
            <AddOnsSection firmDetails={firmDetails} />
        </div>
    );
};

// ─── ADD-ONS SECTION COMPONENT ─────────────────────────────────────────────
const AddOnsSection: React.FC<{ firmDetails: FirmDetails }> = ({ firmDetails }) => {
    const { addToast } = useUI();
    const { currentUser } = useAuth();
    const [purchasingId, setPurchasingId] = useState<string | null>(null);

    // Fetch active + pending add-ons for this firm
    const activeAddons = useQuery(api.myFunctions.getActiveAddonsForFirm,
        currentUser?.email ? { userEmail: currentUser.email } : "skip");
    const pendingAddons = useQuery(api.myFunctions.getPendingAddonsForFirm,
        currentUser?.email ? { userEmail: currentUser.email } : "skip");

    const createAddonRequest = useMutation(api.myFunctions.createAddonRequest);

    const product = firmDetails.product || 'unified';
    const applicableAddons = getAddonsForProduct(product);

    const handlePurchase = async (addon: AddonDef) => {
        setPurchasingId(addon.id);
        try {
            await createAddonRequest({
                addonId: addon.id,
                addonName: addon.name,
                billingInterval: addon.billingInterval,
                amount: addon.amount,
                quantity: 1,
                userEmail: currentUser?.email,
            });
            addToast(`${addon.name} request submitted. Our team will verify your payment and activate it within 24 hours.`, { type: 'success', duration: 6000 });
        } catch (e: any) {
            addToast(e?.message || 'Failed to submit add-on request.', { type: 'error' });
        } finally {
            setPurchasingId(null);
        }
    };

    if (applicableAddons.length === 0) return null;

    return (
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-zinc-700">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add-Ons &amp; Extras</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                Supercharge your workspace with additional capacity. All add-ons are billed separately and can be cancelled anytime.
            </p>

            {/* Active Add-Ons (if any) */}
            {activeAddons && activeAddons.length > 0 && (
                <div className="mb-4 space-y-2">
                    <p className="text-2xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Active Add-Ons</p>
                    {activeAddons.map((addon: any) => (
                        <div key={addon._id} className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                    {addon.addonName}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-zinc-400">
                                    {addon.quantity > 1 ? `${addon.quantity} × ` : ''}<NairaSymbol />{formatNaira(addon.discountedAmount || addon.amount || 0)}/{addon.billingInterval === 'monthly' ? 'mo' : addon.billingInterval === 'annual' ? 'yr' : 'one-time'}
                                    {addon.discountPercent && addon.discountPercent > 0 && <span className="text-emerald-600 ml-1">({addon.discountPercent}% discount applied)</span>}
                                </p>
                            </div>
                            <span className="px-2 py-0.5 bg-emerald-600 text-white text-2xs font-black uppercase rounded-full">Active</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Pending Add-Ons (if any) */}
            {pendingAddons && pendingAddons.length > 0 && (
                <div className="mb-4 space-y-2">
                    <p className="text-2xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Pending Review</p>
                    {pendingAddons.map((addon: any) => (
                        <div key={addon._id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{addon.addonName}</p>
                                <p className="text-xs text-slate-500 dark:text-zinc-400">
                                    Submitted {new Date(addon.requestedAt).toLocaleDateString()} — awaiting founder approval.
                                </p>
                            </div>
                            <span className="px-2 py-0.5 bg-amber-500 text-white text-2xs font-black uppercase rounded-full animate-pulse">Pending</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Available Add-Ons Catalog */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {applicableAddons.map((addon) => {
                    const isPurchasing = purchasingId === addon.id;
                    return (
                        <div key={addon.id} className={`p-4 rounded-xl border transition-all ${addon.popular ? 'border-primary-300 dark:border-primary-700 bg-primary-50/30 dark:bg-primary-900/10' : 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800'} hover:shadow-md`}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    {addon.icon && <span className="text-xl flex-shrink-0">{addon.icon}</span>}
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{addon.name}</h4>
                                </div>
                                {addon.popular && (
                                    <span className="px-1.5 py-0.5 bg-primary-600 text-white text-3xs font-black uppercase rounded-full flex-shrink-0">Popular</span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3 leading-relaxed">{addon.description}</p>
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-base font-black text-primary-600 dark:text-primary-400">{formatAddonPrice(addon)}</p>
                                    <p className="text-3xs text-slate-400 uppercase tracking-wider">{addon.unitLabel}</p>
                                </div>
                                <button
                                    onClick={() => handlePurchase(addon)}
                                    disabled={isPurchasing}
                                    className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all active:scale-95 flex items-center gap-1.5 flex-shrink-0"
                                >
                                    {isPurchasing ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                            </svg>
                                            Purchase
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SubscriptionSettings;
