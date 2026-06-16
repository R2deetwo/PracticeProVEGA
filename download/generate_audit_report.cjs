const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  PageBreak, TableOfContents, LevelFormat,
} = require("docx");
const fs = require("fs");

// Tech palette: Cool + Light + Active
const palette = {
  primary: "#0A1628",
  body: "#1A2B40",
  secondary: "#6878A0",
  accent: "#5B8DB8",
  surface: "#F4F8FC",
  red: "#C0392B",
  amber: "#D4A030",
  green: "#27AE60",
  white: "#FFFFFF",
};

const commonFont = { ascii: "Calibri", eastAsia: "Microsoft YaHei" };
const bodySize = 22; // 11pt
const smallSize = 18; // 9pt
const lineSpacing = 312;

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200, line: lineSpacing },
    children: [new TextRun({ text, bold: true, size: 32, font: commonFont, color: palette.primary })],
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160, line: lineSpacing },
    children: [new TextRun({ text, bold: true, size: 26, font: commonFont, color: palette.primary })],
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 120, line: lineSpacing },
    children: [new TextRun({ text, bold: true, size: 23, font: commonFont, color: palette.body })],
  });
}

function para(text, opts = {}) {
  const runs = [];
  // Parse simple **bold** markers
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: bodySize, font: commonFont, color: opts.color || palette.body }));
    } else if (part) {
      runs.push(new TextRun({ text: part, size: bodySize, font: commonFont, color: opts.color || palette.body }));
    }
  }
  return new Paragraph({
    spacing: { before: 80, after: 80, line: lineSpacing },
    alignment: opts.align || AlignmentType.LEFT,
    children: runs,
  });
}

function bullet(text, level = 0) {
  const runs = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: bodySize, font: commonFont, color: palette.body }));
    } else if (part) {
      runs.push(new TextRun({ text: part, size: bodySize, font: commonFont, color: palette.body }));
    }
  }
  return new Paragraph({
    spacing: { before: 40, after: 40, line: lineSpacing },
    indent: { left: 480 + level * 360 },
    children: [new TextRun({ text: "\u2022 ", size: bodySize, font: commonFont, color: palette.accent }), ...runs],
  });
}

function severityBadge(severity) {
  const colors = { P0: palette.red, P1: palette.amber, P2: palette.accent, P3: palette.secondary };
  return new TextRun({ text: ` [${severity}] `, bold: true, size: smallSize, font: commonFont, color: colors[severity] || palette.secondary });
}

function findingPara(severity, text) {
  const runs = [severityBadge(severity)];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: bodySize, font: commonFont, color: palette.body }));
    } else if (part) {
      runs.push(new TextRun({ text: part, size: bodySize, font: commonFont, color: palette.body }));
    }
  }
  return new Paragraph({
    spacing: { before: 60, after: 60, line: lineSpacing },
    indent: { left: 240 },
    children: runs,
  });
}

function makeHeaderCell(text) {
  return new TableCell({
    shading: { fill: palette.primary, type: ShadingType.CLEAR, color: "auto" },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, size: smallSize, font: commonFont, color: palette.white })] })],
  });
}

function makeCell(text, opts = {}) {
  const runs = [];
  const parts = (text || "").split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: smallSize, font: commonFont, color: palette.body }));
    } else if (part) {
      runs.push(new TextRun({ text: part, size: smallSize, font: commonFont, color: opts.color || palette.body }));
    }
  }
  return new TableCell({
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 50, bottom: 50, left: 100, right: 100 },
    children: [new Paragraph({ alignment: opts.align || AlignmentType.LEFT, children: runs })],
  });
}

function makeTable(headers, rows, colWidths) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => makeHeaderCell(h)) }),
      ...rows.map((row, ri) =>
        new TableRow({
          children: row.map((cell, ci) =>
            makeCell(cell, { shading: ri % 2 === 1 ? palette.surface : undefined })
          ),
        })
      ),
    ],
  });
}

// ── BUILD DOCUMENT ──────────────────────────────────────────────
const children = [];

