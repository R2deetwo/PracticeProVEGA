
import React, { useState, useEffect } from 'react';
import { useAloa } from '../../contexts/AloaProvider';
import { useUI } from '../../contexts/UIContext';
import { AloaHint } from '../../types';
import { 
    ZapIcon, PlusIcon, EditIcon, ClipboardListIcon, CloudArrowUpIcon, 
    BookmarkIcon, CheckIcon, ChevronRightIcon, ScalesIcon, SparklesIcon 
} from '../../constants';

interface ActionCardProps {
    actionName: string;
    args: any;
    onExecute: () => void;
    executed?: boolean;
    insights?: AloaHint[];
    isLastMessage?: boolean;
    completedResult?: { id: string; title: string; type: string };
    /**
     * When true, the action button is styled as a prominent pulsing CTA.
     * Used when a draft is ready but the popup was blocked — the user
     * must click this button (a real user gesture) to open the draft tab.
     */
    pendingOpen?: boolean;
    /**
     * Override the auto-derived button label. Used for the pending-open
     * case where we want "Open DraftPro" instead of "Open Editor".
     */
    customLabel?: string;
}

export const ActionCard: React.FC<ActionCardProps> = ({
    actionName, args, onExecute, insights = [], isLastMessage, completedResult,
    pendingOpen, customLabel,
}) => {
    const { liveInsights } = useAloa();
    const { navigateTo, openModal } = useUI();
    const [isExpanded, setIsExpanded] = useState(false);

    const onExecuteCustom = (customContext: any) => {
        openModal('newDraft', null, customContext);
    };
    
    // AUTO-EXPAND if live insights are streaming in for the last message
    useEffect(() => {
        if (isLastMessage && liveInsights.length > 0) {
            setIsExpanded(true);
        }
    }, [liveInsights, isLastMessage]);

    const displayInsights = isLastMessage && liveInsights.length > 0 ? liveInsights : insights;
    const hasWarnings = displayInsights.some(h => h.type === 'warning' || h.type === 'error');
    let label = "Open Item";
    let icon: React.ReactNode = <ChevronRightIcon className="w-4 h-4" />;
    const lowerName = actionName.toLowerCase();

    if (lowerName.includes('matter')) { label = "Open Matter Form"; icon = <PlusIcon className="w-4 h-4" />; }
    else if (lowerName.includes('contact')) { label = "Open Contact Form"; icon = <PlusIcon className="w-4 h-4" />; }
    else if (lowerName.includes('task')) { label = "Open Task Form"; icon = <PlusIcon className="w-4 h-4" />; }
    else if (lowerName.includes('event')) { label = "Open Event Form"; icon = <PlusIcon className="w-4 h-4" />; }
    else if (lowerName.includes('drafting')) { label = "Open Editor"; icon = <EditIcon className="w-4 h-4" />; }
    else if (lowerName.includes('workflow')) { label = "Review Workflow"; icon = <ClipboardListIcon className="w-4 h-4" />; }
    else if (lowerName.includes('ingestion')) { label = "Start Ingestion"; icon = <CloudArrowUpIcon className="w-4 h-4" />; }
    else if (lowerName === 'note') { label = "Open Note"; icon = <BookmarkIcon className="w-4 h-4" />; }

    const isCompleted = args?.context?.isCompleted || !!completedResult;

    // Use customLabel if provided (e.g. "Open DraftPro" for pending-open),
    // otherwise fall back to the derived label / completed state.
    const buttonLabel = customLabel
        ? customLabel
        : completedResult
            ? `Open ${completedResult.title}`
            : isCompleted ? 'Action Completed' : label;

    return (
        <div className={`mt-2 p-4 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm rounded-3xl border shadow-xl ${pendingOpen ? 'border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-400/30 animate-pulse' : 'border-white/40 dark:border-zinc-700'} ${isCompleted && !completedResult ? 'opacity-60' : ''}`}>
            <div className="text-2xs text-primary-600 dark:text-primary-400 mb-2 font-bold uppercase tracking-widest flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                    <ZapIcon className="w-2.5 h-2.5" />
                    {pendingOpen
                        ? 'Draft Ready — Click to Open'
                        : completedResult
                            ? 'Entity Created'
                            : 'System Action Available'}
                </span>
                {(isCompleted || completedResult) && <span className="text-emerald-500 flex items-center gap-1"><CheckIcon className="w-2.5 h-2.5" /> {completedResult ? 'Live Link' : 'Completed'}</span>}
            </div>
            
            {args?.context?.suggestedDocs ? (
                <div className="space-y-2 mt-2">
                    {args.context.suggestedDocs.map((doc: string) => (
                        <button
                            key={doc}
                            onClick={() => onExecuteCustom({ ...args.context, draftTitle: doc })}
                            className="w-full flex items-center justify-between p-3 bg-white dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700/60 rounded-2xl hover:border-primary-500 hover:shadow-md transition-all group/btn active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-primary-100 dark:bg-primary-900/40 text-primary-600 rounded-lg">
                                    <EditIcon className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">Draft {doc}</span>
                            </div>
                            <ChevronRightIcon className="w-3 h-3 text-slate-300 group-hover/btn:text-primary-500 transition-colors" />
                        </button>
                    ))}
                </div>
            ) : (
                <button
                    onClick={() => {
                        if (completedResult) {
                            navigateTo(completedResult.type === 'matter' ? 'matterDetail' : 'dashboard', completedResult.id);
                        } else {
                            onExecute();
                        }
                    }}
                    disabled={isCompleted && !completedResult}
                    className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all transform active:scale-95 shadow-lg ${
                        isCompleted && !completedResult
                        ? 'bg-slate-200 dark:bg-zinc-700 text-slate-500 cursor-not-allowed'
                        : pendingOpen
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-300/50 text-base py-4 shadow-emerald-400/40'
                            : completedResult
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200/50'
                                : 'bg-primary-600 hover:bg-primary-700 text-white'
                    }`}
                >
                    {pendingOpen
                        ? <EditIcon className="w-5 h-5" />
                        : completedResult
                            ? <ScalesIcon className="w-4 h-4" />
                            : isCompleted
                                ? <ZapIcon className="w-4 h-4 text-emerald-500" />
                                : icon}
                    {buttonLabel}
                </button>
            )}

            {displayInsights.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-zinc-700/50">
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full flex items-center justify-between text-2xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 hover:text-primary-600 transition-colors"
                    >
                        <span className="flex items-center gap-2">
                            <SparklesIcon className="w-3 h-3 text-primary-500" />
                            Litigation Intelligence
                            {hasWarnings && !isExpanded && (
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                </span>
                            )}
                        </span>
                        <ChevronRightIcon className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>

                    {isExpanded && (
                        <div className="mt-2 space-y-2 animate-in slide-in-from-top-1 duration-300">
                            {displayInsights.map((hint, idx) => (
                                <div key={idx} className={`flex gap-2 p-2 rounded-lg text-2xs font-medium leading-relaxed ${
                                    hint.type === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                                    hint.type === 'warning' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' :
                                    'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                }`}>
                                    <span className="text-xs">{hint.icon}</span>
                                    <span>{hint.text}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {args && args.context && (args.context.title || args.context.subCategoryName) && !isExpanded && (
                <p className="text-2xs text-center text-slate-400 mt-2 italic px-2">
                    Ref: {args.context.title || args.context.subCategoryName}
                </p>
            )}
        </div>
    );
};
