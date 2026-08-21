
import React, { useState, useEffect, useRef } from 'react';
import { useUI } from '../../contexts/UIContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useExecutionState } from '../../contexts/ExecutionContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useFinanceState } from '../../contexts/FinanceContext';
import { useDataActions } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useIsProperty } from '../../contexts/ProductContext';
import { ModalType } from '../../types';
import { DismissIcon } from '../../constants';
import { expandRecurringEvents } from '../../utils/calendarUtils';

// Import forms directly
import { MatterForm } from '../forms/MatterForm';
import { DocumentForm } from '../forms/DocumentForm';
import TaskForm from '../forms/TaskForm';
import ContactForm from '../forms/ContactForm';
import LeadForm from '../forms/LeadForm';
import { EventForm } from '../forms/EventForm';
import TaskDetailModal from './TaskDetailModal';
import WorkflowForm from '../forms/WorkflowForm';
import ChecklistTemplateForm from '../forms/ChecklistTemplateForm';
import PropertyForm from '../forms/PropertyForm';
import { InvoiceForm } from '../forms/InvoiceForm';
import CollectRentModal from './CollectRentModal';
import NotebookForm from '../forms/NotebookForm';
import TimeEntryForm from '../forms/TimeEntryForm';
import ExpenseForm from '../forms/ExpenseForm';
import FeedbackForm from '../forms/FeedbackForm';
import FirmDetailsForm from '../forms/FirmDetailsForm';
import UserForm from '../forms/UserForm';
import BankAccountForm from '../forms/BankAccountForm';
// Additional dockable forms / modals
import { EventDetailModal } from '../details/EventDetailModal';
import { ShareDocumentModal } from './ShareDocumentModal';
import { SignDocumentModal } from './SignDocumentModal';
import { DocumentComparisonModal } from './DocumentComparisonModal';
import BatchUploadModal from './BatchUploadModal';
import ComposeEmailModal from './ComposeEmailModal';
import MergeContactModal from './MergeContactModal';
import CloseMatterModal from './CloseMatterModal';
import ArchiveMatterModal from './ArchiveMatterModal';
import LinkContactModal from './LinkContactModal';
import { LinkMatterToContactForm } from '../forms/LinkMatterToContactForm';
import { BulkEditPropertyModal } from './BulkEditPropertyModal';
import AssignUsersForm from '../forms/AssignUsersForm';
import NewChannelForm from '../forms/NewChannelForm';
import NewDirectMessageForm from '../forms/NewDirectMessageForm';
import { SaveToNoteForm } from '../forms/SaveToNoteForm';
import NotePageForm from '../forms/NotePageForm';
import RequestFinancialDocumentForm from '../forms/RequestFinancialDocumentForm';
import { StageChecklistForm } from '../forms/StageChecklistForm';
import ExternalCounselInviteForm from '../forms/ExternalCounselInviteForm';
import UpgradeModal from './UpgradeModal';

