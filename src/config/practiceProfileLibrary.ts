/**
 * PracticePro VEGA — Practice Profile Library
 * ============================================================
 * Curated Nigerian practice-area "blueprints" that pre-populate a
 * firm's configuration (contact types, matter workflows with
 * sub-categories & stages, document categories, event types,
 * checklists, automation recipes) based on the areas of law the
 * firm actually practices.
 *
 * Design contract:
 *  - Keyed by the SAME practice-area strings the OnboardingWizard
 *    already collects into firmDetails.practiceProfile.practiceAreas
 *    (see the firmSpecialties enum in the app).
 *  - Workflow blueprints use the SAME shape as the existing
 *    `workflows` collection:
 *      { firmId, type, default: { stages, suggestions }, subCategories }
 *    so they can be saved through the existing
 *    addItem("workflows", data) path with zero backend changes.
 *  - Every stage list ends in a terminal stage ("Closed") so matter
 *    status rollups behave.
 *
 * Matter type strings MUST match the app's MatterType enum:
 *   "Civil Litigation" | "Criminal Defense" | "Corporate & Commercial" |
 *   "Real Estate" | "Family Law" | "Intellectual Property" |
 *   "Immigration" | "Employment & Labor" | "Tax Law" |
 *   "Maritime & Admiralty" | "Oil & Gas" | "Other"
 *
 * GENERATED FILE — source of truth is scripts/gen_practice_profiles.py.
 * Regenerate with: python3 /home/z/my-project/scripts/gen_practice_profiles.py
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskPriority = "High" | "Medium" | "Low";

export interface ProfileTaskSuggestion {
  title: string;
  priority?: TaskPriority;
  /** Days from matter creation the starter task should fall due. */
  dueInDays?: number;
  description?: string;
}

export interface WorkflowSuggestions {
  /** Standard documents/processes fired at matter kickoff. */
  processes?: string[];
  tasks?: ProfileTaskSuggestion[];
}

export interface WorkflowSubCategory {
  stages: string[];
  suggestions: WorkflowSuggestions;
}

export interface WorkflowBlueprint {
  /** Must match MatterType enum exactly. */
  type: string;
  default: { stages: string[]; suggestions: WorkflowSuggestions };
  subCategories: Record<string, WorkflowSubCategory>;
}

export interface ChecklistBlueprint {
  name: string;
  items: string[];
  /** Workflow types (MatterType enum values) the checklist applies to. */
  relevantMatterTypes: string[];
}

export interface EventTypeBlueprint {
  name: string;
  /** One of the colors the calendar renderer understands. */
  color: "red" | "blue" | "orange" | "green" | "yellow";
}

export interface PracticeProfile {
  /** matches firmSpecialties / practiceAreas strings */
  key: string;
  label: string;
  description: string;
  /** Contact categories every firm with this area needs (beyond the core). */
  contactTypes: string[];
  workflows: WorkflowBlueprint[];
  documentCategories: string[];
  eventTypes: EventTypeBlueprint[];
  checklists: ChecklistBlueprint[];
  /** Displayed in the wizard as suggested automations (phase 2 auto-setup). */
  automations: string[];
}

// ---------------------------------------------------------------------------
// Shared core — added for EVERY legal profile, curated (replacing the
// old "stock" defaults nobody used).
// ---------------------------------------------------------------------------

export const LEGAL_CORE_CONTACT_TYPES: string[] = [
  "Client",
  "Opposing Counsel",
  "Referral Counsel",
  "Witness",
];

export const LEGAL_CORE_DOCUMENT_CATEGORIES: string[] = [
  "Correspondence",
  "Agreements & Contracts",
  "Legal Opinions",
  "Engagement Letters",
];

export const LEGAL_CORE_EVENT_TYPES: EventTypeBlueprint[] = [
  { name: "Client Consultation", color: "blue" },
  { name: "Internal Deadline", color: "orange" },
  { name: "Statutory Filing Deadline", color: "red" },
];

/**
 * Default stage track used when a firm needs a workflow for a matter
 * type the selected profiles do not fully blueprint.
 */
export const GENERIC_STAGES: string[] = [
  "Intake",
  "Advice & Strategy",
  "Drafting",
  "Review & Execution",
  "Closed",
];

// ---------------------------------------------------------------------------
// Practice profiles
// ---------------------------------------------------------------------------

// Civil Litigation

const litigation: PracticeProfile = {
  key: "Civil Litigation",
  label: "Civil Litigation",
  description: "Court-bound dispute practice — pleadings, motions, trial and enforcement across State High Courts, FHC and the Court of Appeal.",
  contactTypes: [
    "Instructing Counsel",
    "Process Server",
    "Court Registrar",
    "Sheriff / Bailiff",
    "Expert Witness",
    "Judgment Debtor",
    "Surety",
  ],
  workflows: [
    {
      type: "Civil Litigation",
      default: {
        stages: [
          "Intake & Advice",
          "Pleadings",
          "Motions & Applications",
          "Discovery & Evidence",
          "Pre-Trial / CMC",
          "Trial",
          "Judgment",
          "Enforcement",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Letter of Engagement",
            "Demand / Pre-Action Letter",
            "Statement of Claim",
            "Statement of Defence",
            "Pre-Trial Memorandum",
          ],
          tasks: [
            {
              title: "Issue pre-action letter and await response window",
              priority: "High",
              dueInDays: 7,
            },
            {
              title: "Confirm limitation period for cause of action",
              priority: "High",
              dueInDays: 2,
              description: "Check State Limitation Law; 3 months if Defendant is a public officer (POPA).",
            },
            {
              title: "File originating process within court timeline",
              priority: "High",
              dueInDays: 21,
            },
          ],
        },
      },
      subCategories: {
      "Debt Recovery (Undefended List)": {
        stages: [
          "Demand Letter",
          "Writ on Undefended List",
          "Entered Judgment",
          "Enforcement",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Letter of Demand",
            "Writ of Summons (Undefended List)",
            "Affidavit in Support",
            "Application to Enter Judgment",
          ],
          tasks: [
            {
              title: "Serve writ and wait 10 days for defence",
              priority: "High",
              dueInDays: 12,
            },
            {
              title: "Enter judgment if no defence filed",
              priority: "High",
              dueInDays: 15,
            },
          ],
        },
      },
      "Contract Dispute": {
        stages: [
          "Contract Review",
          "Pleadings",
          "Motions & Interlocutory",
          "Discovery",
          "Pre-Trial / CMC",
          "Trial",
          "Judgment",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Writ of Summons",
            "Statement of Claim",
            "Statement of Defence",
            "Reply to Defence",
            "Pre-Trial Memorandum",
          ],
          tasks: [
            {
              title: "Assemble contract + correspondence bundle",
              priority: "High",
              dueInDays: 5,
            },
            {
              title: "Settle statement of claim with client sign-off",
              priority: "High",
              dueInDays: 14,
            },
          ],
        },
      },
      "Land / Recovery of Premises": {
        stages: [
          "Tenancy Review",
          "Statutory Notices",
          "Filing & Service",
          "Hearing",
          "Judgment & Possession",
          "Warrant of Possession",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Notice to Quit",
            "Notice of Owner's Intention to Recover Possession (7 Days)",
            "Claim for Possession",
            "Warrant of Possession",
          ],
          tasks: [
            {
              title: "Verify tenancy status and compute notice period",
              priority: "High",
              dueInDays: 3,
              description: "Lagos Tenancy Law 2011: statutory tenants need proper notices; periodic tenants follow tenancy cycle.",
            },
            {
              title: "Serve and file notices correctly before suing",
              priority: "High",
              dueInDays: 10,
            },
          ],
        },
      },
      "Appeal (Court of Appeal)": {
        stages: [
          "Judgment Review",
          "Notice of Appeal",
          "Record of Appeal",
          "Appellant's Brief",
          "Respondent's Brief",
          "Hearing",
          "Judgment",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Notice of Appeal",
            "Application for Extension (if out of time)",
            "Record of Appeal",
            "Appellant's Brief of Argument",
          ],
          tasks: [
            {
              title: "File Notice of Appeal within 3 months of judgment",
              priority: "High",
              dueInDays: 5,
              description: "Court of Appeal Rules — filing outside 3 months needs extension with good reasons.",
            },
            {
              title: "Order and certify records from lower court",
              priority: "Medium",
              dueInDays: 30,
            },
          ],
        },
      },
      "Enforcement of Judgment": {
        stages: [
          "Judgment Audit",
          "Enforcement Method Selection",
          "Application",
          "Execution",
          "Return",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Writ of Fifa",
            "Garnishee Proceedings (Nisi & Absolute)",
            "Judgment Debtor Summons",
            "Application for Charging Order",
          ],
          tasks: [
            {
              title: "Identify debtor's assets / bank for garnishee",
              priority: "High",
              dueInDays: 7,
            },
          ],
        },
      },
    },
    },
  ],
  documentCategories: [
    "Pleadings",
    "Motions & Applications",
    "Affidavits & Exhibits",
    "Written Addresses & Briefs",
    "Judgments & Rulings",
    "Evidence Bundles",
    "Processes & Substituted Service Orders",
  ],
  eventTypes: [
    { name: "Court Hearing", color: "red" },
    { name: "Case Management Conference", color: "orange" },
    { name: "Pre-Trial Conference", color: "orange" },
    { name: "Trial Date", color: "red" },
    { name: "Judgment Date", color: "red" },
    { name: "Service Deadline", color: "orange" },
  ],
  checklists: [
    {
      name: "Filing Readiness Checklist (State High Court)",
      items: [
        "Limitation period verified for the cause of action",
        "Pre-action letter / protocol steps completed where required",
        "Originating process settled and signed by counsel",
        "Affidavit in support sworn where needed (e.g. Undefended List)",
        "Filing fees assessed and paid",
        "Proof of service prepared for personal or substituted service",
        "Pre-trial memorandum drafted for CMC",
        "Client informed of costs exposure and timeline",
      ],
      relevantMatterTypes: [
        "Civil Litigation",
      ],
    },
    {
      name: "Enforcement of Judgment Checklist",
      items: [
        "Certified true copy of judgment obtained",
        "Judgment debtor's assets identified (bank, property, salary)",
        "Six-year validity window for execution confirmed",
        "Enforcement method selected (Fifa, garnishee, JDS, charging order)",
        "Application filed and served on judgment debtor",
        "Third parties (banks/employers) notified after order",
        "Execution returns filed at court registry",
      ],
      relevantMatterTypes: [
        "Civil Litigation",
      ],
    },
  ],
  automations: [
    "Toast + task when a matter has no event logged for 30 days (dormant-file alarm)",
    "Task 14 days before every 'Judgment Date' and 'Trial Date' event",
    "Weekly digest of matters approaching limitation-sensitive age",
  ],
};

