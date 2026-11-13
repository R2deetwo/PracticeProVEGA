/**
 * ModalLayer — Renders the active modal based on the modalRegistry.
 *
 * UX-01 (modal architecture): THE modal render path. The legacy
 * ModalManager.tsx + Modal.tsx pair is deleted — every modal now flows
 * through this layer and the ModalShell primitive, so one logical
 * surface gets the same chrome, Esc behaviour, animation and stacking
 * (Z_TIERS.modal) regardless of which pipeline would have caught it
 * before. The audit's path-dependent layering bugs (registry modals
 * under the bottom nav; the terms-bar fix holding only for legacy
 * modals) are structurally impossible now.
 *
 * Content wiring: modals that need rich props (data handlers, state
 * slices, callbacks) get explicit cases in buildMigratedContent —
 * copied 1:1 from the former ModalManager switch, verbatim, including
 * the edge-case fixes documented inline. Modals whose components take
 * only the common props (closeModal/editingId/modalContext…) render
 * through the generic pass-through below.
 *
 * To add a modal: ONE entry in modalRegistry.tsx (+ a builder here only
 * if it needs rich props). Heavy components stay lazyWithReload so the
 * entry bundle never pays for forms the user never opens.
 */
import React, { Suspense } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useUI } from '../../contexts/UIContext';
import { useTerminology, useIsProperty, useProduct } from '../../contexts/ProductContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useFinanceState } from '../../contexts/FinanceContext';
import { useExecutionState } from '../../contexts/ExecutionContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useDataActions } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { SubscriptionPlan, FileDetails, CalendarEvent } from '../../types';
import { MODAL_REGISTRY } from '../registry/modalRegistry';
import { ModalShell } from '../primitives/ModalShell';
import { resolveAuthThemeId, AUTH_THEMES } from '../../components/auth/authTheme';
import { lazyWithReload } from '../../utils/lazyWithReload';
import { expandRecurringEvents, parseDateString, computeAtriumVirtualEvents } from '../../utils/calendarUtils';
import { Skeleton } from '../../components/ui/Skeleton';

// ── Lazy-loaded modal components (kept lazy: the entry bundle never pays
//    for forms the user hasn't opened — the V7 payload discipline) ─────────
const Login = lazyWithReload(() => import('../../components/auth/Login'));
const Signup = lazyWithReload(() => import('../../components/auth/Signup'));

// Forms
const DocumentForm = lazyWithReload(() => import('../../components/forms/DocumentForm').then(m => ({ default: m.DocumentForm })));
const EventForm = lazyWithReload(() => import('../../components/forms/EventForm').then(m => ({ default: m.EventForm })));
const InvoiceForm = lazyWithReload(() => import('../../components/forms/InvoiceForm').then(m => ({ default: m.InvoiceForm })));
const InvoiceGeneratorForm = lazyWithReload(() => import('../../components/forms/InvoiceGeneratorForm').then(m => ({ default: m.InvoiceGeneratorForm })));
const UserForm = lazyWithReload(() => import('../../components/forms/UserForm'));
const TimeEntryForm = lazyWithReload(() => import('../../components/forms/TimeEntryForm'));
const ExpenseForm = lazyWithReload(() => import('../../components/forms/ExpenseForm'));
const BankAccountForm = lazyWithReload(() => import('../../components/forms/BankAccountForm'));
const WorkflowForm = lazyWithReload(() => import('../../components/forms/WorkflowForm'));
const EventTypeForm = lazyWithReload(() => import('../../components/forms/EventTypeForm'));
const ContactCategoryForm = lazyWithReload(() => import('../../components/forms/ContactCategoryForm'));
const DocumentCategoryForm = lazyWithReload(() => import('../../components/forms/DocumentCategoryForm'));
const ChecklistTemplateForm = lazyWithReload(() => import('../../components/forms/ChecklistTemplateForm'));
const FirmDetailsForm = lazyWithReload(() => import('../../components/forms/FirmDetailsForm'));
const TemplateForm = lazyWithReload(() => import('../../components/forms/TemplateForm'));
const TemplateCategoryForm = lazyWithReload(() => import('../../components/forms/TemplateCategoryForm'));
const FeedbackForm = lazyWithReload(() => import('../../components/forms/FeedbackForm'));
const RequestFinancialDocumentForm = lazyWithReload(() => import('../../components/forms/RequestFinancialDocumentForm'));
const NewChannelForm = lazyWithReload(() => import('../../components/forms/NewChannelForm'));
const NewDirectMessageForm = lazyWithReload(() => import('../../components/forms/NewDirectMessageForm'));
const AssignUsersForm = lazyWithReload(() => import('../../components/forms/AssignUsersForm'));
const ExternalCounselInviteForm = lazyWithReload(() => import('../../components/forms/ExternalCounselInviteForm'));
const StageChecklistForm = lazyWithReload(() => import('../../components/forms/StageChecklistForm').then(m => ({ default: m.StageChecklistForm })));
const NewResearchNotebookForm = lazyWithReload(() => import('../../components/forms/NewResearchNotebookForm'));
const NotebookForm = lazyWithReload(() => import('../../components/forms/NotebookForm'));
const SaveToNoteForm = lazyWithReload(() => import('../../components/forms/SaveToNoteForm').then(m => ({ default: m.SaveToNoteForm })));
const LinkMatterToContactForm = lazyWithReload(() => import('../../components/forms/LinkMatterToContactForm').then(m => ({ default: m.LinkMatterToContactForm })));
const NotePageForm = lazyWithReload(() => import('../../components/forms/NotePageForm'));
const MatterForm = lazyWithReload(() => import('../../components/forms/MatterForm').then(m => ({ default: m.MatterForm })));
const SmartMatterModal = lazyWithReload(() => import('../../components/forms/SmartMatterModal').then(m => ({ default: m.SmartMatterModal })));
const ContactForm = lazyWithReload(() => import('../../components/forms/ContactForm'));
const PropertyForm = lazyWithReload(() => import('../../components/forms/PropertyForm').then(m => ({ default: m.default })));
const TaskForm = lazyWithReload(() => import('../../components/forms/TaskForm'));

