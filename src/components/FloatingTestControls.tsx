
// ... (Imports remain the same)
import React, { useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMatterState } from '../contexts/MatterContext';
import { useCoreState } from '../contexts/CoreContext';
import { useDataActions } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { ToolkitIcon, AddDataIcon, PurgeDataIcon, MassiveDataIcon, TimeTravelIcon, BellPlusIcon, TaskGeneratorIcon, CalendarStressIcon, UserGeneratorIcon, ChevronDownIcon, ZapIcon, ShieldCheckIcon, UserCircleIcon, CheckCircleIcon, DismissIcon, GavelIconLarge, CalculatorIcon, DocumentIcon, ResearchIcon, ClipboardListIcon, CalendarIcon } from '../constants';
import { SubscriptionPlan, UserRole, MatterType, TaskPriority, TaskStatus } from '../types';

// ... (Internal components DevButton and AccordionSection remain the same)
const DevButton: React.FC<{
  onClick?: () => void;
  icon: React.FC<{ className?: string }>;
  children: React.ReactNode;
  disabled?: boolean;
  isActive?: boolean;
  colorClass?: string;
  isLoading?: boolean;
}> = ({ onClick, icon: Icon, children, disabled, isActive, colorClass, isLoading }) => (
  <button
    onClick={onClick}
    disabled={disabled || isLoading}
    className={`w-full flex items-center gap-2 p-2 text-sm text-left rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
        isActive 
        ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-200' 
        : colorClass 
            ? `${colorClass} text-white hover:opacity-90` 
            : 'hover:bg-slate-200 dark:hover:bg-zinc-700'
    }`}
  >
     {isLoading ? (
         <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
             <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
         </div>
     ) : (
         <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary-600 dark:text-primary-400' : ''}`} />
     )}
    <span>{children}</span>
  </button>
);

const AccordionSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-200/50 dark:border-white/10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-2 text-sm font-bold text-slate-800 dark:text-white"
      >
        <span>{title}</span>
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="p-2 space-y-1">{children}</div>}
    </div>
  );
};

interface FloatingTestControlsProps {
    isOpen: boolean;
    onClose: () => void;
}

