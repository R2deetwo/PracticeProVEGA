/**
 * PracticePro ATRIUM — Portfolio Profile Library
 * ============================================================
 * Curated pre-population blueprints for property-management
 * workspaces, keyed by the SAME portfolio types the onboarding
 * wizard collects into practiceProfile.portfolioTypes:
 *   "residential" | "commercial" | "mixed" | "shortlet" | "land"
 * plus focus-area overlays:
 *   "rent-collection" | "service-charge" | "facility-maintenance" |
 *   "estate-community" | "sales-leasing" | "shortlet-operations"
 */

import type { AtriumProfile } from "./practiceProfileLibrary";

export const ATRIUM_CORE_CONTACT_TYPES: string[] = [
  "Landlord",
  "Tenant / Resident",
  "Caretaker / Building Manager",
  "Vendor / Artisan",
  "Govt Agency (Lands, Tax, Utility)",
];

export const ATRIUM_CORE_DOCUMENT_CATEGORIES: string[] = [
  "Lease Agreements",
  "Rent Receipts & Demand Letters",
  "Utility Bills",
  "Maintenance Records",
  "Title & Ownership Papers",
  "Tax / Rates & Levies",
];

const residential: AtriumProfile = {
  key: "residential",
  label: "Residential Lettings",
  description:
    "Flats, houses and duplexes with long-term tenants — the classic caretaker portfolio.",
  contactTypes: [
    "Estate Agent",
    "Facility Manager",
    "Tenant Guarantor",
    "Residents' / Estate Committee",
    "Plumber / Electrician (Artisan)",
  ],
  documentCategories: [
    "Move-in / Move-out Inventories",
    "Tenant KYC Files",
    "Caution Fee Records",
  ],
  eventTypes: [
    { name: "Rent Due Date", color: "orange" },
    { name: "Rent Grace Period Expiry", color: "red" },
    { name: "Lease Expiry (60-day)", color: "red" },
    { name: "Unit Inspection", color: "green" },
    { name: "Maintenance Visit", color: "blue" },
  ],
  checklists: [
    {
      name: "New Tenant Onboarding Checklist",
      items: [
        "Tenant identity (valid ID) and employment/means verified",
        "Guarantor details and ID collected",
        "Rent advance compliant with state tenancy law",
        "Caution/security deposit amount and refund terms documented",
        "Tenancy agreement executed and stamped",
        "Inventory and schedule of condition signed at handover",
        "Keys and access controls handed over and logged",
        "Rent charge schedule set with correct due dates",
        "Portal invitation sent to resident",
      ],
    },
    {
      name: "Move-Out / Exit Inspection Checklist",
      items: [
        "Exit notice date checked against tenancy terms",
        "Final inspection scheduled with tenant present",
        "Inventory compared against move-in schedule",
        "Damages photographed and costed",
        "Caution deposit reconciliation issued",
        "Utility meter readings recorded and balances settled",
        "Keys and access returned",
        "Unit re-listed and marketing started",
      ],
    },
  ],
  automations: [
    "Rent reminder 7 days before due date; demand letter after grace period",
    "Lease expiry alert 60 days before end date",
  ],
};

const commercial: AtriumProfile = {
  key: "commercial",
  label: "Commercial Lettings",
  description:
    "Shops, offices and warehouses — CAMA-grade tenants, service charge regimes and longer documents.",
  contactTypes: [
    "Corporate Tenant (Signatory / Company Secretary)",
    "Facility Manager",
    "Valuer (Rent Review)",
    "Insurance Broker",
    "Fire Service / Safety Inspector",
  ],
  documentCategories: [
    "Service Charge Budgets & Audits",
    "Licence / Fit-out Approvals",
    "Insurance Policies",
    "Rent Review Notices",
  ],
  eventTypes: [
    { name: "Rent Due Date", color: "orange" },
    { name: "Rent Review Window", color: "blue" },
    { name: "Service Charge Audit", color: "green" },
    { name: "Lease Expiry (90-day)", color: "red" },
    { name: "Safety Inspection", color: "blue" },
  ],
  checklists: [
    {
      name: "Commercial Lease Onboarding Checklist",
      items: [
        "Tenant's corporate status confirmed (CAC search where material)",
        "Signatory authority verified (board resolution if needed)",
        "Rent, service charge and VAT treatment agreed in writing",
        "Rent review and escalation formula documented",
        "Fit-out and signage approval terms captured",
        "Insurance obligations assigned and evidenced",
        "Lease executed, stamped and registered where required",
        "Licence/permits (fire, signage) copied to file",
        "Invoices and charges configured with correct cycles",
      ],
    },
  ],
  automations: [
    "Rent review reminder 90 days before review date",
    "Annual service charge budget task for Q4",
  ],
};

