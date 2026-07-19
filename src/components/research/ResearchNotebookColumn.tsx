
import React from 'react';
import { ResearchNotebook, Matter, ModalType } from '../../types';
import { PlusIcon, TrashIcon, BookOpenIcon } from '../../constants';

interface ResearchNotebookColumnProps {
    notebooks: ResearchNotebook[];
    matters: Matter[];
    selectedNotebookId: string | null;
    onSelect: (id: string) => void;
    openModal: (type: ModalType) => void;
    onDeleteNotebook: (notebookId: string, notebookName: string) => void;
    isLoading?: boolean;
}

export const ResearchNotebookColumn: React.FC<ResearchNotebookColumnProps> = ({ notebooks, matters, selectedNotebookId, onSelect, openModal, onDeleteNotebook, isLoading }) => {
    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800">
            <header className="flex-shrink-0 p-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900">
                <h3 className="font-bold text-slate-800 dark:text-white">Notebooks</h3>
                <button
                    onClick={() => openModal('newResearchNotebook')}
                    className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-opacity shadow-sm flex items-center gap-2 text-xs font-bold"
                >
                    <PlusIcon className="w-4 h-4" /> New
                </button>
            </header>
            <div className="flex-grow overflow-y-auto p-2 custom-scrollbar">
                <ul className="space-y-1">
                    {isLoading && (
                        <li className="animate-pulse">
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-100 dark:bg-zinc-800/50 border border-dashed border-slate-300 dark:border-zinc-700">
                                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-zinc-700 flex items-center justify-center">
                                    <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                </div>
                                <div className="space-y-2 flex-1">
                                    <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-3/4" />
                                    <div className="h-2 bg-slate-200 dark:bg-zinc-700 rounded w-1/2" />
                                </div>
                            </div>
                        </li>
                    )}
                    {notebooks.map(nb => {
                        const isSelected = nb.id === selectedNotebookId;
                        const matter = nb.matterId ? matters.find(m => m.id === nb.matterId) : null;
                        return (
                            <li key={nb.id} className="group/item">
                                <div className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800' : 'hover:bg-slate-100 dark:hover:bg-zinc-800/50 border border-transparent'}`}>
                                    <button
                                        onClick={() => onSelect(nb.id)}
                                        className="w-full text-left flex items-start gap-3 overflow-hidden"
                                    >
                                        <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-slate-200 text-slate-500 dark:bg-zinc-700 dark:text-zinc-400'}`}>
                                            <BookOpenIcon className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`font-semibold text-sm truncate ${isSelected ? 'text-primary-900 dark:text-primary-100' : 'text-slate-700 dark:text-zinc-300'}`}>{nb.name}</p>
                                            {matter && (
                                                <p className="text-2xs text-slate-400 dark:text-zinc-500 truncate mt-0.5 uppercase tracking-wide">{matter.title}</p>
                                            )}
                                        </div>
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteNotebook(nb.id, nb.name);
                                        }}
                                        // Always visible on touch devices (no hover), hover-reveal on desktop.
                                        // Previously `opacity-0 group-hover/item:opacity-100` made the button
                                        // invisible on mobile, so users couldn't delete notebooks at all.
                                        className="p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:text-zinc-500 dark:hover:bg-red-900/20 md:opacity-0 md:group-hover/item:opacity-100 transition-all"
                                        aria-label={`Delete notebook ${nb.name}`}
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                    {notebooks.length === 0 && (
                        <div className="text-center py-8 px-4">
                            <p className="text-xs text-slate-400">No notebooks yet. Create one to organize your research.</p>
                        </div>
                    )}
                </ul>
            </div>
        </div>
    );
};
