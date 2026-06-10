# Procedural Intelligence Specification

## 1. Core System Architecture (The "Option A" Blueprint)

### 🧠 Core Objective
Build a rules-driven, context-aware legal operating system that:
- Understands procedural law
- Dynamically adapts documents, workflows, and requirements
- Prevents legal errors
- Guides lawyers like a senior associate

**System Philosophy:** "A procedural lawyer embedded inside the software" (Not a simple form-filling or task-tracking app).

### 1.1 Procedural Intelligence Engine (PIE) — THE CORE
This is the decision-making brain.
- **Responsibilities:** Interpret legal context, apply court rules, determine required steps, trigger document + workflow logic.
- **Inputs:** Legal Action (e.g., Writ, Motion), Jurisdiction (e.g., Lagos High Court, FHC), Case Facts (claim type, parties, etc.)
- **Outputs:** Required filings, Deadlines, Procedural path, Compliance warnings.

### 1.2 Legal Rules Engine
Encodes procedural law in a structured format (JSON/Rule-based system).
*Example Rule Formats:*
```json
{
  "action": "writ_of_summons",
  "court": "lagos_high_court",
  "requirements": [
    "statement_of_claim",
    "list_of_witnesses",
    "witness_statements_on_oath",
    "list_of_documents"
  ],
  "timeline": {
    "statement_of_claim": "7_days"
  },
  "conditions": [
    {
      "if": "claim_type == liquidated_sum",
      "then": "suggest_undefended_list"
    }
  ]
}
```

### 1.3 Context Engine
Tracks and maintains real-time legal context to feed the PIE.
- **Must Track:** Case type, Action type, Jurisdiction, Stage, Party role.

### 1.4 Document Intelligence Engine
Dynamic, condition-based document assembly.
- **Must Support:** Clause-level logic, auto-insertion/removal of sections, jurisdiction-specific formatting.
*Example:*
```json
{
  "clause": "breach_of_contract",
  "conditions": ["contract_exists == true"]
}
```

### 1.5 Workflow & Timeline Engine
Automatically generates tasks, filing sequences, and deadlines based on law.
*Example:*
```json
{
  "event": "writ_filed",
  "triggers": [
    "generate_statement_of_claim",
    "start_7_day_timer"
  ]
}
```

### 1.6 Compliance & Error Detection Engine (Enterprise Feature)
Detects errors before they happen.
- **Must Detect:** Missing mandatory filings, incorrect procedure, wrong jurisdiction, limitation issues, invalid sequencing.

### 1.7 Strategic Suggestion Engine (Advanced)
Provides legal strategy insights (e.g., suggesting "Summary Judgment" or "Originating Summons" vs. "Writ").

---

## 2. Nigerian Civil Procedure Rule Engine v1 (The "Option B" Blueprint)
**Coverage:** Lagos High Court, Federal High Court, National Industrial Court (NICN).

### 2.1 Originating Processes
#### A. Writ of Summons
* **Lagos High Court:** Requires Statement of Claim, List of Witnesses, Witness Statements on Oath, List of Documents, Pre-Action Protocol (Form 01).
  * *Deadline:* Statement of Claim 7 days after Writ.
  * *Compliance Check:* Missing pre-action protocol, missing witness statements, wrong case type.
* **Federal High Court:** Requires Statement of Claim, Witness Statements, Documents.
  * *Deadline:* Statement of Defence 30 days after service.

#### B. Originating Summons
* **Conditions:** No substantial dispute of facts.
* **Requirements:** Affidavit, Written Address, Exhibits.
* **Compliance Check:** Dispute of facts detected.
* **Strategic Flag:** Suggest Writ if facts are disputed.

#### C. Undefended List (Lagos)
* **Conditions:** Claim type = Liquidated sum, no defense expected.
* **Requirements:** Affidavit of Debt, Written Address.
* **Compliance Check:** Warn if claim is not liquidated.
* **Outcome:** Summary judgment if no notice of intention to defend.

