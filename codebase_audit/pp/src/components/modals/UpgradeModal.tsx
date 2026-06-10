
import React, { useMemo } from 'react';
import { useUI } from '../../contexts/UIContext';
import { CheckIcon, SparklesIcon, ShieldCheckIcon, LockClosedIcon } from '../../constants';
import { SubscriptionPlan } from '../../types';

interface UpgradeModalProps {
    featureName: string;
    onUpgrade: () => void;
    onClose: () => void;
    targetPlan?: SubscriptionPlan;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ featureName, onUpgrade, onClose, targetPlan = SubscriptionPlan.Pro }) => {

    const planConfig = useMemo(() => {
        if (targetPlan === SubscriptionPlan.Enterprise) {
            return {
                title: "Enterprise Plan",
                price: "Custom",
                priceSuffix: "pricing",
                features: [
                    "Everything in Pro",
                    "Unlimited Users & Units",
                    "Audit Logs & Role-Based Access",
                    "Dedicated Account Manager",
                    "Custom SLA Guarantee"
                ],
                buttonText: "Contact Sales",
                headerColor: "from-yellow-500 to-orange-500"
            };
        } else if (targetPlan === SubscriptionPlan.Growth) {
            return {
                title: "Growth Plan",
                price: "₦45,000",
                priceSuffix: "/mo",
                features: [
                    "Up to 3 Users",
                    "50 Active Matters",
                    "Client Communication",
                    "Advanced Legal Billing",
                    "Unlimited Data & Records"
                ],
                buttonText: "Start 14-Day Free Trial",
                headerColor: "from-blue-600 to-indigo-600"
            };
        } else if (targetPlan === SubscriptionPlan.Komplete) {
            return {
                title: "Komplete",
                price: "₦130,000",
                priceSuffix: "/mo",
                features: [
                    "Unlimited Users",
                    "Unlimited Matters & Units",
                    "Unlimited Tenants",
                    "ALOA® AI Copilot",
                    "Full Legal + Property Suite"
                ],
                buttonText: "Start 14-Day Free Trial",
                headerColor: "from-violet-600 to-purple-600"
            };
        } else {
            // Default to Pro — aligned with tiers.ts VEGA_TIERS.Pro
            return {
                title: "Pro Plan",
                price: "₦80,000",
                priceSuffix: "/mo",
                features: [
                    "Up to 10 Users",
                    "Unlimited Matters",
                    "ALOA® AI Copilot",
                    "Enterprise Jurisdiction Intake",
                    "Unlimited Data & Records"
                ],
                buttonText: "Start 14-Day Free Trial",
                headerColor: "from-emerald-600 to-teal-600"
            };
        }
    }, [targetPlan]);

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden max-w-2xl w-full">
            {/* Header */}
            <div className={`bg-gradient-to-r ${planConfig.headerColor} p-8 text-center text-white relative overflow-hidden`}>
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="relative z-10">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                        <SparklesIcon className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold mb-2">Unlock {featureName}</h2>
                    <p className="text-white/90 text-lg">Take your practice to the next level with our {planConfig.title} features.</p>
                </div>
            </div>

            <div className="p-8">
                <div className="grid md:grid-cols-2 gap-8 mb-8">
                    {/* Left: What you're missing */}
                    <div>
                        <h3 className="font-bold text-slate-500 uppercase text-xs tracking-wider mb-4">Included in {planConfig.title}</h3>
                        <ul className="space-y-4">
                            {planConfig.features.map((feat, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <div className="p-1 bg-green-100 rounded-full text-green-600 mt-0.5"><CheckIcon className="w-3 h-3" /></div>
                                    <div>
                                        <p className="font-semibold text-slate-800 dark:text-white">{feat}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Right: Offer */}
                    <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-6 border border-slate-200 dark:border-zinc-700 flex flex-col justify-center items-center text-center">
                        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 mb-2">Upgrade to {planConfig.title}</p>
                        <div className="flex items-baseline gap-1 mb-6">
                            <span className="text-4xl font-bold text-slate-900 dark:text-white">{planConfig.price}</span>
                            <span className="text-sm text-slate-500">{planConfig.priceSuffix}</span>
                        </div>
                        <button
                            onClick={onUpgrade}
                            className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 mb-3"
                        >
                            {planConfig.buttonText}
                        </button>
                        <p className="text-xs text-slate-400">Cancel anytime.</p>
                    </div>
                </div>

                <div className="text-center">
                    <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300 font-medium">
                        Maybe Later
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpgradeModal;
