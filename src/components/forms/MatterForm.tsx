import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Matter, User, Contact, WorkflowDefinition, MatterType, CourtType, AppMode, View, ContactType, BillingModel, BillingFrequency, MatterStatus, ModalType, FirmSpecialty, MatterSpecialtyData, LitigationParty } from '../../types';
import { useUI } from '../../contexts/UIContext';
import { useExecutionState } from '../../contexts/ExecutionContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useProduct } from '../../contexts/ProductContext';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import { useFeatures } from '../../hooks/useFeatures';
import { OfficeBuildingIcon, ShieldCheckIcon, GavelIconLarge, CurrencyDollarIcon, PlusIcon, UserCircleIcon as UserIcon, MapPinIcon, CalendarIcon, DesktopComputerIcon as BriefcaseIcon, SearchIcon, XIcon, SaveIcon, PhoneIcon, MailIcon, DocumentTextIcon } from '../../constants';
import { UserAssignment } from './UserAssignment';
import { formatNaira, formatNumberWithCommas, parseFormattedNumber, autoFormatSuitTitle } from '../../utils/formatting';
import { analyzePartyName, analyzeMatterIntelligence } from '../../utils/defenseUtils';
import { inputModern } from '../../utils/formStyles';
import { getInitials, getUserColor } from '../../utils/colorUtils';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
// SIMPLIFY FIX: import removed with the Enterprise branch above.
// import { MatterIntakeWizard } from './MatterIntakeWizard';
import { ENTERPRISE_WORKFLOWS } from '../../utils/enterpriseWorkflows';
import { translateError } from '../../utils/errorTranslator';
import { useAuth } from "../../contexts/AuthContext";

const commonInputClass = inputModern;

