import * as React from 'react';

// Enums
// Founder = platform-level founder (PracticePro owner). Distinct from
// firm-level Admin (a law firm administrator). Only Founder role users
// can access the Founder APK's platform dashboard.
export enum UserRole { Founder = 'Founder', Admin = 'Admin', Lawyer = 'Lawyer', Paralegal = 'Paralegal', Client = 'Client', Tenant = 'Tenant', ExternalCounsel = 'External Counsel', Pending = 'Pending' }
export enum AppMode { Solo = 'solo', Multi = 'multi' }
export enum TaskStatus { Todo = 'todo', InProgress = 'in_progress', PendingVerification = 'pending_verification', Done = 'done' }
export const TaskStatusValues = [TaskStatus.Todo, TaskStatus.InProgress, TaskStatus.PendingVerification, TaskStatus.Done];
export enum TaskPriority { High = 'High', Medium = 'Medium', Low = 'Low' }
export enum MatterStatus { Active = 'Active', Closed = 'Closed', Archived = 'Archived' }
export enum MatterType { CivilLitigation = 'Civil Litigation', CriminalDefense = 'Criminal Defense', CorporateCommercial = 'Corporate & Commercial', RealEstate = 'Real Estate', FamilyLaw = 'Family Law', IntellectualProperty = 'Intellectual Property', Immigration = 'Immigration', EmploymentLabor = 'Employment & Labor', Tax = 'Tax Law', MaritimeAdmiralty = 'Maritime & Admiralty', OilGas = 'Oil & Gas', Other = 'Other' }
export enum InvoiceStatus { Draft = 'Draft', Sent = 'Sent', Paid = 'Paid', Overdue = 'Overdue', Unpaid = 'Unpaid', Reversed = 'Reversed', Void = 'Void' }
// Fix: Enum member name cannot contain spaces; changed 'Fixed Fee' to 'FixedFee'
export enum BillingModel { Hourly = 'Hourly', FixedFee = 'Fixed Fee', Retainer = 'Retainer', Contingency = 'Contingency', Percentage = 'Percentage' }

/**
 * Recurring retainer billing frequency. Only meaningful when the matter's
 * billingModel === Retainer. Used by the automated invoice scheduler
 * (convex/retainerBilling.ts) to compute the next billing date.
 */
export enum BillingFrequency {
  Weekly = 'Weekly',
  Monthly = 'Monthly',
  Quarterly = 'Quarterly',
  BiAnnually = 'Bi-Annually',
  Annually = 'Annually',
}

/**
 * State machine for automated invoice outbox entries.
 * - Staged: System-generated draft, awaiting review window or manual trigger
 * - Queued: Approved & scheduled for delivery
 * - Sent: Successfully delivered via email/WhatsApp
 * - Failed: Errored (missing client email, gateway error, etc.)
 * - Skipped: Lawyer cancelled this cycle but kept the recurring schedule
 * - Paused: Manually frozen for editing
 */
export enum InvoiceOutboxState {
  Staged = 'Staged',
  Queued = 'Queued',
  Sent = 'Sent',
  Failed = 'Failed',
  Skipped = 'Skipped',
  Paused = 'Paused',
}
export enum ContactType { Individual = 'Individual', Company = 'Company', Court = 'Court' }
export enum NoteScope { Private = 'private', Firm = 'firm' }
export enum LeadStatus { New = 'New', IntakeSent = 'Intake Sent', IntakeSubmitted = 'Intake Submitted', Analyzing = 'Analyzing', Activated = 'Activated', Converted = 'Converted', Lost = 'Lost' }
export enum CourtType { FederalHighCourt = 'Federal High Court', StateHighCourt = 'State High Court', NationalIndustrialCourt = 'National Industrial Court', MagistrateCourt = 'Magistrate Court', CustomaryCourt = 'Customary Court', CourtOfAppeal = 'Court of Appeal', SupremeCourt = 'Supreme Court' }
export enum SubscriptionPlan { Core = 'Core', Growth = 'Growth', Pro = 'Pro', Enterprise = 'Enterprise', Komplete = 'Komplete' }
export enum FirmSpecialty { Maritime = 'Maritime & Admiralty', OilGas = 'Oil & Gas', Corporate = 'Corporate & Commercial', Tax = 'Tax Law', RealEstate = 'Real Estate & Property', Litigation = 'Civil Litigation', General = 'General Practice' }

// Basic Types
export type Theme = 'light' | 'dark' | 'system' | 'midnight' | 'oled' | 'neon-cyber' | 'sunlight-soft' | 'city-lights' | 'city-emerald' | 'midnight-emerald' | 'army-dark' | 'army-light';
export type FontSize = 'sm' | 'md' | 'lg';
export type View = 'dashboard' | 'matters' | 'matterDetail' | 'contacts' | 'contactDetail' | 'documents' | 'documentDetail' | 'tasks' | 'calendar' | 'billing' | 'invoiceDetail' | 'receiptDetail' | 'reporting' | 'compliance' | 'settings' | 'messaging' | 'notes' | 'help' | 'archive' | 'editor' | 'research' | 'timeline' | 'properties' | 'propertyDetail' | 'intake' | 'privacyPolicy' | 'termsOfService' | 'portalTermsOfUse' | 'dataProcessingAgreement' | 'cookiePolicy' | 'usagePolicy' | 'resources' | 'indexer' | 'atriumEngine' | 'tenantPortal' | 'billingMonitor' | 'founderDashboard' | 'securityAccess';
export type ModalType = 'login' | 'signup' | 'leadCapture' | 'newMatter' | 'editMatter' | 'closeMatter' | 'archiveMatter' | 'newContact' | 'editContact' | 'mergeContact' | 'collectRent' | 'newDocument' | 'editDocument' | 'shareDocument' | 'signDocument' | 'newEvent' | 'editEvent' | 'viewEvent' | 'newInvoice' | 'editInvoice' | 'viewInvoice' | 'generateInvoice' | 'newUser' | 'editUser' | 'newTimeEntry' | 'editTimeEntry' | 'newExpense' | 'editExpense' | 'deleteConfirmation' | 'newWorkflow' | 'editWorkflow' | 'newEventType' | 'editEventType' | 'newContactCategory' | 'editContactCategory' | 'newChecklistTemplate' | 'editChecklistTemplate' | 'editFirmDetails' | 'newTemplate' | 'editTemplate' | 'newTemplateCategory' | 'editTemplateCategory' | 'googleDrivePicker' | 'noTeamMembers' | 'folderPermissions' | 'assignUsers' | 'viewTask' | 'newTask' | 'editTask' | 'stageChecklist' | 'newChannel' | 'newDirectMessage' | 'externalCounsel' | 'newExternalCounsel' | 'aloaHelp' | 'feedback' | 'newBankAccount' | 'editBankAccount' | 'newNotebook' | 'editNotebook' | 'newPage' | 'copyPage' | 'newLead' | 'activateLead' | 'sendIntakeLink' | 'sendPostActivationEmail' | 'requestFinancialDocument' | 'linkContactToMatter' | 'newProperty' | 'editProperty' | 'bulkEditProperty' | 'newDocumentCategory' | 'editDocumentCategory' | 'newResearchNotebook' | 'addResearchSource' | 'addCaseToNotebook' | 'keyboardShortcuts' | 'quickLook' | 'requestTrustDeposit' | 'compareDocuments' | 'composeEmail' | 'paymentGateway' | 'upgradePlan' | 'onboarding' | 'demoUpsell' | 'newDraft' | 'workspaceSetup' | 'saveToNote' | 'linkMatterToContact' | 'batchUpload' | 'joinFirm' | 'aiConsent' | 'recordRentPayment'
    | 'create_matter' | 'create_contact' | 'create_task' | 'matterIngestion'; // Aliases for AI tools
