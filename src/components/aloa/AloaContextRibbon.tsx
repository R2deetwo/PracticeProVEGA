import React from 'react';
import { SparklesIcon, ChevronRightIcon } from '../../constants';
import { useProduct } from '../../contexts/ProductContext';
import { useAloa } from '../../contexts/AloaProvider';

export type AloaContextAction = {
    label: string;
    description?: string;
    onClick: () => void;
    isPrimary?: boolean;
};

interface AloaContextRibbonProps {
    entityType: 'matter' | 'property' | 'invoice' | 'contact';
    entityId: string;
    entityName: string;
    contextStatus?: string;
    actions: AloaContextAction[];
}

export const AloaContextRibbon: React.FC<AloaContextRibbonProps> = ({ 
    entityType, 
    entityId, 
    entityName, 
    contextStatus, 
    actions 
}) => {
    const { isProperty, isVega } = useProduct();
    const { togglePanel } = useAloa();

    const agentName = isProperty ? 'ARIA' : 'ALOA';
    const agentColorClass = isProperty ? 'text-emerald-500' : 'text-amber-500';
    const agentBgClass = isProperty ? 'bg-emerald-500/10' : 'bg-amber-500/10';
    const agentBorderClass = isProperty ? 'border-emerald-500/20' : 'border-amber-500/20';
    const agentHoverBgClass = isProperty ? 'hover:bg-emerald-500/20' : 'hover:bg-amber-500/20';

    return (
        <div className={`mb-6 rounded-xl border ${agentBorderClass} bg-white dark:bg-zinc-800/80 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2`}>
            <div className={`px-4 py-3 border-b ${agentBorderClass} flex items-center justify-between gap-4 ${agentBgClass}`}>
                <div className="flex items-center gap-2 min-w-0">
                    <SparklesIcon className={`w-5 h-5 ${agentColorClass} animate-pulse shrink-0`} />
                    <span className="text-sm font-bold text-slate-800 dark:text-zinc-200 truncate">
                        {agentName} Intelligence <span className="text-slate-500 dark:text-zinc-400 font-normal hidden sm:inline">| Contextual Actions for {entityName}</span>
                    </span>
                </div>
                {contextStatus && (
                    <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-white dark:bg-zinc-900 ${agentColorClass} shadow-sm border ${agentBorderClass} shrink-0 whitespace-nowrap`}>
                        {contextStatus}
                    </span>
                )}
            </div>
            
            <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {actions.map((action, idx) => (
                    <button
                        key={idx}
                        onClick={action.onClick}
                        className={`flex items-start gap-3 p-3 rounded-lg text-left transition-all group ${
                            action.isPrimary 
                                ? `${agentBgClass} ${agentHoverBgClass} border ${agentBorderClass}` 
                                : 'hover:bg-slate-50 dark:hover:bg-zinc-700/50 border border-transparent hover:border-slate-200 dark:hover:border-zinc-700'
                        }`}
                    >
                        <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${action.isPrimary ? 'bg-white dark:bg-zinc-800 shadow-sm' : 'bg-slate-100 dark:bg-zinc-800 group-hover:bg-white dark:group-hover:bg-zinc-700'}`}>
                            <SparklesIcon className={`w-3.5 h-3.5 ${action.isPrimary ? agentColorClass : 'text-slate-400 dark:text-zinc-500 group-hover:text-slate-600 dark:group-hover:text-zinc-300'}`} />
                        </div>
                        <div className="flex-1">
                            <p className={`text-sm font-semibold mb-0.5 ${action.isPrimary ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-zinc-300'}`}>
                                {action.label}
                            </p>
                            {action.description && (
                                <p className={`text-[11px] leading-tight ${action.isPrimary ? 'text-slate-600 dark:text-zinc-400' : 'text-slate-500 dark:text-zinc-500'}`}>
                                    {action.description}
                                </p>
                            )}
                        </div>
                        <ChevronRightIcon className={`w-4 h-4 mt-1 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 ${action.isPrimary ? agentColorClass : 'text-slate-400'}`} />
                    </button>
                ))}
                
                <button
                    onClick={() => togglePanel()}
                    className="flex items-center justify-center gap-2 p-3 rounded-lg text-left transition-all border border-dashed border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                >
                    <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">
                        Ask {agentName} a custom question...
                    </span>
                </button>
            </div>
        </div>
    );
};