// ── COVER SECTION ──
const coverChildren = [
  new Paragraph({ spacing: { before: 4800 }, children: [] }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: "ATRIUM", bold: true, size: 64, font: commonFont, color: palette.accent })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: "Property Management System", size: 28, font: commonFont, color: palette.secondary })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: "Pre-Launch Technical & Product Audit", bold: true, size: 40, font: commonFont, color: palette.primary })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
    children: [new TextRun({ text: "Comprehensive Deep-Dive Analysis", size: 24, font: commonFont, color: palette.secondary })],
  }),
  new Paragraph({ spacing: { before: 1200 }, children: [] }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: "PracticePro Technologies", bold: true, size: 22, font: commonFont, color: palette.body })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: "June 16, 2026", size: 20, font: commonFont, color: palette.secondary })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "CONFIDENTIAL", bold: true, size: 18, font: commonFont, color: palette.red })],
  }),
];

// ── TOC SECTION ──
const tocChildren = [
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200, line: lineSpacing },
    children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, font: commonFont, color: palette.primary })],
  }),
  new TableOfContents("Table of Contents", {
    hyperlink: true,
    headingStyleRange: "1-3",
  }),
  new Paragraph({
    spacing: { before: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Right-click the TOC above and select \u201cUpdate Field\u201d to refresh page numbers.", italics: true, size: smallSize, font: commonFont, color: palette.secondary })],
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ── BODY CONTENT ──
const body = [];

// Section 1: Executive Summary
body.push(heading1("1. Executive Summary"));
body.push(para("This report presents a comprehensive pre-launch audit of Atrium, the property management product within the PracticePro platform. The audit examined every layer of the system: data model, backend logic, UI components, security, user flows, and product completeness. Atrium has a solid foundation with an impressive feature set for a product at this stage, but several critical gaps must be addressed before launch to ensure reliability, security, and a professional user experience."));
body.push(para("The audit identified **47 issues** across 6 categories: 8 critical (P0), 14 significant (P1), 17 moderate (P2), and 8 minor (P3). The most urgent issues are: missing authorization on financial mutations (any authenticated user can create ledger entries for any firm), an XSS vulnerability in receipt generation, the tenancies table being completely unused despite being central to the product flow, and automated notifications being simulated rather than actually delivered."));
body.push(para("On the positive side, the Atrium tenant portal is the most polished part of the product with comprehensive self-healing logic, the Revenue Engine provides a solid framework for service charge management and defaulter tracking, and the overall UI design is cohesive and responsive. The core property CRUD and unit management work end-to-end, and the onboarding flow now correctly handles annual-only billing for Atrium."));

body.push(heading2("1.1 Audit Scorecard"));
body.push(makeTable(
  ["Category", "Completeness", "Critical Issues", "Notes"],
  [
    ["Data Model", "65%", "3", "Units embedded as v.any(), tenancies table unused, missing indexes"],
    ["Backend Functions", "55%", "4", "No auth on financial mutations, v.any() inputs, simulated notifications"],
    ["UI Components", "80%", "2", "XSS in receipts, orphaned stub component, zero ARIA accessibility"],
    ["Security", "40%", "3", "Missing auth on 12+ mutations, XSS, no tenant identity verification"],
    ["Product Completeness", "60%", "2", "No lease lifecycle, no demand notice delivery, no bulk operations"],
    ["Performance", "55%", "1", "Full-table scans in cron jobs, N+1 queries, unbounded document growth"],
  ],
  [2400, 1600, 1400, 4400]
));

// Section 2: Critical Issues (P0)
body.push(heading1("2. Critical Issues (P0)"));
body.push(para("These issues must be fixed before launch. They represent security vulnerabilities, data integrity risks, or core functionality that is broken."));

body.push(heading2("2.1 Missing Authorization on Financial Mutations"));
body.push(para("The Atrium billing and revenue functions in sentry.ts have **no authorization checks**. Any authenticated user, even from a different firm, can create ledger entries, mark charges as paid, or apply late penalties to any firm's data. This is a serious security vulnerability that violates the most basic multi-tenancy isolation requirement."));
body.push(findingPara("P0", "**addLedgerEntry** (sentry.ts:18) \u2014 No requireFirmUser call. Any user can create financial records for any firm."));
body.push(findingPara("P0", "**markChargeAsPaid** (sentry.ts:193) \u2014 No auth check. Any user can mark any service charge as paid."));
body.push(findingPara("P0", "**applyLatePenalty** (sentry.ts:163) \u2014 No auth check. Any user can apply penalties to any firm's tenants."));
body.push(findingPara("P0", "**updateLedgerStatus** (sentry.ts:66) \u2014 No auth check. Ledger status can be changed by anyone."));
body.push(findingPara("P0", "**upsertServiceCharge** (sentry.ts:116) \u2014 No auth check. Service charges can be created or modified by anyone."));
body.push(para("The fix is straightforward: add requireFirmUser(ctx, args.firmId) at the top of each mutation, following the pattern already used in myFunctions.ts for createItem and updateItem. Additionally, the firmId in the mutation args should be verified to match the caller's firm."));

body.push(heading2("2.2 XSS Vulnerability in Receipt Generation"));
body.push(para("LedgerManager.tsx generates PDF receipts by interpolating user-controlled data (firm name, entry description, txHash) directly into an HTML string written via document.write(). If a firm name or ledger description contains a script tag, it will execute in the browser context. This is a classic reflected XSS vulnerability."));
body.push(findingPara("P0", "**LedgerManager.tsx** (line 287-310) \u2014 firm.name, entry.description, and entry.txHash are interpolated into document.write() HTML without sanitization."));
body.push(para("The fix is to sanitize all user-controlled strings before interpolation, or better yet, use a proper PDF generation library (the project already uses jspdf and html2pdf elsewhere) instead of document.write()."));

body.push(heading2("2.3 Tenancies Table Completely Unused"));
body.push(para("The schema defines a tenancies table with proper indexes (by_firm, by_property, by_tenant), but no backend function ever creates, reads, or updates tenancy records except generateRentDemand in drafting.ts, which queries it and gets empty results every time. This means the entire lease lifecycle is broken: rent demands cannot populate tenant information, lease start/end dates are not tracked, and the tenancies table serves no purpose."));
body.push(findingPara("P0", "**tenancies** table (schema.ts:716-732) \u2014 No CRUD mutations exist. generateRentDemand queries it and always receives null for tenant_name, rent_amount, and total_arrears."));
body.push(findingPara("P0", "**No lease creation flow** \u2014 When a tenant is assigned to a unit via the portal invite flow, no tenancy record is created. The link between tenant and property is stored only in the untyped properties.units[] embedded array."));
body.push(para("The fix requires: (1) creating createTenancy, updateTenancy, and terminateTenancy mutations, (2) calling createTenancy when a tenant is assigned to a unit, (3) adding a unitId field to the tenancies table, and (4) updating generateRentDemand to rely on tenancies for arrears calculation."));

body.push(heading2("2.4 Simulated Notifications (Not Actually Delivered)"));
body.push(para("The automated notification system is a facade. Both the daily automation cron and the service charge WhatsApp reminder cron log messages with status \"simulated\" but never actually send them. The processScheduledMessages cron marks messages as \"sent\" without delivering them. This means users are paying for a notification feature that does not work."));
body.push(findingPara("P0", "**sendServiceChargeReminders** (sentry.ts:665-841) \u2014 All reminders logged with status: \"simulated\" (line 825). Comment says \"actual WhatsApp/email dispatch would integrate with Twilio/Resend here\" \u2014 never implemented."));
body.push(findingPara("P0", "**processScheduledMessages** (portals.ts:1557) \u2014 Marks emails and WhatsApp messages as \"sent\" without actually delivering them (lines 1574-1587). SMS marked as \"failed\" with \"SMS provider not configured\"."));
body.push(findingPara("P0", "**runDailyAutomation** (sentry.ts:843-877) \u2014 Recipient hardcoded to \"simulated_tenant\" (line 868). No real delivery occurs."));
body.push(para("The communications.ts file already has working sendEmail (Brevo) and sendWhatsApp (Chakra) functions. The fix is to call these actual delivery functions from the cron handlers instead of logging simulated results."));

body.push(heading2("2.5 Missing Tenant Authorization in Portal"));
body.push(para("Portal tenant queries do not verify that the caller is actually the tenant they are querying for. Any authenticated portal user can pass any tenantId and view that tenant's ledger, maintenance tickets, and messages."));
body.push(findingPara("P0", "**getTenantInfo** (portals.ts:1621) \u2014 No identity verification. Any portal user can query any other tenant's data."));
body.push(findingPara("P0", "**getTenantLedger** (portals.ts:1825) \u2014 Same issue. Financial data exposed to any authenticated user."));
body.push(findingPara("P0", "**getMaintenanceTicketsByTenant** (portals.ts:45) \u2014 Same issue. Maintenance records exposed."));
body.push(para("The fix is to verify ctx.auth and match the caller's userId against the requested tenantId before returning data."));

body.push(heading2("2.6 Admin Functions Without Auth"));
body.push(findingPara("P0", "**adminSearchUsersByEmail** (myFunctions.ts:2892) \u2014 Comment says \"In a real app, verify the caller is an Admin\" but no check exists."));
body.push(findingPara("P0", "**adminDeleteUser** (myFunctions.ts:2905) \u2014 Same issue. Any user can delete any other user."));
body.push(findingPara("P0", "**adminForceVerify** (myFunctions.ts:2916) \u2014 Same issue. Any user can force-verify any email."));

// Section 3: Significant Issues (P1)
body.push(heading1("3. Significant Issues (P1)"));
body.push(para("These issues should be addressed before or shortly after launch. They affect data integrity, performance, or user experience significantly."));

body.push(heading2("3.1 Data Model: Units as v.any() Embedded Array"));
body.push(para("Properties store their units as an embedded v.array(v.any()) field. This is the single largest data model issue because it means: no referential integrity between units and the six tables that reference unitId (service_charges, ledger_entries, leads_pipeline, automation_logs, atrium_inbound_messages, maintenance_tickets), no unit-level indexing, and unbounded document growth as units accumulate history. Convex has a 1MB document limit; a large property with 200+ units and historical data will approach this limit."));
body.push(para("Additionally, unitId fields in other tables are string references with no foreign key enforcement. If a unit is deleted from the embedded array, all related records become orphaned. The fix is to extract units into a dedicated table with proper typed fields, indexes, and foreign key references."));

body.push(heading2("3.2 Missing Database Indexes"));
body.push(para("Several frequently-queried fields lack indexes, causing full table scans in production code. This will degrade performance as data grows."));
body.push(makeTable(
  ["Table", "Missing Index", "Impact"],
  [
    ["properties", "by_firm_status", "Status filtering requires full firm scan"],
    ["properties", "by_owner / by_landlord", "Landlord-specific queries are unindexed"],
    ["properties", "by_currentTenant", "\"Which properties does this tenant occupy?\" is O(n)"],
    ["tenancies", "by_firm_status", "Active tenancy filtering is unindexed"],
    ["tenancies", "by_property_status", "Active tenancies per property are unindexed"],
    ["tenancies", "by_tenant_status", "Tenant's current tenancy is unindexed"],
    ["service_charges", "by_tenant", "Tenant charge lookups require join or scan"],
    ["ledger_entries", "by_propertyId", "Per-property financial queries are unindexed"],
    ["ledger_entries", "by_tenant", "Per-tenant transaction history is unindexed"],
  ],
  [2200, 2600, 5000]
));

body.push(heading2("3.3 Full-Table Scans in Production Code"));
body.push(para("Several backend functions use .collect() without an index scope, loading ALL records across ALL firms. This is an O(n) operation that will become unsustainable."));
body.push(findingPara("P1", "**sentry.ts:685,954,1017** \u2014 ctx.db.query(\"properties\").collect() loads ALL properties globally. Should use .withIndex(\"by_firm\", ...) to scope queries."));
body.push(findingPara("P1", "**sentry.ts:320** \u2014 ctx.db.query(\"service_charges\").collect() loads ALL service charges globally."));
body.push(findingPara("P1", "**portals.ts:1368,1792** \u2014 Same pattern, unscoped property queries."));
body.push(findingPara("P1", "**deleteMatterCascade** (myFunctions.ts:2742) \u2014 For each of 11 tables, fetches ALL firm items then filters. N+1 query pattern."));
body.push(findingPara("P1", "**deleteContactCascade** (myFunctions.ts:2857) \u2014 Nested loops: matters x 7 tables."));

body.push(heading2("3.4 v.any() Input Validation Gaps"));
body.push(para("Nine mutation arguments use v.any(), providing zero type safety or input validation. This allows malformed data to enter the database and is a security risk."));
body.push(makeTable(
  ["Function", "File:Line", "Argument"],
  [
    ["createItem", "myFunctions.ts:1828", "data: v.any()"],
    ["updateItem", "myFunctions.ts:1989", "data: v.any()"],
    ["addUnitToProperty", "myFunctions.ts:2959", "unitData: v.any()"],
    ["createUser", "myFunctions.ts:1012", "args: v.any()"],
    ["updateFirmSettings", "myFunctions.ts:1650", "settings: v.any()"],
    ["updateUserSecurityFields", "myFunctions.ts:996", "fields: v.any()"],
    ["saveAloaMessage", "myFunctions.ts:2629", "message: v.any()"],
    ["logActivity", "myFunctions.ts:1892", "metadata: v.optional(v.any())"],
    ["updateInviteRecord", "portals.ts:607", "updates: v.any()"],
  ],
  [2600, 2600, 4600]
));

body.push(heading2("3.5 Race Conditions"));
body.push(findingPara("P1", "**addUnitToProperty** (myFunctions.ts:2974) \u2014 Reads property.units then patches with [...existingUnits, newUnit]. Two concurrent calls could both read the same existingUnits and one addition gets lost."));
body.push(findingPara("P1", "**incrementWhatsAppQuota** (myFunctions.ts:2947) \u2014 Read-then-increment counter. Concurrent sends could exceed the monthly limit."));
body.push(findingPara("P1", "**createPortalInvite** (portals.ts) \u2014 Supersede existing invites then insert. Small window where concurrent invites for same email could both succeed."));

body.push(heading2("3.6 schemaValidation: false"));
body.push(para("The Convex schema has schemaValidation: false (schema.ts line 1355), which means Convex will not enforce type constraints at the database level. This negates much of the schema definition work and allows fields like portalPresenceHidden (used in code but missing from the schema) to silently work until they cause bugs. Production deployments should have schema validation enabled."));

body.push(heading2("3.7 Missing Loading States"));
body.push(para("Several Atrium components have no loading skeleton, showing an empty or broken layout while data fetches:"));
body.push(bullet("**PropertyManagerView** \u2014 No loading skeleton while properties are fetching"));
body.push(bullet("**RevenueEngine** \u2014 No loading skeleton when coreState data is undefined"));
body.push(bullet("**VacancyPipeline** \u2014 Assumes leadsPipeline is always available"));
body.push(bullet("**PropertyReports** \u2014 No loading skeleton at all"));

body.push(heading2("3.8 AutomationCenter Select Dropdown Bug"));
body.push(findingPara("P1", "**AutomationCenter.tsx** (line 270) \u2014 React elements (SVG icons) are rendered inside <option> tags as {MSG_TYPE_ICONS[k]} {v}, producing \"[object Object]\" text in the dropdown. Icons must be removed from <option> elements."));

// Section 4: Moderate Issues (P2)
body.push(heading1("4. Moderate Issues (P2)"));
body.push(para("These issues should be addressed in the first post-launch iteration. They affect completeness, consistency, or maintainability."));

body.push(heading2("4.1 Missing Property Management Features"));
body.push(makeTable(
  ["Feature", "Status", "Impact"],
  [
    ["Lease lifecycle (create/renew/terminate)", "Missing", "Tenancies table unused; no lease tracking"],
    ["Demand notice delivery", "Missing", "Notices generated but never sent to tenants"],
    ["Bulk unit generation", "Missing", "50-unit property requires 50 separate mutations"],
    ["Unit status management", "Missing", "No updateUnitStatus mutation"],
    ["Occupancy rate calculation", "Missing", "No function computes this key KPI"],
    ["Aging report (30/60/90 day)", "Missing", "No arrears breakdown by age"],
    ["Rent roll report", "Missing", "Standard property management report absent"],
    ["Payment collection rate", "Missing", "No percentage tracking of collected vs owed"],
    ["Revenue by property", "Missing", "getCashFlowSummary is firm-wide only"],
    ["Lease expiry notifications", "Missing", "No cron detects upcoming lease expirations"],
    ["Managed data migration tool", "Missing", "isDataMigration flag exists but no import API"],
    ["Bulk demand notice generation", "Missing", "One-at-a-time only; not scalable for defaulters"],
  ],
  [3200, 1400, 5200]
));

body.push(heading2("4.2 Schema Inconsistencies"));
body.push(bullet("**portalPresenceHidden** \u2014 Used in code (myFunctions.ts, portals.ts) but not defined in users schema. Works only because schemaValidation is false."));
body.push(bullet("**Duplicate created_by / createdBy** \u2014 Both exist in firms table (lines 35-36) with different naming conventions."));
body.push(bullet("**numberOfUnits vs units.length** \u2014 Both exist on properties table (lines 688-689) and can diverge."));
body.push(bullet("**rentPaymentHistory** \u2014 Denormalized on properties table (line 694) duplicates ledger_entries. Can become stale."));
body.push(bullet("**maintenanceHistory** \u2014 Same denormalization issue (line 693) duplicates maintenance_tickets."));
body.push(bullet("**Field naming inconsistency** \u2014 invoices.total_amount uses snake_case; timeEntries.user_id uses snake_case while everything else uses camelCase."));

body.push(heading2("4.3 Required Fields Marked as Optional"));
body.push(para("The nullableString/nullableNumber/nullableBoolean pattern creates a triple-state problem (undefined | null | value). Critical fields that should be required include: properties.firmId, properties.address, properties.propertyType, tenancies.firmId, tenancies.propertyId, tenancies.tenantId, tenancies.rentAmount, tenancies.startDate, payment_proofs.firmId, payment_proofs.tenantId, payment_proofs.amount, payment_proofs.status, and portal_settings.firmId."));

body.push(heading2("4.4 Orphaned Stub Component"));
body.push(findingPara("P2", "**AtriumPublicApplicationForm.tsx** \u2014 The public application form component has its backend mutation commented out (line 17), submission is console.log only, the component is not imported anywhere, and no /apply/:propertyId route exists. This is dead code that should either be completed or removed."));

body.push(heading2("4.5 Payment Proofs Not Linked to Ledger Entries"));
body.push(para("When a tenant uploads a payment proof via the portal, there is no automatic ledger entry creation. An admin must manually mark the corresponding service charge as paid via markChargeAsPaid. There is no ledgerEntryId on payment_proofs or vice versa, making reconciliation difficult and error-prone."));

body.push(heading2("4.6 Demand Notice Generation Issues"));
body.push(bullet("**No dedicated demand_notices table** \u2014 No way to track notice delivery status, tenant response, or escalation level"));
body.push(bullet("**No delivery mechanism** \u2014 Generated demand notices are returned as text but never sent via WhatsApp or email"));
body.push(bullet("**Hardcoded notice period** \u2014 notice_period: 7 (drafting.ts:67) should be configurable per jurisdiction/property"));
body.push(bullet("**No link to tenancies.totalArrears** \u2014 Generating a demand doesn't update the arrears balance"));

body.push(heading2("4.7 Zero ARIA Accessibility"));
body.push(para("None of the Atrium components have ARIA attributes (aria-label, role, aria-describedby, aria-pressed). Tab bars lack role=\"tablist\"/\"tab\", modal close buttons lack aria-label, and interactive filter pills lack aria-pressed. This is a WCAG 2.1 compliance issue that affects users with disabilities and may have legal implications depending on jurisdiction."));

// Section 5: Minor Issues (P3)
body.push(heading1("5. Minor Issues (P3)"));
body.push(para("These are quality-of-life improvements that can be addressed in subsequent iterations."));

body.push(heading2("5.1 UI Polish"));
body.push(bullet("**CommunicationPrintView** \u2014 \"Page 1 of 1\" is hardcoded; multi-page prints will show incorrect pagination"));
body.push(bullet("**PropertyReports** \u2014 No error handling or empty state; table may overflow on mobile without horizontal scroll"));
body.push(bullet("**BulkEditPropertyModal** \u2014 handleConfirm has no try/catch; if onConfirm rejects, the modal silently fails"));
body.push(bullet("**TenantPortal** \u2014 TODO comment: \"Extract isDark detection into a shared useIsDark hook\" (line 210)"));

body.push(heading2("5.2 Code Quality"));
body.push(bullet("**product === 'property' check** in App.tsx \u2014 Should use isAtrium from context instead of string comparison, since ProductContext maps property to atrium"));
body.push(bullet("**Deprecated fields in schema** \u2014 portal_messages.replyContent and repliedAt are marked DEPRECATED but remain in schema"));
body.push(bullet("**attachments vs images** \u2014 portals.ts:28 names the argument \"attachments\" but maps it to \"images\" in the insert (line 36). Confusing API surface."));
body.push(bullet("**sentryWebhook.ts:21** \u2014 TODO comment about crypto validation that was never implemented"));

body.push(heading2("5.3 Missing SMS Provider"));
body.push(para("The processScheduledMessages cron marks SMS as \"failed\" with \"SMS provider not configured\". If SMS is a planned feature, a provider (e.g., Twilio, Termii) needs to be integrated. If not, the SMS option should be removed from the UI to avoid misleading users."));

// Section 6: Feature Completeness Assessment
body.push(heading1("6. Feature Completeness Assessment"));
body.push(heading2("6.1 What Works Well"));
body.push(para("Despite the issues identified, Atrium has several areas that are genuinely well-built and production-ready:"));
body.push(bullet("**Tenant Portal** (80% complete) \u2014 The most polished part of the product. 7 tabs with comprehensive functionality, per-tab error boundaries, auto-repair for missing firmId and stale property links, and mobile-first responsive design. This is genuinely impressive."));
body.push(bullet("**Revenue Engine** (75% complete) \u2014 The service charge monitor with defaulter tracking, penalty application, and cash flow visualization provides a solid framework. The ledger system with immutable entries and txHash idempotency is well-designed."));
body.push(bullet("**Onboarding Flow** (90% complete) \u2014 After recent fixes, the Atrium-specific plan selection, annual-only billing, SCE display, and managed data migration opt-in work correctly end-to-end."));
body.push(bullet("**Automation Center** (70% complete) \u2014 The rule configuration, template editor, and audit trail provide a good foundation for communication automation."));
body.push(bullet("**Property CRUD** (85% complete) \u2014 Creating, editing, and managing properties with units works well from a UI perspective, with bulk edit support and responsive design."));

body.push(heading2("6.2 What Needs Work"));
body.push(makeTable(
  ["Area", "Completeness", "Key Gaps"],
  [
    ["Property CRUD", "85%", "No dedicated mutations, v.any() data, no maxUnits enforcement"],
    ["Unit Management", "30%", "No bulk generation, no status management, v.any() unit data"],
    ["Tenant/Lease Mgmt", "40%", "No lease CRUD, tenancies table unused, no lease expiry tracking"],
    ["Billing/Revenue", "60%", "Ledger works well but no auth, no invoice generation"],
    ["Demand Notices", "30%", "Generation exists but no delivery, tenancies table empty"],
    ["Financial Reporting", "40%", "Basic summaries only; no occupancy, aging, rent roll"],
    ["Tenant Portal", "80%", "Comprehensive but no tenant auth on queries"],
    ["Data Migration", "20%", "No bulk import, no managed migration tool"],
    ["Notifications", "40%", "Infrastructure exists but reminders are simulated"],
    ["AI Features", "20%", "Generic proxy only, no Atrium-specific AI capabilities"],
    ["Accessibility", "5%", "Zero ARIA attributes across all Atrium components"],
  ],
  [2400, 1600, 6800]
));

// Section 7: Recommendations & Priority
body.push(heading1("7. Recommendations & Priority"));
body.push(heading2("7.1 Must-Fix Before Launch (P0)"));
body.push(para("These items are non-negotiable for a production launch. They represent security vulnerabilities or core functionality that is fundamentally broken."));
body.push(makeTable(
  ["#", "Issue", "Effort", "Risk if Unfixed"],
  [
    ["1", "Add authorization to all Atrium financial mutations (sentry.ts)", "2-3 days", "Any user can modify any firm's financial data"],
    ["2", "Add tenant identity verification to portal queries (portals.ts)", "1-2 days", "Tenants can view other tenants' financial data"],
    ["3", "Add admin auth checks to adminSearchUsersByEmail, adminDeleteUser, adminForceVerify", "0.5 days", "Any user can search/delete/verify other users"],
    ["4", "Fix XSS in LedgerManager receipt generation", "0.5 days", "Script injection via firm name or description"],
    ["5", "Implement actual notification delivery in cron handlers", "2-3 days", "Users pay for notifications that don't work"],
    ["6", "Create tenancy CRUD + wire into portal invite flow", "3-4 days", "Rent demands always show null tenant info"],
  ],
  [600, 4800, 1200, 4200]
));

body.push(heading2("7.2 Should-Fix Before Launch (P1)"));
body.push(para("These items are strongly recommended for launch. They affect performance, data integrity, or user experience at scale."));
body.push(makeTable(
  ["#", "Issue", "Effort", "Impact"],
  [
    ["1", "Add missing database indexes (9 indexes)", "1 day", "Query performance degrades linearly with data growth"],
    ["2", "Replace v.any() with typed validators on critical mutations", "2-3 days", "Malformed data enters database unchecked"],
    ["3", "Fix full-table scans in cron jobs (scope queries by firmId)", "1 day", "Cron jobs will time out as data grows"],
    ["4", "Fix race conditions (addUnitToProperty, WhatsApp quota)", "1-2 days", "Data loss under concurrent operations"],
    ["5", "Add loading skeletons to PropertyManagerView, RevenueEngine, VacancyPipeline, PropertyReports", "1 day", "Broken layout during data loading"],
    ["6", "Fix AutomationCenter select dropdown ([object Object] bug)", "0.5 days", "Dropdown shows garbage text"],
    ["7", "Enable schemaValidation: true and add portalPresenceHidden to schema", "1 day", "Schema violations silently ignored"],
  ],
  [600, 5200, 1200, 3800]
));

body.push(heading2("7.3 Post-Launch Priorities (P2/P3)"));
body.push(para("These items should be addressed in the first 2-4 weeks after launch, prioritized by user impact:"));
body.push(bullet("**Week 1-2**: Bulk unit generation, lease lifecycle mutations, demand notice delivery integration, payment proof-to-ledger reconciliation"));
body.push(bullet("**Week 2-3**: Financial reporting (occupancy rates, aging report, rent roll, revenue by property), ARIA accessibility across all components"));
body.push(bullet("**Week 3-4**: Extract units into dedicated table (data model migration), managed data migration tool, remove deprecated fields"));
body.push(bullet("**Ongoing**: AI property-specific features, SMS provider integration, performance optimization"));

// Section 8: Architecture Recommendations
body.push(heading1("8. Architecture Recommendations"));
body.push(heading2("8.1 Extract Units from Embedded Array"));
body.push(para("The most impactful architectural change is extracting units from the embedded properties.units array into a dedicated units table. This would enable: proper referential integrity with unitId foreign keys, unit-level indexing for fast lookups, bounded document sizes, atomic unit-level operations without race conditions, and proper unit status management. This is a non-trivial migration that requires careful planning, but it is essential for long-term scalability."));

body.push(heading2("8.2 Create Dedicated Property Mutations"));
body.push(para("Replace the generic createItem/updateItem mutations with dedicated createProperty/updateProperty mutations that enforce: required field validation (address, propertyType, firmId), maxUnits limit checks from the firm's tier, proper unit structure validation, and firm-scoped authorization. This eliminates the v.any() vulnerability for the most critical data operations."));

body.push(heading2("8.3 Implement Notification Pipeline"));
body.push(para("The communication infrastructure (Brevo for email, Chakra for WhatsApp) exists and works. The gap is the cron handlers that are supposed to trigger these send functions but instead log simulated results. The fix is straightforward: call sendEmail and sendWhatsApp from the cron handlers with proper error handling, retry logic, and delivery tracking."));

body.push(heading2("8.4 Add Reporting Layer"));
body.push(para("Atrium lacks several standard property management reports. The reporting layer should be built on top of the existing getCashFlowSummary pattern, extending it with: per-property revenue aggregation, occupancy rate calculations (occupied units / total units), 30/60/90-day aging breakdown, payment collection rate (collected / owed), and rent roll (unit-by-unit rent status). These can be implemented as Convex query functions with appropriate caching."));

// ── ASSEMBLE DOCUMENT ──
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { size: bodySize, font: commonFont, color: palette.body },
        paragraph: { spacing: { line: lineSpacing } },
      },
      heading1: {
        run: { size: 32, bold: true, font: commonFont, color: palette.primary },
        paragraph: { spacing: { before: 360, after: 200, line: lineSpacing } },
      },
      heading2: {
        run: { size: 26, bold: true, font: commonFont, color: palette.primary },
        paragraph: { spacing: { before: 280, after: 160, line: lineSpacing } },
      },
      heading3: {
        run: { size: 23, bold: true, font: commonFont, color: palette.body },
        paragraph: { spacing: { before: 200, after: 120, line: lineSpacing } },
      },
    },
  },
  numbering: {
    config: [{
      reference: "default-bullet",
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: "\u2022",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    }],
  },
  sections: [
    // Cover
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1417, bottom: 1417, left: 1701, right: 1417 },
        },
      },
      children: coverChildren,
    },
    // TOC
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1417, bottom: 1417, left: 1701, right: 1417 },
        },
      },
      children: tocChildren,
    },
    // Body
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1417, bottom: 1417, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Atrium Pre-Launch Audit", italics: true, size: smallSize, font: commonFont, color: palette.secondary })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Confidential \u2014 PracticePro Technologies \u2014 Page ", size: smallSize, font: commonFont, color: palette.secondary }),
              new TextRun({ children: [PageNumber.CURRENT], size: smallSize, font: commonFont, color: palette.secondary }),
            ],
          })],
        }),
      },
      children: body,
    },
  ],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/home/z/my-project/download/Atrium_PreLaunch_Audit_Report.docx", buffer);
  console.log("Report generated: /home/z/my-project/download/Atrium_PreLaunch_Audit_Report.docx");
});
