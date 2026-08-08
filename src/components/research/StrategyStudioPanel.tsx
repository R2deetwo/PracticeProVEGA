import React from 'react';
import { StudioAnalysisResult } from '../../types';
import { SparklesIcon, TrashIcon, EditIcon, CheckIcon, GavelIconLarge, CalendarIcon, SearchIcon, ListIcon } from '../../constants';

interface StrategyStudioPanelProps {
    results: StudioAnalysisResult[];
    onDeleteResult: (id: string) => void;
    onSaveToCase: (result: StudioAnalysisResult) => void;
}

const getTypeIcon = (type: string) => {
    switch (type) {
        case 'Chronology': return <CalendarIcon className="w-4 h-4 text-blue-500" />;
        case 'Matrix': return <GavelIconLarge className="w-4 h-4 text-purple-500" />;
        case 'Discovery': return <SearchIcon className="w-4 h-4 text-amber-500" />;
        case 'Entities': return <ListIcon className="w-4 h-4 text-emerald-500" />;
        case 'Adversarial': return <TrashIcon className="w-4 h-4 text-red-500" />;
        default: return <SparklesIcon className="w-4 h-4 text-primary-500" />;
    }
};

export const StrategyStudioPanel: React.FC<StrategyStudioPanelProps> = ({
    results,
    onDeleteResult,
    onSaveToCase
}) => {
    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900 shadow-sm z-10">
                <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">Strategy Studio</h3>
                <div className="w-5 h-5 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                    <span className="text-2xs font-bold text-primary-600">{results.length}</span>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-6">
                {results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-50">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                            <SparklesIcon className="w-8 h-8 text-slate-300" />
                        </div>
                        <h4 className="font-bold text-slate-600 dark:text-zinc-400 mb-2">Build Your Strategy</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Analyze sources or use conversational chat. Save important insights here to build your case strategy.
                        </p>
                    </div>
                ) : (
                    results.map(result => (
                        <div
                            key={result.id}
                            className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-sm hover:shadow-md transition-all group overflow-hidden"
                        >
                            <div className="p-3 border-b border-slate-100 dark:border-zinc-700/50 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/30">
                                <div className="flex items-center gap-2">
                                    {getTypeIcon(result.type)}
                                    <span className="text-2xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-tighter truncate max-w-[150px]">
                                        {result.title}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => onDeleteResult(result.id)}
                                        className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 rounded"
                                        title="Remove"
                                    >
                                        <TrashIcon className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="prose prose-xs dark:prose-invert max-w-none line-clamp-6 text-slate-700 dark:text-zinc-300 text-xs">
                                    {result.content}
                                </div>
                                <div className="mt-4 flex items-center justify-between">
                                    <span className="text-2xs text-slate-400">
                                        {new Date(result.timestamp).toLocaleDateString('en-GB')}
                                    </span>
                                    <button
                                        onClick={() => onSaveToCase(result)}
                                        className="text-2xs font-bold text-primary-600 hover:underline flex items-center gap-1"
                                    >
                                        <EditIcon className="w-3 h-3" /> Full Analysis
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <button
                    className="w-full py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                >
                    <CheckIcon className="w-4 h-4" /> Ready for Drafting
                </button>
            </div>
        </div>
    );
};
