/**
 * modalRegistry.tsx — Single source of truth for modal type → component mapping.
 *
 * This replaces the giant switch(modal) block in ModalManager.tsx (~400 LOC).
 * Adding a new modal is now just ONE entry here, not 20 lines of switch
 * + new imports in ModalManager.
 *
 * Each entry has:
 *   component    — The React component to render
 *   title        — Static string OR a function (ctx) => string for dynamic titles
 *   size         — sm | md | lg | xl | full
 *   presentation — 'center' (default) | 'docked' (right-side slide-in) | 'fullscreen'
 *   hideHeader   — For bare-bones overlays (confirmations, splash)
 *   hideAccentBar — Skip the gradient accent bar
 *
 * The ModalLayer reads this registry, looks up the component, and wraps it
 * in <ModalShell> with the correct size + presentation.
 *
 * MIGRATION NOTE: This is the new system. The old ModalManager.tsx still
 * works in parallel. To migrate a modal:
 *   1. Add its entry here (lazy import + size + title)
 *   2. Remove its case from the switch in ModalManager.tsx
 *   3. The ModalLayer will pick it up automatically
 *
 * For now, both layers render — ModalLayer first, then ModalManager as
 * a fallback for any modals not yet in the registry. Once all modals are
 * migrated, ModalManager.tsx can be deleted.
 */
import React, { lazy, Suspense, ComponentType } from 'react';
import type { ModalType } from '../../types';

// ─── Lazy-loaded modal components ────────────────────────────────────────
// Lazy-loading keeps the overlay bundle small — heavy forms only load
// when their modal is actually opened. The <ModalLayer> wraps everything
// in <Suspense fallback={<ModalSkeleton/>}> so the user sees a smooth
// loading state instead of a blank flash.

// Auth
const Login = lazy(() => import('../../components/auth/Login'));
const Signup = lazy(() => import('../../components/auth/Signup'));

// Forms
const MatterForm = lazy(() => import('../../components/forms/MatterForm').then(m => ({ default: m.MatterForm })));
const SmartMatterModal = lazy(() => import('../../components/forms/SmartMatterModal').then(m => ({ default: m.SmartMatterModal })));
const ContactForm = lazy(() => import('../../components/forms/ContactForm').then(m => ({ default: m.default })));
const PropertyForm = lazy(() => import('../../components/forms/PropertyForm').then(m => ({ default: m.default })));
const DocumentForm = lazy(() => import('../../components/forms/DocumentForm').then(m => ({ default: m.DocumentForm })));
const TaskForm = lazy(() => import('../../components/forms/TaskForm').then(m => ({ default: m.default })));
const EventForm = lazy(() => import('../../components/forms/EventForm').then(m => ({ default: m.EventForm })));
const InvoiceForm = lazy(() => import('../../components/forms/InvoiceForm').then(m => ({ default: m.InvoiceForm })));
const InvoiceGeneratorForm = lazy(() => import('../../components/forms/InvoiceGeneratorForm').then(m => ({ default: m.InvoiceGeneratorForm })));
const UserForm = lazy(() => import('../../components/forms/UserForm').then(m => ({ default: m.default })));
const TimeEntryForm = lazy(() => import('../../components/forms/TimeEntryForm').then(m => ({ default: m.default })));
const ExpenseForm = lazy(() => import('../../components/forms/ExpenseForm').then(m => ({ default: m.default })));
const BankAccountForm = lazy(() => import('../../components/forms/BankAccountForm').then(m => ({ default: m.default })));
const WorkflowForm = lazy(() => import('../../components/forms/WorkflowForm').then(m => ({ default: m.default })));
const EventTypeForm = lazy(() => import('../../components/forms/EventTypeForm').then(m => ({ default: m.default })));
const ContactCategoryForm = lazy(() => import('../../components/forms/ContactCategoryForm').then(m => ({ default: m.default })));
const DocumentCategoryForm = lazy(() => import('../../components/forms/DocumentCategoryForm').then(m => ({ default: m.default })));
const ChecklistTemplateForm = lazy(() => import('../../components/forms/ChecklistTemplateForm').then(m => ({ default: m.default })));
const FirmDetailsForm = lazy(() => import('../../components/forms/FirmDetailsForm').then(m => ({ default: m.default })));
const TemplateForm = lazy(() => import('../../components/forms/TemplateForm').then(m => ({ default: m.default })));
const TemplateCategoryForm = lazy(() => import('../../components/forms/TemplateCategoryForm').then(m => ({ default: m.default })));
const FeedbackForm = lazy(() => import('../../components/forms/FeedbackForm').then(m => ({ default: m.default })));
const RequestFinancialDocumentForm = lazy(() => import('../../components/forms/RequestFinancialDocumentForm').then(m => ({ default: m.default })));
const NewChannelForm = lazy(() => import('../../components/forms/NewChannelForm').then(m => ({ default: m.default })));
const NewDirectMessageForm = lazy(() => import('../../components/forms/NewDirectMessageForm').then(m => ({ default: m.default })));
const AssignUsersForm = lazy(() => import('../../components/forms/AssignUsersForm').then(m => ({ default: m.default })));
const ExternalCounselInviteForm = lazy(() => import('../../components/forms/ExternalCounselInviteForm').then(m => ({ default: m.default })));
const StageChecklistForm = lazy(() => import('../../components/forms/StageChecklistForm').then(m => ({ default: m.StageChecklistForm })));
const NewResearchNotebookForm = lazy(() => import('../../components/forms/NewResearchNotebookForm').then(m => ({ default: m.default })));
const NotebookForm = lazy(() => import('../../components/forms/NotebookForm').then(m => ({ default: m.default })));
const NotePageForm = lazy(() => import('../../components/forms/NotePageForm').then(m => ({ default: m.default })));
const LeadForm = lazy(() => import('../../components/forms/LeadForm').then(m => ({ default: m.default })));
const SaveToNoteForm = lazy(() => import('../../components/forms/SaveToNoteForm').then(m => ({ default: m.SaveToNoteForm })));
const LinkMatterToContactForm = lazy(() => import('../../components/forms/LinkMatterToContactForm').then(m => ({ default: m.LinkMatterToContactForm })));

