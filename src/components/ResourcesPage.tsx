
import React, { useState } from 'react';
import { Logo, DocumentIcon, ShieldCheckIcon, SparklesIcon, ArrowLeftIcon } from '../constants';
import { sanitize } from '../utils/sanitization';

interface ResourcesPageProps {
    onBack: () => void;
    onPrivacyClick: () => void;
    onTermsClick: () => void;
    onDPAClick?: () => void;
    activeProduct: 'vega' | 'atrium';
    setActiveProduct?: (p: 'vega' | 'atrium') => void;
}

// ─── DATA ────────────────────────────────────────────────────────────────────

const ATRIUM_WHITE_PAPERS = [
    {
        id: 'proptech-adoption',
        tag: 'PropTech',
        tagColor: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        title: 'Digital Transformation in Nigerian Real Estate Management',
        summary: 'A comprehensive guide on transitioning from manual property management to automated systems. Discusses rent tracking, maintenance workflows, tenant communication, and scaling property portfolios across multiple states in Nigeria.',
        readTime: '10 min read',
        content: `
## Introduction

The real estate management sector in Nigeria is undergoing a much-needed digital transformation. For decades, property managers have relied on fragmented systems—manual ledgers, disconnected Excel spreadsheets, fragmented WhatsApp groups, and paper receipts. While these methods may suffice for a portfolio of three to five properties, they become catastrophic liabilities as portfolios scale.

Today's Nigerian property manager is not just collecting rent; they are managing facility maintenance lifecycles, ensuring regulatory compliance with state tenancy laws (like the Lagos State Tenancy Law 2011), handling complex vendor relationships, and providing transparent financial reporting to absentee landlords or corporate investors.

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
        tagColor: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
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
    }
];

const ATRIUM_COMPLIANCE_DOCS = [
    {
        icon: <ShieldCheckIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />,
        title: 'NDPA & Tenancy Data Security',
        description: 'Comprehensive guide on how PracticePro Atrium protects sensitive tenant information, lease agreements, guarantors data, and financial records in strict compliance with the Nigerian Data Protection Act (NDPA) 2023.',
        badge: 'Security',
        badgeColor: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    },
    {
        icon: <DocumentIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />,
        title: 'Tenancy Law Compliance Guide',
        description: 'An overview of statutory requirements for rent collection, quit notices, and tenancy agreements across major Nigerian jurisdictions, and how Atrium helps maintain audit-ready records.',
        badge: 'Legal',
        badgeColor: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
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
- **Ownership Type:** Crucially, select whether this is an "Owned" property (your personal portfolio) or a "Managed" property (you are acting as an agent). This setting dynamically adjusts how Atrium calculates your management fees.
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
        tagColor: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
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
        tagColor: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
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
        tagColor: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
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
        icon: <ShieldCheckIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />,
        title: 'ISO 27001 Alignment Statement',
        description: 'PracticePro VEGA is built against the ISO 27001:2022 information security framework. This document outlines our security controls across access management, incident response, encryption, and audit logging.',
        badge: 'Security',
        badgeColor: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    },
    {
        icon: <DocumentIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
        title: 'NDPA 2023 Data Processing Statement',
        description: 'Our formal statement of data processing activities, lawful bases, retention schedules, and data subject rights procedures as required by the Nigeria Data Protection Act 2023.',
        badge: 'Compliance',
        badgeColor: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
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

- **Context:** Provide the background. *"We act for a landlord in Lagos who wishes to evict a commercial tenant for non-payment of rent for 6 months."*
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
                return <h2 key={i} className="text-lg font-bold text-slate-900 dark:text-white mt-8 mb-3 pb-2 border-b border-slate-100 dark:border-white/5">{block.text}</h2>;
            case 'h3':
                return <h3 key={i} className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-5 mb-2">{block.text}</h3>;
            case 'bullets':
                return (
                    <ul key={i} className="mb-4 space-y-1.5 list-disc list-inside">
                        {block.items.map((item, j) => (
                            <li key={j} className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: sanitize(item) }} />
                        ))}
                    </ul>
                );
            case 'numbered':
                return (
                    <ol key={i} className="mb-4 space-y-1.5 list-decimal list-inside">
                        {block.items.map((item, j) => (
                            <li key={j} className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: sanitize(item) }} />
                        ))}
                    </ol>
                );
            case 'table':
                return (
                    <div key={i} className="my-5 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-100 dark:bg-slate-800">
                                    {block.rows[0]?.map((cell, j) => (
                                        <th key={j} className="px-4 py-2.5 text-left text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide border-b border-slate-200 dark:border-white/10">
                                            {cell}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {block.rows.slice(1).map((row, j) => (
                                    <tr key={j} className={j % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/50'}>
                                        {row.map((cell, k) => (
                                            <td key={k} className="px-4 py-2.5 text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-white/5 last:border-b-0">
                                                {k === row.length - 1 && (cell === 'Yes' || cell === 'No') ? (
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${cell === 'Yes' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
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
                return <p key={i} className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3"
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.06] rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300">
            <div className="p-7">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${paper.tagColor}`}>
                        {paper.tag}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">{paper.readTime}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 leading-snug">{paper.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{paper.summary}</p>
            </div>

            <div className="px-7 pb-6 flex gap-3">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-all"
                >
                    {expanded ? 'Collapse' : 'Read Paper'}
                </button>
                <button
                    onClick={handlePrint}
                    className="py-2.5 px-4 rounded-xl font-semibold text-sm border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all flex items-center gap-2"
                    title="Print or save as PDF"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    PDF
                </button>
            </div>

            {expanded && (
                <div className="border-t border-slate-100 dark:border-white/5 px-7 py-6">
                    {renderBlocks(parseContent(paper.content))}
                </div>
            )}
        </div>
    );
};