const mixed: AtriumProfile = {
  key: "mixed",
  label: "Mixed-Use Buildings",
  description:
    "Combined residential and commercial buildings — dual charge regimes and shared services.",
  contactTypes: [
    "Estate Agent",
    "Facility Manager",
    "Commercial Tenant Rep",
    "Residents' Committee",
    "Generator / Diesel Vendor",
  ],
  documentCategories: [
    "Shared Services Records",
    "Generator & Diesel Logs",
    "Service Charge Budgets",
    "Move-in / Move-out Inventories",
  ],
  eventTypes: [
    { name: "Rent Due Date", color: "orange" },
    { name: "Service Charge Billing", color: "blue" },
    { name: "Joint Inspection", color: "green" },
    { name: "Committee Meeting", color: "blue" },
  ],
  checklists: [
    {
      name: "Mixed-Use Charge Setup Checklist",
      items: [
        "Units classified residential vs commercial in the system",
        "Rent charges created per unit with correct amounts and cycles",
        "Service charge regime defined (what it covers, per sqm or per unit)",
        "Shared utilities (generator, water, waste) metered or allocated",
        "Common area maintenance responsibility documented",
        "Lease terms captured separately per unit type",
      ],
    },
  ],
  automations: [
    "Monthly shared-services log reminder to facility manager",
  ],
};

const shortlet: AtriumProfile = {
  key: "shortlet",
  label: "Short-Lets / Serviced Apartments",
  description:
    "Nightly and short-stay rentals — guest turnover, platform fees and restocking cycles.",
  contactTypes: [
    "Booking Platform Contact (Airbnb etc.)",
    "Guest / Corporate Guest",
    "Housekeeper / Cleaner",
    "Interior / Setup Vendor",
    "Wi-Fi & Cable Provider",
  ],
  documentCategories: [
    "Booking Records",
    "Guest Check-in Forms",
    "Housekeeping Logs",
    "Restocking & Consumables",
  ],
  eventTypes: [
    { name: "Guest Check-in", color: "green" },
    { name: "Guest Check-out", color: "orange" },
    { name: "Turnover / Cleaning Slot", color: "blue" },
    { name: "Restock Day", color: "yellow" },
  ],
  checklists: [
    {
      name: "Short-let Turnover Checklist",
      items: [
        "Check-out inspection completed and damages logged",
        "Deep clean and linen change scheduled and confirmed",
        "Consumables restocked (toiletries, water, coffee)",
        "Wi-Fi, cable and utilities verified working",
        "Access codes / keys rotated for next guest",
        "Guest check-in details and ID captured",
        "Platform calendar synced and pricing reviewed",
      ],
    },
  ],
  automations: [
    "Turnover task auto-created 24h before every check-out",
    "Weekly restock reminder",
  ],
};

const land: AtriumProfile = {
  key: "land",
  label: "Land / Plots & Land Banking",
  description:
    "Vacant plots and leaseholds — encroachment watch, ground rent and documentation hygiene.",
  contactTypes: [
    "Surveyor General Office Contact",
    "Registered Surveyor",
    "Fence / Site Security Contractor",
    "Neighbouring Landowner",
    "Community / Family Head",
  ],
  documentCategories: [
    "Survey Plans & Charting Reports",
    "Gazettes & Excisions",
    "Ground Rent / Land Use Charge Records",
    "Beacon Records",
  ],
  eventTypes: [
    { name: "Site Patrol / Inspection", color: "green" },
    { name: "Ground Rent Due", color: "orange" },
    { name: "Beacon Verification", color: "blue" },
  ],
  checklists: [
    {
      name: "Plot Monitoring Checklist",
      items: [
        "Survey plan charted and beacons verified",
        "Boundary cleared and visible",
        "Site inspected for encroachment at set intervals",
        "Ground rent and land use charge paid and receipted",
        "Title documents held securely (originals + scans)",
        "Any dispute documented with photographs and dates",
      ],
    },
  ],
  automations: [
    "Quarterly site-inspection task per plot",
    "Annual ground rent reminder",
  ],
};

export const ATRIUM_PROFILES: Record<string, AtriumProfile> = {
  residential,
  commercial,
  mixed,
  shortlet,
  land,
};

// ---------------------------------------------------------------------------
// Focus-area overlays (applied in addition to portfolio profiles)
// ---------------------------------------------------------------------------

export interface AtriumFocusOverlay {
  key: string;
  label: string;
  contactTypes?: string[];
  documentCategories?: string[];
  checklists?: { name: string; items: string[] }[];
  automations?: string[];
}