// Corporate & Commercial

const corporate: PracticeProfile = {
  key: "Corporate & Commercial",
  label: "Corporate & Commercial",
  description: "Company secretarial work, transactions and commercial contracts under CAMA 2020 — incorporation to wind-down.",
  contactTypes: [
    "Company Secretary",
    "Director / Signatory",
    "Shareholder",
    "CAC Accredited Agent",
    "Regulator (CAC)",
    "Auditor / Accountant",
    "Counterparty Counsel",
    "Notary Public",
  ],
  workflows: [
    {
      type: "Corporate & Commercial",
      default: {
        stages: [
          "Scoping & Engagement",
          "Documents Drafting",
          "Execution",
          "Filing / Completion",
          "Post-Completion",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Letter of Engagement",
            "Board Resolution",
            "CAMA Compliance Search",
          ],
          tasks: [
            {
              title: "Run CAC preliminary search on counterparty",
              priority: "Medium",
              dueInDays: 3,
            },
          ],
        },
      },
      subCategories: {
      "Company Incorporation (CAC)": {
        stages: [
          "Name Reservation",
          "Document Preparation",
          "Execution by Subscribers",
          "CAC Upload & Queries",
          "Certificate Issuance",
          "Post-Incorporation (TIN, Bank)",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Name Availability Search",
            "Memorandum & Articles of Association",
            "Statement of Compliance (Form CAC 4)",
            "Particulars of First Directors",
          ],
          tasks: [
            {
              title: "Reserve proposed name at CAC",
              priority: "High",
              dueInDays: 2,
            },
            {
              title: "Collect KYC documents for all directors & shareholders",
              priority: "High",
              dueInDays: 5,
            },
            {
              title: "File incorporation documents and respond to CAC queries",
              priority: "High",
              dueInDays: 10,
            },
            {
              title: "Obtain TIN and open corporate bank account",
              priority: "Medium",
              dueInDays: 30,
            },
          ],
        },
      },
      "Share Purchase / Business Transfer": {
        stages: [
          "Term Sheet & NDA",
          "Due Diligence",
          "SPA Drafting & Negotiation",
          "Conditions Precedent",
          "Completion & Handover",
          "Post-Completion",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Non-Disclosure Agreement",
            "Non-Binding Term Sheet",
            "Share Purchase Agreement",
            "Board & Shareholder Approvals",
            "CAC Share Transfer Filing",
          ],
          tasks: [
            {
              title: "Order CAC certified records of target company",
              priority: "High",
              dueInDays: 3,
            },
            {
              title: "Issue due diligence questionnaires (corporate, tax, HR, litigation)",
              priority: "High",
              dueInDays: 7,
            },
            {
              title: "Verify share encumbrances and loans at CAC & banks",
              priority: "High",
              dueInDays: 14,
            },
            {
              title: "Prepare completion agenda and funds-flow",
              priority: "Medium",
              dueInDays: 21,
            },
          ],
        },
      },
      "Commercial Contract": {
        stages: [
          "Instructions & Background",
          "First Draft",
          "Negotiation Rounds",
          "Approval & Execution",
          "Exchange & Safekeeping",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Draft Agreement",
            "Redline Responses",
            "Execution Copy / Signature Page",
          ],
          tasks: [
            {
              title: "Confirm parties' authority to contract (board resolutions if company)",
              priority: "Medium",
              dueInDays: 3,
            },
            {
              title: "Stamp and date-stamp executed contract where necessary",
              priority: "Low",
              dueInDays: 14,
            },
          ],
        },
      },
      "Annual Returns & Secretarial Compliance": {
        stages: [
          "Audit Review",
          "Resolutions & Minutes",
          "File Annual Returns at CAC",
          "Reminders for Next Cycle",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Annual Returns Form",
            "Audited Financial Statement",
            "Board Resolution Approving Accounts",
          ],
          tasks: [
            {
              title: "Review audited accounts against CAC requirements",
              priority: "Medium",
              dueInDays: 7,
            },
            {
              title: "File annual returns (penalty accrues after deadline)",
              priority: "High",
              dueInDays: 14,
            },
          ],
        },
      },
      "Corporate Restructuring / Share Capital": {
        stages: [
          "Board & Shareholder Approvals",
          "Documentation",
          "Filing at CAC",
          "Implementation",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Special / Ordinary Resolutions",
            "Share Capital Increase Forms",
            "Amended Memorandum & Articles",
          ],
          tasks: [
            {
              title: "Draft resolutions meeting CAMA 2020 thresholds",
              priority: "High",
              dueInDays: 7,
            },
            {
              title: "File amended constitution and capital forms at CAC",
              priority: "High",
              dueInDays: 21,
            },
          ],
        },
      },
    },
    },
  ],
  documentCategories: [
    "Corporate Resolutions & Minutes",
    "Regulatory Filings",
    "Transaction Agreements",
    "Due Diligence Reports",
    "Certificates & Licences",
    "Secretarial Registers",
  ],
  eventTypes: [
    { name: "Board Meeting", color: "blue" },
    { name: "Completion Meeting", color: "green" },
    { name: "Regulatory Filing Deadline", color: "red" },
    { name: "Client Signing Appointment", color: "blue" },
  ],
  checklists: [
    {
      name: "CAC Incorporation Filing Checklist",
      items: [
        "Name reserved and availability code obtained",
        "Memorandum & Articles tailored to objects of company",
        "Identity documents collected for every director and subscriber",
        "Statement of compliance by legal practitioner prepared",
        "Prescribed fee schedule matched to share capital",
        "Forms CAC 1.1 / 4 / particulars of first directors completed",
        "Stamp duty on documents where applicable",
        "Upload on CAC portal and track queries daily",
        "Certificate of incorporation collected & certified copies ordered",
        "TIN obtained and corporate bank account opened",
      ],
      relevantMatterTypes: [
        "Corporate & Commercial",
      ],
    },
    {
      name: "Share Purchase Due Diligence Checklist",
      items: [
        "CAC searches: status, charges, annual returns, shareholdings",
        "Litigation search at High Court and Federal High Court registries",
        "Tax status: FIRS TCC, state taxes, pending assessments",
        "Employment: contracts, pension (PenCom), NSITF compliance",
        "Asset & title searches for real property owned",
        "IP: trademark and patent registry checks",
        "Material contracts and change-of-control clauses reviewed",
        "Board/shareholder approvals for the transaction obtained",
        "Regulatory consents identified (sector-specific)",
      ],
      relevantMatterTypes: [
        "Corporate & Commercial",
      ],
    },
  ],
  automations: [
    "Annual-returns reminder per client company, 60 and 30 days before deadline",
    "Task on new secretarial matter to order fresh CAC searches",
  ],
};

