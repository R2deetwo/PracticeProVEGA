
import React, { useState } from 'react';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { useProduct } from '../../contexts/ProductContext';
import { ShieldCheckIcon, LockClosedIcon, OfficeBuildingIcon, CheckCircleIcon, WarningIcon } from '../../constants';
import { SubscriptionPlan } from '../../types';

interface JoinFirmModalProps {
    onClose: () => void;
}

const JoinFirmModal: React.FC<JoinFirmModalProps> = ({ onClose }) => {
    const { joinFirm, validateInviteCode, handleClearState } = useDataActions();
    const { coreState, isDataLoaded } = useCoreState();
    const { addToast } = useUI();
    const { currentUser } = useAuth();
    const { isProperty } = useProduct();
    
    const [step, setStep] = useState<'input' | 'confirm'>('input');
    const [inviteCode, setInviteCode] = useState('');
    const [foundFirmName, setFoundFirmName] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentPlan = coreState.firmDetails.subscriptionPlan || SubscriptionPlan.Core;
    const isHighTier = currentPlan === SubscriptionPlan.Ultimate || currentPlan === SubscriptionPlan.Enterprise;

    const handleValidate = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanCode = inviteCode.trim().toUpperCase();
        if (!cleanCode) return;

        setError(null);
        setIsSubmitting(true);
        
        try {
            const result = await validateInviteCode(cleanCode);
            if (result?.valid && result.firmName) {
                setFoundFirmName(result.firmName);
                setStep('confirm');
            } else {
                setError("Invalid Invite Code. Please check with your firm administrator.");
            }
        } catch (e: any) {
            setError(e.message || "Network error. Please check your connection and try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirmJoin = async () => {
        if (!inviteCode) return;
        setIsSubmitting(true);

        try {
            const cleanCode = inviteCode.trim().toUpperCase();
            const newFirmId = await joinFirm(cleanCode);
            
            if (newFirmId) {
                if (!isHighTier) {
                    const oldStorageKey = `practicepro_state_${currentUser?.id}`;
                    localStorage.removeItem(oldStorageKey);
                    handleClearState();
                }

                addToast(`Request sent to ${foundFirmName}! Awaiting admin approval — you'll gain access once approved.`, { type: 'success' });
                onClose();
                
                // Force reload to ensure a completely fresh state from the new firm
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                setError("Join failed. Code may have expired or changed.");
                setStep('input'); // Go back to try again
            }
        } catch (e: any) {
            console.error("Join Firm Error:", e);
            setError(e.message || "Connection failed. Please try again.");
            setStep('input');
        } finally {
             setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center p-4 bg-slate-50 dark:bg-zinc-900/50 rounded-xl border border-slate-200 dark:border-zinc-800">
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <OfficeBuildingIcon className="w-6 h-6 text-primary-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{isProperty ? 'Join Another Portfolio' : 'Join Another Firm'}</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2">
                    Enter the Invite Code provided by the {isProperty ? 'manager' : 'firm administrator'}.
                </p>
            </div>

            {/* Admin Warning */}
            {currentUser?.role === 'Admin' && step === 'input' && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded-r-lg">
                    <div className="flex items-start gap-3">
                        <ShieldCheckIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wide">Privilege Transfer Warning</h4>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
                                You are currently an <strong>Admin</strong>. Joining another {isProperty ? 'portfolio' : 'firm'} will set your role to <strong>Pending</strong> in the new workspace. You will need the new {isProperty ? 'portfolio\'s' : 'firm\'s'} administrator to approve your access.
                            </p>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Warning Section */}
            {!isHighTier && step === 'input' && currentUser?.role !== 'Admin' && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-lg">
                    <div className="flex items-start gap-3">
                        <LockClosedIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-red-800 dark:text-red-200 uppercase tracking-wide">Data Overwrite Warning</h4>
                            <p className="text-xs text-red-700 dark:text-red-300 mt-1 leading-relaxed">
                                Your current plan (<strong>{currentPlan}</strong>) supports only one workspace. 
                                Joining a new {isProperty ? 'portfolio' : 'firm'} will <strong>switch your active workspace</strong>. 
                            </p>
                        </div>
                    </div>
                </div>
            )}
            
            {error && (
                <div className="p-3 bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-200 animate-shake flex items-center gap-2">
                        <span className="text-lg"><WarningIcon className="w-5 h-5 inline-block -mt-1" /></span> {error}
                </div>
            )}

            {step === 'input' ? (
                <form onSubmit={handleValidate} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Invite Code</label>
                        <input autoComplete="off" data-lpignore="true"  
                            type="text" 
                            placeholder="INV-XXXX" 
                            value={inviteCode}
                            onChange={e => setInviteCode(e.target.value.toUpperCase())}
                            className="w-full p-4 text-2xl font-mono font-bold tracking-widest text-center border border-slate-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-primary-500 transition-all uppercase"
                            autoFocus
                        />
                    </div>
                    
                    <div className="pt-2 flex flex-col gap-2">
                        <button 
                            type="submit" 
                            disabled={!inviteCode || isSubmitting}
                            className="w-full py-3 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-all shadow-lg flex justify-center items-center gap-2"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>Verify Code</>
                            )}
                        </button>
                        <button type="button" onClick={onClose} className="w-full py-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300 font-medium">
                            Cancel
                        </button>
                    </div>
                </form>
            ) : (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800 text-center">
                        <CheckCircleIcon className="w-10 h-10 text-green-500 mx-auto mb-2" />
                        <h4 className="text-lg font-bold text-green-900 dark:text-green-100">{foundFirmName}</h4>
                        <p className="text-xs text-green-700 dark:text-green-300 mt-1">Code Verified</p>
                    </div>
                    
                    <div className="pt-2 flex flex-col gap-2">
                        <button 
                            onClick={handleConfirmJoin} 
                            disabled={isSubmitting}
                            className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all shadow-lg flex justify-center items-center gap-2"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>Yes, Join Team</>
                            )}
                        </button>
                        <button onClick={() => setStep('input')} className="w-full py-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300 font-medium">
                            Back
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JoinFirmModal;
