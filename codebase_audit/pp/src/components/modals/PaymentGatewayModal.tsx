
import React, { useState, useEffect } from 'react';
import { useUI } from '../../contexts/UIContext';
import { LockClosedIcon, CheckCircleIcon } from '../../constants';
import { formatNaira } from '../../utils/formatting';
import NairaSymbol from '../NairaSymbol';

interface PaymentGatewayModalProps {
    amount: number;
    email: string;
    title: string;
    description?: string;
    onSuccess: () => void;
    onClose: () => void;
}

const PaymentGatewayModal: React.FC<PaymentGatewayModalProps> = ({ amount, email, title, description, onSuccess, onClose }) => {
    const [step, setStep] = useState<'input' | 'processing' | 'success'>('input');
    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');

    useEffect(() => {
        if (step === 'processing') {
            const timer = setTimeout(() => {
                setStep('success');
            }, 2000);
            return () => clearTimeout(timer);
        }
        if (step === 'success') {
            const timer = setTimeout(() => {
                onSuccess();
                onClose();
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [step, onSuccess, onClose]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setStep('processing');
    };

    // Formatting helpers
    const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '');
        val = val.substring(0, 16);
        val = val.replace(/(\d{4})/g, '$1 ').trim();
        setCardNumber(val);
    };

    const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length >= 2) {
            val = val.substring(0, 2) + '/' + val.substring(2, 4);
        }
        setExpiry(val);
    };

    return (
        <div className="bg-slate-50 dark:bg-zinc-900 p-6 flex flex-col items-center justify-center min-h-[400px]">
            {step === 'input' && (
                <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6 animate-fade-in">
                    <div className="text-center mb-6">
                        <div className="flex items-center justify-center gap-2 mb-2">
                             <LockClosedIcon className="w-4 h-4 text-green-600" />
                             <span className="text-xs font-bold text-green-600 uppercase tracking-wider">Secure Checkout</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
                         {description && <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">{description}</p>}
                        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-4"><NairaSymbol/>{formatNaira(amount)}</p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">{email}</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Card Number</label>
                            <div className="relative">
                                <input autoComplete="off" data-lpignore="true"  
                                    type="text" 
                                    placeholder="0000 0000 0000 0000" 
                                    value={cardNumber}
                                    onChange={handleCardChange}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 font-mono"
                                    required
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
                                </div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Expiry</label>
                                <input autoComplete="off" data-lpignore="true"  
                                    type="text" 
                                    placeholder="MM/YY" 
                                    value={expiry}
                                    onChange={handleExpiryChange}
                                    maxLength={5}
                                    className="w-full px-4 py-3 border border-slate-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 font-mono"
                                    required
                                />
                            </div>
                             <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CVV</label>
                                <input autoComplete="off" data-lpignore="true"  
                                    type="password" 
                                    placeholder="123" 
                                    value={cvv}
                                    onChange={e => setCvv(e.target.value.replace(/\D/g, '').substring(0,3))}
                                    maxLength={3}
                                    className="w-full px-4 py-3 border border-slate-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 font-mono"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg transition-all transform hover:scale-[1.02]"
                    >
                        Pay <NairaSymbol/>{formatNaira(amount)}
                    </button>
                    
                    <div className="text-center mt-4">
                        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:underline">Cancel Transaction</button>
                    </div>
                    
                    <div className="flex justify-center gap-4 mt-6 opacity-50 grayscale">
                        {/* Simulated Card Logos */}
                        <div className="h-6 w-10 bg-slate-300 rounded"></div>
                        <div className="h-6 w-10 bg-slate-300 rounded"></div>
                        <div className="h-6 w-10 bg-slate-300 rounded"></div>
                    </div>
                </form>
            )}

            {step === 'processing' && (
                <div className="text-center animate-fade-in">
                    <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-6"></div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Processing Payment...</h3>
                    <p className="text-slate-500 dark:text-zinc-400">Please do not close this window.</p>
                </div>
            )}

            {step === 'success' && (
                <div className="text-center animate-scale-in">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircleIcon className="w-12 h-12 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Payment Successful!</h3>
                    <p className="text-slate-500 dark:text-zinc-400">Redirecting...</p>
                </div>
            )}
        </div>
    );
};

export default PaymentGatewayModal;
