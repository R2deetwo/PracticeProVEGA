
import React from 'react';
import { Button } from '../ui';
import { useUI } from '../../contexts/UIContext';
import { ShieldCheckIcon } from '../../constants';

/**
 * RegulatoryGateModal — the add-on gate for MODULE 2 (R48).
 *
 * Owner brief (verbatim): "Add-on Gate UI: If a standard user attempts to
 * run this module, display a clean modal: 'Unlock the Regulatory
 * Cross-Referencing Add-on to automate statutory audits against Nigerian
 * laws.' with an upgrade CTA."
 *
 * The CTA opens the existing upgradePlan modal pre-pointed at Enterprise
 * (the engine ships with Enterprise; negotiated add-on activation for Pro
 * firms happens at the firm level, so no price is invented here).
 */

export const RegulatoryGateModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { openModal } = useUI();

    const handleUpgrade = () => {
        onClose();
        openModal('upgradePlan', null, {
            featureName: 'the Regulatory Cross-Referencing engine',
            targetPlan: 'Enterprise',
        });
    };

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/50 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="regulatory-gate-title">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
                <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex-shrink-0">
                        <ShieldCheckIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                        <h3 id="regulatory-gate-title" className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                            Unlock the Regulatory Cross-Referencing Add-on
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mt-1.5">
                            Unlock the Regulatory Cross-Referencing Add-on to automate statutory
                            audits against Nigerian laws.
                        </p>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/60 p-4">
                    <p className="text-xs font-mono uppercase tracking-widest text-slate-500 dark:text-zinc-500 mb-2">
                        What it audits
                    </p>
                    <ul className="space-y-1.5 text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
                        <li>· CAMA 2020 — corporate and pre-incorporation provisions</li>
                        <li>· Labour Act — written particulars and termination notice</li>
                        <li>· FCCPA 2018 — restraints of trade, abuse of dominance</li>
                        <li>· Lagos Tenancy Law 2011 — advance rent, notice to quit</li>
                    </ul>
                    <p className="text-2xs text-slate-500 dark:text-zinc-500 mt-3 leading-relaxed">
                        Every finding carries an exact section citation — “Violation of Section 4
                        of the Lagos Tenancy Law 2011” — and the fix that cures it.
                    </p>
                </div>

                <div className="flex flex-col gap-2">
                    <Button variant="primary" fullWidth onClick={handleUpgrade}>
                        Upgrade to Enterprise
                    </Button>
                    <Button variant="ghost" fullWidth onClick={onClose}>
                        Not now
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default RegulatoryGateModal;
