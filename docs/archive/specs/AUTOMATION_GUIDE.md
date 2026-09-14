
# PracticePro Automation Guide

PracticePro enables firms to standardize operations using "If This, Then That" rules. Automations run locally and sync to the cloud, ensuring important steps are never missed.

## Automation Logic
Automations are configured in **Settings > Practice Configuration > Automation**.

**Structure:**
`TRIGGER` -> `CONDITION` -> `ACTION`

---

## 1. Case Management Automations

### A. The "New Case" Protocol
*   **Trigger:** New Matter Created.
*   **Condition:** Matter Type = "Civil Litigation".
*   **Action:** Create Task -> "File Memorandum of Appearance".
*   **Details:**
    *   **Priority:** High.
    *   **Due Date:** +7 Days from creation.
    *   **Assignee:** Creator.

### B. Stage Transition: Discovery
*   **Trigger:** Matter Stage moves to "Discovery/Frontloading".
*   **Action:** Create Task -> "Collate Client Documents & Evidence".
*   **Details:**
    *   **Priority:** Medium.
    *   **Checklist:** "Review bank statements", "Scan photos", "Interview witnesses".

### C. Stage Transition: Judgment
*   **Trigger:** Matter Stage moves to "Judgment Delivered".
*   **Action:** Create Task -> "Obtain Certified True Copy (CTC) of Judgment".
*   **Details:**
    *   **Priority:** High.
    *   **Due Date:** +2 Days.

---

## 2. Court & Calendar Automations

### A. Hearing Prep
*   **Trigger:** New Event Created (Type = "Court Hearing").
*   **Action:** Create Task -> "Prepare Case File & Robes".
*   **Details:**
    *   **Due Date:** -1 Day (Day before hearing).
    *   **Description:** "Ensure all processes are printed and bound."

### B. Filing Deadline Calculation (AI Powered)
*   **Trigger:** Event Created (Type = "Service of Process").
*   **Action:** Create Task -> "[FILING DEADLINE] File Defence".
*   **Details:**
    *   **Logic:** The system calculates the deadline based on Rules of Court (e.g., 42 days for Lagos High Court) and sets the task due date automatically.

---

## 3. Financial Automations

### A. Invoice Follow-Up
*   **Trigger:** Invoice Status changes to "Overdue".
*   **Action:** Create Task -> "Call Client for Payment".
*   **Details:**
    *   **Priority:** High.
    *   **Assignee:** Firm Admin.

### B. Scale Fee Check
*   **Trigger:** New Matter Created (Type = "Real Estate").
*   **Action:** Create Task -> "Calculate Scale Fees (Order 2023)".
*   **Details:**
    *   **Description:** "Ensure billing complies with Legal Practitioners Remuneration Order."

---

## 4. Client Intake Automations

### A. Lead Activation
*   **Trigger:** Lead Status changes to "Activated".
*   **Action:** Create Matter.
*   **Details:** Automatically converts the Lead's data (Name, Phone, Narratives) into a new Matter file and links the Contact.

### B. Intake Review
*   **Trigger:** New Lead Submitted (via Public Form).
*   **Action:** Create Task -> "Review New Client Intake".
*   **Details:**
    *   **Priority:** High.
    *   **Due Date:** Today.
