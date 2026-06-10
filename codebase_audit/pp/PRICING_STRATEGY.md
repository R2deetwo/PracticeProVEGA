
# PracticePro Pricing Strategy (Nigerian Edition)

> ⚠️ **SUPERSEDED** — This document was the original pricing strategy. The **canonical source of truth
> is now `src/constants/tiers.ts`**. All UI components, backend mutations, and entitlement gates
> must read from `tiers.ts`. The per-user pricing model described below has been replaced with
> **flat per-plan pricing**. This document is retained for historical reference only.

## Philosophy: "Seat-Based B2B SaaS"
PracticePro operates on a **Business-to-Business (B2B)** model. The "Customer" is the Law Firm, not the individual lawyer.

### The Golden Rule of Tiers & Joining
*   **The Firm pays for the Seats.**
*   **Users inherit the Tier of the Firm they are currently in.**
*   **A "Free" User can join a "Pro" Firm.** When they log into that firm's workspace, they get Pro features (paid for by the firm's subscription).

---

## Tier Breakdown

### 1. Core Plan (Solo Practitioner)
**Target:** Independent Lawyers, Freelance Solicitors.
**Price:** ₦15,000 / month (1 User Limit).

*   **Structure:** Single-player mode.
*   **Storage:** **5GB Max** (Strict limit).
*   **Features:**
    *   Unlimited Matters & Contacts.
    *   Invoicing & Receipts.
    *   Nigerian Law Reports (Read-Only).
*   **Restriction:** Cannot invite other users. Cannot use ALOA (AI).

### 2. Pro Plan (Growth)
**Target:** Small to Mid-sized Chambers (2-10 Lawyers).
**Price:** ₦45,000 / user / month.

*   **Structure:** Multi-player mode.
*   **Storage:** 20GB / User.
*   **Features:**
    *   **Team Collaboration:** Invite Associates & Paralegals.
    *   **ALOA® AI Assistant:** Drafting, Research, Summaries.
    *   **Workflow Automation:** Triggers for Task creation and Event scheduling.
    *   **Shared Calendar:** Firm-wide docketing.
*   **Joining Logic:** A Solo user can be invited to a Pro firm. They do not pay; the Firm pays for their seat.

### 3. Ultimate Plan (Scale)
**Target:** Established Firms, SANs, Partnerships.
**Price:** ₦80,000 / user / month.

*   **Structure:** Advanced Multi-player.
*   **Storage:** **50GB** shared storage per user.
*   **Unique Value Proposition:**
    *   **Dual-Firm Membership:** Users can belong to **up to 2 firms** (e.g., a Partner who runs a private consultancy alongside the main firm) and switch between them.
    *   **Business Intelligence:** Advanced Reporting (Revenue Velocity, Lawyer Utilization).
    *   **Priority Support:** Dedicated account manager.

### 4. Enterprise (Custom)
**Target:** Top-Tier Firms (e.g., Aluko & Oyebode, Banwo & Ighodalo).
**Price:** Custom Quote.

*   **Features:**
    *   **Unlimited Storage.**
    *   **Multi-Firm Architecture:** Support for complex LLP arrangements and Special Purpose Vehicles (SPVs). No limit on firm memberships.
    *   **Audit Logs:** Detailed security tracking.
    *   **On-Premise Deployment:** Option for local data residency.

---

## Scenario Examples

### Scenario A: The Solo Joiner
*   **User:** Tunde (Fresh Law School Grad).
*   **Current Status:** Has a free/Core account for his personal notes.
*   **Action:** He gets hired by "Adebayo & Co" (Pro Plan).
*   **Process:**
    1.  Adebayo Admin sends Invite Code.
    2.  Tunde enters code.
    3.  Tunde's dashboard switches to "Adebayo & Co".
    4.  Tunde now has AI features and sees the firm's cases.
    5.  **Billing:** Adebayo & Co is billed for +1 seat. Tunde pays nothing.

### Scenario B: The Consultant (Ultimate Feature)
*   **User:** Barrister Okon (SAN).
*   **Status:** Consults for two different firms ("Firm A" and "Firm B").
*   **Need:** Needs to switch between them instantly without losing his drafts or local settings.
*   **Requirement:** Barrister Okon needs an **Ultimate** license to enable the "Persistent Workspace Switcher" for up to 2 workspaces.

### Scenario C: The Downgrade
*   **Firm:** "Unity Legal" (3 Lawyers).
*   **Action:** They stop paying for Pro and downgrade to Core.
*   **Result:**
    1.  The system locks out the 2 junior lawyers.
    2.  Only the Admin remains active.
    3.  AI features are disabled.
    4.  Data is *preserved* but read-only for the locked users until they renew.
