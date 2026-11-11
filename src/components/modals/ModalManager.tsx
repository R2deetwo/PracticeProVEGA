import React, { Suspense } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Modal } from './Modal';
import { resolveAuthThemeId, AUTH_THEMES } from '../auth/authTheme';
import { useUI } from '../../contexts/UIContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useFinanceState } from '../../contexts/FinanceContext';
import { useExecutionState } from '../../contexts/ExecutionContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useIsProperty, useTerminology, useProduct } from '../../contexts/ProductContext';
import { ModalType, FileDetails, CalendarEvent } from '../../types';
import { lazyWithReload } from '../../utils/lazyWithReload';
import { expandRecurringEvents, parseDateString, computeAtriumVirtualEvents } from '../../utils/calendarUtils';

// ── V7 (A: ModalManager form imports) ────────────────────────────────────
// Every modal/form below is now a LAZY component. ModalManager used to
// statically import all ~50 of them, which dragged the entire forms
// cluster — and through SaveToNoteForm the whole geminiService AI stack
// (91 kB) plus jurisdictionConfig (91 kB) — into the EAGER entry chunk
// that every visitor downloads before a single pixel paints. Modals open
// on user interaction, never on first paint, so they load on demand.
// The switch-case wiring below is unchanged: same components, same props.
// <Suspense fallback={<ModalSkeleton/>}> at the single render point shows
// a loading skeleton inside the modal frame while a chunk streams in.

// Auth
const Login = lazyWithReload(() => import('../auth/Login'));
const Signup = lazyWithReload(() => import('../auth/Signup'));

// Forms
const DocumentForm = lazyWithReload(() => import('../forms/DocumentForm').then(m => ({ default: m.DocumentForm })));
const EventForm = lazyWithReload(() => import('../forms/EventForm').then(m => ({ default: m.EventForm })));
const InvoiceForm = lazyWithReload(() => import('../forms/InvoiceForm').then(m => ({ default: m.InvoiceForm })));
const InvoiceGeneratorForm = lazyWithReload(() => import('../forms/InvoiceGeneratorForm').then(m => ({ default: m.InvoiceGeneratorForm })));
const UserForm = lazyWithReload(() => import('../forms/UserForm'));
const TimeEntryForm = lazyWithReload(() => import('../forms/TimeEntryForm'));
const ExpenseForm = lazyWithReload(() => import('../forms/ExpenseForm'));
const BankAccountForm = lazyWithReload(() => import('../forms/BankAccountForm'));
const WorkflowForm = lazyWithReload(() => import('../forms/WorkflowForm'));
const EventTypeForm = lazyWithReload(() => import('../forms/EventTypeForm'));
const ContactCategoryForm = lazyWithReload(() => import('../forms/ContactCategoryForm'));
const DocumentCategoryForm = lazyWithReload(() => import('../forms/DocumentCategoryForm'));
const ChecklistTemplateForm = lazyWithReload(() => import('../forms/ChecklistTemplateForm'));
const FirmDetailsForm = lazyWithReload(() => import('../forms/FirmDetailsForm'));
const TemplateForm = lazyWithReload(() => import('../forms/TemplateForm'));
const TemplateCategoryForm = lazyWithReload(() => import('../forms/TemplateCategoryForm'));
const FeedbackForm = lazyWithReload(() => import('../forms/FeedbackForm'));
const RequestFinancialDocumentForm = lazyWithReload(() => import('../forms/RequestFinancialDocumentForm'));
const NewChannelForm = lazyWithReload(() => import('../forms/NewChannelForm'));
const NewDirectMessageForm = lazyWithReload(() => import('../forms/NewDirectMessageForm'));
const AssignUsersForm = lazyWithReload(() => import('../forms/AssignUsersForm'));
const ExternalCounselInviteForm = lazyWithReload(() => import('../forms/ExternalCounselInviteForm'));
const StageChecklistForm = lazyWithReload(() => import('../forms/StageChecklistForm').then(m => ({ default: m.StageChecklistForm })));
const NewResearchNotebookForm = lazyWithReload(() => import('../forms/NewResearchNotebookForm'));
const CollectRentModal = lazyWithReload(() => import('./CollectRentModal'));
const NotebookForm = lazyWithReload(() => import('../forms/NotebookForm'));
const SaveToNoteForm = lazyWithReload(() => import('../forms/SaveToNoteForm').then(m => ({ default: m.SaveToNoteForm })));
const LinkMatterToContactForm = lazyWithReload(() => import('../forms/LinkMatterToContactForm').then(m => ({ default: m.LinkMatterToContactForm })));
const NotePageForm = lazyWithReload(() => import('../forms/NotePageForm'));
const BatchUploadModal = lazyWithReload(() => import('./BatchUploadModal'));
const JoinFirmModal = lazyWithReload(() => import('./JoinFirmModal'));
const MatterIngestionWizard = lazyWithReload(() => import('./MatterIngestionWizard'));
const BulkEditPropertyModal = lazyWithReload(() => import('./BulkEditPropertyModal').then(m => ({ default: m.BulkEditPropertyModal })));

