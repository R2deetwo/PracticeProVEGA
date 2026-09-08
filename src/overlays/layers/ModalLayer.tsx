/**
 * ModalLayer — Renders the active modal based on the modalRegistry.
 *
 * This is the NEW modal system. The legacy ModalManager.tsx still
 * renders in parallel for any modals that aren't yet in the registry
 * (or are marked `needsSpecialWrapping: true`). Once all modals are
 * migrated, ModalManager.tsx can be deleted.
 *
 * Migration path:
 *   1. Add modal to modalRegistry.tsx with its component + size + title
 *   2. Remove its `case` from ModalManager.tsx's switch statement
 *   3. ModalLayer picks it up automatically on next render
 *
 * For now, if a modal is in the registry AND not marked needsSpecialWrapping,
 * ModalLayer renders it and ModalManager skips it. If a modal isn't in the
 * registry at all, ModalManager handles it (backward compat).
 *
 * The registry-based approach means adding a new modal is now ONE line
 * in modalRegistry.tsx, not 20 lines in a switch + new imports.
 */
import React, { Suspense } from 'react';
import { useUI } from '../../contexts/UIContext';
import { useTerminology } from '../../contexts/ProductContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useFinanceState } from '../../contexts/FinanceContext';
import { useExecutionState } from '../../contexts/ExecutionContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useDataActions } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { SubscriptionPlan } from '../../types';
import { MODAL_REGISTRY } from '../registry/modalRegistry';
import { ModalShell } from '../primitives/ModalShell';
import { SmartMatterModal } from '../../components/forms/SmartMatterModal';
import { MatterForm } from '../../components/forms/MatterForm';
import TaskForm from '../../components/forms/TaskForm';
import { TaskDetailModal } from '../../components/modals/TaskDetailModal';
import PropertyForm from '../../components/forms/PropertyForm';
import { PropertyOwnerPicker } from '../../components/modals/PropertyOwnerPicker';
import ContactForm from '../../components/forms/ContactForm';
import MergeContactModal from '../../components/modals/MergeContactModal';
import CloseMatterModal from '../../components/modals/CloseMatterModal';
import ArchiveMatterModal from '../../components/modals/ArchiveMatterModal';

// Loading skeleton shown while lazy-loaded modal components fetch
const ModalSkeleton: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