// Modals
const DemoUpsellModal = lazy(() => import('../../components/modals/DemoUpsellModal').then(m => ({ default: m.default })));
const ArchiveMatterModal = lazy(() => import('../../components/modals/ArchiveMatterModal').then(m => ({ default: m.default })));
const CloseMatterModal = lazy(() => import('../../components/modals/CloseMatterModal').then(m => ({ default: m.default })));
const ConfirmationModal = lazy(() => import('../../components/modals/DeleteConfirmationModal').then(m => ({ default: m.default })));
const ShareDocumentModal = lazy(() => import('../../components/modals/ShareDocumentModal').then(m => ({ default: m.ShareDocumentModal })));
const SignDocumentModal = lazy(() => import('../../components/modals/SignDocumentModal').then(m => ({ default: m.SignDocumentModal })));
const DocumentComparisonModal = lazy(() => import('../../components/modals/DocumentComparisonModal').then(m => ({ default: m.DocumentComparisonModal })));
const ComposeEmailModal = lazy(() => import('../../components/modals/ComposeEmailModal').then(m => ({ default: m.default })));
const NoTeamMembersModal = lazy(() => import('../../components/modals/NoTeamMembersModal').then(m => ({ default: m.default })));
const AloaHelpModal = lazy(() => import('../../components/modals/AloaHelpModal').then(m => ({ default: m.default })));
const LinkContactModal = lazy(() => import('../../components/modals/LinkContactModal').then(m => ({ default: m.default })));
const AddResearchSourceModal = lazy(() => import('../../components/modals/AddResearchSourceModal').then(m => ({ default: m.default })));
const AddCaseToNotebookModal = lazy(() => import('../../components/modals/AddCaseToNotebookModal').then(m => ({ default: m.default })));
const KeyboardShortcutsModal = lazy(() => import('../../components/modals/KeyboardShortcutsModal').then(m => ({ default: m.default })));
const QuickLookModal = lazy(() => import('../../components/modals/QuickLookModal').then(m => ({ default: m.default })));
const PaymentGatewayModal = lazy(() => import('../../components/modals/PaymentGatewayModal').then(m => ({ default: m.default })));
const UpgradeModal = lazy(() => import('../../components/modals/UpgradeModal').then(m => ({ default: m.default })));
const TaskDetailModal = lazy(() => import('../../components/modals/TaskDetailModal').then(m => ({ default: m.default })));
const EventDetailModal = lazy(() => import('../../components/details/EventDetailModal').then(m => ({ default: m.EventDetailModal })));
const LeadCaptureModal = lazy(() => import('../../components/modals/LeadCaptureModal').then(m => ({ default: m.default })));
const WorkspaceSetupModal = lazy(() => import('../../components/modals/WorkspaceSetupModal').then(m => ({ default: m.default })));
const SendPostActivationEmailModal = lazy(() => import('../../components/modals/SendPostActivationEmailModal').then(m => ({ default: m.default })));
const FolderPermissionsModal = lazy(() => import('../../components/modals/FolderPermissionsModal').then(m => ({ default: m.default })));
const SendIntakeLinkModal = lazy(() => import('../../components/modals/SendIntakeLinkModal').then(m => ({ default: m.default })));
const BatchUploadModal = lazy(() => import('../../components/modals/BatchUploadModal').then(m => ({ default: m.default })));
const JoinFirmModal = lazy(() => import('../../components/modals/JoinFirmModal').then(m => ({ default: m.default })));
const MatterIngestionWizard = lazy(() => import('../../components/modals/MatterIngestionWizard').then(m => ({ default: m.default })));
const BulkEditPropertyModal = lazy(() => import('../../components/modals/BulkEditPropertyModal').then(m => ({ default: m.BulkEditPropertyModal })));
const CollectRentModal = lazy(() => import('../../components/modals/CollectRentModal').then(m => ({ default: m.default })));
const MergeContactModal = lazy(() => import('../../components/modals/MergeContactModal').then(m => ({ default: m.default })));
const AIConsentModal = lazy(() => import('../../components/modals/AIConsentModal').then(m => ({ default: m.default })));
const RecordRentPaymentModalWrapper = lazy(() => import('../../components/modals/ModalManager').then(() => ({ default: (null as any) }))); // NOTE: needs special wrapping