const FloatingTestControls: React.FC<FloatingTestControlsProps> = ({ isOpen, onClose }) => {
    // ... (Hooks and state)
    const { 
        handleAddSimulatedData, handlePurgeData, handleAddMassiveData, handleLoadFinancialData, handleLoadMassiveFinancialData, handleAdvanceTime, 
        handleGenerateTestNotification, handleGenerateTestTasks, handleGenerateTestUsers, handleLoadCalendarData, handleUpdateFirmDetails,
        handleAcceptExternalCounselInvite, handleAddTask, handleAddResearchNotebook, handleAddResearchSource, handleAddLead, updateItem
    } = useDataActions();
    const { matterState } = useMatterState();
    const { coreState, isDataLoaded } = useCoreState();
    const { openModal, closeModal, addToast, navigateTo, openEditor } = useUI();
    // FIX: Removed onCycleUser and toggleAppMode as they do not exist on AuthContextType
    const { appMode, currentUser, loginAsUser, updateCurrentUser, login } = useAuth();
    
    const [position, setPosition] = useState({ x: Math.max(20, window.innerWidth - 340), y: 88 });
    const panelRef = useRef<HTMLDivElement>(null);
    const [taskGenCount, setTaskGenCount] = useState(5);
    const [userGenCount, setUserGenCount] = useState(3);
    const [diagnostics, setDiagnostics] = useState<{name: string, status: 'pass'|'fail', msg: string}[]>([]);
    
    // Loading States for Async Actions
    const [isSimulatingData, setIsSimulatingData] = useState(false);
    const [isSimulatingFinance, setIsSimulatingFinance] = useState(false);
    
    const currentPlan = coreState.firmDetails.subscriptionPlan || SubscriptionPlan.Core;
    const currentRole = currentUser?.role || UserRole.Admin;

    const pendingInvites = coreState.externalCounselInvites.filter(i => i.status === 'pending');
    const externalUsers = coreState.users.filter(u => u.role === 'External Counsel');

    // ... (Helper functions)
    const handlePlanChange = (plan: SubscriptionPlan) => {
        handleUpdateFirmDetails({
            ...coreState.firmDetails,
            subscriptionPlan: plan,
            aiSettings: {
                ...coreState.firmDetails.aiSettings,
                enableAllAiFeatures: plan !== SubscriptionPlan.Core,
                enableJurisdictionalAnalysis: plan !== SubscriptionPlan.Core
            }
        });
        addToast(`Firm Plan switched to ${plan}`, { type: 'success' });
    };

    const handleRoleChange = (role: UserRole) => {
        if (!currentUser) return;
        updateCurrentUser({ role });
        addToast(`Your role is now ${role}`, { type: 'info' });
    };

    const handleGenerateTasks = () => handleGenerateTestTasks({ count: taskGenCount });
    const handleGenerateUsers = () => handleGenerateTestUsers({ count: userGenCount });
    
    const handlePurgeClick = () => {
        openModal('deleteConfirmation', null, {
            title: 'Hard Reset Application?',
            message: (
                <div className="space-y-2">
                    <p>This will <strong>permanently delete all local data</strong>, reset settings, and log you out. This is useful for fixing corrupt data states.</p>
                    <p className="text-red-600 font-bold">This action cannot be undone.</p>
                </div>
            ),
            onConfirm: async () => { 
                await handlePurgeData();
                localStorage.clear(); // Ensure everything is wiped
                closeModal();
                window.location.reload(); 
            },
            confirmText: 'Reset Everything',
            confirmButtonClass: 'bg-red-600 hover:bg-red-700',
            verificationText: 'RESET'
        });
    };
    
    const runStandardDataLoad = async () => {
        setIsSimulatingData(true);
        try {
            await handleAddSimulatedData();
            addToast("Standard Practice Data Loaded", { type: 'success' });
        } catch (e) {
            addToast("Failed to load data", { type: 'error' });
        } finally {
            setIsSimulatingData(false);
        }
    };

    const runFinancialDataLoad = async () => {
        setIsSimulatingFinance(true);
        try {
            await handleLoadFinancialData();
            addToast("Financial Data Loaded", { type: 'success' });
        } catch (e) {
             addToast("Failed to load financials", { type: 'error' });
        } finally {
             setIsSimulatingFinance(false);
        }
    };

    const runDiagnostics = () => {
         const results: {name: string, status: 'pass'|'fail', msg: string}[] = [];
        if (isDataLoaded && Array.isArray(matterState.matters)) {
            results.push({ name: 'Data Store', status: 'pass', msg: `Active (${matterState.matters.length} matters)` });
        } else {
            results.push({ name: 'Data Store', status: 'fail', msg: 'Corrupted or Missing' });
        }
        if (currentUser) {
            results.push({ name: 'Auth Session', status: 'pass', msg: `Logged in as ${currentUser.role}` });
        } else {
            results.push({ name: 'Auth Session', status: 'fail', msg: 'No active user' });
        }
        if (window.AudioContext || (window as any).webkitAudioContext) {
            results.push({ name: 'Audio Engine', status: 'pass', msg: 'Browser Supported' });
        } else {
            results.push({ name: 'Audio Engine', status: 'fail', msg: 'Not Supported by Browser' });
        }
        try {
            const testKey = '__test__';
            localStorage.setItem(testKey, testKey);
            localStorage.removeItem(testKey);
            results.push({ name: 'Storage', status: 'pass', msg: 'Read/Write Access OK' });
        } catch (e) {
            results.push({ name: 'Storage', status: 'fail', msg: 'Persistence Blocked' });
        }
        setDiagnostics(results);
    };

    // ... (rest of test scenarios remain the same)
    // --- AGENT TEST SCENARIOS (Hardened) ---
    const testJurisdictionFederal = () => {
        if (!matterState.contacts.length) { addToast("Please generate data first", {type:'error'}); return; }
        openModal('newMatter', null, {
            title: "Arrest of Vessel MV Ocean King",
            matterType: "Civil Litigation", 
            clientId: matterState.contacts[0].id,
            court: "Federal High Court" 
        });
        addToast("Scenario Loaded: Admiralty Case. Watch for Jurisdiction Tip.", { type: 'info' });
    };

    const testJurisdictionState = () => {
        if (!matterState.contacts.length) { addToast("Please generate data first", {type:'error'}); return; }
        openModal('newMatter', null, {
            title: "Recovery of Premises at 15 Adeola Odeku",
            matterType: "Real Estate",
            clientId: matterState.contacts[0].id,
            court: "Federal High Court" // INTENTIONALLY WRONG
        });
        addToast("Scenario Loaded: Tenancy Case with WRONG court. Watch for AI correction.", { type: 'info' });
    };

    const testTaxCompliance = () => {
        if (!matterState.matters.length) { addToast("Please generate data first", {type:'error'}); return; }
        openModal('newExpense', null, {
            matterId: matterState.matters[0].id,
            description: "Purchase of Armani Suit for Supreme Court Appearance",
            amount: 250000
        });
        addToast("Scenario Loaded: Personal Expense. Click 'Check Deductibility' to test Tax Agent.", { type: 'info' });
    };
    
    const testDocumentAnalysis = () => {
        const mockContract = `TENANCY AGREEMENT... (Truncated for brevity)`;
        openModal('newDocument', null, {
            draftTitle: "Draft Tenancy Agreement (AI Test)",
            draftContent: mockContract,
            categoryId: 'cat_clients'
        });
        addToast("Scenario Loaded. Click 'Save', then open document to run AI Analysis.", { type: 'info' });
    };

    const testDataProtection = () => {
         const sensitiveContent = `CLIENT STATEMENT... My name is Emeka Okafor. My NIN is 11111111111...`;
        openModal('newDocument', null, {
            draftTitle: "Client Statement (PII Test)",
            draftContent: sensitiveContent,
            categoryId: 'cat_clients'
        });
        addToast("Scenario Loaded: Sensitive Data. Save to trigger Redaction Agent.", { type: 'info' });
    };

    const testCourtRules = () => {
        if (!currentUser) return;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 2);
        handleAddTask({
            title: "[FILING DEADLINE] Statement of Defence",
            description: "Generated by Court Rules Agent...",
            status: TaskStatus.Todo,
            priority: TaskPriority.High,
            dueDate: dueDate.toISOString(),
            assignedUsers: [currentUser.id]
        });
        addToast("Agent Output Simulated: Filing Deadline Task created. Check Dashboard.", { type: 'success' });
        // Use timeout to prevent React state collision if called rapidly
        setTimeout(() => navigateTo('dashboard'), 100);
    };

    const testDrafting = () => {
        openEditor(null, { 
            draftTitle: "Motion Ex Parte (Drafting Test)",
            draftPrompt: "Draft a Motion Ex Parte for substituted service in the High Court of Lagos State."
        });
        addToast("Drafting Agent Activated. Watch text generation.", { type: 'info' });
    };

    const testResearch = () => {
        const notebook = handleAddResearchNotebook({ name: "Land Use Act Research (Test)" });
        handleAddResearchSource(notebook.id, {
            name: "Land Use Act 1978 Summary",
            type: "text",
            content: "The Land Use Act vests all land comprised in the territory of each State..."
        });
        addToast("Research Notebook Created. Navigate to Research Studio to test Q&A.", { type: 'success' });
        setTimeout(() => navigateTo('research', null, { selectedResearchNotebookId: notebook.id }), 100);
    };
    
    const testScaleFeeIntake = () => {
        // Create a unique mock ID to avoid collisions
        const mockId = `sim_lead_${Date.now()}`;
        const mockLead = {
            id: mockId,
            firmId: coreState.firmDetails.id,
            name: "Chief Alaba (Scale Fee Test)",
            email: "chief@realestate.ng",
            status: 'Intake Submitted' as any,
            createdAt: new Date().toISOString(),
            intakeRecordings: [], // Required by type but empty for this test
            intakeAnalysis: {
                summary: "Client wants to sell a property at Banana Island.",
                areaOfLaw: "Real Estate",
                matterType: "Real Estate",
                subCategory: "Conveyancing",
                informationGaps: [],
                draftResponse: "",
                lawyerChecklist: [],
                clientNextSteps: [],
                suggestedMatterTitle: "Sale of Plot 4, Banana Island",
                isNewPracticeArea: false,
                applicableLaws: [],
                financialContext: {
                    estimatedValue: 150000000,
                    transactionType: 'Sale',
                    currency: 'NGN',
                    extractedQuote: "I am selling the land for 150 million naira."
                }
            }
        };
        
        // Inject into state directly via updateItem to bypass async creation flow for test
        // Using 'any' cast to bypass strict Lead type check during dev simulation if fields missing
        updateItem('leads', mockLead, 'Simulated Lead');
        
        addToast("Simulated Lead with N150m Property Sale created.", { type: 'success' });
        
        // Navigate to contact detail with delay to ensure state update has propagated
        setTimeout(() => {
             navigateTo('contactDetail', mockId);
        }, 800);
    };

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
         if ((e.target as HTMLElement).closest('button, input, select')) return;
        e.preventDefault();
        const startX = e.clientX - position.x;
        const startY = e.clientY - position.y;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            setPosition({
                x: moveEvent.clientX - startX,
                y: moveEvent.clientY - startY,
            });
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [position]);
    
    const style: React.CSSProperties = { position: 'fixed', top: 0, left: 0, transform: `translate(${position.x}px, ${position.y}px)`, touchAction: 'none' };
    
    if (!isOpen) return null;

    return (
        <div ref={panelRef} style={style} className="hidden md:flex w-72 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-lg border border-gray-200/50 dark:border-white/10 rounded-lg shadow-2xl z-[110] flex-col max-h-[80vh]">
            <div onMouseDown={handleMouseDown} className="flex items-center justify-between p-2 border-b border-gray-200/50 dark:border-white/10 cursor-grab flex-shrink-0">
                <div className="flex items-center gap-2"><ToolkitIcon className="w-5 h-5 mr-0" /><h3 className="font-bold text-slate-800 dark:text-white">{appMode === ('demo' as any) ? "Demo AI Scenarios" : "Dev Toolkit"}</h3></div>
                <button onClick={onClose} aria-label="Collapse developer toolkit" className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700"><ChevronDownIcon className="w-4 h-4"/></button>
            </div>
            <div className="p-2 overflow-y-auto text-slate-800 dark:text-white custom-scrollbar">
                
                <AccordionSection title="AI Agent Lab" defaultOpen>
                     <div className="space-y-1">
                        <DevButton onClick={testJurisdictionFederal} icon={GavelIconLarge} colorClass="bg-purple-600">
                             Test Jurisdiction (FHC)
                        </DevButton>
                         <DevButton onClick={testJurisdictionState} icon={GavelIconLarge} colorClass="bg-purple-600">
                             Test Jurisdiction (State)
                        </DevButton>
                        <DevButton onClick={testTaxCompliance} icon={CalculatorIcon} colorClass="bg-amber-600">
                             Test Tax Compliance
                        </DevButton>
                         <DevButton onClick={testDocumentAnalysis} icon={DocumentIcon} colorClass="bg-blue-600">
                             Test Doc Analysis (ALDIA)
                        </DevButton>
                        <DevButton onClick={testDataProtection} icon={ShieldCheckIcon} colorClass="bg-red-600">
                             Test Data Protection (NDPA)
                        </DevButton>
                        <DevButton onClick={testCourtRules} icon={CalendarIcon} colorClass="bg-orange-600">
                             Test Court Rules (Deadline)
                        </DevButton>
                        <DevButton onClick={testDrafting} icon={ClipboardListIcon} colorClass="bg-emerald-600">
                             Test Drafting Agent
                        </DevButton>
                         <DevButton onClick={testResearch} icon={ResearchIcon} colorClass="bg-indigo-600">
                             Test Research Agent
                        </DevButton>
                         <DevButton onClick={testScaleFeeIntake} icon={CalculatorIcon} colorClass="bg-teal-600">
                             Test Scale Fee (Intake)
                        </DevButton>
                     </div>
                </AccordionSection>

                 <AccordionSection title="Subscription & Roles (Sim)">
                    <div className="space-y-3 p-1">
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Firm Plan</p>
                            <div className="grid grid-cols-2 gap-1">
                                {[SubscriptionPlan.Core, SubscriptionPlan.Growth, SubscriptionPlan.Pro, SubscriptionPlan.Enterprise, SubscriptionPlan.Komplete].map(plan => (
                                    <button 
                                        key={plan}
                                        onClick={() => handlePlanChange(plan)}
                                        className={`px-2 py-1 text-[10px] rounded border ${currentPlan === plan ? 'bg-primary-600 text-white border-primary-600' : 'bg-white dark:bg-zinc-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-zinc-600'}`}
                                    >
                                        {plan}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                             <p className="text-xs font-semibold text-slate-500 uppercase mb-1">My Role</p>
                             <div className="grid grid-cols-1 gap-1">
                                {[UserRole.Admin, UserRole.Lawyer, UserRole.Paralegal].map(role => (
                                    <button 
                                        key={role}
                                        onClick={() => handleRoleChange(role)}
                                        className={`px-2 py-1 text-xs text-left rounded border ${currentRole === role ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-zinc-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-zinc-600'}`}
                                    >
                                        {role}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </AccordionSection>
                <AccordionSection title="System Health">
                    <button 
                        onClick={runDiagnostics} 
                        className="w-full mb-3 py-2 bg-emerald-600 text-white rounded-md text-xs font-bold shadow hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <ShieldCheckIcon className="w-4 h-4" /> Run Diagnostics
                    </button>
                    <div className="space-y-2">
                        {diagnostics.length === 0 && <p className="text-xs text-center text-slate-500 italic">Click above to verify system functionality.</p>}
                        {diagnostics.map((diag, i) => (
                            <div key={i} className={`flex items-center justify-between p-2 rounded border ${diag.status === 'pass' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-900 dark:text-green-300' : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-900 dark:text-red-300'}`}>
                                <div className="flex items-center gap-2">
                                    {diag.status === 'pass' ? <CheckCircleIcon className="w-4 h-4"/> : <DismissIcon className="w-4 h-4"/>}
                                    <span className="text-xs font-bold">{diag.name}</span>
                                </div>
                                <span className="text-[10px] opacity-80">{diag.msg}</span>
                            </div>
                        ))}
                    </div>
                </AccordionSection>
                {appMode !== ('demo' as any) && (
                    <AccordionSection title="Data Management">
                        <DevButton onClick={runStandardDataLoad} icon={AddDataIcon} isLoading={isSimulatingData}>Load Standard Data</DevButton>
                        <DevButton onClick={runFinancialDataLoad} icon={AddDataIcon} isLoading={isSimulatingFinance}>Load Financial Data</DevButton>
                        <DevButton onClick={handlePurgeClick} icon={PurgeDataIcon}>Hard Reset App</DevButton>
                    </AccordionSection>
                )}
            </div>
        </div>
    );
};

export default FloatingTestControls;
