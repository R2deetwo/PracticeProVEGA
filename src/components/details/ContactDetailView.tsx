
import React, { useState } from 'react';
import { Contact, Matter, ModalType, AppMode, User, MatterType, Property, ContactType } from '../../types';
import { useHighlight } from '../../hooks/useHighlight';
import { useAuth } from '../../contexts/AuthContext';
import { PlusIcon, EditIcon, TrashIcon, LinkIcon, OfficeBuildingIcon, ChevronRightIcon } from '../../constants';
import { ExpandablePropertyGroup } from '../sentry/ExpandablePropertyGroup';
import { Breadcrumbs } from '../Breadcrumbs';
import { useUI } from '../../contexts/UIContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import ErrorBoundary from '../ErrorBoundary';
import BacklinksPanel from '../BacklinksPanel';

interface ContactDetailViewProps {
  contactId: string;
  onGoBack: () => void;
  openModal: (modalType: ModalType, id?: string | null, context?: any) => void;
  isPane?: boolean;
}

const DetailItem: React.FC<{ label: string, value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{label}</p>
    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{value}</p>
  </div>
);

type ContactTab = 'overview' | 'matters' | 'properties' | 'relationships' | 'messages';

// ─── ContactMessagesTab ───────────────────────────────────────────────────
// Shows recent interaction history / messages tied to this specific contact.
// Pulls from clientMessages (linked via matterId → matter.clientId === contactId)
// and provides a "Go to conversation" button that navigates to the central
// Messages section.
const ContactMessagesTab: React.FC<{
    contact: Contact;
    matters: Matter[];
    navigateTo: (view: any, id?: string | null, context?: any) => void;
}> = ({ contact, matters, navigateTo }) => {
    const { coreState } = useCoreState();
    const clientMessages = (coreState as any).clientMessages || [];

    // Filter client messages for matters belonging to this contact
    const contactMatterIds = new Set(matters.map(m => m.id));
    const contactMessages = clientMessages
        .filter((m: any) => contactMatterIds.has(m.matterId))
        .sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

    const handleMessageContact = () => {
        // Preferred channel resolution: WhatsApp if valid phone exists, otherwise Email
        const channel = contact.phone ? 'whatsapp' : 'email';
        navigateTo('messages', null, {
            initialTab: 'inbox',
            contactId: contact.id,
            contactName: contact.name,
            composeChannel: channel,
            composeRecipient: channel === 'whatsapp' ? contact.phone : contact.email,
        });
    };

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-700 p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Messages & Communication History</h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                        Recent interactions with {contact.name}
                    </p>
                </div>
                <button
                    onClick={handleMessageContact}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold text-xs hover:bg-indigo-700 flex items-center gap-2 shadow-sm"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    New Message
                </button>
            </div>

            {contactMessages.length > 0 ? (
                <div className="space-y-3">
                    {contactMessages.slice(0, 20).map((msg: any) => {
                        const matter = matters.find(m => m.id === msg.matterId);
                        return (
                            <div
                                key={msg.id || msg._id}
                                className="p-3 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700/30 transition-colors cursor-pointer"
                                onClick={() => navigateTo('messages', null, {
                                    initialTab: 'inbox',
                                    selectedInboxId: msg.id || msg._id,
                                    selectedInboxType: 'portal',
                                    contactId: contact.id,
                                })}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-1.5 py-0.5 rounded text-2xs font-bold uppercase ${msg.isRead ? 'bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}`}>
                                                {msg.isRead ? 'Read' : 'New'}
                                            </span>
                                            {matter && (
                                                <span className="text-2xs text-slate-400 truncate">{matter.title}</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-700 dark:text-zinc-200 line-clamp-2">{msg.content}</p>
                                        <p className="text-2xs text-slate-400 mt-1">
                                            {msg.timestamp ? new Date(msg.timestamp).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                                        </p>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigateTo('messages', null, {
                                                initialTab: 'inbox',
                                                selectedInboxId: msg.id || msg._id,
                                                selectedInboxType: 'portal',
                                                contactId: contact.id,
                                            });
                                        }}
                                        className="flex-shrink-0 text-2xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                    >
                                        Go to conversation →
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-zinc-300">No messages yet</p>
                    <p className="text-xs text-slate-400 mt-1 mb-4">
                        Start a conversation with {contact.name} via {contact.phone ? 'WhatsApp' : 'email'}
                    </p>
                    <button
                        onClick={handleMessageContact}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-xs hover:bg-indigo-700 inline-flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Send First Message
                    </button>
                </div>
            )}
        </div>
    );
};

const ContactDetailViewContent: React.FC<ContactDetailViewProps> = ({ contactId, onGoBack, openModal, isPane }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  useHighlight(containerRef, 'contactDetail');
  const { navigateTo, addToast } = useUI();
  const { matterState } = useMatterState();
  const { coreState } = useCoreState();
  const { documentState } = useDocumentState();
  const dataHandlers = useDataActions();
  
  const contact = matterState.contacts.find(c => c.id === contactId);
  const matters = matterState.matters.filter(m => m.clientId === contactId);
  const users = coreState.users;
  
  // Merge standalone properties with legacy nested properties
  const standaloneProperties = (coreState.properties || []).filter(p => p.contactId === contactId);
  const legacyProperties = contact?.properties || [];
  const allProperties = [...standaloneProperties, ...legacyProperties];
  
  const onViewMatterDetails = (id: string) => navigateTo('matterDetail', id);
  
  const hasRealEstateMatters = matters.some(m => m.type === MatterType.RealEstate);
  const [activeTab, setActiveTab] = useState<ContactTab>('overview');
  
  if (!contact) {
      return <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8"><p className="text-lg font-medium">Contact not found</p></div>;
  }
  
  const handleDeleteProperty = (property: Property) => {
    openModal('deleteConfirmation', property.id, {
        title: 'Delete Property?',
        message: `Are you sure you want to delete the property at "${property.address}"? This will also remove it from any linked matters.`,
        onConfirm: () => {
            const isStandalone = (coreState.properties || []).some(p => p.id === property.id);
            if (isStandalone) {
                dataHandlers.handleDeleteProperty(property.id, property.address);
            } else {
                const remaining = (contact.properties || []).filter(p => p.id !== property.id);
                dataHandlers.onUpdateContactProperties(contact.id, remaining);
            }
        }
    });
  };

  const renderTabContent = () => {
    switch (activeTab) {
        case 'matters':
            return (
                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-700 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Associated Matters</h3>
                        <button 
                            onClick={() => openModal('linkMatterToContact', contact.id)}
                            className="px-3 py-1.5 bg-white dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg font-semibold text-xs border border-slate-200 dark:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-600 flex items-center gap-2 shadow-sm"
                        >
                            <LinkIcon className="w-3.5 h-3.5"/> Link Existing
                        </button>
                    </div>
                    {matters.length > 0 ? (
                        <ul className="space-y-3">
                            {matters.map(matter => (
                                <li key={matter.id} onClick={() => onViewMatterDetails(matter.id)} className="p-4 bg-slate-50 dark:bg-zinc-700/30 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-100 dark:border-zinc-700 transition-all group">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-sm text-slate-800 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{matter.title}</p>
                                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{matter.suitNumber || 'No Suit Number'}</p>
                                        </div>
                                        <span className={`px-2.5 py-1 text-2xs font-bold uppercase tracking-wide rounded-full ${matter.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-200 text-slate-600'}`}>
                                            {matter.status}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl">
                            <p className="text-sm text-slate-500">No matters linked.</p>
                        </div>
                    )}
                </div>
            );
        case 'properties':
            return (
                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-700 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Property Portfolio</h3>
                        <button onClick={() => openModal('newProperty', contact.id)} className="px-3 py-1.5 bg-primary-600 text-white rounded-lg font-bold text-xs hover:bg-primary-700 flex items-center gap-2 shadow-sm transition-colors">
                            <PlusIcon className="w-3.5 h-3.5"/> Add Property
                        </button>
                    </div>
                    {allProperties.length > 0 ? (
                         <div className="space-y-3">
                            {(() => {
                                const grouped = allProperties.reduce((acc, prop) => {
                                    const key = prop.address || prop.id;
                                    if (!acc[key]) acc[key] = [];
                                    acc[key].push(prop);
                                    return acc;
                                }, {} as Record<string, Property[]>);

                                return Object.entries(grouped).map(([address, units]) => (
                                    <ExpandablePropertyGroup
                                        key={address}
                                        address={address}
                                        units={units}
                                        onUnitClick={(id) => navigateTo('propertyDetail', id)}
                                        onEditClick={(id) => openModal('editProperty', id, { contactId: contact.id })}
                                        onDeleteClick={(prop) => handleDeleteProperty(prop)}
                                    />
                                ));
                            })()}
                        </div>
                    ) : (
                        <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl">
                            <OfficeBuildingIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm text-slate-500">No properties recorded.</p>
                        </div>
                    )}
                </div>
            );
        case 'relationships':
            return (
                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-700 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Relationship Map</h3>
                    </div>
                    <div className="flex flex-col items-center py-12 relative">
                        {/* Central Node */}
                        <div className="bg-primary-600 text-white font-bold py-3 px-6 rounded-2xl shadow-lg z-10 text-center">
                            {contact.name}
                            <div className="text-xs font-medium text-primary-100">{contact.category}</div>
                        </div>

                        {/* Line downwards */}
                        {matters.length > 0 && (
                            <>
                                <div className="w-0.5 h-10 bg-slate-300 dark:bg-zinc-600 z-0"></div>
                                <div className="w-full max-w-2xl h-0.5 bg-slate-300 dark:bg-zinc-600 z-0"></div>
                                <div className="flex justify-between w-full max-w-2xl mt-0">
                                    {matters.map(m => (
                                        <div key={m.id} className="flex flex-col items-center">
                                            <div className="w-0.5 h-6 bg-slate-300 dark:bg-zinc-600 z-0"></div>
                                            <div onClick={() => onViewMatterDetails(m.id)} className="bg-slate-50 dark:bg-zinc-700/50 border border-slate-200 dark:border-zinc-600 text-slate-800 dark:text-zinc-200 font-bold py-2 px-4 rounded-xl shadow-sm text-xs text-center cursor-pointer hover:border-primary-400 hover:shadow-md transition-all max-w-[120px]">
                                                {m.title}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                        {matters.length === 0 && (
                             <p className="text-sm text-slate-500 mt-6">No linked matters or properties to map.</p>
                        )}
                    </div>
                </div>
            );
        case 'messages':
            return <ContactMessagesTab contact={contact} matters={matters} navigateTo={navigateTo} />;
        case 'overview':
        default:
             return (
                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-700 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-8">
                        <DetailItem label="Email" value={<a href={`mailto:${contact.email}`} className="text-primary-600 hover:underline">{contact.email}</a>} />
                        <DetailItem label="Phone" value={contact.phone || 'N/A'} />
                        <DetailItem label="Category" value={<span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-700 rounded text-xs font-semibold">{contact.category}</span>} />
                        <div className="col-span-full">
                             <DetailItem label="Address" value={<div className="whitespace-pre-wrap">{contact.address || 'N/A'}</div>} />
                        </div>
                        
                        {(contact.identificationNumber || contact.taxId) && (
                            <div className="col-span-full pt-4 border-t border-slate-100 dark:border-zinc-700 mt-2">
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide mb-4 flex items-center gap-2">
                                    <span className="w-1 h-4 bg-primary-500 rounded-full"></span> KYC Details
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                     {contact.contactType === ContactType.Company ? (
                                         <>
                                            <DetailItem label="RC Number" value={contact.identificationNumber || 'N/A'} />
                                            <DetailItem label="Date of Incorp." value={contact.dateOfBirth ? new Date(contact.dateOfBirth).toLocaleDateString('en-GB') : 'N/A'} />
                                         </>
                                     ) : (
                                         <>
                                            <DetailItem label="ID Number" value={contact.identificationNumber || 'N/A'} />
                                            <DetailItem label="Date of Birth" value={contact.dateOfBirth ? new Date(contact.dateOfBirth).toLocaleDateString('en-GB') : 'N/A'} />
                                            <DetailItem label="Next of Kin" value={contact.nextOfKin || 'N/A'} />
                                         </>
                                     )}
                                     <DetailItem label="Tax ID (TIN)" value={contact.taxId || 'N/A'} />
                                </div>
                            </div>
                        )}
                    </div>

                    {(contact.jobTitle || contact.companyName || contact.website || contact.notes) && (
                        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-zinc-700">
                             <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide mb-4 flex items-center gap-2">
                                    <span className="w-1 h-4 bg-slate-400 rounded-full"></span> Additional Info
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {contact.jobTitle && <DetailItem label="Job Title" value={contact.jobTitle} />}
                                {contact.companyName && <DetailItem label="Company" value={contact.companyName} />}
                                {contact.website && <DetailItem label="Website" value={<a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate block">{contact.website}</a>} />}
                                {contact.notes && <div className="md:col-span-2"><DetailItem label="Notes" value={<div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap bg-slate-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-slate-100 dark:border-zinc-700/50 text-slate-600">{contact.notes}</div>} /></div>}
                            </div>
                        </div>
                    )}
                </div>
            );
    }
  };

  return (
    <div data-item-id={contact.id} ref={containerRef} className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center">
        <div className="flex items-center gap-4">
            <button onClick={onGoBack} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors">
                 <ChevronRightIcon className="w-5 h-5 rotate-180" />
            </button>
            <div>
                 <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-none">{contact.name}</h2>
                 <p className="text-xs text-slate-500 mt-1">{contact.contactType}</p>
            </div>
        </div>
        <div className="flex gap-2 flex-wrap">
            <button
                onClick={() => {
                    // Navigate to Messages with this contact pre-selected.
                    // Channel resolution: WhatsApp if valid phone exists,
                    // otherwise Email.
                    const channel = contact.phone ? 'whatsapp' : 'email';
                    navigateTo('messages', null, {
                        initialTab: 'inbox',
                        contactId: contact.id,
                        contactName: contact.name,
                        composeChannel: channel,
                        composeRecipient: channel === 'whatsapp' ? contact.phone : contact.email,
                    });
                }}
                className="px-3 py-1.5 bg-indigo-600 border border-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2"
            >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                Message
            </button>
            <button 
                onClick={() => {
                    openModal('deleteConfirmation', contact.id, {
                        title: 'Delete Contact?',
                        message: `Are you sure you want to delete "${contact.name}"? This will also remove their associated records from your view.`,
                        onConfirm: () => {
                            dataHandlers.deleteItem('contacts', contact.id, contact.name);
                            onGoBack();
                        }
                    });
                }} 
                className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-rose-200 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors shadow-sm flex items-center gap-2"
            >
                <TrashIcon className="w-3.5 h-3.5" /> Delete
            </button>
            <button 
                onClick={() => openModal('mergeContact', contact.id)} 
                className="px-3 py-1.5 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-200 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-600 transition-colors shadow-sm"
            >
                Merge Contact
            </button>
            <button onClick={() => openModal('editContact', contact.id)} className="px-3 py-1.5 bg-primary-600 border border-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 transition-colors shadow-sm">
                Edit Contact
            </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex-shrink-0 px-6 border-b border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
            <nav className="-mb-px flex space-x-6 overflow-x-auto no-scrollbar whitespace-nowrap">
                <button onClick={() => setActiveTab('overview')} className={`flex-shrink-0 py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'overview' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400'}`}>Overview</button>
                <button onClick={() => setActiveTab('matters')} className={`flex-shrink-0 py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'matters' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400'}`}>Matters ({matters.length})</button>
                {(hasRealEstateMatters || allProperties.length > 0) && (
                    <button onClick={() => setActiveTab('properties')} className={`flex-shrink-0 py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'properties' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400'}`}>
                        Properties ({new Set(allProperties.map(p => p.address)).size}) {allProperties.length > 1 && <span className="text-2xs opacity-60 ml-1 font-bold">• {allProperties.length} Units</span>}
                    </button>
                )}
                <button onClick={() => setActiveTab('messages')} className={`flex-shrink-0 py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'messages' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400'}`}>Messages</button>
                <button onClick={() => setActiveTab('relationships')} className={`flex-shrink-0 py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'relationships' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400'}`}>Relationship Map</button>
            </nav>
        </div>

        <div className="flex-grow overflow-y-auto p-6 custom-scrollbar bg-slate-50 dark:bg-zinc-900">
             <div className="max-w-5xl mx-auto">
                {renderTabContent()}
                {/* Bidirectional linking — notes that mention this contact */}
                <BacklinksPanel
                    entityId={contact.id}
                    entityType="contact"
                    entityLabel={contact.name}
                    notes={documentState.notePages || []}
                    navigateTo={navigateTo}
                />
             </div>
        </div>
      
    </div>
  );
};

export const ContactDetailView: React.FC<ContactDetailViewProps> = (props) => (
    <ErrorBoundary>
        <ContactDetailViewContent {...props} />
    </ErrorBoundary>
);