// Real Estate & Property

const realEstate: PracticeProfile = {
  key: "Real Estate & Property",
  label: "Real Estate & Property",
  description: "Conveyancing, title perfection and land disputes under the Land Use Act — searches, consents, registration.",
  contactTypes: [
    "Landlord",
    "Tenant / Lessee",
    "Estate Agent",
    "Registered Surveyor",
    "Estate Surveyor & Valuer",
    "Mortgagee Bank",
    "Lands Bureau Officer",
    "Solicitor to the Other Party",
    "Property Developer",
    "Community / Family Head",
  ],
  workflows: [
    {
      type: "Real Estate",
      default: {
        stages: [
          "Instruction & Search",
          "Contract Documentation",
          "Stamping & Consent",
          "Registration",
          "Post-Completion",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Letter of Engagement",
            "Title Search Report",
            "Deed of Assignment",
          ],
          tasks: [
            {
              title: "Conduct title search at Lands Registry",
              priority: "High",
              dueInDays: 5,
            },
          ],
        },
      },
      subCategories: {
      "Property Acquisition (Conveyancing)": {
        stages: [
          "Instruction & Fees",
          "Title Search & Due Diligence",
          "Contract of Sale",
          "Execution of Deed of Assignment",
          "Stamp Duty Assessment & Payment",
          "Governor's Consent Application",
          "Registration",
          "Handover & Post-Completion",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Contract of Sale",
            "Deed of Assignment",
            "Survey Plan (Charted)",
            "Form 1C (Consent Application)",
            "Search Report",
          ],
          tasks: [
            {
              title: "Search title at Lands Registry on root of title",
              priority: "High",
              dueInDays: 5,
            },
            {
              title: "Chart survey plan at Surveyor General's office",
              priority: "High",
              dueInDays: 7,
              description: "Confirms the land is not inside government-acquired schemes; verify gazette/excision where applicable.",
            },
            {
              title: "Confirm vendor's capacity and identity (family / company / individual)",
              priority: "High",
              dueInDays: 7,
            },
            {
              title: "Prepare and execute Deed of Assignment",
              priority: "High",
              dueInDays: 21,
            },
            {
              title: "Pay stamp duties and file Governor's Consent application",
              priority: "High",
              dueInDays: 35,
            },
          ],
        },
      },
      "Title Perfection (Governor's Consent)": {
        stages: [
          "Document Review",
          "Stamp Duty Payment",
          "Form 1C Application",
          "Assessment & Charting",
          "Consent Grant",
          "Registration",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Form 1C",
            "Registered Instrument (Deed)",
            "Receipt of Stamp Duty Payment",
          ],
          tasks: [
            {
              title: "Compute and pay stamp duty (consent fee follows assessment)",
              priority: "High",
              dueInDays: 30,
            },
            {
              title: "Submit Form 1C with charted survey and executed deed",
              priority: "High",
              dueInDays: 40,
            },
            {
              title: "Follow up at Lands Bureau until consent letter issues",
              priority: "Medium",
              dueInDays: 90,
            },
          ],
        },
      },
      "Title Search & Due Diligence (Opinion)": {
        stages: [
          "Instruction",
          "Registry Searches",
          "Litigation & Encumbrance Search",
          "Charting",
          "Written Opinion",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Search Report",
            "Litigation Search Results",
            "Legal Opinion on Title",
          ],
          tasks: [
            {
              title: "Search root of title for 30 years where practicable",
              priority: "High",
              dueInDays: 5,
            },
            {
              title: "Search for pending suits at the High Court registry",
              priority: "High",
              dueInDays: 7,
            },
          ],
        },
      },
      "Tenancy / Lease Agreement": {
        stages: [
          "Terms Instructions",
          "Draft Agreement",
          "Negotiation",
          "Execution & Stamping",
          "Tenant Onboarding",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Tenancy Agreement",
            "Inventory & Schedule of Condition",
            "Caution Fee / Deposit Receipt",
          ],
          tasks: [
            {
              title: "Check rent advance compliance with applicable state tenancy law",
              priority: "Medium",
              dueInDays: 3,
              description: "E.g. Lagos Tenancy Law 2011 restricts advance rent for new tenants.",
            },
            {
              title: "Execute, stamp and exchange tenancy agreement",
              priority: "High",
              dueInDays: 14,
            },
          ],
        },
      },
      "Recovery of Premises (Eviction)": {
        stages: [
          "Tenancy Review",
          "Statutory Notices",
          "Court Proceedings",
          "Judgment & Possession",
          "Enforcement (Warrant)",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Notice to Quit",
            "7-Day Notice of Intention",
            "Claim for Recovery of Possession",
          ],
          tasks: [
            {
              title: "Determine tenancy type and correct notice length",
              priority: "High",
              dueInDays: 2,
            },
            {
              title: "Serve statutory notices through court bailiff or affidavit",
              priority: "High",
              dueInDays: 10,
            },
          ],
        },
      },
      "Mortgage & Security Documentation": {
        stages: [
          "Instructions from Bank / Borrower",
          "Title Verification",
          "Draft Legal Mortgage",
          "Execution & Stamping",
          "Consent (where required)",
          "Registration",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Legal Mortgage",
            "Deed of Sub-Lease (as security)",
            "Bank's Conditions Offer Letter",
          ],
          tasks: [
            {
              title: "Verify borrower's title and existing encumbrances",
              priority: "High",
              dueInDays: 5,
            },
          ],
        },
      },
      "Under Litigation (Land Dispute)": {
        stages: [
          "Dispute Assessment & Counsel's Opinion",
          "Pleadings (Writ / Statement of Claim)",
          "Interlocutory Applications (Injunction)",
          "Discovery & Witness Statements",
          "Trial at High Court / Customary Court",
          "Judgment",
          "Post-Judgment (Execution / Appeal)",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Writ of Summons",
            "Statement of Claim",
            "Originating Summons (title declaration)",
            "Witness Statement on Oath",
            "Pre-Trial Memorandum",
          ],
          tasks: [
            {
              title: "Conduct litigation search on the property at the High Court registry",
              priority: "High",
              dueInDays: 3,
              description: "Confirm no pending suit over the land before advising on purchase or title.",
            },
            {
              title: "Advise client on lis pendens risk (pending litigation voids conveyance)",
              priority: "High",
              dueInDays: 3,
            },
            {
              title: "Consider interim / interlocutory injunction to preserve the property",
              priority: "High",
              dueInDays: 10,
            },
          ],
        },
      },
    },
    },
  ],
  documentCategories: [
    "Deeds & Conveyances",
    "Title Documents (C of O, Gazette, Deeds)",
    "Search & Charting Reports",
    "Consents & Permits",
    "Leases & Tenancy Papers",
    "Rent Receipts & Demand Letters",
    "Mortgages & Security Documents",
  ],
  eventTypes: [
    { name: "Site Inspection", color: "green" },
    { name: "Search Collection Day", color: "orange" },
    { name: "Consent Follow-Up (Lands Bureau)", color: "orange" },
    { name: "Completion / Handover", color: "green" },
  ],
  checklists: [
    {
      name: "Property Purchase Due Diligence Checklist",
      items: [
        "Search at Lands Registry on the root of title (30-year chain where possible)",
        "Chart survey plan at Surveyor General's office",
        "Confirm land is free of government acquisition (gazette / excision verified)",
        "Confirm vendor identity and capacity (individual, family, company or receiver)",
        "Family / communal land: consent of family head and principal members documented",
        "Litigation search at High Court registry for disputes over the land",
        "Confirm payment of ground rent and Land Use Charge up to date",
        "Inspect property physically for encroachments and third-party occupation",
        "Confirm no existing mortgage or lien (search registered charges)",
        "Obtain original title documents and receipts before payment",
        "Draft contract of sale before part payment",
        "Execute Deed of Assignment; stamp and apply for Governor's Consent",
      ],
      relevantMatterTypes: [
        "Real Estate",
      ],
    },
    {
      name: "Governor's Consent Application Checklist",
      items: [
        "Executed registrable instrument (Deed of Assignment / Mortgage / Sub-lease)",
        "Form 1C completed and signed",
        "Charted survey plan attached (Surveyor General)",
        "Evidence of stamp duty payment",
        "Consent fee and registration fees assessed and paid",
        "Prior consent(s) in the chain of title obtained",
        "Cover letter to Honourable Commissioner / Lands Bureau",
        "Follow-up schedule set (assessment, charting, approval)",
      ],
      relevantMatterTypes: [
        "Real Estate",
      ],
    },
  ],
  automations: [
    "Renewal reminder at 12 months for every tenancy agreement drafted",
    "Task at 6-month intervals to follow up pending consent applications",
    "Rent-day reminder to client landlords on the 1st of each cycle",
  ],
};

