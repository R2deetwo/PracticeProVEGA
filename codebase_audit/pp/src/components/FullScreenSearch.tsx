import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useUI } from '../contexts/UIContext';
import { useMatterState } from '../contexts/MatterContext';
import { useExecutionState } from '../contexts/ExecutionContext';
import { useDocumentState } from '../contexts/DocumentContext';
import { Matter, Contact, Document, Task } from '../types';
import { MattersIcon, ContactsIcon, DocumentsIcon, TasksIcon, SearchIcon } from '../constants';

declare const Fuse: any;

type SearchableItem = (Matter | Contact | Document | Task) & { dataType: 'Matter' | 'Contact' | 'Document' | 'Task', clientName?: string };

const typeConfig: Record<SearchableItem['dataType'], { icon: React.FC<any>; color: string; headerColor: string }> = {
    Matter: { icon: MattersIcon, color: 'bg-primary-500 text-white', headerColor: 'text-primary-600 dark:text-primary-400' },
    Contact: { icon: ContactsIcon, color: 'bg-blue-500 text-white', headerColor: 'text-blue-600 dark:text-blue-400' },
    Document: { icon: DocumentsIcon, color: 'bg-teal-500 text-white', headerColor: 'text-teal-600 dark:text-teal-400' },
    Task: { icon: TasksIcon, color: 'bg-amber-500 text-white', headerColor: 'text-amber-600 dark:text-amber-400' },
};

const FullScreenSearch: React.FC = () => {
    const { isMobileSearchOpen, setMobileSearchOpen, navigateTo, openModal } = useUI();
    const { matterState } = useMatterState();
    const { executionState } = useExecutionState();
    const { documentState } = useDocumentState();
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const searchData = useMemo(() => {
        const matters: SearchableItem[] = matterState.matters.map(m => ({ ...m, dataType: 'Matter', clientName: matterState.contacts.find(c => c.id === m.clientId)?.name || '' }));
        const contacts: SearchableItem[] = matterState.contacts.map(c => ({ ...c, dataType: 'Contact' }));
        const documents: SearchableItem[] = documentState.documents.map(d => ({ ...d, dataType: 'Document' }));
        const tasks: SearchableItem[] = executionState.tasks.map(t => ({ ...t, dataType: 'Task' }));
        return [...matters, ...contacts, ...documents, ...tasks];
    }, [matterState.matters, matterState.contacts, documentState.documents, executionState.tasks]);

    const fuse = useMemo(() => {
        return new Fuse(searchData, {
            keys: [{ name: 'title', weight: 2 }, { name: 'name', weight: 2 }, 'suitNumber', 'clientName', 'email', 'companyName', 'description'],
            includeScore: true,
            minMatchCharLength: 1,
        });
    }, [searchData]);

    const searchResults = useMemo(() => {
        if (!query || query.trim().length < 1) return null;
        
        const results = fuse.search(query).map((result: any) => result.item);
        
        const grouped: { [key in SearchableItem['dataType']]?: SearchableItem[] } = {};
        results.forEach((item: SearchableItem) => {
            if (!grouped[item.dataType]) {
                grouped[item.dataType] = [];
            }
            grouped[item.dataType]!.push(item);
        });

        const totalCount = results.length;

        return { grouped, totalCount };
    }, [query, fuse]);

    useEffect(() => {
        if (isMobileSearchOpen) {
            setTimeout(() => inputRef.current?.focus(), 100); // Small delay for animation
        } else {
            setQuery('');
        }
    }, [isMobileSearchOpen]);

    if (!isMobileSearchOpen) return null;

    const handleSelect = (item: SearchableItem) => {
        setMobileSearchOpen(false);
        switch (item.dataType) {
            case 'Matter': return navigateTo('matterDetail', item.id);
            case 'Contact': return navigateTo('contactDetail', item.id);
            case 'Document': return navigateTo('documentDetail', item.id);
            case 'Task': return openModal('viewTask', item.id);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-zinc-900 flex flex-col sm:hidden animate-fade-in-up">
            <header className="flex-shrink-0 flex items-center p-2 border-b border-slate-200 dark:border-zinc-700">
                <div className="relative flex-grow">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    <input autoComplete="off" data-lpignore="true" 
                        ref={inputRef}
                        type="search"
                        placeholder="Search matters, contacts, etc."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-base bg-transparent focus:outline-none"
                    />
                </div>
                <button onClick={() => setMobileSearchOpen(false)} className="ml-2 px-3 py-1.5 text-sm font-semibold text-primary-600">
                    Cancel
                </button>
            </header>
            <main className="flex-grow overflow-y-auto">
                {query.trim().length > 0 ? (
                    searchResults && searchResults.totalCount > 0 ? (
                        <div>
                             <div className="px-4 py-2 text-sm text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-700">
                                Found {searchResults.totalCount} result{searchResults.totalCount === 1 ? '' : 's'}
                            </div>
                            <ul>
                                {(Object.keys(searchResults.grouped) as (keyof typeof searchResults.grouped)[])
                                    .sort((a,b) => {
                                        const typeOrder: Record<SearchableItem['dataType'], number> = { 'Matter': 1, 'Contact': 2, 'Document': 3, 'Task': 4 };
                                        return typeOrder[a] - typeOrder[b];
                                    })
                                    .map(dataType => {
                                    const items = searchResults.grouped[dataType];
                                    if (!items || items.length === 0) return null;

                                    const config = typeConfig[dataType];
                                    const Icon = config.icon;
                                    
                                    return (
                                        <React.Fragment key={dataType}>
                                            <h3 className={`px-4 py-2 text-xs font-bold uppercase bg-slate-50 dark:bg-zinc-800 sticky top-0 ${config.headerColor}`}>
                                                {dataType}s ({items.length})
                                            </h3>
                                            {items.map(item => (
                                                <li key={`${item.dataType}-${item.id}`}>
                                                   <button onClick={() => handleSelect(item)} className="w-full text-left p-3 hover:bg-slate-100 dark:hover:bg-zinc-700 flex items-center gap-3 transition-colors">
                                                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${config.color}`}><Icon className="w-5 h-5" /></div>
                                                        <div>
                                                            <p className="font-semibold text-sm text-slate-800 dark:text-white">{'name' in item ? item.name : item.title}</p>
                                                            {item.dataType === 'Matter' && <p className="text-xs text-slate-500 dark:text-zinc-400">{'suitNumber' in item ? item.suitNumber : ''}</p>}
                                                            {item.dataType === 'Contact' && <p className="text-xs text-slate-500 dark:text-zinc-400">{'email' in item ? item.email : ''}</p>}
                                                        </div>
                                                   </button>
                                                </li>
                                            ))}
                                        </React.Fragment>
                                    )
                                })}
                            </ul>
                        </div>
                    ) : (
                        <p className="p-16 text-center text-slate-500">No results found for "{query}".</p>
                    )
                ) : (
                    <div className="text-center p-16 text-slate-500">
                        <SearchIcon className="w-12 h-12 mx-auto text-slate-300 dark:text-zinc-600"/>
                        <p className="mt-4">Search for anything in your practice.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default FullScreenSearch;