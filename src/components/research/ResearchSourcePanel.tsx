import React, { useMemo } from 'react';
import { ResearchSource } from '../../types';
import { PlusIcon, DocumentsIcon, LargeFolderIcon, WebIcon, DocumentIcon } from '../../constants';

interface ResearchSourcePanelProps {
    notebookName: string;
    sources: ResearchSource[];
    selectedSourceIds: string[];
    onToggleSource: (id: string) => void;
    onToggleSelectAll: () => void;
    onAddSource: () => void;
}

const getSourceIcon = (type: string) => {
    switch (type) {
        case 'pdf': return <DocumentIcon className="w-4 h-4 text-red-500" />;
        case 'web': return <WebIcon className="w-4 h-4 text-blue-500" />;
        default: return <DocumentsIcon className="w-4 h-4 text-slate-400" />;
    }
};

export const ResearchSourcePanel: React.FC<ResearchSourcePanelProps> = ({
    notebookName,
    sources,
    selectedSourceIds,
    onToggleSource,
    onToggleSelectAll,
    onAddSource
}) => {
    const categories = useMemo(() => {
        const groups: Record<string, ResearchSource[]> = {
            'Pleadings': [],
            'Discovery': [],
            'Transcripts': [],
            'Correspondence': [],
            'Other': []
        };

        sources.forEach(source => {
            const name = source.name.toLowerCase();
            if (name.includes('pleading') || name.includes('motion') || name.includes('complaint')) groups['Pleadings'].push(source);
            else if (name.includes('discovery') || name.includes('exhibit') || name.includes('interrogator')) groups['Discovery'].push(source);
            else if (name.includes('transcript') || name.includes('deposition') || name.includes('hearing')) groups['Transcripts'].push(source);
            else if (name.includes('letter') || name.includes('email') || name.includes('correspondence')) groups['Correspondence'].push(source);
            else groups['Other'].push(source);
        });

        return groups;
    }, [sources]);

    const allSelected = sources.length > 0 && selectedSourceIds.length === sources.length;

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-sm text-slate-800 dark:text-white uppercase tracking-wider">Case Record</h3>
                    <button
                        onClick={onAddSource}
                        className="p-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-700 transition-all shadow-sm"
                        title="Add Source"
                    >
                        <PlusIcon className="w-4 h-4 text-primary-600" />
                    </button>
                </div>

                <div className="flex items-center justify-between px-2 py-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg">
                    <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">{sources.length} Sources</span>
                    <button
                        onClick={onToggleSelectAll}
                        className="text-[10px] font-bold text-primary-600 hover:text-primary-700 uppercase"
                    >
                        {allSelected ? 'Deselect All' : 'Select All'}
                    </button>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-4">
                {Object.entries(categories).map(([category, catSources]) => {
                    if (catSources.length === 0) return null;
                    return (
                        <div key={category}>
                            <h4 className="px-2 mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <LargeFolderIcon className="w-3 h-3" /> {category}
                            </h4>
                            <div className="space-y-0.5">
                                {catSources.map(source => (
                                    <label
                                        key={source.id}
                                        className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-all border ${selectedSourceIds.includes(source.id) ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800' : 'bg-transparent border-transparent hover:bg-white dark:hover:bg-zinc-800'}`}
                                    >
                                        <input autoComplete="off" data-lpignore="true" 
                                            type="checkbox"
                                            checked={selectedSourceIds.includes(source.id)}
                                            onChange={() => onToggleSource(source.id)}
                                            className="w-3.5 h-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                        />
                                        <div className="flex-shrink-0">
                                            {getSourceIcon(source.type)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-xs font-medium truncate ${selectedSourceIds.includes(source.id) ? 'text-primary-900 dark:text-primary-100' : 'text-slate-700 dark:text-zinc-300'}`}>
                                                {source.name}
                                            </p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {sources.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-40 text-center p-4">
                        <DocumentsIcon className="w-8 h-8 text-slate-300 mb-2" />
                        <p className="text-[10px] text-slate-400 leading-relaxed">No documents have been added to this case record yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
