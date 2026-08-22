
import React, { useState, useRef } from 'react';
import { Logo, DocumentIcon, ShieldCheckIcon, SparklesIcon, ArrowLeftIcon } from '../constants';
import { sanitize } from '../utils/sanitization';

/**
 * The public Resources page must ALWAYS render in light mode, regardless of:
 *   - the user's system `prefers-color-scheme: dark` setting
 *   - the saved `practicepro_theme` value in localStorage (see inline
 *     script in index.html that toggles `html.dark`)
 *
 * Two safeguards:
 *   1. All Tailwind `dark:` variant classes have been stripped from this
 *      file, so the page never picks up dark utility styles.
 *   2. The root container sets `colorScheme: 'light'` via inline style,
 *      which is the W3C-standard way to tell the browser this subtree
 *      should always render with light-mode defaults (scrollbars, form
 *      controls, etc.) and overrides any inherited dark color scheme.
 *
 * Explicit Tailwind color classes (bg-slate-50, text-slate-900, etc.) on
 * every meaningful element handle the rest, so the global
 * `html.dark body { color: #ffffff !important }` rule in index.html
 * cannot bleed through.
 */

interface ResourcesPageProps {
    onBack: () => void;
    onPrivacyClick: () => void;
    onTermsClick: () => void;
    onCookieClick?: () => void;
    onDPAClick?: () => void;
    /** Optional: called when the user clicks "Start Free Trial". If not
     * provided, the CTA falls back to `onBack`. Wired in App.tsx to
     * `navigateTo('dashboard')`, which routes unauthenticated visitors to
     * the LandingPage (where the signup modal lives). */
    onStartTrial?: () => void;
    /** Optional: called when the user clicks "Talk to Sales". Same fallback
     * and wiring as `onStartTrial`. */
    onContactSales?: () => void;
    /** Optional: called when the user clicks "Usage Policy" in the Legal tab.
     * If not provided, the button is hidden (since UsagePolicy is optional
     * in some deployments). */
    onUsageClick?: () => void;
    /** Optional: called when the user clicks "Portal Terms of Use" in the
     * Legal tab. */
    onPortalTermsClick?: () => void;
    activeProduct: 'vega' | 'atrium';
    setActiveProduct?: (p: 'vega' | 'atrium') => void;
}

// ─── DATA ────────────────────────────────────────────────────────────────────

const ATRIUM_WHITE_PAPERS = [
    {
        id: 'proptech-adoption',
        tag: 'PropTech',
        tagColor: 'bg-blue-50 text-blue-700 border-blue-200',
        title: 'Digital Transformation in Nigerian Real Estate Management',
        summary: 'A comprehensive guide on transitioning from manual property management to automated systems. Discusses rent tracking, maintenance workflows, tenant communication, and scaling property portfolios across multiple states in Nigeria.',
        readTime: '10 min read',
        content: `
## Introduction

The real estate management sector in Nigeria is undergoing a much-needed digital transformation. For decades, property managers have relied on fragmented systems—manual ledgers, disconnected Excel spreadsheets, fragmented WhatsApp groups, and paper receipts. While these methods may suffice for a portfolio of three to five properties, they become catastrophic liabilities as portfolios scale.

Today's Nigerian property manager is not just collecting rent; they are managing facility maintenance lifecycles, ensuring regulatory compliance with the tenancy and recovery of premises laws of the state where each property is located (every Nigerian state and the FCT has its own tenancy law), handling complex vendor relationships, and providing transparent financial reporting to absentee landlords or corporate investors.

## 1. The True Cost of Manual Rent Collection

Late payments and reconciliation errors are the silent killers of property management profitability. When rent collection relies on bank transfers followed by WhatsApp messages with screenshots of payment receipts, the reconciliation process becomes a full-time job.

**The Automation Solution:**
By integrating automated payment gateways and automatic invoicing, property managers eliminate the "I sent it" vs "I haven't seen it" debate. Systems like PracticePro Atrium automatically map incoming payments to specific units, instantly update the tenant's ledger, generate a digital receipt, and trigger an alert to the property manager. This can significantly reduce reconciliation time compared to manual methods.

## 2. Transforming the Maintenance Lifecycle

Traditional maintenance requests are prone to being lost, delayed, or poorly executed. A tenant complains about a leaking roof, the property manager scribbles it on a notepad, calls a vendor who promises to visit "tomorrow," and the cycle of frustration begins.

**The Unified Workflow:**
A digital system transforms this into a transparent lifecycle:
1. **Submission:** Tenant logs the request via a portal, attaching photos.
2. **Triage:** Manager assesses severity and assigns a verified vendor directly within the system.
3. **Execution:** Vendor updates status; Manager tracks progress.
4. **Resolution & Billing:** Work is completed, tenant signs off, and the cost is automatically logged against the property's operational expenses.

This creates a verifiable audit trail, which is invaluable when providing financial accounts to property owners.

## 3. Financial Transparency for Portfolio Owners

Whether you are managing your own portfolio or acting as an agent for external landlords, transparent financial reporting is non-negotiable. Manual reporting often involves aggregating data from various bank statements at the end of the month—a process ripe for human error.

Atrium OS provides real-time financial dashboards that separate management fees, operational expenses, and net rental yields. By categorizing properties into "Owned" vs "Managed," the system intelligently applies fee structures, ensuring that managers can instantly pull accurate profit and loss statements for any property, at any time.

## Conclusion

The transition to a unified property management system is no longer a luxury; it is a competitive necessity. Adopting a system like PracticePro Atrium streamlines operations, reduces overhead, and ultimately allows property managers to scale their portfolios confidently without sacrificing service quality.
        `
    },
    {
        id: 'atrium-tenant-retention',
        tag: 'Strategy',
        tagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        title: 'Maximizing Tenant Retention Through Digital Experience',
        summary: 'Explore how providing a seamless, digital-first experience for tenants leads to higher retention rates, lower turnover costs, and improved property yields in competitive urban markets like Lagos and Abuja.',
        readTime: '8 min read',
        content: `
## The Turnover Problem

In high-demand Nigerian real estate markets, tenant turnover is incredibly expensive. Beyond the obvious loss of rental income during vacancy periods, property managers incur costs for unit refurbishment, marketing, agency fees, and the administrative burden of new lease agreements. Retaining a reliable tenant is generally more profitable than finding a new one.

## The Role of Tenant Experience

Modern tenants expect the same level of digital convenience in their housing as they do in banking and e-commerce. A property management firm that relies on cash payments and paper notices is implicitly telling its tenants that it is stuck in the past.

**Key Digital Touchpoints:**

### 1. Frictionless Onboarding
The tenant journey begins at the lease signing. Digital platforms allow for e-signatures, instant deposit logging, and automated welcome packets containing facility rules and emergency contacts. This sets a professional tone from day one.

### 2. Transparent Communication
Nobody likes being kept in the dark, especially regarding their living or working space. When facility issues arise—such as scheduled power generator maintenance or water pump repairs—property managers must communicate proactively. Atrium OS allows managers to blast notifications to all tenants in a specific property instantly, preventing the flood of angry phone calls.

### 3. Self-Serve Issue Resolution
Empowering tenants to log maintenance requests digitally, track their status, and view their payment history without needing to contact the manager reduces friction and builds trust. When tenants feel their issues are documented and addressed systematically, their satisfaction increases dramatically.

## Conclusion

Investing in a digital property management system is not just about making the manager's life easier; it is fundamentally about improving the product offered to the tenant. A superior tenant experience can contribute to higher lease renewal rates and more stable, long-term yields for property owners.
        `
    },
    {
        id: 'digital-property-agency',
        tag: 'PropTech',
        tagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        title: 'The Digital Property Agency: A Transformation Roadmap',
        summary: 'A strategic guide to digitizing a Nigerian property agency — covering the five stages of digital maturity, how to build a business case for technology investment, and a practical implementation framework that minimizes disruption to active operations.',
        readTime: '10 min read',
        content: `
## Introduction

Digital transformation in property management is not about replacing property managers — it is about eliminating the administrative burden that keeps managers from doing what only humans can do: exercise judgment, build relationships, and deliver exceptional tenant experiences.

This roadmap is designed for agency principals and operations managers who are evaluating or actively undertaking the digitization of their property management operations.

## Stage 1: Record Digitization

The starting point for most Nigerian agencies is the physical archive. Years of lease agreements, rent receipts, tenant correspondences, and inspection reports exist only on paper — inaccessible, ungovernable, and at perpetual risk of loss.

**Key activities:**
- High-resolution scanning of lease files with OCR (Optical Character Recognition)
- Naming convention standardization (Property → Unit → Tenant → Document Type)
- Digital file cabinet structure mirroring existing physical organization
- Secure cloud storage with access controls by role and property

**Success metric:** Active properties accessible digitally, with reduced reliance on paper for day-to-day management.

## Stage 2: Process Standardization

Before adding technology, standardize the processes technology will automate. This stage identifies the workflows that exist implicitly in your agency and makes them explicit.

**Key activities:**
- Map the tenant lifecycle from onboarding to move-out
- Define stage gates and required actions at each stage
- Build standard checklists for common property events (lease renewal, maintenance escalation, vacancy processing)
- Define billing trigger points and approval workflows

**Success metric:** Any team member can pick up any property and know exactly what stage each unit is at and what is required next.

## Stage 3: Property Management Platform

With standardized processes, a property management platform amplifies efficiency rather than creating confusion. At this stage, the agency migrates from ad-hoc tools (WhatsApp, Excel, physical ledgers) to a unified system.

**Key features to prioritize:**
- Property and tenant database
- Automated invoicing and rent tracking
- Maintenance request management with vendor assignment
- Financial reporting and owner statements

**Success metric:** Agency administration (rent collection, maintenance tracking, owner reporting) requires measurably less time than before.

## Stage 4: AI Augmentation

With data organized and processes structured, AI tools can now deliver meaningful value. At this stage, AI is applied to repetitive, high-volume tasks.

**Effective AI applications in property management:**
- Lease analysis — identifying non-standard clauses, missing provisions, risk flags
- Rent forecasting — predicting payment patterns and flagging potential defaults early
- Document generation — template-based creation of lease agreements, quit notices, and receipts
- Maintenance categorization — automatically classifying and prioritizing incoming requests

**What AI cannot replace:**
- Strategic property decisions
- Tenant relationship management
- Judgment in the face of complex disputes

**Success metric:** Managers can handle a larger portfolio without increasing working hours.

## Stage 5: Data and Intelligence

The final stage extracts business intelligence from the data now flowing through the agency's digital systems. This includes:

- Revenue and occupancy analytics by property type, location, and unit category
- Rent collection rate tracking (collected vs. expected as % of total)
- Maintenance cost monitoring and vendor performance benchmarking
- Tenant retention and turnover analysis

**Success metric:** Management decisions are driven by data, not intuition.

## Building the Business Case

The return on technology investment for property agencies can be quantified across three dimensions:

**Time savings:** Reducing time spent on administrative tasks can free up significant hours per week for portfolio growth and tenant engagement, depending on the agency's existing workflows.

**Error reduction:** Missed rent payments, lost documents, and reconciliation errors each carry direct financial and reputational costs that can be reduced with proper systems.

**Growth capacity:** Digitized, automated agencies can scale more easily without proportional increases in headcount, allowing smaller agencies to manage larger portfolios efficiently.

## Conclusion

The digital transformation of a property agency is a journey measured in years, not months. The agencies that begin now — methodically, stage by stage — are better positioned to build competitive advantages over those who delay. PracticePro Atrium is designed to support agencies at every stage of this journey.
        `
    }
];