// Family Law & Probate

const family: PracticeProfile = {
  key: "Family Law & Probate",
  label: "Family Law & Probate",
  description: "Matrimonial causes, custody and estate administration under the Matrimonial Causes Act and probate practice.",
  contactTypes: [
    "Adverse Party (Matrimonial)",
    "Probate Registrar",
    "Administrator / Executor",
    "Beneficiary / Next of Kin",
    "Welfare Officer",
    "Guardian ad Litem",
    "Family Representative",
  ],
  workflows: [
    {
      type: "Family Law",
      default: {
        stages: [
          "Conflicts Check & Instruction",
          "Documentation",
          "Filing / Applications",
          "Hearing(s)",
          "Order / Grant",
          "Administration",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Letter of Engagement",
            "Client Intake Form (Matrimonial)",
          ],
          tasks: [
            {
              title: "Run conflicts check on adverse party",
              priority: "High",
              dueInDays: 1,
            },
          ],
        },
      },
      subCategories: {
      "Divorce / Matrimonial Causes": {
        stages: [
          "Marriage & Grounds Review",
          "Petition Drafting",
          "Filing & Service",
          "Answer / Cross-Petition",
          "Trial",
          "Decree Nisi",
          "Decree Absolute",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Petition for Dissolution",
            "Affidavit in Support",
            "Marriage Certificate Extract",
            "Answer to Petition",
          ],
          tasks: [
            {
              title: "Assemble marriage certificate and domicile evidence",
              priority: "High",
              dueInDays: 5,
            },
            {
              title: "Settle petition with particularised grounds (MCA 1970)",
              priority: "High",
              dueInDays: 14,
            },
          ],
        },
      },
      "Custody & Maintenance": {
        stages: [
          "Instructions & Welfare Review",
          "Application Drafting",
          "Filing & Service",
          "Welfare Report",
          "Hearing",
          "Custody / Maintenance Order",
          "Review & Variation",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Application for Custody",
            "Affidavit of Means (Maintenance)",
            "Welfare Report Request",
          ],
          tasks: [
            {
              title: "Request welfare report from Ministry / probation office",
              priority: "Medium",
              dueInDays: 10,
            },
          ],
        },
      },
      "Letters of Administration": {
        stages: [
          "Death & Estate Particulars",
          "Next of Kin Documentation",
          "Estate Inventory & Valuation",
          "Bond & Sureties",
          "Oath of Administration",
          "Publication",
          "Grant Issued",
          "Estate Administration",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Application for Letters of Administration",
            "Death Certificate",
            "Estate Inventory & Valuation",
            "Administration Bond",
            "Bank / Asset Confirmation Letters",
          ],
          tasks: [
            {
              title: "Collect death certificate and asset schedules (banks, land, shares)",
              priority: "High",
              dueInDays: 7,
            },
            {
              title: "Compile list of persons entitled to share in the estate",
              priority: "High",
              dueInDays: 14,
            },
            {
              title: "Arrange bond and sureties for the grant",
              priority: "Medium",
              dueInDays: 21,
            },
          ],
        },
      },
      "Probate (Will & Estate Administration)": {
        stages: [
          "Will Custody & Review",
          "Application for Probate",
          "Oath of Executor",
          "Grant of Probate",
          "Estate Administration",
          "Distribution",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Original Will",
            "Application for Grant of Probate",
            "Oath of Executors",
            "Estate Accounts",
          ],
          tasks: [
            {
              title: "Read will and brief executors on duties",
              priority: "High",
              dueInDays: 3,
            },
            {
              title: "Prepare estate accounts and distribution schedule",
              priority: "Medium",
              dueInDays: 60,
            },
          ],
        },
      },
    },
    },
  ],
  documentCategories: [
    "Petitions & Court Forms",
    "Marriage & Birth Documents",
    "Wills & Codicils",
    "Grants (Probate / Letters of Administration)",
    "Estate Accounts & Distribution Schedules",
    "Court Orders (Custody / Maintenance)",
  ],
  eventTypes: [
    { name: "Court Hearing (Family)", color: "red" },
    { name: "Welfare Interview", color: "blue" },
    { name: "Probate Registry Appointment", color: "orange" },
    { name: "Estate Distribution Meeting", color: "green" },
  ],
  checklists: [
    {
      name: "Letters of Administration Requirements",
      items: [
        "Certified death certificate obtained",
        "Estate inventory with valuations prepared",
        "Bank confirmation letters for deceased's accounts",
        "Names, addresses and consent of next of kin documented",
        "Administration bond with two sureties arranged",
        "Oath of administration sworn before registrar",
        "Publication/notice where required by registry",
        "Grant collected and certified copies ordered",
        "Assets transmission letters dispatched after grant",
      ],
      relevantMatterTypes: [
        "Family Law",
      ],
    },
    {
      name: "Matrimonial Petition Filing Checklist",
      items: [
        "Marriage certificate (certified copy)",
        "Domicile / habitual residence evidence",
        "Grounds and particulars drafted per Matrimonial Causes Act",
        "Reliefs (dissolution, custody, maintenance, settlement) particularised",
        "Conflicts check on adverse party and counsel",
        "Petition settled with client before filing",
        "Filing fee paid at High Court registry",
        "Personal service arranged; substituted service if evasive",
      ],
      relevantMatterTypes: [
        "Family Law",
      ],
    },
  ],
  automations: [
    "Review reminder before decree nisi (3 months) becomes decree absolute window",
    "Annual estate-account reminder on active administration matters",
  ],
};

// Criminal Defence

const criminal: PracticeProfile = {
  key: "Criminal Defence",
  label: "Criminal Defence",
  description: "Police station representation, bail, trial defence and appeals across Magistrate and High Courts.",
  contactTypes: [
    "Client (Accused)",
    "Investigating Police Officer (IPO)",
    "Prosecution Counsel (DPP / Police)",
    "Surety",
    "Court Registrar",
    "Correctional Service Officer",
    "Client's Family Contact",
  ],
  workflows: [
    {
      type: "Criminal Defense",
      default: {
        stages: [
          "Instruction",
          "Case Review",
          "Bail / Arraignment",
          "Trial",
          "Judgment",
          "Sentence / Appeal Window",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Letter of Engagement",
            "Police Station Statement Review",
          ],
          tasks: [
            {
              title: "Obtain charge sheet and case diary from IPO",
              priority: "High",
              dueInDays: 1,
            },
          ],
        },
      },
      subCategories: {
      "Bail Application": {
        stages: [
          "Arrest & Instruction",
          "Charge Review",
          "Bail Application Drafting",
          "Filing & Hearing",
          "Surety Verification",
          "Release",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Application for Bail",
            "Affidavit of Means",
            "Affidavit in Support of Sureties",
          ],
          tasks: [
            {
              title: "Verify offence is bailable and gather sureties' documents",
              priority: "High",
              dueInDays: 2,
            },
            {
              title: "File bail application with court registry",
              priority: "High",
              dueInDays: 3,
            },
          ],
        },
      },
      "Trial Defence": {
        stages: [
          "Disclosure Review",
          "Witness Statements Analysis",
          "Defence Strategy",
          "PW Testimonies & Cross-Examination",
          "Defence Case (No-Case / DW)",
          "Final Written Address",
          "Judgment",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Extra-Cautious Statement on Oath",
            "Final Written Address",
            "No-Case Submission (where applicable)",
          ],
          tasks: [
            {
              title: "Demand proof of evidence and witness statements from prosecution",
              priority: "High",
              dueInDays: 7,
            },
            {
              title: "Prepare cross-examination plan for prosecution witnesses",
              priority: "High",
              dueInDays: 14,
            },
          ],
        },
      },
      "Fundamental Rights Enforcement": {
        stages: [
          "Detention Review",
          "Application (FHC / High Court)",
          "Hearing",
          "Order & Compliance",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Fundamental Rights Enforcement Application",
            "Supporting Affidavit",
            "Written Address",
          ],
          tasks: [
            {
              title: "File within detention window (FHC FREP Rules 2009)",
              priority: "High",
              dueInDays: 2,
            },
          ],
        },
      },
    },
    },
  ],
  documentCategories: [
    "Charge Sheets & Case File",
    "Bail Applications & Affidavits",
    "Witness Statements",
    "Submissions & Written Addresses",
    "Judgments & Rulings",
    "Appeal Documents",
  ],
  eventTypes: [
    { name: "Court Hearing (Criminal)", color: "red" },
    { name: "Bail Verification", color: "orange" },
    { name: "Police Station Visit", color: "blue" },
    { name: "Prison / Correctional Visit", color: "yellow" },
  ],
  checklists: [
    {
      name: "Bail Application Checklist",
      items: [
        "Charge sheet reviewed against criminal statutes",
        "Offence confirmed bailable at Magistrate / High Court level",
        "Accused's statement to police reviewed",
        "Sureties identified with means affidavits and ID",
        "Bail application and supporting affidavits drafted",
        "Prosecution counsel notified of application",
        "Verification documents packaged for court",
        "Family briefed on conditions and likely terms",
      ],
      relevantMatterTypes: [
        "Criminal Defense",
      ],
    },
  ],
  automations: [
    "Adjourned-date task 48 hours before every criminal hearing",
    "Detention-days counter on FREP matters",
  ],
};

