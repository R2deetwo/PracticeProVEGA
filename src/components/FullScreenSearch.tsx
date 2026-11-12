import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { useQuery_experimental } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { MattersIcon, ContactsIcon, DocumentsIcon, TasksIcon, SearchIcon, OfficeBuildingIcon } from '../constants';
import { Z_CLASS } from '../overlays/constants';
import {
    groupServerResults,
    searchResultDestination,
    type SearchResultType,
    type ServerSearchResult,
} from '../utils/searchGrouping';

// ─── Phase 4 (Performance & Database) ───────────────────────────────────────
// This component previously built a client-side Fuse.js index over ALL
// matters/contacts/documents/tasks held in React context state — the index
// was rebuilt on every data change and searched in browser memory on every
// keystroke. It now calls the server-side `search.searchAll` Convex query
// (searchIndex-backed, firm-scoped, relevance-ranked) with a 250ms debounce
// and renders a slim projection. The full dataset never needs to be in
// memory just to power search.
//
// K-1 (KOMPLETE unified-product integrity) fixed two defects here:
//   1. The query did not forward the session bearer token, so
//      requireFirmUser rejected EVERY call ("a verified session is
//      required") and the UI hung on "Searching…" forever. The bearer is
//      now passed exactly like Sidebar's queries.
//   2. Properties were not a search category (the desktop CommandPalette
//      had them; mobile did not). searchAll now searches property
//      addresses for property-capable firms and this surface renders them,
//      navigable to the property detail page.
// The query uses the object-form hook with throwOnError: false so the
// loading / empty / error / permission-denied states each render honestly
// instead of tripping the app error boundary.

