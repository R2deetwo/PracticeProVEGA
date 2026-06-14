
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
    // Portal access token — unique, random-looking identifier used in portal URLs
    // (e.g. /portal/tenant/2e71135d-003e-42dd-83ff-9f7988e7c6ac)
    // NOT used for authentication — just for routing/identification/bookmarkability.
    portalAccessToken: nullableString,
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

  maintenance_tickets: defineTable({
    firmId: v.string(),
    propertyId: v.string(),
    unitId: v.optional(v.string()),
    tenantId: v.optional(v.string()),       // userId of the tenant who submitted
    tenantName: v.optional(v.string()),
    subject: v.string(),
    description: v.string(),
    category: v.union(v.literal("plumbing"), v.literal("electrical"), v.literal("structural"), v.literal("other")),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("resolved"), v.literal("closed")),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    assignedTo: v.optional(v.string()),     // userId of staff assigned
    resolution: v.optional(v.string()),
    images: v.optional(v.array(v.string())), // storageIds for attached images
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_firm", ["firmId"])
    .index("by_property", ["propertyId"])
    .index("by_tenant", ["tenantId"])
    .index("by_status", ["status"])
    .index("by_firm_status", ["firmId", "status"]),

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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_firm", ["firmId"])
    .index("by_sender", ["senderId"])
    .index("by_firm_status", ["firmId", "status"])
    .index("by_conversation", ["conversationId"])
    .index("by_firm_matter", ["firmId", "matterId"]),

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

}, { schemaValidation: false });