export const ATRIUM_FOCUS_OVERLAYS: Record<string, AtriumFocusOverlay> = {
  "rent-collection": {
    key: "rent-collection",
    label: "Rent Collection & Recovery",
    documentCategories: ["Demand Letters", "Rent Ledgers", "Defaulters Register"],
    checklists: [
      {
        name: "Defaulter Escalation Checklist",
        items: [
          "Outstanding balance and grace period confirmed on the ledger",
          "Reminder notice sent after grace period",
          "Formal demand letter issued (7-day / statutory notice)",
          "Landlord approval for escalation obtained",
          "Recovery of premises process started with counsel",
          "Payment plan (if any) documented and monitored",
        ],
      },
    ],
    automations: ["Demand letter prompt after grace period expiry"],
  },
  "service-charge": {
    key: "service-charge",
    label: "Service Charge Administration",
    documentCategories: [
      "Service Charge Budgets",
      "Service Charge Invoices & Receipts",
      "Vendor Contracts",
    ],
    checklists: [
      {
        name: "Annual Service Charge Budget Checklist",
        items: [
          "Prior year spend reviewed and variance analysed",
          "Vendor contracts re-quoted (security, cleaning, generator)",
          "Budget approved by landlord / committee",
          "Charge schedule loaded per unit with billing dates",
          "Residents notified of the new year's charge",
          "Monthly variance monitoring in place",
        ],
      },
    ],
    automations: ["Service charge invoice cycle on the 1st of each month"],
  },
  "facility-maintenance": {
    key: "facility-maintenance",
    label: "Facility & Maintenance Management",
    contactTypes: ["Plumber / Electrician (Artisan)", "Generator Technician", "Waste Collector", "Security Provider"],
    documentCategories: ["Maintenance Requests", "Work Orders", "Vendor Contracts", "Equipment Logs"],
    checklists: [
      {
        name: "Maintenance Request Workflow Checklist",
        items: [
          "Request logged with photos and location",
          "Vendor assigned with agreed rate",
          "Work order issued and tracked",
          "Completion inspected and photographed",
          "Resident notified and feedback captured",
          "Vendor invoiced against work order",
        ],
      },
    ],
    automations: ["Overdue work-order alert after 5 days"],
  },
  "estate-community": {
    key: "estate-community",
    label: "Estate / Community Management",
    contactTypes: ["Estate Committee Chair", "Security Provider", "Waste Collector", "Estate Billing Payers"],
    documentCategories: ["Estate Levies", "Community Notices", "Meeting Minutes", "Security Reports"],
    checklists: [
      {
        name: "New Estate Onboarding Checklist",
        items: [
          "Estate boundaries and common areas mapped (units & blocks)",
          "Levy structure agreed with the committee",
          "Households imported with contact details",
          "Security and access arrangements documented",
          "First levy cycle billed and communicated",
          "Monthly reporting schedule to the committee agreed",
        ],
      },
    ],
    automations: ["Monthly levy billing on the 1st", "Committee meeting reminder"],
  },
  "sales-leasing": {
    key: "sales-leasing",
    label: "Sales & Leasing (Agency)",
    contactTypes: ["Prospective Buyer", "Prospective Tenant", "Estate Agent", "Estate Surveyor & Valuer", "Solicitor (Conveyancing)"],
    documentCategories: ["Offers & Counter-offers", "Inspection Reports", "Commission Records", "Sale Deeds & Receipts"],
    checklists: [
      {
        name: "Listing to Let Checklist",
        items: [
          "Owner mandate documented (terms, commission)",
          "Property inspected and photographed",
          "Listing published with correct pricing",
          "Viewings logged with feedback",
          "Tenant screening completed",
          "Offer agreed and documentation started",
          "Commission reconciled at completion",
        ],
      },
    ],
    automations: ["7-day listing follow-up reminder"],
  },
  "shortlet-operations": {
    key: "shortlet-operations",
    label: "Short-let Operations",
    documentCategories: ["Booking Records", "Platform Statements", "Guest Agreements"],
    checklists: [
      {
        name: "Weekly Short-let Ops Checklist",
        items: [
          "Calendar reviewed for gaps; pricing adjusted",
          "Platform statements reconciled with bookings",
          "Turnovers completed per checklist",
          "Supplies and consumables checked",
          "Guest reviews monitored and responded to",
        ],
      },
    ],
    automations: ["Weekly ops review task every Monday"],
  },
};

export function getAtriumProfilesForPortfolio(
  portfolioTypes: string[],
  focusAreas: string[],
): { profiles: AtriumProfile[]; overlays: AtriumFocusOverlay[] } {
  const profiles = portfolioTypes
    .map((t) => ATRIUM_PROFILES[t])
    .filter((p): p is AtriumProfile => Boolean(p));
  const overlays = focusAreas
    .map((f) => ATRIUM_FOCUS_OVERLAYS[f])
    .filter((o): o is AtriumFocusOverlay => Boolean(o));
  return { profiles, overlays };
}
