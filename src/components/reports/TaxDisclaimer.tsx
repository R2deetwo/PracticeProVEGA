
import React from 'react';
import { WarningIcon } from '../../constants';
import { useTipManager } from '../../hooks/useTipManager';
import { DismissIcon } from '../../constants';

const TaxDisclaimer: React.FC = () => {
    const { isTipVisible, dismissTip } = useTipManager();
    const tipId = 'tax_disclaimer_global';
    
    if (!isTipVisible(tipId, 'Billing')) return null;

    const disclaimerText = "Guidance Only: Tax information and estimates are for general guidance and not professional tax advice. Consult a qualified accountant for your specific situation.";
    
    return (
        <div 
            className="p-3 mb-4 rounded-lg text-sm bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-600/50 relative group"
            role="alert"
        >
            <div className="flex justify-between items-start">
                <p className="pr-6 flex items-center gap-1.5"><WarningIcon className="w-4 h-4" /><strong>{disclaimerText}</strong></p>
                <button 
                    onClick={() => dismissTip(tipId)}
                    className="p-1 text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200 hover:bg-yellow-100 dark:hover:bg-yellow-800/50 rounded transition-colors"
                    aria-label="Dismiss disclaimer"
                >
                    <DismissIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default TaxDisclaimer;
