import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Matter, ClientMessage, NotePage, ChecklistItem, User, Lead, Invoice, Document } from '../../types';
import { useMatterState } from '../../contexts/MatterContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useFinanceState } from '../../contexts/FinanceContext';
import { useUI } from '../../contexts/UIContext';
import { useProduct } from '../../contexts/ProductContext';
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
        className={`flex-shrink-0 relative whitespace-nowrap py-3 px-4 border-b-2 font-semibold text-sm transition-colors ${isActive
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
    // ── PORTAL DATA FIX ────────────────────────────────────────────────────
    // Portal (Client-role) users NEVER load firm data — DataProvider skips
    // getFirmData for them, so matterState.matters / financeState.invoices /
    // documentState.documents are always empty and this view permanently
    // showed "Matter Not Found" (audit CRITICAL). Pull the client's own
    // matters / invoices / documents through the dedicated portal queries
    // (the same ones ClientDashboard already uses), with a fallback to the
    // firm data for non-portal contexts (impersonation/demo).
    const { currentUser: portalUser } = useAuth();
    const firmResolution = useQuery(
        api.portals.resolveFirmFromInvite,
        !portalUser?.firmId && portalUser?.email ? { email: portalUser.email } : 'skip'
    );
    const effectiveFirmId = portalUser?.firmId || firmResolution?.firmId || '';
    const clientContactResult = useQuery(
        api.portals.getClientContactByUserId,
        (portalUser?.id && effectiveFirmId) ? { firmId: effectiveFirmId, userId: portalUser.id } : 'skip'
    );
    const clientContactId = clientContactResult ? (String((clientContactResult as any)._id || (clientContactResult as any).id)) : null;
    const portalMatters = useQuery(
        api.portals.getClientMattersByUserId,
        (portalUser?.id && effectiveFirmId) ? { firmId: effectiveFirmId, userId: portalUser.id } : 'skip'
    );
    const portalInvoices = useQuery(
        api.portals.getClientInvoices,
        (effectiveFirmId && clientContactId) ? { firmId: effectiveFirmId, contactId: clientContactId } : 'skip'
    );
    const portalDocuments = useQuery(
        api.portals.getClientDocuments,
        (effectiveFirmId && clientContactId) ? { firmId: effectiveFirmId, contactId: clientContactId } : 'skip'
    );
    const { handleClientUploadDocument, handleClientMarkDocumentAsReviewed, handleUpdateClientActionItem, handleSendClientMessage } = useDataActions();
    const { currentUser } = useAuth();
    const { isProperty } = useProduct();
    const [activeTab, setActiveTab] = useState<ClientTab>(() => {
        const hash = window.location.hash.replace('#', '');
        if (['overview', 'documents', 'action_items', 'messages', 'billing'].includes(hash)) return hash as ClientTab;
        return 'overview';
    });

    const handleTabChange = (tab: ClientTab) => {
        setActiveTab(tab);
        window.location.hash = tab;
    };
    const [clientMessage, setClientMessage] = useState('');
    const clientMessagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        clientMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [matterState.clientMessages]);

    // Prefer portal query data (Client-role users); fall back to firm data
    // (admin impersonation / non-portal contexts).
    const isPortalUser = currentUser?.role === 'Client';
    const portalMatter = (portalMatters || []).find((m: any) => String(m.id) === String(matterId));
    const firmMatter = matterState.matters.find(m => m.id === matterId);
    const matter = (isPortalUser ? portalMatter : (firmMatter || portalMatter)) as any;
    const invoices = (isPortalUser ? (portalInvoices || []) : (financeState.invoices || (portalInvoices || []))) as any as Invoice[];
    const onGoBack = () => navigateTo('dashboard');

    if (!currentUser) return null;

    if (!matter) {
        const portalDataLoading =
            (portalMatters === undefined && !!(portalUser?.id && effectiveFirmId)) ||
            (portalInvoices === undefined && !!(effectiveFirmId && clientContactId)) ||
            (!isPortalUser && !isDataLoaded);
        if (portalDataLoading) {
            return (
                <div className="animate-pulse space-y-6">
                    <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-24" />
                    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md p-6">
                        <div className="h-8 bg-slate-200 dark:bg-zinc-700 rounded w-3/4 mb-3" />
                        <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-1/2" />
                    </div>
                    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md p-6 space-y-4">
                        <div className="h-6 bg-slate-200 dark:bg-zinc-700 rounded w-1/3" />
                        <div className="h-20 bg-slate-200 dark:bg-zinc-700 rounded" />
                        <div className="h-20 bg-slate-200 dark:bg-zinc-700 rounded" />
                    </div>
                </div>
            );
        }
        return (
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md p-12 text-center">
                <div className="w-12 h-12 mx-auto mb-4 bg-slate-100 dark:bg-zinc-800 rounded-md flex items-center justify-center"><svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg></div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Matter Not Found</h3>
                <p className="text-slate-500 dark:text-zinc-400 mb-6">This matter may have been removed or you don't have access to it.</p>
                <button onClick={() => navigateTo('dashboard')} className="px-4 py-2 bg-primary-500 text-white rounded-lg font-semibold text-sm hover:bg-primary-600 transition-colors">Back to Dashboard</button>
            </div>
        );
    }

    // Documents: portal query returns matterId-keyed docs; firm data returns
    // matter.id-keyed docs. Support both shapes. Cast to Document[] for the
    // typed tab components (portal query omits optional fields like
    // signatureData — runtime access uses optional chaining anyway).
    const documents = ((isPortalUser ? (portalDocuments || []) : documentState.documents) as any[]).filter((d: any) => {
        const docMatterId = d.matter?.id || d.matterId;
        return String(docMatterId) === String(matter.id);
    }) as any as Document[];
    const clientMessages = (matterState.clientMessages || []).filter((m: any) => String(m.matterId) === String(matter.id));
    const systemNotes = (documentState.notePages || []).filter(p => String(p.matterId) === String(matter.id) && p.type === 'system');
    const matterInvoices = invoices.filter((inv: any) => String(inv.matter?.id || inv.matterId || '') === String(matter.id));


    const isNew = (date: any) => {
        const itemDate = new Date(date);
        const lastViewed = currentUser.lastViewedPortalAt ? new Date(currentUser.lastViewedPortalAt) : new Date(0);
        return itemDate > lastViewed;
    };

    const hasNewDocuments = documents.some(d => d.isSharedWithClient && isNew(d.dateFiled));
    const hasNewActionItems = matter.clientActionItems?.some((i: any) => !i.completed) || documents.some(d => (d.clientReviewStatus === 'review_requested' || d.isSignatureRequested) && !d.signatureData);
    const hasNewMessages = clientMessages.some(m => m.authorId !== currentUser.id && isNew(m.timestamp));
    const hasNewBillingItems = matterInvoices.some((inv: any) => isNew(inv.issueDate));


    const handleSendMessageClick = () => {
        if (clientMessage.trim()) {
            handleSendClientMessage(matter.id, clientMessage.trim());
            setClientMessage('');
            addToast('Message sent', { type: 'success' });
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
            case 'action_items': {
                    const pendingActionItems = matter.clientActionItems?.filter((i: any) => !i.completed) ?? [];
                    const reviewDocs = documents.filter(d => (d.clientReviewStatus === 'review_requested' || d.isSignatureRequested) && !d.signatureData);
                    const hasItems = pendingActionItems.length > 0 || reviewDocs.length > 0;
                    return (
                        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md p-6">
                            <h3 className="text-xl font-bold mb-4">Your Action Items</h3>
                            {!hasItems ? (
                                <div className="text-center py-8">
                                    <div className="w-10 h-10 mx-auto mb-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center"><svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></div>
                                    <p className="text-slate-500 dark:text-zinc-400">No action items right now. {isProperty ? 'Your manager will add items here when needed' : 'Your lawyer will add items here when needed'}.</p>
                                </div>
                            ) : (
                                <ul className="space-y-3">
                                    {pendingActionItems.map((item: any) => (
                                        <li key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-zinc-700/50">
                                            <input
                                                type="checkbox"
                                                checked={item.completed}
                                                onChange={() => handleUpdateClientActionItem(matter.id, item.id, !item.completed)}
                                                className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-500 focus:ring-primary-500"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">{item.title}</p>
                                                {item.description && <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{item.description}</p>}
                                            </div>
                                        </li>
                                    ))}
                                    {reviewDocs.map(doc => (
                                        <li key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
                                            <span className="text-lg">{doc.isSignatureRequested ? '✍️' : '📄'}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">{doc.isSignatureRequested ? 'Signature requested' : 'Review requested'}: {doc.title}</p>
                                            </div>
                                            <button
                                                onClick={() => handleTabChange('documents')}
                                                className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap"
                                            >
                                                Go to Documents →
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    );
                }
            case 'messages':
                return (
                    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md flex flex-col h-[70vh]">
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
                    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md p-6">
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
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{matter.title}</h2>
                <p className="text-slate-500 dark:text-zinc-400 mt-1">Reference: {matter.referenceNumber}</p>
            </div>
            <div className="mb-6 border-b border-slate-200 dark:border-zinc-700">
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    <TabButton label="Overview" isActive={activeTab === 'overview'} onClick={() => handleTabChange('overview')} />
                    <TabButton label="Documents" isActive={activeTab === 'documents'} onClick={() => handleTabChange('documents')} hasNotification={hasNewDocuments} />
                    <TabButton label="Action Items" isActive={activeTab === 'action_items'} onClick={() => handleTabChange('action_items')} hasNotification={hasNewActionItems} />
                    <TabButton label="Messages" isActive={activeTab === 'messages'} onClick={() => handleTabChange('messages')} hasNotification={hasNewMessages} />
                    <TabButton label="Billing" isActive={activeTab === 'billing'} onClick={() => handleTabChange('billing')} hasNotification={hasNewBillingItems} />
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