### 2.2 Motion Practice Engine
* **Motion on Notice:** Requires Motion Paper, Supporting Affidavit, Written Address, Exhibits. (Compliance Checks: Missing Affidavit, Missing Written Address).
* **Ex Parte Motion:** Requires Affidavit, Urgency grounds, Written Address. (Constraint: Temporary orders only - next step is convert to Motion on Notice).

### 2.3 Defence & Response Engine
* **Statement of Defence:** 
  * *Deadlines:* 42 days (Lagos), 30 days (FHC).
  * *Requirements:* Defence, Witness Statements, Documents.
* **Reply to Defence:** Optional filing suggested if new issues are raised.

### 2.4 Pre-Trial / Case Management & Trial
* **Pre-Trial:** Requires Case management conference and scheduling order.
* **Trial:** Sequence is Claimant Case -> Cross Examination -> Defendant Case -> Final Addresses.

### 2.5 Judgment & Enforcement Engine
* **Enforcement Methods:** Writ of FiFa, Garnishee Proceedings, Judgment Summons.

### 2.6 Compliance & Risk Engine Core Checks
* **Limitation Law Check:** Input cause of action date -> Warning if expired/statute-barred.
* **Jurisdiction Check:** Input subject matter/territorial scope -> Invalid court warning.
* **Procedural Validity:** Wrong originating process, missing mandatory documents, incorrect sequence.

---

## 3. High-Income Practice Area Modules (The "Option C" Blueprint)

### 3.1 Commercial Litigation Module (FLAGSHIP)
* **Target:** Senior litigators, dispute resolution teams, high-volume debt recovery.
* **Debt Recovery Intelligence System:**
  * Auto-detect claim type (Liquidated -> Undefended List, Disputed -> Writ).
  * Auto-generate full workflow and filings (Demand letter, pre-action, affidavit of debt).
  * Enforcement intelligence (Suggest Garnishee vs FiFa).
* **Contract Dispute Engine:** Identify breach type/remedies and auto-generate pleadings with clause-level linking to case law.
* **Litigation Strategy Layer:** Suggest Summary Judgment or Jurisdiction Challenges based on defense weakness.

### 3.2 Banking & Finance Module
* **Target:** Bank legal teams, recovery lawyers.
* **Loan Recovery Engine:** Default detection logic, auto-generate demand notices, recall letters, enforcement filings (Mortgages, Charges).
* **Garnishee Automation System:** Identify debtor banks, generate Order Nisi/Absolute. Strategically target Tier 1 banks.
* **Risk & Compliance Alerts:** Warn about defective loan agreements or unenforceable clauses.

### 3.3 Oil & Gas / Energy Module
* **Target:** Energy lawyers, in-house counsel, regulatory teams.
* **Regulatory Compliance Engine:** Track DPR/NUPRC compliance, licenses, penalties.
* **Contract & JV Dispute Engine:** Handle Joint Venture and Production Sharing Contract disputes (dispute pathways, arbitration triggers).
* **High-Stakes Risk Detection:** Flag regulatory breaches and penalty exposures.

### 3.4 Corporate Law Module
* **Target:** Corporate lawyers, company secretaries.
* **Corporate Filings Engine:** Resolutions, director changes, shareholding (Future: CAC Integration).
* **Board Resolution Generator:** Standard and context-based clauses.
* **Compliance Tracker:** Annual filings and statutory obligations.

### 3.5 Cross-Module "Super Features"
* **Financial Impact Engine:** Show potential recovery vs cost/benefit.
* **Opponent Analysis Layer:** Track opposing counsel patterns/history.
* **Case Outcome Prediction:** Fact/Procedure/Pattern base prediction.

---

## Implementation Strategy & User Flow Shift
**Action-Based Intake UI:** 
*DO NOT* start with "Practice Area". The intake wizard MUST start with **Legal Action Selection** (e.g., Commence Action - Originating Summons). Then **Jurisdiction Selection** (e.g., Lagos High Court). Then **Contextual Questions** dynamically loaded based on the first two choices.

**Development Priorities:**
1. Commercial Litigation (Highest volume, immediate ROI).
2. Banking & Finance.
3. Establish the base Rules & Procedural Intelligence engine JSON schema in the codebase.
