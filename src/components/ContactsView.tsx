
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Contact, ContactCategory, ModalType, Lead } from '../types';
import { useUI } from '../contexts/UIContext';
import { useCoreState } from '../contexts/CoreContext';
import { useMatterState } from '../contexts/MatterContext';
import { useDataActions } from '../contexts/DataContext';
import { useDataState } from '../contexts/DataContext';
import { useTerminology } from '../contexts/ProductContext';
import { PlusIcon, GoogleIcon, ContactsIcon, SearchIcon, RevertIcon } from '../constants';
import { useHighlight } from '../hooks/useHighlight';
import EmptyState from './EmptyState';
import { ContactsSkeleton } from './toolkit/Skeleton';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';

const ContactCard: React.FC<{ contact: Contact, onViewDetails: (id: string) => void, isActive?: boolean, isSelected?: boolean, index: number }> = React.memo(({ contact, onViewDetails, isActive, isSelected, index }) => {
    // Robust checks for null/undefined values to prevent crashes
    if (!contact) return null;

    const displayName = contact.name || 'Unknown Contact';
    const initials = displayName.slice(0, 2).toUpperCase();

    return (
        <div
            id={`contact-item-${index}`}
            data-item-id={contact.id}
            onClick={() => onViewDetails(contact.id)}
            className={`
            flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all duration-200 group border-b border-slate-50 dark:border-zinc-800 last:border-0 min-h-[48px]
            ${isActive ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-slate-50 dark:hover:bg-zinc-800/50'}
            ${isSelected ? 'ring-2 ring-inset ring-primary-500 bg-primary-50/50' : ''}
        `}
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white bg-gradient-to-br from-slate-400 to-slate-500 uppercase flex-shrink-0`}>
                    {initials}
                </div>
                <div className="min-w-0">
                    <h3 className={`font-semibold text-sm truncate ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-slate-900 dark:text-white'}`}>{displayName}</h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{contact.email || contact.phone || 'No contact info'}</p>
                </div>
            </div>
            <span className="px-2 py-0.5 text-2xs font-medium rounded-full bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 whitespace-nowrap">
                {contact.category || 'General'}
            </span>
        </div>
    )
});

const ContactListContent: React.FC<{
    contacts: Contact[];
    contactCategories: ContactCategory[];
    openModal: () => void;
    onViewDetails: (id: string) => void;
    activeCategory: string;
    onCategoryChange: (category: string) => void;
    selectedId?: string | null;
    leads?: Lead[];
    contactsLabel?: string;
}> = ({ contacts, contactCategories, openModal, onViewDetails, activeCategory, onCategoryChange, selectedId, leads, contactsLabel }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    useHighlight(containerRef, 'contacts');
    const { coreState, isDataLoaded } = useCoreState();
    const { handleSyncGoogleContacts } = useDataActions();
    const { openModal: openQuickLook, addToast } = useUI();
    // Default to 'Contacts' if not passed (back-compat).
    const label = contactsLabel || 'Contacts';
    const isGoogleContactsConnected = coreState?.firmDetails?.integrations?.googleContacts || false;
    const [searchTerm, setSearchTerm] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);

    const filteredContacts = useMemo(() => {
        const safeContacts = contacts || [];
        let list = activeCategory === 'All' ? safeContacts : safeContacts.filter(c => c.category === activeCategory);

        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            list = list.filter(c =>
                (c.name || '').toLowerCase().includes(lowerSearch) ||
                (c.email || '').toLowerCase().includes(lowerSearch)
            );
        }

        return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [contacts, activeCategory, searchTerm]);

    const categoriesForFilter = ['All', ...contactCategories.map(c => c.name)];

    // Keyboard Navigation
    const { selectedIndex } = useKeyboardNavigation({
        itemCount: filteredContacts.length,
        onEnter: (index) => onViewDetails(filteredContacts[index].id),
        onSpace: (index) => {
            openQuickLook('quickLook', null, { item: filteredContacts[index], type: 'Contact' });
        }
    });

    const onSyncClick = async () => {
        setIsSyncing(true);
        try {
            await handleSyncGoogleContacts();
            addToast("Google Contacts synced successfully.", { type: 'success' });
        } catch (e) {
            addToast("Sync failed.", { type: 'error' });
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        if (selectedIndex >= 0) {
            const element = document.getElementById(`contact-item-${selectedIndex}`);
            if (element) {
                element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedIndex]);

    if (!isDataLoaded) return <ContactsSkeleton />;

    return (
        <div ref={containerRef} className="flex flex-col h-full bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800">
            {/* Header Section */}
            <div className="sticky top-0 pt-safe z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{label}</h2>
                    <div className="flex items-center gap-2">
                        {/* Import button removed — feature not yet implemented.
                            Re-add when CSV/vCard import is ready. */}
                        <button
                            onClick={openModal}
                            className="p-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-opacity shadow-sm flex items-center gap-2 text-xs font-bold min-h-[40px]"
                        >
                            <PlusIcon className="w-4 h-4" /> New
                        </button>
                    </div>
                </div>

                <div className="relative mb-3">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input autoComplete="off" data-lpignore="true"
                        type="text"
                        placeholder={`Search ${label.toLowerCase()}…`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {categoriesForFilter.map(category => (
                        <button key={category} onClick={() => onCategoryChange(category)}
                            className={`${category === activeCategory ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 bg-slate-100 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'} whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold transition-all`}>
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-grow overflow-y-auto scroll-smooth-ios custom-scrollbar p-2 pb-nav">
                {filteredContacts.length > 0 ? (
                    <div className="space-y-0.5">
                        {filteredContacts.map((contact, index) => (
                            <ContactCard
                                key={contact.id}
                                contact={contact}
                                onViewDetails={onViewDetails}
                                isActive={contact.id === selectedId}
                                isSelected={index === selectedIndex}
                                index={index}
                            />
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        title={`No ${label}`}
                        description={searchTerm ? "No matches found." : "Your list is empty."}
                        icon={<ContactsIcon />}
                        actionLabel={!searchTerm ? `Add ${label.replace(/s$/, '')}` : undefined}
                        onAction={!searchTerm ? openModal : undefined}
                    />
                )}
            </div>


        </div>
    );
};

const ContactsView: React.FC = () => {
    const { matterState } = useMatterState();
    const { coreState } = useCoreState();
    const { openModal, navigateTo, selectedId, currentHistoryEntry, updateCurrentHistoryEntry } = useUI();
    // Product-aware terminology: 'Clients' for Vega, 'Residents' for Atrium,
    // 'Contacts' for Komplete (covers all three: owners, residents, legal clients).
    const terminology = useTerminology();
    const contactsLabel = terminology.clients;

    const activeContactCategory = currentHistoryEntry.activeContactCategory || 'All';
    const onContactCategoryChange = (cat: string) => updateCurrentHistoryEntry({ activeContactCategory: cat });

    return (
        <div className="h-full flex flex-col w-full">
            <ContactListContent
                contacts={matterState.contacts}
                contactCategories={coreState.contactCategories}
                openModal={() => openModal('newContact')}
                onViewDetails={(id) => navigateTo('contactDetail', id)}
                activeCategory={activeContactCategory}
                onCategoryChange={onContactCategoryChange}
                selectedId={selectedId}
                leads={coreState.leads}
                contactsLabel={contactsLabel}
            />
        </div>
    );
};

export default ContactsView;

