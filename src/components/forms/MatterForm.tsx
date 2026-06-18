import React, { useState, useEffect } from 'react';
import { Matter, User, Contact, WorkflowDefinition, MatterType, CourtType, AppMode, View, ContactType, BillingModel, MatterStatus, ModalType, FirmSpecialty, MatterSpecialtyData, SubscriptionPlan, LitigationParty } from '../../types';
import { useUI } from '../../contexts/UIContext';
import { useExecutionState } from '../../contexts/ExecutionContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useProduct } from '../../contexts/ProductContext';
import { OfficeBuildingIcon, ShieldCheckIcon, GavelIconLarge, CurrencyDollarIcon, PlusIcon, UserCircleIcon as UserIcon, MapPinIcon, CalendarIcon, DesktopComputerIcon as BriefcaseIcon, SearchIcon, XIcon, SaveIcon, PhoneIcon, MailIcon } from '../../constants';
import { UserAssignment } from './UserAssignment';
import { formatNaira, formatNumberWithCommas, parseFormattedNumber, autoFormatSuitTitle } from '../../utils/formatting';
import { analyzePartyName, analyzeMatterIntelligence } from '../../utils/defenseUtils';
import { inputModern } from '../../utils/formStyles';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { MatterIntakeWizard } from './MatterIntakeWizard';
import { ENTERPRISE_WORKFLOWS } from '../../utils/enterpriseWorkflows';