// ─── AccordionSection (MODULE-LEVEL — outside MatterForm) ──────────
// CRITICAL: This component MUST be defined outside the component render
// function. When defined inside (as a closure), React treats it as a new
// component type on every render, causing all children to unmount/remount
// on every keystroke — which causes input focus loss.
// By defining it at module level with React.memo, the component identity
// is stable across re-renders, preserving DOM focus.
// (Mirrors the pattern used in PropertyForm.tsx and SmartMatterModal.tsx.)
//
// BUG FIX (Aug 2026): The previous version split the header into a <div>
// wrapper containing a <button flex-1> + accessory + chevron OUTSIDE the
// button. This caused the accordion toggle to be unreliable — the chevron
// and the right edge of the header were not clickable. Rewrote to match
// the WORKING pattern from PropertyForm: the ENTIRE header is a single
// <button> with w-full, and the chevron is INSIDE the button. The only
// exception is when disableHeaderToggle is true (litigation section),
// where the header is a plain <div> and the accessory (toggle switch)
// handles open/close.
interface AccordionSectionProps {
    id: string;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    iconBg: string;
    children: React.ReactNode;
    isOpen: boolean;
    onToggle: (id: string) => void;
    badge?: React.ReactNode;
    /** Optional right-side accessory rendered inline with the chevron (e.g. a toggle switch). */
    accessory?: React.ReactNode;
    /** When true, clicking the header does NOT toggle — used when the header has its own toggle (e.g. litigation). */
    disableHeaderToggle?: boolean;
}
const AccordionSectionInner: React.FC<AccordionSectionProps> = ({ id, title, subtitle, icon, iconBg, children, isOpen, onToggle, badge, accessory, disableHeaderToggle }) => {
    const headerRef = useRef<HTMLButtonElement>(null);

    // When disableHeaderToggle is true (litigation section), the header is
    // a plain <div> — the accessory (toggle switch) handles open/close.
    // Otherwise, the ENTIRE header is a <button> with w-full, so clicking
    // anywhere on the header (including the chevron) toggles the section.
    if (disableHeaderToggle) {
        return (
            <div
                className={`rounded-lg border shadow-sm overflow-hidden ${isOpen ? 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700' : 'bg-slate-50/50 dark:bg-zinc-800/30 border-slate-100 dark:border-zinc-700/50'}`}
            >
                <div className="w-full flex items-center gap-3 p-2.5 sm:p-3">
                    <div className={`p-1 ${iconBg} text-white rounded-md shadow-sm flex-shrink-0`}>
                        {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-2xs font-bold text-slate-600/70 dark:text-zinc-400 uppercase tracking-widest leading-none mb-0.5">{subtitle}</p>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white tracking-tight">{title}</h3>
                    </div>
                    {badge}
                    {accessory}
                </div>
                {isOpen && (
                    <div className="p-2.5 sm:p-3 pt-0 space-y-2">
                        {children}
                    </div>
                )}
            </div>
        );
    }

    // Standard case: entire header is a single <button> with w-full.
    // The chevron is INSIDE the button so clicking anywhere on the header
    // (including the chevron area) toggles the section. This matches the
    // working pattern from PropertyForm.tsx and SmartMatterModal.tsx.
    return (
        <div
            className={`rounded-lg border shadow-sm overflow-hidden ${isOpen ? 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700' : 'bg-slate-50/50 dark:bg-zinc-800/30 border-slate-100 dark:border-zinc-700/50'}`}
        >
            <button
                ref={headerRef}
                type="button"
                tabIndex={0}
                onClick={() => {
                    onToggle(id);
                    if (!isOpen) {
                        setTimeout(() => {
                            headerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }, 50);
                    }
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onToggle(id);
                    }
                }}
                className="w-full flex items-center gap-3 p-2.5 sm:p-3 hover:bg-slate-100/50 dark:hover:bg-zinc-700/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/30 text-left"
            >
                <div className={`p-1 ${iconBg} text-white rounded-md shadow-sm flex-shrink-0`}>
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-2xs font-bold text-slate-600/70 dark:text-zinc-400 uppercase tracking-widest leading-none mb-0.5">{subtitle}</p>
                    <h3 className="text-sm font-black text-slate-800 dark:text-white tracking-tight">{title}</h3>
                </div>
                {badge}
                <svg className={`w-4 h-4 text-slate-400 dark:text-zinc-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && (
                <div className="p-2.5 sm:p-3 pt-0 space-y-2">
                    {children}
                </div>
            )}
        </div>
    );
};
const AccordionSection = React.memo(AccordionSectionInner);

interface MatterFormProps {
    matters: Matter[];
    users: User[];
    contacts: Contact[];
    workflows: WorkflowDefinition[];
    onAddMatter: (matter: Omit<Matter, 'id' | 'referenceNumber'>, client: { data: Omit<Contact, 'id'>, createPortal: boolean } | null) => Promise<void> | void;
    onUpdateMatter: (matter: Matter) => Promise<void> | void;
    onClose: () => void;
    currentUser: User;
    matterToEdit?: Matter;
    appMode: AppMode;
    handleAddWorkflow: (workflow: any) => Promise<WorkflowDefinition> | WorkflowDefinition;
    handleAddWorkflowSubCategory: (id: string, subCategory: any) => void;
    onNavigate: (view: View, id?: string | null, context?: any) => void;
    initialContext?: any;
    openModal?: (modalType: ModalType, id?: string | null, context?: any) => void;
    isCompact?: boolean;
}

export const MatterForm: React.FC<MatterFormProps> = (props) => {
    const { bearerToken } = useAuth();
    const { contacts, matters, workflows, onAddMatter, onUpdateMatter, onClose, currentUser, matterToEdit, appMode, initialContext, openModal, handleAddWorkflow, handleAddWorkflowSubCategory } = props;
    const { addToast } = useUI();
    const { executionState } = useExecutionState();
    const { coreState, isDataLoaded } = useCoreState();
    const { isProperty, terminology } = useProduct();
    const features = useFeatures();
    const dataHandlers = useDataActions();
    const { handleAddContact } = dataHandlers;
    const markAloaActionCompleted = useMutation(api.myFunctions.markAloaActionCompleted);
    const upsertRetainerSchedule = useMutation(api.retainerBilling.upsertMatterRetainerSchedule);
    const { queueMutation, isOnline } = useOfflineQueue();

    const availableWorkflows = executionState.workflows && executionState.workflows.length > 0 ? executionState.workflows : workflows;

    // ── SIMPLIFY FIX: Enterprise de-duplication ───────────────────────────
    // The old branch here routed Enterprise firms to MatterIntakeWizard (a
    // 4-screen wizard), while the SAME firm got SmartMatterModal (a different
    // 2-step creator) when clicking any "New Matter" button (ModalManager
    // intercepts newMatter for Enterprise first). Two creators, one firm,
    // depending on entry point. This branch only fired when ALOA opened the
    // form via DockedModal. Removed: Enterprise now gets the same universal
    // MatterForm here, and SmartMatterModal remains the sole Enterprise
    // creator for the primary button path. MatterIntakeWizard is retired
    // (its extraTasks editor also silently discarded user-entered tasks).
    // ────────────────────────────────────────────────────────────────────────

    // --- State ---
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Core
    const [title, setTitle] = useState('');
    const [matterType, setMatterType] = useState<string>(currentUser.defaultMatterType || (availableWorkflows && availableWorkflows[0]?.type) || '');
    const [isCreatingNewType, setIsCreatingNewType] = useState(false);
    const [newMatterTypeName, setNewMatterTypeName] = useState('');

    const [subCategory, setSubCategory] = useState<string>('');
    const [clientId, setClientId] = useState<string>('');
    const [billingModel, setBillingModel] = useState<BillingModel>(BillingModel.Hourly);
    const [hourlyRate, setHourlyRate] = useState(100000);
    const [fixedFeeAmount, setFixedFeeAmount] = useState(0);
    const [billingPercentage, setBillingPercentage] = useState(2.5);
    const [billingBase, setBillingBase] = useState<'Rent' | 'Value' | 'Outcome' | 'Custom'>('Rent');
    // Retainer auto-billing fields — only active when billingModel === Retainer
    const [billingFrequency, setBillingFrequency] = useState<BillingFrequency>(BillingFrequency.Monthly);
    const [retainerAutoBillingEnabled, setRetainerAutoBillingEnabled] = useState<boolean>(true);
    const [assignedUsers, setAssignedUsers] = useState<Set<string>>(new Set());

    // Litigation Toggle & Fields
    const [isLitigation, setIsLitigation] = useState(false);
    const [suitNumber, setSuitNumber] = useState('');
    const [court, setCourt] = useState<string>(CourtType.FederalHighCourt);
    const [judicialDivision, setJudicialDivision] = useState('');
    const [presidingJudge, setPresidingJudge] = useState('');
    const [courtRoom, setCourtRoom] = useState('');
    const [nextAdjournedDate, setNextAdjournedDate] = useState('');
    const [originatingProcess, setOriginatingProcess] = useState('');
    // Enhanced Multi-Party State
    const [claimants, setClaimants] = useState<LitigationParty[]>([]);
    const [defendants, setDefendants] = useState<LitigationParty[]>([]);
    const [representingSide, setRepresentingSide] = useState<'Claimant'|'Defendant'>('Claimant');
    const [titleAutoGenerated, setTitleAutoGenerated] = useState(true);

    // Corporate
    const [cacAvailabilityCode, setCacAvailabilityCode] = useState('');
    const [rcNumber, setRcNumber] = useState('');
    const [shareCapital, setShareCapital] = useState<number>(0);
    const [annualReturnsDueDate, setAnnualReturnsDueDate] = useState('');

    // Real Estate
    const [propertyValue, setPropertyValue] = useState<number>(0);
    const [titleRegistrationDetails, setTitleRegistrationDetails] = useState('');
    const [transactionStage, setTransactionStage] = useState('');
    const [linkedPropertyId, setLinkedPropertyId] = useState<string>(matterToEdit?.specialtyData?.realEstate?.propertyId || '');

    // Enterprise Specialty Data
    const [specialtyData, setSpecialtyData] = useState<Partial<any>>({});
    // New Client Logic
    const [isCreatingClient, setIsCreatingClient] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientType, setNewClientType] = useState<ContactType>(ContactType.Individual);
    const [newClientEmail, setNewClientEmail] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');

    const isEditing = !!matterToEdit;

    // TASK: Matters ALWAYS use "Client" terminology — never "Tenant".
    // Even in Komplete firms and even for Real Estate matters, the person
    // you're representing in a legal matter is your CLIENT.
    // The user explicitly stated: "in matters you are dealing with clients
    // even if they come from a landlord/tenant issue from the properties section."
    const clientLabel = 'Client';

    // --- EFFECT: ALOA Form Update Listener ---
    useEffect(() => {
        const handleAloaUpdate = (e: any) => {
            const data = e.detail;
            if (!data) return;

            if (data.title !== undefined) setTitle(data.title);
            if (data.matterType !== undefined) setMatterType(data.matterType);
            if (data.subCategory !== undefined) setSubCategory(data.subCategory);
            if (data.clientId !== undefined) setClientId(data.clientId);
            if (data.suitNumber !== undefined) {
                setSuitNumber(data.suitNumber);
                setIsLitigation(true);
            }
            if (data.court !== undefined) {
                setCourt(data.court);
                setIsLitigation(true);
            }
            if (data.presidingJudge !== undefined) setPresidingJudge(data.presidingJudge);
            if (data.billingModel !== undefined) setBillingModel(data.billingModel);
            if (data.propertyValue !== undefined) setPropertyValue(Number(data.propertyValue));
            
            // New client fields
            if (data.newClientName) {
                setIsCreatingClient(true);
                setNewClientName(data.newClientName);
            }
            if (data.newClientEmail) setNewClientEmail(data.newClientEmail);
            if (data.newClientPhone) setNewClientPhone(data.newClientPhone);
            
            addToast("ALOA updated the form with new details.", { type: 'info' });
        };

        window.addEventListener('aloa_update_form', handleAloaUpdate);
        return () => window.removeEventListener('aloa_update_form', handleAloaUpdate);
    }, [addToast]);

    useEffect(() => {
        if (isEditing && matterToEdit) {
            setTitle(matterToEdit.title);
            setMatterType(matterToEdit.type);
            setSubCategory(matterToEdit.subCategory || '');
            const clientExists = contacts.some(c => c.id === matterToEdit.clientId);
            setClientId(clientExists ? matterToEdit.clientId : '');

            setBillingModel(matterToEdit.billingModel);
            setHourlyRate(matterToEdit.hourlyRate);
            setFixedFeeAmount(matterToEdit.fixedFeeAmount || 0);
            setBillingPercentage(matterToEdit.billingPercentage || 2.5);
            setBillingBase(matterToEdit.billingBase || 'Rent');
            // Retainer auto-billing fields — only meaningful when billingModel is Retainer
            setBillingFrequency(matterToEdit.billingFrequency || BillingFrequency.Monthly);
            setRetainerAutoBillingEnabled(matterToEdit.retainerAutoBillingEnabled ?? true);
            setAssignedUsers(new Set(matterToEdit.assignedUsers));

            if (matterToEdit.suitNumber || matterToEdit.court) {
                setIsLitigation(true);
                setSuitNumber(matterToEdit.suitNumber || '');
                setCourt(matterToEdit.court);
                setJudicialDivision(matterToEdit.judicialDivision);
                setPresidingJudge(matterToEdit.presidingJudge || '');
                setCourtRoom(matterToEdit.courtRoom || '');
                setNextAdjournedDate(matterToEdit.nextAdjournedDate || '');
                setOriginatingProcess(matterToEdit.originatingProcess || '');
                if (matterToEdit.parties) {
                    setClaimants(matterToEdit.parties.filter(p => ['Claimant', 'Applicant'].includes(p.role)));
                    setDefendants(matterToEdit.parties.filter(p => ['Defendant', 'Respondent'].includes(p.role)));
                }
                setRepresentingSide((matterToEdit.specialtyData?.firmRepresentingRole as 'Claimant' | 'Defendant') || 'Claimant');
            }

            setRcNumber(matterToEdit.rcNumber || '');
            setShareCapital(matterToEdit.shareCapital || 0);
            setAnnualReturnsDueDate(matterToEdit.annualReturnsDueDate || '');

            setPropertyValue(matterToEdit.propertyValue || 0);
            setTitleRegistrationDetails(matterToEdit.titleRegistrationDetails || '');
            setTransactionStage(matterToEdit.transactionStage || '');

        } else if (initialContext) {
            const context = initialContext.fields || initialContext;
            if (context.title) setTitle(context.title);
            if (context.clientId) setClientId(context.clientId);
            if (context.matterType) {
                setMatterType(context.matterType);
                if (context.matterType === MatterType.CivilLitigation || context.matterType === MatterType.CriminalDefense) {
                    setIsLitigation(true);
                }
            }
            if (context.subCategory) setSubCategory(context.subCategory);
            if (context.suitNumber) {
                setSuitNumber(context.suitNumber);
                setIsLitigation(true);
            }
            if (context.court) setCourt(context.court);
            if (context.presidingJudge) setPresidingJudge(context.presidingJudge);
            if (context.rcNumber) setRcNumber(context.rcNumber);
            if (context.propertyValue) {
                setPropertyValue(Number(context.propertyValue));
                setBillingModel(BillingModel.FixedFee);
            }
            if (appMode === 'multi' && currentUser) setAssignedUsers(new Set([currentUser.id]));
            if (context.newClientName) {
                setIsCreatingClient(true);
                setNewClientName(context.newClientName);
                if (context.newClientPhone) setNewClientPhone(context.newClientPhone);
                if (context.newClientEmail) setNewClientEmail(context.newClientEmail);
            }
        } else {
            // Check for saved draft in localStorage
            const savedDraft = localStorage.getItem(`draft_newMatter_${currentUser.id}`);
            if (savedDraft) {
                try {
                    const draft = JSON.parse(savedDraft);
                    if (draft.title) setTitle(draft.title);
                    if (draft.matterType) setMatterType(draft.matterType);
                    if (draft.subCategory) setSubCategory(draft.subCategory);
                    if (draft.clientId) setClientId(draft.clientId);
                    if (draft.isLitigation) setIsLitigation(draft.isLitigation);
                    if (draft.suitNumber) setSuitNumber(draft.suitNumber);
                    if (draft.court) setCourt(draft.court);
                    if (draft.billingModel) setBillingModel(draft.billingModel);
                    if (draft.billingFrequency) setBillingFrequency(draft.billingFrequency);
                    if (typeof draft.retainerAutoBillingEnabled === 'boolean') setRetainerAutoBillingEnabled(draft.retainerAutoBillingEnabled);
                } catch (e) {
                    console.error("Failed to parse matter draft", e);
                }
            }
            if (appMode === 'multi' && currentUser) setAssignedUsers(new Set([currentUser.id]));
        }
    }, [isEditing, matterToEdit, initialContext, appMode, currentUser, contacts, addToast]);

    // --- EFFECT: Save Draft ---
    useEffect(() => {
        if (!isEditing && !isSubmitting && title && currentUser?.id) {
            const draft = {
                title, matterType, subCategory, clientId, isLitigation, suitNumber, court, billingModel,
                billingFrequency, retainerAutoBillingEnabled,
                lastSaved: new Date().toISOString()
            };
            localStorage.setItem(`draft_newMatter_${currentUser.id}`, JSON.stringify(draft));
        }
    }, [title, matterType, subCategory, clientId, isLitigation, suitNumber, court, billingModel, billingFrequency, retainerAutoBillingEnabled, isEditing, isSubmitting, currentUser]);

    const activeWorkflow = availableWorkflows.find(w => w.type === matterType);
    const subCategoryOptions = activeWorkflow?.subCategories ? Object.keys(activeWorkflow.subCategories) : [];

    // Determine the stages that will be used for this matter.
    // If a sub-category is selected and has stages, use those.
    // Otherwise use the workflow's default stages.
    // This replaces the old generic ['Intake', 'Drafting', 'Review', 'Execution', 'Closed']
    // that was hardcoded when creating a new matter type.
    const effectiveStages = useMemo(() => {
        if (activeWorkflow) {
            if (subCategory && activeWorkflow.subCategories?.[subCategory]?.stages) {
                return activeWorkflow.subCategories[subCategory].stages;
            }
            return activeWorkflow.default?.stages || [];
        }
        return [];
    }, [activeWorkflow, subCategory]);

    const [showWorkflowStages, setShowWorkflowStages] = useState(false);

    // TASK: Removed the useEffect that was CLEARING the subCategory field when
    // the user typed custom text. The old logic was:
    //   if (!isEditing && subCategory && !subCategoryOptions.includes(subCategory)) {
    //       setSubCategory('');
    //   }
    //
    // When subCategoryOptions is empty (no presets), ANY text the user types
    // fails the .includes() check → the effect fires → clears the field.
    // This is why "letters get immediately erased".
    //
    // The fix: only clear subCategory when the MATTER TYPE changes (not when
    // subCategory itself changes), and only if the current subCategory is NOT
    // a custom value (i.e., it was a preset option that no longer applies).
    const prevMatterTypeRef = useRef(matterType);
    useEffect(() => {
        if (matterType !== prevMatterTypeRef.current) {
            // Matter type changed — check if the current subCategory is still valid
            if (!isEditing && subCategory && subCategoryOptions.length > 0 && !subCategoryOptions.includes(subCategory)) {
                setSubCategory('');
            }
            prevMatterTypeRef.current = matterType;
        }
    }, [matterType, subCategoryOptions, isEditing, subCategory]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        if (!title.trim()) {
            addToast("Matter Title is required.", { type: 'error' });
            return;
        }
        if (!clientId && !newClientName.trim()) {
            addToast("Please select an existing client or add a new one.", { type: 'error' });
            return;
        }
        if (isCreatingNewType && !newMatterTypeName.trim()) {
            addToast("Please provide a name for the new practice area.", { type: 'error' });
            return;
        }
        if (isCreatingClient && (!newClientName.trim() || !newClientEmail.trim())) {
            addToast("New Client Name and Email are required.", { type: 'error' });
            return;
        }

        setIsSubmitting(true);
        try {
            const activeFirmId = coreState.firmDetails?.id || currentUser.firmId;
            if (!activeFirmId) throw new Error("Critical Error: No Firm ID found.");

            let finalMatterType = matterType;
            let workflow = availableWorkflows.find(w => w.type === finalMatterType);

            if (isCreatingNewType && newMatterTypeName.trim()) {
                finalMatterType = newMatterTypeName.trim();
                workflow = availableWorkflows.find(w => w.type === finalMatterType);
                if (!workflow) {
                    // Use the effective stages from the workflow preview if available,
                    // otherwise use a sensible default. The old hardcoded generic
                    // ['Intake', 'Drafting', 'Review', 'Execution', 'Closed'] is kept
                    // as the fallback only when no stages were defined.
                    const stagesToUse = effectiveStages.length > 0
                        ? effectiveStages
                        : ['Intake', 'In Progress', 'Closed'];
                    workflow = await Promise.resolve(handleAddWorkflow({
                        firmId: activeFirmId,
                        type: finalMatterType,
                        default: { stages: stagesToUse, suggestions: {} },
                        subCategories: subCategory ? { [subCategory]: { stages: stagesToUse, suggestions: {} } } : {},
                    }));
                }
            }

            // TASK: Removed handleAddWorkflowSubCategory call — it was NEVER
            // defined in the codebase, causing 'p is not a function' error.
            // The sub-category is saved as a plain text field on the matter
            // (matterData.subCategory at line 386). It doesn't need to be
            // registered as a workflow sub-category to function.
            // If we need workflow sub-categories in the future, we'll add a
            // proper mutation in Convex and wire it through the context.

            let finalClientId = clientId;
            let clientToCreate: any = null;
            if (isCreatingClient) {
                const newContactData = {
                    firmId: activeFirmId,
                    name: newClientName,
                    email: newClientEmail,
                    phone: newClientPhone,
                    contactType: newClientType,
                    category: 'Client'
                };
                if (isEditing) {
                    const newContact = await handleAddContact(newContactData, false);
                    if (newContact) finalClientId = newContact.id;
                    else throw new Error("Failed to create new client contact");
                } else {
                    clientToCreate = { data: newContactData, createPortal: false };
                }
            }

            const matterData: any = {
                firmId: activeFirmId,
                title,
                clientId: finalClientId,
                type: finalMatterType as MatterType,
                subCategory,
                billingModel, hourlyRate, fixedFeeAmount, billingPercentage, billingBase,
                // Retainer auto-billing config — passed to backend which enforces
                // premium-tier gating (Vega Growth+/Pro or Komplete).
                billingFrequency: billingModel === BillingModel.Retainer ? billingFrequency : undefined,
                retainerAutoBillingEnabled: billingModel === BillingModel.Retainer ? retainerAutoBillingEnabled : false,
                stage: isEditing ? matterToEdit!.stage : 'Intake',
                stageLastUpdated: new Date().toISOString(),
                status: isEditing ? matterToEdit!.status : MatterStatus.Active,
                assignedUsers: Array.from(assignedUsers),
                billingAccess: []
            };

            if (isLitigation) {
                matterData.suitNumber = suitNumber;
                matterData.court = court;
                matterData.judicialDivision = judicialDivision;
                matterData.presidingJudge = presidingJudge;
                matterData.courtRoom = courtRoom;
                matterData.nextAdjournedDate = nextAdjournedDate;
                matterData.originatingProcess = originatingProcess;
                matterData.opposingCounsel = ''; // Deprecated, using parties

                const partiesList: LitigationParty[] = [
                    ...claimants.filter(p => typeof p.name === 'string' && p.name.trim() !== ''),
                    ...defendants.filter(p => typeof p.name === 'string' && p.name.trim() !== '')
                ];
                matterData.parties = partiesList;
                matterData.specialtyData = {
                    ...(matterToEdit?.specialtyData || {}),
                    firmRepresentingRole: representingSide
                };
            } else {
                matterData.suitNumber = '';
                matterData.court = '';
                matterData.judicialDivision = '';
                matterData.presidingJudge = '';
                matterData.courtRoom = '';
                matterData.nextAdjournedDate = '';
                matterData.originatingProcess = '';
                matterData.opposingCounsel = '';
            }

            if (finalMatterType === MatterType.CorporateCommercial) {
                matterData.cacAvailabilityCode = cacAvailabilityCode;
                matterData.rcNumber = rcNumber;
                matterData.shareCapital = shareCapital;
                matterData.annualReturnsDueDate = annualReturnsDueDate;
                matterData.specialtyData = { corporate: { rcNumber, shareCapital, annualReturnsDueDate } };
            } else if (finalMatterType === MatterType.RealEstate) {
                matterData.propertyValue = propertyValue;
                matterData.titleRegistrationDetails = titleRegistrationDetails;
                matterData.transactionStage = transactionStage;
                matterData.specialtyData = { 
                    realEstate: { 
                        purchasePrice: propertyValue, 
                        titleDocument: titleRegistrationDetails as any,
                        propertyId: linkedPropertyId 
                    } 
                };
            } else if (finalMatterType === MatterType.MaritimeAdmiralty) {
                matterData.specialtyData = { maritime: {} };
            } else if (finalMatterType === MatterType.OilGas) {
                matterData.specialtyData = { oilGas: {} };
            } else if (finalMatterType === MatterType.Tax) {
                matterData.specialtyData = { tax: {} };
            }

            if (isEditing && matterToEdit) {
                await onUpdateMatter({ ...matterToEdit, ...matterData });
                // Update property link if changed
                if (linkedPropertyId) {
                    const prop = coreState.properties.find(p => p.id === linkedPropertyId);
                    if (prop && prop.matterId !== matterToEdit.id) {
                         await dataHandlers.updateItem('properties', { ...prop, id: linkedPropertyId, matterId: matterToEdit.id }, 'Property Link');
                    }
                }
                // ─── Sync retainer schedule on the backend ────────────────
                // This computes nextBillingDate and persists the auto-billing flag.
                // Non-premium firms will have autoBillingEnabled forced to false
                // by the backend (defense-in-depth).
                if (matterData.billingModel === BillingModel.Retainer && matterData.billingFrequency) {
                    try {
                        await upsertRetainerSchedule({
                            matterId: matterToEdit.id,
                            billingFrequency: matterData.billingFrequency,
                            autoBillingEnabled: matterData.retainerAutoBillingEnabled ?? false,
                        });
                    } catch (e) {
                        console.warn('Failed to sync retainer schedule:', e);
                    }
                }
                addToast("Matter updated successfully.", { type: 'success' });
            } else {
                // TASK: Offline queue — if the device is offline, queue the
                // matter creation in localStorage and notify the user.
                // The useOfflineQueue hook will auto-replay when connection returns.
                if (!isOnline) {
                    queueMutation({
                        table: 'matters',
                        data: { ...matterData, userEmail: currentUser?.email },
                        itemName: 'Matter',
                        userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined),
                    });
                    if (clientToCreate) {
                        queueMutation({
                            table: 'contacts',
                            data: { ...clientToCreate.data, userEmail: currentUser?.email },
                            itemName: 'Contact',
                            userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined),
                        });
                    }
                    localStorage.removeItem(`draft_newMatter_${currentUser.id}`);
                    addToast('Matter saved offline. It will sync automatically when you reconnect.', { type: 'info', duration: 6000 });
                    onClose();
                    return;
                }

                const res = await onAddMatter(matterData, clientToCreate);
                const newMatter = res as any; // onAddMatter returns the matter
                
                // Bidirectional Link: Update property with new matterId
                if (newMatter && linkedPropertyId) {
                    const prop = coreState.properties.find(p => p.id === linkedPropertyId);
                    await dataHandlers.updateItem('properties', { ...(prop || {}), id: linkedPropertyId, matterId: newMatter.id }, 'Property Link');
                }

                // ─── Sync retainer schedule on the backend ────────────────
                // Sets nextBillingDate = matter.createdAt + 1 cycle so the
                // cron-based retainer scheduler can pick it up at the right time.
                if (newMatter && matterData.billingModel === BillingModel.Retainer && matterData.billingFrequency) {
                    try {
                        await upsertRetainerSchedule({
                            matterId: newMatter.id,
                            billingFrequency: matterData.billingFrequency,
                            autoBillingEnabled: matterData.retainerAutoBillingEnabled ?? false,
                        });
                    } catch (e) {
                        console.warn('Failed to sync retainer schedule:', e);
                    }
                }

                localStorage.removeItem(`draft_newMatter_${currentUser.id}`); // Clear draft on success
                addToast("Matter created successfully.", { type: 'success' });
                
                // MARK ALOA ACTION COMPLETED
                if (initialContext?.aloaMessageId) {
                    try {
                        await markAloaActionCompleted({ messageId: initialContext.aloaMessageId, userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined) || undefined });
                    } catch (e) {
                        console.error("Failed to mark ALOA action completed:", e);
                    }
                }
            }
            onClose();
        } catch (err: any) {
            console.error("Submission Error:", err);
            addToast(translateError(err, "save matter"), { type: 'error' });
            setIsSubmitting(false);
        }
    };

    const handleMatterTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === '___NEW___') {
            setIsCreatingNewType(true);
            setMatterType('');
        } else {
            setIsCreatingNewType(false);
            setMatterType(val);
            if (val === MatterType.CivilLitigation || val === MatterType.CriminalDefense) {
                setIsLitigation(true);
            }
        }
    };

    const handleUserToggle = (id: string) => {
        setAssignedUsers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const commonInputClass = inputModern;
    const labelClass = "block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 ml-0.5";

    const updatePartyList = (side: 'claimants' | 'defendants', newList: LitigationParty[]) => {
        let newTitle = title;
        if (titleAutoGenerated) {
            newTitle = autoFormatSuitTitle(
                side === 'claimants' ? newList : claimants,
                side === 'defendants' ? newList : defendants
            );
        }
        if (side === 'claimants') setClaimants(newList);
        else setDefendants(newList);
        setTitle(newTitle);
    };

    const addParty = (side: 'claimants' | 'defendants', defaultRole: string) => {
        updatePartyList(side, [...(side === 'claimants' ? claimants : defendants), { id: Math.random().toString(), name: '', role: defaultRole }]);
    };
    const removeParty = (side: 'claimants' | 'defendants', id: string) => {
        updatePartyList(side, (side === 'claimants' ? claimants : defendants).filter((x: any) => x.id !== id));
    };
    const updateParty = (side: 'claimants' | 'defendants', id: string, props: Partial<LitigationParty>) => {
        updatePartyList(side, (side === 'claimants' ? claimants : defendants).map((x: any) => x.id === id ? { ...x, ...props } : x));
    };

    const PartySection = ({ side, roleLabel }: { side: 'claimants' | 'defendants', roleLabel: string }) => {
        const list = side === 'claimants' ? claimants : defendants;
        return (
            <div className="p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/50 rounded-lg space-y-2">
                <div className="flex items-center justify-between px-1">
                    <span className="text-2xs uppercase font-black tracking-widest text-slate-500 dark:text-zinc-400">
                        {roleLabel}s ({list.length})
                    </span>
                    <button type="button" onClick={() => addParty(side, roleLabel)} className="text-2xs font-bold text-primary-600 dark:text-primary-300 dark:text-primary-400 flex items-center gap-1">
                        <PlusIcon className="w-3 h-3" /> Add
                    </button>
                </div>
                {list.length === 0 && (
                    <div className="py-2 text-center text-2xs text-slate-400 dark:text-zinc-500 italic border border-dashed border-slate-200 dark:border-zinc-700 rounded-lg">
                        No {roleLabel.toLowerCase()}s added
                    </div>
                )}
                <div className="space-y-2">
                    {list.map((p, idx) => (
                        <div key={p.id} className="flex flex-col gap-1.5 p-2 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-700/50 rounded-lg relative">
                            <div className="flex gap-2 items-start">
                                <span className="text-2xs font-bold text-slate-300 dark:text-zinc-600 w-4 t-1">{idx+1}.</span>
                                <div className="flex-1 space-y-1.5 min-w-0">
                                    <input autoComplete="off" data-lpignore="true" 
                                        className="w-full bg-transparent border-0 outline-none text-sm font-medium p-0 placeholder-slate-300 dark:placeholder-zinc-600 focus:ring-0 dark:text-white"
                                        placeholder={`${roleLabel} Name`}
                                        value={p.name}
                                        onChange={e => updateParty(side, p.id, { name: e.target.value })}
                                    />
                                    {p.isRepresentative && (
                                        <input autoComplete="off" data-lpignore="true" 
                                            className="w-full bg-transparent border-0 outline-none text-2xs p-0 placeholder-slate-300 dark:placeholder-zinc-600 focus:ring-0 text-amber-600 dark:text-amber-400 font-semibold"
                                            placeholder="Capacity (e.g. Suing as...)"
                                            value={p.capacity || ''}
                                            onChange={e => updateParty(side, p.id, { capacity: e.target.value })}
                                            autoFocus
                                        />
                                    )}
                                </div>
                                <button type="button" onClick={() => removeParty(side, p.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors shrink-0">
                                    <XIcon className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="flex items-center gap-1.5 pl-6 mt-0.5">
                                <button 
                                    type="button"
                                    onClick={() => updateParty(side, p.id, { isRepresentative: !p.isRepresentative, capacity: '' })}
                                    className={`text-3xs font-bold px-1.5 py-0.5 rounded border transition-colors ${
                                        p.isRepresentative 
                                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700/50' 
                                        : 'text-slate-400 border-transparent hover:bg-slate-100 hover:text-slate-600 dark:hover:text-zinc-300 dark:hover:bg-zinc-800'
                                    }`}
                                >
                                    Rep. Action?
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const isApplicant = originatingProcess?.includes('Summons') || originatingProcess?.includes('Motion');
    const cRole = isApplicant ? 'Applicant' : 'Claimant';
    const dRole = isApplicant ? 'Respondent' : 'Defendant';

    // ─── Accordion State ──────────────────────────────────────────────
    // Auto-expand: Practice Area + Client on initial mount. When editing
    // an existing matter with litigation, expand litigation too.
    const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => ({
        classification: true,
        title: false,
        client: true,
        assignedTeam: false,
        billing: false,
        litigation: isLitigation,
    }));
    // Re-sync litigation accordion state when isLitigation flips on via
    // initialContext or matterToEdit load (the useState initializer only
    // runs once on mount, so we need this effect to catch late loads).
    useEffect(() => {
        if (isLitigation && !openSections.litigation) {
            setOpenSections(prev => ({ ...prev, litigation: true }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLitigation]);
    const toggleSection = useCallback((id: string) => {
        setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
    }, []);

    // Avatar-stack badge for Assigned Team (shown when section is collapsed).
    // Renders up to 3 user avatars + an overflow "+N" pill.
    const assignedTeamBadge = useMemo(() => {
        if (openSections.assignedTeam) return null;
        const list = (props.users || []).filter(u => assignedUsers.has(u.id));
        if (list.length === 0) return null;
        const shown = list.slice(0, 3);
        const extra = list.length - shown.length;
        return (
            <div className="flex items-center -space-x-1.5 mr-1">
                {shown.map(u => (
                    <div
                        key={u.id}
                        className={`h-6 w-6 rounded-full flex items-center justify-center text-white font-bold text-[10px] ring-2 ring-white dark:ring-zinc-800 ${getUserColor(u.name)}`}
                        title={u.name}
                    >
                        {getInitials(u.name)}
                    </div>
                ))}
                {extra > 0 && (
                    <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-slate-600 dark:text-zinc-300 font-bold text-[10px] ring-2 ring-white dark:ring-zinc-800">
                        +{extra}
                    </div>
                )}
            </div>
        );
    }, [props.users, assignedUsers, openSections.assignedTeam]);

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            {/* 2. SCROLLABLE FORM BODY — only this section scrolls.
                flex-1 + min-h-0 + overflow-y-auto makes it the scroll
                container. The footer below is a flex-shrink-0 sibling
                that always pins to the bottom of the modal.
                -mt-3 sm:-mt-5 cancels the Modal body's top padding so
                the form content starts flush at the top. */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2 sm:space-y-3 -mt-3 sm:-mt-5 pb-4">

                {/* ── CLASSIFICATION (accordion) ── */}
                <AccordionSection
                    id="classification"
                    isOpen={!!openSections.classification}
                    onToggle={toggleSection}
                    title={isProperty ? 'Category' : 'Practice Area'}
                    subtitle="Classification"
                    icon={<BriefcaseIcon className="w-3.5 h-3.5" />}
                    iconBg="bg-indigo-600"
                >

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-1">
                        <div className="space-y-1.5">
                            <label className={labelClass}>{isProperty ? 'Category' : 'Practice Area'}</label>
                            {!isCreatingNewType ? (
                                <select
                                    value={matterType}
                                    onChange={handleMatterTypeChange}
                                    className={commonInputClass}
                                    required
                                >
                                    <option value="" disabled>{isProperty ? '-- Select Category --' : '-- Select Area --'}</option>
                                    {(availableWorkflows || []).map(w => <option key={w.id} value={w.type}>{w.type}</option>)}
                                    <option value="___NEW___">{isProperty ? '+ Add New Category' : '+ Add New Area'}</option>
                                </select>
                            ) : (
                                <div className="flex gap-2">
                                    <input autoComplete="off" data-lpignore="true" 
                                        type="text"
                                        value={newMatterTypeName}
                                        onChange={e => setNewMatterTypeName(e.target.value)}
                                        placeholder="Enter Area Name..."
                                        className={commonInputClass}
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setIsCreatingNewType(false)}
                                        className="text-xs text-red-500 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-950/40 dark:hover:bg-red-900/10 px-3 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <label className={labelClass}>Sub-Category</label>
                            {subCategoryOptions.length > 0 ? (
                                <select
                                    value={subCategory}
                                    onChange={e => setSubCategory(e.target.value)}
                                    className={commonInputClass}
                                >
                                    <option value="">-- No Sub-Category --</option>
                                    {subCategoryOptions.map(sc => (
                                        <option key={sc} value={sc}>{sc}</option>
                                    ))}
                                    <option value="">Other / Custom</option>
                                </select>
                            ) : (
                                <input autoComplete="off" data-lpignore="true" 
                                    type="text"
                                    value={subCategory}
                                    onChange={e => setSubCategory(e.target.value)}
                                    className={commonInputClass}
                                    placeholder="Optional Sub-Category..."
                                />
                            )}
                        </div>
                    </div>

                    {/* WORKFLOW STAGES PREVIEW — subtle, collapsible */}
                    {matterType && (
                        <div className="mt-1">
                            <button
                                type="button"
                                onClick={() => setShowWorkflowStages(v => !v)}
                                className="flex items-center gap-1.5 text-2xs font-bold text-slate-500 dark:text-zinc-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                            >
                                <svg className={`w-3 h-3 transition-transform ${showWorkflowStages ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                                {effectiveStages.length > 0
                                    ? `Workflow: ${effectiveStages.length} stages`
                                    : 'No workflow stages — click to create'}
                            </button>
                            {showWorkflowStages && (
                                <div className="mt-2 p-2.5 bg-slate-50 dark:bg-zinc-900/50 rounded-lg border border-slate-100 dark:border-zinc-700/50">
                                    {effectiveStages.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {effectiveStages.map((stage, i) => (
                                                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-zinc-800 rounded-md text-2xs font-bold text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                                                    <span className="text-primary-500">{i + 1}.</span> {stage}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-2xs text-slate-500 dark:text-zinc-400 italic mb-2">No workflow defined for this type. A default will be created on save.</p>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => openModal('editWorkflow', activeWorkflow?.id, {
                                            isNewSub: !activeWorkflow,
                                            matterType: matterType,
                                            subCategoryName: subCategory || undefined,
                                        })}
                                        className="mt-2 text-2xs font-bold text-primary-600 dark:text-primary-300 dark:text-primary-400 hover:underline flex items-center gap-1"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        {effectiveStages.length > 0 ? 'Edit stages' : 'Create workflow'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                </AccordionSection>

                {/* ── MATTER TITLE (accordion) ── */}
                <AccordionSection
                    id="title"
                    isOpen={!!openSections.title}
                    onToggle={toggleSection}
                    title="Matter Title"
                    subtitle="Identification"
                    icon={<DocumentTextIcon className="w-3.5 h-3.5" />}
                    iconBg="bg-slate-600"
                >
                    <div className="space-y-1.5">
                        <label className={labelClass}>Matter Title</label>
                        <div className="relative">
                            <input autoComplete="off" data-lpignore="true"
                                type="text"
                                value={title}
                                onChange={e => {
                                    setTitle(e.target.value);
                                    if (isLitigation) setTitleAutoGenerated(false);
                                }}
                                disabled={isLitigation && titleAutoGenerated}
                                className={`${commonInputClass} ${isLitigation && titleAutoGenerated ? 'bg-slate-100 dark:bg-zinc-800 text-slate-500 italic' : ''}`}
                                placeholder="e.g. In the Matter of Land Recovery at Lekki Phase I"
                                required
                            />
                            {isLitigation && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!titleAutoGenerated) {
                                            setTitleAutoGenerated(true);
                                            setTitle(autoFormatSuitTitle(claimants, defendants));
                                        } else {
                                            setTitleAutoGenerated(false);
                                        }
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-2xs uppercase font-black tracking-widest text-primary-500 hover:text-primary-600"
                                >
                                    {titleAutoGenerated ? 'Unlock' : 'Auto'}
                                </button>
                            )}
                        </div>
                    </div>
                </AccordionSection>

                {/* ── CLIENT (accordion) ── */}
                <AccordionSection
                    id="client"
                    isOpen={!!openSections.client}
                    onToggle={toggleSection}
                    title="Client"
                    subtitle="Engagement"
                    icon={<UserIcon className="w-3.5 h-3.5" />}
                    iconBg="bg-indigo-600"
                >
                    <div className="space-y-2 sm:space-y-3">
                        <div className="flex justify-between items-center mb-1">
                            <label className={labelClass}>{clientLabel}</label>
                            <button
                                type="button"
                                onClick={() => setIsCreatingClient(!isCreatingClient)}
                                className="text-2xs font-black text-primary-600 dark:text-primary-300 uppercase tracking-widest hover:underline flex items-center gap-1"
                            >
                                {isCreatingClient ? 'Cancel & Select' : '+ Create Profile'}
                            </button>
                        </div>

                        {isCreatingClient ? (
                            <div className="p-3 sm:p-4 bg-slate-50/50 dark:bg-zinc-900/50 rounded-2xl border border-slate-100 dark:border-zinc-800 space-y-2 sm:space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                    <input autoComplete="off" data-lpignore="true"  type="text" value={newClientName} onChange={e => setNewClientName(e.target.value)} className={commonInputClass} placeholder="Client Legal Name" />
                                    <input autoComplete="off" data-lpignore="true"  type="email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} className={commonInputClass} placeholder="Contact Email" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                    <div className="relative">
                                        <PhoneIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
                                        <input autoComplete="off" data-lpignore="true"  type="tel" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} className={`${commonInputClass} pl-11`} placeholder="Phone Number" />
                                    </div>
                                    <select value={newClientType} onChange={e => setNewClientType(e.target.value as ContactType)} className={commonInputClass}>
                                        <option value={ContactType.Individual}>Individual</option>
                                        <option value={ContactType.Company}>Company</option>
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div className="relative group">
                                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-400 group-focus-within:text-primary-500 transition-colors" />
                                <select value={clientId} onChange={e => setClientId(e.target.value)} className={`${commonInputClass} pl-11 ring-primary-500/0 focus:ring-primary-500/20`} required>
                                    <option value="" disabled>-- Select Client --</option>
                                    {contacts.filter(c => c.category === 'Client').map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Property Link for Real Estate */}
                        {matterType === 'Real Estate' && clientId && (
                            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                                <label className={labelClass}>Link to Property Portfolio</label>
                                <select
                                    value={linkedPropertyId}
                                    onChange={e => setLinkedPropertyId(e.target.value)}
                                    className={commonInputClass}
                                >
                                    <option value="">-- No Linked Property --</option>
                                    {(coreState.properties || []).filter(p => p.contactId === clientId).map(p => (
                                        <option key={p.id} value={p.id}>{p.address.split('\n')[0]}</option>
                                    ))}
                                </select>
                                <p className="text-2xs text-slate-400 dark:text-zinc-400 px-1 italic">
                                    Linking a property synchronizes dispute details and status tracking.
                                </p>
                            </div>
                        )}
                    </div>
                </AccordionSection>

                {/* ── ASSIGNED TEAM (separate accordion — multi-user mode only) ── */}
                {appMode === 'multi' && (
                    <AccordionSection
                        id="assignedTeam"
                        isOpen={!!openSections.assignedTeam}
                        onToggle={toggleSection}
                        title="Assigned Team"
                        subtitle="Matter Access"
                        icon={<UserIcon className="w-3.5 h-3.5" />}
                        iconBg="bg-violet-600"
                        badge={assignedTeamBadge}
                    >
                        <UserAssignment
                            allUsers={props.users}
                            assignedUserIds={assignedUsers}
                            onToggle={handleUserToggle}
                            appMode={appMode}
                        />
                    </AccordionSection>
                )}

                {/* ── BILLING (accordion) ── */}
                <AccordionSection
                    id="billing"
                    isOpen={!!openSections.billing}
                    onToggle={toggleSection}
                    title="Billing Settings"
                    subtitle="Fee Structure"
                    icon={<CurrencyDollarIcon className="w-3.5 h-3.5" />}
                    iconBg="bg-emerald-600"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-1">
                        <div className="space-y-1.5">
                            <label className={labelClass}>Billing Model</label>
                            <div className="flex flex-wrap gap-1.5 bg-white dark:bg-zinc-800 p-1 rounded-lg ring-1 ring-slate-200 dark:ring-zinc-700/50 shadow-sm">
                                {Object.values(BillingModel).map((model) => (
                                    <button
                                        key={model}
                                        type="button"
                                        onClick={() => setBillingModel(model)}
                                        className={`px-3 py-1.5 text-3xs font-black uppercase tracking-widest rounded-lg transition-all ${billingModel === model ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'}`}
                                    >
                                        {model}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2 sm:space-y-3">
                            {billingModel === BillingModel.Hourly && (
                                <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                                    <label className={labelClass}>Standard Hourly Rate (₦)</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₦</div>
                                        <input autoComplete="off" data-lpignore="true" 
                                            type="text"
                                            value={formatNumberWithCommas(hourlyRate)}
                                            onChange={e => setHourlyRate(parseFormattedNumber(e.target.value))}
                                            className={`${commonInputClass} pl-10 text-right`}
                                        />
                                    </div>
                                    <p className="text-2xs font-medium text-slate-400 dark:text-zinc-400 mt-2 px-1">Applied to time entries.</p>
                                </div>
                            )}
                            {(billingModel === BillingModel.FixedFee || billingModel === BillingModel.Retainer || billingModel === BillingModel.Contingency) && (
                                <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                                    <label className={labelClass}>{billingModel === BillingModel.FixedFee ? 'Total Fee' : billingModel === BillingModel.Retainer ? 'Retainer Amount' : 'Contingency Fee'} (₦)</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₦</div>
                                        <input autoComplete="off" data-lpignore="true" 
                                            type="text"
                                            value={formatNumberWithCommas(fixedFeeAmount)}
                                            onChange={e => setFixedFeeAmount(parseFormattedNumber(e.target.value))}
                                            className={`${commonInputClass} pl-10 text-right`}
                                        />
                                    </div>
                                    <p className="text-2xs font-medium text-slate-400 dark:text-zinc-400 mt-2 px-1">Consolidated fee structure for the engagement.</p>
                                </div>
                            )}
                            
                            {billingModel === BillingModel.Percentage && (
                                <div className="animate-in fade-in slide-in-from-right-2 duration-300 grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelClass}>Percentage (%)</label>
                                        <div className="relative">
                                            <input autoComplete="off" data-lpignore="true" 
                                                type="number"
                                                step="0.1"
                                                value={billingPercentage}
                                                onChange={e => setBillingPercentage(parseFloat(e.target.value))}
                                                className={`${commonInputClass} pr-10`}
                                                placeholder="2.5"
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Basis</label>
                                        <select 
                                            value={billingBase} 
                                            onChange={e => setBillingBase(e.target.value as any)}
                                            className={commonInputClass}
                                        >
                                            <option value="Rent">of Rent</option>
                                            <option value="Value">of Property Value</option>
                                            <option value="Outcome">of Outcome / Judgement</option>
                                            <option value="Custom">Custom Base</option>
                                        </select>
                                    </div>
                                    <p className="col-span-2 text-2xs font-medium text-slate-400 dark:text-zinc-400 px-1">Calculated as {billingPercentage}% of the selected basis.</p>
                                </div>
                            )}

                            {/* ─── RETAINER AUTO-BILLING SUB-CONFIG ──────────────────────────
                                Only visible when the user picks "Retainer" as the billing model.
                                Exposes a Payment Frequency selector (Weekly/Monthly/Quarterly/
                                Bi-Annually/Annually) and an auto-invoicing toggle.

                                Feature gate: `canUseRetainerAutoBilling` (Vega Growth+/Pro +
                                Komplete only). Lower-tier users can still select the Retainer
                                model itself (manual invoicing), but the auto-billing toggle is
                                locked and prompts an upgrade.
                            */}
                            {billingModel === BillingModel.Retainer && (
                                <div className="animate-in fade-in slide-in-from-right-2 duration-300 col-span-full mt-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40/60 dark:bg-emerald-900/10 border border-emerald-200/60 dark:border-emerald-800/30 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-2xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest leading-none mb-0.5">Recurring Retainer</p>
                                            <h4 className="text-sm font-bold text-slate-800 dark:text-white">Payment Frequency</h4>
                                            <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                                System auto-generates a draft invoice per cycle, staged for your review in the Billing Monitor.
                                            </p>
                                        </div>
                                        <div className={`shrink-0 px-2 py-1 rounded-full text-3xs font-black uppercase tracking-wider ${features.canUseRetainerAutoBilling ? 'bg-emerald-600 text-white' : 'bg-slate-300 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400'}`}>
                                            {features.canUseRetainerAutoBilling ? 'Premium' : 'Upgrade'}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 bg-white dark:bg-zinc-800 p-1 rounded-lg ring-1 ring-slate-200 dark:ring-zinc-700/50 shadow-sm">
                                        {Object.values(BillingFrequency).map((freq) => (
                                            <button
                                                key={freq}
                                                type="button"
                                                onClick={() => setBillingFrequency(freq)}
                                                className={`px-3 py-1.5 text-3xs font-black uppercase tracking-widest rounded-lg transition-all ${billingFrequency === freq ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'}`}
                                            >
                                                {freq}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Auto-billing toggle — locked for non-premium tiers */}
                                    <div className="flex items-center justify-between gap-3 pt-1">
                                        <div className="flex-1">
                                            <p className="text-2xs font-bold text-slate-700 dark:text-zinc-200">
                                                Automated Invoicing
                                            </p>
                                            <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                                {features.canUseRetainerAutoBilling
                                                    ? 'Enables cron-based invoice generation + email staging.'
                                                    : 'Upgrade to Vega Growth+ or Komplete to enable cron-based auto-invoicing.'}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!features.canUseRetainerAutoBilling) {
                                                    openModal('upgradePlan');
                                                    return;
                                                }
                                                setRetainerAutoBillingEnabled(prev => !prev);
                                            }}
                                            className={`w-11 h-6 rounded-full p-0.5 transition-all duration-500 ease-in-out shrink-0 ${retainerAutoBillingEnabled && features.canUseRetainerAutoBilling ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-zinc-700'}`}
                                            aria-label="Toggle automated retainer invoicing"
                                        >
                                            <div className={`w-5 h-5 bg-white dark:bg-zinc-900 rounded-full shadow-sm transform transition-transform duration-300 ${retainerAutoBillingEnabled && features.canUseRetainerAutoBilling ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>

                                    {retainerAutoBillingEnabled && features.canUseRetainerAutoBilling && (
                                        <div className="flex items-center gap-2 pt-1 text-2xs text-emerald-700 dark:text-emerald-400 font-medium">
                                            <CalendarIcon className="w-3 h-3" />
                                            <span>
                                                Next invoice will stage automatically based on the {billingFrequency.toLowerCase()} cycle starting from matter creation.
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </AccordionSection>

                {/* ── CASE DETAILS / LITIGATION (accordion with toggle accessory) ── */}
                <AccordionSection
                    id="litigation"
                    isOpen={!!openSections.litigation}
                    onToggle={toggleSection}
                    title={isProperty ? 'Property Details' : 'Case Details'}
                    subtitle="Litigation"
                    icon={<GavelIconLarge className="w-3 h-3" />}
                    iconBg={isLitigation ? 'bg-rose-600' : 'bg-slate-400'}
                    disableHeaderToggle={true}
                    accessory={
                        <button
                            type="button"
                            onClick={() => {
                                const next = !isLitigation;
                                setIsLitigation(next);
                                // Auto-expand when turning litigation on, auto-collapse when off.
                                setOpenSections(prev => ({ ...prev, litigation: next }));
                            }}
                            className={`w-14 h-7 rounded-full p-1 transition-all duration-500 ease-in-out shrink-0 ${isLitigation ? 'bg-rose-600' : 'bg-slate-300 dark:bg-zinc-700'}`}
                            aria-label="Toggle litigation details"
                        >
                            <div className={`w-5 h-5 bg-white dark:bg-zinc-900 rounded-full shadow-sm transform transition-transform duration-300 ${isLitigation ? 'translate-x-7' : 'translate-x-0'}`} />
                        </button>
                    }
                >
                    {isLitigation ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="space-y-1.5">
                                <label className={labelClass}>Jurisdiction / Court</label>
                                <select value={court} onChange={e => setCourt(e.target.value)} className={commonInputClass}>
                                    {Object.values(CourtType).map(ct => <option key={ct} value={ct}>{ct}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClass}>Suit Number</label>
                                <input autoComplete="off" data-lpignore="true"  type="text" value={suitNumber} onChange={e => setSuitNumber(e.target.value)} className={commonInputClass} placeholder="e.g. FHC/L/CS/2024" />
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClass}>Judicial Division</label>
                                <input autoComplete="off" data-lpignore="true"  type="text" value={judicialDivision} onChange={e => setJudicialDivision(e.target.value)} className={commonInputClass} placeholder="e.g. Lagos Mainland" />
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClass}>Presiding Judge</label>
                                <input autoComplete="off" data-lpignore="true"  type="text" value={presidingJudge} onChange={e => setPresidingJudge(e.target.value)} className={commonInputClass} placeholder="Enter Name..." />
                            </div>
                            <div className="space-y-1.5 md:col-span-2 mt-2">
                                <div className="p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-700/50">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Litigation Parties</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xs font-bold text-slate-400 dark:text-zinc-400">Firm Reps:</span>
                                            <div className="flex gap-1">
                                                {['Claimant', 'Defendant'].map(r => (
                                                    <button
                                                        key={r} type="button"
                                                        onClick={() => setRepresentingSide(r as any)}
                                                        className={`px-2 py-1 text-3xs font-bold rounded transition-colors ${
                                                            representingSide === r
                                                            ? 'bg-primary-500 text-white shadow-sm'
                                                            : 'bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'
                                                        }`}
                                                    >
                                                        {r === 'Claimant' ? cRole : dRole}s
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <PartySection side="claimants" roleLabel={cRole} />
                                        <PartySection side="defendants" roleLabel={dRole} />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClass}>Court Room</label>
                                <div className="relative">
                                    <MapPinIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
                                    <input autoComplete="off" data-lpignore="true"  type="text" value={courtRoom} onChange={e => setCourtRoom(e.target.value)} className={`${commonInputClass} pl-11`} placeholder="e.g. Court 4, Floor 1" />
                                </div>
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                                <label className={labelClass}>Originating Process</label>
                                <input autoComplete="off" data-lpignore="true"  type="text" value={originatingProcess} onChange={e => setOriginatingProcess(e.target.value)} className={commonInputClass} placeholder="e.g. Originating Summons, Petition..." />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                                <label className={labelClass}>Next Adjourned / Hearing Date</label>
                                <div className="relative">
                                    <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
                                    <input
                                        autoComplete="off"
                                        data-lpignore="true"
                                        type="date"
                                        value={nextAdjournedDate}
                                        onChange={e => setNextAdjournedDate(e.target.value)}
                                        className={`${commonInputClass} pl-11`}
                                        placeholder="Select next hearing date"
                                    />
                                </div>
                                <p className="text-xs text-slate-400">Used for court date reminders via WhatsApp/email (7, 3, and 1 day(s) before). <span className="font-semibold text-primary-600 dark:text-primary-300">Growth+ plan feature.</span></p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-500 dark:text-zinc-400 italic px-1 py-2">
                            Toggle on to add court details, suit number, parties, and hearing dates for this matter.
                        </p>
                    )}
                </AccordionSection>
            </div>

            {/* 3. PINNED BOTTOM FOOTER — flex-shrink-0 sibling of the scroll
                body. Always locks to the absolute bottom of the modal.
                No sticky positioning needed — the flex column layout keeps
                it pinned. Negative margins (-mx-3 -mb-3 sm:-mx-6 sm:-mb-5)
                cancel the Modal body's padding so the footer spans the full
                width edge-to-edge. bg-white + border-t + shadow ensures
                content doesn't bleed under the buttons when scrolling. */}
            <div className="flex-shrink-0 z-20 -mx-3 -mb-3 sm:-mx-6 sm:-mb-5 px-3 py-3 sm:px-6 sm:py-4 pb-safe-extra bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.1)] flex flex-wrap-reverse sm:justify-end gap-2 sm:gap-3">
                <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-semibold rounded-lg sm:rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2">
                    <XIcon className="w-3.5 h-3.5" /> Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none px-6 sm:px-10 py-2.5 bg-primary-600 text-white text-xs font-semibold rounded-lg sm:rounded-lg shadow-sm shadow-primary-500/20 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <SaveIcon className="w-3.5 h-3.5" />
                    )}
                    {isEditing ? 'Save' : `Create ${terminology.matter}`}
                </button>
            </div>
        </form>
    );
};
