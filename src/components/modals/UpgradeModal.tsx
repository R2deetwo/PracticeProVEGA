
import React, { useMemo } from 'react';
import { useUI } from '../../contexts/UIContext';
import { CheckIcon, SparklesIcon, ShieldCheckIcon, LockClosedIcon } from '../../constants';
import { SubscriptionPlan } from '../../types';

interface UpgradeModalProps {
    featureName: string;
    onUpgrade: () => void;
    onClose: () => void;
    targetPlan?: SubscriptionPlan; // NEW: Explicitly pass target plan
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ featureName, onUpgrade, onClose, targetPlan = SubscriptionPlan.Pro }) => {

    // Configuration for different upgrade targets
    const planConfig = useMemo(() => {
        if (targetPlan === SubscriptionPlan.Ultimate) {
            return {
                title: "Ultimate Plan",
                price: "₦80,000",
                features: [
                    "Everything in Pro",
                    "Property Management Suite",
                    "Multi-Workspace Access (Admin Only)",
                    "Priority Support",
                    "Next 2 Seats @ Pro Rate",
                    "Subsequent Seats @ Core Rate",
                    "Unlimited Storage"
                ],
                buttonText: "Upgrade to Ultimate",
                headerColor: "from-yellow-500 to-orange-500"
            };
        } else {
            // Default to Pro
            return {
                title: "Pro Plan",
                price: "₦45,000",
                features: [
                    "ALOA® AI Assistant",
                    "Team Collaboration",
                    "Advanced Analytics",
                    "Automation Rules",
                    "Document Summaries"
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
                            <span className="text-sm text-slate-500">{targetPlan === SubscriptionPlan.Ultimate ? '/mo (Admin)' : '/user/mo'}</span>
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