// Modals
const DemoUpsellModal = lazyWithReload(() => import('./DemoUpsellModal'));
const ConfirmationModal = lazyWithReload(() => import('./DeleteConfirmationModal'));
const ShareDocumentModal = lazyWithReload(() => import('./ShareDocumentModal').then(m => ({ default: m.ShareDocumentModal })));
const SignDocumentModal = lazyWithReload(() => import('./SignDocumentModal').then(m => ({ default: m.SignDocumentModal })));
const DocumentComparisonModal = lazyWithReload(() => import('./DocumentComparisonModal').then(m => ({ default: m.DocumentComparisonModal })));
const ComposeEmailModal = lazyWithReload(() => import('./ComposeEmailModal'));
// GoogleDrivePickerModal import removed — not yet implemented
const NoTeamMembersModal = lazyWithReload(() => import('./NoTeamMembersModal'));
const AloaHelpModal = lazyWithReload(() => import('./AloaHelpModal'));
const LinkContactModal = lazyWithReload(() => import('./LinkContactModal'));
const AddResearchSourceModal = lazyWithReload(() => import('./AddResearchSourceModal'));
const AddCaseToNotebookModal = lazyWithReload(() => import('./AddCaseToNotebookModal'));
const KeyboardShortcutsModal = lazyWithReload(() => import('./KeyboardShortcutsModal'));
const QuickLookModal = lazyWithReload(() => import('./QuickLookModal'));
const PaymentGatewayModal = lazyWithReload(() => import('./PaymentGatewayModal'));
const UpgradeModal = lazyWithReload(() => import('./UpgradeModal'));
const EventDetailModal = lazyWithReload(() => import('../details/EventDetailModal').then(m => ({ default: m.EventDetailModal })));
const LeadCaptureModal = lazyWithReload(() => import('./LeadCaptureModal'));
const WorkspaceSetupModal = lazyWithReload(() => import('./WorkspaceSetupModal'));
const SendPostActivationEmailModal = lazyWithReload(() => import('./SendPostActivationEmailModal'));
// V4 (V-DOC-15): FolderPermissionsModal removed — it presented per-folder
// role restrictions that nothing ever enforced. Folder access stays
// firm-scoped (what the product actually does).
const AIConsentModal = lazyWithReload(() => import('./AIConsentModal'));

