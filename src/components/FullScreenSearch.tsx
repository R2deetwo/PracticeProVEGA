import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { MattersIcon, ContactsIcon, DocumentsIcon, TasksIcon, SearchIcon } from '../constants';

// ─── Phase 4 (Performance & Database) ───────────────────────────────────────
// This component previously built a client-side Fuse.js index over ALL
// matters/contacts/documents/tasks held in React context state — the index
// was rebuilt on every data change and searched in browser memory on every
// keystroke. It now calls the server-side `search.searchAll` Convex query
// (searchIndex-backed, firm-scoped, relevance-ranked) with a 250ms debounce
// and renders a slim projection. The full dataset never needs to be in
// memory just to power search.

type ResultDataType = 'Matter' | 'Contact' | 'Document' | 'Task';

interface SlimResult {
    id: string;
    dataType: ResultDataType;
    title?: string;
    name?: string;
    suitNumber?: string;
    email?: string;
}

interface ServerSearchResult {
    matters: { id: string; title: string; suitNumber?: string }[];
    contacts: { id: string; name: string; email?: string }[];
    documents: { id: string; title: string }[];
    tasks: { id: string; title: string }[];
}

const typeConfig: Record<ResultDataType, { icon: React.FC<any>; color: string; headerColor: string }> = {
    Matter: { icon: MattersIcon, color: 'bg-primary-500 text-white', headerColor: 'text-primary-600 dark:text-primary-400' },
    Contact: { icon: ContactsIcon, color: 'bg-blue-500 text-white', headerColor: 'text-blue-600 dark:text-blue-400' },
    Document: { icon: DocumentsIcon, color: 'bg-teal-500 text-white', headerColor: 'text-teal-600 dark:text-teal-400' },
    Task: { icon: TasksIcon, color: 'bg-amber-500 text-white', headerColor: 'text-amber-600 dark:text-amber-400' },
};

function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

const FullScreenSearch: React.FC = () => {
    const { isMobileSearchOpen, setMobileSearchOpen, navigateTo, openModal } = useUI();
    const { currentUser, bearerToken } = useAuth();
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebounce(query, 250);
    const inputRef = useRef<HTMLInputElement>(null);

    // Server-side search (skipped until there is an authenticated firm user
    // and a meaningful term — the searchIndex needs at least 2 characters).
    const trimmed = debouncedQuery.trim();
    const canSearch = Boolean(currentUser?.firmId && currentUser?.email) && trimmed.length >= 2;
    const serverResults = useQuery(
        api.search.searchAll,
        canSearch ? { userEmail: currentUser!.email!, query: trimmed } : "skip"
    ) as ServerSearchResult | undefined;

    const searchResults = useMemo(() => {
        if (!serverResults) return null;
        const grouped: Record<ResultDataType, SlimResult[]> = {
            Matter: serverResults.matters.map(m => ({ id: m.id, dataType: 'Matter' as const, title: m.title, suitNumber: m.suitNumber })),
            Contact: serverResults.contacts.map(c => ({ id: c.id, dataType: 'Contact' as const, name: c.name, email: c.email })),
            Document: serverResults.documents.map(d => ({ id: d.id, dataType: 'Document' as const, title: d.title })),
            Task: serverResults.tasks.map(t => ({ id: t.id, dataType: 'Task' as const, title: t.title })),
        };
        const totalCount =
            grouped.Matter.length + grouped.Contact.length +
            grouped.Document.length + grouped.Task.length;
        return { grouped, totalCount };
    }, [serverResults]);

    useEffect(() => {
        if (isMobileSearchOpen) {
            setTimeout(() => inputRef.current?.focus(), 100); // Small delay for animation
        } else {
            setQuery('');
        }
    }, [isMobileSearchOpen]);

    if (!isMobileSearchOpen) return null;

    const handleSelect = (item: SlimResult) => {
        setMobileSearchOpen(false);
        switch (item.dataType) {
            case 'Matter': return navigateTo('matterDetail', item.id);
            case 'Contact': return navigateTo('contactDetail', item.id);
            case 'Document': return navigateTo('documentDetail', item.id);
            case 'Task': return openModal('viewTask', item.id);
        }
    };

    const isSearching = canSearch && !serverResults;

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
                    isSearching ? (
                        <p className="p-16 text-center text-slate-500 dark:text-zinc-400">Searching…</p>
                    ) : trimmed.length < 2 ? (
                        <p className="p-16 text-center text-slate-500 dark:text-zinc-400">Keep typing to search…</p>
                    ) : searchResults && searchResults.totalCount > 0 ? (
                        <div>
                             <div className="px-4 py-2 text-sm text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-700">
                                Found {searchResults.totalCount} result{searchResults.totalCount === 1 ? '' : 's'}
                            </div>
                            <ul>
                                {(Object.keys(typeConfig) as ResultDataType[])
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
