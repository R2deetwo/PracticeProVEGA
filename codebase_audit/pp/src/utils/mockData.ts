
import { AppState, UserRole, MatterType, SubscriptionPlan, AppMode, CaseResult } from '../types';

// --- STRICTLY EMPTY STATE ---
// Removed "My Practice" default to prevent UI flashing incorrect data before fetch.
export const EMPTY_APP_STATE: AppState = {
    theme: 'system',
    appMode: AppMode.Multi,
    users: [],
    matters: [],
    contacts: [],
    documents: [],
    tasks: [],
    events: [],
    invoices: [],
    timeEntries: [],
    expenses: [],
    chatConversations: [],
    chatMessages: [],
    clientMessages: [],
    noteNotebooks: [],
    notePages: [],
    workflows: [
        {
            id: 'wf_litigation',
            firmId: 'TEMPLATE',
            type: MatterType.CivilLitigation,
            default: {
                stages: ['Intake', 'Writ/Statement', 'Service', 'Pleadings', 'Trial', 'Judgment', 'Appeal', 'Enforcement'],
                suggestions: {}
            },
            subCategories: {
                'Commercial': { stages: ['Intake', 'Demand Letter', 'ADR', 'Pleadings', 'Trial', 'Judgment'], suggestions: {} },
                'Property': { stages: ['Intake', 'Search', 'Pre-Action Notice', 'Pleadings', 'Trial', 'Recovery'], suggestions: {} },
                'Criminal Defense': { stages: ['Arraignment', 'Bail', 'Trial', 'No Case Submission', 'Defense', 'Judgment'], suggestions: {} },
                'Lease/Tenancy': { stages: ['Instructions', 'Notice to Quit', 'Negotiation', 'Court Filing', 'Hearing', 'Possession'], suggestions: {} }
            }
        },
        {
            id: 'wf_corporate',
            firmId: 'TEMPLATE',
            type: MatterType.CorporateCommercial,
            default: {
                stages: ['Instruction', 'Search', 'Documentation', 'Filing/Registration', 'Completion', 'Dispatch'],
                suggestions: {}
            },
            subCategories: {
                'Pre-Incorporation': { stages: ['Name Reservation', 'CAC 1.1', 'Stamp Duty', 'Certificate', 'SCUML'], suggestions: {} },
                'Post-Incorporation': { stages: ['Instruction', 'Board Resolution', 'Filings', 'Status Report'], suggestions: {} }
            }
        },
        {
            id: 'wf_realestate',
            firmId: 'TEMPLATE',
            type: MatterType.RealEstate,
            default: {
                stages: ['Instruction', 'Search', 'Drafting', 'Execution', 'Governor\'s Consent', 'Registration', 'Completion'],
                suggestions: {}
            },
            subCategories: {
                'Lease/Tenancy': { stages: ['Offer', 'Due Diligence', 'Agreement', 'Payment', 'Handover'], suggestions: {} },
                'Acquisition': { stages: ['Search', 'Contract of Sale', 'Deed of Assignment', 'Perfection'], suggestions: {} }
            }
        }
    ],
    eventTypes: [
        { id: 'et_1', firmId: 'TEMPLATE', name: 'Court Hearing', color: 'red' },
        { id: 'et_2', firmId: 'TEMPLATE', name: 'Client Meeting', color: 'blue' },
        { id: 'et_3', firmId: 'TEMPLATE', name: 'Filing Deadline', color: 'orange' }
    ],
    contactCategories: [
        { id: 'cc_1', firmId: 'TEMPLATE', name: 'Client', product: 'vega' },
        { id: 'cc_2', firmId: 'TEMPLATE', name: 'Judge', product: 'vega' },
        { id: 'cc_3', firmId: 'TEMPLATE', name: 'Opposing Counsel', product: 'vega' }
    ],
    documentCategories: [
        { id: 'cat_clients', firmId: 'TEMPLATE', name: 'Client Documents', parentId: null, isCore: true, product: 'vega' },
        { id: 'cat_court', firmId: 'TEMPLATE', name: 'Court Processes', parentId: null, product: 'vega' },
        { id: 'cat_corp', firmId: 'TEMPLATE', name: 'CAC Forms', parentId: null, product: 'vega' }
    ],
    folderPermissions: {},
    checklistTemplates: [],
    documentTemplates: [],
    documentTemplateCategories: [],
    // Defaults are now empty to force a clean state until data loads
    firmDetails: {
        id: '',
        name: '', // Empty by default
        address: '',
        logoUrl: '',
        areWorkflowsEnabled: true,
        bankAccounts: [],
        aiSettings: { enableAllAiFeatures: true, enableJurisdictionalAnalysis: true },
        integrations: { googleCalendar: false, googleDrive: false, googleContacts: false, googleMeet: false },
        monthlyRevenueTarget: 0,
        subscriptionPlan: SubscriptionPlan.Pro,
        subscriptionAddons: { lawReports: true },
        practiceJurisdictions: {
            federalCourts: ['Supreme Court', 'Court of Appeal', 'Federal High Court'],
            stateCourts: ['Lagos', 'FCT']
        },
        customHolidays: [],
        taxSettings: {
            vatRate: 0.075,
            whtRate: 0.05
        }
    },
    firmActivity: [],
    notifications: [],
    archive: [],
    firmNotices: [],
    dismissedConflictIds: [],
    externalCounselInvites: [],
    researchNotebooks: [],
    researchSources: [],
    researchMessages: [],
    researchAnalysisResults: [],
    bookmarkedCaseIds: [],
    savedViews: [],
    automationRules: [],
    intakeForms: [],
    emails: [],
    leads: [],
    legalModules: [],
    properties: [],
    ledgerEntries: [],
    serviceCharges: [],
    leadsPipeline: [],
    automationLogs: [],
};
export const MOCK_CASE_LAW: CaseResult[] = [];
