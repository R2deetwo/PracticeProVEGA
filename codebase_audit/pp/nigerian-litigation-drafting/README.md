# Nigerian Litigation Drafting Skill
## Professional Legal Document Drafting for PracticePro VEGA

---

## Overview

This skill enables Claude to draft **authoritative, procedurally accurate Nigerian litigation documents** with maximum context extraction and perfect integration with the PracticePro VEGA editor.

### What This Skill Does

✅ Drafts all major Nigerian litigation documents:
- Statements of Claim
- Statements of Defence
- Replies
- Affidavits (all types)
- Motions on Notice
- Ex-Parte Applications
- Originating Summons
- Originating Motions (Fundamental Rights, Judicial Review)
- Written Addresses
- Notices

✅ **Maximizes context extraction** from:
- Conversation history
- Uploaded documents (PDFs, Word docs, images)
- Intelligent legal inferences
- Procedural knowledge

✅ **Perfect PracticePro VEGA syntax**:
- `[ORANGE PLACEHOLDERS]` for missing data only
- `{BLUE CONTEXT}` for extracted facts and inferences
- Proper HTML formatting (no markdown)
- Zero preamble

✅ **Procedural compliance**:
- Delta State High Court (Civil Procedure) Rules 2021
- Lagos State High Court (Civil Procedure) Rules 2019
- Nigerian constitutional provisions
- Standard legal terminology and formatting

---

## File Structure

```
nigerian-litigation-drafting/
├── SKILL.md (Main skill instructions)
├── references/
│   ├── affidavits-guide.md (Comprehensive affidavit drafting)
│   ├── pleadings-guide.md (Claims, defences, replies)
│   ├── motions-guide.md (All application types)
│   ├── originating-processes.md (Writs, summons, motions)
│   └── procedural-rules.md (Quick reference for Delta/Lagos rules)
└── examples/
    └── statement-of-claim-breach-contract.md (Full extraction example)
```

---

## How It Works

### 1. Trigger Recognition

The skill activates when users mention:
- Any litigation document type ("statement of claim", "affidavit", "motion")
- Court filings ("file a suit", "draft pleading")
- Legal procedures ("injunction", "set aside default judgment")
- Nigerian courts ("Lagos High Court", "Delta State", "litigation")

### 2. Context Extraction Workflow

Before drafting, Claude:

**A. Mines Conversation History**
- Reviews all previous messages
- Extracts facts, dates, names, amounts
- Notes case details and procedural history
- Captures user corrections/clarifications

**B. Analyzes Uploaded Documents**
- Reads PDFs, Word docs, images (if uploaded)
- Extracts party information
- Identifies dates, amounts, agreements
- Notes evidence for exhibits

**C. Makes Intelligent Inferences**
- Legal status of parties (e.g., "Ltd" → company incorporation language)
- Jurisdictional appropriateness
- Standard contractual terms
- Procedural requirements

**D. Minimizes Placeholders**
- Only uses `[ORANGE]` for genuinely unknown data
- Uses `{BLUE}` extensively for extracted/inferred context
- Shows reasoning and legal knowledge

### 3. Output Protocol

**Zero Preamble:** Starts directly with document heading
**No Commentary:** No "Here is your draft..." 
**No Code Blocks:** Raw HTML/text only
**Maximum Context:** Abundant `{blue}`, minimal `[orange]`

---

## Document Types Covered

### Originating Processes
- **Writ of Summons** + Statement of Claim (disputed facts)
- **Originating Summons** (undisputed facts, legal questions)
- **Originating Motion** (constitutional rights, judicial review)

