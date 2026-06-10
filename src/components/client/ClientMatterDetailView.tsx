import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Matter, ClientMessage, NotePage, ChecklistItem, User, Lead, Invoice } from '../../types';
import { useMatterState } from '../../contexts/MatterContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useFinanceState } from '../../contexts/FinanceContext';
import { useUI } from '../../contexts/UIContext';
import { ClientDocumentsTab } from './ClientDocumentsTab';
import { timeAgo, getInitials, getUserColor } from '../../utils/colorUtils';
import { sanitize } from '../../utils/sanitization';
import { ClientIntakeRecorder } from './ClientIntakeRecorder';
import { ClientBillingTab } from './ClientBillingTab';
import ErrorBoundary from '../ErrorBoundary';

// Inline ChatBubble for client messaging (previously from EndorsementsTab)
const ChatBubble: React.FC<{ message: ClientMessage; author: User | undefined; isCurrentUser: boolean }> = ({ message, author, isCurrentUser }) => {
    const initials = author ? getInitials(author.name) : '?';
    return (
        <div className={`flex gap-3 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-300 flex-shrink-0">
                {initials}
            </div>
            <div className={`max-w-[75%] ${isCurrentUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <div className={`px-4 py-2.5 rounded-2xl text-sm ${isCurrentUser
                    ? 'bg-primary-500 text-white rounded-tr-sm'
                    : 'bg-slate-100 dark:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-tl-sm'
                    }`}>
                    {message.content}
                </div>
                <span className="text-xs text-slate-400 dark:text-zinc-500">
                    {author?.name || 'Unknown'}
                </span>
            </div>
        </div>
    );
};

const TabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void; hasNotification?: boolean }> = ({ label, isActive, onClick, hasNotification }) => (
    <button
        onClick={onClick}
        className={`relative whitespace-nowrap py-3 px-4 border-b-2 font-semibold text-sm transition-colors ${isActive
            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
            : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
    >
        {label}
        {hasNotification && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>}
    </button>
);

const DetailItem: React.FC<{ label: string, value: React.ReactNode }> = ({ label, value }) => (
    <div>
        <dt className="text-sm font-medium text-slate-500 dark:text-zinc-400">{label}</dt>
        <dd className="mt-1 text-slate-900 dark:text-white">{value}</dd>
    </div>
);

type ClientTab = 'overview' | 'documents' | 'action_items' | 'messages' | 'billing';

const ClientMatterDetailViewContent: React.FC = () => {
    const { matterState } = useMatterState();
    const { documentState } = useDocumentState();
    const { financeState } = useFinanceState();
    const { selectedId: matterId, navigateTo, openModal, addToast } = useUI();
    const { coreState, isDataLoaded } = useCoreState();
    const { handleClientUploadDocument, handleClientMarkDocumentAsReviewed, handleUpdateClientActionItem, handleSendClientMessage } = useDataActions();
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<ClientTab>('overview');
    const [clientMessage, setClientMessage] = useState('');
    const clientMessagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        clientMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [matterState.clientMessages]);

    const matter = matterState.matters.find(m => m.id === matterId);
    const invoices = financeState.invoices;
    const onGoBack = () => navigateTo('dashboard');

    if (!currentUser || !matter) return null;

    const documents = documentState.documents.filter(d => d.matter?.id === matter.id);
    const clientMessages = matterState.clientMessages.filter(m => m.matterId === matter.id);
    const systemNotes = documentState.notePages.filter(p => p.matterId === matter.id && p.type === 'system');
    const matterInvoices = invoices.filter((inv: any) => inv.matter?.id === matter.id);


    const isNew = (date: string) => {
        const itemDate = new Date(date);
        const lastViewed = currentUser.lastViewedPortalAt ? new Date(currentUser.lastViewedPortalAt) : new Date(0);
        return itemDate > lastViewed;
    };

    const hasNewDocuments = documents.some(d => d.isSharedWithClient && isNew(d.dateFiled));
    const hasNewActionItems = matter.clientActionItems?.some(i => !i.completed) || documents.some(d => (d.clientReviewStatus === 'review_requested' || d.isSignatureRequested) && !d.signatureData);
    const hasNewMessages = clientMessages.some(m => m.authorId !== currentUser.id && isNew(m.timestamp));
    const hasNewBillingItems = matterInvoices.some((inv: any) => isNew(inv.issueDate));


    const handleSendMessageClick = () => {
        if (clientMessage.trim()) {
            handleSendClientMessage(matter.id, clientMessage.trim());
            setClientMessage('');
        }
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'documents':
                return <ClientDocumentsTab
                    documents={documents}
                    matter={matter}
                    currentUser={currentUser}
                    handleClientUploadDocument={handleClientUploadDocument}
                    handleClientMarkDocumentAsReviewed={handleClientMarkDocumentAsReviewed}
                    isNew={isNew}
                />;
            case 'action_items':
                return (
                    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-md p-6">
                        <h3 className="text-xl font-bold mb-4">Your Action Items</h3>
                        {/* ... Action items logic ... */}
                    </div>
                );
            case 'messages':
                return (
                    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-md flex flex-col h-[70vh]">
                        <main className="flex-grow p-4 overflow-y-auto space-y-4">
                            {clientMessages.map(msg => <ChatBubble key={msg.id} message={msg} author={coreState.users.find(u => u.id === msg.authorId)} isCurrentUser={msg.authorId === currentUser.id} />)}
                            <div ref={clientMessagesEndRef}></div>
                        </main>
                        <footer className="p-4 border-t border-slate-200 dark:border-zinc-700">
                            <div className="relative">
                                <input autoComplete="off" data-lpignore="true"  type="text" value={clientMessage} onChange={(e) => setClientMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessageClick()} placeholder="Send a message..." className="w-full p-2 pr-20 rounded-lg bg-slate-100 dark:bg-zinc-700" />
                                <button onClick={handleSendMessageClick} className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-primary-500 text-white rounded-md text-sm font-semibold">Send</button>
                            </div>
                        </footer>
                    </div>
                );
            case 'billing':
                return <ClientBillingTab matter={matter} invoices={matterInvoices} />;
            case 'overview':
            default:
                return (
                    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-md p-6">
                        <h3 className="text-xl font-bold">Matter Overview</h3>
                        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-6 text-sm">
                            <DetailItem label="Status" value={matter.status} />
                            <DetailItem label="Current Stage" value={matter.stage} />
                            <DetailItem label="Practice Area" value={matter.type} />
                            {matter.suitNumber && <DetailItem label="Suit Number" value={matter.suitNumber} />}
                        </dl>
                        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-zinc-700">
                            <h4 className="font-semibold text-lg mb-2">Recent Updates</h4>
                            <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                {systemNotes.map(note => (
                                    <li key={note.id} className="text-sm flex gap-3">
                                        <span className="text-slate-400">{timeAgo(note.createdAt)}</span>
                                        <div className="text-slate-600 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: sanitize(note.content) }}></div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div>
            <button onClick={onGoBack} className="flex items-center text-sm font-semibold text-slate-600 dark:text-zinc-300 hover:text-primary-600 mb-6">
                &larr; Back to Dashboard
            </button>
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-md p-6 mb-6">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{matter.title}</h2>
                <p className="text-slate-500 dark:text-zinc-400 mt-1">Reference: {matter.referenceNumber}</p>
            </div>
            <div className="mb-6 border-b border-gray-200 dark:border-zinc-700">
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    <TabButton label="Overview" isActive={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
                    <TabButton label="Documents" isActive={activeTab === 'documents'} onClick={() => setActiveTab('documents')} hasNotification={hasNewDocuments} />
                    <TabButton label="Action Items" isActive={activeTab === 'action_items'} onClick={() => setActiveTab('action_items')} hasNotification={hasNewActionItems} />
                    <TabButton label="Messages" isActive={activeTab === 'messages'} onClick={() => setActiveTab('messages')} hasNotification={hasNewMessages} />
                    <TabButton label="Billing" isActive={activeTab === 'billing'} onClick={() => setActiveTab('billing')} hasNotification={hasNewBillingItems} />
                </nav>
            </div>
            {renderTabContent()}
        </div>
    );
};

export const ClientMatterDetailView: React.FC = () => (
    <ErrorBoundary>
        <ClientMatterDetailViewContent />
    </ErrorBoundary>
);