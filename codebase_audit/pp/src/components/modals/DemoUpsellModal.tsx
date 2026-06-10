
import React from 'react';
import { ShieldCheckIcon, LockClosedIcon, SparklesIcon } from '../../constants';

interface DemoUpsellModalProps {
    context?: 'matter' | 'contact' | 'task' | 'invoice' | 'document' | 'ai' | 'generic';
    onSignup: () => void;
    onClose: () => void;
}

const DemoUpsellModal: React.FC<DemoUpsellModalProps> = ({ context = 'generic', onSignup, onClose }) => {
    const getContent = () => {
        switch (context) {
            case 'matter':
                return {
                    headline: "Your firm handles more than one matter at a time!",
                    subline: "You've unlocked a preview by creating your first demo matter. To manage your entire portfolio, create an account.",
                    icon: <SparklesIcon className="w-12 h-12 text-primary-500" />
                };
            case 'contact':
                return {
                    headline: "Build your full client database.",
                    subline: "One contact is just the start. Legal practice is built on relationships—store unlimited clients with an account.",
                    icon: <ShieldCheckIcon className="w-12 h-12 text-primary-500" />
                };
            case 'task':
                return {
                    headline: "Keep your whole team on track.",
                    subline: "Experience how we prevent things from slipping through the cracks. Manage unlimited team tasks with an account.",
                    icon: <SparklesIcon className="w-12 h-12 text-blue-500" />
                };
            case 'invoice':
                return {
                    headline: "Get paid for your hard work.",
                    subline: "Bill professionally and track every kobo. Create unlimited invoices and receipts with an account.",
                    icon: <SparklesIcon className="w-12 h-12 text-emerald-500" />
                };
            case 'document':
                return {
                    headline: "Secure, structured document management.",
                    subline: "Store, sign, and share all your legal processes in one place. Unlimited storage is waiting for you.",
                    icon: <LockClosedIcon className="w-12 h-12 text-primary-500" />
                };
            case 'ai':
                return {
                    headline: "ALOA® AI is just getting warmed up.",
                    subline: "You've tasted the power of deep legal research. Unlock full, unlimited AI analysis by creating your account.",
                    icon: <SparklesIcon className="w-12 h-12 text-purple-500 animate-pulse" />
                };
            default:
                return {
                    headline: "You've hit the limit for this demo.",
                    subline: "Hope you're enjoying the PracticePro experience! To use the full platform and keep your progress, create an account.",
                    icon: <SparklesIcon className="w-12 h-12 text-primary-500" />
                };
        }
    };

    const { headline, subline, icon } = getContent();

    return (
        <div className="flex flex-col items-center text-center p-8 md:p-12 max-w-lg mx-auto bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl relative border border-slate-100 dark:border-zinc-800">
            {/* Visual background element */}
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-primary-500/10 to-transparent pointer-events-none" />
            
            <div className="mb-6 relative z-10 p-4 bg-primary-50 dark:bg-zinc-800 rounded-2xl">
                {icon}
            </div>

            <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-4 leading-tight">
                {headline}
            </h2>
            
            <p className="text-slate-600 dark:text-zinc-400 mb-10 text-lg leading-relaxed px-4">
                {subline}
            </p>

            <div className="flex flex-col w-full gap-4 relative z-10">
                <button
                    onClick={onSignup}
                    className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-primary-500/20 active:scale-[0.98] flex items-center justify-center gap-2 group"
                >
                    Create Your Account
                    <SparklesIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                </button>
                
                <button
                    onClick={onClose}
                    className="w-full py-3 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 font-bold text-sm transition-colors"
                >
                    Maybe later, I'm still exploring
                </button>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-zinc-800 w-full flex items-center justify-center gap-2">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Already have an account?
                </p>
                <button 
                    onClick={onSignup} // In a real app, this would be onLogin
                    className="text-xs font-black text-primary-600 uppercase tracking-widest hover:underline"
                >
                    Sign In
                </button>
            </div>
        </div>
    );
};

export default DemoUpsellModal;
