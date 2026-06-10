
# PracticePro (Nigeria Edition) v6.1

**The AI-Powered Operating System for Modern Nigerian Law Firms.**

PracticePro is a comprehensive Legal Practice Management System (LPMS) engineered specifically for the Nigerian legal jurisdiction. It combines case management, billing, and document drafting with **ALOA®**, a suite of autonomous AI agents designed to ensure compliance with local laws (NDPA, RPC) and procedural rules.

---

## 🚀 Key Features

### 1. Smart Matter Management
*   **Jurisdiction Intelligence:** Automatically suggests the appropriate court (Federal High Court vs. State High Court) based on the matter type and Nigerian Constitutional principles (Section 251, 1999 Constitution).
*   **Workflow Automation:** Kanban-style boards with customizable stages for Civil Litigation, Corporate Secretarial, and Real Estate workflows.
*   **External Access:** Securely invite Co-Counsel or Watching Briefs to view specific matters without exposing firm-wide data.

### 2. DraftPro™ Editor
A purpose-built legal word processor integrated directly into the browser.
*   **Context-Aware:** Automatically pulls Client Name, Suit Number, and Court details into templates.
*   **Magic Rewrite:** Uses AI to rewrite casual text into formal legalese.
*   **Letterhead Engine:** Overlays the firm's official letterhead on documents for accurate PDF previews and printing.

### 3. Nigerian Financial Engine
*   **Scale Fees Calculator:** Built-in calculator for **Scale I** (Sales/Mortgages) and **Scale II** (Leases) based on the *Legal Practitioners (Remuneration for Legal Documentation and Other Land Matters) Order 2023*.
*   **Tax Compliance:** Automatically handles VAT (7.5%) and Withholding Tax (5/10%) logic.
*   **Trust Accounting:** Separates Client Funds from Office Accounts with specific "Trust Deposit" request flows.

### 4. Research Studio
*   **Law Reports Terminal:** A searchable database of Nigerian case law (Supreme Court, Court of Appeal) with AI-generated ratios and summaries.
*   **Vector Notebooks:** Upload case files (PDF/Word) to a private notebook. Ask questions like *"What is the date of the offer letter?"* to extract specific facts across thousands of pages.

### 5. Client Portal & Intake
*   **Secure Intake:** Public-facing forms where prospective clients can record voice notes or upload documents.
*   **Client Dashboard:** Clients can log in to view case status, pay invoices via gateway simulation, and upload requested documents.

---

## 🤖 ALOA® AI Workforce

PracticePro utilizes a multi-agent AI architecture powered by Google Gemini 2.5 Flash & 3 Pro.

| Agent Name | Function | Trigger |
| :--- | :--- | :--- |
| **Jurisdiction Scout** | Analyzes facts to determine venue jurisdiction. | Matter Creation |
| **RPC Guardian** | Reviews summaries for ethical compliance (Rule 1.4, 5.1). | Document Analysis |
| **Privacy Shield** | Scans docs for Nigerian PII (NIN, BVN) and suggests redaction. | Document Upload |
| **Court Rules Agent** | Calculates filing deadlines based on Civil Procedure Rules. | Event Scheduling |
| **Billing Auditor** | Flags invoices that fall below the mandatory Remuneration Order scale. | Invoice Creation |

---

## 🛠 Technical Stack

*   **Frontend:** React 18, TypeScript, Tailwind CSS
*   **Build Tool:** Vite
*   **State Management:** React Context API (Local-First Architecture)
*   **AI Engine:** `@google/genai` (Gemini 2.5 Flash / 3 Pro)
*   **Icons:** Heroicons
*   **PDF Generation:** jsPDF + autoTable

---

## 📂 Project Structure

```
/
├── components/          # React UI Components
│   ├── aloa/            # AI Chat & Visualization Interface
│   ├── auth/            # Login & Signup flows
│   ├── client/          # External Client Portal views
│   ├── dashboard/       # KPI Widgets
│   ├── details/         # Detailed views for Matters, Contacts, Docs
│   ├── documents/       # DraftPro Editor & Ribbon
│   ├── forms/           # Modal Forms (Matter, Task, Invoice)
│   ├── modals/          # Modal Manager & Layouts
│   ├── reports/         # Financial & Compliance Reporting
│   ├── research/        # Law Reports & Notebooks
│   ├── settings/        # Firm Configuration & Admin
│   └── toolkit/         # Reusable UI primitives (Buttons, Inputs)
├── contexts/            # Global State (Auth, Data, UI, ALOA)
├── services/            # API Wrappers (Gemini, Report Generator)
├── utils/               # Helpers (Formatting, Date Logic, Tax Calc)
└── types.ts             # TypeScript Definitions
```

---

## ⚡ Getting Started

1.  **Install Dependencies:** `npm install`
2.  **Configure Environment:** Set `GEMINI_API_KEY` in `metadata.json` or environment variables.
3.  **Run Development Server:** `npm run dev`
4.  **Simulate Data:** Click the "Toolkit" icon in the header and select "Load Standard Data" to populate the app with demo Nigerian legal content.

---

&copy; 2024 PracticePro Legal Tech Ltd.