export const DockedModal: React.FC = () => {
  const { dockedModalType, modalContext, editingId, closeModal, getModalTitle, navigateTo, openModal, setHighlightTarget, addToast } = useUI();
  const { matterState } = useMatterState();
  const { executionState, executionActions } = useExecutionState();
  const { documentState } = useDocumentState();
  const { coreState, isDataLoaded } = useCoreState();
  const { financeState } = useFinanceState();
  const dataHandlers = useDataActions();
  const { currentUser, appMode } = useAuth();
  const isProperty = useIsProperty();
  
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  // Track selected contact for PropertyForm (which requires a contact first)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  useEffect(() => {
    if (dockedModalType) {
      setShouldRender(true);
      setSelectedContactId(null); // Reset on modal open
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [dockedModalType]);

  // ─── Esc key handler ─────────────────────────────────────────────────
  // Close the docked modal when Escape is pressed (matches Modal.tsx behavior)
  useEffect(() => {
    if (!dockedModalType) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [dockedModalType, closeModal]);

  if (!shouldRender) return null;
  
  let content: React.ReactNode = null;
  let title = dockedModalType ? getModalTitle(dockedModalType as ModalType) : '';
  
  // Common props for forms
  if (dockedModalType) {
    switch(dockedModalType) {
      case 'newMatter':
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
            isCompact={true}
          />
        );
        break;
      }
      case 'newDocument':
      case 'editDocument':
      case 'newDraft': {
        const doc = documentState.documents.find(d => d.id === editingId);
        let ctx = modalContext;
        if (dockedModalType === 'newDraft' && (modalContext?.fields || modalContext)) {
           const aiFields = modalContext.fields || modalContext;
           ctx = {
             ...modalContext,
             draftTitle: aiFields.title || aiFields.draftTitle || 'New Draft',
             draftContent: aiFields.content || aiFields.body || aiFields.draftContent || ''
           };
        }

        content = <DocumentForm 
          documents={documentState.documents} matters={matterState.matters} contacts={matterState.contacts} documentCategories={coreState.documentCategories} documentTemplates={coreState.documentTemplates} documentTemplateCategories={coreState.documentTemplateCategories} firmDetails={coreState.firmDetails} 
          onAddDocument={dataHandlers.handleAddDocumentAndAnalyze} onUpdateDocument={(d) => dataHandlers.updateItem('documents', d, d.title)} onClose={closeModal} documentToEdit={doc} currentUser={currentUser!} onNavigate={navigateTo} initialContext={ctx} 
          isCompact={true}
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
              openModal('newTask', task.id, modalContext);
            }}
            onDelete={() => {
               dataHandlers.deleteItem('tasks', task.id, task.title);
               closeModal();
            }}
            onUpdateTask={(t) => dataHandlers.updateItem('tasks', t, t.title)}
            onViewInTasks={(id, color) => { closeModal(); }}
            currentUser={currentUser}
            onNavigateToMatter={(mId) => { closeModal(); navigateTo('matterDetail', mId); }}
            openedFrom={modalContext?.openedFrom}
          />;
         }
         break;
      }
      case 'newTask':
      case 'editTask': {
         const taskToEdit = editingId ? executionState.tasks.find(t => t.id === editingId) : undefined;
         if (taskToEdit) title = 'Edit Task'; 

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
          isCompact={true}
          taskToEdit={taskToEdit}
        />;
        break;
      }
      case 'newContact':
      case 'editContact': {
        const contact = matterState.contacts.find(c => c.id === editingId);
        content = <ContactForm 
          onAddContact={dataHandlers.handleAddContact} onUpdateContact={dataHandlers.handleUpdateContact} onClose={closeModal} contactToEdit={contact} contactCategories={coreState.contactCategories} initialContext={modalContext?.fields || modalContext} 
          isCompact={true}
        />;
        break;
      }
      case 'newLead': {
        content = <LeadForm onClose={closeModal} initialContext={modalContext?.fields || modalContext} />;
        break;
      }
      case 'newEvent':
      case 'editEvent': {
        const event = executionState.events.find(e => e.id === editingId);
        content = <EventForm 
          matters={matterState.matters} users={coreState.users} appMode={appMode} eventTypes={coreState.eventTypes} onSave={(e) => dataHandlers.addItem('events', e, e.title)} onUpdateEvent={(e) => dataHandlers.updateItem('events', e, e.title)} onClose={closeModal} onNavigate={navigateTo} currentUser={currentUser!} eventToEdit={event} initialContext={modalContext?.fields || modalContext} 
          isCompact={true}
        />;
        break;
      }
      case 'newWorkflow':
      case 'editWorkflow': {
         const wf = executionState.workflows.find(w => w.id === editingId);
         content = <WorkflowForm 
          onAddWorkflow={(w) => dataHandlers.handleAddWorkflow(w)} 
          onUpdateWorkflow={dataHandlers.handleUpdateWorkflow} 
          onDelete={() => { /* Handle delete workflow */ }} 
          onClose={closeModal} 
          workflowToEdit={wf} 
          workflows={executionState.workflows} 
          context={modalContext} 
         />;
         break;
      }
      case 'newChecklistTemplate':
      case 'editChecklistTemplate': {
         const ct = coreState.checklistTemplates.find(t => t.id === editingId);
         content = <ChecklistTemplateForm 
          onAddTemplate={(t) => dataHandlers.addItem('checklistTemplates', t, t.name)} 
          onUpdateTemplate={(t) => dataHandlers.updateItem('checklistTemplates', t, t.name)} 
          onDelete={() => dataHandlers.deleteItem('checklistTemplates', editingId!, 'Checklist Template')} 
          onClose={closeModal} 
          templateToEdit={ct} 
          workflows={executionState.workflows} 
         />;
         break;
      }
      // ─── PROPERTY FORMS ───────────────────────────────────────────────
      case 'newProperty':
      case 'editProperty': {
        const contactId = selectedContactId || editingId || modalContext?.contactId;
        const contact = matterState.contacts.find(c => c.id === contactId);
        const propertyId = dockedModalType === 'editProperty' ? (editingId as string) : undefined;
        const propertyToEdit = coreState.properties.find(p => p.id === propertyId) || 
                   (contact?.properties || []).find(p => p.id === propertyId);

        if (contact) {
          content = <PropertyForm 
            contact={contact} 
            propertyToEdit={propertyToEdit} 
            activeUnitId={modalContext?.activeUnitId} 
            onSave={dataHandlers.onUpdateContactProperties} 
            onClose={closeModal}
            isCompact={true}
          />;
        } else {
          // Show contact selector first — property requires an owner
          content = (
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Select Owner</h3>
                  <p className="text-xs text-slate-500">Choose a contact to add or manage their properties.</p>
                </div>
                <button 
                  onClick={() => {
                    // Close docked, open newContact in docked with return context
                    closeModal();
                    openModal('newContact', null, { returnTo: 'newProperty', openedByAloa: true });
                  }}
                  className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-2xs font-black uppercase tracking-widest rounded-lg shadow-lg shadow-primary-500/20 transition-all flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                  New
                </button>
              </div>
              <div className="space-y-1.5 max-h-[65vh] overflow-y-auto custom-scrollbar pr-1">
                {matterState.contacts.length > 0 ? matterState.contacts.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedContactId(c.id)}
                    className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-zinc-700 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30/50 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 font-bold text-xs group-hover:bg-primary-100 group-hover:text-primary-600">
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-700 dark:text-zinc-300 group-hover:text-primary-700">{c.name}</p>
                        <p className="text-2xs text-slate-500">{c.category} &bull; {c.email || 'No email'}</p>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </button>
                )) : (
                  <div className="text-center py-12 bg-slate-50 dark:bg-zinc-900 rounded-lg border-2 border-dashed border-slate-200 dark:border-zinc-700">
                    <p className="text-slate-500 font-medium text-sm mb-4">No contacts found.</p>
                    <button 
                      onClick={() => {
                        closeModal();
                        openModal('newContact', null, { returnTo: 'newProperty', openedByAloa: true });
                      }}
                      className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white text-2xs font-black uppercase tracking-widest rounded-lg shadow-lg shadow-primary-500/30 transition-all inline-flex items-center gap-2"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
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
      case 'collectRent': {
        const propertyId = editingId;
        const property = coreState.properties.find(p => p.id === propertyId) || 
                matterState.contacts.flatMap(c => c.properties || []).find(p => p.id === propertyId);
        if (property) {
          content = <CollectRentModal property={property} onClose={closeModal} />;
        } else {
          content = (
            <div className="text-center p-10 flex flex-col items-center justify-center h-full">
              <p className="text-gray-500 mb-4">Property not found for rent collection.</p>
              <button onClick={() => closeModal()} className="px-4 py-2 bg-gray-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-lg">Close</button>
            </div>
          );
        }
        break;
      }
      // ─── INVOICE FORMS ────────────────────────────────────────────────
      case 'viewInvoice':
      case 'newInvoice':
      case 'editInvoice': {
        const invoice = (financeState.invoices || []).find(i => i.id === editingId);
        const clients = (matterState.contacts || []).filter(c => c.category === 'Client');
        const bankAccounts = coreState.firmDetails?.bankAccounts || [];
        content = <InvoiceForm 
          clients={clients} 
          matters={matterState.matters || []} 
          bankAccounts={bankAccounts} 
          invoiceToEdit={invoice} 
          onAddInvoice={(inv) => dataHandlers.addItem('invoices', inv, inv.invoiceNumber)} 
          onUpdateInvoice={(inv) => dataHandlers.updateItem('invoices', inv, inv.invoiceNumber)} 
          onClose={closeModal}
          isCompact={true}
        />;
        break;
      }
      // ─── FINANCIAL FORMS ──────────────────────────────────────────────
      case 'newTimeEntry':
      case 'editTimeEntry': {
        const entry = financeState.timeEntries.find(t => t.id === editingId);
        const matterId = editingId || modalContext;
        const matter = matterState.matters.find(m => m.id === (entry ? entry.matterId : matterId));
        if (matter) {
          content = <TimeEntryForm 
            matter={matter} 
            timeEntryToEdit={entry} 
            onAddTimeEntry={(t) => dataHandlers.addItem('timeEntries', t, 'Time Entry')} 
            onUpdateTimeEntry={(t) => dataHandlers.updateItem('timeEntries', t, 'Time Entry')} 
            onClose={closeModal} 
          />;
        } else {
          content = (
            <div className="text-center p-10 flex flex-col items-center justify-center h-full">
              <p className="text-gray-500 mb-4">Select a matter to log time against.</p>
              <button onClick={() => closeModal()} className="px-4 py-2 bg-gray-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-lg">Close</button>
            </div>
          );
        }
        break;
      }
      case 'newExpense':
      case 'editExpense': {
        const exp = financeState.expenses.find(e => e.id === editingId);
        const expMatterId = editingId || modalContext;
        const expMatter = matterState.matters.find(m => m.id === (exp ? exp.matterId : expMatterId));
        if (expMatter) {
          content = <ExpenseForm 
            matter={expMatter} 
            expenseToEdit={exp} 
            onAddExpense={(e) => dataHandlers.addItem('expenses', e, 'Expense')} 
            onUpdateExpense={(e) => dataHandlers.updateItem('expenses', e, 'Expense')} 
            onClose={closeModal} 
          />;
        } else {
          content = (
            <div className="text-center p-10 flex flex-col items-center justify-center h-full">
              <p className="text-gray-500 mb-4">Select a matter to record an expense.</p>
              <button onClick={() => closeModal()} className="px-4 py-2 bg-gray-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-lg">Close</button>
            </div>
          );
        }
        break;
      }
      // ─── NOTEBOOK FORMS ──────────────────────────────────────────────
      case 'newNotebook':
      case 'editNotebook': {
        const nb = coreState.noteNotebooks.find(n => n.id === editingId);
        content = <NotebookForm 
          notebookToEdit={nb} 
          onAdd={(n) => dataHandlers.addItem('noteNotebooks', n, n.name)} 
          onUpdate={(n) => dataHandlers.updateItem('noteNotebooks', n, n.name)} 
          onClose={closeModal} 
          currentUser={currentUser!} 
          appMode={appMode} 
        />;
        break;
      }
      // ─── SETTINGS FORMS ──────────────────────────────────────────────
      case 'editFirmDetails': {
        content = <FirmDetailsForm 
          firmDetails={coreState.firmDetails} 
          onUpdateFirmDetails={dataHandlers.handleUpdateFirmDetails} 
          onClose={closeModal} 
        />;
        break;
      }
      case 'newUser':
      case 'editUser': {
        const userToEdit = coreState.users.find(u => u.id === editingId);
        content = <UserForm 
          userToEdit={userToEdit} 
          onAddUser={(u) => dataHandlers.addItem('users', u, u.name)} 
          onUpdateUser={(u) => dataHandlers.handleUpdateUser(u.id, u)} 
          onClose={closeModal} 
        />;
        break;
      }
      case 'newBankAccount':
      case 'editBankAccount': {
        const bankAccounts = coreState.firmDetails?.bankAccounts || [];
        const account = bankAccounts.find(a => a.id === editingId);
        content = <BankAccountForm
          accountToEdit={account}
          onAddAccount={(a) => {
            const newAccounts = [...bankAccounts, { ...a, id: Date.now().toString(), isDefault: bankAccounts.length === 0 }];
            dataHandlers.handleUpdateFirmDetails({ ...coreState.firmDetails, bankAccounts: newAccounts });
            closeModal();
            navigateTo('settings', null, { settingsTargetId: 'firm-details' });
            setTimeout(() => {
              addToast(
                newAccounts.length === 1
                  ? "Bank account saved. You can add MULTIPLE accounts — e.g. an Operating account for general income, a Trust/Client account for funds held on behalf of clients, or a Rent Collection account for Atrium. Click 'Add Bank Account' again to set up another."
                  : `Bank account saved. You now have ${newAccounts.length} account${newAccounts.length === 1 ? '' : 's'}. Set a default for rent collections and invoice payments, or add more for different purposes (Trust, Operating, Service Charge).`,
                { type: 'success', duration: 8000 }
              );
            }, 400);
          }}
          onUpdateAccount={(a) => {
            const newAccounts = bankAccounts.map(acc => acc.id === a.id ? a : acc);
            dataHandlers.handleUpdateFirmDetails({ ...coreState.firmDetails, bankAccounts: newAccounts });
          }}
          onSetDefault={(id) => {
            const newAccounts = bankAccounts.map(acc => ({ ...acc, isDefault: acc.id === id }));
            dataHandlers.handleUpdateFirmDetails({ ...coreState.firmDetails, bankAccounts: newAccounts });
          }}
          onDelete={(id) => {
            const newAccounts = bankAccounts.filter(acc => acc.id !== id);
            dataHandlers.handleUpdateFirmDetails({ ...coreState.firmDetails, bankAccounts: newAccounts });
            closeModal();
          }}
          onClose={closeModal}
        />;
        break;
      }
      case 'feedback': {
        content = <FeedbackForm />;
        break;
      }
      // ─── EVENT DETAIL (mini calendar / calendar event click) ─────────
      case 'viewEvent': {
        let event: any = executionState.events.find((e: any) => e.id === editingId);

        // Handle recurring instances that aren't in the main array
        if (!event && editingId?.includes('_')) {
          const [originalId] = editingId.split('_');
          const originalEvent = executionState.events.find((e: any) => e.id === originalId);
          if (originalEvent && (originalEvent as any).recurrence) {
            const dateInstanceStr = modalContext?.instanceDate || editingId.split('_')[1];
            const instanceDate = new Date(dateInstanceStr);
            const endDateLimit = new Date(instanceDate);
            endDateLimit.setDate(endDateLimit.getDate() + 1);
            const instances = expandRecurringEvents([originalEvent], instanceDate, endDateLimit);
            event = instances.find((inst: any) => inst.id === editingId);
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
              setTimeout(() => openModal('editEvent', event.id, { ...modalContext, openedByAloa: true }), 100);
            }}
            onDelete={() => {
              closeModal();
              setTimeout(() => openModal('deleteConfirmation', null, {
                title: 'Delete Event?',
                message: "Are you sure you want to permanently delete this event?",
                onConfirm: () => {
                  dataHandlers.deleteItem('events', event.originalId || event.id, event.title);
                  closeModal();
                },
                confirmText: 'Delete Event',
                confirmButtonClass: 'bg-red-600 hover:bg-red-700'
              }), 100);
            }}
            onAssign={() => {
              closeModal();
              setTimeout(() => openModal('editEvent', event.id, { ...modalContext, openedByAloa: true }), 100);
            }}
            onNavigateToMatter={(mId: string) => {
              closeModal();
              setTimeout(() => {
                setHighlightTarget({ view: 'matterDetail', filter: { id: event.id }, color: 'blue' });
                navigateTo('matterDetail', mId, { initialTab: 'schedule_tasks' });
              }, 50);
            }}
            onNavigateToCalendar={(date: Date, eventId: string) => {
              setHighlightTarget({ view: 'calendar', filter: { id: eventId }, color: 'red' });
              closeModal();
              navigateTo('calendar', null, { date });
            }}
            openedFrom={modalContext?.openedFrom}
          />;
        } else {
          content = (
            <div className="text-center p-10 flex flex-col items-center justify-center h-full">
              <p className="text-gray-500 mb-4">Event not found.</p>
              <button onClick={() => closeModal()} className="px-4 py-2 bg-gray-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-lg">Close</button>
            </div>
          );
        }
        break;
      }
      // ─── MATTER LIFECYCLE ────────────────────────────────────────────
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
      case 'mergeContact': {
        const contact = matterState.contacts.find(c => c.id === editingId);
        if (contact) {
          content = <MergeContactModal sourceContact={contact} allContacts={matterState.contacts} onConfirm={dataHandlers.handleMergeContacts} onClose={closeModal} />;
        }
        break;
      }
      case 'linkContactToMatter': {
        const matter = matterState.matters.find(m => m.id === editingId);
        if (matter) content = <LinkContactModal matter={matter} allContacts={matterState.contacts} onSave={dataHandlers.handleLinkContactToMatter} onClose={closeModal} />;
        break;
      }
      case 'linkMatterToContact': {
        const contact = matterState.contacts.find(c => c.id === editingId);
        if (contact) {
          content = <LinkMatterToContactForm contact={contact} matters={matterState.matters} onSave={dataHandlers.handleLinkMatterToContact} onClose={closeModal} />;
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
      // ─── PROPERTY BULK EDIT ──────────────────────────────────────────
      case 'bulkEditProperty': {
        const propertyIds = modalContext?.propertyIds || [];
        content = (
          <BulkEditPropertyModal
            propertyIds={propertyIds}
            onClose={closeModal}
            onConfirm={(data) => {
              dataHandlers.handleBulkUpdateProperties(propertyIds, data);
            }}
          />
        );
        break;
      }
      // ─── DOCUMENT ACTIONS ────────────────────────────────────────────
      case 'batchUpload': {
        content = <BatchUploadModal files={modalContext?.files} context={modalContext} onClose={closeModal} />;
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
        const { document, version } = modalContext || {};
        if (document && version) content = <DocumentComparisonModal currentDocument={document} versionToCompare={version} onClose={closeModal} />;
        break;
      }
      // ─── MESSAGING ───────────────────────────────────────────────────
      case 'composeEmail': {
        content = <ComposeEmailModal onClose={closeModal} initialContext={modalContext} />;
        break;
      }
      case 'newChannel': {
        content = <NewChannelForm users={coreState.users} onCreateChannel={dataHandlers.handleCreateChannel} onClose={closeModal} />;
        break;
      }
      case 'newDirectMessage': {
        content = <NewDirectMessageForm users={coreState.users} onClose={closeModal} />;
        break;
      }
      // ─── NOTES ───────────────────────────────────────────────────────
      case 'newPage': {
        content = <NotePageForm onAdd={(p) => dataHandlers.addItem('notePages', p, p.title)} onClose={closeModal} initialContext={modalContext} />;
        break;
      }
      case 'saveToNote': {
        content = <SaveToNoteForm initialContent={modalContext?.content || ''} onClose={closeModal} />;
        break;
      }
      // ─── MATTER-SPECIFIC FORMS ───────────────────────────────────────
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
      // ─── PLAN UPGRADE ────────────────────────────────────────────────
      case 'upgradePlan': {
        content = <UpgradeModal
          featureName={modalContext?.featureName}
          targetPlan={modalContext?.targetPlan}
          onUpgrade={() => { closeModal(); navigateTo('settings', null, { settingsTargetId: 'subscription-management' }); }}
          onClose={closeModal}
        />;
        break;
      }
      default:
        content = (
          <div className="text-center p-10 flex flex-col items-center justify-center h-full">
             <p className="text-gray-500 mb-4">This form type ({dockedModalType}) is not yet supported in the docked panel.</p>
             <button onClick={() => closeModal()} className="px-4 py-2 bg-gray-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-lg">Close</button>
          </div>
        );
    }
  }

  // Always render as side drawer when there's a docked modal type
  if (dockedModalType) {
    return (
      <>
        <div 
          className={`fixed inset-0 bg-black/20 sm:backdrop-blur-sm z-[2100] transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
          onClick={() => closeModal()}
        />
        <div
          className={`
            fixed top-0 right-0 h-full w-[480px] max-w-[90vw] z-[2101] flex flex-col 
            bg-white dark:bg-zinc-900/95 sm:backdrop-blur-xl shadow-2xl 
            border-l border-slate-200 dark:border-zinc-700 
            transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
            ${isVisible ? 'translate-x-0' : 'translate-x-full'}
          `}
        >
          <header className="flex-shrink-0 flex justify-between items-center px-4 sm:px-6 h-14 sm:h-16 border-b border-slate-200 dark:border-zinc-700/50 bg-slate-50 dark:bg-zinc-900/80">
            <div className="text-base font-bold text-slate-800 dark:text-zinc-100 truncate max-w-xs min-w-0">{title}</div>
            <button onClick={() => closeModal()} className="active-press touch-target p-2 rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors flex-shrink-0">
              <DismissIcon className="w-5 h-5" />
            </button>
          </header>
          <main className="flex-grow overflow-y-auto custom-scrollbar overscroll-contain relative">
            {content}
          </main>
        </div>
      </>
    );
  }

  return null;
};