const GuideCard: React.FC<{ guide: typeof GUIDES[0] }> = ({ guide }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.06] rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col ${expanded && 'md:col-span-2'}`}>
            <div className="p-6 flex-1 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 uppercase tracking-wider">{guide.tag}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">{guide.readTime}</span>
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">{guide.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-[280px] sm:max-w-none">{guide.description}</p>
            </div>

            <div className="px-6 pb-5 flex gap-3">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex-1 py-2 rounded-xl font-semibold text-xs border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-center"
                >
                    {expanded ? 'Hide Guide' : 'Read Guide'}
                </button>
            </div>

            {expanded && (
                <div className="border-t border-slate-100 dark:border-white/5 px-6 py-5">
                    {renderBlocks(parseContent(guide.content))}
                </div>
            )}
        </div>
    );
};

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────

const ResourcesPage: React.FC<ResourcesPageProps> = ({ onBack, onPrivacyClick, onTermsClick, onDPAClick, activeProduct, setActiveProduct }) => {
    const isVega = activeProduct === 'vega';
    return (
        <div className="h-screen overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/[0.06] sticky top-0 z-10">
                <div className="container mx-auto px-6 h-16 flex items-center gap-4">
                    <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <ArrowLeftIcon className="w-4 h-4" />
                        Back
                    </button>
                    <div className="h-4 w-px bg-slate-200 dark:bg-white/10" />
                    <div className="flex items-center gap-2">
                        <Logo className="h-5 w-5 text-primary-600" />
                        <span className="font-bold text-slate-900 dark:text-white">PracticePro</span>
                        <span className="text-slate-400 dark:text-slate-500">/</span>
                        <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center">
                            Resources
                            <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10 font-bold bg-slate-100 dark:bg-white/5 text-slate-500 tracking-wider">
                                {isVega ? 'VEGA' : 'ATRIUM'}
                            </span>
                        </span>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-6 py-16 max-w-5xl">

                {/* Page Hero */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-16">
                    <div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest border bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800/50 mb-5">
                            <SparklesIcon className="w-3 h-3" />
                            Knowledge Base
                        </span>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white mb-4">Resources & Documentation</h1>
                        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                            {isVega 
                                ? 'Research papers, compliance documentation, and product guides to help your firm get the most from PracticePro — and stay ahead of regulatory requirements.' 
                                : 'PropTech research, compliance documentation, and product guides to help you scale your property management operations.'}
                        </p>
                    </div>
                    {/* Toggle */}
                    {setActiveProduct && (
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-white/10 shrink-0 self-start">
                            <button 
                                onClick={() => setActiveProduct('vega')} 
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isVega ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600 dark:text-primary-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                Law Firms
                            </button>
                            <button 
                                onClick={() => setActiveProduct('atrium')} 
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!isVega ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                Property Managers
                            </button>
                        </div>
                    )}
                </div>

                {/* White Papers */}
                <section className="mb-16">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center">
                            <DocumentIcon className="w-4 h-4 text-white dark:text-slate-900" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">White Papers</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Original research on legal technology, compliance, and practice management</p>
                        </div>
                    </div>
                    <div className="grid md:grid-cols-1 gap-5">
                        {(isVega ? WHITE_PAPERS : ATRIUM_WHITE_PAPERS).map(paper => <WhitePaperCard key={paper.id} paper={paper} activeProduct={activeProduct} />)}
                    </div>
                </section>

                {/* Compliance & Security */}
                <section className="mb-16">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                            <ShieldCheckIcon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Security & Compliance</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Our formal compliance posture and security documentation</p>
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        {(isVega ? COMPLIANCE_DOCS : ATRIUM_COMPLIANCE_DOCS).map((doc, i) => (
                            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6 flex gap-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center flex-shrink-0">
                                    {doc.icon}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${doc.badgeColor}`}>{doc.badge}</span>
                                    </div>
                                    <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{doc.title}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{doc.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Product Guides */}
                <section className="mb-16">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                            <SparklesIcon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Product Guides</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Step-by-step guides for getting the most from PracticePro</p>
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 items-start">
                        {(isVega ? GUIDES : ATRIUM_GUIDES).map((guide, i) => (
                            <GuideCard key={i} guide={guide} />
                        ))}
                    </div>
                </section>

                {/* Legal Notices */}
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.06] rounded-2xl p-8">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Legal Notices</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Governing documents for your use of PracticePro {isVega ? 'VEGA' : 'ATRIUM'}</p>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={onPrivacyClick}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                            Privacy Policy
                        </button>
                        <button
                            onClick={onTermsClick}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                            Terms of Service
                        </button>
                        <div className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 cursor-default">
                            Cookie Policy <span className="text-[10px] ml-1 font-bold uppercase text-slate-300 dark:text-slate-600">Soon</span>
                        </div>
                        <button onClick={onDPAClick} className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            Data Processing Agreement
                        </button>
                    </div>
                </section>

                {/* Footer note */}
                <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-12">
                    © {new Date().getFullYear()} PracticePro Legal Tech Ltd. Lagos, Nigeria.
                </p>
            </div>
        </div>
    );
};

export default ResourcesPage;