export const ModalLayer: React.FC = () => {
  const { modal, modalContext, editingId, closeModal, navigateTo, openModal, addToast, updateCurrentHistoryEntry, setHighlightTarget } = useUI();
  const terminology = useTerminology();
  const { coreState } = useCoreState();
  const { matterState } = useMatterState();
  const { financeState } = useFinanceState();
  const { executionState, executionActions } = useExecutionState();
  const { documentState } = useDocumentState();
  const dataHandlers = useDataActions();
  const { currentUser, appMode, bearerToken } = useAuth();

  // If no modal is active, render nothing
  if (!modal) return null;

  // ─── MIGRATION GATE ──────────────────────────────────────────────────
  // Only render modals that have been EXPLICITLY migrated to the new system.
  // The registry catalogs ALL modal types for documentation, but most still
  // need dataHandlers/matters/contacts etc. that the generic prop
  // pass-through below doesn't provide — those get explicit content builders
  // in MIGRATED_CONTENT_BUILDERS instead.
  // To migrate a modal:
  //   1. Add it to MIGRATED_MODALS below
  //   2. Add it to MODAL_LAYER_HANDLED in ModalManager.tsx (so the legacy
  //      manager skips it)
  //   3. If the component needs rich props, add a builder to
  //      MIGRATED_CONTENT_BUILDERS replicating the ModalManager case verbatim
  //   4. Verify the modal renders + behaves identically before the next one
  //
  // BATCH 1 (2026-09-08): task creation/edit/detail (newTask, editTask,
  // viewTask) + property creation/edit (newProperty, editProperty) — the
  // highest-traffic modals. Prop wiring is copied 1:1 from ModalManager's
  // former cases so behavior is unchanged; only the chrome is now ModalShell.
  //
  // BATCH 2 (2026-09-08): the Matters & Contacts cluster — newMatter,
  // editMatter, closeMatter, archiveMatter, newContact, editContact,
  // mergeContact. Same 1:1 prop-copy discipline.
  const MIGRATED_MODALS = new Set<string>([
    'newTask',
    'editTask',
    'viewTask',
    'newProperty',
    'editProperty',
    'newMatter',
    'editMatter',
    'closeMatter',
    'archiveMatter',
    'newContact',
    'editContact',
    'mergeContact',
  ]);
  if (!MIGRATED_MODALS.has(modal)) {
    return null;
  }

  // Look up the modal in the registry
  const meta = MODAL_REGISTRY[modal];

  // If the modal isn't in the registry OR needs special wrapping,
  // ModalLayer renders nothing — the legacy ModalManager handles it.
  // This allows incremental migration without breaking anything.
  if (!meta || meta.needsSpecialWrapping) {
    return null;
  }

  // ─── BATCH-1 CONTENT BUILDERS ────────────────────────────────────────
  // Prop wiring copied 1:1 from ModalManager's former cases (verbatim,
  // including the edge-case fixes) so behavior is unchanged. Only the
  // modal chrome differs (ModalShell instead of the legacy <Modal>).
  const buildMigratedContent = (): React.ReactNode => {
    switch (modal) {
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
            <PropertyForm
              contact={contact}
              propertyToEdit={propertyToEdit}
              activeUnitId={modalContext?.activeUnitId}
              autoExpandRental={modalContext?.autoExpandRental}
              autoAddUnit={modalContext?.autoAddUnit}
              onSave={dataHandlers.onUpdateContactProperties}
              onClose={closeModal}
            />
          );
        }
        // Shared owner selector (round-4 dedupe with DockedModal).
        return (
          <PropertyOwnerPicker
            contacts={matterState.contacts}
            onSelect={(cid) => openModal('newProperty', cid)}
            onCreateNew={() => openModal('newContact', null, { returnTo: 'newProperty' })}
          />
        );
      }
      // ─── BATCH 2: Matters & Contacts ────────────────────────────────
      case 'newMatter':
      case 'editMatter': {
        // Prop wiring copied 1:1 from ModalManager's former cases. For
        // newMatter the Enterprise branch is intercepted earlier (see the
        // Enterprise override below) — only non-Enterprise reaches here.
        const matterToEdit = modal === 'editMatter' ? matterState.matters.find(m => m.id === editingId) : undefined;
        return (
          <MatterForm
            matters={matterState.matters} users={coreState.users} contacts={matterState.contacts} workflows={executionState.workflows}
            onAddMatter={dataHandlers.onAddMatter} onUpdateMatter={dataHandlers.handleUpdateMatter}
            onClose={closeModal} matterToEdit={matterToEdit} currentUser={currentUser!} appMode={appMode}
            handleAddWorkflow={executionActions.handleAddWorkflow} handleAddWorkflowSubCategory={() => {}}
            onNavigate={navigateTo} initialContext={modalContext}
            openModal={openModal}
            isCompact={false}
          />
        );
      }
      case 'closeMatter': {
        const matter = matterState.matters.find(m => m.id === editingId);
        if (!matter) return null;
        const unbilledTime = financeState.timeEntries.filter(t => t.matterId === matter.id && t.billable && !t.billedInInvoiceId);
        const unbilledExpenses = financeState.expenses.filter(e => e.matterId === matter.id && e.isBillable && !e.billedInInvoiceId);
        return (
          <CloseMatterModal matter={matter} unbilledTime={unbilledTime} unbilledExpenses={unbilledExpenses} onConfirm={async (id, note) => {
            dataHandlers.handleUpdateMatterStage(id, 'Closed');
            // Persist the closing note so it's not silently discarded
            if (note && note.trim()) {
              try {
                await dataHandlers.handleAddMatterNote(id, 'Closing Summary', note.trim(), 'user');
              } catch (e) { /* non-fatal — matter is already closed */ }
            }
            // Also update the matter status to Closed
            await dataHandlers.handleUpdateMatter({ id, status: 'Closed' } as any);
            closeModal();
          }} onClose={closeModal} />
        );
      }
      case 'archiveMatter': {
        const matter = matterState.matters.find(m => m.id === editingId);
        if (!matter) return null;
        return <ArchiveMatterModal matter={matter} onConfirm={(id) => { dataHandlers.archiveItem('Matter', id, matter.title, matter); closeModal(); }} onClose={closeModal} />;
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
      default:
        return undefined;
    }
  };

  const migratedContent = buildMigratedContent();

  // ─── Enterprise override for newMatter ────────────────────────────────
  // Enterprise firms get the SmartMatterModal (full-screen intake wizard)
  // instead of the standard MatterForm. Prop wiring copied 1:1 from
  // ModalManager's former case (BATCH 2 — now real, previously a stub).
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

  // ─── Render ──────────────────────────────────────────────────────────
  const ContentComponent = meta.component;
  const isFullscreen = meta.presentation === 'fullscreen';

  // Batch-1 modals render via their explicit content builders; anything
  // else in MIGRATED_MODALS uses the generic pass-through below.
  if (migratedContent !== undefined) {
    if (migratedContent === null) return null;
    return (
      <ModalShell
        isOpen={!!modal}
        onClose={closeModal}
        title={resolvedTitle}
        size={meta.size || 'md'}
        hideHeader={meta.hideHeader}
        hideAccentBar={meta.hideAccentBar}
        fullscreen={isFullscreen}
      >
        {migratedContent}
      </ModalShell>
    );
  }

  return (
    <ModalShell
      isOpen={!!modal}
      onClose={closeModal}
      title={resolvedTitle}
      size={meta.size || 'md'}
      hideHeader={meta.hideHeader}
      hideAccentBar={meta.hideAccentBar}
      fullscreen={isFullscreen}
    >
      <Suspense fallback={<ModalSkeleton />}>
        {ContentComponent && (
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
        )}
      </Suspense>
    </ModalShell>
  );
};

export default ModalLayer;
