import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDataActions } from '../contexts/DataContext';
import { useProduct } from '../contexts/ProductContext';
import { useUI } from '../contexts/UIContext';

// Atrium icon — classical building/columns representing a property atrium
const AtriumIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path d="M3 21h18" />
        <path d="M5 21V7l7-4 7 4v14" />
        <path d="M9 21v-6h6v6" />
        <path d="M9 11h.01M15 11h.01" />
    </svg>
);

// Scale/balance icon for Vega
const VegaIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path d="M12 3v18M5 6l7-3 7 3M5 6l3 9c0 2 1.5 3 4 3s4-1 4-3l3-9" />
    </svg>
);

const ChevronIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <polyline points="6 9 12 15 18 9" />
    </svg>
);

/**
 * DemoProductSwitcher — Mobile-only banner that allows switching between
 * Vega (Legal OS) and Atrium (Property OS) demo modes.
 * Only visible when the app is in demo mode.
 */
const DemoProductSwitcher: React.FC = () => {
    const { appMode } = useAuth();
    const { switchDemoProduct } = useDataActions() as any;
    const { isProperty } = useProduct();
    const { navigateTo } = useUI();
    const [isExpanded, setIsExpanded] = useState(false);

    // Only show in demo mode
    if (appMode !== ('demo' as any)) return null;

    const currentProduct = isProperty ? 'atrium' : 'vega';

    const handleSwitch = (product: 'vega' | 'atrium') => {
        if (product === currentProduct) { setIsExpanded(false); return; }
        switchDemoProduct(product);
        navigateTo('dashboard');
        setIsExpanded(false);
    };

    return (
        <div className="md:hidden fixed top-0 left-0 right-0 z-[999] pointer-events-none">
            {/* Collapsed pill — always visible in demo */}
            <div className="pointer-events-auto flex justify-center pt-safe">
                <button
                    onClick={() => setIsExpanded(prev => !prev)}
                    className={`
                        flex items-center gap-1.5 px-3 py-1 rounded-b-xl text-2xs font-bold uppercase tracking-wider 
                        shadow-lg transition-all duration-200 border-b border-l border-r
                        ${currentProduct === 'atrium'
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-indigo-600 text-white border-indigo-700'
                        }
                    `}
                >
                    {currentProduct === 'atrium'
                        ? <><AtriumIcon className="w-3 h-3" /> Atrium OS</>
                        : <><VegaIcon className="w-3 h-3" /> Vega OS</>
                    }
                    <ChevronIcon className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Expanded switcher panel */}
            {isExpanded && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
                        onClick={() => setIsExpanded(false)}
                    />
                    {/* Panel */}
                    <div className="pointer-events-auto absolute top-8 left-4 right-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-700 overflow-hidden z-10 animate-slide-in-up">
                        <div className="p-4 border-b border-slate-100 dark:border-zinc-800">
                            <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Switch Demo Mode</p>
                            <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-0.5">Preview different product experiences</p>
                        </div>
                        <div className="p-3 space-y-2">
                            {/* Vega option */}
                            <button
                                onClick={() => handleSwitch('vega')}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                                    currentProduct === 'vega'
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                        : 'border-slate-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                                }`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${currentProduct === 'vega' ? 'bg-indigo-600' : 'bg-slate-100 dark:bg-zinc-800'}`}>
                                    <VegaIcon className={`w-5 h-5 ${currentProduct === 'vega' ? 'text-white' : 'text-slate-500 dark:text-zinc-400'}`} />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className={`text-sm font-bold ${currentProduct === 'vega' ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-800 dark:text-white'}`}>Vega OS</p>
                                    <p className="text-2xs text-slate-500 dark:text-zinc-400">Matters, billing, legal research</p>
                                </div>
                                {currentProduct === 'vega' && (
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                                )}
                            </button>

                            {/* Atrium option */}
                            <button
                                onClick={() => handleSwitch('atrium')}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                                    currentProduct === 'atrium'
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                        : 'border-slate-200 dark:border-zinc-700 hover:border-emerald-300 dark:hover:border-emerald-700'
                                }`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${currentProduct === 'atrium' ? 'bg-emerald-600' : 'bg-slate-100 dark:bg-zinc-800'}`}>
                                    <AtriumIcon className={`w-5 h-5 ${currentProduct === 'atrium' ? 'text-white' : 'text-slate-500 dark:text-zinc-400'}`} />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className={`text-sm font-bold ${currentProduct === 'atrium' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-white'}`}>Atrium OS</p>
                                    <p className="text-2xs text-slate-500 dark:text-zinc-400">Properties, revenue monitor, tenants</p>
                                </div>
                                {currentProduct === 'atrium' && (
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                                )}
                            </button>
                        </div>
                        <div className="px-3 pb-3">
                            <p className="text-center text-3xs text-slate-400 dark:text-zinc-600 uppercase tracking-wider">
                                Demo mode — data is simulated
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default DemoProductSwitcher;
