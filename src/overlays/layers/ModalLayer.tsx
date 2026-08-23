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
import { SubscriptionPlan } from '../../types';
import { MODAL_REGISTRY } from '../registry/modalRegistry';
import { ModalShell } from '../primitives/ModalShell';
import { SmartMatterModal } from '../../components/forms/SmartMatterModal';

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

  // If no modal is active, render nothing
  if (!modal) return null;

  // Look up the modal in the registry
  const meta = MODAL_REGISTRY[modal];

  // If the modal isn't in the registry OR needs special wrapping,
  // ModalLayer renders nothing — the legacy ModalManager handles it.
  // This allows incremental migration without breaking anything.
  if (!meta || meta.needsSpecialWrapping) {
    return null;
  }

  // ─── Enterprise override for newMatter ────────────────────────────────
  // Enterprise firms get the SmartMatterModal (full-screen intake wizard)
  // instead of the standard MatterForm. This mirrors the existing logic
  // in ModalManager.tsx — once fully migrated, this conditional stays
  // here and the ModalManager case is deleted.
  if (modal === 'newMatter') {
    const isEnterprise = coreState.firmDetails?.subscriptionPlan === SubscriptionPlan.Enterprise;
    if (isEnterprise) {
      // SmartMatterModal renders as a full-screen overlay, not inside ModalShell.
      // It manages its own backdrop + close button.
      return (
        <Suspense fallback={<ModalSkeleton />}>
          <SmartMatterModal
            users={coreState.users || []}
            contacts={[]}
            currentUser={null as any}
            onAddMatter={async () => null}
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