export type SelectedId = string | null;

// Interfaces
export interface BankAccount { id: string; bankName: string; accountNumber: string; accountName?: string; isDefault?: boolean; firmId?: string; }
export interface TaxSettings { vatRate: number; whtRate?: number; }
export interface AiSettings { enableAllAiFeatures?: boolean; enableJurisdictionalAnalysis?: boolean; firmGeminiApiKey?: string; firmDeepSeekApiKey?: string; enabledAgents?: { jurisdictionScout: boolean; rpcGuardian: boolean; privacyShield: boolean; billingAuditor: boolean; draftingAssistant: boolean; }; }
export interface Integrations { googleCalendar: boolean; googleDrive: boolean; googleContacts: boolean; googleMeet: boolean; }
export interface SubscriptionAddons { lawReports: boolean; }
export interface PracticeJurisdictions { federalCourts: string[]; stateCourts: string[]; }

// =====================================================================
// ENTERPRISE SPECIALTY DATA STRUCTURES
// =====================================================================

// --- Maritime & Admiralty ---
export interface MaritimeSpecialtyData {
    vesselName?: string;           // Full registered name of the vessel
    imoNumber?: string;            // IMO unique vessel identifier
    vesselType?: string;           // e.g., Bulk Carrier, Tanker, Container Ship
    portOfRegistry?: string;       // e.g., Port Harcourt, Lagos
    flagState?: string;            // Country of registry/flag
    grossTonnage?: number;         // GT measurement
    pAndIClub?: string;            // Protection & Indemnity insurer (e.g., UK P&I Club)
    charterpartyType?: 'Voyage' | 'Time' | 'Bareboat' | 'None'; // Type of charterparty in dispute
    arrestStatus?: 'None' | 'Warrant Issued' | 'Vessel Arrested' | 'Released' | 'Sold By Order'; // Current arrest position
    arrestPort?: string;           // Port where vessel is arrested
    cargoType?: string;            // Nature of cargo if cargo claim
    billOfLadingNo?: string;       // Relevant bill of lading number
    opposingUnderwriter?: string;  // Cargo insurer on the other side
}

// --- Oil & Gas ---
export type OilGasLicenseType = 'OML' | 'OPL' | 'Marginal Field' | 'DSO' | 'Gas Flare-Out Licence';
export interface OilGasSpecialtyData {
    licenseType?: OilGasLicenseType;   // Type of NUPRC license involved
    licenseNumber?: string;             // Actual license number (e.g., OML 58)
    blockNumber?: string;               // Offshore/onshore block designation
    fieldLocation?: string;             // Field name / state
    nuprcLicenseId?: string;            // NUPRC internal tracking ID
    licenseIssueDate?: string;          // ISO date of original grant
    licenseExpiryDate?: string;         // ISO date of expiry (auto-triggers alerts)
    relinquishmentDate?: string;        // Relevant relinquishment deadline
    pscPartner?: string;                // Production Sharing Contract partner (e.g., NNPC)
    farmInFarmOutParty?: string;        // Counterparty in farm-in/out deals
    regulatoryBody?: 'NUPRC' | 'NMDPRA' | 'NBET' | 'FIRS'; // Regulatory body for this matter
    environmentalPermitNo?: string;     // NESREA / EIA permit reference
    piaComplianceStatus?: 'Pending Assessment' | 'Compliant' | 'Non-Compliant' | 'Under Review'; // Status under the PIA
}

// --- Corporate & Commercial ---
export interface CorporateSpecialtyData {
    rcNumber?: string;               // CAC Registration Number
    cacAvailabilityCode?: string;    // Pre-reservation name availability code
    incorporationDate?: string;      // ISO date of incorporation
    companyType?: 'Private Limited (LTD)' | 'Public Limited (PLC)' | 'Unlimited' | 'Company Limited by Guarantee' | 'Business Name' | 'Incorporated Trustee';
    shareCapital?: number;           // Authorised share capital (₦)
    paidUpCapital?: number;          // Paid-up capital (₦)
    numberOfDirectors?: number;      // Total directors on the board
    boardSecretary?: string;         // Name of company secretary
    annualReturnsDueDate?: string;   // ISO date of next CAC annual return
    annualReturnsStatus?: 'Filed' | 'Pending' | 'Overdue'; // Auto-calculated from due date
    transactionType?: 'Incorporation' | 'M&A' | 'Share Allotment' | 'Winding Up' | 'Directors Change' | 'CAMA Compliance' | 'Joint Venture';
    mnaTargetCompany?: string;       // Name of target company in M&A matters
    dueDiligenceStatus?: 'Not Started' | 'In Progress' | 'Complete' | 'Red Flags Identified';
}

// --- Tax Law ---
export interface TaxSpecialtyData {
    tin?: string;                        // FIRS Tax Identification Number
    firsTaxOffice?: string;              // FIRS office handling the matter (e.g., FIRS LTO Lagos)
    taxType?: 'CIT' | 'PAYE' | 'VAT' | 'WHT' | 'CGT' | 'TET' | 'Stamp Duties' | 'Transfer Pricing'; // Type of tax
    auditYear?: string;                  // e.g., "2022" or "2019–2022" for compound audits
    assessmentDate?: string;             // ISO date FIRS issued the assessment
    objectionDeadline?: string;          // ISO date: 30 days from assessmentDate (auto-calculated)
    disputedTaxLiability?: number;       // FIRS-assessed figure in dispute (₦)
    penaltyAmount?: number;              // Penalties imposed (₦)
    interestAmount?: number;             // Interest accrued on underpayment (₦)
    totalExposure?: number;              // Combined disputed + penalties + interest (₦)
    assessmentStatus?: 'Objection Stage' | 'Settled' | 'TAT Appeal Filed' | 'Federal High Court' | 'Court of Appeal';
    tatCaseNo?: string;                  // Tax Appeal Tribunal Case Number
    taxClearanceCertStatus?: 'Pending' | 'Issued' | 'Rejected'; // TCC processing status
}

// --- Real Estate & Property ---
export type TitleDocumentType = 'Certificate of Occupancy (C of O)' | "Governor's Consent" | 'Deed of Assignment' | 'Deed of Lease' | 'Statutory Right of Occupancy' | 'Customary Right of Occupancy' | 'Registered Conveyance';
export interface RealEstateUnit {
    id: string;
    unitName: string;
    rentAmount: number;
    rentFrequency: 'Annually' | 'Bi-Annually' | 'Quarterly' | 'Monthly';
    leaseStart?: string;
    leaseEnd?: string;
    tenantName?: string;
    occupantTitle?: string;
    occupantFirstName?: string;
    occupantLastName?: string;
    tenantPhone?: string;
    tenantEmail?: string;
    nextRentReview?: string;
    isPeriodicReviewEnabled?: boolean;
    tenancyPeriod?: string;
}