// Employment & Labour

const employment: PracticeProfile = {
  key: "Employment & Labour",
  label: "Employment & Labour",
  description: "Employment disputes and advisory under the NICN's exclusive jurisdiction, including mandatory pre-trial settlement.",
  contactTypes: [
    "HR / People Manager",
    "Employee (Claimant)",
    "Employer (Respondent)",
    "Union Representative",
    "NICN Registrar",
    "Pension / NSITF Contact",
  ],
  workflows: [
    {
      type: "Employment & Labor",
      default: {
        stages: [
          "Instruction & Contract Review",
          "Pre-Action Letter",
          "Filing at NICN",
          "Pre-Trial Settlement (Mandatory)",
          "Trial",
          "Judgment",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Letter of Demand",
            "Claim at NICN",
            "Statement of Facts",
          ],
          tasks: [
            {
              title: "Review employment letter, handbook and policies",
              priority: "High",
              dueInDays: 3,
            },
          ],
        },
      },
      subCategories: {
      "Wrongful / Unfair Termination": {
        stages: [
          "Termination Letter Review",
          "Entitlements Computation",
          "Demand Letter",
          "Filing at NICN",
          "Pre-Trial Settlement Conference",
          "Trial",
          "Judgment",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Demand Letter for Entitlements",
            "NICN Claim Form & Statement of Facts",
            "Statement of Defence (Review)",
            "Pre-Trial Report",
          ],
          tasks: [
            {
              title: "Compute notice pay, arrears and outstanding entitlements",
              priority: "High",
              dueInDays: 5,
            },
            {
              title: "File at NICN and prepare for mandatory settlement conference",
              priority: "High",
              dueInDays: 21,
            },
          ],
        },
      },
      "Employment Contract & Policy Drafting": {
        stages: [
          "Business Review",
          "Contract Drafting",
          "Policies & Handbook",
          "Client Review",
          "Rollout",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Employment Contract",
            "Employee Handbook",
            "Disciplinary & Grievance Policy",
          ],
        },
      },
      "Workplace Investigation / Disciplinary": {
        stages: [
          "Terms of Reference",
          "Interviews & Evidence",
          "Report & Findings",
          "Disciplinary Process Support",
          "Resolution",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Investigation Terms of Reference",
            "Interview Notes",
            "Investigation Report",
          ],
        },
      },
    },
    },
  ],
  documentCategories: [
    "Employment Contracts & Handbooks",
    "NICN Pleadings & Reports",
    "Investigation Reports",
    "Settlement Agreements",
    "Pension & Benefits Records",
  ],
  eventTypes: [
    { name: "NICN Hearing", color: "red" },
    { name: "Settlement Conference", color: "orange" },
    { name: "Workplace Interview", color: "blue" },
  ],
  checklists: [
    {
      name: "Termination Due Process Checklist",
      items: [
        "Employment contract termination clause reviewed",
        "Notice period and pay in lieu computed",
        "Disciplinary procedure followed (hearing, right to respond)",
        "Outstanding salary, leave and bonus computed",
        "Pension contributions up to date (PenCom remittance)",
        "Group life & NSITF compliance confirmed",
        "Return of company property scheduled",
        "Settlement / release agreement considered",
      ],
      relevantMatterTypes: [
        "Employment & Labor",
      ],
    },
  ],
  automations: [
    "Task on every NICN matter 7 days before pre-trial settlement conference",
  ],
};

// Banking & Finance

const banking: PracticeProfile = {
  key: "Banking & Finance",
  label: "Banking & Finance",
  description: "Facility documentation, security perfection and institutional debt recovery for lenders and borrowers.",
  contactTypes: [
    "Credit / Relationship Officer",
    "Bank Legal Department",
    "Borrower / Guarantor",
    "Receiver / Manager",
    "Regulator (CBN)",
  ],
  workflows: [
    {
      type: "Corporate & Commercial",
      default: {
        stages: [
          "Instruction",
          "Documentation",
          "Execution & Stamping",
          "Perfection / Registration",
          "Monitoring & Covenants",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Letter of Engagement",
            "Facility Offer Review",
          ],
        },
      },
      subCategories: {
      "Loan Documentation & Security Perfection": {
        stages: [
          "Offer Letter Review",
          "Security Documentation",
          "Execution",
          "Stamping",
          "Governor's Consent / CAC Registration",
          "Insurance & Covenants Check",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Facility Agreement",
            "Legal Mortgage / Debenture",
            "Guarantee & Indemnity",
            "CAC Registration of Charges",
          ],
          tasks: [
            {
              title: "Draft or review security documents against facility offer",
              priority: "High",
              dueInDays: 7,
            },
            {
              title: "Register charges at CAC within 90 days of creation",
              priority: "High",
              dueInDays: 60,
              description: "CAMA 2020: unregistered charges are void against liquidator.",
            },
          ],
        },
      },
      "Institutional Debt Recovery": {
        stages: [
          "Exposure Review",
          "Pre-Action Demand",
          "Undefended List / Suit",
          "Garnishee",
          "Recovery & Settlement",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Letter of Demand",
            "Writ on Undefended List",
            "Garnishee Nisi / Absolute",
          ],
          tasks: [
            {
              title: "Assemble statement of account and collateral file",
              priority: "High",
              dueInDays: 5,
            },
          ],
        },
      },
      "Security Enforcement (Foreclosure / Receivership)": {
        stages: [
          "Default Assessment",
          "Demand & Cure Period",
          "Appointment of Receiver",
          "Enforcement / Sale",
          "Accounting to Borrower",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Notice of Default",
            "Deed of Appointment of Receiver",
            "Power of Sale Notice",
          ],
        },
      },
    },
    },
  ],
  documentCategories: [
    "Facility & Security Documents",
    "Demand Letters & Default Notices",
    "CAC Registrations & Searches",
    "Receivership Papers",
    "Garnishee Orders",
  ],
  eventTypes: [
    { name: "Facility Review Meeting", color: "blue" },
    { name: "Default Notice Deadline", color: "red" },
    { name: "Charge Registration Deadline", color: "orange" },
  ],
  checklists: [
    {
      name: "Security Perfection Checklist",
      items: [
        "Title to collateral verified at Lands Registry / CAC",
        "Facility and security documents stamped",
        "Governor's Consent obtained for mortgages of land",
        "Company charges registered at CAC (90-day window)",
        "Insurance assigned to lender with bank noted as loss payee",
        "Personal guarantees executed by principals",
        "Event of default triggers mirrored across documents",
      ],
      relevantMatterTypes: [
        "Corporate & Commercial",
      ],
    },
  ],
  automations: [
    "Task 30 days before the 90-day CAC charge registration deadline",
  ],
};

// Intellectual Property