// Modals
const DemoUpsellModal = lazyWithReload(() => import('../../components/modals/DemoUpsellModal'));
const ArchiveMatterModal = lazyWithReload(() => import('../../components/modals/ArchiveMatterModal'));
const CloseMatterModal = lazyWithReload(() => import('../../components/modals/CloseMatterModal'));
const ConfirmationModal = lazyWithReload(() => import('../../components/modals/DeleteConfirmationModal'));
const ShareDocumentModal = lazyWithReload(() => import('../../components/modals/ShareDocumentModal').then(m => ({ default: m.ShareDocumentModal })));
const SignDocumentModal = lazyWithReload(() => import('../../components/modals/SignDocumentModal').then(m => ({ default: m.SignDocumentModal })));
const DocumentComparisonModal = lazyWithReload(() => import('../../components/modals/DocumentComparisonModal').then(m => ({ default: m.DocumentComparisonModal })));
const ComposeEmailModal = lazyWithReload(() => import('../../components/modals/ComposeEmailModal'));
const NoTeamMembersModal = lazyWithReload(() => import('../../components/modals/NoTeamMembersModal'));
const AloaHelpModal = lazyWithReload(() => import('../../components/modals/AloaHelpModal'));
const LinkContactModal = lazyWithReload(() => import('../../components/modals/LinkContactModal'));
const AddResearchSourceModal = lazyWithReload(() => import('../../components/modals/AddResearchSourceModal'));
const AddCaseToNotebookModal = lazyWithReload(() => import('../../components/modals/AddCaseToNotebookModal'));
const KeyboardShortcutsModal = lazyWithReload(() => import('../../components/modals/KeyboardShortcutsModal'));
const QuickLookModal = lazyWithReload(() => import('../../components/modals/QuickLookModal'));
const PaymentGatewayModal = lazyWithReload(() => import('../../components/modals/PaymentGatewayModal'));
const UpgradeModal = lazyWithReload(() => import('../../components/modals/UpgradeModal'));
const TaskDetailModal = lazyWithReload(() => import('../../components/modals/TaskDetailModal').then(m => ({ default: m.default })));
const EventDetailModal = lazyWithReload(() => import('../../components/details/EventDetailModal').then(m => ({ default: m.EventDetailModal })));
const LeadCaptureModal = lazyWithReload(() => import('../../components/modals/LeadCaptureModal'));
const WorkspaceSetupModal = lazyWithReload(() => import('../../components/modals/WorkspaceSetupModal'));
const SendPostActivationEmailModal = lazyWithReload(() => import('../../components/modals/SendPostActivationEmailModal'));
const JoinFirmModal = lazyWithReload(() => import('../../components/modals/JoinFirmModal'));
const MatterIngestionWizard = lazyWithReload(() => import('../../components/modals/MatterIngestionWizard'));
const BulkEditPropertyModal = lazyWithReload(() => import('../../components/modals/BulkEditPropertyModal').then(m => ({ default: m.BulkEditPropertyModal })));
const CollectRentModal = lazyWithReload(() => import('../../components/modals/CollectRentModal'));
const BatchUploadModal = lazyWithReload(() => import('../../components/modals/BatchUploadModal'));
const MergeContactModal = lazyWithReload(() => import('../../components/modals/MergeContactModal'));
const PropertyOwnerPicker = lazyWithReload(() => import('../../components/modals/PropertyOwnerPicker').then(m => ({ default: m.PropertyOwnerPicker })));
const AIConsentModal = lazyWithReload(() => import('../../components/modals/AIConsentModal'));

// Loading skeleton shown while lazy modal components stream in — matches
// the modal body rhythm using design tokens, announced to screen readers.
const ModalSkeleton: React.FC = () => (
  <div className="py-8 space-y-3" role="status" aria-live="polite" aria-label="Loading…">
    <Skeleton variant="text" className="h-4 w-3/4" />
    <Skeleton variant="text" className="h-4 w-1/2" />
    <Skeleton variant="text" className="h-4 w-2/3" />
  </div>
);

// Wrapper that gives AIConsentModal access to React hooks (recordConsent
// mutation) — ported verbatim from the former ModalManager.
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