const typeConfig: Record<SearchResultType, { icon: React.FC<any>; color: string; headerColor: string }> = {
    Matter: { icon: MattersIcon, color: 'bg-primary-500 text-white', headerColor: 'text-primary-600 dark:text-primary-400' },
    Property: { icon: OfficeBuildingIcon, color: 'bg-indigo-500 text-white', headerColor: 'text-indigo-600 dark:text-indigo-400' },
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
    // K-1: the session bearer is forwarded — requireFirmUser rejects any
    // call without it, which used to strand this surface on "Searching…".
    // Demo sessions (DEV demo mode) have no verified bearer — like the
    // Sidebar's queries, the server-authed search is skipped for them and
    // the surface shows the prompt state instead of an auth error.
    const trimmed = debouncedQuery.trim();
    const isDemo = currentUser?.email === 'demo@practicepro.ng';
    const canSearch = !isDemo && Boolean(currentUser?.firmId && currentUser?.email) && trimmed.length >= 2;
    const queryState = useQuery_experimental({
        query: api.search.searchAll,
        args: canSearch
            ? { userEmail: currentUser!.email!, sessionToken: bearerToken ?? undefined, query: trimmed }
            : 'skip',
        throwOnError: false,
    }) as
        | { status: 'pending' }
        | { status: 'success'; data: ServerSearchResult }
        | { status: 'error'; error: Error };

    const serverResults = queryState.status === 'success' ? queryState.data : undefined;
    const searchError = queryState.status === 'error' ? queryState.error : null;

    const searchResults = useMemo(() => groupServerResults(serverResults), [serverResults]);

    useEffect(() => {
        if (isMobileSearchOpen) {
            setTimeout(() => inputRef.current?.focus(), 100); // Small delay for animation
        } else {
            setQuery('');
        }
    }, [isMobileSearchOpen]);

    // V7 (E): Esc closes the search layer — the same convention every
    // modal in the app already honors. Without it, keyboard users must
    // Tab to the Cancel button.
    useEffect(() => {
        if (!isMobileSearchOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMobileSearchOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isMobileSearchOpen, setMobileSearchOpen]);

    if (!isMobileSearchOpen) return null;

    const handleSelect = (dataType: SearchResultType, id: string) => {
        setMobileSearchOpen(false);
        const dest = searchResultDestination(dataType, id);
        if (dest.modal) {
            openModal(dest.modal as any, id);
            return;
        }
        navigateTo(dest.view as any, id);
    };

    const isSearching = canSearch && queryState.status === 'pending';

    return (
        <div
            className={`fixed inset-0 ${Z_CLASS.panelOverlay} bg-white dark:bg-zinc-900 flex flex-col sm:hidden animate-fade-in-up`}
            role="dialog"
            aria-modal="true"
            aria-label="Search"
        >
            <header className="flex-shrink-0 flex items-center p-2 border-b border-slate-200 dark:border-zinc-700">
                <div className="relative flex-grow">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    <input autoComplete="off" data-lpignore="true"
                        ref={inputRef}
                        type="search"
                        placeholder="Search matters, properties, contacts…"
                        aria-label="Search matters, properties, contacts, documents and tasks"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-base bg-transparent focus:outline-none"
                    />
                </div>
                <button onClick={() => setMobileSearchOpen(false)} className="ml-2 px-3 py-1.5 text-sm font-semibold text-primary-600">
                    Cancel
                </button>
            </header>
            {/* V7 (E): live region — screen readers hear "Searching…" / result
                counts instead of silence while the overlay swaps states. */}
            <main className="flex-grow overflow-y-auto" aria-live="polite">
                {query.trim().length > 0 ? (
                    isSearching ? (
                        <p className="p-16 text-center text-slate-500 dark:text-zinc-400">Searching…</p>
                    ) : searchError ? (
                        // K-1: the honest error state — an expired/invalid
                        // session (or a portal user hitting a firm-level
                        // query) renders the server's message instead of an
                        // infinite spinner or an app-level crash.
                        <div className="p-8 text-center">
                            <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">Search unavailable</p>
                            <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">{searchError.message || 'The search could not be completed. Please try again.'}</p>
                            {/session|sign in|Unauthenticated|Portal users/i.test(searchError.message || '') && (
                                <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">Your session may have expired — sign in again to search.</p>
                            )}
                        </div>
                    ) : trimmed.length < 2 ? (
                        <p className="p-16 text-center text-slate-500 dark:text-zinc-400">Keep typing to search…</p>
                    ) : !canSearch ? (
                        // UX-60 (Phase 1): the signed-in DEMO persona (dev
                        // builds only) saw "Sign in with your firm account…"
                        // while already signed in — evaluators concluded
                        // search was broken. The copy now names the demo
                        // limitation instead of telling a signed-in user to
                        // sign in.
                        <p className="p-16 text-center text-slate-500 dark:text-zinc-400">
                            {isDemo
                                ? 'Search is disabled in the demo build — create a firm account to search your matters, properties, contacts, documents and tasks.'
                                : 'Sign in with your firm account to search your matters, properties, contacts, documents and tasks.'}
                        </p>
                    ) : searchResults && searchResults.totalCount > 0 ? (
                        <div>
                             <div className="px-4 py-2 text-sm text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-700">
                                Found {searchResults.totalCount} result{searchResults.totalCount === 1 ? '' : 's'}
                            </div>
                            <ul>
                                {(Object.keys(typeConfig) as SearchResultType[])
                                    .map(dataType => {
                                    const items = searchResults.grouped[dataType];
                                    if (!items || items.length === 0) return null;

                                    const config = typeConfig[dataType];
                                    const Icon = config.icon;

                                    return (
                                        <React.Fragment key={dataType}>
                                            <h3 className={`px-4 py-2 text-xs font-bold uppercase bg-slate-50 dark:bg-zinc-800 sticky top-0 ${config.headerColor}`}>
                                                {dataType === 'Matter' ? 'Matters' : dataType === 'Property' ? 'Properties' : `${dataType}s`} ({items.length})
                                            </h3>
                                            {items.map(item => (
                                                <li key={`${dataType}-${item.id}`}>
                                                   <button onClick={() => handleSelect(dataType, item.id)} className="w-full text-left p-3 hover:bg-slate-100 dark:hover:bg-zinc-700 flex items-center gap-3 transition-colors">
                                                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${config.color}`}><Icon className="w-5 h-5" /></div>
                                                        <div className="min-w-0">
                                                            <p className="font-semibold text-sm text-slate-800 dark:text-white truncate">{item.label}</p>
                                                            {item.subtitle && <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{item.subtitle}</p>}
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
                        <p className="mt-4">Search matters, properties, contacts, documents and tasks.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default FullScreenSearch;