const ip: PracticeProfile = {
  key: "Intellectual Property",
  label: "Intellectual Property",
  description: "Trademarks, patents and copyright registration and enforcement through the Abuja registries and the NCC.",
  contactTypes: [
    "Trademark Agent (Accredited)",
    "Registrar of Trademarks / Patents",
    "Nigerian Copyright Commission Contact",
    "Licensee / Assignor",
    "Infringer / Counterparty",
    "Brand Investigator",
  ],
  workflows: [
    {
      type: "Intellectual Property",
      default: {
        stages: [
          "Instruction & Clearance Search",
          "Application",
          "Prosecution",
          "Registration / Grant",
          "Maintenance",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Instruction Letter",
            "Preliminary Search Report",
          ],
        },
      },
      subCategories: {
      "Trademark Registration": {
        stages: [
          "Clearance Search",
          "Application Filed (TM1)",
          "Examination",
          "Acceptance & Publication",
          "Opposition Window",
          "Certification",
          "Renewal Cycle",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Preliminary Search",
            "TM1 Application",
            "Authorisation of Agent",
            "Publication in Trademarks Journal",
            "Certificate of Registration",
          ],
          tasks: [
            {
              title: "Conduct clearance search at Trademarks Registry",
              priority: "High",
              dueInDays: 5,
            },
            {
              title: "File TM1 with correct Nice classification",
              priority: "High",
              dueInDays: 10,
            },
            {
              title: "Diarise opposition window after journal publication",
              priority: "Medium",
              dueInDays: 75,
            },
          ],
        },
      },
      "Patent Registration": {
        stages: [
          "Novelty Search",
          "Specification Drafting",
          "Application",
          "Examination",
          "Grant",
          "Annual Renewal",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Patent Application Form",
            "Specification & Claims",
            "Power of Attorney / Authorization",
          ],
        },
      },
      "Copyright (NCC) Registration": {
        stages: [
          "Work Documentation",
          "Notification to NCC",
          "Issuance of Certificate",
          "Monitoring",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Notification of Copyright Work",
            "Assignment / Licence Agreement",
          ],
        },
      },
      "IP Infringement / Enforcement": {
        stages: [
          "Evidence Gathering",
          "Cease & Desist",
          "Negotiation / Licence",
          "Filing (FHC)",
          "Trial / Settlement",
          "Judgment",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Cease and Desist Letter",
            "Letter Before Action",
            "Statement of Claim (FHC)",
          ],
          tasks: [
            {
              title: "Secure notarised evidence of infringing use (market sweeps, screenshots)",
              priority: "High",
              dueInDays: 7,
            },
          ],
        },
      },
    },
    },
  ],
  documentCategories: [
    "IP Filings & Prosecution",
    "Certificates & Renewals",
    "Licences & Assignments",
    "Cease & Desist Letters",
    "Evidence of Use",
  ],
  eventTypes: [
    { name: "Registry Appointment (Abuja)", color: "orange" },
    { name: "Publication / Opposition Deadline", color: "red" },
    { name: "Renewal Deadline", color: "orange" },
  ],
  checklists: [
    {
      name: "Trademark Prosecution Checklist",
      items: [
        "Clearance search completed at Trademarks Registry, Abuja",
        "Correct class(es) selected under the Nice Classification",
        "TM1 application and authorisation of agent prepared",
        "Applicant's details and address for service in Nigeria confirmed",
        "Filing fees paid and official receipts kept",
        "Examination report queries answered promptly",
        "Acceptance letter received; publication in Trademarks Journal",
        "Opposition window diarised (statutory period)",
        "Certificate of registration collected",
        "Renewal cycle set (6 years then annual schedule)",
      ],
      relevantMatterTypes: [
        "Intellectual Property",
      ],
    },
  ],
  automations: [
    "Renewal reminders for registered marks at 5.5 and 6 years",
    "Opposition-window countdown task after publication",
  ],
};

// Tax Law

const tax: PracticeProfile = {
  key: "Tax Law",
  label: "Tax Law",
  description: "FIRS and state tax audits, objections and appeals before the Tax Appeal Tribunal and the Federal High Court.",
  contactTypes: [
    "FIRS Officer (Assessment)",
    "State IRS Officer",
    "TAT Registrar",
    "Tax Consultant / Accountant",
    "Client Finance Lead",
  ],
  workflows: [
    {
      type: "Tax Law",
      default: {
        stages: [
          "Instruction & Records",
          "Assessment Review",
          "Objection / Position",
          "Negotiation",
          "Appeal (if unresolved)",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Letter of Engagement",
            "Records Request Schedule",
          ],
        },
      },
      subCategories: {
      "FIRS Desk Audit": {
        stages: [
          "Pre-Audit Review",
          "Information Request",
          "Draft Audit Report",
          "Reconciliation",
          "Final Assessment",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Notice of Objection",
            "TCC Application",
          ],
          tasks: [
            {
              title: "Collate client receipts, books and prior TCCs",
              priority: "Medium",
              dueInDays: 7,
            },
            {
              title: "Draft Notice of Objection to draft assessment",
              priority: "High",
              dueInDays: 25,
              description: "Must be filed within 30 days of FIRS assessment notification.",
            },
          ],
        },
      },
      "Tax Appeal (TAT)": {
        stages: [
          "Prepare Notice of Appeal",
          "Filing at TAT",
          "Reply to Authority's Response",
          "Hearing",
          "Judgment",
          "Escalation to FHC (30-day window)",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Notice of Appeal",
            "Witness Statement on Oath",
            "Reply to FIRS Response",
          ],
          tasks: [
            {
              title: "File Notice of Appeal at TAT within 30 days of decision",
              priority: "High",
              dueInDays: 28,
            },
            {
              title: "Draft appellant's brief and evidence schedule",
              priority: "High",
              dueInDays: 45,
            },
          ],
        },
      },
      "State Tax Advisory (e.g. LIRS)": {
        stages: [
          "Compliance Review",
          "Voluntary Disclosure / Regularisation",
          "Audit Defence",
          "Settlement",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Compliance Review Report",
            "Voluntary Disclosure Letter",
          ],
        },
      },
    },
    },
  ],
  documentCategories: [
    "Tax Assessments & Notices",
    "Objections & Appeals",
    "Books & Records Schedules",
    "TCCs & Clearance",
    "TAT Filings",
  ],
  eventTypes: [
    { name: "FIRS Meeting", color: "blue" },
    { name: "TAT Hearing", color: "red" },
    { name: "Objection Deadline", color: "orange" },
  ],
  checklists: [
    {
      name: "Tax Objection Checklist (30-day window)",
      items: [
        "Assessment notice received and date-stamped",
        "Objection deadline computed (30 days from service)",
        "Grounds of objection drafted with supporting computations",
        "Relevant records assembled (books, returns, receipts)",
        "Objection filed within the statutory window",
        "FIRS reply monitored and reconciliation meeting sought",
        "Next step decided (TAT appeal if unresolved)",
      ],
      relevantMatterTypes: [
        "Tax Law",
      ],
    },
  ],
  automations: [
    "Hard deadline task on every new assessment within 48 hours of intake",
  ],
};

// Oil & Gas

