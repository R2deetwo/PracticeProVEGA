
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Procedural OS / Atrium Property OS - Core Schema
 * Phase 1: Data Integrity (Strict Validation Rollout)
 */

const nullableString = v.optional(v.union(v.string(), v.null()));
const nullableNumber = v.optional(v.union(v.number(), v.null()));
const nullableBoolean = v.optional(v.union(v.boolean(), v.null()));

export default defineSchema({
  // 1. Firms (Organizations)
  firms: defineTable({
    name: nullableString,
    address: nullableString,
    logoUrl: nullableString,
    letterheadUrl: nullableString,
    digitalStampUrl: nullableString,
    headerTextColor: nullableString,
    inviteCode: nullableString,
    areWorkflowsEnabled: nullableBoolean,
    aloaFirmPersonality: nullableString,
    bankAccounts: v.optional(v.array(v.any())),
    aiSettings: v.optional(v.any()),
    integrations: v.optional(v.any()),
    monthlyRevenueTarget: nullableNumber,
    subscriptionPlan: nullableString,
    subscriptionAddons: v.optional(v.any()),
    practiceJurisdictions: v.optional(v.any()),
    customHolidays: v.optional(v.array(v.string())),
    taxSettings: v.optional(v.any()),
    created_by: nullableString,
    createdBy: nullableString,
    settings: v.optional(v.any()),
    localFolderPath: nullableString,
    firmSpecialties: v.optional(v.array(v.string())),
    legalFormLibrary: v.optional(v.array(v.any())),
    product: nullableString,
    automationSettings: v.optional(v.any()),
    maxUnits: nullableNumber,
    maxActiveTenants: nullableNumber,
    whatsappMessagesSent: nullableNumber,
    whatsappLimit: nullableNumber,
    setupFeePaid: nullableBoolean,
    trustAccountingEnabled: v.optional(v.boolean()),  // Toggle: enable trust accounting for this firm
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_invite", ["inviteCode"]),

  // 2. Users (Profiles)
  users: defineTable({
    firmId: nullableString,
    name: nullableString,
    email: nullableString,
    role: nullableString,
    avatarUrl: nullableString,
    barNumber: nullableString,
    showProTips: nullableBoolean,
    professionalStandards: v.optional(v.any()),
    notificationSettings: v.optional(v.any()),
    defaultViewModes: v.optional(v.any()),
    accessibleMatterIds: v.optional(v.array(v.string())),
    namePronunciation: nullableString,
    lastViewedPortalAt: nullableString,
    enableLiveFlashes: nullableBoolean,
    defaultMatterType: nullableString,
    onboardingCompleted: nullableBoolean,
    isMfaEnabled: nullableBoolean,
    product: nullableString,
    tokenIdentifier: nullableString,
    joinedFirmIds: v.optional(v.array(v.string())),
    isVerified: nullableBoolean,
    verificationCode: nullableString,
    welcomeEmailSent: nullableBoolean,
    password: nullableString,
    lockedUntil: nullableNumber,
    failedLoginAttempts: nullableNumber,
    mfaCode: nullableString,
    recoveryCode: nullableString,
    emailVerified: nullableBoolean,
    externalCounselId: nullableString,
    // Portal access token — unique, random-looking identifier used in portal URLs
    // (e.g. /portal/tenant/2e71135d-003e-42dd-83ff-9f7988e7c6ac)
    // NOT used for authentication — just for routing/identification/bookmarkability.
    portalAccessToken: nullableString,
    // ─── Push Notification Registration ───────────────────────────────
    // When true, the user has the mobile app installed AND has granted
    // notification permission. The backend uses this to decide whether
    // to send a push notification (and skip the email) or send an email
    // (and skip the push). Smart delivery: push OR email, not both.
    pushNotificationEnabled: nullableBoolean,
    pushNotificationRegisteredAt: nullableNumber,
    id: nullableString,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_token", ["tokenIdentifier"]).index("by_firm", ["firmId"]).index("by_portal_access_token", ["portalAccessToken"]),

  // 3. Operational Data
  matters: defineTable({
    firmId: nullableString,
    referenceNumber: nullableString,
    suitNumber: nullableString,
    title: nullableString,
    type: nullableString,
    subCategory: nullableString,
    clientId: nullableString,
    court: nullableString,
    judicialDivision: nullableString,
    stage: nullableString,
    stageLastUpdated: nullableString,
    opposingCounsel: nullableString,
    hourlyRate: nullableNumber,
    fixedFeeAmount: nullableNumber,
    billingModel: nullableString,
    billingPercentage: nullableNumber,
    billingBase: nullableString,
    // ─── Recurring Retainer Auto-Billing Config ───────────────────────
    // billingFrequency: Weekly | Monthly | Quarterly | Bi-Annually | Annually
    // nextBillingDate: ISO string of the next scheduled invoice staging date
    // retainerAutoBillingEnabled: when false, the matter is excluded from cron scans
    billingFrequency: nullableString,
    nextBillingDate: nullableString,
    retainerAutoBillingEnabled: nullableBoolean,
    withholdingTaxApplicable: nullableBoolean,
    status: nullableString,
    assignedUsers: v.optional(v.array(v.string())),
    billingAccess: v.optional(v.array(v.string())),
    trustBalance: nullableNumber,
    associatedContactIds: v.optional(v.array(v.string())),
    attorneyNotes: v.optional(v.array(v.any())),
    jurisdictionalAnalysis: v.optional(v.any()),
    presidingJudge: nullableString,
    courtRoom: nullableString,
    nextAdjournedDate: nullableString,
    originatingProcess: nullableString,
    cacAvailabilityCode: nullableString,
    rcNumber: nullableString,
    shareCapital: nullableNumber,
    annualReturnsDueDate: nullableString,
    propertyValue: nullableNumber,
    titleRegistrationDetails: nullableString,
    transactionStage: nullableString,
    billingCurrency: nullableString,
    leadSource: nullableString,
    hasExternalAccess: nullableBoolean,
    isPrivate: v.optional(v.boolean()),
    processTracking: v.optional(v.any()),
    reviewReminder: v.optional(v.any()),
    parties: v.optional(v.array(v.any())),
    specialtyData: v.optional(v.any()),
    id: nullableString, // Legacy field — frontend copy of _id
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]).index("by_custom_id", ["id"])
    .index("by_status", ["firmId", "status"])
    .index("by_client", ["firmId", "clientId"])
    .searchIndex("search_title", { searchField: "title" })
    .searchIndex("search_suit", { searchField: "suitNumber" }),

  contacts: defineTable({
    firmId: nullableString,
    name: nullableString,
    email: nullableString,
    phone: nullableString,
    address: nullableString,
    contactType: nullableString,
    category: nullableString,
    jobTitle: nullableString,
    companyName: nullableString,
    website: nullableString,
    notes: nullableString,
    properties: v.optional(v.array(v.any())),
    userId: nullableString,
    identificationNumber: nullableString,
    taxId: nullableString,
    nextOfKin: nullableString,
    dateOfBirth: nullableString,
    matterId: nullableString, // Legacy singular field
    matterIds: v.optional(v.array(v.string())),
    id: nullableString, // Legacy field — frontend copy of _id
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]).index("by_custom_id", ["id"])
    .searchIndex("search_name", { searchField: "name" }),

  tasks: defineTable({
    firmId: nullableString,
    title: nullableString,
    description: nullableString,
    status: nullableString,
    dueDate: nullableString,
    assignedUsers: v.optional(v.array(v.string())),
    matterId: nullableString,
    creatorId: nullableString,
    priority: nullableString,
    checklist: v.optional(v.any()),
    isSystem: nullableBoolean,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]).index("by_matter", ["matterId"])
    .index("by_status", ["firmId", "status"])
    .index("by_dueDate", ["firmId", "dueDate"]),

  documents: defineTable({
    firmId: nullableString,
    title: nullableString,
    matterId: nullableString,
    propertyId: nullableString,
    categoryId: nullableString,
    dateFiled: nullableString,
    assignedUsers: v.optional(v.array(v.string())),
    file: v.optional(v.any()),
    content: nullableString,
    source: nullableString,
    uploadedBy: nullableString,
    versions: v.optional(v.array(v.any())),
    comments: v.optional(v.array(v.any())),
    analysisState: nullableString,
    summary: nullableString,
    riskAnalysis: v.optional(v.any()),
    extractedMetadata: v.optional(v.any()),
    dataProtectionAnalysis: v.optional(v.any()),
    rpcReview: v.optional(v.any()),
    analysisCompletedAt: nullableString,
    isSharedWithClient: nullableBoolean,
    clientReviewStatus: nullableString,
    isSignatureRequested: nullableBoolean,
    signatureData: nullableString,
    signedAt: nullableString,
    signerId: nullableString,
    metadata: v.optional(v.any()),
    isCourtProcess: nullableBoolean,
    litigationStatus: nullableString,
    // ANTI-GRAVITY: store compressed PDF size for display in document list
    // without re-fetching the file. Set when PDF is generated/uploaded.
    pdfSizeBytes: nullableNumber,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]).index("by_matter", ["matterId"]).index("by_property", ["propertyId"])
    .index("by_category", ["firmId", "categoryId"])
    .searchIndex("search_title", { searchField: "title" }),

  workflows: defineTable({
    firmId: nullableString,
    type: nullableString,
    default: v.optional(v.any()),
    subCategories: v.optional(v.any()),
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]),

  leads: defineTable({
    firmId: nullableString,
    name: nullableString,
    email: nullableString,
    status: nullableString,
    intakeSentAt: nullableString,
    intakeSubmittedAt: nullableString,
    intakeRecordings: v.optional(v.array(v.any())),
    intakeTranscription: nullableString,
    isAnalyzing: nullableBoolean,
    intakeAnalysis: v.optional(v.any()),
    convertedMatterId: nullableString,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]),

  notifications: defineTable({
    firmId: nullableString,
    userId: nullableString,
    message: nullableString,
    title: nullableString,
    type: nullableString,
    link: v.optional(v.any()),
    actionLink: nullableString,
    timestamp: nullableString,
    isRead: nullableBoolean,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]),

  invoices: defineTable({
    firmId: nullableString,
    invoiceNumber: nullableString,
    client: v.optional(v.any()),
    matter: v.optional(v.any()),
    lineItems: v.optional(v.array(v.any())),
    status: nullableString,
    issueDate: nullableString,
    dueDate: nullableString,
    paidDate: nullableString,
    paymentDetails: v.optional(v.any()),
    subTotal: nullableNumber,
    taxAmount: nullableNumber,
    total_amount: nullableNumber,
    userId: nullableString,
    id: nullableString,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]).index("by_custom_id", ["id"]),

  events: defineTable({
    firmId: nullableString,
    title: nullableString,
    description: nullableString,
    matterTitle: nullableString,
    type: nullableString,
    date: nullableString,
    endDate: nullableString,
    matterId: nullableString,
    status: nullableString,
    court: nullableString,
    judicialDivision: nullableString,
    assignedUsers: v.optional(v.array(v.string())),
    reminder: v.optional(v.any()),
    recurrence: v.optional(v.any()),
    originalId: nullableString,
    created_by: nullableString,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]).index("by_matter", ["matterId"]),

  timeEntries: defineTable({
    firmId: nullableString,
    matterId: nullableString,
    user_id: nullableString,
    date: nullableString,
    duration: nullableNumber,
    rate: nullableNumber,
    description: nullableString,
    billable: nullableBoolean,
    billedInInvoiceId: nullableString,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]),

  expenses: defineTable({
    firmId: nullableString,
    matterId: nullableString,
    date: nullableString,
    amount: nullableNumber,
    description: nullableString,
    isBillable: nullableBoolean,
    billedInInvoiceId: nullableString,
    taxDeductibility: v.optional(v.any()),
    userId: nullableString,
    id: nullableString,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]).index("by_custom_id", ["id"]),

  firmActivity: defineTable({
    firmId: nullableString,
    userId: nullableString,
    userName: nullableString,
    action: nullableString,
    timestamp: nullableString,
    targetType: nullableString,
    targetId: nullableString,
    targetName: nullableString,
    matterId: nullableString,
    id: nullableString, // Legacy field — frontend copy of _id
    metadata: v.optional(v.any()),
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]).index("by_custom_id", ["id"]),

  chatMessages: defineTable({
    firmId: nullableString,
    conversationId: nullableString,
    authorId: nullableString,
    userId: nullableString, // Legacy field — kept for backward compatibility
    content: nullableString,
    timestamp: nullableString,
    deletedForUserIds: v.optional(v.array(v.string())),
    isDeleted: nullableBoolean,
    status: nullableString,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_conversation", ["conversationId"]).index("by_firm", ["firmId"]),

  chatConversations: defineTable({
    firmId: nullableString,
    type: nullableString,
    name: nullableString,
    memberIds: v.optional(v.array(v.string())),
    creatorId: nullableString,
    hiddenForUserIds: v.optional(v.array(v.string())),
    matterId: nullableString,
    userId: nullableString, // Legacy field — kept for backward compatibility
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]),

  noteNotebooks: defineTable({
    name: nullableString,
    color: nullableString,
    description: nullableString,
    isShared: nullableBoolean,
    sharedWithIds: v.optional(v.array(v.string())),
    userId: nullableString,
    firmId: nullableString,
    matterId: nullableString,
    scope: nullableString,
    isCore: nullableBoolean,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]).index("by_user", ["userId"]),

  notePages: defineTable({
    firmId: nullableString,
    title: nullableString,
    content: nullableString,
    notebookId: nullableString,
    parentId: nullableString,
    matterId: nullableString,
    propertyId: nullableString,
    contextType: nullableString,
    archivedAt: nullableNumber,
    authorId: nullableString,
    userId: nullableString, // Legacy field
    createdAt: nullableString,
    updatedAt: nullableString,
    order: nullableNumber,
    type: nullableString,
    systemNoteIcon: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  })
    .index("by_notebook", ["notebookId"])
    .index("by_firm", ["firmId"])
    .index("by_matter", ["matterId"])
    .index("by_property", ["propertyId"])
    .index("by_context", ["contextType"])
    .index("by_archived", ["archivedAt"]),

  eventTypes: defineTable({
    firmId: nullableString,
    name: nullableString,
    color: nullableString,
    isSystem: nullableBoolean,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]),

  contactCategories: defineTable({
    firmId: nullableString,
    name: nullableString,
    isSystem: nullableBoolean,
    product: nullableString,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]),

  documentCategories: defineTable({
    firmId: nullableString,
    name: nullableString,
    parentId: nullableString,
    isCore: nullableBoolean,
    isSystem: nullableBoolean,
    product: nullableString,
    color: nullableString,
    description: nullableString,

    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]),

  checklistTemplates: defineTable({
    firmId: nullableString,
    name: nullableString,
    items: v.optional(v.array(v.any())),
    relevantMatterTypes: v.optional(v.array(v.string())),
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]),

  documentTemplates: defineTable({
    firmId: nullableString,
    categoryId: nullableString,
    categoryName: nullableString,
    name: nullableString,
    description: nullableString,
    content: nullableString,
    placeholders: v.optional(v.array(v.string())),
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]),

  documentTemplateCategories: defineTable({
    firmId: nullableString,
    name: nullableString,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]),

  externalCounselInvites: defineTable({
    firmId: nullableString,
    matterId: nullableString,
    email: nullableString,
    name: nullableString,
    firmName: nullableString,
    roleInMatter: nullableString,
    accessLevel: nullableString,
    expiresAt: nullableString,
    status: nullableString,
    invitedBy: nullableString,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]),

  automationRules: defineTable({
    firmId: nullableString,
    name: nullableString,
    triggerType: nullableString,
    triggerValue: nullableString,
    actions: v.optional(v.array(v.any())),
    isEnabled: nullableBoolean,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]),

  intakeForms: defineTable({
    firmId: nullableString,
    name: nullableString,
    description: nullableString,
    fields: v.optional(v.array(v.any())),
    publicLink: nullableString,
    responsesCount: nullableNumber,
    isEnabled: nullableBoolean,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]),

  documentGenerationMetadata: defineTable({
    firmId: nullableString,
    documentType: nullableString,
    propertyId: nullableString,
    matterId: nullableString,
    templateId: nullableString,
    generatedBy: nullableString,
    metadata: v.optional(v.any()),
    fieldMappings: nullableString,
    renderedOutput: nullableString,
    createdBy: nullableString,
    missingFields: nullableString,
    createdAt: nullableNumber,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]).index("by_property", ["propertyId"]).index("by_matter", ["matterId"]),

  clientMessages: defineTable({
    firmId: nullableString,
    matterId: nullableString,
    authorId: nullableString,
    content: nullableString,
    timestamp: nullableString,
    isRead: nullableBoolean,
    status: nullableString,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]),

  archive: defineTable({
    firmId: nullableString,
    itemType: nullableString,
    itemId: nullableString,
    itemName: nullableString,
    archivedAt: nullableString,
    archiverId: nullableString,
    archiverName: nullableString,
    originalData: v.optional(v.any()),
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]),

  researchNotebooks: defineTable({
    firmId: nullableString,
    userId: nullableString,
    name: nullableString,
    matterId: nullableString,
    id: nullableString,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]).index("by_custom_id", ["id"]),

  researchSources: defineTable({
    firmId: nullableString,
    notebookId: nullableString,
    name: nullableString,
    type: nullableString,
    content: nullableString,
    file: v.optional(v.any()),
    id: nullableString,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_notebook", ["notebookId"]).index("by_firm", ["firmId"]).index("by_custom_id", ["id"]),

  researchMessages: defineTable({
    firmId: nullableString,
    notebookId: nullableString,
    role: nullableString,
    content: nullableString,
    timestamp: nullableString,
    citations: v.optional(v.array(v.any())),
    id: nullableString,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_notebook", ["notebookId"]).index("by_firm", ["firmId"]).index("by_custom_id", ["id"]),

  researchAnalysisResults: defineTable({
    firmId: nullableString,
    notebookId: nullableString,
    type: nullableString,
    title: nullableString,
    content: nullableString,
    timestamp: nullableString,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_notebook", ["notebookId"]).index("by_firm", ["firmId"]),

  presence: defineTable({
    firmId: nullableString,
    userId: nullableString,
    userName: nullableString,
    updatedAt: nullableNumber,
  }).index("by_firm", ["firmId"]).index("by_user", ["userId"]),

  properties: defineTable({
    firmId: nullableString,
    contactId: nullableString,
    ownerId: nullableString,
    landlordId: nullableString,
    tenantId: nullableString,
    currentTenantId: nullableString,
    matterId: nullableString,
    address: nullableString,
    category: nullableString,
    ownershipType: nullableString,
    propertyType: nullableString,
    description: nullableString,
    status: nullableString,
    rentCollectionMode: nullableString,
    value: nullableNumber,
    rentalDetails: v.optional(v.any()),
    disputeDetails: v.optional(v.any()),
    saleDetails: v.optional(v.any()),
    managementFeePercentage: nullableNumber,
    numberOfUnits: nullableNumber,
    units: v.optional(v.array(v.any())),
    images: v.optional(v.array(v.any())),
    automationSettings: v.optional(v.any()),
    trackingTimeline: v.optional(v.array(v.any())),
    maintenanceHistory: v.optional(v.array(v.any())),
    rentPaymentHistory: v.optional(v.array(v.any())),
    // Minimum Vend / Estate Fees toggle (property-wide)
    minimumVendEnabled: nullableBoolean,
    minimumVendAmount: nullableNumber,
    minimumVendLabel: nullableString,
    // ─── Notification Guardrails ─────────────────────────
    // Property-level global toggle for morning utility reminders
    remindersEnabled: nullableBoolean,
    // Max consecutive reminders before auto-pause (default 7)
    reminderCoolOffDays: nullableNumber,
    id: nullableString, // Legacy ID from frontend
    userId: nullableString, // Legacy ID from frontend
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  })
    .index("by_firm", ["firmId"])
    .index("by_contact", ["contactId"])
    .index("by_matter", ["matterId"])
    .index("by_custom_id", ["id"]),

  tenancies: defineTable({
    firmId: nullableString,
    propertyId: nullableString,
    tenantId: nullableString,
    status: nullableString,
    startDate: nullableString,
    endDate: nullableString,
    rentAmount: nullableNumber,
    paymentFrequency: nullableString,
    arrearsFrom: nullableString,
    arrearsTo: nullableString,
    totalArrears: nullableNumber,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]).index("by_property", ["propertyId"]).index("by_tenant", ["tenantId"]),

  // 4. Pre-typed / System Tables (Maintained as-is)
  memories: defineTable({
    text: v.string(),
    embedding: v.array(v.number()),
    metadata: v.any(),
    firmId: v.string(),
    scope: v.optional(v.string()), 
    userId: v.optional(v.string()),
  })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["firmId", "scope"],
    })
    .index("by_firm", ["firmId"])
    .index("by_scope", ["scope"]),

  aloaConversations: defineTable({
    firmId: v.string(),
    userId: v.string(),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_firm", ["firmId"]).index("by_user", ["userId"]),

  aloaMessages: defineTable({
    conversationId: v.string(),
    firmId: v.string(),
    role: v.string(),
    content: v.optional(v.string()),
    toolCalls: v.optional(v.any()),
    toolResult: v.optional(v.any()),
    modelUsed: v.optional(v.string()),
    isError: v.optional(v.boolean()),
    errorDetails: v.optional(v.string()),
    toolAction: v.optional(v.any()),
    id: v.string(),
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId"]).index("by_firm", ["firmId"]),

  analytics_events: defineTable({
    firmId: v.string(),
    userId: v.string(),
    event: v.string(),
    properties: v.any(),
    timestamp: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_user", ["userId"])
    .index("by_event", ["event"])
    .index("by_timestamp", ["timestamp"]),

  usage_snapshots: defineTable({
    date: v.string(),
    firmId: v.string(),
    totalMatters: v.number(),
    activeUsers: v.number(),
    revenueToDate: v.number(),
  }).index("by_firm_date", ["firmId", "date"]),

  firm_health_scores: defineTable({
    firmId: v.string(),
    score: v.number(),
    factors: v.object({
      recentLogins: v.number(),
      matterGrowth: v.number(),
    }),
  }).index("by_firm", ["firmId"]),

  user_feedback: defineTable({
    firmId: v.string(),
    userId: v.string(),
    userName: v.string(),
    userEmail: v.string(),
    type: v.optional(v.string()),
    title: v.optional(v.string()),
    message: v.string(),
    rating: v.optional(v.number()),
    status: v.string(),
    adminReply: v.optional(v.string()),
    replies: v.optional(v.array(v.object({
      adminId: v.string(),
      message: v.string(),
      timestamp: v.number(),
    }))),
    source: v.optional(v.string()),  // "feedback" | "aloa_echo" — distinguishes real feedback from Aloa chat echoes
    timestamp: v.number(),
  }).index("by_firm", ["firmId"])
    .index("by_status", ["status"])
    .index("by_timestamp", ["timestamp"]),

  legal_modules: defineTable({
    moduleKey: v.string(),
    name: v.string(),
    shortName: v.string(),
    category: v.string(),
    jurisdiction: v.string(),
    authority: v.string(),
    version: v.optional(v.string()),
    description: v.optional(v.string()),
    coverageAreas: v.array(v.string()),
    primaryMatterTypes: v.array(v.string()),
    status: v.string(),
    isBundled: v.boolean(),
    lastUpdated: v.optional(v.string()),
    pricingType: v.optional(v.string()),
    priceAmount: v.optional(v.number()),
    currency: v.optional(v.string()),
    billingInterval: v.optional(v.string()),
  })
  .index("by_moduleKey", ["moduleKey"])
  .index("by_category", ["category"])
  .index("by_status", ["status"]),

  statutes: defineTable({
    moduleKey: v.string(),
    title: v.string(),
    year: v.optional(v.number()),
    chapter: v.optional(v.string()),
    documentType: v.optional(v.string()),
    court: v.optional(v.string()),
    parties: v.optional(v.string()),
    suitNumber: v.optional(v.string()),
    dateOfDelivery: v.optional(v.string()),
    fullText: v.optional(v.string()),
    summary: v.optional(v.string()),
    citation: v.optional(v.string()),
    tags: v.array(v.string()),
    sourceUrl: v.optional(v.string()),
    embedding: v.optional(v.array(v.number())),
  })
  .index("by_moduleKey", ["moduleKey"])
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 768,
    filterFields: ["moduleKey"],
  }),

  firm_licenses: defineTable({
    firmId: v.string(),
    moduleKey: v.string(),
    isActive: v.boolean(),
    plan: v.string(),
    grantedAt: v.string(),
    revokedAt: v.optional(v.string()),
    expiresAt: v.optional(v.string()),
  })
  .index("by_firmId", ["firmId"])
  .index("by_moduleKey", ["moduleKey"])
  .index("by_firmId_moduleKey", ["firmId", "moduleKey"]),

  ledger_entries: defineTable({
    firmId: v.string(),
    propertyId: v.optional(v.string()),
    unitId: v.string(),
    tenantId: v.optional(v.string()),
    amount: v.number(),
    type: v.union(v.literal("rent"), v.literal("service_charge"), v.literal("penalty"), v.literal("deposit"), v.literal("management_fee")),
    status: v.union(v.literal("pending"), v.literal("cleared"), v.literal("defaulted")),
    timestamp: v.number(),
    paymentRef: v.optional(v.string()),
    channel: v.optional(v.string()),
    txHash: v.string(), 
    description: v.optional(v.string()),
    period: v.optional(v.string()), 
  })
    .index("by_firm", ["firmId"])
    .index("by_unit", ["unitId"])
    .index("by_status", ["status"])
    .index("by_timestamp", ["timestamp"])
    .index("by_firm_unit", ["firmId", "unitId"]),

  service_charges: defineTable({
    firmId: v.string(),
    unitId: v.string(),
    tenantId: v.optional(v.string()),
    category: v.union(v.literal("Diesel"), v.literal("Security"), v.literal("Cleaning"), v.literal("Water"), v.literal("Other")),
    amount: v.number(),
    cycle: v.union(v.literal("Monthly"), v.literal("Quarterly"), v.literal("Annually")),
    nextDueDate: v.number(), 
    lastPaidDate: v.optional(v.number()),
    isDefaulter: v.boolean(),
    daysOverdue: v.optional(v.number()),
    penaltyApplied: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    // Granular payment status (replaces simple boolean)
    serviceChargeStatus: v.optional(v.union(
      v.literal("PAID_FULLY"),
      v.literal("PARTIALLY_PAID"),
      v.literal("UNPAID"),
    )),
    // Outstanding balance when PARTIALLY_PAID
    outstandingBalance: v.optional(v.number()),
    // Amount paid so far in current cycle
    amountPaidThisCycle: v.optional(v.number()),
    // Last reset timestamp (monthly reset cron)
    lastResetAt: v.optional(v.number()),
    // Whether this is a minimum vend charge
    isMinimumVend: v.optional(v.boolean()),
    // ─── Reminder Guardrails ─────────────────────────────
    // Consecutive days a reminder has been sent without engagement
    consecutiveReminderCount: v.optional(v.number()),
    // Timestamp of last reminder sent for this charge
    lastReminderSentAt: v.optional(v.number()),
    // Per-unit mute toggle — admin can silence reminders for this unit/tenant
    remindersMuted: v.optional(v.boolean()),
    // Auto-paused by cool-off mechanism after max consecutive reminders
    remindersPaused: v.optional(v.boolean()),
  })
    .index("by_firm", ["firmId"])
    .index("by_unit", ["unitId"])
    .index("by_defaulter", ["isDefaulter"])
    .index("by_next_due", ["nextDueDate"])
    .index("by_firm_defaulter", ["firmId", "isDefaulter"])
    .index("by_status", ["serviceChargeStatus"])
    .index("by_firm_status", ["firmId", "serviceChargeStatus"])
    .index("by_reminders_paused", ["remindersPaused"]),

  leads_pipeline: defineTable({
    firmId: v.string(),
    unitId: v.string(),
    applicantName: v.string(),
    contactInfo: v.string(), 
    stage: v.union(
      v.literal("Inquiry"),
      v.literal("Vetted"),
      v.literal("Lease_Generated"),
      v.literal("Closed")
    ),
    vettingScore: v.optional(v.number()), 
    proposedRent: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    convertedTenantId: v.optional(v.string()),
  })
    .index("by_firm", ["firmId"])
    .index("by_unit", ["unitId"])
    .index("by_stage", ["stage"])
    .index("by_firm_stage", ["firmId", "stage"]),

  automation_logs: defineTable({
    firmId: v.string(),
    unitId: v.optional(v.string()),
    tenantId: v.optional(v.string()),
    messageType: v.union(
      v.literal("custom"),
      v.literal("rent_reminder"),
      v.literal("late_notice"),
      v.literal("payment_receipt"),
      v.literal("service_charge_alert"),
      v.literal("access_restriction"),
      v.literal("penalty_notice"),
      v.literal("lease_renewal"),
      v.literal("welcome_note"),
      v.literal("promotion"),
      v.literal("vendor_update"),
      v.literal("general_announcement"),
      v.literal("maintenance_update")
    ),
    channel: v.union(v.literal("whatsapp"), v.literal("email"), v.literal("sms"), v.literal("portal")),
    recipient: v.string(), 
    messagePreview: v.optional(v.string()),
    messageContent: v.optional(v.string()),
    direction: v.optional(v.union(v.literal("outbound"), v.literal("inbound"))),
    senderName: v.optional(v.string()),
    sentAt: v.number(),
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("simulated")),
    triggeredBy: v.optional(v.string()), 
  })
    .index("by_firm", ["firmId"])
    .index("by_unit", ["unitId"])
    .index("by_tenant", ["tenantId"])
    .index("by_sentAt", ["sentAt"])
    .index("by_firm_type", ["firmId", "messageType"])
    .index("by_firm_channel", ["firmId", "channel"]),

  atrium_inbound_messages: defineTable({
    firmId: v.string(),
    unitId: v.optional(v.string()),
    tenantId: v.optional(v.string()),
    senderName: v.optional(v.string()),
    senderContact: v.string(), 
    channel: v.union(v.literal("whatsapp"), v.literal("email"), v.literal("sms"), v.literal("portal")),
    content: v.string(),
    mediaUrl: v.optional(v.string()), 
    mimeType: v.optional(v.string()), 
    receivedAt: v.number(),
    isRead: v.boolean(),
    aiAnalysis: v.optional(v.object({
      intent: v.string(), 
      sentiment: v.string(),
      suggestedReply: v.optional(v.string()),
    })),
  })
    .index("by_firm", ["firmId"])
    .index("by_unit", ["unitId"])
    .index("by_tenant", ["tenantId"])
    .index("by_receivedAt", ["receivedAt"])
    .index("by_firm_read", ["firmId", "isRead"])
    .index("by_firm_channel", ["firmId", "channel"]),

  index_checkpoints: defineTable({
    sessionId: v.string(),
    sourceFile: v.string(),
    lastProcessedFrame: v.number(),
    totalFrames: v.number(),
    cumulativeText: v.string(),
    metadataSnapshot: v.any(),
    completedFrameIds: v.array(v.string()),
    updatedAt: v.string(),
  }).index("by_sessionId", ["sessionId"]),

  module_usage_logs: defineTable({
    firmId: v.string(),
    moduleKey: v.string(),
    action: v.string(),
    sourceType: v.string(),
    loggedAt: v.string(),
    details: v.optional(v.any()),
  })
  .index("by_firmId", ["firmId"])
  .index("by_moduleKey", ["moduleKey"])
  .index("by_firmId_moduleKey", ["firmId", "moduleKey"])
  .index("by_loggedAt", ["loggedAt"]),

  // ─── Consent Log (NDPA §25 compliance) ────────────────────────────
  // Records every terms/privacy acceptance with timestamp + version.
  // This is the SERVER-SIDE record that satisfies NDPA §25's requirement
  // for demonstrable consent. localStorage is NOT sufficient (volatile).
  consent_log: defineTable({
    firmId: nullableString,
    userId: nullableString,
    userEmail: nullableString,
    termsVersion: v.string(),
    acceptedAt: v.number(), // epoch millis
    userAgent: nullableString, // browser/Capacitor UA for audit
    ipAddress: nullableString, // best-effort, may be null
  }).index("by_userId", ["userId"]).index("by_acceptedAt", ["acceptedAt"]),

  aloa_documents: defineTable({
    sessionId: v.string(),
    firmId: v.optional(v.string()),
    fileName: v.string(),
    documentType: v.string(),
    totalPages: v.number(),
    totalChunks: v.number(),
    indexData: v.any(),
    processedAt: v.number(),
    status: v.string(),
    confidence: v.optional(v.number()),
    confidenceReasons: v.optional(v.array(v.string())),
    metadata: v.optional(v.any()),
    fullTextLength: v.optional(v.number()),
    fullText: v.optional(v.string()),
  })
  .index("by_sessionId", ["sessionId"])
  .index("by_firmId", ["firmId"])
  .index("by_processedAt", ["processedAt"]),
  // ─── Unauthenticated Sales Inquiries (public-facing Contact Sales drawer) ───
  // NO firmId — these come from anonymous visitors on the marketing site
  sales_inquiries: defineTable({
    email: v.string(),
    name: v.string(),
    companyName: v.optional(v.string()),
    message: v.string(),
    source: v.optional(v.string()), // "Enterprise Pricing CTA", "Komplete Callout", "Footer", etc.
    status: v.union(
      v.literal("new"),
      v.literal("contacted"),
      v.literal("qualified"),
      v.literal("closed"),
      v.literal("spam"),
    ),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"])
    .index("by_email", ["email"]),

  // ─── Service Request Types (admin-configurable catalog) ────────────────
  // Each firm defines its own menu of request types shown in the portal
  // (e.g., "Plumbing", "Electrical", "Document Review", "Meeting Request").
  // Portal users pick from this list when submitting a service request.
  // Falls back to a sensible default set if no firm-specific types exist.
  service_request_types: defineTable({
    firmId: v.string(),
    portalType: v.union(v.literal("resident"), v.literal("client")),
    key: v.string(),                        // stable identifier (slug), e.g. "plumbing"
    label: v.string(),                      // human label, e.g. "Plumbing"
    description: v.optional(v.string()),    // helper text shown under the label
    category: v.optional(v.string()),       // broad bucket: "maintenance" | "legal" | "administrative" | "billing" | "other"
    defaultPriority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    icon: v.optional(v.string()),           // optional emoji or icon name for display
    isActive: v.boolean(),                  // admin can disable without deleting
    sortOrder: v.optional(v.number()),      // lower numbers appear first
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_firm_portal", ["firmId", "portalType"])
    .index("by_firm_active", ["firmId", "isActive"]),

  // ─── Client Service Requests (Vega / legal portal) ─────────────────────
  // The client-portal equivalent of maintenance_tickets. A client submits a
  // request ("Document Review", "Meeting Request", "Billing Inquiry", etc.),
  // and a portal_message is created in their conversation so the practitioner
  // sees it in the unified inbox.
  client_service_requests: defineTable({
    firmId: v.string(),
    clientId: v.optional(v.string()),       // userId of the client who submitted
    clientName: v.optional(v.string()),
    clientEmail: v.optional(v.string()),
    matterId: v.optional(v.string()),       // optional matter context
    requestTypeKey: v.string(),             // key from service_request_types
    requestTypeLabel: v.string(),           // human label snapshot
    subject: v.string(),
    description: v.string(),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("resolved"), v.literal("closed"), v.literal("cancelled")),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    assignedTo: v.optional(v.string()),     // userId of staff assigned
    resolution: v.optional(v.string()),
    cancellationNote: v.optional(v.string()), // reason the portal user cancelled
    cancelledAt: v.optional(v.number()),
    conversationId: v.optional(v.string()), // links to portal_conversations
    attachments: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_client", ["clientId"])
    .index("by_status", ["status"])
    .index("by_firm_status", ["firmId", "status"])
    .index("by_firm_client", ["firmId", "clientId"])
    .index("by_conversation", ["conversationId"]),

  maintenance_tickets: defineTable({
    firmId: v.string(),
    propertyId: v.string(),
    unitId: v.optional(v.string()),
    tenantId: v.optional(v.string()),       // userId of the tenant who submitted
    tenantName: v.optional(v.string()),
    subject: v.string(),
    description: v.string(),
    category: v.union(v.literal("plumbing"), v.literal("electrical"), v.literal("structural"), v.literal("other")),
    // Admin-configured type (from service_request_types). Falls back to
    // category for backward compat with tickets created before this field.
    requestTypeKey: v.optional(v.string()),
    requestTypeLabel: v.optional(v.string()),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("resolved"), v.literal("closed"), v.literal("cancelled")),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    assignedTo: v.optional(v.string()),     // userId of staff assigned
    resolution: v.optional(v.string()),
    cancellationNote: v.optional(v.string()), // reason the portal user cancelled
    cancelledAt: v.optional(v.number()),
    conversationId: v.optional(v.string()), // links to portal_conversations (NEW)
    images: v.optional(v.array(v.string())), // storageIds for attached images
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_firm", ["firmId"])
    .index("by_property", ["propertyId"])
    .index("by_tenant", ["tenantId"])
    .index("by_status", ["status"])
    .index("by_firm_status", ["firmId", "status"])
    .index("by_conversation", ["conversationId"]),

  portal_invites: defineTable({
    firmId: v.string(),
    inviterId: v.string(),                  // userId of the person who sent the invite
    inviteeEmail: v.optional(v.string()),
    inviteeName: v.optional(v.string()),
    inviteePhone: v.optional(v.string()),
    portalType: v.union(v.literal("client"), v.literal("resident")),
    relatedId: v.optional(v.string()),      // matterId for client, propertyId for resident
    token: v.optional(v.string()),           // unique invite token for magic-link URL (old invites may lack this)
    channel: v.optional(v.string()),        // "email" | "whatsapp" | "both" — how the invite was sent
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("expired"), v.literal("revoked"), v.literal("superseded")),
    message: v.optional(v.string()),
    acceptedAt: v.optional(v.number()),
    termsAcceptedAt: v.optional(v.number()),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_firm", ["firmId"])
    .index("by_email", ["inviteeEmail"])
    .index("by_status", ["status"])
    .index("by_firm_status", ["firmId", "status"])
    .index("by_token", ["token"]),

  scheduled_messages: defineTable({
    firmId: v.string(),
    propertyId: v.optional(v.string()),
    unitId: v.optional(v.string()),
    tenantIds: v.optional(v.array(v.string())),  // multiple recipients
    messageType: v.string(),
    channel: v.union(v.literal("whatsapp"), v.literal("email"), v.literal("sms")),
    content: v.string(),
    scheduledFor: v.number(),               // timestamp when it should go out
    status: v.union(v.literal("scheduled"), v.literal("sent"), v.literal("failed"), v.literal("cancelled")),
    sentAt: v.optional(v.number()),
    failureReason: v.optional(v.string()),
    isAutomation: v.optional(v.boolean()),  // true if triggered by automation rule
    automationRuleId: v.optional(v.string()),
    triggeredBy: v.optional(v.string()),    // userId if manually triggered
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_firm", ["firmId"])
    .index("by_status", ["status"])
    .index("by_scheduled", ["scheduledFor"])
    .index("by_firm_status", ["firmId", "status"])
    .index("by_automation", ["isAutomation"]),

  // ─── Portal Conversations ──────────────────────────────────────────
  // Groups portal messages into threaded conversations between a portal
  // user (Tenant/Client) and the firm admin. Each conversation is scoped
  // to a single portal user + firm pair and optionally linked to a matter.
  portal_conversations: defineTable({
    firmId: nullableString,
    participantId: nullableString,       // portal user's user ID
    participantName: nullableString,
    participantEmail: nullableString,
    participantRole: nullableString,     // "Tenant" or "Client"
    propertyId: nullableString,          // Atrium: linked property
    unitId: nullableString,              // Atrium: linked unit
    matterId: nullableString,            // Vega: linked matter
    lastMessageAt: v.number(),
    lastMessagePreview: nullableString,  // first 80 chars of last message
    lastMessageBy: nullableString,       // "participant" or "admin"
    unreadByAdmin: v.optional(v.number()), // count of unread messages for admin
    unreadByParticipant: v.optional(v.number()), // count of unread replies for participant
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_participant", ["participantId"])
    .index("by_firm_participant", ["firmId", "participantId"])
    .index("by_firm_matter", ["firmId", "matterId"]),

  // ─── Portal Messages ──────────────────────────────────────────────
  // Individual messages within a portal conversation. Each message belongs
  // to a conversation and can have file attachments stored in Convex storage.
  // When linked to a matter, file attachments are also added to the matter's documents.
  portal_messages: defineTable({
    firmId: nullableString,
    conversationId: nullableString,     // links to portal_conversations
    senderId: nullableString,
    senderName: nullableString,
    senderEmail: nullableString,
    senderRole: nullableString,         // "Tenant", "Client", or "Admin"
    subject: nullableString,
    content: nullableString,
    attachments: v.optional(v.array(v.string())), // Convex storage IDs
    attachmentNames: v.optional(v.array(v.string())), // original filenames for display
    propertyId: nullableString,
    unitId: nullableString,
    matterId: nullableString,           // if conversation is linked to a matter
    status: nullableString,             // "unread" | "read" | "replied" (for legacy compat)
    replyContent: nullableString,       // DEPRECATED — kept for backward compat
    repliedAt: nullableNumber,          // DEPRECATED — kept for backward compat
    isRead: v.optional(v.boolean()),    // per-message read state
    isDeleted: v.optional(v.boolean()), // soft-delete — message hidden for sender but preserved for admin
    deletedBy: nullableString,          // ID of the user who deleted the message
    deletedAt: nullableNumber,          // timestamp when the message was deleted
    // ─── Service Request Wiring ─────────────────────────────────────────
    // When a portal user submits a maintenance ticket or a client service
    // request, a portal_message is created in their conversation thread with
    // linkedTicketId set. This way, the request surfaces in the practitioner's
    // unified inbox alongside normal messages — nothing falls through cracks.
    linkedTicketId: nullableString,         // _id of maintenance_tickets row (Atrium)
    linkedRequestId: nullableString,        // _id of client_service_requests row (Vega)
    requestTypeKey: nullableString,         // key of the service_request_types entry chosen
    requestTypeLabel: nullableString,       // human label snapshot (e.g. "Plumbing", "Document Review")
    // ─── Sub-Threading ────────────────────────────────────────────────
    // When a conversation has multiple tickets, replies to a SPECIFIC ticket
    // get threadTicketId set (the _id of the ticket being discussed). This
    // allows the UI to group replies under their originating ticket message,
    // creating sub-threads within the main conversation.
    // Messages WITHOUT threadTicketId are general conversation messages.
    // Messages WITH threadTicketId are replies within that ticket's sub-thread.
    threadTicketId: nullableString,         // groups replies under a specific ticket
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_sender", ["senderId"])
    .index("by_firm_status", ["firmId", "status"])
    .index("by_conversation", ["conversationId"])
    .index("by_firm_matter", ["firmId", "matterId"])
    .index("by_linked_ticket", ["linkedTicketId"])
    .index("by_linked_request", ["linkedRequestId"])
    .index("by_thread", ["threadTicketId"]),

  // ─── Payment Proofs ───────────────────────────────────────────────
  // Payment proof submissions from tenants (receipts, stubs, transfer slips).
  payment_proofs: defineTable({
    firmId: nullableString,
    tenantId: nullableString,
    tenantName: nullableString,
    tenantEmail: nullableString,
    propertyId: nullableString,
    unitId: nullableString,
    amount: nullableNumber,
    period: nullableString,            // e.g., "January 2025"
    description: nullableString,
    storageIds: v.optional(v.array(v.string())), // Convex storage IDs for uploaded files
    status: nullableString,            // "pending_review" | "approved" | "rejected"
    adminNote: nullableString,
    reviewedAt: nullableNumber,
    reviewedBy: nullableString,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_tenant", ["tenantId"])
    .index("by_firm_status", ["firmId", "status"]),

  // ─── Portal Settings ──────────────────────────────────────────────
  // Per-firm portal configuration. Controls features like messaging,
  // payment proof uploads, etc.
  portal_settings: defineTable({
    firmId: nullableString,
    tenantMessagingEnabled: v.optional(v.boolean()),  // Off by default
    clientMessagingEnabled: v.optional(v.boolean()),  // Off by default
    paymentProofUploadEnabled: v.optional(v.boolean()), // On by default
    // ─── Visitor Management System (VMS) Settings ─────────────────────
    vmsEnabled: v.optional(v.boolean()),              // Master toggle for visitor codes
    vmsGatekeeperNotifications: v.optional(v.boolean()), // Send WhatsApp to gatekeeper on check-in
    vmsResidentNotifications: v.optional(v.boolean()),   // Send WhatsApp to resident when visitor arrives
    vmsGracePeriodMinutes: v.optional(v.number()),    // Default 30 min grace period
    vmsDefaultExpiryHours: v.optional(v.number()),    // Default expiry window (2/6/12/24)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_firm", ["firmId"]),

  // ─── Notice Board ──────────────────────────────────────────────────────────
  // Property managers post notices visible to all tenants on their portal.
  // Supports pinning, priority levels, optional property/unit targeting,
  // and soft-delete (archived). Visible to all portal users by default;
  // propertyId/unitId filters scope a notice to specific buildings/units.
  portal_notices: defineTable({
    firmId: v.string(),
    authorId: v.string(),                       // userId of the admin who posted
    authorName: v.optional(v.string()),          // Display name of author
    title: v.string(),                           // Notice headline
    body: v.string(),                            // Notice content (markdown-safe)
    priority: v.union(                           // Visual priority level
      v.literal("normal"),
      v.literal("important"),
      v.literal("urgent"),
    ),
    isPinned: v.optional(v.boolean()),           // Pinned to top of notice board
    propertyId: v.optional(v.string()),          // Scope to a specific property (null = all)
    unitId: v.optional(v.string()),              // Scope to a specific unit (null = all in property)
    status: v.union(                             // Active notices shown; archived = soft-deleted
      v.literal("active"),
      v.literal("archived"),
    ),
    expiresAt: v.optional(v.number()),           // Optional auto-expiry (null = never expires)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_firm_status", ["firmId", "status"])
    .index("by_firm_property", ["firmId", "propertyId"])
    .index("by_firm_pinned", ["firmId", "isPinned"]),

  // ─── Notification Preferences ─────────────────────────────────────────
  // Per-firm email notification toggles. Each key maps to a notification
  // type; the value controls whether that type triggers an email to the
  // relevant recipient.  Types not present in the object fall back to the
  // built-in defaults (see NOTIFICATION_TYPE_DEFAULTS in portals.ts).
  notification_preferences: defineTable({
    firmId: v.string(),
    preferences: v.any(),   // { [typeKey: string]: boolean } — true = email ON
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_firm", ["firmId"]),

  // ─── Proactive Intelligence Insights ─────────────────────────────────
  // Generated by the Proactive Engine (deadline scanner, anomaly detector,
  // morning briefing). Each insight is deduplicated by `dedupKey` so the
  // same finding isn't re-created on every cron run.
  proactive_insights: defineTable({
    firmId: v.string(),
    category: v.union(v.literal("deadline"), v.literal("anomaly"), v.literal("briefing")),
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
    title: v.string(),
    body: v.string(),
    entityType: v.optional(v.string()),  // "task" | "matter" | "event" | "service_charge" | "firm"
    entityId: v.optional(v.string()),
    dedupKey: v.string(),                // deterministic key for dedup per day
    dismissed: v.boolean(),
    dismissedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_firm_category", ["firmId", "category"])
    .index("by_firm_dedup", ["firmId", "dedupKey"])
    .index("by_firm_dismissed", ["firmId", "dismissed"])
    .index("by_firm_entity", ["firmId", "entityType", "entityId"]),

  // ─── Conversation Summaries (Cross-Session Memory) ──────────────────
  // AI-generated summaries of past ARIA conversations. Created nightly by
  // the batch summarization cron and injected into new sessions to provide
  // continuity across conversations.
  conversation_summaries: defineTable({
    conversationId: v.string(),          // links back to aloaConversations
    firmId: v.string(),
    userId: v.string(),
    title: v.string(),                   // AI-generated short title
    summary: v.string(),                 // 2-3 sentence summary
    keyTopics: v.array(v.string()),      // e.g. ["rent demand", "eviction", "Lagos Tenancy Law"]
    actionItems: v.optional(v.array(v.string())),  // follow-ups mentioned
    createdAt: v.number(),
  })
    .index("by_firm_user", ["firmId", "userId"])
    .index("by_conversation", ["conversationId"])
    .index("by_firm", ["firmId"]),

  // ─── Audit Logs ──────────────────────────────────────────────────────
  // Server-side audit trail for all significant mutations. Append-only.
  // The auditLog.ts module writes to this table; it was missing from the
  // schema which caused TypeScript errors during Convex deploy.
  audit_logs: defineTable({
    firmId: v.string(),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    actorRole: v.optional(v.string()),
    action: v.string(),                 // e.g. "create", "update", "delete", "archive"
    resource: v.string(),               // e.g. "matter", "contact", "property"
    resourceId: v.optional(v.string()),
    resourceName: v.optional(v.string()),
    previousState: v.optional(v.any()),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
  })
    .index("by_firm_timestamp", ["firmId", "timestamp"])
    .index("by_firm", ["firmId"])
    .index("by_actor", ["actorId"])
    .index("by_resource", ["resource"]),

  // ─── Invoice Outbox (Automated Retainer Billing) ───────────────────
  // Tracks every system-generated invoice through a strict state machine:
  //   Staged → Queued → Sent   (happy path)
  //   Staged → Failed          (missing client email / gateway error)
  //   Staged → Paused          (lawyer froze for editing)
  //   Staged → Skipped         (lawyer cancelled this cycle only)
  //
  // Each entry is linked back to its parent matter so the recurring
  // scheduler can keep advancing nextBillingDate without re-sending.
  invoice_outbox: defineTable({
    firmId: v.string(),
    matterId: v.string(),               // source matter (retainer)
    invoiceId: v.optional(v.string()),  // link to invoices table once created
    invoiceNumber: v.optional(v.string()),
    clientId: v.optional(v.string()),
    clientName: v.optional(v.string()),
    clientEmail: v.optional(v.string()),  // resolved at staging time
    matterTitle: v.optional(v.string()),
    cycleLabel: v.optional(v.string()),   // e.g. "June 2026 Retainer — Matter #ABC-001"
    frequency: v.optional(v.string()),     // Weekly | Monthly | Quarterly | Bi-Annually | Annually
    scheduledFor: v.string(),             // ISO datetime — when the staged draft should auto-advance to Queued
    stagedAt: v.string(),                 // ISO datetime — when the cron created this entry
    sentAt: v.optional(v.string()),
    failedAt: v.optional(v.string()),
    pausedAt: v.optional(v.string()),
    skippedAt: v.optional(v.string()),
    state: v.string(),                    // Staged | Queued | Sent | Failed | Paused | Skipped
    failureReason: v.optional(v.string()),
    subTotal: v.optional(v.number()),
    taxAmount: v.optional(v.number()),
    totalAmount: v.optional(v.number()),
    currency: v.optional(v.string()),
    lineItems: v.optional(v.array(v.any())),
    lastEditedBy: v.optional(v.string()),
    lastEditedAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_firm_state", ["firmId", "state"])
    .index("by_firm", ["firmId"])
    .index("by_firm_matter", ["firmId", "matterId"])
    .index("by_matter", ["matterId"])
    .index("by_state", ["state"])
    .index("by_scheduled_for", ["scheduledFor"]),

  // ─── BACKUP LOG ───────────────────────────────────────────────────────
  // Tracks each backup run so we can:
  //   1. Show backup status in the admin UI
  //   2. Clean up old backups (GitHub file SHAs + Telegram message IDs
  //      are needed to delete via their respective APIs)
  backup_log: defineTable({
    target: v.string(),           // "github" | "telegram"
    backupKey: v.string(),        // e.g. "2026-06-25/convex-backup-020000.json.gz"
    externalId: v.string(),       // GitHub: file SHA, Telegram: message_id
    fileUrl: v.optional(v.string()),
    sizeBytes: v.number(),
    success: v.boolean(),
    error: v.optional(v.string()),
    createdAt: v.string(),        // ISO timestamp
  })
    .index("by_target", ["target"])
    .index("by_created", ["createdAt"])
    .index("by_target_created", ["target", "createdAt"]),

  // ─── VISITOR MANAGEMENT SYSTEM (VMS) ──────────────────────────────────
  // Gated-estate visitor access tokens. Residents generate 6-digit codes
  // for their visitors; gatekeepers verify at the gate.
  visitor_tokens: defineTable({
    firmId: v.string(),
    propertyId: v.string(),           // estate ID
    propertyName: v.optional(v.string()),  // estate name (denormalized for gate display)
    propertyAddress: v.optional(v.string()), // full street address (denormalized)
    unitId: v.optional(v.string()),
    unitName: v.optional(v.string()),  // house number / flat label
    residentId: v.string(),           // userId of the resident
    residentName: v.optional(v.string()),
    residentPhone: v.optional(v.string()),
    // Visitor details
    visitorName: v.string(),
    visitorPhone: v.string(),         // required for portal-API delivery
    // Token
    tokenCode: v.string(),            // 6-digit code, zero-padded
    deliveryMethod: v.union(v.literal("client_share"), v.literal("portal_api")),
    whatsappSentAt: v.optional(v.number()), // timestamp if portal_api delivery succeeded
    // Lifecycle
    status: v.union(
      v.literal("active"),
      v.literal("used"),
      v.literal("expired"),
      v.literal("revoked")
    ),
    visitDate: v.string(),            // YYYY-MM-DD (the date the visit is scheduled)
    expiresAt: v.number(),            // Unix ms — computed from visitDate + expiryWindow
    expiryWindowHours: v.number(),    // 2, 6, 12, or 24
    gracePeriodMinutes: v.optional(v.number()), // default 30 — allows entry slightly before/after
    // Gate logs
    checkedInAt: v.optional(v.number()),
    checkedInBy: v.optional(v.string()),  // gatekeeper userId or name
    checkedOutAt: v.optional(v.number()),
    // Revocation
    revokedAt: v.optional(v.number()),
    revokedReason: v.optional(v.string()),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_firm",                ["firmId"])
    .index("by_property",            ["propertyId"])
    .index("by_resident",            ["residentId"])
    .index("by_status",              ["status"])
    .index("by_firm_status",         ["firmId", "status"])
    .index("by_property_status",     ["propertyId", "status"])
    .index("by_token_code",          ["tokenCode"])
    .index("by_property_code",       ["propertyId", "tokenCode"])
    .index("by_expires",             ["expiresAt"])
    .index("by_firm_resident",       ["firmId", "residentId"]),

  // ─── TRUST ACCOUNT TRANSACTIONS ────────────────────────────────────────
  // Trust accounting for legal firms that have it enabled. Tracks client
  // funds held in trust (deposits, withdrawals, transfers).
  // Feature-gated by firmDetails.trustAccountingEnabled.
  trust_transactions: defineTable({
    firmId: v.string(),
    matterId: v.optional(v.string()),     // linked matter (which client's money)
    clientId: v.optional(v.string()),     // P0 FIX: per-client sub-ledger (prevents commingling)
    clientName: v.optional(v.string()),   // denormalized for display
    type: v.union(
      v.literal("deposit"),              // money received into trust
      v.literal("withdrawal"),           // money paid out of trust
      v.literal("transfer"),             // transfer to operating account
    ),
    amount: v.number(),
    description: v.string(),             // what was this for?
    reference: v.optional(v.string()),   // bank reference / cheque number
    recordedBy: v.optional(v.string()),  // userId
    recordedByName: v.optional(v.string()),
    balanceAfter: v.number(),            // running FIRM-WIDE balance after this transaction
    clientBalanceAfter: v.optional(v.number()), // P0 FIX: running PER-CLIENT balance (prevents commingling)
    deletedAt: v.optional(v.number()),   // P0 FIX: soft delete (never rewrite history)
    deletedBy: v.optional(v.string()),   // who deleted it
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_firm",            ["firmId"])
    .index("by_matter",          ["matterId"])
    .index("by_client",          ["firmId", "clientId"])     // P0 FIX: per-client lookup
    .index("by_firm_created",    ["firmId", "createdAt"])
    .index("by_type",            ["type"]),

}, { schemaValidation: false });
