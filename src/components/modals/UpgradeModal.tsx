
import React, { useMemo } from 'react';
import { CheckIcon, SparklesIcon } from '../../constants';
import { SubscriptionPlan } from '../../types';
import { useIsProperty } from '../../contexts/ProductContext';

interface UpgradeModalProps {
  featureName: string;
  onUpgrade: () => void;
  onClose: () => void;
  targetPlan?: SubscriptionPlan;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ featureName, onUpgrade, onClose, targetPlan = SubscriptionPlan.Pro }) => {
  const isProperty = useIsProperty();

  const planConfig = useMemo(() => {
    if (targetPlan === SubscriptionPlan.Komplete) {
      return {
        title: "Komplete",
        price: "₦130,000",
        features: [
          "Unlimited Users",
          isProperty ? 'Unlimited Properties & Units' : 'Unlimited Matters & Units',
          "Unlimited Active Tenants",
          "ARIA AI Copilot (Uncapped Priority)",
          isProperty ? 'Full Property Suite' : 'Full Legal + Property Suite'
        ],
        buttonText: "Upgrade to Komplete",
        accentColor: "text-indigo-600"
      };
    } else {
      return {
        title: "Pro Plan",
        price: "₦80,000",
        features: [
          "ARIA AI Assistant (Uncapped Priority)",
          "Unlimited Team Users",
          isProperty ? 'Advanced Revenue Billing & Analytics' : 'Advanced Legal Billing & Analytics',
          isProperty ? 'Unlimited Active Properties' : 'Unlimited Active Matters',
          isProperty ? "Uncapped Residents' Portal Deployments" : 'Uncapped Client Portal Deployments'
        ],
        buttonText: "Start 14-Day Free Trial",
        accentColor: "text-emerald-600"
      };
    }
  }, [targetPlan, isProperty]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <SparklesIcon className="w-7 h-7 text-primary-600" />
        </div>
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">Unlock {featureName}</h3>
        <p className="text-sm text-slate-500">Upgrade to {planConfig.title} for full access.</p>
      </div>

      {/* Features */}
      <div>
        <h4 className="text-2xs font-black text-slate-400 uppercase tracking-widest mb-3">Included in {planConfig.title}</h4>
        <ul className="space-y-3">
          {planConfig.features.map((feat, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="p-1 bg-emerald-100 rounded-full text-emerald-600 mt-0.5"><CheckIcon className="w-3 h-3" /></div>
              <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{feat}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Price + CTA */}
      <div className="p-5 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 text-center">
        <div className="flex items-baseline justify-center gap-1 mb-4">
          <span className={`text-3xl font-black ${planConfig.accentColor}`}>{planConfig.price}</span>
          <span className="text-sm text-slate-500">/mo</span>
        </div>
        <button
          onClick={onUpgrade}
          className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 mb-2"
        >
          {planConfig.buttonText}
        </button>
        <p className="text-2xs text-slate-400">Cancel anytime.</p>
      </div>

      <div className="text-center">
        <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-800 dark:text-zinc-100 font-medium">
          Maybe Later
        </button>
      </div>
    </div>
  );
};

export default UpgradeModal;