const ATRIUM_COMPLIANCE_DOCS = [
    {
        icon: <ShieldCheckIcon className="w-6 h-6 text-indigo-600" />,
        title: 'NDPA & Tenancy Data Security',
        description: 'Comprehensive guide on how PracticePro Atrium protects sensitive tenant information, lease agreements, guarantors data, and financial records in strict compliance with the Nigerian Data Protection Act (NDPA) 2023.',
        badge: 'Security',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    {
        icon: <DocumentIcon className="w-6 h-6 text-amber-600" />,
        title: 'Tenancy Law Compliance Guide',
        description: 'An overview of statutory requirements for rent collection, quit notices, and tenancy agreements across all 36 Nigerian states and the FCT — each state has its own tenancy and recovery of premises law — and how Atrium helps maintain audit-ready records.',
        badge: 'Legal',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    }
];

const ATRIUM_GUIDES = [
    {
        id: 'atrium-getting-started',
        title: 'Getting Started with Atrium OS',
        description: 'A complete walkthrough to set up your property portfolio, add your first tenants, and configure automated billing structures.',
        tag: 'Beginner',
        readTime: '6 min read',
        content: `
## Welcome to PracticePro ATRIUM

Atrium is designed to be the central nervous system of your property management operations. This guide will walk you through the essential first steps to get your portfolio online.

### 1. Configure Your Portfolio

Your first task is to mirror your physical properties in the digital workspace.
- Navigate to the **Properties** tab.
- Click **Add Property**.
- **Define the Asset:** Is it a residential block, a commercial plaza, or a mixed-use facility?
- **Ownership Type:** Select whether this is an "Owned" property (your personal portfolio) or a "Managed" property (you are acting as an agent). This setting determines how Atrium calculates your management fees.
- **Generate Units:** Use the bulk unit generator to quickly create spaces (e.g., Apt 101, Apt 102).

### 2. Onboard Tenants

Once your physical spaces are mapped, it's time to bring in the occupants.
- Go to the specific Property, click the **Units** tab.
- For any vacant unit, click the hover menu and select **Add Tenant**.
- Input the tenant's primary contact details, emergency contacts, and upload the signed lease agreement.
- **Lease Terms:** Set the rent cycle (monthly, annually), the commencement date, and the expiration date. Atrium will automatically calculate when the next payment is due.

### 3. Automated Invoicing & Financials

The true power of Atrium lies in its financial automation.
- As leases approach their expiration or payment dates, Atrium will generate pending invoices.
- You can log payments directly against these invoices, which instantly updates the property's financial dashboard.
- For "Managed" properties, navigate to the **Financials** tab to view your automatically calculated Management Fees Earned, separating your revenue from the landlord's yield.

### Next Steps
Now that your core data is in the system, you can begin utilizing the Maintenance log and Messaging features to interact with your tenants and vendors.

**Pro-tip:** Use the Property Tags feature to categorize properties by type (e.g., *Residential*, *Commercial*, *Mixed-Use*) for easier portfolio filtering and reporting.
        `
    },
    {
        id: 'atrium-advanced-units',
        title: 'Advanced Unit Management',
        description: 'Learn how to utilize Atrium\'s context-aware unit hover menus to rapidly process receipts, log maintenance, and manage vacancies.',
        tag: 'Workflow',
        readTime: '4 min read',
        content: `
## Mastering the Units Tab

Atrium's Unit Management interface is designed for speed. Instead of navigating through multiple menus to perform routine tasks, everything is accessible directly from the property's floor plan view.

### Context-Aware Actions

When you hover over a unit in the **Units** tab of a Property Detail view, Atrium intelligently displays actions based on the unit's current status.

#### For Occupied Units:
- **Issue Receipt:** Instantly generate a payment receipt linked to the active tenant's ledger.
- **Log Maintenance:** Open a new facility request specifically tagged to that unit, allowing you to track plumbing, electrical, or structural issues over time.
- **End Lease:** Initiate the move-out process, which updates the unit's status back to vacant and archives the tenant record for your historical data.

#### For Vacant Units:
- **List Unit:** Flag the unit for marketing and track prospective viewings.
- **Record Viewing:** Keep a log of interested parties who have inspected the property.
- **Add Tenant:** Begin the onboarding flow when a new lease is signed, instantly transitioning the unit back to an occupied state.

By utilizing these hover actions, a property manager can execute their daily administrative tasks in a fraction of the time it would take using traditional software.
        `
    }
];


const WHITE_PAPERS = [
    {
        id: 'ai-framework',
        tag: 'AI & Ethics',
        tagColor: 'bg-purple-50 text-purple-700 border-purple-200',
        title: 'AI in Nigerian Legal Practice: A Framework for Responsible Adoption',
        summary: 'A practitioner\'s guide to deploying artificial intelligence tools in a law firm setting — covering ISO 42001 principles, data minimization, client confidentiality obligations, and the ethical boundaries that must govern AI use in legal work.',
        readTime: '12 min read',
        content: `
## Introduction

The integration of Artificial Intelligence (AI) into legal practice is no longer a distant prospect — it is a present reality. For Nigerian law firms navigating a rapidly evolving regulatory environment, the question is not whether to adopt AI, but how to do so responsibly, ethically, and in a manner that upholds the fiduciary duties owed to clients.

This white paper provides a structured framework for law firms considering or currently deploying AI tools, drawing on international standards including ISO/IEC 42001:2023 (Artificial Intelligence Management Systems) and the Nigerian Data Protection Act (NDPA) 2023.

## 1. The ISO 42001 Framework

ISO/IEC 42001 is the first international standard specifically designed for AI management systems. Its core principles require organizations to:

- **Establish accountability** — appoint an AI governance lead responsible for oversight of AI tools
- **Assess impact** — conduct AI impact assessments before deploying any system that processes personal or sensitive data
- **Ensure explainability** — maintain the ability to explain AI-generated outputs to clients and courts
- **Monitor performance** — continuously audit AI systems for accuracy, bias, and drift

For law firms, "explainability" is particularly critical. If ARIA® generates a legal research brief, the supervising lawyer must be able to articulate the reasoning independently — AI output is a starting point, not a conclusion.

## 2. Data Minimization in Legal AI

The NDPA 2023 enshrines the principle of data minimization: collect only what is necessary, process it only for stated purposes, and retain it only as long as required. AI tools that process client data must adhere to this principle rigorously.

**Practical implementation:**
- Anonymize client names in AI prompts where possible
- Use AI for structural analysis (clause identification, risk categorization) rather than wholesale data processing
- Ensure AI vendor contracts include Data Processing Agreements (DPAs) that restrict secondary use of your data

## 3. Client Confidentiality and Legal Professional Privilege

Legal Professional Privilege (LPP) protects communications between lawyers and their clients from compelled disclosure. The deployment of third-party AI tools introduces a potential vulnerability: if AI-processed data is stored on vendor servers, that data may fall outside the protective scope of LPP.

Law firms should insist on:
- **Zero-retention clauses** in AI vendor agreements — confirming that data submitted for processing is not stored
- **Jurisdiction-specific data residency** — ensuring client data does not transit through jurisdictions with conflicting legal obligations
- **Explicit informed consent** from clients whose data may be processed by AI tools

## 4. Ethical Boundaries

The Nigerian Bar Association's Rules of Professional Conduct place supervisory obligations on lawyers that cannot be delegated to machines. AI tools may assist with:
- Document review and summarization
- Legal research and precedent identification
- Drafting initial template-based documents

AI tools must not substitute for:
- Legal advice and judgment
- Court filings without review
- Client communication without supervision

## 5. PracticePro's Approach

PracticePro VEGA implements AI responsibly through:
- **Explicit consent capture** at onboarding — users must acknowledge AI processing before ARIA® is activated
- **Audit logging** of all AI-generated outputs, preserving accountability trails
- **No secondary data use** — client data submitted to ARIA® is processed in context and not used to train models
- **Human-in-the-loop design** — all AI suggestions require explicit lawyer confirmation before any action is taken

## Conclusion

Responsible AI adoption in legal practice requires deliberate governance, not just technical capability. By establishing clear policies, maintaining client trust, and adhering to international standards, Nigerian law firms can harness the efficiency benefits of AI without compromising their professional obligations.
        `
    },
    {
        id: 'ndpa-primer',
        tag: 'Data Privacy',
        tagColor: 'bg-blue-50 text-blue-700 border-blue-200',
        title: 'Data Privacy for Law Firms: The NDPA 2023 Compliance Primer',
        summary: 'A practical compliance guide tailored specifically for Nigerian law firms. Covers the obligations of data controllers under the NDPA 2023, client data handling best practices, breach notification procedures, and how to document an audit-ready compliance posture.',
        readTime: '15 min read',
        content: `
## Overview

The Nigerian Data Protection Act (NDPA) 2023 marked a watershed moment in Nigeria's data governance landscape, establishing the Nigeria Data Protection Commission (NDPC) as the primary regulatory authority. For law firms — entities that routinely handle significant volumes of sensitive personal data — compliance is not optional.

This primer provides a practical roadmap for law firms to assess and strengthen their NDPA compliance posture.

## 1. Are You a Data Controller?

Under the NDPA, a **Data Controller** is any person or entity that determines the purposes and means of processing personal data. If your firm:

- Maintains client records (names, addresses, identification documents)
- Processes financial information (bank details, payment data)
- Stores biometric data (signatures, photographs)
- Manages employee or staff records

...then your firm is a Data Controller and must register with the NDPC.

**Action required:** Submit a data controller registration via the NDPC portal at ndpc.gov.ng. Failure to register attracts significant penalties.

## 2. Key NDPA Obligations

### 2.1 Lawful Basis for Processing
Every data processing activity must have a defined lawful basis. For law firms, the relevant bases are typically:
- **Contractual necessity** — processing required to perform the legal services contract
- **Legal obligation** — compliance with court orders, regulatory requirements
- **Legitimate interests** — where firm interests do not override client rights

### 2.2 Data Subject Rights
Clients have enforceable rights including:
- **Right of Access** — to request copies of their personal data
- **Right to Rectification** — to correct inaccurate data
- **Right to Erasure** — to request deletion of their data upon engagement conclusion
- **Right to Portability** — to receive their data in a structured, machine-readable format

### 2.3 Retention Limits
The NDPA requires data to be deleted once the purpose for which it was collected has been fulfilled. Law firms should implement a formal retention schedule, for example:
- Active client files: retained for the duration of the matter plus 7 years
- Financial records: 7 years (Companies and Allied Matters Act requirement)
- Marketing records: retained only while consent is valid

## 3. Breach Notification

Under Section 40 of the NDPA, data breaches that are likely to adversely affect the rights and freedoms of data subjects must be reported to the NDPC **within 72 hours** of becoming aware of the breach.

**Breach response procedure:**
1. Identify and contain the breach
2. Assess likely impact on affected data subjects
3. Notify the NDPC within 72 hours
4. Notify affected data subjects "without undue delay" if risk is high
5. Document the breach fully in your internal breach register

## 4. Vendor Management

Data processors (third parties who process data on your behalf) must be governed by a **Data Processing Agreement (DPA)**. For a modern law firm, this includes:

| Vendor | Data Processed | DPA Required? |
|--------|---------------|---------------|
| Cloud storage provider | Client documents | Yes |
| Email service provider | Client correspondence | Yes |
| Practice management software | All firm data | Yes |
| Video conferencing tools | Meeting recordings | Yes |

## 5. PracticePro's Role

PracticePro acts as a **Data Processor** on behalf of your firm (the Data Controller). Our Data Processing Agreement:
- Restricts processing to documented purposes only
- Prohibits sub-processing without written authorization
- Commits to security standards (ISO 27001 alignment)
- Provides breach notification within 24 hours (ahead of the 72-hour NDPC requirement)
- Supports data subject rights requests through automated export tools

## Conclusion

NDPA compliance is an operational discipline, not a one-time project. Law firms that embed data protection into their day-to-day processes — supported by compliant technology — will be best positioned to withstand regulatory scrutiny and maintain client trust.
        `
    },
    {
        id: 'digital-roadmap',
        tag: 'Legal Tech',
        tagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        title: 'The Digital Law Firm: A Transformation Roadmap',
        summary: 'A strategic guide to digitizing a Nigerian law firm — covering the five stages of digital maturity, how to build a business case for technology investment, and a practical implementation framework that minimizes disruption to active practice.',
        readTime: '10 min read',
        content: `
## Introduction

Digital transformation in law is not about replacing lawyers — it is about eliminating the administrative burden that keeps lawyers from doing what only humans can do: exercise judgment, build relationships, and advocate for clients.

This roadmap is designed for managing partners and practice administrators who are evaluating or actively undertaking the digitization of their firm's operations.

## Stage 1: Document Digitization

The starting point for most Nigerian firms is the physical archive. Years of precedents, judgments, client correspondences, and filed documents exist only on paper — inaccessible, ungovernable, and at perpetual risk of loss.

**Key activities:**
- High-resolution scanning of case files with OCR (Optical Character Recognition)
- Naming convention standardization
- Digital file cabinet structure mirroring existing physical organization
- Secure cloud storage with access controls by role and matter

**Success metric:** Active matters accessible digitally, with reduced reliance on paper for day-to-day management.

## Stage 2: Process Standardization

Before adding technology, standardize the processes technology will automate. This stage identifies the workflows that exist implicitly in your firm and makes them explicit.

**Key activities:**
- Map the matter lifecycle from intake to file closure
- Define stage gates and required deliverables at each stage
- Build standard checklists for common matter types
- Define billing trigger points and approval workflows

**Success metric:** Any team member can pick up any matter and know exactly what stage it is at and what is required next.

## Stage 3: Practice Management Platform

With standardized processes, a practice management platform amplifies efficiency rather than creating confusion. At this stage, the firm migrates from ad-hoc tools (WhatsApp, Excel, physical diaries) to a unified system.

**Key features to prioritize:**
- Matters and contacts database
- Task and calendar management with court date integration
- Document management with version control
- Time tracking and invoicing

**Success metric:** Firm administration (diary management, invoicing, file retrieval) requires measurably less time than before.

## Stage 4: AI Augmentation

With data organized and processes structured, AI tools can now deliver meaningful value. At this stage, AI is applied to repetitive, high-volume cognitive tasks.

**Effective AI applications in legal practice:**
- Contract review — identifying non-standard clauses, missing provisions, risk flags
- Legal research — precedent identification, case law summarization
- Document drafting — template-based generation of standard instruments
- Dictation and note-taking — converting attorney voice notes into structured file entries

**What AI cannot replace:**
- Strategic legal advice
- Client relationship management
- Judgment in the face of novel circumstances

**Success metric:** Lawyers can produce more billable output without increasing working hours.

## Stage 5: Data and Intelligence

The final stage extracts business intelligence from the data now flowing through the firm's digital systems. This includes:

- Revenue and profitability analytics by matter type, client, and lawyer
- Utilization rate tracking (billable hours as % of total hours)
- Debtor aging and collections monitoring
- Matter outcome tracking (win rates by court, matter type, lawyer)

**Success metric:** Management decisions are driven by data, not intuition.

## Building the Business Case

The return on technology investment for law firms can be quantified across three dimensions:

**Time savings:** Reducing time spent on administrative tasks can free up significant hours per year for billable work, depending on the firm's existing workflows.

**Error reduction:** Missed deadlines, lost documents, and billing errors each carry direct financial and reputational costs that can be reduced with proper systems.

**Growth capacity:** Digitized, automated firms can scale more easily without proportional increases in headcount, allowing smaller firms to operate more efficiently.

## Conclusion

The digital transformation of a law firm is a journey measured in years, not months. The firms that begin now — methodically, stage by stage — are better positioned to build competitive advantages over those who delay. PracticePro is designed to support firms at every stage of this journey.
        `
    }
];

const COMPLIANCE_DOCS = [
    {
        icon: <ShieldCheckIcon className="w-6 h-6 text-indigo-600" />,
        title: 'ISO 27001 Alignment Statement',
        description: 'PracticePro VEGA is built against the ISO 27001:2022 information security framework. This document outlines our security controls across access management, incident response, encryption, and audit logging.',
        badge: 'Security',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    {
        icon: <DocumentIcon className="w-6 h-6 text-blue-600" />,
        title: 'NDPA 2023 Data Processing Statement',
        description: 'Our formal statement of data processing activities, lawful bases, retention schedules, and data subject rights procedures as required by the Nigeria Data Protection Act 2023.',
        badge: 'Compliance',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    },
];

const GUIDES = [
    {
        id: 'getting-started',
        title: 'Getting Started with PracticePro',
        description: 'Set up your firm workspace, invite team members, and create your first matter in a few simple steps.',
        tag: 'Beginner',
        readTime: '4 min read',
        content: `
## Welcome to PracticePro VEGA

This guide will walk you through setting up your firm's workspace in a few simple steps. By the end of this guide, you will be ready to manage matters, track time, and collaborate efficiently.

### 1. Configure Your Firm Profile
Your firm profile appears on invoices, reports, and client portal communications.
- Go to **Settings** > **Firm Settings**
- Upload your firm's letterhead logo
- Enter your registered firm name and physical address
- Set your primary jurisdiction (this influences ARIA's contextual awareness)

### 2. Invite Your Team
Invite your partners, associates, and support staff.
- Navigate to **Settings** > **Team Members**
- Click **Invite Member**
- Enter their email address and assign an appropriate role
- We recommend starting with a small pilot group before rolling out to the entire firm.

### 3. Creating Your First Matter
A "Matter" is the central hub for any case or transaction.
- From the Dashboard, click **New Matter**
- Assign a clear title (e.g., "Adeola v. Apex Corporation")
- Add the client
- For dispute matters, enter the Suit Number and Opposing Counsel if known.

**Pro-tip:** Use the Matter Tags feature to categorize cases by practice area (e.g., *Litigation*, *Real Estate*, *Corporate*).
        `
    },
    {
        id: 'aloa-best-practices',
        title: 'ARIA® AI Copilot — Best Practices',
        description: 'How to prompt ARIA effectively, interpret its outputs, and maintain professional responsibility when using AI assistance.',
        tag: 'AI',
        readTime: '6 min read',
        content: `
## Working with ARIA®

ARIA is your dedicated Legal AI Copilot, designed for legal reasoning tasks. Getting the best results from ARIA requires effective prompting.

### Principles of Good Prompting
The way you ask a question determines the quality of the answer. Use the "Context + Task + Format" framework:

- **Context:** Provide the background. *"We act for a landlord with a property in Lagos who wishes to evict a commercial tenant for non-payment of rent for 6 months."* (Replace "Lagos" with the state where your property is located — ARIA applies the tenancy law of that state.)
- **Task:** State exactly what you need. *"Draft a 7-day statutory notice of owner's intention to recover premises."*
- **Format:** Specify how you want it delivered. *"Format this as a formal legal letter with placeholders for names."*

### What ARIA Does Best
- **Document Summarization:** Upload a 50-page judgment or contract and ask for key findings, obligations, or risks.
- **First Drafts:** Generate routine correspondence, NDAs, and standard motions.
- **Clause Analysis:** Compare multiple variations of an indemnity clause to find the most favorable one.

### Professional Responsibility
ARIA is an assistant, not a lawyer.
- **Always Verify:** AI can hallucinate citations. If ARIA cites a case (e.g., *Savannah Bank v. Ajilo*), verify it yourself.
- **Protect Client Confidentiality:** While PracticePro keeps your data isolated, you should still avoid entering unnecessary sensitive client information into conversational prompts if it isn't required for the task.
        `
    },
    {
        id: 'billing-setup',
        title: 'Billing & Invoicing Setup Guide',
        description: 'Configure your billing rates, connect your bank account, and generate your first NDPA-compliant invoice.',
        tag: 'Finance',
        readTime: '5 min read',
        content: `
## Setting Up Financial Workflows

PracticePro VEGA includes robust timekeeping and invoicing tools tailored to Nigerian billing practices.

### 1. Setting Hourly Rates
You can set default rates per role and override them per member or per matter.
- Go to **Settings** > **Billing & Financials**
- Set the default rates for Partners, Senior Associates, and Associates.
- These rates will auto-populate when time entries are logged.

### 2. Time Tracking
Time entries are the foundation of your billing.
- Log time manually directly within a Matter's "Time & Expenses" tab.
- Every entry needs a clear narrative description (e.g., *“Review of opposing counsel's statement of claim”*).

### 3. Generating Invoices
When it’s time to bill a client:
1. Navigate to the Matter and open the **Billing** tab.
2. Click **Generate Invoice**.
3. Select the unbilled time entries and expenses you wish to include.
4. Apply any discounts or fixed fees.
5. PracticePro automatically calculates VAT (currently 7.5% in Nigeria by default) and applies it to the total.
        `
    },
    {
        id: 'team-permissions',
        title: 'Team Permissions & Role Management',
        description: 'Understanding the role hierarchy, setting matter-level access controls, and managing associate visibility.',
        tag: 'Admin',
        readTime: '3 min read',
        content: `
## Role-Based Access Control (RBAC)

PracticePro VEGA uses a strict permission hierarchy to ensure sensitive client information is only accessible to authorized personnel.

### The Role Hierarchy
There are three fundamental tiers of access in PracticePro:

| Role Level | Visibility | Best For |
|------------|------------|----------|
| **Workspace Admin** | Full access to all Firm Settings, Billing data, and all Matters across the firm. | Managing Partners, IT Admins |
| **Partner** | Can view and edit all Matters, but cannot alter core Firm Settings. | Partners, Senior Associates |
| **Associate** | Can only view Matters they are explicitly assigned to. Restricted from deleting files. | Associates, Paralegals, Support Staff |

### Confidential Matters
Not all matters should be visible to everyone, even among Partners.
When creating a matter, you can toggle its visibility to **"Private"**. Private matters are only visible to the creator and explicitly invited team members.

### Ethical Walls
In scenarios requiring an ethical wall (e.g., a conflict of interest waiver), you can use the exclusionary permissions available on the Matter's settings page to explicitly block specific users from searching or accessing the matter, superseding their global role permissions.
        `
    },
];

// ─── MARKDOWN RENDERER ───────────────────────────────────────────────────────

type Block =
    | { type: 'h2'; text: string }
    | { type: 'h3'; text: string }
    | { type: 'bullets'; items: string[] }
    | { type: 'numbered'; items: string[] }
    | { type: 'table'; rows: string[][] }
    | { type: 'paragraph'; text: string }
    | { type: 'spacer' };

function parseContent(raw: string): Block[] {
    const lines = raw.split('\n');
    const blocks: Block[] = [];
    let i = 0;

    const applyInline = (text: string) =>
        text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    while (i < lines.length) {
        const line = lines[i];

        if (line.startsWith('## ')) {
            blocks.push({ type: 'h2', text: line.slice(3).trim() });
            i++; continue;
        }
        if (line.startsWith('### ')) {
            blocks.push({ type: 'h3', text: line.slice(4).trim() });
            i++; continue;
        }
        // Table block — collect all consecutive | lines
        if (line.startsWith('|')) {
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].startsWith('|')) {
                tableLines.push(lines[i]);
                i++;
            }
            // Filter separator rows and parse cells
            const rows = tableLines
                .filter(l => !l.replace(/[\|\-\:\s]/g, '').trim() === false
                    && !/^[\|\-\:\s]+$/.test(l))
                .map(l =>
                    l.split('|')
                        .map(c => c.trim())
                        .filter((_, ci, arr) => ci > 0 && ci < arr.length - 1)
                );
            if (rows.length > 0) blocks.push({ type: 'table', rows });
            continue;
        }
        // Bullet list block
        if (line.startsWith('- ')) {
            const items: string[] = [];
            while (i < lines.length && lines[i].startsWith('- ')) {
                items.push(applyInline(lines[i].slice(2).trim()));
                i++;
            }
            blocks.push({ type: 'bullets', items });
            continue;
        }
        // Numbered list block
        if (/^\d+\.\s/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
                items.push(applyInline(lines[i].replace(/^\d+\.\s/, '').trim()));
                i++;
            }
            blocks.push({ type: 'numbered', items });
            continue;
        }
        if (line.trim() === '') {
            blocks.push({ type: 'spacer' });
            i++; continue;
        }
        blocks.push({ type: 'paragraph', text: applyInline(line.trim()) });
        i++;
    }
    return blocks;
}

