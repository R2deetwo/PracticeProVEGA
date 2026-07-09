import React from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Modal } from './Modal';
import { useUI } from '../../contexts/UIContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useFinanceState } from '../../contexts/FinanceContext';
import { useExecutionState } from '../../contexts/ExecutionContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useIsProperty } from '../../contexts/ProductContext';
import { ModalType, FileDetails } from '../../types';

// Auth
import Login from '../auth/Login';
import Signup from '../auth/Signup';

// Forms
import { MatterForm } from '../forms/MatterForm';
import { SmartMatterModal } from '../forms/SmartMatterModal';
import { SubscriptionPlan } from '../../types';
import { DocumentForm } from '../forms/DocumentForm';
import TaskForm from '../forms/TaskForm';
import ContactForm from '../forms/ContactForm';
import { EventForm } from '../forms/EventForm';
import { InvoiceForm } from '../forms/InvoiceForm';
import { InvoiceGeneratorForm } from '../forms/InvoiceGeneratorForm';
import UserForm from '../forms/UserForm';
import TimeEntryForm from '../forms/TimeEntryForm';
import ExpenseForm from '../forms/ExpenseForm';
import BankAccountForm from '../forms/BankAccountForm';
import WorkflowForm from '../forms/WorkflowForm';
import EventTypeForm from '../forms/EventTypeForm';
import ContactCategoryForm from '../forms/ContactCategoryForm';
import DocumentCategoryForm from '../forms/DocumentCategoryForm';
import ChecklistTemplateForm from '../forms/ChecklistTemplateForm';
import FirmDetailsForm from '../forms/FirmDetailsForm';
import TemplateForm from '../forms/TemplateForm';
import TemplateCategoryForm from '../forms/TemplateCategoryForm';
import FeedbackForm from '../forms/FeedbackForm';
import RequestFinancialDocumentForm from '../forms/RequestFinancialDocumentForm';
import NewChannelForm from '../forms/NewChannelForm';
import NewDirectMessageForm from '../forms/NewDirectMessageForm';
import AssignUsersForm from '../forms/AssignUsersForm';
import ExternalCounselInviteForm from '../forms/ExternalCounselInviteForm';
import { StageChecklistForm } from '../forms/StageChecklistForm';
import NewResearchNotebookForm from '../forms/NewResearchNotebookForm';
import PropertyForm from '../forms/PropertyForm';
import CollectRentModal from './CollectRentModal';
import MergeContactModal from './MergeContactModal';
import NotebookForm from '../forms/NotebookForm';
import LeadForm from '../forms/LeadForm';
import { SaveToNoteForm } from '../forms/SaveToNoteForm';
import { LinkMatterToContactForm } from '../forms/LinkMatterToContactForm';
import NotePageForm from '../forms/NotePageForm';
import BatchUploadModal from './BatchUploadModal';
import JoinFirmModal from './JoinFirmModal';
import MatterIngestionWizard from './MatterIngestionWizard';
import { BulkEditPropertyModal } from './BulkEditPropertyModal';

// Modals
import DemoUpsellModal from './DemoUpsellModal';
import ArchiveMatterModal from './ArchiveMatterModal';
import CloseMatterModal from './CloseMatterModal';
import ConfirmationModal from './DeleteConfirmationModal';
import { ShareDocumentModal } from './ShareDocumentModal';
import { SignDocumentModal } from './SignDocumentModal';
import { DocumentComparisonModal } from './DocumentComparisonModal';
import ComposeEmailModal from './ComposeEmailModal';
// GoogleDrivePickerModal import removed — not yet implemented
import NoTeamMembersModal from './NoTeamMembersModal';
import AloaHelpModal from './AloaHelpModal';
import LinkContactModal from './LinkContactModal';
import AddResearchSourceModal from './AddResearchSourceModal';
import AddCaseToNotebookModal from './AddCaseToNotebookModal';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';
import QuickLookModal from './QuickLookModal';
import PaymentGatewayModal from './PaymentGatewayModal';
import UpgradeModal from './UpgradeModal';
import TaskDetailModal from './TaskDetailModal';
import { EventDetailModal } from '../details/EventDetailModal';
import LeadCaptureModal from './LeadCaptureModal';
import WorkspaceSetupModal from './WorkspaceSetupModal';
import SendPostActivationEmailModal from './SendPostActivationEmailModal';
import FolderPermissionsModal from './FolderPermissionsModal';
import SendIntakeLinkModal from './SendIntakeLinkModal';
import { expandRecurringEvents } from '../../utils/calendarUtils';
import AIConsentModal from './AIConsentModal';

// Wrapper that gives AIConsentModal access to React hooks (recordConsent mutation)
const AIConsentModalWrapper: React.FC<{ modalContext: any; closeModal: () => void }> = ({ modalContext, closeModal }) => {
    const recordConsent = useMutation(api.myFunctions.recordConsent);
    const { currentUser } = useAuth();

    const handleAccept = async () => {
        localStorage.setItem('practicepro_ai_consent', 'true');
        // Persist consent to DB for audit trail
        if (currentUser?.email) {
            try {
                await recordConsent({
                    email: currentUser.email,
                    consentType: 'ai_processing',
                    granted: true,
                    ipHint: Intl.DateTimeFormat().resolvedOptions().timeZone,
                });
            } catch (e) {
                console.warn('[Compliance] Failed to persist AI consent to DB:', e);
            }
        }
        closeModal();
        if (modalContext?.onConsent) modalContext.onConsent();
    };

    const handleDecline = async () => {
        localStorage.setItem('practicepro_ai_consent', 'false');
        if (currentUser?.email) {
            try {
                await recordConsent({
                    email: currentUser.email,
                    consentType: 'ai_processing',
                    granted: false,
                    ipHint: Intl.DateTimeFormat().resolvedOptions().timeZone,
                });
            } catch (e) {
                console.warn('[Compliance] Failed to persist AI decline to DB:', e);
            }
        }
        closeModal();
        if (modalContext?.onDecline) modalContext.onDecline();
    };

    return <AIConsentModal onAccept={handleAccept} onDecline={handleDecline} />;
};