// ─── Registry types ──────────────────────────────────────────────────────
export type ModalPresentation = 'center' | 'docked' | 'fullscreen';

export interface ModalMeta {
  /** The lazy-loaded component. Receives { closeModal, editingId, modalContext } as props. */
  component?: ComponentType<any>;
  /** Static title, OR a function of modalContext for dynamic titles. */
  title?: string | ((ctx: any) => string);
  /** Modal width class. Defaults to 'md'. */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Layout style. 'center' = standard modal, 'docked' = right-side slide-in, 'fullscreen' = full viewport. */
  presentation?: ModalPresentation;
  /** Hide the header bar (title + close button). */
  hideHeader?: boolean;
  /** Skip the gradient accent bar at the top. */
  hideAccentBar?: boolean;
  /**
   * Special wrapper component that needs custom hooks/wiring (e.g. AIConsentModal
   * needs recordConsent mutation; RecordRentPayment needs useOfflineQueue).
   * If set, `component` is ignored — the wrapper is rendered instead.
   * Migrate these to plain `component` entries once their hooks are lifted
   * into the ModalLayer's shared context.
   */
  needsSpecialWrapping?: boolean;
  /** Product-aware title override: (ctx, terminology) => string. */
  productAwareTitle?: (ctx: any, terminology: any) => string;
}