function renderBlocks(blocks: Block[]) {
    return blocks.map((block, i) => {
        switch (block.type) {
            case 'h2':
                return <h2 key={i} className="text-lg font-bold text-slate-900 mt-8 mb-3 pb-2 border-b border-slate-100">{block.text}</h2>;
            case 'h3':
                return <h3 key={i} className="text-base font-semibold text-slate-800 mt-5 mb-2">{block.text}</h3>;
            case 'bullets':
                return (
                    <ul key={i} className="mb-4 space-y-1.5 list-disc list-inside">
                        {block.items.map((item, j) => (
                            <li key={j} className="text-sm text-slate-600 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: sanitize(item) }} />
                        ))}
                    </ul>
                );
            case 'numbered':
                return (
                    <ol key={i} className="mb-4 space-y-1.5 list-decimal list-inside">
                        {block.items.map((item, j) => (
                            <li key={j} className="text-sm text-slate-600 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: sanitize(item) }} />
                        ))}
                    </ol>
                );
            case 'table':
                return (
                    <div key={i} className="my-5 rounded-lg overflow-hidden border border-slate-200">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-100">
                                    {block.rows[0]?.map((cell, j) => (
                                        <th key={j} className="px-4 py-2.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wide border-b border-slate-200">
                                            {cell}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {block.rows.slice(1).map((row, j) => (
                                    <tr key={j} className={j % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                        {row.map((cell, k) => (
                                            <td key={k} className="px-4 py-2.5 text-slate-600 border-b border-slate-100 last:border-b-0">
                                                {k === row.length - 1 && (cell === 'Yes' || cell === 'No') ? (
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider ${cell === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                        {cell}
                                                    </span>
                                                ) : cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            case 'paragraph':
                return <p key={i} className="text-sm text-slate-600 leading-relaxed mb-3"
                    dangerouslySetInnerHTML={{ __html: sanitize(block.text) }} />;
            case 'spacer':
                return <div key={i} className="my-1" />;
            default:
                return null;
        }
    });
}

// ─── WHITE PAPER CARD ────────────────────────────────────────────────────────

const WhitePaperCard: React.FC<{ paper: typeof WHITE_PAPERS[0], activeProduct: 'vega' | 'atrium' }> = ({ paper, activeProduct }) => {
    const [expanded, setExpanded] = useState(false);

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`
            <html><head><title>${paper.title}</title>
            <style>
                body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; color: #1a202c; line-height: 1.8; }
                h1 { font-size: 28px; margin-bottom: 8px; }
                h2 { font-size: 20px; margin-top: 32px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
                h3 { font-size: 16px; }
                p { margin-bottom: 16px; }
                ul { margin-bottom: 16px; padding-left: 20px; }
                ol { margin-bottom: 16px; padding-left: 20px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th { background: #f7fafc; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
                th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; font-size: 14px; }
                .meta { color: #718096; font-size: 14px; margin-bottom: 32px; }
                @media print { body { margin: 0; } }
            </style></head>
            <body>
                <h1>${paper.title}</h1>
                <p class="meta">PracticePro ${activeProduct === 'vega' ? 'VEGA · Legal Tech Research' : 'ATRIUM · PropTech Research'} · ${paper.readTime}</p>
                ${paper.content
                    .replace(/## (.*)/g, '<h2>$1</h2>')
                    .replace(/### (.*)/g, '<h3>$1</h3>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\n- (.*)/g, '<li>$1</li>')
                    .replace(/\n\n/g, '</p><p>')
                    .replace(/^/, '<p>').replace(/$/, '</p>')}
            </body></html>`);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    };

    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300">
            <div className="p-7">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-2xs font-bold uppercase tracking-widest border ${paper.tagColor}`}>
                        {paper.tag}
                    </span>
                    <span className="text-xs text-slate-400 whitespace-nowrap">{paper.readTime}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-3 leading-snug">{paper.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{paper.summary}</p>
            </div>

            <div className="px-7 pb-6 flex gap-3">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex-1 py-2.5 rounded-lg font-semibold text-sm bg-slate-900 text-white hover:opacity-90 transition-all"
                >
                    {expanded ? 'Collapse' : 'Read Paper'}
                </button>
                <button
                    onClick={handlePrint}
                    className="py-2.5 px-4 rounded-lg font-semibold text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2"
                    title="Print or save as PDF"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    PDF
                </button>
            </div>

            {expanded && (
                <div className="border-t border-slate-100 px-7 py-6">
                    {renderBlocks(parseContent(paper.content))}
                </div>
            )}
        </div>
    );
};


const GuideCard: React.FC<{ guide: typeof GUIDES[0] }> = ({ guide }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className={`bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col ${expanded && 'md:col-span-2'}`}>
            <div className="p-6 flex-1 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 uppercase tracking-wider">{guide.tag}</span>
                    <span className="text-xs text-slate-400 whitespace-nowrap">{guide.readTime}</span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm">{guide.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-[280px] sm:max-w-none">{guide.description}</p>
            </div>

            <div className="px-6 pb-5 flex gap-3">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex-1 py-2 rounded-lg font-semibold text-xs border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all text-center"
                >
                    {expanded ? 'Hide Guide' : 'Read Guide'}
                </button>
            </div>

            {expanded && (
                <div className="border-t border-slate-100 px-6 py-5">
                    {renderBlocks(parseContent(guide.content))}
                </div>
            )}
        </div>
    );
};

// ─── WHAT'S NEW DATA (product-tagged) ──────────────────────────────────────
interface WhatsNewEntry {
    version: string;
    date: string;
    title: string;
    products: ('vega' | 'atrium' | 'komplete')[];
    category: 'feature' | 'improvement' | 'fix' | 'security';
    items: { label: string; body: string; badge?: string }[];
}

const WHATS_NEW_ENTRIES: WhatsNewEntry[] = [
    {
        version: 'v2.4.0',
        date: 'August 2026',
        title: 'AI Capabilities + Pricing Overhaul + ICM Migration',
        products: ['vega', 'atrium'],
        category: 'feature',
        items: [
            { label: 'Product-Specific AI Section', body: 'AI Capabilities now shows ALOA (legal drafting, PII Shield, firm-grade security) for Vega and ARIA (revenue intelligence, tenant data protection, portfolio security) for Atrium — no more generic copy.', badge: 'Both' },
            { label: 'Atrium Monthly Billing', body: 'Atrium now supports monthly billing (was annual-only). Starter N49K/mo, Growth N96.5K/mo, Pro N200K/mo. 20% premium over annual.' },
            { label: 'Komplete Fixed', body: 'Price set at ₦2.5M/yr with unlimited seats. All add-ons included (Sentry Pass, storage, dedicated AM). Positioned at 19% premium over Atrium Pro alone.' },
            { label: 'Core Naming Collision Fixed', body: 'Vega "Core" renamed to "Free". Atrium "Core" renamed to "Starter". No more confusion between free and paid tiers.' },
            { label: 'WhatsApp Limit Increased', body: 'Atrium Starter WhatsApp quota increased from 100 to 250 messages/month.' },
            { label: '30-Day Money-Back Guarantee', body: 'All annual plans now include a 30-day money-back guarantee. Displayed on pricing section.' },
            { label: 'ICM Migration', body: 'All 5 primary AI prompts now sourced from markdown files via Vite ?raw imports. Editable without code deploys.' },
        ],
    },
    {
        version: 'v2.3.0',
        date: 'August 2026',
        title: 'Landing Page Redesign + Mobile Nav + New Sections',
        products: ['vega', 'atrium'],
        category: 'feature',
        items: [
            { label: 'Mobile Hamburger Menu', body: 'Full-screen overlay menu for mobile users (was missing entirely). Products, Features, Pricing, How It Works, Resources, Contact, Log In, Start Free Trial.' },
            { label: 'Mobile Sticky CTA Bar', body: 'Fixed bottom bar with "Talk to Sales" + "Start Free Trial" buttons on mobile.' },
            { label: 'WhatsApp FAB', body: 'Floating WhatsApp action button for instant chat.' },
            { label: 'AI Capabilities Section', body: 'Dark section with 3 columns: AI Copilot, PII Shield, Workspace Isolation.' },
            { label: 'How It Works Section', body: '3-step guide with product-specific content (Vega: Matter Ingestion Wizard + DraftPro; Atrium: property setup + rent collection).' },
            { label: 'Testimonials + FAQ + Final CTA', body: '3 new sections added: testimonials carousel, FAQ accordion, final CTA band.' },
            { label: 'JSON-LD Structured Data', body: 'SoftwareApplication + FAQPage schema added to index.html for SEO.' },
            { label: 'Skip-to-Content Link', body: 'Accessibility: skip-to-content link + id="main-content" on main element.' },
        ],
    },
    {
        version: 'v2.2.0',
        date: 'August 2026',
        title: 'Security Hardening + Idempotency + Soft Delete',
        products: ['vega', 'atrium', 'komplete'],
        category: 'security',
        items: [
            { label: 'Impersonation Token Fix', body: 'Replaced unsigned ?impersonate=email URL param with server-verified, short-lived, single-use tokens. Founder-only creation via createImpersonationToken mutation.' },
            { label: 'API Key Security', body: 'Gemini API key no longer stored in localStorage. Held in-memory only, cleared on logout.' },
            { label: 'Push Notification Auth', body: 'markNotificationRead + markAllNotificationsRead now verify caller ownership before patching.' },
            { label: 'Portal Auth Hardening', body: '4 critical portals.ts mutations now require requireFirmUser + cross-firm ownership verification.' },
            { label: 'Idempotency Keys', body: '5 critical tables (tasks, payment_proofs, termsAcceptance, subscriptionRequests, subscriptionAddons) now support idempotencyKey dedup.' },
            { label: 'Identity Guardrail Split-Brain Fix', body: 'Eliminated dual identity guardrail systems. Single source of truth via constants/identityGuardrails.ts.' },
        ],
    },
    {
        version: 'v2.1.0',
        date: 'August 2026',
        title: 'Proactive Intelligence Engine + Conversation Memory',
        products: ['vega', 'atrium'],
        category: 'feature',
        items: [
            { label: 'AI Morning Briefing', body: 'Daily AI-generated briefing per firm: stalled matters, upcoming deadlines, revenue at risk, recent anomalies. Delivered as ARIA chat message at 6:15 AM UTC.' },
            { label: 'Deadline Scanner', body: 'Scans tasks, events, and service charges for overdue/upcoming deadlines every 6 hours. Creates proactive_insights records.' },
            { label: 'Anomaly Detector', body: 'Daily detection of stalled matters (30d), unassigned matters, high defaulter ratios, unread messages.' },
            { label: 'Cross-Session Memory', body: 'AI conversations are summarized nightly and injected into new sessions for continuity.' },
        ],
    },
    {
        version: 'v2.0.0',
        date: 'July 2026',
        title: 'Court Date Reminders + Paystack-Ready Billing',
        products: ['vega'],
        category: 'feature',
        items: [
            { label: 'Court Date Reminders', body: 'Automated WhatsApp reminders sent 7, 3, and 1 day(s) before each scheduled hearing to assigned lawyers.', badge: 'Pro' },
            { label: 'Paystack-Ready Billing', body: 'Payment provider abstraction layer built and code-reviewed. Dormant until activated.' },
            { label: 'Monthly WhatsApp Quota Reset', body: 'Fixed bug where monthly message limits were effectively lifetime caps.' },
            { label: 'Trust Model Fix', body: 'Clients can no longer auto-mark invoices as "Paid" from the portal.' },
        ],
    },
    {
        version: 'v1.9.0',
        date: 'July 2026',
        title: 'Landing Page Redesign + SCE Calculator',
        products: ['atrium'],
        category: 'improvement',
        items: [
            { label: 'New Brand System', body: 'Warm Paper background, Space Grotesk display type, duotone brand-tinted hero imagery.' },
            { label: 'SCE Calculator', body: 'Property managers can model portfolio (units + average rent) and see per-tenant SCE for each tier.' },
            { label: 'Image Cycling', body: 'Hero images auto-rotate through 3 photos per product with crossfade transitions.' },
        ],
    },
    {
        version: 'v1.8.0',
        date: 'July 2026',
        title: 'Automated Retainer Billing + Billing Monitor',
        products: ['vega'],
        category: 'feature',
        items: [
            { label: 'Retainer Billing Engine', body: 'Weekly/Monthly/Quarterly/Bi-Annually/Annually billing frequency. Auto-stages draft invoices via cron.' },
            { label: 'Billing Monitor Dashboard', body: 'KPI cards (Staged/Queued/Sent/Failed), filter tabs, lawyer override controls (Approve & Send, Pause, Skip, Retry).' },
            { label: 'Premium Gating', body: 'Defense-in-depth: client-side useFeatures + server-side isFirmPremiumRetainerEligible.' },
        ],
    },
    {
        version: 'v1.7.0',
        date: 'June 2026',
        title: 'Sentry Pass (VMS) + Role-Based ToS',
        products: ['atrium'],
        category: 'feature',
        items: [
            { label: 'Sentry Pass VMS', body: 'Visitor management with 6-digit codes, QR passes, gatekeeper terminal, offline fallback. 30-day free trial, then N15K/mo add-on.' },
            { label: 'Role-Based ToS', body: 'Per-role terms version tracking. Only affected roles see re-acceptance prompts when their version bumps.' },
            { label: 'Deactivated Member State', body: 'Soft-deactivation with audit trail. Deactivated users cannot log in but their historical contributions remain attributed.' },
        ],
    },
    {
        version: 'v1.5.0',
        date: 'Earlier 2026',
        title: 'PracticePro Systems Limited + Product Foundation',
        products: ['vega', 'atrium', 'komplete'],
        category: 'feature',
        items: [
            { label: 'Parent Company', body: 'Renamed to PracticePro Systems Limited.' },
            { label: 'Product-Aware Architecture', body: 'Full Komplete (unified) product support across documents, contacts, compose, messages, calendar, and portal settings.' },
            { label: 'DraftPro Editor', body: 'A4 pagination, Nigerian legal fonts, placeholder guardrails, print-to-PDF.' },
            { label: 'ALOA AI Copilot', body: 'Legal intelligence for matter research, case summaries, and precedent analysis.' },
            { label: 'NDPA 2023 Compliance', body: 'Privacy Policy, Data Processing Agreement, Cookie Policy, and DPO appointment.' },
        ],
    },
];

// ─── WHAT'S NEW FILTER + ENTRY COMPONENTS ──────────────────────────────────
const WhatsNewFilter: React.FC<{
    selectedFilter: 'all' | 'vega' | 'atrium' | 'komplete';
    setSelectedFilter: (f: 'all' | 'vega' | 'atrium' | 'komplete') => void;
}> = ({ selectedFilter, setSelectedFilter }) => {
    const filters: { key: 'all' | 'vega' | 'atrium' | 'komplete'; label: string; color: string }[] = [
        { key: 'all', label: 'All', color: 'bg-slate-900 text-white' },
        { key: 'vega', label: 'Vega', color: 'bg-amber-500 text-white' },
        { key: 'atrium', label: 'Atrium', color: 'bg-emerald-500 text-white' },
        { key: 'komplete', label: 'Komplete', color: 'bg-violet-500 text-white' },
    ];
    return (
        <div className="flex gap-2 mb-6">
            {filters.map(f => (
                <button
                    key={f.key}
                    onClick={() => setSelectedFilter(f.key)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        selectedFilter === f.key
                            ? f.color
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                >
                    {f.label}
                </button>
            ))}
        </div>
    );
};

const WhatsNewEntry: React.FC<{ entry: WhatsNewEntry }> = ({ entry }) => {
    const categoryColors: Record<string, string> = {
        feature: 'bg-emerald-100 text-emerald-700',
        improvement: 'bg-blue-100 text-blue-700',
        fix: 'bg-amber-100 text-amber-700',
        security: 'bg-rose-100 text-rose-700',
    };
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900 text-base">{entry.title}</h3>
                        <span className="text-2xs font-mono text-slate-400">{entry.version}</span>
                    </div>
                    <span className="text-xs text-slate-400">{entry.date}</span>
                </div>
                <div className="flex items-center gap-2">
                    {entry.products.map(p => (
                        <span key={p} className={`text-2xs font-bold uppercase px-1.5 py-0.5 rounded ${
                            p === 'vega' ? 'bg-amber-100 text-amber-600' :
                            p === 'atrium' ? 'bg-emerald-100 text-emerald-600' :
                            'bg-violet-100 text-violet-600'
                        }`}>{p}</span>
                    ))}
                    <span className={`px-2 py-1 text-2xs font-bold uppercase rounded-full ${categoryColors[entry.category]}`}>{entry.category}</span>
                </div>
            </div>
            <ul className="space-y-2 text-sm text-slate-600">
                {entry.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                        <span className="text-primary-500 mt-0.5">•</span>
                        <span>
                            <strong className="text-slate-800">{item.label}</strong> — {item.body}
                            {item.badge && <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-primary-100 text-primary-600 font-bold">{item.badge}</span>}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────

const ResourcesPage: React.FC<ResourcesPageProps> = ({ onBack, onPrivacyClick, onTermsClick, onCookieClick, onDPAClick, onStartTrial, onContactSales, onUsageClick, onPortalTermsClick, activeProduct, setActiveProduct }) => {
    const isVega = activeProduct === 'vega';
    const [whatsNewFilter, setWhatsNewFilter] = useState<'all' | 'vega' | 'atrium' | 'komplete'>(activeProduct);
    const [activeTab, setActiveTab] = useState<'whatsnew' | 'papers' | 'guides' | 'compliance' | 'legal'>('whatsnew');
    const [showBackToTop, setShowBackToTop] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const filteredWhatsNew = whatsNewFilter === 'all'
        ? WHATS_NEW_ENTRIES
        : WHATS_NEW_ENTRIES.filter(e => e.products.includes(whatsNewFilter as any));
    const productBadge = isVega
        ? 'bg-amber-100 text-amber-700'
        : 'bg-emerald-100 text-emerald-700';

    const tabs = [
        { key: 'whatsnew' as const, label: "What's New" },
        { key: 'papers' as const, label: 'White Papers' },
        { key: 'guides' as const, label: 'Guides' },
        { key: 'compliance' as const, label: 'Security' },
        { key: 'legal' as const, label: 'Legal' },
    ];

    const handleScroll = () => {
        if (scrollRef.current) setShowBackToTop(scrollRef.current.scrollTop > 400);
    };
    const scrollToTop = () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

    return (
        <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-[100dvh] overflow-y-auto bg-slate-50 text-slate-900 font-sans"
            style={{ colorScheme: 'light' }}
            data-resources-root
        >
            {/* Header — sticky at the very top */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center gap-3 sm:gap-4">
                    <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors shrink-0">
                        <ArrowLeftIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Back</span>
                    </button>
                    <div className="h-4 w-px bg-slate-200 shrink-0" />
                    <div className="flex items-center gap-2 min-w-0">
                        <Logo className="h-5 w-5 text-primary-600 shrink-0" />
                        <span className="font-bold text-slate-900 truncate">PracticePro</span>
                        <span className="text-slate-400 shrink-0">/</span>
                        <span className="text-slate-600 font-medium flex items-center min-w-0">
                            <span className="truncate">Resources</span>
                            <span className={`text-2xs ml-2 px-1.5 py-0.5 rounded font-bold tracking-wider shrink-0 ${productBadge}`}>
                                {isVega ? 'VEGA' : 'ATRIUM'}
                            </span>
                        </span>
                    </div>
                </div>
                {/* Sticky tab bar — sits below the header so users can switch
                    tabs without scrolling back to the top. Previously the tab
                    bar was part of the scrolling content, which made navigation
                    awkward on long pages (e.g. the White Papers list). */}
                <div className="border-t border-slate-100 bg-white/80 backdrop-blur-sm">
                    <div className="container mx-auto px-4 sm:px-6">
                        <div className="flex gap-1 overflow-x-auto no-scrollbar" role="tablist">
                            {tabs.map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => { setActiveTab(tab.key); scrollToTop(); }}
                                    role="tab"
                                    aria-selected={activeTab === tab.key}
                                    className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                                        activeTab === tab.key
                                            ? `${isVega ? 'border-amber-500 text-amber-600' : 'border-emerald-500 text-emerald-600'}`
                                            : 'border-transparent text-slate-500 hover:text-slate-900'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 sm:px-6 py-10 sm:py-16 max-w-5xl">

                {/* Page Hero — reduced top padding on mobile; toggle wraps below on small screens */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-10 sm:mb-12">
                    <div className="min-w-0">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-bold uppercase tracking-widest border bg-primary-50 text-primary-700 border-primary-200 mb-4">
                            <SparklesIcon className="w-3 h-3" />
                            Knowledge Base
                        </span>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-3">Resources & Documentation</h1>
                        <p className="text-base sm:text-lg text-slate-500 max-w-2xl leading-relaxed">
                            {isVega
                                ? 'Research papers, compliance documentation, and product guides to help your firm get the most from PracticePro — and stay ahead of regulatory requirements.'
                                : 'PropTech research, compliance documentation, and product guides to help you scale your property management operations.'}
                        </p>
                    </div>
                    {/* Product toggle — full-width on mobile, auto-width on desktop */}
                    {setActiveProduct && (
                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0 self-start w-full sm:w-auto">
                            <button
                                onClick={() => setActiveProduct('vega')}
                                className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-sm font-bold transition-all ${isVega ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Law Firms
                            </button>
                            <button
                                onClick={() => setActiveProduct('atrium')}
                                className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-sm font-bold transition-all ${!isVega ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Property Managers
                            </button>
                        </div>
                    )}
                </div>

                {/* (Tab bar is now sticky in the header — no longer rendered here) */}

                {/* What's New — with product filter */}
                {activeTab === 'whatsnew' && (
                <section className="mb-16">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">
                                What's New
                                <span className={`ml-2 text-2xs px-1.5 py-0.5 rounded font-bold ${productBadge}`}>{isVega ? 'VEGA' : 'ATRIUM'}</span>
                            </h2>
                            <p className="text-sm text-slate-500">Latest updates and major feature releases</p>
                        </div>
                    </div>

                    {/* Product filter buttons */}
                    <WhatsNewFilter selectedFilter={whatsNewFilter} setSelectedFilter={setWhatsNewFilter} />

                    <div className="space-y-6">
                        {filteredWhatsNew.map((entry, idx) => (
                            <WhatsNewEntry key={idx} entry={entry} />
                        ))}
                        {filteredWhatsNew.length === 0 && (
                            <div className="text-center py-12 text-slate-400 text-sm">
                                No updates for this product yet.
                            </div>
                        )}
                    </div>
                </section>
                )}

                {/* White Papers */}
                {activeTab === 'papers' && (
                <section className="mb-16">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                            <DocumentIcon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">
                                White Papers
                                <span className={`ml-2 text-2xs px-1.5 py-0.5 rounded font-bold ${productBadge}`}>{isVega ? 'VEGA' : 'ATRIUM'}</span>
                            </h2>
                            <p className="text-sm text-slate-500">{isVega ? 'Original research on legal technology, compliance, and practice management' : 'Original research on property technology, compliance, and agency management'}</p>
                        </div>
                    </div>
                    <div className="grid md:grid-cols-1 gap-5">
                        {(isVega ? WHITE_PAPERS : ATRIUM_WHITE_PAPERS).map(paper => <WhitePaperCard key={paper.id} paper={paper} activeProduct={activeProduct} />)}
                    </div>
                </section>
                )}

                {/* Compliance & Security */}
                {activeTab === 'compliance' && (
                <section className="mb-16">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                            <ShieldCheckIcon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">
                                Security & Compliance
                                <span className={`ml-2 text-2xs px-1.5 py-0.5 rounded font-bold ${productBadge}`}>{isVega ? 'VEGA' : 'ATRIUM'}</span>
                            </h2>
                            <p className="text-sm text-slate-500">Our formal compliance posture and security documentation</p>
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        {(isVega ? COMPLIANCE_DOCS : ATRIUM_COMPLIANCE_DOCS).map((doc, i) => (
                            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 flex gap-4">
                                <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                                    {doc.icon}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`text-2xs font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${doc.badgeColor}`}>{doc.badge}</span>
                                    </div>
                                    <h3 className="font-bold text-slate-900 text-sm mb-1">{doc.title}</h3>
                                    <p className="text-xs text-slate-500 leading-relaxed">{doc.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
                )}

                {/* Product Guides */}
                {activeTab === 'guides' && (
                <section className="mb-16">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                            <SparklesIcon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">
                                Product Guides
                                <span className={`ml-2 text-2xs px-1.5 py-0.5 rounded font-bold ${productBadge}`}>{isVega ? 'VEGA' : 'ATRIUM'}</span>
                            </h2>
                            <p className="text-sm text-slate-500">Step-by-step guides for getting the most from PracticePro</p>
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 items-start">
                        {(isVega ? GUIDES : ATRIUM_GUIDES).map((guide, i) => (
                            <GuideCard key={i} guide={guide} />
                        ))}
                    </div>
                </section>
                )}

                {/* Legal Notices — redesigned as cards for visual consistency
                    with the White Papers, Guides, and Compliance tabs. Previously
                    this tab showed four plain buttons in a row, which felt sparse
                    and inconsistent with the rest of the page. */}
                {activeTab === 'legal' && (
                <section className="mb-16">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">
                                Legal Notices
                                <span className={`ml-2 text-2xs px-1.5 py-0.5 rounded font-bold ${productBadge}`}>{isVega ? 'VEGA' : 'ATRIUM'}</span>
                            </h2>
                            <p className="text-sm text-slate-500">Governing documents for your use of PracticePro {isVega ? 'VEGA' : 'ATRIUM'}</p>
                        </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                        {/* Privacy Policy */}
                        <button
                            onClick={onPrivacyClick}
                            className="text-left bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-slate-300 transition-all duration-300 group"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <h3 className="font-bold text-slate-900 text-sm">Privacy Policy</h3>
                                        <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">How we collect, use, and protect your personal data under the NDPA 2023.</p>
                                </div>
                            </div>
                        </button>
                        {/* Terms of Service */}
                        <button
                            onClick={onTermsClick}
                            className="text-left bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-slate-300 transition-all duration-300 group"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <h3 className="font-bold text-slate-900 text-sm">Terms of Service</h3>
                                        <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">The rules and conditions that govern your use of the platform.</p>
                                </div>
                            </div>
                        </button>
                        {/* Cookie Policy */}
                        <button
                            onClick={onCookieClick}
                            className="text-left bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-slate-300 transition-all duration-300 group"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <h3 className="font-bold text-slate-900 text-sm">Cookie Policy</h3>
                                        <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">What cookies we use, why, and how to control them — in plain English.</p>
                                </div>
                            </div>
                        </button>
                        {/* Data Processing Agreement */}
                        <button
                            onClick={onDPAClick}
                            className="text-left bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-slate-300 transition-all duration-300 group"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <h3 className="font-bold text-slate-900 text-sm">Data Processing Agreement</h3>
                                        <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">How we process and safeguard personal data on your behalf.</p>
                                </div>
                            </div>
                        </button>
                        {/* Usage Policy (optional — only render if handler provided) */}
                        {onUsageClick && (
                            <button
                                onClick={onUsageClick}
                                className="text-left bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-slate-300 transition-all duration-300 group"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <h3 className="font-bold text-slate-900 text-sm">Usage Policy</h3>
                                            <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        </div>
                                        <p className="text-xs text-slate-500 leading-relaxed">Acceptable use rules — what you can and can't do on the platform.</p>
                                    </div>
                                </div>
                            </button>
                        )}
                        {/* Portal Terms of Use (optional — only render if handler provided) */}
                        {onPortalTermsClick && (
                            <button
                                onClick={onPortalTermsClick}
                                className="text-left bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-slate-300 transition-all duration-300 group"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <h3 className="font-bold text-slate-900 text-sm">Portal Terms of Use</h3>
                                            <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        </div>
                                        <p className="text-xs text-slate-500 leading-relaxed">Terms for {isVega ? 'clients' : 'residents'} using the {isVega ? 'Client' : "Residents'"} Portal.</p>
                                    </div>
                                </div>
                            </button>
                        )}
                    </div>
                </section>
                )}

                {/* CTA Footer — fixed: previously both buttons called `onBack`,
                    which would route users backward in browser history (often
                    back to the LandingPage, but unpredictable for deep-link
                    visitors). Now uses dedicated `onStartTrial` and
                    `onContactSales` callbacks wired in App.tsx, with a safe
                    fallback to `onBack` if the callbacks aren't provided. */}
                <div className="mt-12 mb-8 p-8 sm:p-10 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 text-center">
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Ready to get started?</h3>
                    <p className="text-slate-300 text-sm mb-6 max-w-md mx-auto">
                        {isVega ? 'Start your 30-day free trial of PracticePro Vega today. No credit card required.' : 'Start your 30-day free trial of PracticePro Atrium today. No credit card required.'}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={() => (onStartTrial || onBack)()}
                            className="px-6 py-3 rounded-xl bg-white text-slate-900 text-sm font-bold hover:bg-slate-100 transition-colors shadow-lg"
                        >
                            Start Free Trial
                        </button>
                        <button
                            onClick={() => (onContactSales || onBack)()}
                            className="px-6 py-3 rounded-xl border border-slate-600 text-white text-sm font-bold hover:bg-white/10 transition-colors"
                        >
                            Talk to Sales
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-slate-400">
                    © {new Date().getFullYear()} PracticePro Systems Ltd. Lagos, Nigeria.
                </p>
            </div>

            {/* Back to Top Button */}
            {showBackToTop && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-6 right-6 z-30 w-12 h-12 rounded-full bg-slate-900 text-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
                    aria-label="Back to top"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                </button>
            )}
        </div>
    );
};

export default ResourcesPage;