// Record Rent Payment — calls the Atrium ledger directly from the cog menu
const RecordRentPaymentModalWrapper: React.FC<{ modalContext: any; closeModal: () => void }> = ({ modalContext, closeModal }) => {
    const addEntry = useMutation(api.sentry.addLedgerEntry);
    const { coreState } = useCoreState();
    const { updateItem } = useDataActions();
    const { addToast } = useUI();
    const firmId = coreState.firmDetails?.id || '';
    const [amount, setAmount] = React.useState(modalContext?.rentAmount ? String(modalContext.rentAmount) : '');
    const [status, setStatus] = React.useState<'cleared' | 'pending' | 'defaulted'>('cleared');
    const [loading, setLoading] = React.useState(false);
    const unitId = modalContext?.unitId || '';
    const unitName = modalContext?.unitName || 'Unit';
    const tenantName = modalContext?.tenantName || '';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!unitId || !amount) return;
        const amountNum = parseFloat(amount);
        if (Number.isNaN(amountNum) || amountNum <= 0) return;
        setLoading(true);
        try {
            const propertyRecord = (coreState.properties || []).find(p => p.id === unitId);
            const today = new Date().toISOString().split('T')[0];

            await addEntry({
                firmId,
                propertyId: propertyRecord?.id || unitId,
                unitId,
                amount: amountNum,
                type: 'rent',
                status,
                channel: 'Bank Transfer',
                description: `Rent payment${tenantName ? ' from ' + tenantName : ''}`,
                paymentRef: '',
            });

            if (propertyRecord) {
                const newPayment = {
                    id: `pay_${Date.now()}`,
                    dueDate: today,
                    paidDate: today,
                    amount: amountNum,
                    status: 'paid' as const,
                    paymentMethod: 'Bank Transfer',
                    receiptNumber: `REC-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`,
                };
                await updateItem('properties', {
                    ...propertyRecord,
                    id: propertyRecord.id,
                    rentPaymentHistory: [newPayment, ...(propertyRecord.rentPaymentHistory || [])],
                    status: propertyRecord.status === 'Vacant' ? 'Occupied' : propertyRecord.status,
                }, 'Property Payment');
            }

            addToast(`Rent payment recorded for ${unitName}`, { type: 'success' });
            closeModal();
        } catch (err) {
            addToast('Failed to record payment', { type: 'error' });
        } finally { setLoading(false); }
    };

    return (
        <div className="p-6 space-y-5">
            <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Record Rent Payment</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    {unitName}{tenantName ? ` • Tenant: ${tenantName}` : ''}
                </p>
                {/* Ledger vs Invoice explainer */}
                <div className="mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40">
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 leading-relaxed">
                        <strong>Atrium Ledger</strong> tracks rent & service charges for this property.
                        Formal <strong>Invoices</strong> (for {isProperty ? 'professional fees' : 'professional/legal fees'}) are managed separately in Billing.
                    </p>
                </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">Amount</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₦</span>
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required min="0"
                            className="w-full pl-8 pr-3 py-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            placeholder="0.00" />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">Did they pay?</label>
                    <div className="grid grid-cols-3 gap-2">
                        {([
                            ['cleared', 'Yes, paid', 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', <CheckCircle2 className="w-3.5 h-3.5" />], 
                            ['pending', 'Pending', 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300', <Clock className="w-3.5 h-3.5" />], 
                            ['defaulted', 'Defaulted', 'border-rose-500 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300', <XCircle className="w-3.5 h-3.5" />]
                        ] as const).map(([val, label, activeClass, icon]) => (
                            <button key={val as string} type="button" onClick={() => setStatus(val as any)}
                                className={`py-2 rounded-xl border text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    status === val ? activeClass : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 hover:border-slate-400'
                                }`}>{icon} {label as string}</button>
                        ))}
                    </div>
                </div>
                <div className="flex gap-3 pt-2">
                    <button type="button" onClick={closeModal} className="flex-1 py-2.5 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
                    <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-500 transition-colors disabled:opacity-50">
                        {loading ? 'Saving...' : 'Record Payment'}
                    </button>
                </div>
            </form>
        </div>
    );
};

const ModalManager: React.FC = () => {
    const { modal, closeModal, modalContext, editingId, getModalTitle, navigateTo, setHighlightTarget, openModal, updateCurrentHistoryEntry } = useUI();
    const { matterState } = useMatterState();
    const { financeState } = useFinanceState();
    const { executionState, executionActions } = useExecutionState();
    const { documentState } = useDocumentState();
    const { coreState, isDataLoaded } = useCoreState();
    const dataHandlers = useDataActions();
    const { currentUser, appMode } = useAuth();
    const isProperty = useIsProperty();

    if (!modal) return null;

    let content = null;

    switch (modal) {
        case 'login':
            content = <Login onSwitchToSignup={() => { closeModal(); setTimeout(() => openModal('signup'), 10); }} forClient={modalContext?.forClient} />;
            break;
        case 'signup':
            content = <Signup onSwitchToLogin={() => { closeModal(); setTimeout(() => openModal('login'), 10); }} />;
            break;
        case 'newMatter': {
            // Enterprise firms: render the intake wizard as its own full-screen overlay
            // (outside the Modal wrapper to avoid overflow clipping)
            const isEnterprise = coreState.firmDetails?.subscriptionPlan === SubscriptionPlan.Enterprise;
            if (isEnterprise) {
                return (
                    <SmartMatterModal
                        users={coreState.users || []}
                        contacts={matterState.contacts || []}
                        currentUser={currentUser!}
                        onClose={closeModal}
                        onAddMatter={async (matter, client) => {
                            const res = await dataHandlers.onAddMatter(matter, client);
                            if (res) {
                                navigateTo('matterDetail', res, { initialTab: 'intake' });
                            }
                            return res;
                        }}
                        onNavigate={navigateTo}
                        openModal={openModal}
                        initialContext={modalContext}
                    />
                );
            }
            // Non-Enterprise: fall through to standard MatterForm in modal
            content = (
                <MatterForm
                    matters={matterState.matters} users={coreState.users} contacts={matterState.contacts} workflows={executionState.workflows}
                    onAddMatter={dataHandlers.onAddMatter} onUpdateMatter={dataHandlers.handleUpdateMatter}
                    onClose={closeModal} currentUser={currentUser!} appMode={appMode}
                    handleAddWorkflow={executionActions.handleAddWorkflow} handleAddWorkflowSubCategory={() => {}}
                    onNavigate={navigateTo} initialContext={modalContext}
                    openModal={openModal}
                    isCompact={false}
                />
            );
            break;
        }
        case 'editMatter': {
            const matter = matterState.matters.find(m => m.id === editingId);
            content = (
                <MatterForm
                    matters={matterState.matters} users={coreState.users} contacts={matterState.contacts} workflows={executionState.workflows}
                    onAddMatter={dataHandlers.onAddMatter} onUpdateMatter={dataHandlers.handleUpdateMatter}
                    onClose={closeModal} matterToEdit={matter} currentUser={currentUser!} appMode={appMode}
                    handleAddWorkflow={executionActions.handleAddWorkflow} handleAddWorkflowSubCategory={() => {}}
                    onNavigate={navigateTo} initialContext={modalContext}
                    openModal={openModal}
                    isCompact={false}
                />
            );
            break;
        }
        case 'closeMatter': {
            const matter = matterState.matters.find(m => m.id === editingId);
            if (matter) {
                const unbilledTime = financeState.timeEntries.filter(t => t.matterId === matter.id && t.billable && !t.billedInInvoiceId);
                const unbilledExpenses = financeState.expenses.filter(e => e.matterId === matter.id && e.isBillable && !e.billedInInvoiceId);
                content = <CloseMatterModal matter={matter} unbilledTime={unbilledTime} unbilledExpenses={unbilledExpenses} onConfirm={(id, note) => { dataHandlers.handleUpdateMatterStage(id, 'Closed'); closeModal(); }} onClose={closeModal} />;
            }
            break;
        }
        case 'archiveMatter': {
            const matter = matterState.matters.find(m => m.id === editingId);
            if (matter) content = <ArchiveMatterModal matter={matter} onConfirm={(id) => { dataHandlers.archiveItem('Matter', id, matter.title, matter); closeModal(); }} onClose={closeModal} />;
            break;
        }
        case 'newContact':
        case 'editContact': {
            const contact = matterState.contacts.find(c => c.id === editingId);
            const handleAddContact = async (contactData: any, createPortal: boolean) => {
                const newContact = await dataHandlers.handleAddContact(contactData, createPortal);
                if (newContact && modalContext?.returnTo === 'newProperty') {
                    openModal('newProperty', newContact.id);
                } else {
                    closeModal();
                }
            };
            content = <ContactForm onAddContact={handleAddContact} onUpdateContact={dataHandlers.handleUpdateContact} onClose={closeModal} contactToEdit={contact} contactCategories={coreState.contactCategories} initialContext={modalContext} />;
            break;
        }
        case 'mergeContact': {
            const contact = matterState.contacts.find(c => c.id === editingId);
            if (contact) {
                content = <MergeContactModal sourceContact={contact} allContacts={matterState.contacts} onConfirm={dataHandlers.handleMergeContacts} onClose={closeModal} />;
            }
            break;
        }
        case 'collectRent': {
            const propertyId = editingId;
            const property = coreState.properties.find(p => p.id === propertyId) || 
                           matterState.contacts.flatMap(c => c.properties || []).find(p => p.id === propertyId);
            if (property) {
                content = <CollectRentModal property={property} onClose={closeModal} />;
            }
            break;
        }
        case 'recordRentPayment': {
            return (
                <Modal isOpen={true} onClose={closeModal} title="" size="sm">
                    <RecordRentPaymentModalWrapper modalContext={modalContext} closeModal={closeModal} />
                </Modal>
            );
        }
        case 'linkContactToMatter': {
            const matter = matterState.matters.find(m => m.id === editingId);
            if (matter) content = <LinkContactModal matter={matter} allContacts={matterState.contacts} onSave={dataHandlers.handleLinkContactToMatter} onClose={closeModal} />;
            break;
        }
        case 'linkMatterToContact': {
            const contact = matterState.contacts.find(c => c.id === editingId);
            if (contact) {
                content = (
                    <LinkMatterToContactForm
                        contact={contact}
                        matters={matterState.matters}
                        onSave={dataHandlers.handleLinkMatterToContact}
                        onClose={closeModal}
                    />
                );
            }
            break;
        }
        case 'bulkEditProperty': {
            const propertyIds = modalContext?.propertyIds || [];
            content = (
                <BulkEditPropertyModal
                    propertyIds={propertyIds}
                    onClose={closeModal}
                    onConfirm={async (data) => {
                        await dataHandlers.handleBulkUpdateProperties(propertyIds, data);
                        closeModal();
                    }}
                />
            );
            break;
        }
        case 'newProperty':
        case 'editProperty': {
            const propertyId = modal === 'editProperty' ? (editingId as string) : undefined;
            const contactId = modal === 'editProperty' ? modalContext?.contactId : (editingId || modalContext?.contactId);
            
            const contact = matterState.contacts.find(c => c.id === contactId);
            const propertyToEdit = coreState.properties.find(p => p.id === propertyId) || 
                                 (contact?.properties || []).find(p => p.id === propertyId);

            if (contact) {
                content = <PropertyForm contact={contact} propertyToEdit={propertyToEdit} activeUnitId={modalContext?.activeUnitId} onSave={dataHandlers.onUpdateContactProperties} onClose={closeModal} />;
            } else {
                // If no contact selected yet, show a selector
                content = (
                    <div className="p-1 sm:p-4">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Select Owner</h3>
                                <p className="text-sm text-slate-500 dark:text-zinc-400">Select a contact to manage or add properties to their portfolio.</p>
                            </div>
                            <button 
                                onClick={() => openModal('newContact', null, { returnTo: 'newProperty' })}
                                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary-500/20 transition-all flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                                Add New Contact
                            </button>
                        </div>
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                            {matterState.contacts.length > 0 ? matterState.contacts.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => openModal('newProperty', c.id)}
                                    className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-zinc-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 font-bold group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 group-hover:text-primary-600">
                                            {c.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-700 dark:text-zinc-200 group-hover:text-primary-700 dark:group-hover:text-primary-300">{c.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-zinc-500">{c.category} • {c.email || 'No email'}</p>
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 bg-primary-600 text-white shadow-lg -translate-x-2 group-hover:translate-x-0 transition-all">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                    </div>
                                </button>
                            )) : (
                                <div className="text-center py-20 bg-slate-50 dark:bg-zinc-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-800">
                                    <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                    </div>
                                    <p className="text-slate-500 dark:text-zinc-400 font-medium mb-6">No contacts found in your workspace.</p>
                                    <button 
                                        onClick={() => openModal('newContact', null, { returnTo: 'newProperty' })}
                                        className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary-500/30 transition-all inline-flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                                        Create First Contact
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            }
            break;
        }

        case 'newDocument':
        case 'editDocument':
        case 'newDraft': {
            const doc = documentState.documents.find(d => d.id === editingId);
            let ctx = modalContext;
            if (modal === 'newDraft' && (modalContext?.fields || modalContext)) {
                const aiFields = modalContext.fields || modalContext;
                ctx = {
                    ...modalContext,
                    draftTitle: aiFields.title || aiFields.draftTitle || 'New Draft',
                    draftContent: aiFields.content || aiFields.body || aiFields.draftContent || ''
                };
            }

            content = <DocumentForm documents={documentState.documents} matters={matterState.matters} contacts={matterState.contacts} documentCategories={coreState.documentCategories} documentTemplates={coreState.documentTemplates} documentTemplateCategories={coreState.documentTemplateCategories} firmDetails={coreState.firmDetails} onAddDocument={dataHandlers.handleAddDocumentAndAnalyze} onUpdateDocument={(d) => dataHandlers.updateItem('documents', d, d.title)} onClose={closeModal} documentToEdit={doc} currentUser={currentUser!} onNavigate={navigateTo} initialContext={ctx} />;
            break;
        }
        case 'batchUpload': {
            content = <BatchUploadModal files={modalContext.files} context={modalContext} onClose={closeModal} />;
            break;
        }
        case 'shareDocument': {
            const doc = documentState.documents.find(d => d.id === editingId);
            if (doc) content = <ShareDocumentModal document={doc} matter={doc.matter ? matterState.matters.find(m => m.id === doc.matter?.id) : undefined} onClose={closeModal} />;
            break;
        }
        case 'signDocument': {
            const doc = documentState.documents.find(d => d.id === editingId);
            if (doc) content = <SignDocumentModal document={doc} onSign={dataHandlers.handleSignDocument} onClose={closeModal} />;
            break;
        }
        case 'compareDocuments': {
            const { document, version } = modalContext;
            if (document && version) content = <DocumentComparisonModal currentDocument={document} versionToCompare={version} onClose={closeModal} />;
            break;
        }
        // googleDrivePicker case removed — integration not yet implemented.
        // Re-add when Google Drive API integration is ready.
        case 'folderPermissions': {
            const folder = coreState.documentCategories.find(c => c.id === editingId);
            if (folder) {
                content = <FolderPermissionsModal
                    folder={folder}
                    allRoles={(isProperty ? ['Manager', 'Associate', 'Admin'] : ['Lawyer', 'Paralegal', 'Admin']) as any}
                    currentPermissions={coreState.folderPermissions?.[folder.id] || []}
                    onUpdatePermissions={(fid, roles) => {
                        const updatedPermissions = { ...(coreState.folderPermissions || {}), [fid]: roles };
                        dataHandlers.handleUpdateFirmDetails({ ...coreState.firmDetails, folderPermissions: updatedPermissions });
                        closeModal();
                    }}
                    onClose={closeModal}
                />;
            }
            break;
        }
        case 'editTask':
        case 'newTask': {
            const taskToEdit = editingId ? executionState.tasks.find(t => t.id === editingId) : undefined;
            content = <TaskForm
                matters={matterState.matters}
                tasks={executionState.tasks}
                users={coreState.users}
                documents={documentState.documents}
                checklistTemplates={coreState.checklistTemplates}
                onAddTask={dataHandlers.handleAddTask}
                onUpdateTask={(t) => dataHandlers.updateItem('tasks', t, t.title)}
                onClose={closeModal}
                initialContext={modalContext}
                currentUser={currentUser!}
                appMode={appMode}
                taskToEdit={taskToEdit}
                openModal={openModal}
                onNavigate={navigateTo}
            />;
            break;
        }
        case 'viewTask': {
            const task = executionState.tasks.find(t => t.id === editingId);
            if (task && currentUser) {
                content = <TaskDetailModal
                    task={task}
                    users={coreState.users}
                    matters={matterState.matters}
                    documents={documentState.documents}
                    onEdit={() => {
                        openModal('newTask', task.id);
                    }}
                    onDelete={() => {
                        dataHandlers.deleteItem('tasks', task.id, task.title);
                        closeModal();
                    }}
                    onUpdateTask={(t) => dataHandlers.updateItem('tasks', t, t.title)}
                    onViewInTasks={(id, color) => {
                        closeModal();
                        setTimeout(() => {
                            updateCurrentHistoryEntry({ taskUserFilter: '__all__' });
                            navigateTo('tasks');
                            setTimeout(() => {
                                setHighlightTarget({ view: 'tasks', filter: { id }, color: color || 'blue' });
                            }, 300);
                        }, 50);
                    }}
                    currentUser={currentUser}
                    onNavigateToMatter={(mId, taskId) => {
                        closeModal();
                        setTimeout(() => {
                            setHighlightTarget({ view: 'matterDetail', filter: { id: taskId }, color: 'blue' });
                            navigateTo('matterDetail', mId, { initialTab: 'schedule_tasks' });
                        }, 50);
                    }}
                    onNavigateToCalendar={modalContext?.openedFrom !== 'calendar' ? (date) => { closeModal(); navigateTo('calendar', null, { date }); } : undefined}
                    openedFrom={modalContext?.openedFrom}
                />;
            }
            break;
        }
        case 'assignUsers': {
            const item = modalContext?.item;
            const itemType = modalContext?.itemType || 'Matter';
            const itemTitle = modalContext?.itemTitle || 'Item';
            if (item) {
                const handleAssign = (itemId: string, userIds: string[]) => {
                    if (itemType === 'Matter') {
                        const matter = matterState.matters.find(m => m.id === itemId);
                        if (matter) dataHandlers.handleUpdateMatter({ ...matter, assignedUsers: userIds });
                    } else if (itemType === 'Event') {
                        const event = executionState.events.find(e => e.id === itemId);
                        if (event) dataHandlers.updateItem('events', { ...event, assignedUsers: userIds }, event.title);
                    }
                    closeModal();
                };
                content = <AssignUsersForm item={item} itemType={itemType} itemTitle={itemTitle} users={coreState.users} onUpdate={handleAssign} onClose={closeModal} />;
            }
            break;
        }
        case 'newEvent':
        case 'editEvent': {
            const actualId = editingId?.includes('_') ? editingId.split('_')[0] : editingId;
            const event = executionState.events.find(e => e.id === actualId);
            content = <EventForm matters={matterState.matters} users={coreState.users} appMode={appMode} eventTypes={coreState.eventTypes} onSave={(e) => dataHandlers.addItem('events', e, e.title)} onUpdateEvent={(e) => dataHandlers.updateItem('events', e, e.title)} onClose={closeModal} onNavigate={navigateTo} currentUser={currentUser!} eventToEdit={event} initialContext={modalContext?.fields || modalContext} />;
            break;
        }
        case 'viewEvent': {
            let event = executionState.events.find(e => e.id === editingId);

            // Handle recurring instances that aren't in the main array
            if (!event && editingId?.includes('_')) {
                const [originalId] = editingId.split('_');
                const originalEvent = executionState.events.find(e => e.id === originalId);

                if (originalEvent && originalEvent.recurrence) {
                    // Re-expand to find this specific instance. We use the date from context if available, 
                    // or parse it from the synthetic ID.
                    const dateInstanceStr = modalContext?.instanceDate || editingId.split('_')[1];
                    const instanceDate = new Date(dateInstanceStr);
                    const endDateLimit = new Date(instanceDate);
                    endDateLimit.setDate(endDateLimit.getDate() + 1);

                    const instances = expandRecurringEvents([originalEvent], instanceDate, endDateLimit);
                    event = instances.find(inst => inst.id === editingId);
                }
            }

            if (event && currentUser) {
                content = <EventDetailModal
                    event={event}
                    matters={matterState.matters}
                    users={coreState.users}
                    eventTypes={coreState.eventTypes}
                    onEdit={() => {
                        closeModal();
                        setTimeout(() => openModal('editEvent', event.id, modalContext), 100);
                    }}
                    onDelete={() => {
                        closeModal();
                        setTimeout(() => openModal('deleteConfirmation', null, {
                            title: 'Delete Event?',
                            message: "Are you sure you want to permanently delete this event?",
                            onConfirm: () => {
                                dataHandlers.deleteItem('events', (event as any).originalId || event.id, event.title);
                                closeModal();
                            },
                            confirmText: 'Delete Event',
                            confirmButtonClass: 'bg-red-600 hover:bg-red-700'
                        }), 100);
                    }}
                    onAssign={() => {
                        closeModal();
                        setTimeout(() => openModal('editEvent', event.id, modalContext), 100);
                    }}
                    onNavigateToMatter={(mId) => {
                        closeModal();
                        setTimeout(() => {
                            setHighlightTarget({ view: 'matterDetail', filter: { id: event.id }, color: 'blue' });
                            navigateTo('matterDetail', mId, { initialTab: 'schedule_tasks' });
                        }, 50);
                    }}
                    onNavigateToCalendar={(date, eventId) => {
                        setHighlightTarget({ view: 'calendar', filter: { id: eventId }, color: 'red' });
                        closeModal();
                        navigateTo('calendar', null, { date });
                    }}
                    openedFrom={modalContext?.openedFrom}
                />;
            }
            break;
        }
        case 'viewInvoice':
        case 'newInvoice':
        case 'editInvoice': {
            const invoice = (financeState.invoices || []).find(i => i.id === editingId);
            const clients = (matterState.contacts || []).filter(c => c.category === 'Client');
            const bankAccounts = coreState.firmDetails?.bankAccounts || [];

            content = <InvoiceForm clients={clients} matters={matterState.matters || []} bankAccounts={bankAccounts} invoiceToEdit={invoice} onAddInvoice={(inv) => dataHandlers.addItem('invoices', inv, inv.invoiceNumber)} onUpdateInvoice={(inv) => dataHandlers.updateItem('invoices', inv, inv.invoiceNumber)} onClose={closeModal} />;
            break;
        }
        case 'generateInvoice': {
            const matter = matterState.matters.find(m => m.id === editingId);
            if (matter) {
                const unbilledTime = financeState.timeEntries.filter(t => t.matterId === matter.id && t.billable && !t.billedInInvoiceId);
                const unbilledExpenses = financeState.expenses.filter(e => e.matterId === matter.id && e.isBillable && !e.billedInInvoiceId);
                const safeBankAccounts = coreState.firmDetails?.bankAccounts || [];
                content = <InvoiceGeneratorForm matter={matter} unbilledTimeEntries={unbilledTime} unbilledExpenses={unbilledExpenses} bankAccounts={safeBankAccounts} onGenerateInvoice={dataHandlers.handleGenerateInvoice} onClose={closeModal} />;
            }
            break;
        }
        case 'paymentGateway': {
            content = <PaymentGatewayModal amount={modalContext.amount} email={currentUser?.email || ''} title={modalContext.title} description={modalContext.description} onSuccess={modalContext.onConfirm} onClose={closeModal} />;
            break;
        }

        case 'newUser':
        case 'editUser': {
            const userToEdit = coreState.users.find(u => u.id === editingId);
            content = <UserForm userToEdit={userToEdit} onAddUser={(u) => dataHandlers.addItem('users', u, u.name)} onUpdateUser={(u) => dataHandlers.handleUpdateUser(u.id, u)} onClose={closeModal} />;
            break;
        }
        case 'editFirmDetails':
            content = <FirmDetailsForm firmDetails={coreState.firmDetails} onUpdateFirmDetails={dataHandlers.handleUpdateFirmDetails} onClose={closeModal} />;
            break;
        case 'newWorkflow':
        case 'editWorkflow': {
            const wf = executionState.workflows.find(w => w.id === editingId);
            content = <WorkflowForm onAddWorkflow={(w) => dataHandlers.handleAddWorkflow(w)} onUpdateWorkflow={dataHandlers.handleUpdateWorkflow} onDelete={() => { /* Handle delete workflow */ }} onClose={closeModal} workflowToEdit={wf} workflows={executionState.workflows} context={modalContext} />;
            break;
        }
        case 'newEventType':
        case 'editEventType': {
            const et = coreState.eventTypes.find(e => e.id === editingId);
            content = <EventTypeForm onAddEventType={(e) => dataHandlers.addItem('eventTypes', e, e.name)} onUpdateEventType={(e) => dataHandlers.updateItem('eventTypes', e, e.name)} onDelete={() => dataHandlers.deleteItem('eventTypes', editingId!, 'Event Type')} onClose={closeModal} eventTypeToEdit={et} />;
            break;
        }
        case 'newContactCategory':
        case 'editContactCategory': {
            const cc = coreState.contactCategories.find(c => c.id === editingId);
            content = <ContactCategoryForm onAddCategory={(c) => dataHandlers.addItem('contactCategories', c, c.name)} onUpdateCategory={(c) => dataHandlers.updateItem('contactCategories', c, c.name)} onDelete={() => dataHandlers.deleteItem('contactCategories', editingId!, 'Contact Category')} onClose={closeModal} categoryToEdit={cc} />;
            break;
        }
        case 'newDocumentCategory':
        case 'editDocumentCategory': {
            const dc = coreState.documentCategories.find(c => c.id === editingId);
            content = <DocumentCategoryForm onAddCategory={(c) => dataHandlers.addItem('documentCategories', c, c.name)} onUpdateCategory={(c) => dataHandlers.updateItem('documentCategories', c, c.name)} onDelete={() => dataHandlers.deleteItem('documentCategories', editingId!, 'Document Category')} onClose={closeModal} categoryToEdit={dc} allCategories={coreState.documentCategories} context={modalContext} />;
            break;
        }
        case 'newChecklistTemplate':
        case 'editChecklistTemplate': {
            const ct = coreState.checklistTemplates.find(t => t.id === editingId);
            content = <ChecklistTemplateForm onAddTemplate={(t) => dataHandlers.addItem('checklistTemplates', t, t.name)} onUpdateTemplate={(t) => dataHandlers.updateItem('checklistTemplates', t, t.name)} onDelete={() => dataHandlers.deleteItem('checklistTemplates', editingId!, 'Checklist Template')} onClose={closeModal} templateToEdit={ct} workflows={executionState.workflows} />;
            break;
        }
        case 'newTemplate':
        case 'editTemplate': {
            const dt = coreState.documentTemplates.find(t => t.id === editingId);
            content = <TemplateForm onAddTemplate={(t) => dataHandlers.addItem('documentTemplates', t, t.name)} onUpdateTemplate={(t) => dataHandlers.updateItem('documentTemplates', t, t.name)} onDelete={() => dataHandlers.deleteItem('documentTemplates', editingId!, 'Document Template')} onClose={closeModal} templateToEdit={dt} documentTemplateCategories={coreState.documentTemplateCategories} />;
            break;
        }
        case 'newTemplateCategory':
        case 'editTemplateCategory': {
            const dtc = coreState.documentTemplateCategories.find(c => c.id === editingId);
            content = <TemplateCategoryForm onAdd={(c) => dataHandlers.addItem('documentTemplateCategories', c, c.name)} onUpdate={(c) => dataHandlers.updateItem('documentTemplateCategories', c, c.name)} onDelete={() => dataHandlers.deleteItem('documentTemplateCategories', editingId!, 'Template Category')} onClose={closeModal} categoryToEdit={dtc} />;
            break;
        }
        case 'newBankAccount':
        case 'editBankAccount': {
            const bankAccounts = coreState.firmDetails?.bankAccounts || [];
            const account = bankAccounts.find(a => a.id === editingId);
            content = <BankAccountForm accountToEdit={account} onAddAccount={(a) => { const newAccounts = [...bankAccounts, { ...a, id: Date.now().toString(), isDefault: bankAccounts.length === 0 }]; dataHandlers.handleUpdateFirmDetails({ ...coreState.firmDetails, bankAccounts: newAccounts }); }} onUpdateAccount={(a) => { const newAccounts = bankAccounts.map(acc => acc.id === a.id ? a : acc); dataHandlers.handleUpdateFirmDetails({ ...coreState.firmDetails, bankAccounts: newAccounts }); }} onSetDefault={(id) => { const newAccounts = bankAccounts.map(acc => ({ ...acc, isDefault: acc.id === id })); dataHandlers.handleUpdateFirmDetails({ ...coreState.firmDetails, bankAccounts: newAccounts }); }} onDelete={(id) => { const newAccounts = bankAccounts.filter(acc => acc.id !== id); dataHandlers.handleUpdateFirmDetails({ ...coreState.firmDetails, bankAccounts: newAccounts }); closeModal(); }} onClose={closeModal} />;
            break;
        }
        case 'newTimeEntry':
        case 'editTimeEntry': {
            const entry = financeState.timeEntries.find(t => t.id === editingId);
            const matterId = editingId || modalContext;
            const matter = matterState.matters.find(m => m.id === (entry ? entry.matterId : matterId));
            if (matter) content = <TimeEntryForm matter={matter} timeEntryToEdit={entry} onAddTimeEntry={(t) => dataHandlers.addItem('timeEntries', t, 'Time Entry')} onUpdateTimeEntry={(t) => dataHandlers.updateItem('timeEntries', t, 'Time Entry')} onClose={closeModal} />;
            break;
        }
        case 'newExpense':
        case 'editExpense': {
            const exp = financeState.expenses.find(e => e.id === editingId);
            const matterId = editingId || modalContext;
            const matter = matterState.matters.find(m => m.id === (exp ? exp.matterId : matterId));
            if (matter) content = <ExpenseForm matter={matter} expenseToEdit={exp} onAddExpense={(e) => dataHandlers.addItem('expenses', e, 'Expense')} onUpdateExpense={(e) => dataHandlers.updateItem('expenses', e, 'Expense')} onClose={closeModal} />;
            break;
        }
        case 'newChannel':
            content = <NewChannelForm users={coreState.users} onCreateChannel={dataHandlers.handleCreateChannel} onClose={closeModal} />;
            break;
        case 'newDirectMessage':
            content = <NewDirectMessageForm users={coreState.users} onClose={closeModal} />;
            break;
        case 'deleteConfirmation':
            content = <ConfirmationModal title={modalContext.title} message={modalContext.message} onConfirm={modalContext.onConfirm} onCancel={closeModal} confirmText={modalContext.confirmText} confirmButtonClass={modalContext.confirmButtonClass} onConfirmArchive={modalContext.onConfirmArchive} archiveText={modalContext.archiveText} verificationText={modalContext.verificationText} requiresPassword={modalContext.requiresPassword} />;
            break;
        case 'noTeamMembers':
            content = <NoTeamMembersModal onNavigate={() => { closeModal(); navigateTo('settings', null, { settingsTargetId: 'user-management' }); }} onClose={closeModal} />;
            break;
        case 'aloaHelp':
            content = <AloaHelpModal />;
            break;
        case 'feedback':
            content = <FeedbackForm />;
            break;
        case 'matterIngestion':
            content = <MatterIngestionWizard />;
            break;
        case 'joinFirm':
            content = <JoinFirmModal onClose={closeModal} />;
            break;
        case 'newNotebook':
        case 'editNotebook': {
            const nb = coreState.noteNotebooks.find(n => n.id === editingId);
            content = <NotebookForm notebookToEdit={nb} onAdd={(n) => dataHandlers.addItem('noteNotebooks', n, n.name)} onUpdate={(n) => dataHandlers.updateItem('noteNotebooks', n, n.name)} onClose={closeModal} currentUser={currentUser!} appMode={appMode} />;
            break;
        }
        case 'newPage': {
            content = (
                <NotePageForm
                    onAdd={(p) => dataHandlers.addItem('notePages', p, p.title)}
                    onClose={closeModal}
                    initialContext={modalContext}
                />
            );
            break;
        }
        case 'requestFinancialDocument': {
            const m = matterState.matters.find(x => x.id === editingId);
            if (m) content = <RequestFinancialDocumentForm matter={m} />;
            break;
        }
        case 'stageChecklist': {
            const m = matterState.matters.find(x => x.id === editingId);
            if (m && modalContext) content = <StageChecklistForm matter={m} stage={modalContext.stage} workflow={modalContext.workflow} checklistTemplates={coreState.checklistTemplates} onClose={closeModal} />;
            break;
        }
        case 'newExternalCounsel': {
            content = <ExternalCounselInviteForm matterId={editingId!} onInvite={dataHandlers.handleInviteExternalCounsel} onClose={closeModal} />;
            break;
        }
        case 'upgradePlan': {
            content = <UpgradeModal
                featureName={modalContext?.featureName}
                targetPlan={modalContext?.targetPlan} // Pass target plan to modal
                onUpgrade={() => { closeModal(); navigateTo('settings', null, { settingsTargetId: 'subscription-management' }); }}
                onClose={closeModal}
            />;
            break;
        }
        case 'keyboardShortcuts':
            content = <KeyboardShortcutsModal />;
            break;
        case 'quickLook':
            content = <QuickLookModal />;
            break;
        case 'saveToNote':
            content = <SaveToNoteForm initialContent={modalContext?.content || ''} onClose={closeModal} />;
            break;
        case 'newResearchNotebook':
            content = (
                <NewResearchNotebookForm
                    matters={matterState.matters}
                    onSubmit={async (data) => {
                        const { name, matterId, files } = data;

                        const notebook = dataHandlers.handleAddResearchNotebook({
                            firmId: coreState.firmDetails.id,
                            userId: currentUser!.id,
                            name,
                            matterId
                        });

                        if (files.length > 0) {
                            for (const file of files) {
                                const reader = new FileReader();
                                await new Promise<void>((resolve) => {
                                    reader.onload = () => {
                                        const fileDetails: FileDetails = {
                                            name: file.name,
                                            type: file.type,
                                            size: file.size,
                                            filePath: `research/${notebook.id}/${file.name}`,
                                            dataUrl: reader.result as string
                                        };

                                        dataHandlers.handleAddResearchSource(notebook.id, {
                                            name: file.name,
                                            type: file.type === 'application/pdf' ? 'pdf' : 'text',
                                            content: '',
                                            file: fileDetails
                                        });
                                        resolve();
                                    };
                                    reader.readAsDataURL(file);
                                });
                            }
                        }

                        if (updateCurrentHistoryEntry) {
                            updateCurrentHistoryEntry({ selectedResearchNotebookId: notebook.id });
                        }
                        closeModal();
                    }}
                    onClose={closeModal}
                />
            );
            break;
        case 'addResearchSource':
            content = <AddResearchSourceModal notebookId={modalContext?.notebookId} onAdd={dataHandlers.handleAddResearchSource} onClose={closeModal} />;
            break;
        case 'addCaseToNotebook':
            content = <AddCaseToNotebookModal caseData={modalContext?.caseData} notebooks={documentState.researchNotebooks.filter(nb => nb.userId === currentUser?.id)} matters={matterState.matters} onAdd={(nbId, cData) => dataHandlers.handleAddResearchSource(nbId, { name: cData.parties, type: 'text', content: JSON.stringify(cData) })} onCreateNotebook={dataHandlers.handleAddResearchNotebook} onClose={closeModal} />;
            break;
        case 'workspaceSetup':
            content = <WorkspaceSetupModal onSuccess={() => { }} pendingAction={modalContext?.pendingAction} onClose={closeModal} />;
            break;
        case 'newLead':
            content = <LeadForm onClose={closeModal} initialContext={modalContext?.fields || modalContext} />;
            break;
        case 'sendIntakeLink': {
            content = <SendIntakeLinkModal />;
            break;
        }
        case 'activateLead': {
            const lead = coreState.leads?.find(l => l.id === editingId);
            if (lead) {
                content = <ConfirmationModal
                    title="Convert Lead to Contact?"
                    message={`Are you sure you want to convert "${lead.name}" from a lead to a full contact? This will create a new Contact record and remove them from your Lead pipeline.`}
                    confirmText="Convert to Contact"
                    confirmButtonClass="bg-primary-600 hover:bg-primary-700"
                    onConfirm={() => {
                        dataHandlers.handleAddLead({ name: lead.name, email: lead.email || '' }, false);
                        closeModal();
                    }}
                    onCancel={closeModal}
                />;
            }
            break;
        }
        case 'sendPostActivationEmail':
            content = <SendPostActivationEmailModal />;
            break;
        case 'composeEmail':
            content = <ComposeEmailModal onClose={closeModal} initialContext={modalContext} />;
            break;
        case 'demoUpsell':
            content = <DemoUpsellModal context={modalContext?.context} onSignup={() => openModal('signup')} onClose={closeModal} />;
            break;
        case 'leadCapture':
            content = <LeadCaptureModal />;
            break;
        case 'aiConsent':
            content = <AIConsentModalWrapper modalContext={modalContext} closeModal={closeModal} />;
            break;

        default:
            content = <div className="p-4">Modal content for {modal} not found.</div>;
    }

    if (!content) return null;

    let modalTitle = getModalTitle(modal);
    if ((modal === 'newTask' || modal === 'editTask') && editingId) {
        modalTitle = 'Edit Task';
    }
    if (modal === 'newDraft' || modal === 'newDocument' || modal === 'editDocument') {
        const doc = documentState.documents.find(d => d.id === editingId);
        const ctx = modalContext?.fields || modalContext;
        const name = doc?.title || ctx?.draftTitle || ctx?.title || 'New Document';
        modalTitle = modal === 'editDocument' ? `Edit Document: ${name}` : (modal === 'newDraft' ? `Draft: ${name}` : 'New Document');
    }
    if (modal === 'batchUpload') {
        modalTitle = 'Uploading Files';
    }
    if (modal === 'composeEmail') {
        modalTitle = 'Compose Email';
    }

    // Size mapping based on form complexity:
    //   lg → multi-section forms (contacts, properties, invoices, events, matters, matter ingest, email)
    //   md → default (documents, tasks, most forms)
    //   sm → simple confirmations and tiny forms
    const lgModals = ['matterIngestion', 'editMatter', 'newMatter', 'composeEmail',
                      'newContact', 'editContact', 'newProperty', 'editProperty',
                      'newInvoice', 'editInvoice', 'viewInvoice', 'generateInvoice',
                      'newEvent', 'editEvent', 'bulkEditProperty'];
    const smModals = ['leadCapture', 'deleteConfirmation', 'aiConsent', 'keyboardShortcuts',
                      'noTeamMembers', 'aloaHelp', 'upgradePlan', 'sendIntakeLink',
                      'sendPostActivationEmail'];
    const modalSize = lgModals.includes(modal) ? 'lg'
        : smModals.includes(modal) ? 'sm'
        : 'md';

    return (
        <Modal isOpen={!!modal} onClose={() => closeModal()} title={modalTitle} size={modalSize}>
            {content}
        </Modal>
    );
};

export default ModalManager;