export const ModalLayer: React.FC = () => {
  const { modal, modalContext, editingId, closeModal, navigateTo, openModal, addToast, updateCurrentHistoryEntry, setHighlightTarget } = useUI();
  const terminology = useTerminology();
  const isProperty = useIsProperty();
  // Calendar round: virtual events render for every property-featured
  // product (Atrium AND Komplete/unified) — the modal resolution must
  // match that gate, not the Atrium-only isProperty flag.
  const { hasPropertyFeatures } = useProduct();
  const { coreState } = useCoreState();
  const { matterState } = useMatterState();
  const { financeState } = useFinanceState();
  const { executionState, executionActions } = useExecutionState();
  const { documentState } = useDocumentState();
  const dataHandlers = useDataActions();
  const { currentUser, appMode, bearerToken } = useAuth();
  // TASK 64 — dedicated, field-scoped bank-account writer (see convex
  // manageBankAccount). Ported verbatim from the former ModalManager.
  const manageBankAccountMutation = useMutation(api.myFunctions.manageBankAccount);

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
      console.error('[ModalLayer] manageBankAccount failed:', e);
      addToast(
        e?.message?.includes('required')
          ? e.message
          : 'Could not save the bank account — nothing was lost. Please try again in a moment.',
        { type: 'error', duration: 6000 }
      );
      return false;
    }
  };

  // If no modal is active, render nothing
  if (!modal) return null;

  // ─── Registry lookup ─────────────────────────────────────────────────
  const meta = MODAL_REGISTRY[modal];
  if (!meta || meta.needsSpecialWrapping) {
    // 'onboarding' (needsSpecialWrapping) is rendered by App.tsx's own
    // onboarding branch — never through the modal pipeline.
    return null;
  }

  // R27 product-themed auth surfaces: resolve once — the theme decides
  // the modal chrome (hideHeader + overlay/card/bar overrides) AND is
  // re-threaded through the login↔signup switch so the user never falls
  // back to the generic modal mid-funnel. Ported verbatim.
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

  // ─── Content builders — prop wiring copied 1:1 from the former ───────
  // ModalManager switch (verbatim, including edge-case fixes). Modals
  // not listed render through the generic pass-through at the bottom.
  const buildMigratedContent = (): React.ReactNode => {
    switch (modal) {
      // ── Tasks (batch 1) ──────────────────────────────────────────────
      case 'newTask':
      case 'editTask': {
        const taskToEdit = editingId ? executionState.tasks.find(t => t.id === editingId) : undefined;
        return (
          <TaskForm
            matters={matterState.matters}
            tasks={executionState.tasks}
            users={coreState.users}
            documents={documentState.documents}
            checklistTemplates={coreState.checklistTemplates}
            onAddTask={dataHandlers.handleAddTask}
            onUpdateTask={(t) => executionActions.updateTask(t)}
            onClose={closeModal}
            initialContext={modalContext}
            currentUser={currentUser!}
            appMode={appMode}
            taskToEdit={taskToEdit}
            openModal={openModal}
            onNavigate={navigateTo}
          />
        );
      }
      case 'viewTask': {
        const task = executionState.tasks.find(t => t.id === editingId);
        if (!task || !currentUser) return null;
        return (
          <TaskDetailModal
            task={task}
            users={coreState.users}
            matters={matterState.matters}
            documents={documentState.documents}
            onEdit={() => {
              openModal('newTask', task.id);
            }}
            onDelete={() => {
              // FIX (Aug 2026): Use dedicated deleteTask mutation instead of
              // generic deleteItem which fails silently for tasks without a
              // custom `id` field — same root cause as the drag-drop bug.
              (dataHandlers as any).deleteTask?.({ taskId: task.id, userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined) })
                .then(() => { closeModal(); })
                .catch((e: any) => { addToast(e?.message || 'Failed to delete task.', { type: 'error' }); });
            }}
            onUpdateTask={(t) => executionActions.updateTask(t)}
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
          />
        );
      }

      // ── Properties (batch 1) ─────────────────────────────────────────
      case 'newProperty':
      case 'editProperty': {
        const propertyId = modal === 'editProperty' ? (editingId as string) : undefined;
        let contactId = modal === 'editProperty' ? modalContext?.contactId : (editingId || modalContext?.contactId);

        // FIX: if no contactId was passed, try to find the property's owner
        // from the property record itself. Properties store a `contactId` field
        // that links to the owner. Without this, the modal shows "Select Owner"
        // instead of the PropertyForm when owner?.id is undefined.
        if (!contactId && propertyId) {
          const prop = coreState.properties.find(p => p.id === propertyId);
          contactId = prop?.contactId || (prop as any)?._id || undefined;
        }

        let contact = matterState.contacts.find(c => c.id === contactId || (c as any)._id === contactId);
        const propertyToEdit = coreState.properties.find(p => p.id === propertyId) ||
                   (contact?.properties || []).find(p => p.id === propertyId);

        // FIX: if still no contact but we have a property to edit, create a
        // minimal fallback contact object so the PropertyForm can render.
        // This handles the case where a property exists without a linked owner
        // (e.g. standalone multi-unit properties).
        if (!contact && propertyToEdit) {
          contact = {
            id: propertyToEdit.contactId || 'standalone',
            name: 'Property Owner',
            email: '',
            phone: '',
            category: 'Client',
            contactType: 'Individual' as any,
            firmId: propertyToEdit.firmId || '',
            properties: [],
          } as any;
        }

        if (contact) {
          return (
            <Suspense fallback={<ModalSkeleton />}>
              <PropertyForm
                contact={contact}
                propertyToEdit={propertyToEdit}
                activeUnitId={modalContext?.activeUnitId}
                autoExpandRental={modalContext?.autoExpandRental}
                autoAddUnit={modalContext?.autoAddUnit}
                onSave={dataHandlers.onUpdateContactProperties}
                onClose={closeModal}
              />
            </Suspense>
          );
        }
        // Shared owner selector (round-4 dedupe with DockedModal).
        return (
          <Suspense fallback={<ModalSkeleton />}>
            <PropertyOwnerPicker
              contacts={matterState.contacts}
              onSelect={(cid: string) => openModal('newProperty', cid)}
              onCreateNew={() => openModal('newContact', null, { returnTo: 'newProperty' })}
            />
          </Suspense>
        );
      }

      // ── Matters & Contacts (batch 2) ─────────────────────────────────
      case 'newMatter':
      case 'editMatter': {
        // For newMatter the Enterprise branch is intercepted earlier (see the
        // Enterprise override below) — only non-Enterprise reaches here.
        const matterToEdit = modal === 'editMatter' ? matterState.matters.find(m => m.id === editingId) : undefined;
        return (
          <Suspense fallback={<ModalSkeleton />}>
            <MatterForm
              matters={matterState.matters} users={coreState.users} contacts={matterState.contacts} workflows={executionState.workflows}
              onAddMatter={dataHandlers.onAddMatter} onUpdateMatter={dataHandlers.handleUpdateMatter}
              onClose={closeModal} matterToEdit={matterToEdit} currentUser={currentUser!} appMode={appMode}
              handleAddWorkflow={executionActions.handleAddWorkflow} handleAddWorkflowSubCategory={() => {}}
              onNavigate={navigateTo} initialContext={modalContext}
              openModal={openModal}
              isCompact={false}
            />
          </Suspense>
        );
      }
      case 'closeMatter': {
        const matter = matterState.matters.find(m => m.id === editingId);
        if (!matter) return null;
        // V3 (V-MATTER-3): the confirm runs the validated lifecycle
        // mutation — one server call that enforces the transition graph,
        // stamps closedAt, records activity and persists the closing note.
        const unbilledTime = financeState.timeEntries.filter(t => t.matterId === matter.id && t.billable && !t.billedInInvoiceId);
        const unbilledExpenses = financeState.expenses.filter(e => e.matterId === matter.id && e.isBillable && !e.billedInInvoiceId);
        return (
          <CloseMatterModal matter={matter} unbilledTime={unbilledTime} unbilledExpenses={unbilledExpenses} onConfirm={async (id, note) => {
            try {
              await dataHandlers.handleCloseMatter(id, note);
              closeModal();
            } catch { /* toast already shown; keep the modal open to retry */ }
          }} onClose={closeModal} />
        );
      }
      case 'archiveMatter': {
        const matter = matterState.matters.find(m => m.id === editingId);
        if (!matter) return null;
        // V3 (V-MATTER-4/7): the atomic server archive.
        return <ArchiveMatterModal matter={matter} onConfirm={async (id) => {
          try {
            await dataHandlers.archiveItem('matters', id, matter.title, matter);
            closeModal();
          } catch { /* toast already shown; keep the modal open to retry */ }
        }} onClose={closeModal} />;
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
        return <ContactForm onAddContact={handleAddContact} onUpdateContact={dataHandlers.handleUpdateContact} onClose={closeModal} contactToEdit={contact} contactCategories={coreState.contactCategories} initialContext={modalContext} />;
      }
      case 'mergeContact': {
        const contact = matterState.contacts.find(c => c.id === editingId);
        if (!contact) return null;
        return <MergeContactModal sourceContact={contact} allContacts={matterState.contacts} onConfirm={dataHandlers.handleMergeContacts} onClose={closeModal} />;
      }
      case 'linkContactToMatter': {
        const matter = matterState.matters.find(m => m.id === editingId);
        if (matter) return <LinkContactModal matter={matter} allContacts={matterState.contacts} onSave={dataHandlers.handleLinkContactToMatter} onClose={closeModal} />;
        return null;
      }
      case 'linkMatterToContact': {
        const contact = matterState.contacts.find(c => c.id === editingId);
        if (contact) {
          return (
            <LinkMatterToContactForm
              contact={contact}
              matters={matterState.matters}
              onSave={dataHandlers.handleLinkMatterToContact}
              onClose={closeModal}
            />
          );
        }
        return null;
      }
      case 'collectRent': {
        const propertyId = editingId;
        const property = coreState.properties.find(p => p.id === propertyId) ||
                matterState.contacts.flatMap(c => c.properties || []).find(p => p.id === propertyId);
        if (property) {
          return <CollectRentModal property={property} onClose={closeModal} />;
        }
        return null;
      }
      case 'bulkEditProperty': {
        const propertyIds = modalContext?.propertyIds || [];
        return (
          <BulkEditPropertyModal
            propertyIds={propertyIds}
            onClose={closeModal}
            onConfirm={async (data) => {
              await dataHandlers.handleBulkUpdateProperties(propertyIds, data);
              closeModal();
            }}
          />
        );
      }

      // ── Documents ────────────────────────────────────────────────────
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

        return <DocumentForm documents={documentState.documents} matters={matterState.matters} contacts={matterState.contacts} documentCategories={coreState.documentCategories} documentTemplates={coreState.documentTemplates} documentTemplateCategories={coreState.documentTemplateCategories} firmDetails={coreState.firmDetails} onAddDocument={dataHandlers.handleAddDocumentAndAnalyze} onUpdateDocument={(d) => dataHandlers.updateItem('documents', d, d.title)} onClose={closeModal} documentToEdit={doc} currentUser={currentUser!} onNavigate={navigateTo} initialContext={ctx} />;
      }
      case 'batchUpload': {
        return <BatchUploadModal files={modalContext.files} context={modalContext} onClose={closeModal} />;
      }
      case 'shareDocument': {
        const doc = documentState.documents.find(d => d.id === editingId);
        if (doc) return <ShareDocumentModal document={doc} matter={doc.matter ? matterState.matters.find(m => m.id === doc.matter?.id) : undefined} onClose={closeModal} />;
        return null;
      }
      case 'signDocument': {
        const doc = documentState.documents.find(d => d.id === editingId);
        if (doc) return <SignDocumentModal document={doc} onSign={dataHandlers.handleSignDocument} onClose={closeModal} />;
        return null;
      }
      case 'compareDocuments': {
        const { document, version } = modalContext;
        if (document && version) return <DocumentComparisonModal currentDocument={document} versionToCompare={version} onClose={closeModal} />;
        return null;
      }
      case 'newDocumentCategory':
      case 'editDocumentCategory': {
        const dc = coreState.documentCategories.find(c => c.id === editingId);
        return <DocumentCategoryForm onAddCategory={(c) => dataHandlers.addItem('documentCategories', c, c.name)} onUpdateCategory={(c) => dataHandlers.updateItem('documentCategories', c, c.name)} onDelete={() => dataHandlers.deleteItem('documentCategories', editingId!, 'Document Category')} onClose={closeModal} categoryToEdit={dc} allCategories={coreState.documentCategories} context={modalContext} />;
      }

      // ── Events ───────────────────────────────────────────────────────
      case 'newEvent':
      case 'editEvent': {
        const actualId = editingId?.includes('_') ? editingId.split('_')[0] : editingId;
        const event = executionState.events.find(e => e.id === actualId);
        return <EventForm matters={matterState.matters} users={coreState.users} appMode={appMode} eventTypes={coreState.eventTypes} onSave={(e) => dataHandlers.addItem('events', e, e.title)} onUpdateEvent={(e) => dataHandlers.updateItem('events', e, e.title)} onClose={closeModal} onNavigate={navigateTo} currentUser={currentUser!} eventToEdit={event} initialContext={modalContext?.fields || modalContext} />;
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
            // BUG FIX (calendar round): parseDateString parses the date-only
            // form as LOCAL midnight (same rule as getEventsForDay) — the old
            // `new Date(...)` UTC parse skipped the day's early instances
            // east of UTC (Lagos +1) and the modal opened blank.
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
          return <EventDetailModal
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
        return null;
      }
      case 'assignUsers': {
        // V3 (V-MATTER-15): the bulk context actually works now. Bulk goes
        // through the validated server mutation; single-item keeps the
        // per-item patch path.
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
          return <AssignUsersForm item={{ id: 'bulk', assignedUsers: [] }} itemType="Matter" itemTitle={`${bulkMatterIds.length} matters`} users={coreState.users} onUpdate={handleBulkAssign} onClose={closeModal} bulkMatterTitles={bulkMatters.map(m => m.title)} />;
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
          return <AssignUsersForm item={item} itemType={itemType} itemTitle={itemTitle} users={coreState.users} onUpdate={handleAssign} onClose={closeModal} />;
        }
        return null;
      }
      case 'stageChecklist': {
        const m = matterState.matters.find(x => x.id === editingId);
        if (m && modalContext) return <StageChecklistForm matter={m} stage={modalContext.stage} workflow={modalContext.workflow} checklistTemplates={coreState.checklistTemplates} onClose={closeModal} />;
        return null;
      }
      case 'newEventType':
      case 'editEventType': {
        const et = coreState.eventTypes.find(e => e.id === editingId);
        return <EventTypeForm onAddEventType={(e) => dataHandlers.addItem('eventTypes', e, e.name)} onUpdateEventType={(e) => dataHandlers.updateItem('eventTypes', e, e.name)} onDelete={() => dataHandlers.deleteItem('eventTypes', editingId!, 'Event Type')} onClose={closeModal} eventTypeToEdit={et} />;
      }

      // ── Invoices & Finance ───────────────────────────────────────────
      case 'newInvoice':
      case 'editInvoice': {
        const invoice = (financeState.invoices || []).find(i => i.id === editingId);
        const clients = (matterState.contacts || []).filter(c => c.category === 'Client');
        const bankAccounts = coreState.firmDetails?.bankAccounts || [];
        // UX-38 part 3: property scope opens the composer property-first
        // (pick the property → the landlord's invoice follows). The intent
        // travels as modal context from the scope-aware New action.
        return <InvoiceForm clients={clients} matters={matterState.matters || []} bankAccounts={bankAccounts} invoiceToEdit={invoice} propertyIntent={editingId ? false : !!modalContext?.propertyIntent} properties={coreState.properties || []} ownerContacts={matterState.contacts || []} onAddInvoice={(inv) => dataHandlers.addItem('invoices', inv, inv.invoiceNumber)} onUpdateInvoice={(inv) => dataHandlers.updateItem('invoices', inv, inv.invoiceNumber)} onClose={closeModal} />;
      }
      case 'generateInvoice': {
        const matter = matterState.matters.find(m => m.id === editingId);
        if (matter) {
          const unbilledTime = financeState.timeEntries.filter(t => t.matterId === matter.id && t.billable && !t.billedInInvoiceId);
          const unbilledExpenses = financeState.expenses.filter(e => e.matterId === matter.id && e.isBillable && !e.billedInInvoiceId);
          const safeBankAccounts = coreState.firmDetails?.bankAccounts || [];
          return <InvoiceGeneratorForm matter={matter} unbilledTimeEntries={unbilledTime} unbilledExpenses={unbilledExpenses} bankAccounts={safeBankAccounts} onGenerateInvoice={dataHandlers.handleGenerateInvoice} onClose={closeModal} />;
        }
        return null;
      }
      case 'paymentGateway': {
        return <PaymentGatewayModal
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
      }
      case 'newTimeEntry':
      case 'editTimeEntry': {
        const entry = financeState.timeEntries.find(t => t.id === editingId);
        const matterId = editingId || modalContext;
        const matter = matterState.matters.find(m => m.id === (entry ? entry.matterId : matterId));
        if (matter) return <TimeEntryForm matter={matter} timeEntryToEdit={entry} onAddTimeEntry={(t) => dataHandlers.addItem('timeEntries', t, 'Time Entry')} onUpdateTimeEntry={(t) => dataHandlers.updateItem('timeEntries', t, 'Time Entry')} onClose={closeModal} />;
        return null;
      }
      case 'newExpense':
      case 'editExpense': {
        const exp = financeState.expenses.find(e => e.id === editingId);
        const matterId = editingId || modalContext;
        const matter = matterState.matters.find(m => m.id === (exp ? exp.matterId : matterId));
        if (matter) return <ExpenseForm matter={matter} expenseToEdit={exp} onAddExpense={(e) => dataHandlers.addItem('expenses', e, 'Expense')} onUpdateExpense={(e) => dataHandlers.updateItem('expenses', e, 'Expense')} onClose={closeModal} />;
        return null;
      }
      case 'newBankAccount':
      case 'editBankAccount': {
        const bankAccounts = coreState.firmDetails?.bankAccounts || [];
        const account = bankAccounts.find(a => a.id === editingId);
        return <BankAccountForm accountToEdit={account}
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
      }
      case 'requestFinancialDocument': {
        const m = matterState.matters.find(x => x.id === editingId);
        if (m) return <RequestFinancialDocumentForm matter={m} />;
        return null;
      }

      // ── Users & Team ─────────────────────────────────────────────────
      case 'newUser':
      case 'editUser': {
        const userToEdit = coreState.users.find(u => u.id === editingId);
        return <UserForm userToEdit={userToEdit} onAddUser={(u) => dataHandlers.addItem('users', u, u.name)} onUpdateUser={(u) => dataHandlers.handleUpdateUser(u.id, u)} onClose={closeModal} />;
      }
      case 'editFirmDetails':
        return <FirmDetailsForm firmDetails={coreState.firmDetails} onUpdateFirmDetails={dataHandlers.handleUpdateFirmDetails} onClose={closeModal} />;
      case 'noTeamMembers':
        return <NoTeamMembersModal onNavigate={() => { closeModal(); navigateTo('settings', null, { settingsTargetId: 'user-management' }); }} onClose={closeModal} />;
      case 'newExternalCounsel': {
        return <ExternalCounselInviteForm matterId={editingId!} onInvite={dataHandlers.handleInviteExternalCounsel} onClose={closeModal} />;
      }

      // ── Workflows & Templates ────────────────────────────────────────
      case 'newWorkflow':
      case 'editWorkflow': {
        const wf = executionState.workflows.find(w => w.id === editingId);
        return <WorkflowForm onAddWorkflow={(w) => dataHandlers.handleAddWorkflow(w)} onUpdateWorkflow={dataHandlers.handleUpdateWorkflow} onDelete={() => { /* Handle delete workflow */ }} onClose={closeModal} workflowToEdit={wf} workflows={executionState.workflows} context={modalContext} />;
      }
      case 'newContactCategory':
      case 'editContactCategory': {
        const cc = coreState.contactCategories.find(c => c.id === editingId);
        return <ContactCategoryForm onAddCategory={(c) => dataHandlers.addItem('contactCategories', c, c.name)} onUpdateCategory={(c) => dataHandlers.updateItem('contactCategories', c, c.name)} onDelete={() => dataHandlers.deleteItem('contactCategories', editingId!, 'Contact Category')} onClose={closeModal} categoryToEdit={cc} />;
      }
      case 'newChecklistTemplate':
      case 'editChecklistTemplate': {
        const ct = coreState.checklistTemplates.find(t => t.id === editingId);
        return <ChecklistTemplateForm onAddTemplate={(t) => dataHandlers.addItem('checklistTemplates', t, t.name)} onUpdateTemplate={(t) => dataHandlers.updateItem('checklistTemplates', t, t.name)} onDelete={() => dataHandlers.deleteItem('checklistTemplates', editingId!, 'Checklist Template')} onClose={closeModal} templateToEdit={ct} workflows={executionState.workflows} />;
      }
      case 'newTemplate':
      case 'editTemplate': {
        const dt = coreState.documentTemplates.find(t => t.id === editingId);
        return <TemplateForm onAddTemplate={(t) => dataHandlers.addItem('documentTemplates', t, t.name)} onUpdateTemplate={(t) => dataHandlers.updateItem('documentTemplates', t, t.name)} onDelete={() => dataHandlers.deleteItem('documentTemplates', editingId!, 'Document Template')} onClose={closeModal} templateToEdit={dt} documentTemplateCategories={coreState.documentTemplateCategories} />;
      }
      case 'newTemplateCategory':
      case 'editTemplateCategory': {
        const dtc = coreState.documentTemplateCategories.find(c => c.id === editingId);
        return <TemplateCategoryForm onAdd={(c) => dataHandlers.addItem('documentTemplateCategories', c, c.name)} onUpdate={(c) => dataHandlers.updateItem('documentTemplateCategories', c, c.name)} onDelete={() => dataHandlers.deleteItem('documentTemplateCategories', editingId!, 'Template Category')} onClose={closeModal} categoryToEdit={dtc} />;
      }

      // ─── Messaging ───────────────────────────────────────────────────
      case 'newChannel':
        return <NewChannelForm users={coreState.users} onCreateChannel={dataHandlers.handleCreateChannel} onClose={closeModal} />;
      case 'newDirectMessage':
        // R74: modalContext carries the presence-stack hand-offs — a
        // preselected recipient (click-a-teammate DM) or group mode with
        // members preselected (tick-several group message).
        return <NewDirectMessageForm users={coreState.users} onClose={closeModal} initialContext={modalContext} />;

      // ─── Notes & Research ────────────────────────────────────────────
      case 'newNotebook':
      case 'editNotebook': {
        const nb = coreState.noteNotebooks.find(n => n.id === editingId);
        return <NotebookForm notebookToEdit={nb} onAdd={(n) => dataHandlers.addItem('noteNotebooks', n, n.name)} onUpdate={(n) => dataHandlers.updateItem('noteNotebooks', n, n.name)} onClose={closeModal} currentUser={currentUser!} appMode={appMode} />;
      }
      case 'newPage': {
        return (
          <NotePageForm
            onAdd={(p) => dataHandlers.addItem('notePages', p, p.title)}
            onClose={closeModal}
            initialContext={modalContext}
          />
        );
      }
      case 'newResearchNotebook': {
        return (
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
      }
      case 'addResearchSource': {
        return <AddResearchSourceModal notebookId={modalContext?.notebookId} onAdd={dataHandlers.handleAddResearchSource} onClose={closeModal} />;
      }
      case 'addCaseToNotebook': {
        return <AddCaseToNotebookModal caseData={modalContext?.caseData} notebooks={documentState.researchNotebooks.filter(nb => nb.userId === currentUser?.id)} matters={matterState.matters} onAdd={(nbId, cData) => dataHandlers.handleAddResearchSource(nbId, { name: cData.parties, type: 'text', content: JSON.stringify(cData) })} onCreateNotebook={dataHandlers.handleAddResearchNotebook} onClose={closeModal} />;
      }
      case 'saveToNote': {
        return <SaveToNoteForm initialContent={modalContext?.content || ''} onClose={closeModal} />;
      }

      // ─── Small modals & confirmations ────────────────────────────────
      case 'deleteConfirmation':
        return <ConfirmationModal title={modalContext.title} message={modalContext.message} onConfirm={modalContext.onConfirm} onCancel={closeModal} confirmText={modalContext.confirmText} confirmButtonClass={modalContext.confirmButtonClass} onConfirmArchive={modalContext.onConfirmArchive} archiveText={modalContext.archiveText} verificationText={modalContext.verificationText} requiresPassword={modalContext.requiresPassword} />;
      case 'aloaHelp':
        return <AloaHelpModal />;
      case 'feedback':
        return <FeedbackForm />;
      case 'matterIngestion':
        return <MatterIngestionWizard />;
      case 'joinFirm':
        return <JoinFirmModal onClose={closeModal} />;
      case 'upgradePlan': {
        return <UpgradeModal
          featureName={modalContext?.featureName}
          targetPlan={modalContext?.targetPlan} // Pass target plan to modal
          onUpgrade={() => { closeModal(); navigateTo('settings', null, { settingsTargetId: 'subscription-management' }); }}
          onClose={closeModal}
        />;
      }
      case 'keyboardShortcuts':
        return <KeyboardShortcutsModal />;
      case 'quickLook':
        return <QuickLookModal />;
      case 'workspaceSetup':
        return <WorkspaceSetupModal onSuccess={() => { }} pendingAction={modalContext?.pendingAction} onClose={closeModal} />;
      case 'sendPostActivationEmail':
        return <SendPostActivationEmailModal />;
      case 'composeEmail':
        return <ComposeEmailModal onClose={closeModal} initialContext={modalContext} />;
      case 'demoUpsell':
        return <DemoUpsellModal context={modalContext?.context} onSignup={() => openModal('signup')} onClose={closeModal} />;
      case 'aiConsent':
        return <AIConsentModalWrapper modalContext={modalContext} closeModal={closeModal} />;
      case 'leadCapture':
        return <LeadCaptureModal />;
      case 'login':
        return <Login onSwitchToSignup={() => { closeModal(); setTimeout(() => openModal('signup', null, authSwitchContext()), 10); }} forClient={modalContext?.forClient} />;
      case 'signup':
        return <Signup onSwitchToLogin={() => { closeModal(); setTimeout(() => openModal('login', null, authSwitchContext()), 10); }} />;

      default:
        return undefined;
    }
  };

  const migratedContent = buildMigratedContent();

  // ─── Enterprise override for newMatter ────────────────────────────────
  // Enterprise firms get the SmartMatterModal (full-screen intake wizard)
  // instead of the standard MatterForm.
  if (modal === 'newMatter') {
    const isEnterprise = coreState.firmDetails?.subscriptionPlan === SubscriptionPlan.Enterprise;
    if (isEnterprise) {
      // SmartMatterModal renders as a full-screen overlay, not inside ModalShell.
      // It manages its own backdrop + close button.
      return (
        <Suspense fallback={<ModalSkeleton />}>
          <SmartMatterModal
            users={coreState.users || []}
            contacts={matterState.contacts || []}
            currentUser={currentUser!}
            onAddMatter={async (matter, client) => {
              const res = await dataHandlers.onAddMatter(matter, client);
              if (res) {
                navigateTo('matterDetail', res, { initialTab: 'intake' });
              }
              return res;
            }}
            onClose={closeModal}
            onNavigate={navigateTo}
            openModal={openModal}
            initialContext={modalContext}
          />
        </Suspense>
      );
    }
  }

  // ─── Resolve the title ────────────────────────────────────────────────
  let resolvedTitle: string | undefined;
  if (meta.productAwareTitle) {
    resolvedTitle = meta.productAwareTitle(modalContext, terminology);
  } else if (typeof meta.title === 'function') {
    // Some title functions take (ctx, _t, editingId) — pass all three.
    resolvedTitle = (meta.title as any)(modalContext, terminology, editingId);
  } else {
    resolvedTitle = meta.title;
  }

  // Special-case: editTask/newTask show "Edit Task" when editingId is set
  if ((modal === 'newTask' || modal === 'editTask') && editingId) {
    resolvedTitle = 'Edit Task';
  }
  // R47: the product speaks its own name — the company stays in the
  // built-by credit, not the upsell title.
  if (modal === 'demoUpsell') {
    resolvedTitle = isProperty ? 'Upgrade to Atrium' : 'Upgrade to Vega';
  }

  // ─── Render ──────────────────────────────────────────────────────────
  const isFullscreen = meta.presentation === 'fullscreen';
  const authChrome = authThemeId && authThemeId !== 'hub' && AUTH_THEMES[authThemeId].chrome
    ? {
        overlayClass: AUTH_THEMES[authThemeId].chrome!.overlayClass,
        cardClass: AUTH_THEMES[authThemeId].chrome!.cardClass,
        accentBarClass: AUTH_THEMES[authThemeId].chrome!.accentBarClass,
      }
    : undefined;
  const hideHeader = meta.hideHeader || !!(authThemeId && authThemeId !== 'hub');

  const shellProps = {
    isOpen: !!modal,
    onClose: closeModal,
    title: resolvedTitle,
    size: meta.size || ('md' as const),
    hideHeader,
    hideAccentBar: meta.hideAccentBar,
    fullscreen: isFullscreen,
    ...(authChrome || {}),
  };

  // Builder-backed modals (the explicit cases above)
  if (migratedContent !== undefined) {
    if (migratedContent === null) return null;
    return (
      <ModalShell {...shellProps}>
        <Suspense fallback={<ModalSkeleton />}>
          {migratedContent}
        </Suspense>
      </ModalShell>
    );
  }

  // Generic pass-through: registry entries without a builder render their
  // component with the common props.
  const ContentComponent = meta.component;
  if (!ContentComponent) {
    return (
      <ModalShell {...shellProps}>
        <div className="p-4">Modal content for {modal} not found.</div>
      </ModalShell>
    );
  }
  return (
    <ModalShell {...shellProps}>
      <Suspense fallback={<ModalSkeleton />}>
        <ContentComponent
          closeModal={closeModal}
          editingId={editingId}
          modalContext={modalContext}
          // Pass through common handlers so individual modals don't need
          // to import UIContext for the most common operations.
          onClose={closeModal}
          openModal={openModal}
          navigateTo={navigateTo}
          addToast={addToast}
          updateCurrentHistoryEntry={updateCurrentHistoryEntry}
          setHighlightTarget={setHighlightTarget}
        />
      </Suspense>
    </ModalShell>
  );
};

export default ModalLayer;