const oilGas: PracticeProfile = {
  key: "Oil & Gas",
  label: "Oil & Gas",
  description: "Upstream and midstream practice under the PIA 2021 — licensing, farm-outs, local content and host communities.",
  contactTypes: [
    "NUPRC Officer",
    "NMDPRA Officer",
    "NCDMB (Local Content) Contact",
    "NNPC / Partner Company Legal",
    "Operator's Contract Manager",
    "Community Liaison (Host Communities)",
  ],
  workflows: [
    {
      type: "Oil & Gas",
      default: {
        stages: [
          "Instruction",
          "Regulatory Engagement",
          "Documentation",
          "Consent / Approval",
          "Post-Approval Compliance",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Letter of Engagement",
            "Regulatory Roadmap",
          ],
        },
      },
      subCategories: {
      "License Renewal (PIA)": {
        stages: [
          "Audit & Compliance",
          "NUPRC Application",
          "Technical Presentation",
          "Approval / Issuance",
          "Closed",
        ],
        suggestions: {
          processes: [
            "NUPRC Application Form",
            "Relinquishment Notice",
          ],
          tasks: [
            {
              title: "Review PIA compliance obligations",
              priority: "Medium",
              dueInDays: 10,
            },
            {
              title: "Submit relinquishment plan",
              priority: "High",
              dueInDays: 30,
            },
          ],
        },
      },
      "Farm-in / Farm-out": {
        stages: [
          "Term Sheet",
          "Due Diligence",
          "JOA Negotiation",
          "Ministerial Consent",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Deed of Assignment",
            "Joint Operating Agreement (JOA)",
            "Application for Consent",
          ],
          tasks: [
            {
              title: "Draft Deed of Assignment",
              priority: "Medium",
              dueInDays: 14,
            },
            {
              title: "Apply for Ministerial Consent via NUPRC",
              priority: "High",
              dueInDays: 60,
            },
          ],
        },
      },
      "Host Community Development (PIA Chapter 3)": {
        stages: [
          "Applicability Review",
          "HCDT Trust Structuring",
          "Consultation & Incorporation",
          "Ongoing Compliance",
          "Closed",
        ],
        suggestions: {
          processes: [
            "HCDT Incorporation Documents",
            "Consultation Records",
          ],
        },
      },
      "Local Content Compliance (NCDMB)": {
        stages: [
          "Scope Review",
          "Nigerian Content Plan",
          "NCDMB Review / Clearance",
          "Ongoing Monitoring",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Nigerian Content Development Plan",
            "NCDMB Correspondence",
          ],
        },
      },
    },
    },
  ],
  documentCategories: [
    "Licences & Leases",
    "NUPRC / NMDPRA Filings",
    "JOAs & Participation Agreements",
    "Host Community Documents",
    "Local Content Submissions",
  ],
  eventTypes: [
    { name: "Regulatory Meeting (NUPRC / NMDPRA)", color: "blue" },
    { name: "Ministerial Consent Follow-Up", color: "orange" },
    { name: "Host Community Consultation", color: "green" },
  ],
  checklists: [
    {
      name: "PIA Compliance Snapshot",
      items: [
        "Licence/lease status and expiry confirmed",
        "Royalty and gas flare payment status reviewed",
        "Decommissioning and abandonment plan in place",
        "Host community development trust established (3% of opex)",
        "Local content plan approved for current projects",
        "Environmental permits (NESREA / DPR legacy) current",
      ],
      relevantMatterTypes: [
        "Oil & Gas",
      ],
    },
  ],
  automations: [
    "Annual host-community trust filing reminder",
  ],
};

// Maritime & Admiralty

const maritime: PracticeProfile = {
  key: "Maritime & Admiralty",
  label: "Maritime & Admiralty",
  description: "Ship arrest, cargo claims and charter disputes in the Federal High Court's admiralty jurisdiction.",
  contactTypes: [
    "Ship Master / Agent",
    "Admiralty Marshal",
    "P&I Club Correspondent",
    "Nigerian Ports Authority Contact",
    "NIMASA Officer",
    "Marine Surveyor",
    "Bunker Supplier",
  ],
  workflows: [
    {
      type: "Maritime & Admiralty",
      default: {
        stages: [
          "Instruction",
          "Urgency Assessment",
          "Action in Rem / Personam",
          "Security / Settlement",
          "Release",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Letter of Engagement",
            "Urgency Assessment Note",
          ],
        },
      },
      subCategories: {
      "Ship Arrest (In Rem)": {
        stages: [
          "Initial Assessment",
          "Warrant Procurement",
          "Execution of Arrest",
          "Caveat Against Release",
          "Settlement / Sale",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Affidavit of Urgency",
            "Writ of Summons in Rem",
            "Undertaking as to Damages",
            "Warrant of Arrest",
          ],
          tasks: [
            {
              title: "Draft Affidavit of Urgency",
              priority: "High",
              dueInDays: 1,
            },
            {
              title: "File Writ of Summons in Rem",
              priority: "High",
              dueInDays: 1,
            },
            {
              title: "Execute Warrant via Admiralty Marshal",
              priority: "Medium",
              dueInDays: 3,
            },
          ],
        },
      },
      "Cargo Claim": {
        stages: [
          "Notice of Claim",
          "Survey & Inspection",
          "Negotiation with P&I Club",
          "Litigation / Arbitration",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Letter of Claim",
            "Writ of Summons",
            "Statement of Claim",
          ],
          tasks: [
            {
              title: "Review Bill of Lading & protest notes",
              priority: "High",
              dueInDays: 2,
            },
            {
              title: "Lodge claim with P&I Club",
              priority: "Medium",
              dueInDays: 5,
            },
          ],
        },
      },
      "Charter Party Dispute": {
        stages: [
          "Charter Review",
          "Default / Hire Analysis",
          "Pre-Arbitration Correspondence",
          "Arbitration (LMAA / local)",
          "Award & Enforcement",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Notice of Arbitration",
            "Statement of Claim (Arbitration)",
            "Procedural Orders",
          ],
        },
      },
      "Bunker / Crew Claims": {
        stages: [
          "Claim Documentation",
          "Security Negotiation",
          "Action in Rem (if security refused)",
          "Settlement",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Letter of Demand",
            "Undertaking Request",
          ],
        },
      },
    },
    },
  ],
  documentCategories: [
    "Bills of Lading & Shipping Documents",
    "Arrest Papers & Caveats",
    "Survey & Damage Reports",
    "Charter Parties",
    "Arbitration Filings",
  ],
  eventTypes: [
    { name: "Admiralty Marshal Engagement", color: "orange" },
    { name: "Arbitration Session", color: "blue" },
    { name: "Vessel ETA / Inspection", color: "green" },
  ],
  checklists: [
    {
      name: "Ship Arrest Readiness Checklist",
      items: [
        "Maritime claim within FHC admiralty jurisdiction identified",
        "Vessel's current position and port confirmed",
        "Writ in Rem with statement of claim prepared",
        "Affidavit of urgency and undertaking as to damages sworn",
        "Warrant of arrest issued by the court",
        "Admiralty Marshal's fees and logistics arranged",
        "Caveat against release filed",
        "Security negotiation channel with owners open",
      ],
      relevantMatterTypes: [
        "Maritime & Admiralty",
      ],
    },
  ],
  automations: [
    "48-hour follow-up task after arrest execution",
  ],
};

// Tech, Data & Compliance

const techData: PracticeProfile = {
  key: "Tech, Data & Compliance",
  label: "Tech, Data & Compliance",
  description: "Data protection under the NDPA 2023, tech contracts and fintech licensing advisory.",
  contactTypes: [
    "Data Protection Officer (DPO)",
    "NDPC Contact",
    "Tech Founder / Product Lead",
    "Platform / Marketplace Partner",
    "Regulator (CBN / SEC) Contact",
  ],
  workflows: [
    {
      type: "Corporate & Commercial",
      default: {
        stages: [
          "Scoping",
          "Gap Assessment",
          "Remediation",
          "Certification / Filing",
          "Ongoing Monitoring",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Letter of Engagement",
            "Gap Assessment Plan",
          ],
        },
      },
      subCategories: {
      "Data Protection Compliance (NDPA 2023)": {
        stages: [
          "Data Mapping",
          "Gap Assessment",
          "Policy Suite Remediation",
          "DPO Appointment & Training",
          "NDPC Registration / Audit Readiness",
          "Ongoing Compliance",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Data Inventory Template",
            "Privacy Policy",
            "Records of Processing Activities",
            "DPA Templates",
          ],
          tasks: [
            {
              title: "Map all data processing activities and systems",
              priority: "High",
              dueInDays: 10,
            },
            {
              title: "Appoint/review DPO and notify NDPC where required",
              priority: "Medium",
              dueInDays: 30,
            },
          ],
        },
      },
      "Tech Contracts (SaaS / SLA / Marketplace)": {
        stages: [
          "Commercial Model Review",
          "Drafting & Negotiation",
          "Execution",
          "Renewal Monitoring",
          "Closed",
        ],
        suggestions: {
          processes: [
            "SaaS Agreement",
            "Data Processing Agreement",
            "Service Level Schedule",
          ],
        },
      },
      "Fintech / Digital Lending Licensing": {
        stages: [
          "Business Model Review",
          "License Mapping (CBN / SEC)",
          "Application Preparation",
          "Regulatory Engagement",
          "Approval & Go-Live",
          "Closed",
        ],
        suggestions: {
          processes: [
            "License Application File",
            "Corporate Governance Documents",
            "Compliance Framework Manual",
          ],
        },
      },
    },
    },
  ],
  documentCategories: [
    "Privacy & Data Protection Suite",
    "Tech & Platform Agreements",
    "Regulatory Applications",
    "Compliance Reports",
  ],
  eventTypes: [
    { name: "Compliance Review Meeting", color: "blue" },
    { name: "Regulatory Deadline", color: "red" },
    { name: "Staff Training Session", color: "green" },
  ],
  checklists: [
    {
      name: "NDPA Compliance Starter Audit",
      items: [
        "All processing activities inventoried",
        "Lawful bases documented for each processing purpose",
        "Privacy notice published (web, apps, forms)",
        "Data subject rights procedure (access, deletion) operational",
        "DPAs executed with all processors",
        "Cross-border transfer safeguards in place",
        "Breach response plan and 72-hour reporting workflow",
        "DPO appointed and contact published",
        "Staff training completed and logged",
      ],
      relevantMatterTypes: [
        "Corporate & Commercial",
      ],
    },
  ],
  automations: [
    "Annual NDPA audit reminder per client",
  ],
};