// Wrapper that gives AIConsentModal access to React hooks (recordConsent mutation)
const AIConsentModalWrapper: React.FC<{ modalContext: any; closeModal: () => void }> = ({ modalContext, closeModal }) => {
  const recordConsent = useMutation(api.myFunctions.recordConsent);
  const { currentUser, bearerToken } = useAuth();

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

const ModalManager: React.FC = () => {
  const { modal, closeModal, modalContext, editingId, getModalTitle, navigateTo, setHighlightTarget, openModal, updateCurrentHistoryEntry, addToast } = useUI();
  const { matterState } = useMatterState();
  const { financeState } = useFinanceState();
  const { executionState, executionActions } = useExecutionState();
  const { documentState } = useDocumentState();
  const { coreState, isDataLoaded } = useCoreState();
  const dataHandlers = useDataActions();
  const { currentUser, appMode, bearerToken } = useAuth();
  const isProperty = useIsProperty();
  // Calendar round: virtual events render for every property-featured product
  // (Atrium AND Komplete/unified) — the modal resolution must match that gate,
  // not the Atrium-only isProperty flag.
  const { hasPropertyFeatures } = useProduct();
  const terminology = useTerminology();
  // TASK 64 — dedicated, field-scoped bank-account writer (see convex
  // manageBankAccount). Replaces the full-firmDetails updateItem spread that
  // lost bankAccounts to concurrent-writer races and toasted success
  // unconditionally even when the save failed.
  const manageBankAccountMutation = useMutation(api.myFunctions.manageBankAccount);

  // TASK 64 — shared, HONEST bank-account save flow: awaits the mutation and
  // only celebrates when the server actually persisted the account. Copy is
  // product-neutral (no cross-product "Atrium" references in VEGA).
  const handleBankAccountOp = async (
    op: 'add' | 'update' | 'setDefault' | 'delete',
    account: any,
    opts?: { stayOpen?: boolean }
  ): Promise<boolean> => {
    try {
      const res = await manageBankAccountMutation({
        op,
        account,
        userEmail: currentUser?.email,
        sessionToken: (bearerToken ?? undefined),
      });
      if (op === 'add') {
        addToast(
          res.count === 1
            ? 'Bank account saved. You can add MULTIPLE accounts — e.g. an Operating account for general income, and a Trust/Client account for funds held on behalf of clients. Use “Add Bank Account” again to set up another.'
            : `Bank account saved — you now have ${res.count} accounts. Set a default for invoice payments and collections, or add more for different purposes (Trust, Operating).`,
          { type: 'success', duration: 8000 }
        );
      } else if (op === 'delete') {
        addToast('Bank account removed.', { type: 'success' });
      } else if (op === 'setDefault') {
        addToast('Default account updated.', { type: 'success' });
      }
      if (!opts?.stayOpen) closeModal();
      return true;
    } catch (e: any) {
      console.error('[ModalManager] manageBankAccount failed:', e);
      addToast(
        e?.message?.includes('required')
          ? e.message
          : 'Could not save the bank account — nothing was lost. Please try again in a moment.',
        { type: 'error', duration: 6000 }
      );
      return false;
    }
  };

  if (!modal) return null;

  // ─── OVERLAY SYSTEM MIGRATION (Aug 2026) ────────────────────────────
  // The new ModalLayer (src/overlays/layers/ModalLayer.tsx) is scaffolded
  // but NOT YET active — MIGRATED_MODALS is empty in ModalLayer, so it
  // returns null for all modals. ModalManager handles everything.
  //
  // To migrate a modal:
  //   1. Add its entry to modalRegistry.tsx (done for all 70+ types)
  //   2. Add the modal type to MIGRATED_MODALS in ModalLayer.tsx
  //   3. Add the modal type to MODAL_LAYER_HANDLED here (so this manager skips it)
  //   4. Verify the component receives all props it needs from ModalLayer's
  //      generic prop pass-through (closeModal, editingId, modalContext, etc.)
  //
  // Currently NO modals are migrated — ModalManager handles all of them.
  // BATCH 1 MIGRATED (2026-09-08): task create/edit/detail + property
  // create/edit now render through ModalLayer + ModalShell (the shared
  // overlay system). Their switch cases were REMOVED below — do not
  // re-add them; update MIGRATED_CONTENT_BUILDERS in ModalLayer.tsx
  // if their prop wiring needs to change.
  const MODAL_LAYER_HANDLED = new Set<string>([
    'newTask',
    'editTask',
    'viewTask',
    'newProperty',
    'editProperty',
    // BATCH 2 (2026-09-08): Matters & Contacts cluster — newMatter,
    // editMatter, closeMatter, archiveMatter, newContact, editContact,
    // mergeContact now render through ModalLayer + ModalShell.
    'newMatter',
    'editMatter',
    'closeMatter',
    'archiveMatter',
    'newContact',
    'editContact',
    'mergeContact',
  ]);

  if (MODAL_LAYER_HANDLED.has(modal)) {
    return null;
  }

  let content = null;

  // R27 product-themed auth surfaces: resolve once, before the switch —
  // the theme decides the modal chrome (hideHeader + overlay/card/bar
  // overrides) AND is re-threaded through the login↔signup switch so the
  // user never falls back to the generic modal mid-funnel. The switch
  // also seeds selectedProduct from the resolved theme, so a user who
  // opened LOGIN on /vega and then taps "switch to signup" lands on the
  // Vega form (not the chooser) — the page they came from decides.
  const authThemeId = (modal === 'login' || modal === 'signup')
    ? resolveAuthThemeId(modalContext)
    : null;
  const authSwitchContext = () => {
    if (!modalContext) return { productTheme: 'hub' as const };
    const merged: Record<string, unknown> = { ...modalContext };
    if (authThemeId === 'vega' && merged.selectedProduct == null) merged.selectedProduct = 'legal';
    if (authThemeId === 'atrium' && merged.selectedProduct == null) merged.selectedProduct = 'property';
    return merged;
  };

  switch (modal) {
    case 'login':
      content = <Login onSwitchToSignup={() => { closeModal(); setTimeout(() => openModal('signup', null, authSwitchContext()), 10); }} forClient={modalContext?.forClient} />;
      break;
    case 'signup':
      content = <Signup onSwitchToLogin={() => { closeModal(); setTimeout(() => openModal('login', null, authSwitchContext()), 10); }} />;
      break;
    case 'collectRent': {
      const propertyId = editingId;
      const property = coreState.properties.find(p => p.id === propertyId) || 
              matterState.contacts.flatMap(c => c.properties || []).find(p => p.id === propertyId);
      if (property) {
        content = <CollectRentModal property={property} onClose={closeModal} />;
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
    case 'newDocument':
    case 'editDocument':
    case 'newDraft': {
      // V4 (V-DOC-4): a DraftPro save for an EXISTING vault document
      // (session draft:doc:<id>) passes ctx.documentId — the save then
      // UPDATES that document (versioned) instead of silently creating a
      // duplicate vault record.
      const doc = documentState.documents.find(d => d.id === editingId || (modalContext?.documentId && d.id === modalContext.documentId));
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
    // V4 (V-DOC-15): the folderPermissions case is REMOVED — the modal
    // presented per-folder role restrictions that nothing ever enforced
    // (no read path filters by them, no server concept exists). The
    // misleading control is gone; folder access stays firm-scoped, which
    // is what the product actually does.
    case 'assignUsers': {
      // V3 (V-MATTER-15): the bulk context actually works now. The matter
      // list's Assign button passes { matterIds } — the old handler read
      // only modalContext.item (always undefined here), rendered nothing,
      // and the button did NOTHING at all. Bulk goes through the validated
      // server mutation; single-item keeps the per-item patch path.
      const item = modalContext?.item;
      const itemType = modalContext?.itemType || 'Matter';
      const itemTitle = modalContext?.itemTitle || 'Item';
      const bulkMatterIds: string[] = Array.isArray(modalContext?.matterIds) ? modalContext.matterIds : [];
      if (bulkMatterIds.length > 0) {
        const bulkMatters = matterState.matters.filter(m => bulkMatterIds.includes(m.id));
        const handleBulkAssign = async (_itemId: string, userIds: string[]) => {
          try {
            await dataHandlers.handleBulkAssignMatters(bulkMatterIds, userIds);
            closeModal();
          } catch { /* toast already shown; keep open */ }
        };
        content = <AssignUsersForm item={{ id: 'bulk', assignedUsers: [] }} itemType="Matter" itemTitle={`${bulkMatterIds.length} matters`} users={coreState.users} onUpdate={handleBulkAssign} onClose={closeModal} bulkMatterTitles={bulkMatters.map(m => m.title)} />;
      } else if (item) {
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

      // BUG FIX (calendar round): virtual Atrium auto-events (lease expiry /
      // warning / midpoint / maintenance / recurring rent-due) are generated
      // at render time and are NOT in executionState.events — clicking one on
      // the calendar used to fall through to the '_'-split branch below (every
      // virtual id contains underscores), find nothing, and open a BLANK
      // modal. Resolve them from the live property data instead.
      if (!event && hasPropertyFeatures && typeof editingId === 'string' && editingId.startsWith('virtual_')) {
        const virtuals = computeAtriumVirtualEvents(coreState.properties || []);
        event = virtuals.find(v => v.id === editingId) as CalendarEvent | undefined;
        if (!event) {
          // Recurring rent-due instance: `${virtual_rentdue_${propId}_${unitId}}_${localDate}`
          // — the original id itself contains underscores, so match by prefix.
          const original = virtuals.find(v => v.recurrence && editingId.startsWith(`${v.id}_`));
          if (original) {
            const dateInstanceStr = modalContext?.instanceDate || editingId.slice(original.id.length + 1);
            const instanceDate = parseDateString(dateInstanceStr);
            const endDateLimit = new Date(instanceDate);
            endDateLimit.setDate(endDateLimit.getDate() + 1);
            const instances = expandRecurringEvents([original], instanceDate, endDateLimit);
            event = instances.find(inst => inst.id === editingId) as CalendarEvent | undefined;
          }
        }
      }

      // Handle recurring instances that aren't in the main array
      if (!event && editingId?.includes('_')) {
        const [originalId] = editingId.split('_');
        const originalEvent = executionState.events.find(e => e.id === originalId);

        if (originalEvent && originalEvent.recurrence) {
          // Re-expand to find this specific instance. We use the date from context if available, 
          // or parse it from the synthetic ID.
          // BUG FIX (calendar round): this used `new Date(dateInstanceStr)`, which parses
          // 'YYYY-MM-DD' as UTC midnight — east of UTC (Lagos +1) the window start
          // landed at 01:00 local, the fast-forward skipped the day's early
          // instances, and the modal opened blank. parseDateString parses the
          // date-only form as LOCAL midnight (same rule as getEventsForDay).
          const dateInstanceStr = modalContext?.instanceDate || editingId.split('_')[1];
          const instanceDate = parseDateString(dateInstanceStr);
          const endDateLimit = new Date(instanceDate);
          endDateLimit.setDate(endDateLimit.getDate() + 1);

          const instances = expandRecurringEvents([originalEvent], instanceDate, endDateLimit);
          event = instances.find(inst => inst.id === editingId);
        }
      }

      if (event && currentUser) {
        // Auto-generated lease/rent events are read-only views over property
        // data — Edit/Delete would write phantom rows to the events table.
        const isVirtualEvent = (event as any).source === 'atrium_auto';
        content = <EventDetailModal
          event={event}
          readOnly={isVirtualEvent}
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
      content = <PaymentGatewayModal
        amount={modalContext.amount}
        email={currentUser?.email || ''}
        title={modalContext.title}
        description={modalContext.description}
        invoiceId={modalContext.invoiceId}
        // CRO AUDIT Track A — pass through subscription context + forcePracticeProAccount
        forcePracticeProAccount={modalContext.forcePracticeProAccount ?? false}
        subscriptionContext={modalContext.subscriptionContext}
        onPaymentReport={modalContext.onPaymentReport}
        bankDetailsOverride={modalContext.bankDetailsOverride}
        onSuccess={modalContext.onConfirm}
        onClose={closeModal}
      />;
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
      content = <BankAccountForm accountToEdit={account}
        onAddAccount={async (a) => {
          // TASK 64: dedicated mutation — the old path spread the entire
          // firmDetails through updateItem and toasted success on a
          // setTimeout regardless of the result ("account did not save").
          const ok = await handleBankAccountOp('add', a);
          if (ok) {
            // Navigate to the firm settings page so the user sees their saved
            // bank account in context, alongside other firm configuration.
            navigateTo('settings', null, { settingsTargetId: 'firm-details' });
          }
        }}
        onUpdateAccount={async (a) => { await handleBankAccountOp('update', a); }}
        onSetDefault={async (id) => { await handleBankAccountOp('setDefault', { id }); }}
        onDelete={async (id) => { await handleBankAccountOp('delete', { id }); }}
        onClose={closeModal} />;
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
      // R74: modalContext carries the presence-stack hand-offs — a
      // preselected recipient (click-a-teammate DM) or group mode with
      // members preselected (tick-several group message).
      content = <NewDirectMessageForm users={coreState.users} onClose={closeModal} initialContext={modalContext} />;
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
  // Product-aware title: 'Link Matter to Contact' → 'Link Property to Contact' for Atrium
  if (modal === 'linkMatterToContact') {
    modalTitle = `Link ${terminology.matter} to ${terminology.client}`;
  }
  // Product-aware title: 'ARIA Help' → 'ALOA Help' for Vega/Komplete
  if (modal === 'aloaHelp') {
    modalTitle = 'AI Assistant Help';
  }
  // Missing titles in getModalTitle switch
  if (modal === 'workspaceSetup') {
    modalTitle = 'Workspace Setup';
  }
  if (modal === 'demoUpsell') {
    // R47: the product speaks its own name — the company stays in the
    // built-by credit, not the upsell title.
    modalTitle = isProperty ? 'Upgrade to Atrium' : 'Upgrade to Vega';
  }

  // Size mapping based on form complexity:
  //  lg → multi-section forms (contacts, properties, invoices, events, matters, matter ingest, email)
  //  md → default (documents, tasks, most forms)
  //  sm → simple confirmations and tiny forms
  const lgModals = ['matterIngestion', 'editMatter', 'newMatter', 'composeEmail',
           'newContact', 'editContact', 'newProperty', 'editProperty',
           'newInvoice', 'editInvoice', 'viewInvoice', 'generateInvoice',
           'newEvent', 'editEvent', 'bulkEditProperty'];
  const smModals = ['leadCapture', 'deleteConfirmation', 'aiConsent', 'keyboardShortcuts',
           'noTeamMembers', 'aloaHelp', 'upgradePlan', 'sendIntakeLink',
           'sendPostActivationEmail', 'newPage', 'newNotebook', 'newResearchNotebook',
           'addResearchSource', 'addCaseToNotebook', 'mergeContact', 'linkContact',
           'linkContactToMatter', 'linkMatterToContact', 'closeMatter', 'archiveMatter',
           'workspaceSetup', 'joinFirm', 'folderPermissions', 'signDocument',
           'demoUpsell', 'googleDrivePicker'];
  const modalSize = lgModals.includes(modal) ? 'lg'
    : smModals.includes(modal) ? 'sm'
    : 'md';

  return (
    <Modal
      isOpen={!!modal}
      onClose={() => closeModal()}
      title={modalTitle}
      size={modalSize}
      hideHeader={modal === 'deleteConfirmation' || !!(authThemeId && authThemeId !== 'hub')}
      {...(authThemeId && authThemeId !== 'hub' && AUTH_THEMES[authThemeId].chrome ? {
        overlayClass: AUTH_THEMES[authThemeId].chrome!.overlayClass,
        cardClass: AUTH_THEMES[authThemeId].chrome!.cardClass,
        accentBarClass: AUTH_THEMES[authThemeId].chrome!.accentBarClass,
      } : {})}
    >
      {/* V7: modal contents are lazy chunks — the frame (title, chrome,
          close button, Esc handling) renders immediately; this skeleton is
          the in-frame loading state while the form's chunk streams in. */}
      <Suspense fallback={<ModalSkeleton />}>
        {content}
      </Suspense>
    </Modal>
  );
};

// V7: loading state for lazy modal contents. Matches the modal body
// rhythm (three shimming rows) using existing design tokens — no new
// visual language. Announced politely to screen readers.
const ModalSkeleton: React.FC = () => (
  <div className="py-8 space-y-3" role="status" aria-live="polite" aria-label="Loading…">
    <div className="h-4 rounded bg-black/5 dark:bg-white/5 animate-pulse w-3/4" />
    <div className="h-4 rounded bg-black/5 dark:bg-white/5 animate-pulse w-1/2" />
    <div className="h-4 rounded bg-black/5 dark:bg-white/5 animate-pulse w-2/3" />
  </div>
);

export default ModalManager;