// ─── The registry ────────────────────────────────────────────────────────
// Every ModalType must have an entry here. If you add a new ModalType to
// types.ts, add its entry here too — otherwise ModalLayer shows a
// "not found" fallback.
//
// Entries marked with `needsSpecialWrapping: true` still go through the
// legacy ModalManager.tsx switch (their hooks/wiring are too tangled to
// lift cleanly into the registry yet). They're listed here for documentation
// and so ModalLayer knows NOT to render them — it delegates to ModalManager.
export const MODAL_REGISTRY: Partial<Record<ModalType, ModalMeta>> = {
  // ─── Auth ────────────────────────────────────────────────────────────
  login: {
    component: Login as any,
    title: 'Sign In',
    size: 'sm',
  },
  signup: {
    component: Signup as any,
    title: 'Create Account',
    size: 'sm',
  },
  leadCapture: {
    component: LeadCaptureModal as any,
    title: 'Get Started',
    size: 'sm',
  },

  // ─── Matters ─────────────────────────────────────────────────────────
  newMatter: {
    // NOTE: Enterprise firms override this to SmartMatterModal in the
    // ModalLayer (conditional based on firmDetails.subscriptionPlan).
    // Non-Enterprise falls through to MatterForm here.
    component: MatterForm as any,
    title: (ctx) => 'New Matter',
    size: 'lg',
  },
  editMatter: {
    component: MatterForm as any,
    title: (ctx) => 'Edit Matter',
    size: 'lg',
  },
  closeMatter: {
    component: CloseMatterModal as any,
    title: 'Close Matter',
    size: 'md',
  },
  archiveMatter: {
    component: ArchiveMatterModal as any,
    title: 'Archive Matter',
    size: 'sm',
  },
  matterIngestion: {
    component: MatterIngestionWizard as any,
    title: 'Matter Intake Wizard',
    presentation: 'fullscreen',
    hideAccentBar: true,
  },

  // ─── Contacts ────────────────────────────────────────────────────────
  newContact: {
    component: ContactForm as any,
    title: 'New Contact',
    size: 'lg',
  },
  editContact: {
    component: ContactForm as any,
    title: 'Edit Contact',
    size: 'lg',
  },
  mergeContact: {
    component: MergeContactModal as any,
    title: 'Merge Contacts',
    size: 'sm',
  },
  linkContactToMatter: {
    component: LinkContactModal as any,
    title: 'Link Contact to Matter',
    size: 'sm',
  },
  linkMatterToContact: {
    component: LinkMatterToContactForm as any,
    productAwareTitle: (ctx, t) => `Link ${t.matter} to ${t.client}`,
    size: 'sm',
  },

  // ─── Properties (Atrium) ─────────────────────────────────────────────
  newProperty: {
    component: PropertyForm as any,
    title: 'New Property',
    size: 'lg',
  },
  editProperty: {
    component: PropertyForm as any,
    title: 'Edit Property',
    size: 'lg',
  },
  bulkEditProperty: {
    component: BulkEditPropertyModal as any,
    title: 'Bulk Edit Properties',
    size: 'lg',
  },
  collectRent: {
    component: CollectRentModal as any,
    title: 'Issue Rent Receipt',
    size: 'lg',
  },
  recordRentPayment: {
    // Special wrapping — needs useOfflineQueue, useMutation(api.sentry.addLedgerEntry)
    needsSpecialWrapping: true,
    title: 'Record Rent Payment',
    size: 'sm',
  },

  // ─── Documents ───────────────────────────────────────────────────────
  newDocument: {
    component: DocumentForm as any,
    title: (ctx) => {
      const name = ctx?.draftTitle || ctx?.title || 'New Document';
      return `New Document: ${name}`;
    },
    size: 'md',
  },
  editDocument: {
    component: DocumentForm as any,
    title: (ctx) => {
      const name = ctx?.title || 'Document';
      return `Edit Document: ${name}`;
    },
    size: 'md',
  },
  newDraft: {
    component: DocumentForm as any,
    title: (ctx) => `Draft: ${ctx?.draftTitle || ctx?.title || 'New Draft'}`,
    size: 'md',
  },
  batchUpload: {
    component: BatchUploadModal as any,
    title: 'Uploading Files',
    size: 'md',
  },
  shareDocument: {
    component: ShareDocumentModal as any,
    title: 'Share Document',
    size: 'md',
  },
  signDocument: {
    component: SignDocumentModal as any,
    title: 'Sign Document',
    size: 'sm',
  },
  compareDocuments: {
    component: DocumentComparisonModal as any,
    title: 'Compare Versions',
    size: 'xl',
  },
  folderPermissions: {
    component: FolderPermissionsModal as any,
    title: 'Folder Permissions',
    size: 'sm',
  },
  newDocumentCategory: {
    component: DocumentCategoryForm as any,
    title: 'New Document Category',
    size: 'sm',
  },
  editDocumentCategory: {
    component: DocumentCategoryForm as any,
    title: 'Edit Document Category',
    size: 'sm',
  },

  // ─── Tasks & Events ──────────────────────────────────────────────────
  newTask: {
    component: TaskForm as any,
    title: 'New Task',
    size: 'md',
  },
  editTask: {
    component: TaskForm as any,
    title: 'Edit Task',
    size: 'md',
  },
  viewTask: {
    component: TaskDetailModal as any,
    title: 'Task Details',
    size: 'md',
  },
  newEvent: {
    component: EventForm as any,
    title: 'New Event',
    size: 'lg',
  },
  editEvent: {
    component: EventForm as any,
    title: 'Edit Event',
    size: 'lg',
  },
  viewEvent: {
    component: EventDetailModal as any,
    title: 'Event Details',
    size: 'md',
  },
  assignUsers: {
    component: AssignUsersForm as any,
    title: 'Assign Users',
    size: 'sm',
  },
  stageChecklist: {
    component: StageChecklistForm as any,
    title: 'Apply Stage Checklist',
    size: 'md',
  },

  // ─── Invoices & Finance ──────────────────────────────────────────────
  newInvoice: {
    component: InvoiceForm as any,
    title: 'New Invoice',
    size: 'lg',
  },
  editInvoice: {
    component: InvoiceForm as any,
    title: 'Edit Invoice',
    size: 'lg',
  },
  viewInvoice: {
    component: InvoiceForm as any,
    title: 'View Invoice',
    size: 'lg',
  },
  generateInvoice: {
    component: InvoiceGeneratorForm as any,
    title: 'Generate Invoice',
    size: 'lg',
  },
  newTimeEntry: {
    component: TimeEntryForm as any,
    title: 'New Time Entry',
    size: 'md',
  },
  editTimeEntry: {
    component: TimeEntryForm as any,
    title: 'Edit Time Entry',
    size: 'md',
  },
  newExpense: {
    component: ExpenseForm as any,
    title: 'New Expense',
    size: 'md',
  },
  editExpense: {
    component: ExpenseForm as any,
    title: 'Edit Expense',
    size: 'md',
  },
  newBankAccount: {
    component: BankAccountForm as any,
    title: 'Add Bank Account',
    size: 'sm',
  },
  editBankAccount: {
    component: BankAccountForm as any,
    title: 'Edit Bank Account',
    size: 'sm',
  },
  requestTrustDeposit: {
    component: RequestFinancialDocumentForm as any,
    title: 'Request Trust Deposit',
    size: 'md',
  },
  requestFinancialDocument: {
    component: RequestFinancialDocumentForm as any,
    title: 'Request Financial Document',
    size: 'md',
  },
  paymentGateway: {
    component: PaymentGatewayModal as any,
    title: 'Payment',
    size: 'sm',
  },
  composeEmail: {
    component: ComposeEmailModal as any,
    title: 'Compose Email',
    size: 'lg',
  },

  // ─── Users & Team ────────────────────────────────────────────────────
  newUser: {
    component: UserForm as any,
    title: 'Add Team Member',
    size: 'md',
  },
  editUser: {
    component: UserForm as any,
    title: 'Edit User',
    size: 'md',
  },
  editFirmDetails: {
    component: FirmDetailsForm as any,
    title: 'Edit Firm Details',
    size: 'lg',
  },
  noTeamMembers: {
    component: NoTeamMembersModal as any,
    title: 'No Team Members',
    size: 'sm',
  },
  newExternalCounsel: {
    component: ExternalCounselInviteForm as any,
    title: 'Invite External Counsel',
    size: 'md',
  },
  externalCounsel: {
    component: ExternalCounselInviteForm as any,
    title: 'External Counsel',
    size: 'md',
  },

  // ─── Workflows & Templates ───────────────────────────────────────────
  newWorkflow: {
    component: WorkflowForm as any,
    title: 'New Workflow',
    size: 'md',
  },
  editWorkflow: {
    component: WorkflowForm as any,
    title: 'Edit Workflow',
    size: 'md',
  },
  newEventType: {
    component: EventTypeForm as any,
    title: 'New Event Type',
    size: 'sm',
  },
  editEventType: {
    component: EventTypeForm as any,
    title: 'Edit Event Type',
    size: 'sm',
  },
  newContactCategory: {
    component: ContactCategoryForm as any,
    title: 'New Contact Category',
    size: 'sm',
  },
  editContactCategory: {
    component: ContactCategoryForm as any,
    title: 'Edit Contact Category',
    size: 'sm',
  },
  newChecklistTemplate: {
    component: ChecklistTemplateForm as any,
    title: 'New Checklist Template',
    size: 'md',
  },
  editChecklistTemplate: {
    component: ChecklistTemplateForm as any,
    title: 'Edit Checklist Template',
    size: 'md',
  },
  newTemplate: {
    component: TemplateForm as any,
    title: 'New Document Template',
    size: 'md',
  },
  editTemplate: {
    component: TemplateForm as any,
    title: 'Edit Document Template',
    size: 'md',
  },
  newTemplateCategory: {
    component: TemplateCategoryForm as any,
    title: 'New Template Category',
    size: 'sm',
  },
  editTemplateCategory: {
    component: TemplateCategoryForm as any,
    title: 'Edit Template Category',
    size: 'sm',
  },

  // ─── Messaging ──────────────────────────────────────────────────────
  newChannel: {
    component: NewChannelForm as any,
    title: 'New Channel',
    size: 'sm',
  },
  newDirectMessage: {
    component: NewDirectMessageForm as any,
    title: 'New Direct Message',
    size: 'sm',
  },

  // ─── Notes & Research ───────────────────────────────────────────────
  newNotebook: {
    component: NotebookForm as any,
    title: 'New Notebook',
    size: 'sm',
  },
  editNotebook: {
    component: NotebookForm as any,
    title: 'Edit Notebook',
    size: 'sm',
  },
  newPage: {
    component: NotePageForm as any,
    title: 'New Page',
    size: 'sm',
  },
  copyPage: {
    component: NotePageForm as any,
    title: 'Copy Page',
    size: 'sm',
  },
  newResearchNotebook: {
    component: NewResearchNotebookForm as any,
    title: 'New Research Notebook',
    size: 'sm',
  },
  addResearchSource: {
    component: AddResearchSourceModal as any,
    title: 'Add Research Source',
    size: 'sm',
  },
  addCaseToNotebook: {
    component: AddCaseToNotebookModal as any,
    title: 'Add Case to Notebook',
    size: 'sm',
  },
  saveToNote: {
    component: SaveToNoteForm as any,
    title: 'Save to Note',
    size: 'md',
  },

  // ─── Leads & Pipeline ───────────────────────────────────────────────
  newLead: {
    component: LeadForm as any,
    title: 'New Lead',
    size: 'sm',
  },
  activateLead: {
    component: ConfirmationModal as any,
    title: 'Convert Lead to Contact?',
    size: 'sm',
  },
  sendIntakeLink: {
    component: SendIntakeLinkModal as any,
    title: 'Send Intake Link',
    size: 'sm',
  },
  sendPostActivationEmail: {
    component: SendPostActivationEmailModal as any,
    title: 'Send Post-Activation Email',
    size: 'sm',
  },

  // ─── Confirmations & Small Modals ────────────────────────────────────
  deleteConfirmation: {
    component: ConfirmationModal as any,
    title: (ctx) => ctx?.title || 'Confirm',
    size: 'sm',
    hideHeader: true,
  },
  aiConsent: {
    // Special wrapping — needs recordConsent mutation
    needsSpecialWrapping: true,
    title: 'AI Consent',
    size: 'sm',
  },
  workspaceSetup: {
    component: WorkspaceSetupModal as any,
    title: 'Workspace Setup',
    size: 'sm',
  },
  joinFirm: {
    component: JoinFirmModal as any,
    title: 'Join Workspace',
    size: 'sm',
  },
  feedback: {
    component: FeedbackForm as any,
    title: 'Send Feedback',
    size: 'md',
  },
  aloaHelp: {
    component: AloaHelpModal as any,
    title: 'AI Assistant Help',
    size: 'sm',
  },
  keyboardShortcuts: {
    component: KeyboardShortcutsModal as any,
    title: 'Keyboard Shortcuts',
    size: 'sm',
  },
  quickLook: {
    component: QuickLookModal as any,
    title: 'Quick Look',
    size: 'md',
  },
  upgradePlan: {
    component: UpgradeModal as any,
    title: 'Upgrade Plan',
    size: 'sm',
  },
  demoUpsell: {
    component: DemoUpsellModal as any,
    title: 'Upgrade to PracticePro',
    size: 'sm',
  },

  // ─── AI Tool Aliases (used by ALOA function calling) ────────────────
  create_matter: {
    component: MatterForm as any,
    title: 'New Matter',
    size: 'lg',
  },
  create_contact: {
    component: ContactForm as any,
    title: 'New Contact',
    size: 'lg',
  },
  create_task: {
    component: TaskForm as any,
    title: 'New Task',
    size: 'md',
  },

  // ─── Not Yet Implemented (placeholders) ─────────────────────────────
  googleDrivePicker: {
    component: (() => <div className="p-8 text-center text-slate-500">Google Drive integration not yet available.</div>) as any,
    title: 'Google Drive',
    size: 'sm',
  },
  onboarding: {
    // OnboardingWizard is rendered separately in App.tsx, not via the modal system.
    // Listed here for documentation.
    needsSpecialWrapping: true,
    title: 'Onboarding',
    size: 'full',
  },
};

export default MODAL_REGISTRY;