export interface RealEstateSpecialtyData {
    titleDocument?: TitleDocumentType;     // Highest form of title
    surveyPlanNo?: string;                 // Survey plan file number
    plotSize?: string;                     // e.g., "1,200 sqm"
    plotLocation?: string;                 // Street/estate description
    stateLandsBureau?: string;             // State registry handling perfection (e.g., Lagos LSMLR)
    transactionType?: 'Purchase' | 'Sale' | 'Lease' | 'Mortgage' | 'Title Perfection' | 'Tenancy' | 'Recovery of Premises';
    purchasePrice?: number;                // Agreed transaction value (₦)
    stampDutyStatus?: 'Pending' | 'Paid' | 'Assessed - Unpaid'; // Stamp duty payment status
    governorConsentStatus?: 'Not Applied' | 'Application Submitted' | 'Approved' | 'Rejected'; // Consent tracking
    registrationStatus?: 'Not Registered' | 'Application Lodged' | 'Registered'; // Final registration step
    tenantName?: string;                   // For Recovery of Premises matters
    recoveryStage?: 'Notice to Quit' | 'Notice of Intention to Recover' | 'Court Proceedings' | 'Warrant of Possession';
    units?: RealEstateUnit[];              // Multi-unit support
    propertyId?: string;                   // Link to a specific property/portfolio item
}

// Combined specialty object stored on each Matter
export interface MatterSpecialtyData {
    maritime?: MaritimeSpecialtyData;
    oilGas?: OilGasSpecialtyData;
    corporate?: CorporateSpecialtyData;
    tax?: TaxSpecialtyData;
    realEstate?: RealEstateSpecialtyData;
    firmRepresentingRole?: string;
    rulesState?: string;
    moduleKey?: string;
}

// Versioned statutory form template (for the Form Library)
export interface LegalFormTemplate {
    id: string;
    firmId: string;
    name: string;                   // e.g., "Notice of Objection to FIRS Assessment"
    specialty: FirmSpecialty;       // Which practice area this belongs to
    statutoryAuthority?: string;    // e.g., "FIRS Establishment Act s.63"
    version: string;                // e.g., "2024 Edition"
    effectiveDate: string;          // ISO date this version came into force
    supersededById?: string;        // Links to a newer version if this one is outdated
    isLatest: boolean;              // True if this is the current authoritative version
    content: string;                // Template body (HTML/markdown with {{placeholders}})
    autoFillMapping?: Record<string, string>; // Maps {{placeholder}} -> Matter field path
}
export interface FirmDetails { id: string; name: string; address: string; logoUrl: string; letterheadUrl?: string; digitalStampUrl?: string; headerTextColor?: string; inviteCode?: string; areWorkflowsEnabled: boolean; aloaFirmPersonality?: string; bankAccounts: BankAccount[]; aiSettings?: AiSettings; integrations: Integrations; monthlyRevenueTarget?: number; subscriptionPlan: SubscriptionPlan; subscriptionAddons?: SubscriptionAddons; practiceJurisdictions?: PracticeJurisdictions; customHolidays?: string[]; taxSettings?: TaxSettings; created_by?: string; settings?: any; localFolderPath?: string;
    // Enterprise Specialization
    firmSpecialties?: FirmSpecialty[];      // Selected practice areas for this Enterprise firm
    legalFormLibrary?: LegalFormTemplate[]; // Versioned statutory form templates
    product?: Product;
    automationSettings?: any;
    trustAccountingEnabled?: boolean;        // Toggle: enable trust accounting
    defaultStateOfPractice?: string;          // Default jurisdiction for all drafts (e.g., "Lagos", "Delta", "FCT")
    statesOfPractice?: string[];              // All states the firm operates in (multi-state practices)
    practiceProfile?: PracticeProfile;        // Practice-type configuration captured during onboarding
}

/**
 * Practice Profile — captured in the Getting-Started wizard (Step 3).
 * Describes WHAT KIND of practice the firm runs so the AI (ALOA/ARIA),
 * workflows, and checklists can tailor themselves from day one.
 */
export interface PracticeProfile {
    /** Vega: selected practice areas (FirmSpecialty values + custom) */
    practiceAreas?: string[];
    /** Atrium: portfolio composition */
    portfolioTypes?: ('residential' | 'commercial' | 'mixed' | 'land' | 'shortlet')[];
    /** Atrium: what the PM firm actually does */
    focusAreas?: string[];
    /** Atrium: approximate number of units under management */
    unitsUnderManagement?: number;
    /** ISO timestamp of when the profile was captured */
    completedAt?: string;
}
export interface ProfessionalStandards { lastPracticingFeePaidYear: number; nbaStampStatus: 'Approved' | 'Pending'; completedCpdHours: number; }
export interface NotificationSettings { newMessage?: boolean; assignedToMatter?: boolean; taskAssignedToMe?: boolean; newTaskInMyMatter?: boolean; eventTaskHalfway?: boolean; taskStartedByTeamMember?: boolean; taskCompletedByTeamMember?: boolean; }
export type Product = 'legal' | 'property' | 'unified' | 'atrium' | 'vega';
export interface User { id: string; firmId?: string | null; joinedFirmIds?: string[]; name: string; email: string; role: UserRole; avatarUrl?: string; barNumber?: string; showProTips: boolean; professionalStandards?: ProfessionalStandards; notificationSettings?: NotificationSettings; defaultViewModes?: { matters?: 'list' | 'board'; tasks?: 'list' | 'board'; calendar?: 'month' | 'week' | 'diary'; }; accessibleMatterIds?: string[]; namePronunciation?: string; lastViewedPortalAt?: string; enableLiveFlashes?: boolean; defaultMatterType?: string; onboardingCompleted?: boolean; _id?: any; isMfaEnabled?: boolean; product?: Product; portalPresenceHidden?: boolean; portalAccessToken?: string; }
export interface ContactCategory { id: string; firmId: string; name: string; product?: Product; }
export interface PropertyEvent { id: string; type: 'rent_collected' | 'lease_signed' | 'maintenance' | 'inspection' | 'renewal' | 'tenant_change' | 'offer'; date: string; description: string; amount?: number; relatedTaskId?: string; }
export interface MaintenanceRecord { id: string; date: string; issue: string; status: 'reported' | 'in_progress' | 'escalated' | 'fulfilled' | 'cancelled'; cost?: number; resolvedDate?: string; notes?: string; priority?: 'low' | 'medium' | 'high' | 'emergency'; vendorId?: string; vendorName?: string; vendorPhone?: string; taskId?: string; }
export interface RentPayment { id: string; dueDate: string; paidDate?: string; amount: number; status: 'paid' | 'overdue' | 'pending'; paymentMethod?: string; receiptNumber?: string; periodStart?: string; periodEnd?: string; }

/** Per-period tracking for Service Charge (SC) and Minimum Vend (MV).
 *  One entry per elapsed billing period from leaseStart to current date,
 *  plus optional advance pre-paid future periods.
 *
 *  Status semantics:
 *  - 'paid'          → balance settled (green pill)
 *  - 'late'          → paid after due date OR currently past due & unpaid (orange pill)
 *  - 'outstanding'   → unpaid, past due (red pill — default for historical periods)
 *  - 'advance_paid'  → settled ahead of future billing date (blue pill)
 *
 *  The `paidOnTime` flag retains the historical audit distinction:
 *  - paidOnTime: true  → "PAID ON TIME" (settled on or before due date)
 *  - paidOnTime: false → "PAID LATE" (settled after due date — still orange
 *                        in the historical timeline even though balance is ₦0)
 *  - undefined         → no payment logged yet
 *
 *  The `isAdvance` flag marks future pre-paid periods that haven't elapsed yet. */