### Pleadings
- **Statement of Claim** (plaintiff's case)
- **Statement of Defence** (defendant's response)
- **Reply to Defence** (plaintiff's response to new matter)
- **Counterclaim** (defendant's claim against plaintiff)

### Interlocutory Applications
- **Motion on Notice** (all types)
- **Motion Ex-Parte** (urgent/without notice)
- Specific motions:
  - Interlocutory injunction
  - Setting aside default judgment
  - Joinder of parties
  - Amendment of pleadings
  - Stay of proceedings
  - Summary judgment
  - Extension of time

### Affidavits
- Affidavit in Support
- Counter-Affidavit
- Further Affidavit
- Affidavit of Service
- Affidavit of Means
- Affidavit of Urgency
- Affidavit Evidence-in-Chief

### Written Addresses
- Final Address / Brief of Argument
- Submissions on motions
- Issue formulation and legal arguments

### Notices
- Notice of Intention to Defend
- Notice of Preliminary Objection
- Notice of Appeal

---

## Jurisdictional Coverage

### Primary Jurisdictions
- **Lagos State High Court** (Civil Procedure Rules 2019)
- **Delta State High Court** (Civil Procedure Rules 2021)

### Key Differences
- **Lagos:** Mandatory frontloading (all documents with pleadings)
- **Delta:** Frontloading recommended but less strict
- Both follow similar procedural structure (based on English Rules)

---

## PracticePro VEGA Integration

### The Two-Color System

**Orange Placeholders** `[LIKE THIS]`:
- Strictly for **missing factual data**
- Lawyer must manually fill in
- Examples:
  - `[SUIT NUMBER]`
  - `[DEFENDANT'S ADDRESS]` (if not provided)
  - `[DATE OF BREACH]` (if unknown)
  - `[AMOUNT CLAIMED]` (if not specified)

**Blue Context** `{LIKE THIS}`:
- For **extracted facts** and **inferences**
- Lawyer must **verify/audit**
- Examples:
  - `{a limited liability company duly incorporated...}` ← Inferred from "Ltd"
  - `{based on the breach dated August 20th...}` ← Extracted from conversation
  - `{within the jurisdiction of this Court}` ← Legal inference
  - `{N2,500,000.00 (Two Million, Five Hundred...)}` ← Extracted amount with words

### Formatting Rules

**Headers:**
```html
<p style="text-align: center;"><strong>HEADER TEXT</strong></p>
```

**Paragraphs:**
```html
<p>Regular text paragraphs.</p>
```

**Bold (Non-Header):**
```html
<p><strong>Section Title</strong></p>
```

**NO:**
- ❌ Markdown code blocks (```html)
- ❌ Markdown headers (# ## ###)
- ❌ Preamble text ("Here is your draft...")
- ❌ Excessive placeholders when context available

---

## Quality Standards

Every draft must meet these standards:

### Procedural Accuracy
✅ Correct court heading and division
✅ Proper party designations
✅ Appropriate document structure
✅ Relevant procedural rules cited
✅ Sequential paragraph numbering
✅ Proper jurat/signature blocks

### Substantive Quality
✅ Legally sound arguments
✅ Material facts (not evidence or law in pleadings)
✅ Proper relief formulation
✅ Exhibits correctly referenced
✅ Special vs. general damages properly distinguished

### Context Maximization
✅ All available facts extracted
✅ Intelligent inferences made
✅ Legal enhancements applied
✅ Minimal placeholders
✅ Reasoning shown in `{blue}`

### Format Compliance
✅ Zero preamble
✅ Pure HTML/text
✅ Correct `[orange]` and `{blue}` usage
✅ Professional legal terminology

---

## Usage Examples

### Example 1: Simple Debt Claim

**User Input:**
```
Draft a statement of claim. ABC Ltd vs XYZ Corp. They owe us N5M for goods supplied in March 2024. We've sent two demand letters.
```

**What Skill Extracts:**
- Parties: ABC Ltd (company), XYZ Corp (company)
- Cause of action: Debt recovery / breach of contract
- Amount: N5,000,000.00
- Date: March 2024
- Evidence: Demand letters (2)

**What Skill Infers:**
- Company incorporation language
- "Goods sold and delivered" terminology
- Proper special damage particularization
- Standard relief structure (debt + interest + costs)
- Appropriate court division (Commercial)

**Output:**
Professional Statement of Claim with:
- Only 5-7 `[orange]` placeholders (suit no, addresses, exact dates)
- 20+ `{blue}` contexts showing extracted/inferred facts
- Complete relief section
- Exhibit references (demand letters as Exhibits A & B)

### Example 2: Injunction Motion

**User Input:**
```
Stop my neighbor from building on my land. I have a deed from 2020. He started construction yesterday. Plot 15, Housing Estate, Asaba.
```

**What Skill Extracts:**
- Subject: Land dispute / trespass
- Location: Plot 15, Housing Estate, Asaba
- Evidence: Deed of Assignment (2020)
- Urgency: Construction started yesterday
- Jurisdiction: Delta (Asaba)

**What Skill Infers:**
- Motion type: Interlocutory Injunction
- 3-part test required (prima facie, irreparable harm, balance of convenience)
- Undertaking as to damages needed
- Proper grounds formulation

**Output:**
Complete Motion on Notice with:
- Specific relief (restrain construction)
- All 3 test grounds properly pleaded
- Undertaking included
- Supporting documents listed
- Minimal placeholders

---

## Best Practices for Users

### To Get Best Results:

1. **Provide Context:**
   - "My client ABC Ltd sued XYZ Corp for N5M"
   - "The accident happened on March 15, 2024 on Awolowo Road"
   - "We have a tenancy agreement dated January 2023"

2. **Upload Documents:**
   - Contracts, invoices, letters
   - Survey plans, title documents
   - Medical reports, receipts
   - Skill will extract and reference them

3. **Mention Jurisdiction:**
   - "Lagos High Court" or "Delta" → Skill applies correct rules
   - If unspecified, skill may default to Lagos

4. **Specify Document Type:**
   - "Draft a statement of claim" (clear)
   - "I need court documents" (skill will ask for clarification)

5. **Trust the Blue Context:**
   - `{blue}` = skill's work product
   - Verify accuracy but usually sound
   - Shows legal reasoning and inferences

6. **Fill Orange Placeholders:**
   - `[orange]` = genuinely needs your input
   - Suit numbers, specific dates, exact addresses
   - Information skill couldn't extract

---

## Technical Notes

### Skills Referenced
This skill may read these companion guides:
- `affidavits-guide.md` (when drafting affidavits)
- `pleadings-guide.md` (when drafting claims/defences)
- `motions-guide.md` (when drafting applications)
- `originating-processes.md` (when starting new suits)
- `procedural-rules.md` (for rule citations and timelines)

### File Integration
- Reads uploaded files from `/mnt/user-data/uploads`
- Creates drafts in user's work directory
- Integrates with PracticePro VEGA editor seamlessly

---

## Limitations

### What This Skill Does NOT Do:

❌ **Legal Advice:** Provides documents, not case strategy
❌ **Case Assessment:** Doesn't evaluate merits or likelihood of success
❌ **Representation:** Not a substitute for a qualified lawyer
❌ **Guaranteed Accuracy:** User must review and verify all output
❌ **Court Rules Interpretation:** For actual filing, consult current rules
❌ **Ethical Decisions:** Lawyer responsible for propriety of claims

### Disclaimers:

- Always verify procedural rules (they may change)
- Confirm jurisdiction-specific requirements
- Review all legal reasoning
- Ensure factual accuracy
- Obtain professional legal advice for actual litigation

---

## Version Information

**Skill Version:** 1.0
**Last Updated:** 2024
**Applicable Rules:**
- Lagos State High Court (Civil Procedure) Rules 2019
- Delta State High Court (Civil Procedure) Rules 2021
- Constitution of the Federal Republic of Nigeria 1999 (as amended)

---

## Support & Feedback

For issues, improvements, or questions about this skill:
- Review the reference files in `/references`
- Check examples in `/examples`
- Ensure uploaded documents are accessible
- Provide clear context in your requests

---

## Summary

This skill transforms brief user inputs into **comprehensive, procedurally compliant Nigerian litigation documents** by:

1. ✅ **Extracting maximum context** from conversations and files
2. ✅ **Making intelligent legal inferences** based on best practices
3. ✅ **Minimizing manual input** through extensive use of `{blue context}`
4. ✅ **Ensuring procedural compliance** with Delta/Lagos High Court rules
5. ✅ **Integrating perfectly** with PracticePro VEGA's two-color system

**Result:** Professional documents that are 80%+ complete from minimal input, ready for lawyer review and finalization.

**This is litigation drafting excellence, automated.**
