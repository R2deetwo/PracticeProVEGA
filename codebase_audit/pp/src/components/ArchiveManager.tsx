import React, { useState } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useCoreState } from '../contexts/CoreContext';
import { useMatterState } from '../contexts/MatterContext';
import { ArchiveIcon, RevertIcon, DocumentIcon } from '../constants';
import { formatRelativeTime } from '../utils/formatting';

export const ArchiveManager: React.FC = () => {
    const [filter, setFilter] = useState<'all' | 'property' | 'matter'>('all');
    
    // Using a generic query or we need to add an 'archived_notes' query.
    // For now, let's assume we have an archive query or we fetch all pages and filter locally if a specific query is not available.
    // Let's create a query to fetch archived notePages.
    const archivedNotesQuery = useQuery(api.legalRepo.getArchivedNotes, { contextType: filter === 'all' ? undefined : filter });
    const restoreNote = useMutation(api.legalRepo.restoreNote);

    const { coreState } = useCoreState();
    const { matterState } = useMatterState();

    const handleRestore = async (noteId: string) => {
        try {
            await restoreNote({ id: noteId as Id<"notePages"> });
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto animate-fade-in">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        <ArchiveIcon className="w-6 h-6 text-slate-500" />
                        Archive Manager
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">View and restore archived notes across all contexts.</p>
                </div>
                <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
                    <button 
                        onClick={() => setFilter('all')} 
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${filter === 'all' ? 'bg-white shadow-sm text-primary-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        All
                    </button>
                    <button 
                        onClick={() => setFilter('property')} 
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${filter === 'property' ? 'bg-white shadow-sm text-primary-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Properties
                    </button>
                    <button 
                        onClick={() => setFilter('matter')} 
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${filter === 'matter' ? 'bg-white shadow-sm text-primary-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Matters
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden">
                {!archivedNotesQuery ? (
                    <div className="p-8 text-center text-slate-500">Loading archive...</div>
                ) : archivedNotesQuery.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <ArchiveIcon className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-lg font-semibold text-slate-700">Archive is empty</p>
                        <p className="text-sm text-slate-500 mt-1">No notes match your current filter.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {archivedNotesQuery.map((note: any) => {
                            const contextName = note.contextType === 'property' 
                                ? coreState.properties?.find((p) => p.id === note.propertyId)?.address || 'Unknown Property'
                                : note.contextType === 'matter'
                                ? matterState.matters.find(m => m.id === note.matterId)?.title || 'Unknown Matter'
                                : 'Notebook';

                            return (
                                <li key={note._id} className="p-4 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400">
                                            <DocumentIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{note.title || 'Untitled Note'}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${note.contextType === 'property' ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                                    {note.contextType}
                                                </span>
                                                <span className="text-xs text-slate-500">{contextName}</span>
                                                <span className="text-slate-300">&bull;</span>
                                                <span className="text-xs text-slate-400">Archived {formatRelativeTime(note.archivedAt)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleRestore(note._id)}
                                        className="opacity-0 group-hover:opacity-100 p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-all font-semibold text-sm flex items-center gap-2"
                                    >
                                        <RevertIcon className="w-4 h-4" /> Restore
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
};
