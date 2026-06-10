import {
    AppState, MatterStatus, TaskStatus, UserRole, SubscriptionPlan,
    MatterType, BillingModel, ContactType, TaskPriority, Matter, Contact,
    Task, FirmActivity, Document,
    NotePage, NoteNotebook, NoteScope, ResearchNotebook, ResearchSource,
    CalendarEvent, FirmSpecialty
} from '../types';
import { EMPTY_APP_STATE } from './mockData';

// Helper to generate stable demo IDs
const dId = (prefix: string, id: string) => `demo-${prefix}-${id}`;

// Helper: offset from NOW in milliseconds — ensures events always appear in current/upcoming period
const now = () => Date.now();
const daysFromNow = (d: number) => new Date(now() + d * 86400000).toISOString();
const hoursFromNow = (h: number) => new Date(now() + h * 3600000).toISOString();
const daysAgo = (d: number) => new Date(now() - d * 86400000).toISOString();

export const VEGA_DEMO_APP_STATE: AppState = {
    ...EMPTY_APP_STATE,
    firmDetails: {
        ...EMPTY_APP_STATE.firmDetails,
        id: 'demo-firm-id',
        name: 'Badejo & Associates',
        address: 'Plot 14, Admiralty Way, Lekki Phase 1, Lagos',
        subscriptionPlan: SubscriptionPlan.Enterprise,
        subscriptionAddons: { lawReports: true },
        firmSpecialties: [FirmSpecialty.Maritime, FirmSpecialty.Corporate, FirmSpecialty.Tax, FirmSpecialty.RealEstate, FirmSpecialty.OilGas],
        aiSettings: { enableAllAiFeatures: true, enableJurisdictionalAnalysis: true },
        practiceJurisdictions: {
            federalCourts: ['Supreme Court', 'Court of Appeal', 'Federal High Court'],
            stateCourts: ['Lagos', 'FCT', 'Ogun']
        }
    },
    users: [
        { id: dId('u', '1'), name: 'Seun Badejo', email: 'demo@practicepro.ng', role: UserRole.Admin, firmId: 'demo-firm-id', showProTips: true, avatarUrl: 'https://ui-avatars.com/api/?name=Seun+Badejo&background=0D8ABC&color=fff' },
        { id: dId('u', '2'), name: 'Kemi Okonkwo', email: 'kemi@demo.practicepro.ng', role: UserRole.Lawyer, firmId: 'demo-firm-id', showProTips: false, avatarUrl: 'https://ui-avatars.com/api/?name=Kemi+Okonkwo&background=6b46c1&color=fff' },
        { id: dId('u', '3'), name: 'Tunde Abubakar', email: 'tunde@demo.practicepro.ng', role: UserRole.Paralegal, firmId: 'demo-firm-id', showProTips: false, avatarUrl: 'https://ui-avatars.com/api/?name=Tunde+Abubakar&background=38a169&color=fff' }
    ],
    matters: [
        {
            id: dId('m', '1'), firmId: 'demo-firm-id', referenceNumber: 'LIT/2023/042',
            title: 'Industrial Corp v. State Authority', type: MatterType.CivilLitigation,
            clientId: dId('c', '1'), court: 'Federal High Court', judicialDivision: 'Lagos', stage: 'Trial',
            fixedFeeAmount: 7500000, billingModel: BillingModel.FixedFee, status: MatterStatus.Active,
            assignedUsers: [dId('u', '1'), dId('u', '2')], createdAt: daysAgo(120), stageLastUpdated: daysAgo(12), hourlyRate: 0,
            description: 'Claim for wrongful acquisition of industrial property.'
        } as Matter,
        {
            id: dId('m', '7'), firmId: 'demo-firm-id', referenceNumber: 'MAR/2024/011',
            title: 'Arrest of MT Ocean Voyager', type: MatterType.MaritimeAdmiralty, subCategory: 'Ship Arrest (In Rem)',
            clientId: dId('c', '2'), court: 'Federal High Court', judicialDivision: 'Lagos', stage: 'Warrant Procurement',
            billingModel: BillingModel.Hourly, hourlyRate: 75000, status: MatterStatus.Active,
            specialtyId: FirmSpecialty.Maritime,
            specialtyData: {
                maritime: { vesselName: 'MT Ocean Voyager', imoNumber: '9123456', flagState: 'Panama', pAndIClub: 'UK P&I Club', arrestStatus: 'Warrant Issued', arrestPort: 'Apapa Port Complex' }
            },
            assignedUsers: [dId('u', '1')], createdAt: daysAgo(2), stageLastUpdated: daysAgo(1),
            description: 'Application for Warrant of Arrest in Rem over unpaid bunker supplies.'
        } as Matter,
        {
            id: dId('m', '2'), firmId: 'demo-firm-id', referenceNumber: 'CORP/2024/015',
            title: 'Coastal Group Redesign — Legal Advisory', type: MatterType.CorporateCommercial,
            clientId: dId('c', '2'), stage: 'Documentation', billingModel: BillingModel.Hourly, hourlyRate: 35000,
            status: MatterStatus.Active, assignedUsers: [dId('u', '1')], createdAt: daysAgo(60)
        } as Matter,
        {
            id: dId('m', '2'), firmId: 'demo-firm-id', referenceNumber: 'CORP/2024/015',
            title: 'Coastal Group Redesign — Legal Advisory', type: MatterType.CorporateCommercial,
            clientId: dId('c', '2'), stage: 'Documentation', billingModel: BillingModel.Hourly, hourlyRate: 35000,
            status: MatterStatus.Active, assignedUsers: [dId('u', '1')], createdAt: daysAgo(60)
        } as Matter,
        {
            id: dId('m', '4'), firmId: 'demo-firm-id', referenceNumber: 'FAM/2024/003',
            title: 'Family Matter', type: MatterType.FamilyLaw,
            clientId: dId('c', '4'), court: 'Lagos State High Court', judicialDivision: 'Ikeja', stage: 'Mediation',
            billingModel: BillingModel.FixedFee, status: MatterStatus.Active, assignedUsers: [dId('u', '2')], createdAt: daysAgo(45)
        } as Matter,
        {
            id: dId('m', '5'), firmId: 'demo-firm-id', referenceNumber: 'EMP/2024/008',
            title: 'N.A. v. Z-Alpha Bank PLC', type: MatterType.EmploymentLabor,
            clientId: dId('c', '5'), court: 'National Industrial Court', judicialDivision: 'Lagos', stage: 'Pleadings',
            status: MatterStatus.Active, assignedUsers: [dId('u', '2'), dId('u', '3')], createdAt: daysAgo(30)
        } as Matter,
        {
            id: dId('m', '5'), firmId: 'demo-firm-id', referenceNumber: 'EMP/2024/008',
            title: 'N.A. v. Z-Alpha Bank PLC', type: MatterType.EmploymentLabor,
            clientId: dId('c', '5'), court: 'National Industrial Court', judicialDivision: 'Lagos', stage: 'Pleadings',
            status: MatterStatus.Active, assignedUsers: [dId('u', '2'), dId('u', '3')], createdAt: daysAgo(30)
        } as Matter
    ],
    contacts: [
        { id: dId('c', '1'), firmId: 'demo-firm-id', name: 'Chief E.O. (Private Client)', email: 'client1@demo.ng', phone: '08031112222', contactType: ContactType.Individual, category: 'Client' },
        { id: dId('c', '2'), firmId: 'demo-firm-id', name: 'Coastal Group', email: 'legal@coastal.ng', phone: '012772700', contactType: ContactType.Company, category: 'Client' },
        { id: dId('c', '3'), firmId: 'demo-firm-id', name: 'Alhaji M.A. (Real Estate)', email: 'musa@ma-realestate.ng', phone: '08055554444', contactType: ContactType.Individual, category: 'Client' },
        { id: dId('c', '4'), firmId: 'demo-firm-id', name: 'Mrs. F.A. (Private Client)', email: 'funmi@fa.ng', phone: '07033332222', contactType: ContactType.Individual, category: 'Client' },
        { id: dId('c', '5'), firmId: 'demo-firm-id', name: 'N.A. (Former Employee)', email: 'na@demo.ng', phone: '08122223333', contactType: ContactType.Individual, category: 'Client' },
        { id: dId('c', '6'), firmId: 'demo-firm-id', name: 'Horizon Group Legal', email: 'legal@horizon.ng', phone: '014606431', contactType: ContactType.Company, category: 'Client' },
        { id: dId('c', '7'), firmId: 'demo-firm-id', name: 'Hon. Justice I.B. (High Court)', email: 'justice.ib@courts.gov.ng', phone: '', contactType: ContactType.Individual, category: 'Judge' },
        { id: dId('c', '8'), firmId: 'demo-firm-id', name: 'Barrister T.L. (Senior Advocate)', email: 'tayo@chambers.org', phone: '08022221111', contactType: ContactType.Individual, category: 'Opposing Counsel' },
        { id: dId('c', '9'), firmId: 'demo-firm-id', name: 'Regulatory Authority', email: 'help@regulatory.gov.ng', phone: '', contactType: ContactType.Individual, category: 'Government Authority' },
        { id: dId('c', '10'), firmId: 'demo-firm-id', name: 'Z-Alpha Bank Legal Dept.', email: 'legal@z-alpha.com', phone: '', contactType: ContactType.Company, category: 'Opposing Party' }
    ],
    tasks: [
        { id: dId('t', '1'), firmId: 'demo-firm-id', title: 'Prepare Witness Statements', status: TaskStatus.InProgress, matterId: dId('m', '1'), assignedUsers: [dId('u', '2')], dueDate: daysFromNow(3), createdAt: daysAgo(10), priority: TaskPriority.High, creatorId: dId('u', '1') },
        { id: dId('t', '2'), firmId: 'demo-firm-id', title: 'CAC Search for Coastal Plaza', status: TaskStatus.Done, matterId: dId('m', '2'), assignedUsers: [dId('u', '3')], dueDate: daysAgo(5), createdAt: daysAgo(12), priority: TaskPriority.Medium, creatorId: dId('u', '1') },
        { id: dId('t', '3'), firmId: 'demo-firm-id', title: "Draft Governor's Consent Application", status: TaskStatus.Todo, matterId: dId('m', '3'), assignedUsers: [dId('u', '3')], dueDate: daysFromNow(7), createdAt: daysAgo(8), priority: TaskPriority.High, creatorId: dId('u', '1') },
        { id: dId('t', '4'), firmId: 'demo-firm-id', title: 'Client Meeting: Divorce Terms', status: TaskStatus.Done, matterId: dId('m', '4'), assignedUsers: [dId('u', '2')], dueDate: daysAgo(3), createdAt: daysAgo(7), priority: TaskPriority.Medium, creatorId: dId('u', '1') },
        { id: dId('t', '5'), firmId: 'demo-firm-id', title: 'File Statement of Claim', status: TaskStatus.InProgress, matterId: dId('m', '5'), assignedUsers: [dId('u', '2')], dueDate: daysFromNow(2), createdAt: daysAgo(6), priority: TaskPriority.High, creatorId: dId('u', '1') },
        { id: dId('t', '6'), firmId: 'demo-firm-id', title: 'Review Portfolio Spreadsheets', status: TaskStatus.Todo, matterId: dId('m', '6'), assignedUsers: [dId('u', '1')], dueDate: daysFromNow(14), createdAt: daysAgo(4), priority: TaskPriority.Low, creatorId: dId('u', '1') },
        { id: dId('t', '7'), firmId: 'demo-firm-id', title: 'Weekly Report to Managing Partner', status: TaskStatus.Todo, assignedUsers: [dId('u', '1')], dueDate: daysFromNow(1), createdAt: daysAgo(1), priority: TaskPriority.Medium, creatorId: dId('u', '1') },
        { id: dId('t', '8'), firmId: 'demo-firm-id', title: 'Update NBA Stamp Progress', status: TaskStatus.Done, assignedUsers: [dId('u', '3')], dueDate: daysAgo(2), createdAt: daysAgo(9), priority: TaskPriority.Low, creatorId: dId('u', '1') },
        { id: dId('t', 'halfway'), firmId: 'demo-firm-id', title: '🌓 Halfway Point: Finalize Court Brief', status: TaskStatus.InProgress, matterId: dId('m', '1'), assignedUsers: [dId('u', '1')], dueDate: hoursFromNow(24), createdAt: hoursFromNow(-24), priority: TaskPriority.High, description: 'You are now 50% through the allocated time for this document review.', creatorId: dId('u', '1') }
    ],

    notifications: [
        { id: dId('n', '1'), firmId: 'demo-firm-id', userId: dId('u', '1'), message: '🌓 Halfway Point Reminder: "Finalize Court Brief"', link: { view: 'tasks', id: dId('t', 'halfway') }, timestamp: new Date().toISOString(), isRead: false },
        { id: dId('n', '2'), firmId: 'demo-firm-id', userId: dId('u', '1'), message: 'New message from Kemi regarding Coastal Plaza', link: { view: 'messaging', id: dId('conv', '1') }, timestamp: hoursFromNow(-3), isRead: false },
        { id: dId('n', '3'), firmId: 'demo-firm-id', userId: dId('u', '1'), message: 'Invoice Overdue: ADW-2024-001', link: { view: 'billing', id: dId('inv', '3') }, timestamp: daysAgo(1), isRead: false },
    ],

    // =============================
    // CALENDAR EVENTS — All relative to now() so they always appear in the current calendar view.
    // Uses `date`/`endDate` matching the CalendarEvent interface.
    // Includes deliberate conflicts to demo the conflict detection feature.
    // =============================
    events: [
        // This week — Day +2
        {
            id: dId('e', '1'), firmId: 'demo-firm-id', title: 'Pre-Trial Conference — Case 1',
            date: daysFromNow(2), endDate: new Date(now() + 2 * 86400000 + 2 * 3600000).toISOString(),
            matterId: dId('m', '1'), type: 'Court Hearing', status: 'Active',
            assignedUsers: [dId('u', '1'), dId('u', '2')]
        } as CalendarEvent,
        // Tomorrow 1
        {
            id: dId('e', '2'), firmId: 'demo-firm-id', title: 'Client Briefing — Private Lease',
            date: daysFromNow(2), endDate: new Date(now() + 2 * 86400000 + 1 * 3600000).toISOString(),
            matterId: dId('m', '6'), type: 'Client Meeting', status: 'Active',
            assignedUsers: [dId('u', '1')]
        } as CalendarEvent,
        // Tomorrow 2
        {
            id: dId('e', '3'), firmId: 'demo-firm-id', title: 'Draft Review — Statement of Claim',
            date: new Date(now() + 1 * 86400000 + 9 * 3600000).toISOString(),
            endDate: new Date(now() + 1 * 86400000 + 10.5 * 3600000).toISOString(),
            matterId: dId('m', '5'), type: 'Internal', status: 'Active',
            assignedUsers: [dId('u', '2')]
        } as CalendarEvent,
        // Tomorrow 3
        {
            id: dId('e', '4'), firmId: 'demo-firm-id', title: 'CONFLICT: Mediation — Family Matter',
            date: new Date(now() + 1 * 86400000 + 9.5 * 3600000).toISOString(),
            endDate: new Date(now() + 1 * 86400000 + 12.5 * 3600000).toISOString(),
            matterId: dId('m', '4'), type: 'Client Meeting', status: 'Active',
            assignedUsers: [dId('u', '2')]
        } as CalendarEvent,
        // Day +4
        {
            id: dId('e', '5'), firmId: 'demo-firm-id', title: 'Site Inspection — R-Projects',
            date: new Date(now() + 4 * 86400000 + 8 * 3600000).toISOString(),
            endDate: new Date(now() + 4 * 86400000 + 10 * 3600000).toISOString(),
            matterId: dId('m', '3'), type: 'Other', status: 'Active',
            assignedUsers: [dId('u', '3')]
        } as CalendarEvent,
        // Day +6
        {
            id: dId('e', '6'), firmId: 'demo-firm-id', title: 'Mention Hearing — N.A. v. Z-Alpha Bank',
            date: new Date(now() + 6 * 86400000 + 10 * 3600000).toISOString(),
            endDate: new Date(now() + 6 * 86400000 + 10.5 * 3600000).toISOString(),
            matterId: dId('m', '5'), type: 'Court Hearing', status: 'Active',
            assignedUsers: [dId('u', '2')]
        } as CalendarEvent,
        // Next week — Day +9
        {
            id: dId('e', '7'), firmId: 'demo-firm-id', title: 'Board Meeting Prep: Coastal Plaza Advisory',
            date: new Date(now() + 9 * 86400000 + 14 * 3600000).toISOString(),
            endDate: new Date(now() + 9 * 86400000 + 16 * 3600000).toISOString(),
            matterId: dId('m', '2'), type: 'Client Meeting', status: 'Active',
            assignedUsers: [dId('u', '1')]
        } as CalendarEvent,
        // Day +10
        {
            id: dId('e', '8'), firmId: 'demo-firm-id', title: 'Team Strategy Session — Q2 Litigation Pipeline',
            date: new Date(now() + 10 * 86400000 + 9 * 3600000).toISOString(),
            endDate: new Date(now() + 10 * 86400000 + 11 * 3600000).toISOString(),
            type: 'Internal', status: 'Active',
            assignedUsers: [dId('u', '1'), dId('u', '2'), dId('u', '3')]
        } as CalendarEvent,
        // ⚡ CONFLICT 3: Seun triple-booked at same time on Day +10
        {
            id: dId('e', '9'), firmId: 'demo-firm-id', title: 'CONFLICT: NBA Lagos Branch AGM',
            date: new Date(now() + 10 * 86400000 + 9.5 * 3600000).toISOString(),
            endDate: new Date(now() + 10 * 86400000 + 13 * 3600000).toISOString(),
            type: 'Other', status: 'Active',
            assignedUsers: [dId('u', '1')]
        } as CalendarEvent,
        // Day +12
        {
            id: dId('e', '10'), firmId: 'demo-firm-id', title: 'Filing Deadline: Writ of Summons',
            date: new Date(now() + 12 * 86400000 + 12 * 3600000).toISOString(),
            endDate: new Date(now() + 12 * 86400000 + 12.5 * 3600000).toISOString(),
            matterId: dId('m', '1'), type: 'Deadline', status: 'Active',
            assignedUsers: [dId('u', '1'), dId('u', '2')]
        } as CalendarEvent,
        // Day +16
        {
            id: dId('e', '11'), firmId: 'demo-firm-id', title: "Governor's Consent Filing — Riverside Projects",
            date: new Date(now() + 16 * 86400000 + 11 * 3600000).toISOString(),
            endDate: new Date(now() + 16 * 86400000 + 12 * 3600000).toISOString(),
            matterId: dId('m', '3'), type: 'Deadline', status: 'Active',
            assignedUsers: [dId('u', '3')]
        } as CalendarEvent,
        // Past events (so calendar shows history)
        {
            id: dId('e', '12'), firmId: 'demo-firm-id', title: 'Meeting with Coastal Plaza MD',
            date: new Date(now() - 3 * 86400000 + 14 * 3600000).toISOString(),
            endDate: new Date(now() - 3 * 86400000 + 15 * 3600000).toISOString(),
            matterId: dId('m', '2'), type: 'Client Meeting', status: 'Active',
            assignedUsers: [dId('u', '1')]
        } as CalendarEvent,
        {
            id: dId('e', '13'), firmId: 'demo-firm-id', title: 'Initial Interview — Family Client',
            date: new Date(now() - 7 * 86400000 + 10 * 3600000).toISOString(),
            endDate: new Date(now() - 7 * 86400000 + 11 * 3600000).toISOString(),
            matterId: dId('m', '4'), type: 'Client Meeting', status: 'Active',
            assignedUsers: [dId('u', '2')]
        } as CalendarEvent
    ],

    invoices: [
        { 
            id: dId('inv', '1'), firmId: 'demo-firm-id',
            invoiceNumber: 'INV/2023/105',
            issueDate: daysAgo(45),
            dueDate: daysAgo(30),
            status: 'Paid',
            matter: { id: dId('m', '1'), title: 'Commercial Litigation' },
            client: { id: dId('c', '1'), name: 'State Authority' },
            lineItems: [{ id: 'li1', description: 'Appearance and Defense Fee', total: 2500000 }],
            paymentDetails: { id: 'pd1', bankName: 'Zenithar Bank', accountNumber: '1234567890', accountName: 'State Authority' },
            subTotal: 2500000,
            taxAmount: 0,
            total_amount: 2500000
        } as any,
        { 
            id: dId('inv', '2'), firmId: 'demo-firm-id',
            invoiceNumber: 'INV/2024/002',
            issueDate: daysAgo(10),
            dueDate: daysFromNow(5),
            status: 'Sent',
            matter: { id: dId('m', '3'), title: 'Property Perfection' },
            client: { id: dId('c', '3'), name: 'Musa A.' },
            lineItems: [{ id: 'li2', description: 'Drafting of Agreements', total: 1000000 }],
            paymentDetails: { id: 'pd1', bankName: 'Zenithar Bank', accountNumber: '1234567890', accountName: 'Practice Firm' },
            subTotal: 1000000,
            taxAmount: 0,
            total_amount: 1000000
        } as any,
        { 
            id: dId('inv', '3'), firmId: 'demo-firm-id',
            invoiceNumber: 'INV/2024/005',
            issueDate: daysAgo(20),
            dueDate: daysAgo(10),
            status: 'Overdue',
            matter: { id: dId('m', '4'), title: 'Family Law Matter' },
            client: { id: dId('c', '2'), name: 'Funmi A.' },
            lineItems: [{ id: 'li3', description: 'Mediation Services', total: 500000 }],
            paymentDetails: { id: 'pd1', bankName: 'Zenithar Bank', accountNumber: '1234567890', accountName: 'Practice Firm' },
            subTotal: 500000,
            taxAmount: 0,
            total_amount: 500000
        } as any,
        { 
            id: dId('inv', '4'), firmId: 'demo-firm-id',
            invoiceNumber: 'INV/2024/008',
            issueDate: daysAgo(5),
            dueDate: daysFromNow(30),
            status: 'Draft',
            matter: { id: dId('m', '5'), title: 'Corporate Filings' },
            client: { id: dId('c', '5'), name: 'Tech Solutions' },
            lineItems: [{ id: 'li4', description: 'Filing of Court Processes', total: 750000 }],
            paymentDetails: { id: 'pd1', bankName: 'Zenithar Bank', accountNumber: '1234567890', accountName: 'Practice Firm' },
            subTotal: 750000,
            taxAmount: 0,
            total_amount: 750000
        } as any
    ],

    documents: [
        { id: dId('d', '1'), firmId: 'demo-firm-id', title: 'Writ of Summons (Draft)', matter: { id: dId('m', '1'), title: 'Alpha Industrial v. State Authority' }, dateFiled: daysAgo(100), assignedUsers: [dId('u', '1')], categoryId: 'cat_court', file: { name: 'writ_of_summons.pdf', type: 'application/pdf', size: 1048576, filePath: 'writ_of_summons.pdf', dataUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' } } as unknown as Document,
        { id: dId('d', '2'), firmId: 'demo-firm-id', title: 'Coastal Plaza CAC Certificate', matter: { id: dId('m', '2'), title: 'Coastal Plaza Redesign Project — Legal Advisory' }, dateFiled: daysAgo(55), assignedUsers: [dId('u', '1')], categoryId: 'cat_corp', file: { name: 'cac_cert.jpg', type: 'image/jpeg', size: 512000, filePath: 'cac_cert.jpg', dataUrl: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=1200' } } as unknown as Document,
        { id: dId('d', '3'), firmId: 'demo-firm-id', title: 'Executed Deed of Assignment', matter: { id: dId('m', '3'), title: 'Riverside Projects Acquisition & Perfection' }, dateFiled: daysAgo(40), assignedUsers: [dId('u', '3')], categoryId: 'cat_clients', content: '<p>This Deed of Assignment is made between Alhaji Musa Ayinde (Vendor) and Riverside Projects Ltd (Purchaser)...</p>' } as unknown as Document,
        { id: dId('d', '4'), firmId: 'demo-firm-id', title: 'NDA — Horizon Lease Review', matter: { id: dId('m', '6'), title: 'Horizon Properties — Lease Portfolio Review' }, dateFiled: daysAgo(4), assignedUsers: [dId('u', '1')], categoryId: 'cat_clients', content: '<p>Non-Disclosure Agreement between Badejo &amp; Associates and Oduduwa Group Legal regarding the Lease Portfolio Review.</p>' } as unknown as Document,
        { id: dId('d', '5'), firmId: 'demo-firm-id', title: 'Terms of Settlement (Proposed)', matter: { id: dId('m', '4'), title: 'Family Matter' }, dateFiled: daysAgo(15), assignedUsers: [dId('u', '2')], categoryId: 'cat_clients', content: '<p>Proposed terms of settlement in the matrimonial matter of Adewale v. Adewale.</p>' } as unknown as Document
    ],

    // NoteNotebook — required for the Notes view to work without Convex
    noteNotebooks: [
        { id: dId('nb', '1'), firmId: 'demo-firm-id', userId: dId('u', '1'), name: 'Firm Notes', color: '#0D8ABC', scope: NoteScope.Firm, isCore: true } as NoteNotebook,
        { id: dId('nb', '2'), firmId: 'demo-firm-id', userId: dId('u', '2'), name: "Kemi's Notes", color: '#6b46c1', scope: NoteScope.Private, isCore: false } as NoteNotebook,
    ],

    notePages: [
        {
            id: dId('n', '1'), firmId: 'demo-firm-id',
            title: 'Trial Strategy — Litigation Case',
            content: '<h2>Litigation Strategy</h2><p>Core strategy: challenge the validity of the compulsory acquisition notice under the Land Use Act. Key witness: the Surveyor General.</p><ul><li>File motion to compel disclosure of acquisition file</li><li>Brief expert witness on property valuation</li></ul>',
            notebookId: dId('nb', '1'), parentId: null,
            matterId: dId('m', '1'), authorId: dId('u', '1'),
            createdAt: daysAgo(10), updatedAt: daysAgo(1),
            order: 0, type: 'user'
        } as NotePage,
        {
            id: dId('n', '2'), firmId: 'demo-firm-id',
            title: 'Riverside Projects — Governor\'s Consent Checklist',
            content: '<h2>Documents Required</h2><ul><li>Deed of Assignment (Executed) ✅</li><li>Survey Plan with Coordinates ✅</li><li>Application Letter to the Governor</li><li>Capital Gains Tax Clearance</li><li>Stamp Duty Receipt</li></ul>',
            notebookId: dId('nb', '1'), parentId: null,
            matterId: dId('m', '3'), authorId: dId('u', '3'),
            createdAt: daysAgo(7), updatedAt: daysAgo(2),
            order: 1, type: 'user'
        } as NotePage,
    ],

    researchNotebooks: [
        { id: dId('rn', '1'), firmId: 'demo-firm-id', userId: dId('u', '1'), name: 'Nigerian Land Law Research' } as ResearchNotebook
    ],

    researchSources: [
        { id: dId('rs', '1'), firmId: 'demo-firm-id', notebookId: dId('rn', '1'), name: 'Land Use Act 1978', type: 'pdf', content: 'The Land Use Act (Cap L5, LFN 2004) vests all land in each state in the Governor...' } as ResearchSource,
        { id: dId('rs', '2'), firmId: 'demo-firm-id', notebookId: dId('rn', '1'), name: "Supreme Court on Governor's Consent", type: 'text', content: 'The Supreme Court has held that failure to obtain Governor\'s Consent renders a transaction void ab initio...' } as ResearchSource
    ],

    firmActivity: [
        { id: dId('act', '1'), firmId: 'demo-firm-id', userId: dId('u', '1'), userName: 'Seun Badejo', action: 'Created', timestamp: daysAgo(5), targetType: 'Matter', targetName: 'D-Eagle Group — Lease Portfolio Review' } as FirmActivity,
        { id: dId('act', '2'), firmId: 'demo-firm-id', userId: dId('u', '3'), userName: 'Tunde Abubakar', action: 'Completed', timestamp: daysAgo(8), targetType: 'Task', targetName: 'CAC Search for Coastal Plaza' } as FirmActivity,
        { id: dId('act', '3'), firmId: 'demo-firm-id', userId: dId('u', '1'), userName: 'Seun Badejo', action: 'Sent', timestamp: daysAgo(10), targetType: 'Invoice', targetName: 'INV/2024/002' } as FirmActivity,
        { id: dId('act', '4'), firmId: 'demo-firm-id', userId: dId('u', '3'), userName: 'Tunde Abubakar', action: 'Uploaded', timestamp: daysAgo(40), targetType: 'Document', targetName: 'Executed Deed of Assignment' } as FirmActivity,
        { id: dId('act', '5'), firmId: 'demo-firm-id', userId: dId('u', '2'), userName: 'Tunde Abubakar', action: 'Updated', timestamp: daysAgo(2), targetType: 'Matter', targetName: 'Nkechi Adesanya v. Stellar Bank' } as FirmActivity,
    ],
    properties: []
};

export const ATRIUM_DEMO_APP_STATE: AppState = {
    ...EMPTY_APP_STATE,
    firmDetails: {
        ...EMPTY_APP_STATE.firmDetails,
        id: 'atrium-demo-firm-id',
        name: 'Atrium Management Partners',
        address: '100 Property Avenue, VI, Lagos',
        subscriptionPlan: SubscriptionPlan.Enterprise,
        subscriptionAddons: { lawReports: false },
        firmSpecialties: [FirmSpecialty.RealEstate],
        aiSettings: { enableAllAiFeatures: true, enableJurisdictionalAnalysis: false },
        practiceJurisdictions: { federalCourts: [], stateCourts: [] }
    },
    contactCategories: [
        { id: 'scc_1', firmId: 'atrium-demo-firm-id', name: 'Client' },
        { id: 'scc_2', firmId: 'atrium-demo-firm-id', name: 'Tenant' },
        { id: 'scc_3', firmId: 'atrium-demo-firm-id', name: 'Contractor' },
        { id: 'scc_4', firmId: 'atrium-demo-firm-id', name: 'Agent' }
    ],
    users: [
        { id: dId('su', '1'), name: 'David Atrium', email: 'demo@practicepro.ng', role: UserRole.Admin, firmId: 'atrium-demo-firm-id', showProTips: true, avatarUrl: 'https://ui-avatars.com/api/?name=David+Atrium&background=2563eb&color=fff' },
        { id: dId('su', '2'), name: 'Sarah Property', email: 'sarah@demo.practicepro.ng', role: UserRole.Lawyer, firmId: 'atrium-demo-firm-id', showProTips: false, avatarUrl: 'https://ui-avatars.com/api/?name=Sarah+Property&background=10b981&color=fff' }
    ],
    matters: [],
    contacts: [
        { id: dId('sc', '1'), firmId: 'atrium-demo-firm-id', name: 'Dr. John Doe', email: 'johndoe@tenant.com', phone: '08022223333', contactType: ContactType.Individual, category: 'Client' },
        { id: dId('sc', '2'), firmId: 'atrium-demo-firm-id', name: 'Z-Alpha Logistics Ltd', email: 'ops@zalpha.com', phone: '012224444', contactType: ContactType.Company, category: 'Client' },
        { id: dId('sc', '3'), firmId: 'atrium-demo-firm-id', name: 'Horizon Properties', email: 'investments@horizon.com', phone: '014445555', contactType: ContactType.Company, category: 'Client' }
    ],
    tasks: [
        { id: dId('st', '1'), firmId: 'atrium-demo-firm-id', title: 'Conduct Q2 Inspection — Lekki Heights', status: TaskStatus.Todo, assignedUsers: [dId('su', '1')], dueDate: daysFromNow(2), createdAt: daysAgo(5), priority: TaskPriority.Medium, creatorId: dId('su', '1') },
        { id: dId('st', '2'), firmId: 'atrium-demo-firm-id', title: 'Renew Lease Agreement for Unit A1', status: TaskStatus.InProgress, assignedUsers: [dId('su', '2')], dueDate: daysFromNow(5), createdAt: daysAgo(2), priority: TaskPriority.High, creatorId: dId('su', '1') },
        { id: dId('st', '3'), firmId: 'atrium-demo-firm-id', title: 'Arrange AC Servicing for Shop 02', status: TaskStatus.Done, assignedUsers: [dId('su', '1')], dueDate: daysAgo(1), createdAt: daysAgo(10), priority: TaskPriority.Medium, creatorId: dId('su', '2') }
    ],
    notifications: [
        { id: dId('sn', '1'), firmId: 'atrium-demo-firm-id', userId: dId('su', '1'), message: 'Lease Renewal Upcoming: Unit A1', link: { view: 'tasks', id: dId('st', '2') }, timestamp: hoursFromNow(-2), isRead: false },
        { id: dId('sn', '2'), firmId: 'atrium-demo-firm-id', userId: dId('su', '1'), message: 'Rent Overdue: Warehouse Block 4', link: { view: 'properties', id: dId('sp', '2') }, timestamp: daysAgo(1), isRead: false }
    ],
    events: [
        {
            id: dId('se', '1'), firmId: 'atrium-demo-firm-id', title: 'Site Inspection — Heritage Mall',
            date: daysFromNow(2), endDate: new Date(now() + 2 * 86400000 + 2 * 3600000).toISOString(),
            type: 'Client Meeting', status: 'Active', assignedUsers: [dId('su', '1')]
        } as CalendarEvent
    ],
    invoices: [
        { 
            id: dId('sinv', '1'), firmId: 'atrium-demo-firm-id',
            invoiceNumber: 'INV/RENT/24-001', issueDate: daysAgo(15), dueDate: daysFromNow(15), status: 'Sent',
            client: { id: dId('sc', '1'), name: 'Dr. John Doe' },
            lineItems: [{ id: 'sli1', description: 'Annual Rent — Unit A1', total: 4500000 }],
            paymentDetails: { id: 'spd1', bankName: 'Zenithar Bank', accountNumber: '1234567890', accountName: 'Atrium Management' },
            subTotal: 4500000, taxAmount: 0, total_amount: 4500000
        } as any,
        { 
            id: dId('sinv', '2'), firmId: 'atrium-demo-firm-id',
            invoiceNumber: 'INV/SERV/24-002', issueDate: daysAgo(30), dueDate: daysAgo(5), status: 'Overdue',
            client: { id: dId('sc', '2'), name: 'Z-Alpha Logistics Ltd' },
            lineItems: [{ id: 'sli2', description: 'Annual Service Charge', total: 1500000 }],
            paymentDetails: { id: 'spd1', bankName: 'Zenithar Bank', accountNumber: '1234567890', accountName: 'Atrium Management' },
            subTotal: 1500000, taxAmount: 0, total_amount: 1500000
        } as any
    ],
    documents: [
        { id: dId('sd', '1'), firmId: 'atrium-demo-firm-id', title: 'Lease Agreement (Draft)', dateFiled: daysAgo(2), assignedUsers: [dId('su', '2')], categoryId: 'cat_clients', file: { name: 'lease_agreement.pdf', type: 'application/pdf', size: 1048576, filePath: 'lease_agreement.pdf', dataUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' } } as unknown as Document
    ],
    noteNotebooks: [
        { id: dId('snb', '1'), firmId: 'atrium-demo-firm-id', userId: dId('su', '1'), name: 'Property Management Notes', color: '#2563eb', scope: NoteScope.Firm, isCore: true } as NoteNotebook
    ],
    notePages: [
        {
            id: dId('snp', '1'), firmId: 'atrium-demo-firm-id',
            title: 'Tenant Onboarding Checklist',
            content: '<h2>Steps</h2><ul><li>Verify Employment</li><li>Collect ID</li><li>Sign Lease</li><li>Handover Keys</li></ul>',
            notebookId: dId('snb', '1'), parentId: null,
            authorId: dId('su', '1'),
            createdAt: daysAgo(10), updatedAt: daysAgo(1),
            order: 0, type: 'user'
        } as NotePage
    ],
    researchNotebooks: [],
    researchSources: [],
    firmActivity: [
        { id: dId('sact', '1'), firmId: 'atrium-demo-firm-id', userId: dId('su', '1'), userName: 'David Atrium', action: 'Created', timestamp: daysAgo(1), targetType: 'Invoice', targetName: 'INV/RENT/24-001' } as FirmActivity
    ],
    properties: [
        {
            id: dId('sp', '4'), firmId: 'atrium-demo-firm-id', contactId: dId('sc', '1'),
            address: 'Parkview Gardens, 5 Golf Estate Road, GRA, Port Harcourt',
            category: 'Tenanted Property', propertyType: 'Residential', status: 'Partially Occupied',
            value: 780000000,
            numberOfUnits: 8,
            units: [
                { id: 'spu-1', name: 'Unit 1A', floor: 1, status: 'Occupied', tenantName: 'Mr. Emeka Obi', rentAmount: 3200000, leaseStart: daysAgo(90), leaseEnd: daysFromNow(275) },
                { id: 'spu-2', name: 'Unit 1B', floor: 1, status: 'Occupied', tenantName: 'Mrs. Funke Adeyemi', rentAmount: 3200000, leaseStart: daysAgo(200), leaseEnd: daysFromNow(165) },
                { id: 'spu-3', name: 'Unit 2A', floor: 2, status: 'Vacant', rentAmount: 3500000 },
                { id: 'spu-4', name: 'Unit 2B', floor: 2, status: 'Occupied', tenantName: 'Dr. Aisha Bello', rentAmount: 3500000, leaseStart: daysAgo(30), leaseEnd: daysFromNow(335) },
                { id: 'spu-5', name: 'Unit 3A', floor: 3, status: 'Occupied', tenantName: 'Mr. Tunde Williams', rentAmount: 3800000, leaseStart: daysAgo(120), leaseEnd: daysFromNow(245) },
                { id: 'spu-6', name: 'Unit 3B', floor: 3, status: 'Vacant', rentAmount: 3800000 },
                { id: 'spu-7', name: 'Penthouse A', floor: 4, status: 'Occupied', tenantName: 'Dr. John Doe', rentAmount: 8500000, leaseStart: daysAgo(60), leaseEnd: daysFromNow(305) },
                { id: 'spu-8', name: 'Penthouse B', floor: 4, status: 'Maintenance', rentAmount: 8500000 }
            ],
            rentPaymentHistory: [
                { id: 'sph4', amount: 3200000, date: daysAgo(10), status: 'pending', description: 'Monthly Rent - Unit 1A' },
                { id: 'sph5', amount: 3500000, date: daysAgo(40), status: 'overdue', description: 'Service Charge - Unit 2B' }
            ],
            trackingTimeline: [{ id: 'spt4', type: 'inspection', date: daysAgo(5), description: 'Q2 block inspection completed. Unit 3B cleared for re-letting.' }]
        } as any,
        {
            id: dId('sp', '1'), firmId: 'atrium-demo-firm-id', contactId: dId('sc', '1'), 
            address: 'Lekki Heights Apartments, 12b Admiralty Way, Lekki Phase 1, Lagos',
            category: 'Tenanted Property', propertyType: 'Residential', status: 'Occupied',
            value: 450000000,
            rentalDetails: { rentAmount: 4500000, rentFrequency: 'Annually', leaseStart: daysAgo(180), leaseEnd: daysFromNow(185), tenantName: 'Dr. John Doe', tenantPhone: '08022223333', unitName: 'Unit A1' },
            rentPaymentHistory: [
                { id: 'sph1', amount: 4500000, date: daysAgo(180), status: 'paid', description: 'Annual Rent 2023/24' },
                { id: 'sph2', amount: 4500000, date: daysFromNow(180), status: 'pending', description: 'Annual Rent 2024/25' }
            ],
            trackingTimeline: [{ id: 'spt1', type: 'rent_collected', date: daysAgo(30), description: 'Annual rent collected for Unit A1' }]
        } as any,
        {
            id: dId('sp', '2'), firmId: 'atrium-demo-firm-id', contactId: dId('sc', '2'),
            address: 'Warehouse Block 4, Agbara Industrial Estate, Ogun',
            category: 'Tenanted Property', propertyType: 'Industrial', status: 'Occupied',
            value: 320000000,
            rentalDetails: { rentAmount: 12000000, rentFrequency: 'Annually', leaseStart: daysAgo(300), leaseEnd: daysFromNow(65), tenantName: 'Z-Alpha Logistics Ltd' },
            rentPaymentHistory: [
                { id: 'sph3', amount: 12000000, date: daysAgo(300), status: 'overdue', description: 'Annual Service Charge' }
            ],
            trackingTimeline: [{ id: 'spt2', type: 'maintenance', date: daysAgo(10), description: 'Roof repairs completed' }]
        } as any,
        {
            id: dId('sp', '3'), firmId: 'atrium-demo-firm-id', contactId: dId('sc', '3'),
            address: 'Horizon Plaza, Plot 44 CBD, Abuja',
            category: 'Property For Sale', propertyType: 'Commercial', status: 'Vacant',
            value: 1200000000,
            saleDetails: { targetPrice: 1500000000, listingDate: daysAgo(15) },
            trackingTimeline: [{ id: 'spt3', type: 'inspection', date: daysAgo(2), description: 'Prospective buyer site inspection' }]
        } as any
    ],
    chatConversations: [
        {
            id: dId('scc', '1'), firmId: 'atrium-demo-firm-id',
            type: 'direct',
            memberIds: [dId('su', '1'), dId('su', '2')],
            createdAt: daysAgo(3)
        } as any
    ],
    chatMessages: [
        {
            id: dId('scm', '1'), conversationId: dId('scc', '1'), firmId: 'atrium-demo-firm-id',
            authorId: dId('su', '2'), content: 'David, the Q2 inspection for Parkview is done. Unit 3B needs repainting before we can relet.',
            timestamp: hoursFromNow(-26), status: 'read'
        } as any,
        {
            id: dId('scm', '2'), conversationId: dId('scc', '1'), firmId: 'atrium-demo-firm-id',
            authorId: dId('su', '1'), content: 'Got it. Arrange a quote from the maintenance team. Also remind me — when does Emeka Obi\'s lease expire?',
            timestamp: hoursFromNow(-25), status: 'read'
        } as any,
        {
            id: dId('scm', '3'), conversationId: dId('scc', '1'), firmId: 'atrium-demo-firm-id',
            authorId: dId('su', '2'), content: 'Unit 1A expires in about 9 months. I\'ll flag it for early renewal outreach.',
            timestamp: hoursFromNow(-24), status: 'delivered'
        } as any
    ],
    ledgerEntries: [
        { id: 'sdl-1', firmId: 'atrium-demo-firm-id', unitId: 'spu-1', amount: 3200000, type: 'rent', status: 'cleared', timestamp: now() - 90 * 86400000, txHash: 'TX-D01', description: 'Rent Payment - Unit 1A' } as any,
        { id: 'sdl-2', firmId: 'atrium-demo-firm-id', unitId: 'spu-7', amount: 8500000, type: 'rent', status: 'cleared', timestamp: now() - 60 * 86400000, txHash: 'TX-D02', description: 'Rent Payment - Penthouse A' } as any,
        { id: 'sdl-3', firmId: 'atrium-demo-firm-id', unitId: 'spu-5', amount: 3800000, type: 'rent', status: 'defaulted', timestamp: now() - 120 * 86400000, txHash: 'TX-D03', description: 'Outstanding Rent - Unit 3A' } as any,
    ],
    serviceCharges: [
        { id: 'ssc-1', firmId: 'atrium-demo-firm-id', unitId: 'spu-1', category: 'Diesel', amount: 45000, cycle: 'Monthly', nextDueDate: now() + 15 * 86400000, isDefaulter: false } as any,
        { id: 'ssc-2', firmId: 'atrium-demo-firm-id', unitId: 'spu-5', category: 'Security', amount: 25000, cycle: 'Monthly', nextDueDate: now() - 10 * 86400000, isDefaulter: true, daysOverdue: 10 } as any,
    ],
    leadsPipeline: [
        { id: 'slp-1', firmId: 'atrium-demo-firm-id', unitId: 'spu-3', applicantName: 'Ibrahim Musa', contactInfo: '08012345678', stage: 'Vetted', vettingScore: 85, createdAt: now() - 5 * 86400000, updatedAt: now() - 86400000 } as any,
        { id: 'slp-2', firmId: 'atrium-demo-firm-id', unitId: 'spu-6', applicantName: 'Grace Chima', contactInfo: 'grace@gmail.com', stage: 'Inquiry', createdAt: now() - 2 * 86400000, updatedAt: now() - 2 * 86400000 } as any,
    ],
    automationLogs: [
        { id: 'sal-1', firmId: 'atrium-demo-firm-id', unitId: 'spu-5', messageType: 'late_notice', channel: 'whatsapp', recipient: '08055554444', sentAt: now() - 3600000, status: 'sent', messagePreview: 'Dear Tenant, your service charge is overdue...' } as any,
        { id: 'sal-2', firmId: 'atrium-demo-firm-id', unitId: 'spu-1', messageType: 'payment_receipt', channel: 'whatsapp', recipient: '08011112222', sentAt: now() - 86400000, status: 'sent', messagePreview: 'Payment received: N3,200,000. Thank you.' } as any,
    ],
};