// General Practice

const general: PracticeProfile = {
  key: "General Practice",
  label: "General Practice",
  description: "A generalist chambers profile — the commonest matters a mixed Nigerian practice handles daily.",
  contactTypes: [
    "Landlord",
    "Tenant",
    "Estate Agent",
    "Company Secretary",
    "Court Registrar",
    "Process Server",
  ],
  workflows: [
    {
      type: "Civil Litigation",
      default: {
        stages: [
          "Intake",
          "Demand Letter",
          "Filing",
          "Hearing(s)",
          "Judgment & Enforcement",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Letter of Demand",
            "Writ of Summons",
          ],
          tasks: [
            {
              title: "Check limitation period before filing",
              priority: "High",
              dueInDays: 2,
            },
          ],
        },
      },
      subCategories: {
      "Debt Recovery (Undefended List)": {
        stages: [
          "Demand Letter",
          "Writ on Undefended List",
          "Entered Judgment",
          "Enforcement",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Letter of Demand",
            "Writ of Summons (Undefended List)",
          ],
        },
      },
      "Recovery of Premises": {
        stages: [
          "Notice to Quit",
          "7-Day Notice",
          "Court Action",
          "Possession",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Notice to Quit",
            "Claim for Possession",
          ],
        },
      },
    },
    },
    {
      type: "Real Estate",
      default: {
        stages: [
          "Instruction",
          "Search",
          "Documentation",
          "Consent & Registration",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Search Report",
            "Deed of Assignment",
          ],
        },
      },
      subCategories: {
      "Tenancy / Lease Agreement": {
        stages: [
          "Instructions",
          "Drafting",
          "Execution",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Tenancy Agreement",
          ],
        },
      },
      "Property Acquisition (Conveyancing)": {
        stages: [
          "Search & Due Diligence",
          "Contract of Sale",
          "Deed & Stamping",
          "Governor's Consent",
          "Registration",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Contract of Sale",
            "Deed of Assignment",
            "Form 1C",
          ],
        },
      },
    },
    },
    {
      type: "Corporate & Commercial",
      default: {
        stages: [
          "Instruction",
          "Documentation",
          "Filing",
          "Post-Filing",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Memorandum & Articles",
          ],
        },
      },
      subCategories: {
      "Company Incorporation (CAC)": {
        stages: [
          "Name Reservation",
          "Document Preparation",
          "CAC Upload",
          "Certificate Issuance",
          "Post-Incorporation",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Name Availability Search",
            "Memorandum & Articles",
          ],
        },
      },
      "Commercial Contract": {
        stages: [
          "Drafting",
          "Negotiation",
          "Execution",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Draft Agreement",
          ],
        },
      },
    },
    },
  ],
  documentCategories: [
    "Pleadings",
    "Agreements & Contracts",
    "Deeds & Title Documents",
    "Correspondence",
    "Court Processes",
  ],
  eventTypes: [
    { name: "Court Hearing", color: "red" },
    { name: "Client Consultation", color: "blue" },
    { name: "Filing Deadline", color: "orange" },
  ],
  checklists: [
    {
      name: "Matter Opening Checklist (All Matters)",
      items: [
        "Conflicts check completed against parties",
        "Letter of engagement issued and fees discussed",
        "Limitation / statutory time check done",
        "Client KYC and identity documents collected",
        "Matter file opened and documents indexed",
      ],
      relevantMatterTypes: [
        "Civil Litigation",
        "Real Estate",
        "Corporate & Commercial",
      ],
    },
  ],
  automations: [
    "Weekly digest of matters with no logged activity",
  ],
};

// Immigration

const immigration: PracticeProfile = {
  key: "Immigration",
  label: "Immigration",
  description: "Expatriate quotas, work permits (CERPAC) and visa advisory through the Nigeria Immigration Service.",
  contactTypes: [
    "Immigration Service (NIS) Officer",
    "Employer / Sponsor (Expatriate Hire)",
    "Expatriate Employee",
    "Immigration Agent",
  ],
  workflows: [
    {
      type: "Immigration",
      default: {
        stages: [
          "Instruction & Eligibility",
          "Application Preparation",
          "Submission to NIS",
          "Processing Follow-Up",
          "Issuance",
          "Renewal Cycle",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Instruction Letter",
            "Document Checklist",
          ],
        },
      },
      subCategories: {
      "Expatriate Quota": {
        stages: [
          "Business Case Review",
          "Quota Application (FMITI)",
          "Approval",
          "Position Advertising Compliance",
          "Closed",
        ],
        suggestions: {
          processes: [
            "Quota Application File",
            "Newspaper Publications",
          ],
        },
      },
      "Work Permit (STR / CERPAC)": {
        stages: [
          "STR Visa Processing",
          "Regularisation on Arrival",
          "CERPAC Application",
          "Issuance",
          "Renewal",
          "Closed",
        ],
        suggestions: {
          processes: [
            "STR Pack",
            "CERPAC Application",
            "Employer Support Letter",
          ],
        },
      },
    },
    },
  ],
  documentCategories: [
    "Immigration Filings",
    "Permits & Quota Approvals",
    "Expatriate Records",
  ],
  eventTypes: [
    { name: "NIS Appointment", color: "orange" },
    { name: "Permit Expiry", color: "red" },
  ],
  checklists: [
    {
      name: "CERPAC Application Checklist",
      items: [
        "Expatriate quota approved for the role",
        "STR visa obtained before travel",
        "Employer's letter of support and references packaged",
        "Qualifications and credentials notarised",
        "Medical fitness certificate obtained",
        "Police clearance from home country",
        "CERPAC fees paid and receipts kept",
        "Renewal diary set for expiry",
      ],
      relevantMatterTypes: [
        "Immigration",
      ],
    },
  ],
  automations: [
    "Permit renewal reminders 90 days before expiry",
  ],
};


// ---------------------------------------------------------------------------
// Registry & helpers
// ---------------------------------------------------------------------------

export const PRACTICE_PROFILES: Record<string, PracticeProfile> = {
  [litigation.key]: litigation, // Civil Litigation
  [corporate.key]: corporate, // Corporate & Commercial
  [realEstate.key]: realEstate, // Real Estate & Property
  [family.key]: family, // Family Law & Probate
  [criminal.key]: criminal, // Criminal Defence
  [employment.key]: employment, // Employment & Labour
  [banking.key]: banking, // Banking & Finance
  [ip.key]: ip, // Intellectual Property
  [tax.key]: tax, // Tax Law
  [oilGas.key]: oilGas, // Oil & Gas
  [maritime.key]: maritime, // Maritime & Admiralty
  [techData.key]: techData, // Tech, Data & Compliance
  [general.key]: general, // General Practice
  [immigration.key]: immigration, // Immigration
};

/** All profiles, ordered for wizard display. */
export const PRACTICE_PROFILE_ORDER: string[] = [
  litigation.key,
  corporate.key,
  realEstate.key,
  family.key,
  criminal.key,
  employment.key,
  banking.key,
  ip.key,
  tax.key,
  oilGas.key,
  maritime.key,
  techData.key,
  general.key,
  immigration.key,
];

export interface AtriumEventBlueprint {
  name: string;
  color: "red" | "blue" | "orange" | "green" | "yellow";
}

export interface AtriumProfile {
  key: string;
  label: string;
  description: string;
  contactTypes: string[];
  documentCategories: string[];
  eventTypes: AtriumEventBlueprint[];
  checklists: { name: string; items: string[] }[];
  automations: string[];
}

/**
 * Cross-check helper: given onboarding practiceAreas, return the
 * profiles to apply. Unknown strings are ignored safely.
 */
export function getProfilesForAreas(areas: string[]): PracticeProfile[] {
  return areas
    .map((a) => PRACTICE_PROFILES[a])
    .filter((p): p is PracticeProfile => Boolean(p));
}