const commonInputClass = inputModern;

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
    const { contacts, matters, workflows, onAddMatter, onUpdateMatter, onClose, currentUser, matterToEdit, appMode, initialContext, openModal, handleAddWorkflow, handleAddWorkflowSubCategory } = props;
    const { addToast } = useUI();
    const { executionState } = useExecutionState();
    const { coreState, isDataLoaded } = useCoreState();
    const { isProperty } = useProduct();
    const dataHandlers = useDataActions();
    const { handleAddContact } = dataHandlers;
    const markAloaActionCompleted = useMutation(api.myFunctions.markAloaActionCompleted);

    const availableWorkflows = executionState.workflows && executionState.workflows.length > 0 ? executionState.workflows : workflows;

    // ── Enterprise Routing ──────────────────────────────────────────────────
    // New matters (not edits) on Enterprise plan go through the guided Intake Wizard
    const isEnterpriseFirm = coreState.firmDetails?.subscriptionPlan === SubscriptionPlan.Enterprise;
    const isCreatingNew = !matterToEdit;
    if (isEnterpriseFirm && isCreatingNew) {
        return (
            <MatterIntakeWizard
                users={coreState.users || []}
                contacts={contacts}
                currentUser={currentUser}
                onClose={onClose}
                onAddMatter={onAddMatter}
            />
        );
    }
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

    // TASK: Determine terminology based on the SELECTED MATTER TYPE, not just
    // the firm's product. In Komplete firms, legal matters should use "Client"
    // and property matters should use "Tenant". This prevents domain lingo
    // leakage (e.g. showing "Tenant" in a Civil litigation matter).
    // MUST be declared AFTER matterType and isLitigation useState calls.
    const matterIsPropertyType = isProperty && !isLitigation && matterType !== MatterType.Civil && matterType !== MatterType.Criminal && matterType !== MatterType.CorporateCommercial && matterType !== MatterType.Family && matterType !== MatterType.MaritimeAdmiralty && matterType !== MatterType.OilGas && matterType !== MatterType.Tax;
    const clientLabel = matterIsPropertyType ? 'Tenant' : 'Client';

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
                lastSaved: new Date().toISOString()
            };
            localStorage.setItem(`draft_newMatter_${currentUser.id}`, JSON.stringify(draft));
        }
    }, [title, matterType, subCategory, clientId, isLitigation, suitNumber, court, billingModel, isEditing, isSubmitting, currentUser]);

    const activeWorkflow = availableWorkflows.find(w => w.type === matterType);
    const subCategoryOptions = activeWorkflow?.subCategories ? Object.keys(activeWorkflow.subCategories) : [];

    useEffect(() => {
        if (!isEditing && subCategory && !subCategoryOptions.includes(subCategory)) {
            setSubCategory('');
        }
    }, [matterType, subCategoryOptions, isEditing]);

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
                    workflow = await Promise.resolve(handleAddWorkflow({
                        firmId: activeFirmId,
                        type: finalMatterType,
                        default: { stages: ['Intake', 'Drafting', 'Review', 'Execution', 'Closed'], suggestions: {} }
                    }));
                }
            }

            if (workflow && subCategory.trim()) {
                const existingSub = workflow.subCategories ? workflow.subCategories[subCategory.trim()] : undefined;
                if (!existingSub) {
                    handleAddWorkflowSubCategory(workflow.id, {
                        [subCategory.trim()]: {
                            stages: ['Intake', 'Processing', 'Review', 'Completed', 'Closed'],
                            suggestions: {}
                        }
                    });
                }
            }

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
                addToast("Matter updated successfully.", { type: 'success' });
            } else {
                const res = await onAddMatter(matterData, clientToCreate);
                const newMatter = res as any; // onAddMatter returns the matter
                
                // Bidirectional Link: Update property with new matterId
                if (newMatter && linkedPropertyId) {
                    const prop = coreState.properties.find(p => p.id === linkedPropertyId);
                    await dataHandlers.updateItem('properties', { ...(prop || {}), id: linkedPropertyId, matterId: newMatter.id }, 'Property Link');
                }

                localStorage.removeItem(`draft_newMatter_${currentUser.id}`); // Clear draft on success
                addToast("Matter created successfully.", { type: 'success' });
                
                // MARK ALOA ACTION COMPLETED
                if (initialContext?.aloaMessageId) {
                    try {
                        await markAloaActionCompleted({ messageId: initialContext.aloaMessageId });
                    } catch (e) {
                        console.error("Failed to mark ALOA action completed:", e);
                    }
                }
            }
            onClose();
        } catch (err: any) {
            console.error("Submission Error:", err);
            addToast(`Failed to save matter: ${err.message || "Unknown Error"}`, { type: 'error' });
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
    const labelClass = "block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-1.5 ml-1";

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
            <div className="p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/50 rounded-xl space-y-2">
                <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-500 dark:text-zinc-400">
                        {roleLabel}s ({list.length})
                    </span>
                    <button type="button" onClick={() => addParty(side, roleLabel)} className="text-[10px] font-bold text-primary-600 dark:text-primary-400 flex items-center gap-1">
                        <PlusIcon className="w-3 h-3" /> Add
                    </button>
                </div>
                {list.length === 0 && (
                    <div className="py-2 text-center text-[10px] text-slate-400 dark:text-zinc-500 italic border border-dashed border-slate-200 dark:border-zinc-700 rounded-lg">
                        No {roleLabel.toLowerCase()}s added
                    </div>
                )}
                <div className="space-y-2">
                    {list.map((p, idx) => (
                        <div key={p.id} className="flex flex-col gap-1.5 p-2 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-700/50 rounded-lg relative">
                            <div className="flex gap-2 items-start">
                                <span className="text-[10px] font-bold text-slate-300 dark:text-zinc-600 w-4 t-1">{idx+1}.</span>
                                <div className="flex-1 space-y-1.5 min-w-0">
                                    <input autoComplete="off" data-lpignore="true" 
                                        className="w-full bg-transparent border-0 outline-none text-sm font-medium p-0 placeholder-slate-300 dark:placeholder-zinc-600 focus:ring-0 dark:text-white"
                                        placeholder={`${roleLabel} Name`}
                                        value={p.name}
                                        onChange={e => updateParty(side, p.id, { name: e.target.value })}
                                    />
                                    {p.isRepresentative && (
                                        <input autoComplete="off" data-lpignore="true" 
                                            className="w-full bg-transparent border-0 outline-none text-[10px] p-0 placeholder-slate-300 dark:placeholder-zinc-600 focus:ring-0 text-amber-600 dark:text-amber-400 font-semibold"
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
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                                        p.isRepresentative 
                                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700/50' 
                                        : 'text-slate-400 border-transparent hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800'
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

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full bg-slate-50 dark:bg-zinc-900">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-4 pb-40 space-y-2 sm:space-y-3">
                
                {/* CLASSIFICATION */}
                <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center gap-3 px-1">
                        <div className="p-1 bg-indigo-600 text-white rounded-lg shadow-sm ring-2 ring-indigo-500/10">
                            <BriefcaseIcon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-indigo-600/70 uppercase tracking-widest leading-none mb-0.5">Details</p>
                            <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">{isProperty ? 'Category' : 'Practice Area'}</h3>
                        </div>
                    </div>

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
                                        className="text-xs text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/10 px-3 rounded-lg transition-colors"
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
                </div>

                {/* MATTER INFORMATION */}
                <div className="p-3 sm:p-4 bg-white dark:bg-zinc-800/80 glass-premium rounded-2xl border border-slate-200 dark:border-zinc-700/50 shadow-sm space-y-2 sm:space-y-3">
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
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase font-black tracking-widest text-primary-500 hover:text-primary-600"
                                >
                                    {titleAutoGenerated ? 'Unlock' : 'Auto'}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2 sm:space-y-3">
                        <div className="flex justify-between items-center mb-1">
                            <label className={labelClass}>{clientLabel}</label>
                            <button
                                type="button"
                                onClick={() => setIsCreatingClient(!isCreatingClient)}
                                className="text-[10px] font-black text-primary-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                            >
                                {isCreatingClient ? 'Cancel & Select' : '+ Create Profile'}
                            </button>
                        </div>

                        {isCreatingClient ? (
                            <div className="p-3 sm:p-4 bg-slate-50/50 dark:bg-zinc-900/50 rounded-2xl border border-slate-100 dark:border-zinc-800 space-y-2 sm:space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                    <input autoComplete="off" data-lpignore="true"  type="text" value={newClientName} onChange={e => setNewClientName(e.target.value)} className={commonInputClass} placeholder={matterIsPropertyType ? 'Tenant Name' : 'Client Legal Name'} />
                                    <input autoComplete="off" data-lpignore="true"  type="email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} className={commonInputClass} placeholder="Contact Email" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                    <div className="relative">
                                        <PhoneIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
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
                                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                <select value={clientId} onChange={e => setClientId(e.target.value)} className={`${commonInputClass} pl-11 ring-primary-500/0 focus:ring-primary-500/20`} required>
                                    <option value="" disabled>{matterIsPropertyType ? '-- Select Tenant --' : '-- Select Client --'}</option>
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
                                <p className="text-[10px] text-slate-400 px-1 italic">
                                    Linking a property synchronizes dispute details and status tracking.
                                </p>
                            </div>
                        )}
                    </div>

                    {appMode === 'multi' && (
                        <div className="pt-4 border-t border-slate-200 dark:border-zinc-700/50">
                            <UserAssignment
                                allUsers={props.users}
                                assignedUserIds={assignedUsers}
                                onToggle={handleUserToggle}
                                appMode={appMode}
                            />
                        </div>
                    )}
                </div>

                {/* BILLING */}
                <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center gap-3 px-1">
                        <div className="p-1 bg-emerald-600 text-white rounded-lg shadow-sm ring-2 ring-emerald-500/10">
                            <CurrencyDollarIcon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest leading-none mb-0.5">Finance</p>
                            <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Billing Settings</h3>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-1">
                        <div className="space-y-1.5">
                            <label className={labelClass}>Billing Model</label>
                            <div className="flex flex-wrap gap-1.5 bg-white dark:bg-zinc-800 p-1 rounded-xl ring-1 ring-slate-200 dark:ring-zinc-700/50 shadow-sm">
                                {Object.values(BillingModel).map((model) => (
                                    <button
                                        key={model}
                                        type="button"
                                        onClick={() => setBillingModel(model)}
                                        className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${billingModel === model ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'}`}
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
                                    <p className="text-[10px] font-medium text-slate-400 mt-2 px-1">Applied to time entries.</p>
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
                                    <p className="text-[10px] font-medium text-slate-400 mt-2 px-1">Consolidated fee structure for the engagement.</p>
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
                                    <p className="col-span-2 text-[10px] font-medium text-slate-400 px-1">Calculated as {billingPercentage}% of the selected basis.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* LITIGATION */}
                <div className="p-3 sm:p-4 bg-slate-100/30 dark:bg-zinc-800/20 rounded-2xl border border-slate-200 dark:border-zinc-700/50 space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-1 rounded-lg shadow-sm transition-all ${isLitigation ? 'bg-rose-600 text-white ring-2 ring-rose-500/10' : 'bg-slate-200 dark:bg-zinc-700 text-slate-500 opacity-50'}`}>
                                <GavelIconLarge className="w-3 h-3" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-rose-600/70 uppercase tracking-widest leading-none mb-0.5">{isProperty ? 'Details' : 'Legal'}</p>
                                <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">{isProperty ? 'Property Details' : 'Case Details'}</h3>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsLitigation(!isLitigation)}
                            className={`w-14 h-7 rounded-full p-1 transition-all duration-500 ease-in-out ${isLitigation ? 'bg-rose-600' : 'bg-slate-300 dark:bg-zinc-700'}`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${isLitigation ? 'translate-x-7' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    {isLitigation && (
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
                                <div className="p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700/50">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">Litigation Parties</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400">Firm Reps:</span>
                                            <div className="flex gap-1">
                                                {['Claimant', 'Defendant'].map(r => (
                                                    <button
                                                        key={r} type="button"
                                                        onClick={() => setRepresentingSide(r as any)}
                                                        className={`px-2 py-1 text-[9px] font-bold rounded transition-colors ${
                                                            representingSide === r 
                                                            ? 'bg-primary-500 text-white shadow-sm'
                                                            : 'bg-slate-200 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'
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
                                    <MapPinIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                    <input autoComplete="off" data-lpignore="true"  type="text" value={courtRoom} onChange={e => setCourtRoom(e.target.value)} className={`${commonInputClass} pl-11`} placeholder="e.g. Court 4, Floor 1" />
                                </div>
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                                <label className={labelClass}>Originating Process</label>
                                <input autoComplete="off" data-lpignore="true"  type="text" value={originatingProcess} onChange={e => setOriginatingProcess(e.target.value)} className={commonInputClass} placeholder="e.g. Originating Summons, Petition..." />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ACTION FOOTER */}
            <div className="sticky bottom-0 left-0 right-0 p-4 sm:p-4 pb-safe-extra bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex flex-wrap-reverse sm:justify-end gap-2 sm:gap-3 z-20">
                <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-lg sm:rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2">
                    <XIcon className="w-3.5 h-3.5" /> Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none px-6 sm:px-10 py-2.5 bg-primary-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg sm:rounded-xl shadow-sm shadow-primary-500/20 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <SaveIcon className="w-3.5 h-3.5" />
                    )}
                    {isEditing ? 'Save Changes' : 'Create Matter'}
                </button>
            </div>
        </form>
    );
};