export interface ServiceChargePeriod {
    index: number;       // 1-based period number
    dueDate: string;     // ISO date when this period's charge was due
    status: 'paid' | 'late' | 'outstanding' | 'advance_paid';
    paidDate?: string;   // ISO date when payment was recorded (if paid/late/advance_paid)
    amount: number;      // per-period charge amount
    /** Whether the payment was settled on time (≤ due date) vs late (> due date).
     *  Retained permanently for historical audit even after balance settles. */
    paidOnTime?: boolean;
    /** True for future pre-paid periods (advance cycles not yet elapsed). */
    isAdvance?: boolean;
    /** Receipt number if a receipt has been issued for this period.
     *  When set, the UI shows [View Issued Receipt] instead of [Generate Receipt]. */
    receiptNumber?: string;
}
export enum PropertyStatus { Occupied = 'Occupied', Vacant = 'Vacant', Listed = 'Listed', Maintenance = 'Maintenance', Sold = 'Sold' }
export enum PropertyCategory { Tenanted = 'Tenanted Property', ForSale = 'Property For Sale', Disputed = 'Disputed Property', Personal = 'Personal Residence', Other = 'Other' }
export interface Property {
    id: string;
    firmId: string;
    contactId?: string;
    matterId?: string;
    address: string;
    category: PropertyCategory;
    ownershipType?: 'owned' | 'managed';
    propertyType?: 'Residential' | 'Commercial' | 'Industrial' | 'Land' | 'Mixed Use';
    description?: string;
    status: PropertyStatus;
    rentCollectionMode?: 'Full (Collect Rent)' | 'Management Only (No Rent)';
    value?: number;
    rentalDetails?: {
        id?: string;
        unitName?: string;
        rentAmount: number;
        rentFrequency: 'Annually' | 'Bi-Annually' | 'Quarterly' | 'Monthly';
        leaseStart?: string;
        leaseEnd?: string;
        tenantName?: string;
        occupantTitle?: string;
        occupantFirstName?: string;
        occupantLastName?: string;
        tenantPhone?: string;
        tenantEmail?: string;
        nextRentReview?: string;
        isPeriodicReviewEnabled?: boolean;
        tenancyPeriod?: string;
        serviceCharge?: number;
        serviceChargeAmount?: number;
        serviceChargeStatus?: 'PAID_FULLY' | 'PARTIALLY_PAID' | 'UNPAID';
        outstandingServiceChargeBalance?: number;
        /** Billing frequency for service charge (defaults to rentFrequency if unset). */
        serviceChargeFrequency?: 'Annually' | 'Bi-Annually' | 'Quarterly' | 'Monthly';
        legalFee?: number;
        agencyFee?: number;
        cautionDeposit?: number;
        /** Per-period service charge tracking — one entry per elapsed billing period. */
        scPeriods?: ServiceChargePeriod[];
        /** Per-period minimum vend tracking — one entry per elapsed billing period. */
        mvPeriods?: ServiceChargePeriod[];
        /** Linked contact ID for the tenant (auto-synced to /contacts). */
        tenantContactId?: string;
    };
    disputeDetails?: { caseNumber?: string; court?: string; opposingParty?: string; status?: string; };
    saleDetails?: { listingAgent?: string; listingDate?: string; targetPrice?: number; };
    managementFeePercentage?: number;
    numberOfUnits?: number;
    units?: any[];
    images?: FileDetails[];
    automationSettings?: {
        remindLeaseExpiry?: boolean;
        remindRentDue?: boolean;
        autoCreateMaintenanceTask?: boolean;
        automationTemplates?: Record<string, string>;
        latePenaltyRate?: number;
    };
    amenities?: string[];
    // Minimum Vend / Estate Fees toggle (property-wide)
    minimumVendEnabled?: boolean;
    minimumVendAmount?: number;
    minimumVendLabel?: string;
    trackingTimeline?: PropertyEvent[];
    maintenanceHistory?: MaintenanceRecord[];
    rentPaymentHistory?: RentPayment[];
}
export interface Contact { id: string; firmId: string; name: string; email: string; phone: string; address?: string; contactType: ContactType; category: string; jobTitle?: string; companyName?: string; website?: string; notes?: string; properties?: Property[]; userId?: string; identificationNumber?: string; taxId?: string; nextOfKin?: string; dateOfBirth?: string; matterIds?: string[]; isArchived?: boolean; archivedAt?: string | null; }
export interface WorkflowDefinition { id: string; firmId: string; type: MatterType; default: { stages: string[]; suggestions: Record<string, any>; }; subCategories?: Record<string, any>; }
export interface ChecklistItem { id: string; text: string; completed: boolean; }
export interface Checklist { id: string; templateName?: string; items: ChecklistItem[]; }
export interface MatterProcess { id: string; processName: string; filedDate: string; responseExpectedBy?: string; responseReceived?: boolean; responseDate?: string; responseStatus?: 'sufficient' | 'insufficient' | 'pending_review'; relatedDocumentId?: string; notes?: string; }
export interface ProcessSuggestion { id: string; type: 'reminder' | 'event' | 'task' | 'deadline'; title: string; description: string; dueDate?: string; dismissed: boolean; relatedProcessId?: string; }
export interface MatterReviewReminder { remindAt: string; note?: string; dismissed?: boolean; }
export interface LitigationParty { id: string; name: string; contactId?: string; role: 'Claimant' | 'Defendant' | 'Applicant' | 'Respondent' | string; isRepresentative?: boolean; capacity?: string; isRepresented?: boolean; }
export interface Matter { id: string; firmId: string; referenceNumber: string; suitNumber?: string; title: string; type: MatterType; subCategory?: string; clientId: string; court: string; judicialDivision: string; stage: string; stageLastUpdated: string; createdAt: string; opposingCounsel?: string; hourlyRate: number; fixedFeeAmount?: number; billingModel: BillingModel; billingPercentage?: number; billingBase?: 'Rent' | 'Value' | 'Outcome' | 'Custom'; billingFrequency?: BillingFrequency; nextBillingDate?: string; retainerAutoBillingEnabled?: boolean; withholdingTaxApplicable?: boolean; status: MatterStatus; assignedUsers: string[]; billingAccess?: string[]; trustBalance?: number; intakeAnalysis?: any; intakeRecordings?: any[]; intakeTranscription?: string; clientActionItems?: any[]; associatedContactIds?: string[]; attorneyNotes?: AttorneyNote[]; jurisdictionalAnalysis?: JurisdictionalAnalysis; presidingJudge?: string; courtRoom?: string; nextAdjournedDate?: string; originatingProcess?: string; cacAvailabilityCode?: string; rcNumber?: string; shareCapital?: number; annualReturnsDueDate?: string; propertyValue?: number; titleRegistrationDetails?: string; transactionStage?: string; billingCurrency?: 'NGN' | 'USD' | 'GBP' | 'EUR'; leadSource?: string; hasExternalAccess?: boolean; processTracking?: { activeProcesses: MatterProcess[]; suggestions: ProcessSuggestion[]; suggestionsEnabled: boolean; }; reviewReminder?: MatterReviewReminder; parties?: LitigationParty[];
    // Enterprise Specialty Data — keyed by specialty to allow multi-specialty matters
    specialtyData?: MatterSpecialtyData;
}
export interface Task { id: string; _id?: string; firmId: string; title: string; description?: string; status: TaskStatus; dueDate?: string | null; assignedUsers: string[]; assigneeType?: 'team' | 'client' | 'tenant'; isSharedWithPortal?: boolean; matterId?: string; createdAt: string; creatorId: string; priority: TaskPriority; checklist?: Checklist; }
export interface DocumentCategory { id: string; firmId: string; name: string; parentId: string | null; isCore?: boolean; product?: Product; }
export interface FileDetails { name: string; type: string; size: number; filePath: string; dataUrl?: string; storageId?: string; }
export interface DocumentComment { id: string; content: string; authorId: string; timestamp: string; }
export interface DocumentVersion { id: string; file: FileDetails; uploadedBy: string; uploadedAt: string; changesSummary?: string; }
export interface RiskAnalysis { legalRisk: number; commercialRisk: number; complianceRisk: number; operationalRisk: number; overallRiskScore: number; justification: string; highRiskClauses: { clause: string; summary: string; }[]; }
export interface ExtractedMetadata { contractType: string; partiesInvolved: string[]; effectiveDate: string | null; expirationDate: string | null; autoRenewalDate: string | null; governingLaw: string; jurisdiction: string; opposingCounselInfo?: { name: string; firmName?: string; phone?: string; email?: string; address?: string; }[]; }
export interface DataProtectionAnalysis { overallRiskLevel: 'Low' | 'Medium' | 'High'; identifiedPii: string[]; findings: { risk: string; recommendation: string; }[]; }
export interface RpcStatus { status: 'approved' | 'warning'; commentary: string; }
export interface Document { id: string; firmId: string; title: string; matter?: { id: string; title: string; }; property?: { id: string; title: string; }; categoryId: string; dateFiled: string; assignedUsers: string[]; file?: FileDetails; content?: string; source?: 'upload' | 'generated'; uploadedBy?: string; versions?: DocumentVersion[]; comments?: DocumentComment[]; analysisState?: 'pending' | 'complete' | 'failed'; summary?: string; riskAnalysis?: RiskAnalysis; extractedMetadata?: ExtractedMetadata; dataProtectionAnalysis?: DataProtectionAnalysis; rpcReview?: RpcStatus; analysisCompletedAt?: string; isSharedWithClient?: boolean; clientReviewStatus?: 'pending' | 'review_requested' | 'reviewed'; isSignatureRequested?: boolean; signatureData?: string; signedAt?: string; signerId?: string; metadata?: any; matterId?: string; propertyId?: string; isCourtProcess?: boolean; litigationStatus?: 'draft' | 'filed' | 'served' | 'acknowledged'; }
export interface CustomEventType { id: string; firmId: string; name: string; color: string; }
export interface CalendarEvent {
    id: string; firmId: string; title: string; description?: string; matterTitle?: string; type: string; date: string; endDate?: string; matterId?: string; status: EventStatus; court?: string; judicialDivision?: string; assignedUsers?: string[]; reminder?: { value: number; unit: 'minutes' | 'hours' | 'days'; }; recurrence?: { frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'; endDate?: string; }; originalId?: string; created_by?: string;
    createdAt?: string;
}
export interface InvoiceLineItem { id: string; description: string; hours: number; rate: number; total: number; timeEntryId?: string; expenseId?: string; }
export interface Invoice { id: string; firmId: string; invoiceNumber: string; client: { id: string; name: string; }; matter: { id: string; title: string; }; lineItems: InvoiceLineItem[]; status: InvoiceStatus; issueDate: string; dueDate: string; paidDate?: string; paymentDetails: BankAccount; subTotal: number; taxAmount: number; total_amount?: number; provider?: 'manual' | 'paystack'; providerReference?: string; paymentMethod?: string; }
export interface TimeEntry { id: string; firmId: string; matterId: string; user_id: string; date: string; duration: number; rate: number; description: string; billable: boolean; billedInInvoiceId?: string | null; }
export interface Expense { id: string; firmId: string; matterId: string; date: string; amount: number; description: string; isBillable: boolean; billedInInvoiceId?: string | null; taxDeductibility?: { isDeductible: boolean; reason: string; }; }
export interface NoteNotebook { id: string; firmId?: string; userId?: string; name: string; color: string; scope: NoteScope; isCore?: boolean; matterId?: string; }
export interface NotePage { id: string; firmId: string; title: string; content: string; notebookId: string; parentId: string | null; matterId?: string; propertyId?: string; contextType?: string; archivedAt?: number; authorId: string; createdAt: string; updatedAt: string; order: number; type: 'user' | 'system' | 'endorsement'; systemNoteIcon?: string; rawTranscript?: string | null; cleanedTranscript?: string | null; dictationMode?: 'vega_dual' | 'atrium_single' | null; }
export interface ChatConversation { id: string; firmId: string; type: 'direct' | 'channel'; name?: string; memberIds: string[]; creatorId?: string; hiddenForUserIds?: string[]; matterId?: string; createdAt?: string; }
export interface ChatMessage { id: string; firmId: string; conversationId: string; authorId: string; content: string; timestamp: string; deletedForUserIds?: string[]; isDeleted?: boolean; status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'; }
export interface ClientMessage { id: string; firmId: string; matterId: string; authorId: string; content: string; timestamp: string; isRead: boolean; status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'; }
export interface Notification { id: string; firmId: string; userId: string; message: string; link: { view: View; id: string | null; context?: any; }; timestamp: string; isRead: boolean; }
export interface FirmActivity { id: string; firmId: string; userId: string; userName: string; action: string; timestamp: string; targetType: 'Matter' | 'Client' | 'Document' | 'Task' | 'Event' | 'Invoice' | 'User' | 'Contact'; targetId?: string; targetName?: string; matterId?: string; metadata?: any; }
export interface ArchivedItem { id: string; firmId: string; itemType: string; itemId: string; itemName: string; archivedAt: string; archiverId: string; archiverName: string; originalData: any; }
export interface ExternalCounselInvite { id: string; firmId: string; matterId: string; email: string; name: string; firmName: string; roleInMatter: string; accessLevel: AccessLevel; expiresAt: string; status: 'pending' | 'accepted' | 'revoked' | 'expired'; invitedBy: string; }
export interface ResearchNotebook { id: string; firmId: string; userId: string; name: string; matterId?: string; }
export interface ResearchSource { id: string; firmId: string; notebookId: string; name: string; type: 'pdf' | 'text' | 'web'; content: string; file?: FileDetails; }
export interface ResearchCitation { sourceId: string; snippet: string; }
export interface ResearchMessage { id: string; firmId: string; notebookId: string; role: 'user' | 'model'; content: string; timestamp: string; citations?: ResearchCitation[]; }
export interface StudioAnalysisResult { id: string; firmId: string; notebookId: string; type: string; title: string; content: string; timestamp: string; }
export interface CaseResult { id: string; citation: string; equivalentCitations?: string[]; parties: string; court: string; year: number; subjectMatter?: string; ratioDecidendi?: string; summary: string; fullText?: string; tags?: string[]; status?: CaseStatus; referencedStatutes?: string[]; coram?: string[]; history?: { stage: string; verdict: string; }[]; counsel?: string[]; facts?: string; issues?: string[]; }
export type CaseStatus = 'Locus Classicus' | 'Good Law' | 'Overruled' | 'Distinguished';
export type CourtHierarchy = 'Supreme Court' | 'Court of Appeal' | 'National Industrial Court' | 'Federal High Court' | 'Investments & Securities Tribunal' | 'Election Petition Tribunal' | 'Magistrate Court' | 'Customary Court';
export interface ChecklistTemplate { id: string; firmId: string; name: string; items: { id: string; text: string; }[]; relevantMatterTypes?: MatterType[]; }
export interface DocumentTemplateCategory { id: string; firmId: string; name: string; }
export interface DocumentTemplate { 
    id: string; 
    firmId: string; 
    categoryId?: string; 
    categoryName?: string; 
    name: string; 
    description?: string;
    content: string; 
    createdAt: string;
    placeholders?: string[];
}
export interface Lead { id: string; firmId: string; name: string; email: string; status: LeadStatus; createdAt: string; intakeSentAt?: string; intakeSubmittedAt?: string; intakeRecordings?: { dataUrl: string; mimeType: string; }[]; intakeTranscription?: string; isAnalyzing?: boolean; intakeAnalysis?: any; convertedMatterId?: string; }
export interface Email { id: string; firmId: string; matterId?: string; from: string; to: string[]; subject: string; body: string; timestamp: string; isRead: boolean; attachments?: FileDetails[]; }
export interface AutomationAction { type: 'create_task' | 'send_email' | 'send_whatsapp' | 'generate_document' | 'notify_slack'; taskTitle?: string; dueInDays?: number; priority?: TaskPriority; emailSubject?: string; emailBody?: string; whatsappMessage?: string; templateId?: string; slackChannel?: string; description?: string; }
export type AutomationTriggerType = 'matter_stage_change' | 'matter_created' | 'invoice_overdue' | 'lead_created' | 'event_created' | 'task_overdue' | 'document_uploaded' | 'client_onboarding_incomplete' | 'property_rent_due' | 'property_lease_expiring' | 'property_maintenance_reported' | 'property_rent_overdue';
export interface AutomationRule { id: string; firmId: string; name: string; triggerType: AutomationTriggerType; triggerValue: string; actions: AutomationAction[]; isEnabled: boolean; }
export interface IntakeFormTemplate { id: string; firmId: string; name: string; description?: string; fields: FormField[]; publicLink: string; responsesCount: number; isEnabled: boolean; }
export interface FormField { id: string; label: string; type: 'text' | 'email' | 'phone' | 'textarea' | 'date' | 'select' | 'checkbox'; required: boolean; options?: string[]; }
export interface HeaderConfiguration {
    logo?: {
        url: string;
        position: 'left' | 'center' | 'right' | 'custom';
        height: number;
        // Canvas props
        x?: number;
        y?: number;
        width?: number; // Aspect ratio usually preserved, but useful for storage
    };
    firmName: {
        text: string;
        fontSize: number;
        fontWeight: 'normal' | 'bold';
        color: string;
        alignment: 'left' | 'center' | 'right' | 'custom';
        // Canvas props
        x?: number;
        y?: number;
        width?: number;
    };
    address: {
        text: string;
        fontSize: number;
        alignment: 'left' | 'center' | 'right' | 'custom';
        // Canvas props
        x?: number;
        y?: number;
        width?: number;
    };
    showOnAllPages: boolean;
}
export interface AppState { theme: Theme; appMode: AppMode; users: User[]; matters: Matter[]; contacts: Contact[]; documents: Document[]; tasks: Task[]; events: CalendarEvent[]; invoices: Invoice[]; timeEntries: TimeEntry[]; expenses: Expense[]; chatConversations: ChatConversation[]; chatMessages: ChatMessage[]; clientMessages: ClientMessage[]; noteNotebooks: NoteNotebook[]; notePages: NotePage[]; workflows: WorkflowDefinition[]; eventTypes: CustomEventType[]; contactCategories: ContactCategory[]; documentCategories: DocumentCategory[]; folderPermissions: Record<string, UserRole[]>; checklistTemplates: ChecklistTemplate[]; documentTemplates: DocumentTemplate[]; documentTemplateCategories: DocumentTemplateCategory[]; firmDetails: FirmDetails; firmActivity: FirmActivity[]; notifications: Notification[]; archive: ArchivedItem[]; firmNotices: any[]; dismissedConflictIds: string[]; externalCounselInvites: ExternalCounselInvite[]; researchNotebooks: ResearchNotebook[]; researchSources: ResearchSource[]; researchMessages: ResearchMessage[]; researchAnalysisResults: StudioAnalysisResult[]; bookmarkedCaseIds: string[]; savedViews: any[]; automationRules: AutomationRule[]; intakeForms: IntakeFormTemplate[]; emails: Email[]; leads: Lead[]; legalModules: any[]; properties: Property[]; ledgerEntries: LedgerEntry[]; serviceCharges: ServiceCharge[]; leadsPipeline: LeadPipelineEntry[]; automationLogs: AutomationLog[]; }
export const EMPTY_APP_STATE: AppState = {
    theme: 'light',
    appMode: AppMode.Solo,
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
    workflows: [],
    eventTypes: [],
    contactCategories: [],
    documentCategories: [],
    folderPermissions: {},
    checklistTemplates: [],
    documentTemplates: [],
    documentTemplateCategories: [],
    firmDetails: { 
        id: '', 
        name: '', 
        address: '', 
        logoUrl: '', 
        areWorkflowsEnabled: true, 
        bankAccounts: [], 
        integrations: { googleCalendar: false, googleDrive: false, googleContacts: false, googleMeet: false },
        subscriptionPlan: SubscriptionPlan.Core,
        product: 'unified'  // Permissive default — prevents hiding property features during loading
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
    automationLogs: []
};
export interface HistoryEntry { view: View; selectedId: SelectedId; context?: any; initialTab?: string; activeContactCategory?: string; activeTab?: string; calendarDate?: string; calendarViewMode?: 'month' | 'diary' | 'week'; taskUserFilter?: string; notesSelectionPath?: string[]; selectedResearchNotebookId?: string | null; previousView?: View; }
export interface Toast { id: number; message: React.ReactNode; type: 'success' | 'error' | 'info' | 'warning'; link?: { text: string; onClick: () => void; }; }
export interface AloaArtifact { id: string; type: 'form' | 'draft' | 'confirmation' | 'note'; data: any; }
export interface AloaConfirmationData { question: string; originalForm: any; match: { id: string; }; }
export interface AloaMessage { id: string; role: 'user' | 'model' | 'tool'; content?: string; toolCalls?: any[]; toolResult?: any; modelUsed?: string; toolAction?: any; isError?: boolean; errorDetails?: string; completedResult?: { id: string; title: string; type: string; }; interactiveForm?: InteractiveFormSchema; attachments?: string[]; attachmentNames?: string[]; }

// ─── Deep Context Injection ───────────────────────────────────────────────────
/** Carries the full hydrated entity payload into an ARIA/ALOA chat session. */
export interface AriaChatContext {
  entityType: 'property' | 'matter' | 'contact' | 'invoice';
  entityId: string;
  entityName: string;
  /** Core entity data + key sub-arrays (units, tasks, etc.) — kept lean intentionally. */
  payload: Record<string, any>;
}

// ─── Inline Form Delegation ───────────────────────────────────────────────────
export type InteractiveFormFieldType =
  | 'text' | 'number' | 'date' | 'select' | 'chips' | 'checkbox_group' | 'slider';

export interface InteractiveFormField {
  id: string;
  label: string;
  type: InteractiveFormFieldType;
  required?: boolean;
  placeholder?: string;
  /** Options for select / chips / checkbox_group types */
  options?: string[];
  /** Bounds for slider type */
  min?: number;
  max?: number;
  defaultValue?: any;
}

export interface InteractiveFormSchema {
  type: 'INTERACTIVE_FORM';
  formId: string;
  title: string;
  description?: string;
  fields: InteractiveFormField[];
  submitLabel?: string;
}
export interface AloaFormInteractionState { highlightedFieldId: string | null; isReadyForSubmit: boolean; fieldValues: Record<string, any>; }
export interface EditorState { isOpen: boolean; documentId: string | null; }
export interface AloaHint {
    id: string;
    icon: React.ReactNode;
    text: string;
    type: 'warning' | 'info' | 'success' | 'error';
}
export interface ViewState { matters: { statusFilter: MatterStatus | 'All'; practiceAreaFilter: string; assigneeFilter: string; searchFilter: string; }; tasks: { statusFilter: TaskStatus | 'All'; userFilter: string; searchFilter: string; }; contacts: { categoryFilter: string; }; }
export interface ContextMenuState { isOpen: boolean; x: number; y: number; type: string | null; itemId: string | null; }
export interface DataActionsContextType {
    addItem: (key: keyof AppState, item: any, itemName: string) => Promise<any>;
    updateItem: (key: keyof AppState, item: any, itemName: string) => Promise<void>;
    deleteItem: (key: keyof AppState, itemId: string, itemName: string) => Promise<void>;
    handleUpdateFirmDetails: (d: FirmDetails) => void;
    createFirm: (firmName: string, address: string, plan: SubscriptionPlan, user: any) => Promise<string | null>;
    handlePurgeData: () => Promise<void>;
    logActivity: (action: string, targetType: FirmActivity['targetType'], targetId?: string, targetName?: string, matterId?: string) => void;
    onAddMatter: (newMatter: any, newClient: any) => Promise<void>;
    handleUpdateMatterStage: (id: string, stage: string) => void;
    handleUpdateMatter: (m: Matter) => void;
    handleReopenMatter: (id: string) => void;
    handleAddTask: (t: any) => void;
    handleUpdateTaskStatus: (id: string, status: TaskStatus) => void;
    handleAddMatterNote: (matterId: string, title: string, content: string, type?: 'user' | 'endorsement') => void;
    handleSendMessage: (conversationId: string, content: string, senderId: string, overrideMembers?: string[]) => void;
    handleOrderTask: (taskId: string, newOrder: number) => void;
    handleUpdateMatterAssignment: (id: string, userIds: string[]) => void;
    handleAddDocumentAndAnalyze: (docData: any) => void;
    handleClientUploadDocument: (matterId: string, fileDetails: FileDetails) => void;
    handleClearAllNotifications: () => void;
    handleMarkNotificationsRead: (ids: string[]) => void;
    handleAddLead: (leadData: { name: string, email: string }, isClientRequest?: boolean) => void;
    handleSendIntakeLink: (leadId: string) => void;
    handleClientSubmitIntakeAudio: (leadId: string, recordings: any[], transcription: string) => void;
    handleAnalyzeIntake: (leadId: string) => void;
    handleActivateLead: (lead: Lead, matterData: any, billingData: any) => void;
    handleCancelIntakeRequest: (leadId: string) => void;
    handleAnalyzeAttorneyDictation: (audio: string, matter: Matter) => Promise<any>;
    handleRequestTrustDeposit: (matterId: string, amount: number, description: string) => void;
    handleAddContact: (contact: Omit<Contact, 'id'>, createPortal: boolean) => Promise<Contact | null>;
    handleUpdateContact: (contact: Contact, createPortal: boolean) => void;
    handleMergeContacts: (sourceId: string, targetId: string) => Promise<void>;
    handleAddWorkflow: (workflow: Omit<WorkflowDefinition, 'id'>) => Promise<WorkflowDefinition>;
    handleAddWorkflowSubCategory: (id: string, subCategory: any) => void;
    handleUpdateWorkflow: (workflow: WorkflowDefinition) => void;
    handleDeleteUser: (id: string) => void;
    handleUpdateChecklistItem: (taskId: string, itemId: string, checked: boolean) => void;
    handleDeleteAllDoneTasks: () => void;
    handleArchiveAllDoneTasks: () => void;
    handleBulkArchiveTasks: (ids: string[]) => void;
    handleBulkUpdateTaskStatus: (ids: string[], status: TaskStatus) => void;
    handleBulkDeleteTasks: (ids: string[]) => void;
    handleUpdatePageContent: (id: string, title: string, content: string) => void;
    handleDeleteNotebook: (id: string, name: string) => void;
    handleRestoreItem: (item: ArchivedItem) => void;
    handlePermanentDeleteFromArchive: (id: string) => void;
    handleDeleteTimeEntry: (id: string, desc: string) => void;
    handleDeleteExpense: (id: string, desc: string) => void;
    handleSendInvoiceReminder: (id: string) => void;
    handleRevertPayment: (id: string) => void;
    handleGenerateInvoice: (matter: Matter, items: InvoiceLineItem[], details: any, timeIds: string[], expenseIds: string[], payment: BankAccount, tax: any) => void;
    handleUpdateInvoiceStatus: (id: string, status: InvoiceStatus) => void;
    handlePayInvoice: (id: string) => void;
    handleAddAttorneyNote: (matterId: string, note: AttorneyNote) => void;
    handleDeleteAttorneyNote: (matterId: string, noteId: string) => void;
    handleShareDocumentWithOptions: (id: string, options: any) => void;
    handleSignDocument: (id: string, data: string) => void;
    handleClientMarkDocumentAsReviewed: (id: string) => void;
    handleUpdateClientActionItem: (matterId: string, itemId: string, completed: boolean) => void;
    handleSendClientMessage: (matterId: string, content: string) => void;
    handleSaveEmailAsDocument: (email: Email) => void;
    handleSendEmail: (emailData: any) => void;
    handleRequestFinancialDocument: (matterId: string, type: string) => void;
    handleLinkContactToMatter: (matterId: string, contactIds: string[]) => void;
    onUpdateContactProperties: (contactId: string, properties: Property[]) => void;
    handleUpdateIntakeForm: (form: IntakeFormTemplate) => void;
    handleDeleteIntakeForm: (id: string) => void;
    handleAddAutomationRule: (rule: AutomationRule) => void;
    handleDeleteAutomationRule: (id: string) => void;
    handleToggleAutomationRule: (id: string) => void;
    handleUpdateTaskPriority: (id: string, priority: TaskPriority) => void;
    handleInviteExternalCounsel: (invite: Omit<ExternalCounselInvite, 'id'>) => void;
    handleAcceptExternalCounselInvite: (id: string) => void;
    handleClearMatterLogs: (id: string) => void;
    handleSyncGoogleContacts: () => void;
    handleAddResearchNotebook: (data: any) => ResearchNotebook;
    handleAddResearchSource: (nbId: string, data: any) => void;
    handleSendResearchMessage: (nbId: string, content: string) => void;
    handleDeleteResearchNotebook: (id: string, name: string) => void;
    handleSaveAnalysisResult: (result: StudioAnalysisResult) => void;
    handleDeleteAnalysisResult: (id: string) => void;
    handleToggleBookmarkCase: (id: string) => void;
    handleArchiveItem: (type: string, id: string, name: string, data: any) => void;
    handleClientViewedPortal: (userId: string) => void;
    handleAddSimulatedData: () => void;
    handleLoadFinancialData: () => void;
    handleAddMassiveData: () => void;
    handleLoadMassiveFinancialData: () => void;
    handleAdvanceTime: (days: number) => void;
    handleGenerateTestNotification: () => void;
    handleLoadCalendarData: () => void;
    handleGenerateTestTasks: (opts: { count: number }) => void;
    handleGenerateTestUsers: (opts: { count: number }) => void;
    handleDismissConflict: (eventId: string) => void;
    archiveItem: (type: string, id: string, name: string, data: any) => void;
    handleCancelDocumentAnalysis: (id: string) => void;
    handleDeleteChat: (conversationId: string, deleteForeveryone: boolean, userId: string) => void;
    handleDeleteMessage: (messageId: string, deleteForeveryone: boolean, userId: string) => void;
    handleRenamePage: (pageId: string, newTitle: string) => void;
    handleApplyStageChecklist: (matterId: string, stage: string, templateId: string, shareWithClient: boolean) => void;
    handleApplyCustomStageChecklist: (matterId: string, stage: string, name: string, items: { text: string }[], saveAsTemplate: boolean, shareWithClient: boolean) => void;
    handleEditMessage: (messageId: string, newContent: string) => void;
    handleLinkMatterToContact: (contactId: string, matterId: string, asClient: boolean) => void;
    retryMessage?: (messageId: string, isClientMessage: boolean) => void;
    joinFirm: (inviteCode: string) => Promise<string | null>;
    validateInviteCode: (inviteCode: string) => Promise<{ valid: boolean, firmName?: string, firmId?: string }>;
    regenerateInviteCode: (firmId: string) => Promise<string | null>;
    handleClearState: () => void;
}
export interface JurisdictionalAnalysis { recommendedCourt: string; reasoning: string; confidenceScore: number; judicialDivision?: string; }
export type AccessLevel = 'Standard' | 'Limited' | 'DocumentOnly';
export type EventTypeString = string;
export interface AttorneyNote { id: string; date: string; transcription: string; summary: string; audioUrl?: string; }
export interface ClientBillingSummary { totalBilled: number; totalPaid: number; outstanding: number; totalExpenses: number; netProfit: number; arAging: Record<string, number>; velocityData: { month: string; value: number }[]; currentMonthRevenue: number; monthlyTarget: number; }
export type ReportDateRangeOption = 'last_30' | 'last_90' | 'this_year' | 'all_time';
export interface TimesheetData { user: { id: string; name: string; role: string; }; entries: { date: string; matterTitle: string; clientName: string; duration: number; description: string; }[]; }
export interface UtilizationData { users: { user: { id: string; name: string; role: string; }; totalHours: number; billableHours: number; utilizationRate: number; }[]; }
export interface MatterStatusReportData { matters: { title: string; clientName: string; status: string; currentStage: string; assignedTeam: string; }[]; }
export interface ProfitLossData { revenue: { description: string; amount: number; }[]; expenses: { description: string; amount: number; }[]; totalRevenue: number; totalExpenses: number; netProfit: number; }
export interface ArAgingData { buckets: { '0-30': number; '31-60': number; '61-90': number; '90+': number; }; total: number; entries: { clientName: string; invoiceNumber: string; dueDate: string; daysOverdue: number; amount: number; }[]; }
export type MatterStage = string;
export type EventStatus = 'Active' | 'Cancelled';

// =====================================================================
// ATRIUM REVENUE MONITOR TYPES
// =====================================================================

export type LedgerEntryType = 'rent' | 'service_charge' | 'penalty' | 'deposit';
export type LedgerEntryStatus = 'pending' | 'cleared' | 'defaulted';
export type ServiceChargeCategory = 'Diesel' | 'Security' | 'Cleaning' | 'Water' | 'Other';
export type ServiceChargeCycle = 'Monthly' | 'Quarterly' | 'Annually';
export type LeadPipelineStage = 'Inquiry' | 'Vetted' | 'Lease_Generated' | 'Closed';
export type AutomationMessageType = 'rent_reminder' | 'late_notice' | 'payment_receipt' | 'service_charge_alert' | 'access_restriction' | 'penalty_notice' | 'lease_renewal' | 'welcome_note' | 'promotion' | 'vendor_update' | 'general_announcement' | 'maintenance_update' | 'custom';
export type AutomationChannel = 'whatsapp' | 'email' | 'portal' | 'in-app';

// ── Communication Integration ────────────────────────────────────────────
export type CommunicationProvider = 'chakra' | 'twilio' | 'manual' | 'none';
export type IntegrationStatus = 'connected' | 'disconnected' | 'simulated' | 'not_configured';

export interface ChakraHQConfig {
  /** ChakraHQ account ID linked to this firm */
  accountId?: string;
  /** Current ChakraHQ plan: free, starter, pro, enterprise */
  plan?: 'free' | 'starter' | 'pro' | 'enterprise';
  /** API key (stored server-side only, never exposed to client) */
  apiKeySet?: boolean;
  /** Webhook URL for receiving inbound messages */
  webhookUrl?: string;
  /** Phone number connected via ChakraHQ */
  connectedPhone?: string;
  /** Last sync timestamp */
  lastSyncAt?: number;
  /** Whether the integration is active */
  isActive: boolean;
}

export interface CommunicationIntegration {
  /** Primary communication provider */
  provider: CommunicationProvider;
  /** ChakraHQ-specific configuration */
  chakra?: ChakraHQConfig;
  /** Integration status derived from config */
  status: IntegrationStatus;
  /** Available channels based on plan */
  availableChannels: ('whatsapp' | 'email' | 'portal')[];
  /** Monthly message limits (0 = unlimited) */
  monthlyLimits: {
    whatsapp: number;  // ChakraHQ free = 1000/mo, starter = 5000/mo, pro = unlimited
    email: number;     // Usually unlimited
    portal: number;    // Portal messages (no limit)
  };
  /** Current month usage */
  currentUsage?: {
    whatsapp: number;
    email: number;
    portal: number;
    period: string; // e.g. "2026-05"
  };
}


export interface LedgerEntry {
  _id: string;
  firmId: string;
  propertyId?: string;
  unitId: string;
  tenantId?: string;
  amount: number;
  type: LedgerEntryType;
  status: LedgerEntryStatus;
  timestamp: number;
  paymentRef?: string;
  channel?: string;
  txHash: string;
  description?: string;
  period?: string;
}

export interface ServiceCharge {
  _id: string;
  firmId: string;
  unitId: string;
  tenantId?: string;
  category: ServiceChargeCategory;
  amount: number;
  cycle: ServiceChargeCycle;
  nextDueDate: number;
  lastPaidDate?: number;
  isDefaulter: boolean;
  daysOverdue?: number;
  penaltyApplied?: boolean;
  notes?: string;
  // Granular payment status
  serviceChargeStatus?: 'PAID_FULLY' | 'PARTIALLY_PAID' | 'UNPAID';
  // Outstanding balance when PARTIALLY_PAID
  outstandingBalance?: number;
  // Amount paid so far in current cycle
  amountPaidThisCycle?: number;
  // Last reset timestamp (monthly reset cron)
  lastResetAt?: number;
  // Whether this is a minimum vend charge
  isMinimumVend?: boolean;
}

export interface LeadPipelineEntry {
  _id: string;
  firmId: string;
  unitId: string;
  applicantName: string;
  contactInfo: string;
  stage: LeadPipelineStage;
  vettingScore?: number;
  proposedRent?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  convertedTenantId?: string;
}

export interface AutomationLog {
  _id: string;
  firmId: string;
  unitId?: string;
  tenantId?: string;
  messageType: AutomationMessageType;
  channel: AutomationChannel;
  recipient: string;
  messagePreview?: string;
  messageContent?: string;
  direction?: 'outbound' | 'inbound';
  senderName?: string;
  sentAt: number;
  status: 'sent' | 'failed' | 'simulated';
  triggeredBy?: string;
}

export interface AuditTrailEntry {
  _id: string;
  direction: 'outbound' | 'inbound';
  channel: string;
  messageType?: string;
  recipient?: string;
  senderName?: string;
  senderContact?: string;
  content: string;
  timestamp: number;
  status?: string;
  triggeredBy?: string;
  unitId?: string;
  tenantId?: string;
}

export interface AtriumInboundMessage {
  _id: string;
  firmId: string;
  unitId?: string;
  tenantId?: string;
  senderName?: string;
  senderContact: string;
  channel: AutomationChannel;
  content: string;
  mediaUrl?: string;
  mimeType?: string;
  receivedAt: number;
  isRead: boolean;
  aiAnalysis?: {
    intent: string;
    sentiment: string;
    suggestedReply?: string;
  };
}

export interface CashFlowSummary {
  totalIncome: number;
  revenueAtRisk: number;
  totalTransactions: number;
  monthlyData: Record<string, { income: number; risk: number }>;
}

