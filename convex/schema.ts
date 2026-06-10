
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
    password: nullableString,
    lockedUntil: nullableNumber,
    failedLoginAttempts: nullableNumber,
    mfaCode: nullableString,
    recoveryCode: nullableString,
    emailVerified: nullableBoolean,
    externalCounselId: nullableString,
    id: nullableString,
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_token", ["tokenIdentifier"]).index("by_firm", ["firmId"]),

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
  }).index("by_firm", ["firmId"]).index("by_custom_id", ["id"]),

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
  }).index("by_firm", ["firmId"]).index("by_custom_id", ["id"]),

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
  }).index("by_firm", ["firmId"]).index("by_matter", ["matterId"]),

  documents: defineTable({
    firmId: nullableString,
    title: nullableString,
    matterId: nullableString,
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
    createdAt: nullableString,
    updatedAt: nullableString,
    _lastModifiedBy: nullableString,
    _version: nullableNumber,
  }).index("by_firm", ["firmId"]).index("by_matter", ["matterId"]),

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
    type: v.union(v.literal("rent"), v.literal("service_charge"), v.literal("penalty"), v.literal("deposit")),
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
      v.literal("lease_renewal")
    ),
    channel: v.union(v.literal("whatsapp"), v.literal("email"), v.literal("sms")),
    recipient: v.string(), 
    messagePreview: v.optional(v.string()),
    sentAt: v.number(),
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("simulated")),
    triggeredBy: v.optional(v.string()), 
  })
    .index("by_firm", ["firmId"])
    .index("by_unit", ["unitId"])
    .index("by_tenant", ["tenantId"])
    .index("by_sentAt", ["sentAt"])
    .index("by_firm_type", ["firmId", "messageType"]),

  atrium_inbound_messages: defineTable({
    firmId: v.string(),
    unitId: v.optional(v.string()),
    tenantId: v.optional(v.string()),
    senderName: v.optional(v.string()),
    senderContact: v.string(), 
    channel: v.union(v.literal("whatsapp"), v.literal("email"), v.literal("sms")),
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
    .index("by_firm_read", ["firmId", "isRead"]),

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

}, { schemaValidation: false });
