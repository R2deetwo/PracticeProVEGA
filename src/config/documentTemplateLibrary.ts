/**
 * PracticePro — Document Template Library
 * ============================================================
 * Curated starter DOCUMENT TEMPLATES (Backlog #3) keyed by the same
 * practice-area / portfolio-type strings the Practice Blueprint uses.
 * Seeded through the blueprint engine (usePracticeProfile) with the
 * same merge contracts: ADDITIVE ONLY, IDEMPOTENT by name, PREVIEWABLE.
 *
 * STATE-SPECIFIC VARIANTS (Backlog #4):
 *  - Templates whose content carries {{STATE_*}} markers are rendered
 *    against JURISDICTION_REGISTRY at plan-build time, so a Lagos firm
 *    and a Delta firm get correctly-cited court captions and procedural
 *    rules in the SAME template.
 *  - The state is baked into the template NAME ("Demand Letter
 *    (Pre-Action) — Lagos"), so a firm that later changes its primary
 *    state and re-runs the blueprint gets the new state's variant added
 *    (additive), never an overwrite.
 *  - `stateOnly` gates genuinely state-specific documents (e.g. the
 *    Lagos High Court Pre-Action Protocol — most other states have no
 *    equivalent protocol) so they are only seeded where they apply.
 *
 * PLACEHOLDER CONVENTION:
 *  Content uses [BRACKETED PLACEHOLDERS] from the app's
 *  placeholderRegistry (src/constants/placeholderRegistry.ts) EXCEPT
 *  the {{STATE_*}} markers below, which are resolved at seed time and
 *  never reach the stored template. This means the DraftPro fill modal
 *  and matter/firm auto-fill work on every seeded template out of the
 *  box.
 *
 * Content is drafted for Nigerian legal practice. Statutory references
 * (High Court Civil Procedure Rules, Tenancy Law, Recovery of Premises
 * laws, NDPA 2023, CAMA 2020, Evidence Act 2011) follow the state
 * registry's curated citations.
 */

import { JURISDICTION_REGISTRY, getJurisdiction } from "../utils/jurisdictionConfig";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocumentTemplateBlueprint {
  /** Template name — must be unique within the firm (idempotency key).
   *  State-aware templates append " — {State}" automatically at render. */
  name: string;
  description: string;
  /** A documentTemplateCategories row with this name is ensured. */
  categoryName: string;
  /** Body with [BRACKETED PLACEHOLDERS] and optional {{STATE_*}} markers. */
  content: string;
  /** Only seed when the firm's primary state key matches (e.g. "Lagos"). */
  stateOnly?: string;
}

/** Marker → resolved string, per the firm's primary state. */
function renderStateMarkers(content: string, stateKey?: string): string {
  const j = getJurisdiction(stateKey);
  return content
    .replace(/\{\{STATE_NAME\}\}/g, j.name)
    .replace(/\{\{HIGH_COURT_CAPTION\}\}/g, j.highCourtCaption)
    .replace(/\{\{MAGISTRATE_CAPTION\}\}/g, j.magistrateCourtCaption)
    .replace(/\{\{FHC_CAPTION\}\}/g, j.federalHighCourtCaption)
    .replace(/\{\{HIGH_COURT_RULES\}\}/g, j.highCourtRules)
    .replace(/\{\{STATE_DIVISION\}\}/g, j.defaultDivision);
}

/** True when the content contains state markers → the name gets a suffix. */
function isStateAware(content: string): boolean {
  return /\{\{STATE_NAME|HIGH_COURT_CAPTION|MAGISTRATE_CAPTION|FHC_CAPTION|HIGH_COURT_RULES|STATE_DIVISION\}\}/.test(content);
}

/** Extract [BRACKETED PLACEHOLDERS] for the template's `placeholders` field. */
export function extractPlaceholders(content: string): string[] {
  const out = new Set<string>();
  const re = /\[([A-Z][A-Z0-9'’\s&/.-]*?)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) out.add(`[${m[1].trim()}]`);
  return Array.from(out);
}

/** Render a blueprint for a firm: state markers resolved, placeholders extracted. */
export function renderTemplateBlueprint(
  bp: DocumentTemplateBlueprint,
  stateKey?: string,
): { name: string; description: string; categoryName: string; content: string; placeholders: string[] } {
  const content = renderStateMarkers(bp.content, stateKey);
  const stateSuffix = isStateAware(bp.content)
    ? ` — ${JURISDICTION_REGISTRY[stateKey || ""]?.name || stateKey || ""}`
    : "";
  return {
    name: `${bp.name}${stateSuffix}`.trim(),
    description: bp.description,
    categoryName: bp.categoryName,
    content,
    placeholders: extractPlaceholders(content),
  };
}

// ---------------------------------------------------------------------------
// LEGAL (Vega) — keyed by practice-area key (PRACTICE_PROFILES keys)
// ---------------------------------------------------------------------------

export const LEGAL_DOCUMENT_TEMPLATES: Record<string, DocumentTemplateBlueprint[]> = {
  "Civil Litigation": [
    {
      name: "Demand Letter (Pre-Action)",
      description:
        "Final demand before commencing proceedings — cites the state's procedural rules and the consequence of non-response.",
      categoryName: "Correspondence",
      content: `[FIRM NAME]
[FIRM ADDRESS]

[DRAFTED IN TRIPLECTATE]

[TODAY'S DATE]

[CLIENT NAME]
[CLIENT ADDRESS]

Dear Sir/Madam,

RE: FINAL DEMAND — [MATTER TITLE]

We act as Solicitors to [CLIENT NAME] (hereinafter "our client") whose instructions we have to write you as follows.

Our client's claim against you is for [CLAIM AMOUNT] arising from [CAUSE OF ACTION]. Despite previous verbal demands, you have failed, refused and/or neglected to liquidate the outstanding sum or respond to our client.

TAKE NOTICE that unless you pay the said sum of [CLAIM AMOUNT] and [LEGAL FEES] for legal fees to our client or to this firm within SEVEN (7) days of your receipt of this letter, we shall, without further recourse to you, commence legal proceedings against you at the {{HIGH_COURT_CAPTION}} holding at {{STATE_DIVISION}} Judicial Division in accordance with the {{HIGH_COURT_RULES}}, and shall seek [RELIEF SOUGHT], together with interest and costs of the action.

Note that judgment obtained shall be enforced against your goods, chattels, monies in bank and other assets by all lawful means of execution including writs of fieri facias and garnishee proceedings.

Be properly guided.

Yours faithfully,

[SIGNATORY NAME]
[SIGNATORY TITLE]
For: [FIRM NAME]`,
    },
    {
      name: "Witness Statement on Oath",
      description:
        "Front-loaded witness statement complying with the state's civil procedure rules and the Evidence Act 2011.",
      categoryName: "Affidavits & Exhibits",
      content: `{{HIGH_COURT_CAPTION}} HOLDEN AT {{STATE_DIVISION}} JUDICIAL DIVISION

SUIT NO: [SUIT NUMBER]

BETWEEN:

[CLAIMANT NAME] ................................................ CLAIMANT

AND

[DEFENDANT NAME] ............................................ DEFENDANT

WITNESS STATEMENT ON OATH OF [WITNESS NAME]

I, [WITNESS NAME], of [CLIENT ADDRESS], adult, [OATH COMMISSIONER's profession/state] do hereby make oath and state as follows:

1. I am the [description of relationship to the matter — e.g. "Claimant", "Warehouse Manager of the Claimant"]. By virtue of my position, I am conversant with the facts deposed to herein and competent to make this statement.

2. [FACT 1 — state the first material fact in numbered order. Each fact must be within your direct knowledge, or state the source of the information and belief, per section 89–90 of the Evidence Act 2011.]

3. [FACT 2 — continue the narrative in strict chronological order.]

4. [FACT 3 — refer to documents: "The agreement between the parties is exhibited herewith and marked Exhibit A."]

5. The deponent shall rely on all processes filed in this suit at the hearing of this action.

DEPONENT

SWORN to at the Registry of the {{HIGH_COURT_CAPTION}}, {{STATE_DIVISION}}, this [TODAY'S DATE], before me:

BEFORE ME,

_______________________________
COMMISSIONER FOR OATHS`,
    },
    {
      name: "Pre-Action Protocol Compliance Letter",
      description:
        "Lagos-only: the Pre-Action Protocol engagement letter required by the High Court of Lagos State (Civil Procedure) Rules 2019 before issuing a writ.",
      categoryName: "Correspondence",
      stateOnly: "Lagos",
      content: `[FIRM NAME]
[FIRM ADDRESS]

[TODAY'S DATE]

[OPPOSING COUNSEL]
[REGISTERED OFFICE ADDRESS]

BY REGISTERED MAIL AND EMAIL

Dear Sir/Madam,

RE: PRE-ACTION PROTOCOL NOTICE — [MATTER TITLE]
    [CLIENT NAME] v. [OPPOSING PARTY NAME]

In compliance with the Pre-Action Protocol provisions of the High Court of Lagos State (Civil Procedure) Rules 2019, we write as follows on behalf of [CLIENT NAME] (our client):

1. NATURE OF CLAIM: Our client's claim against your client is for [CLAIM AMOUNT] arising from [CAUSE OF ACTION].

2. RELIEF SOUGHT: Our client seeks [RELIEF SOUGHT].

3. SETTLEMENT INVITATION: We invite your client to respond to this notice within FOURTEEN (14) days with proposals for amicable resolution. The rules contemplate good-faith engagement before issuance of originating process; unreasonable refusal to participate in the Protocol may attract cost consequences at trial.

4. DOCUMENTS: We refer you to the [EXHIBIT REFERENCE] schedule served herewith.

Where no response is received within the stipulated time, we shall proceed to issue and serve originating process at the High Court of Lagos State without further reference to you.

Yours faithfully,

[SIGNATORY NAME]
[SIGNATORY TITLE]
For: [FIRM NAME]`,
    },
  ],

  "Corporate & Commercial": [
    {
      name: "Board Resolution (Ordinary)",
      description:
        "Standard ordinary resolution of a company's board — CAMA 2020 compliant with notice/quorum recitals.",
      categoryName: "Agreements & Contracts",
      content: `[FIRM NAME]
[FIRM ADDRESS]

COMPANY: [CLIENT NAME] ("the Company")
RC NO: [FIRM REG NUMBER]

RESOLUTIONS OF THE BOARD OF DIRECTORS
Passed at a meeting of the Board held on [TODAY'S DATE] at [REGISTERED OFFICE ADDRESS]

PRESENT:
[ Witness: list directors present ]

QUORUM: The Chairman confirmed that a quorum was present in accordance with Article [ARTICLE NO.] of the Company's Articles of Association and the requirements of the Companies and Allied Matters Act 2020.

IT WAS RESOLVED THAT:

1. [RESOLUTION 1 — state the substantive resolution.]

2. [RESOLUTION 2 — e.g. "the authorized signatories of the Company be and are hereby authorized to execute all such documents and do all such acts as may be necessary to give effect to the foregoing resolution."]

3. That these resolutions be circulated to all directors in accordance with the Articles and the Companies and Allied Matters Act 2020.

CERTIFIED TRUE EXTRACT

_______________________________          _______________________________
[DIRECTOR 1 NAME] — Director           [DIRECTOR 2 NAME] — Director

Date: [TODAY'S DATE]`,
    },
    {
      name: "Engagement Letter (Corporate Client)",
      description:
        "Retainer engagement letter for corporate clients — scope, fees, conflict confirmation and reporting line.",
      categoryName: "Engagement Letters",
      content: `[FIRM NAME]
[FIRM ADDRESS]

[TODAY'S DATE]

[CLIENT NAME]
[REGISTERED OFFICE ADDRESS]

ATTN: [SIGNATORY TITLE]

RE: ENGAGEMENT OF LEGAL SERVICES

Dear Sir/Madam,

We are pleased to confirm our engagement by [CLIENT NAME] (the "Company") to provide legal services in respect of [MATTER TITLE] (the "Engagement"). This letter sets out the terms on which we will act.

1. SCOPE: We will provide legal advisory and transactional services limited to [SCOPE OF ENGAGEMENT — describe]. Work outside this scope will be the subject of a fresh engagement.

2. FEES: Our professional fees are [LEGAL FEES], plus disbursements and applicable VAT. Interim invoices are rendered [BILLING FREQUENCY — monthly/quarterly] and are payable within 14 days.

3. TEAM: [SOLICITOR NAME] will lead the Engagement and is your primary contact.

4. CONFLICTS: We confirm that we are not aware of any conflict of interest in acting for the Company in this Engagement.

5. GOVERNING LAW: This engagement is governed by Nigerian law.

Kindly countersign below to confirm acceptance.

Yours faithfully,

[SIGNATORY NAME]
[SIGNATORY TITLE]
For: [FIRM NAME]

ACCEPTED for and on behalf of [CLIENT NAME]:

_______________________________          _______________________________
Name / Designation                      Date`,
    },
  ],

  "Real Estate & Property": [
    {
      name: "Tenancy Agreement (Residential)",
      description:
        "Residential tenancy agreement citing the state's tenancy/recovery-of-premises law — landlord obligations, deposit and quit notice clauses.",
      categoryName: "Agreements & Contracts",
      content: `TENANCY AGREEMENT

THIS AGREEMENT is made on [TODAY'S DATE]

BETWEEN:

[LANDLORD NAME] of [CLIENT ADDRESS] (hereinafter "the Landlord") of the one part

AND

[TENANT NAME] of [PROPERTY ADDRESS] (hereinafter "the Tenant") of the other part.

WHEREAS the Landlord is the registered owner of all that property situate at [PROPERTY ADDRESS] (the "Demised Premises") and has agreed to let same to the Tenant upon the terms herein.

NOW IT IS HEREBY AGREED AS FOLLOWS:

1. TERM: The Landlord demises the Demised Premises to the Tenant for a term of [TENANCY TERM — e.g. one (1) year] commencing on [LEASE START DATE] and determining on [LEASE END DATE].

2. RENT: The Tenant shall pay rent of [RENT AMOUNT] per annum, payable in advance on or before [RENT DUE DATE].

3. DEPOSIT: The Tenant has paid [SECURITY DEPOSIT] as security deposit, refundable at the expiration of the tenancy subject to deductions for damage beyond fair wear and tear.

4. USE: The Demised Premises shall be used for residential purposes only.

5. REPAIRS: The Landlord shall keep the roof and main structure in good repair; the Tenant shall keep the interior in good and tenantable condition.

6. ASSIGNMENT: The Tenant shall not assign, sublet or part with possession without the Landlord's prior written consent.

7. QUIET ENJOYMENT: The Tenant shall peaceably hold and enjoy the Demised Premises during the term without interruption by the Landlord.

8. NOTICE: Either party may terminate by [NOTICE PERIOD — e.g. six (6) months] written notice in accordance with the applicable tenancy law of {{STATE_NAME}}.

9. GOVERNING LAW: This Agreement is governed by the laws of the Federal Republic of Nigeria, including the applicable tenancy/recovery of premises law of {{STATE_NAME}}.

EXECUTED by the parties:

_______________________________          _______________________________
[LANDLORD NAME] — Landlord              [TENANT NAME] — Tenant

IN THE PRESENCE OF:

_______________________________
Name / Address / Signature of Witness`,
    },
    {
      name: "Deed of Assignment (Draft)",
      description:
        "Conveyancing draft assigning interest in land — consideration, governor's-consent covenant (Land Use Act 1978) and covenants.",
      categoryName: "Agreements & Contracts",
      content: `DEED OF ASSIGNMENT

THIS DEED is made on [TODAY'S DATE]

BETWEEN:

[CLIENT NAME] of [CLIENT ADDRESS] (hereinafter "the Assignor") of the one part

AND

[OPPOSING PARTY NAME] of [REGISTERED OFFICE ADDRESS] (hereinafter "the Assignee") of the other part.

WHEREAS:

A. The Assignor is the beneficial owner of ALL THAT piece or parcel of land situate, lying and being at [PROPERTY ADDRESS] more particularly described in the Survey Plan attached as Exhibit A (the "Property").

B. The Assignor has agreed to assign all its rights, title and interest in the Property to the Assignee for the consideration herein.

NOW THIS DEED WITNESSES AS FOLLOWS:

1. In consideration of the sum of [CONSIDERATION AMOUNT] paid by the Assignee to the Assignor (the receipt whereof the Assignor hereby acknowledges), the Assignor as beneficial owner hereby ASSIGNS unto the Assignee ALL THAT the Property together with all rights, title and interest therein.

2. GOVERNOR'S CONSENT: The parties acknowledge that the assignment is subject to the consent of the Governor of {{STATE_NAME}} as required by the Land Use Act 1978, and covenant to execute all documents and do all things necessary to obtain such consent.

3. COVENANTS: The Assignor covenants with the Assignee that the Assignor has not previously assigned, mortgaged or otherwise encumbered the Property.

4. INDEMNITY: The Assignor shall indemnify the Assignee against any loss arising from any breach of the foregoing covenant.

5. GOVERNING LAW: This Deed is governed by the laws of the Federal Republic of Nigeria.

EXECUTED by the parties:

_______________________________          _______________________________
[CLIENT NAME] — Assignor               [OPPOSING PARTY NAME] — Assignee

IN THE PRESENCE OF:

_______________________________
Name / Address / Signature of Witness`,
    },
  ],

  "Family Law & Probate": [
    {
      name: "Letters of Administration Application (Cover Letter)",
      description:
        "Cover letter accompanying a probate registry application for letters of administration — intestacy, sureties and inventory exhibits.",
      categoryName: "Correspondence",
      content: `[FIRM NAME]
[FIRM ADDRESS]

[TODAY'S DATE]

The Probate Registrar
{{HIGH_COURT_CAPTION}}, {{STATE_DIVISION}}

Dear Registrar,

RE: APPLICATION FOR LETTERS OF ADMINISTRATION — ESTATE OF [DECEASED NAME]

We act as Solicitors to [CLIENT NAME] of [CLIENT ADDRESS], a child/beneficiary of the above-named deceased who died intestate on [DATE OF DEATH].

We forward herewith, for your kind consideration, the application of our client for Letters of Administration of the estate of the deceased, together with:

1. Application form duly completed;
2. Death certificate of the deceased (Exhibit A);
3. Letters of Administration (form) with the Oath for Administration;
4. Sureties' affidavits of good standing, each backed by a certificate of occupancy or landed property valuation as required;
5. Inventory of the estate's assets (Exhibit B);
6. Consent of family members (Exhibit C);
7. [FIRM REG NUMBER] — NBA seal confirmation.

We respectfully request that the application be processed and a date fixed for the administration bond and oath-taking.

Yours faithfully,

[SIGNATORY NAME]
[SIGNATORY TITLE]
For: [FIRM NAME]`,
    },
    {
      name: "Engagement Letter (Family & Probate)",
      description:
        "Family/probate retainer letter with confidentiality and conflict-sensitivity undertakings.",
      categoryName: "Engagement Letters",
      content: `[FIRM NAME]
[FIRM ADDRESS]

[TODAY'S DATE]

[CLIENT NAME]
[CLIENT ADDRESS]

RE: ENGAGEMENT — [MATTER TITLE]

Dear [CLIENT NAME],

We confirm our engagement to act for you in the above matter. This letter records the terms.

1. SCOPE: We will represent you in [SCOPE OF ENGAGEMENT — e.g. divorce/judicial separation/probate administration/custody] limited to proceedings and negotiations arising therefrom.

2. FEES: Our fees are [LEGAL FEES] plus disbursements and VAT. We render interim invoices [BILLING FREQUENCY] payable within 14 days.

3. SOLICITOR: [SOLICITOR NAME] will handle your matter and is your primary contact.

4. CONFIDENTIALITY: All information you provide is held in strict confidence. However, you should note that a lawyer's primary duty is to the court where it conflicts with yours.

5. CONFLICTS: Where both spouses/family members initially instruct us, we are professionally unable to act for more than one party once interests diverge; we will confirm the party we continue to act for in writing.

6. DOCUMENTS: Kindly provide originals of [DOCUMENTS REQUIRED — marriage certificate, death certificate, title documents etc.] for verification and copying.

Kindly countersign to accept.

Yours faithfully,

[SIGNATORY NAME]
[SIGNATORY TITLE]
For: [FIRM NAME]

ACCEPTED:

_______________________________          _______________________________
[CLIENT NAME]                          Date`,
    },
  ],

  "Criminal Defence": [
    {
      name: "Bail Application (Supporting Affidavit)",
      description:
        "Supporting affidavit for a bail application — presumption of innocence, sureties and constitutional references (s.35 & 36 ACJL/1999 Constitution).",
      categoryName: "Affidavits & Exhibits",
      content: `{{HIGH_COURT_CAPTION}} HOLDEN AT {{STATE_DIVISION}} JUDICIAL DIVISION

CHARGE NO: [SUIT NUMBER]

BETWEEN:

THE STATE ................................................ PROSECUTION

AND

[DEFENDANT NAME] ........................................ ACCUSED

SUPPORTING AFFIDAVIT IN SUPPORT OF BAIL APPLICATION

I, [WITNESS NAME], of [CLIENT ADDRESS], adult, [PROFESSION], being the [relationship — e.g. "elder brother of the accused"] do hereby make oath and state as follows:

1. I am the [relationship] of the Accused Person and by virtue of my position am conversant with the facts herein.

2. The Accused Person was arraigned before this Honourable Court on a charge of [CAUSE OF ACTION — state the offence] and pleaded not guilty.

3. The Accused Person is presumed innocent until proven guilty as guaranteed by section 36(5) of the Constitution of the Federal Republic of Nigeria 1999 (as amended).

4. The Accused Person has [FIXED ABODE — describe residence/community ties] and is not a flight risk.

5. The Accused Person has responsible sureties who are [SURETIES DESCRIPTION — civil servants/community leaders] resident within this jurisdiction and ready to stand bail.

6. The Accused Person is willing and able to obey the conditions of bail and attend trial as and when required.

7. It is in the interest of justice to admit the Accused Person to bail pending trial.

DEPONENT

SWORN to at the Registry of the {{HIGH_COURT_CAPTION}}, {{STATE_DIVISION}}, this [TODAY'S DATE], before me:

BEFORE ME,

_______________________________
COMMISSIONER FOR OATHS`,
    },
  ],

  "Employment & Labour": [
    {
      name: "Employment Contract (Standard)",
      description:
        "Standard employment contract for Nigerian employers — NICN-arbitrable disputes, pension and statutory deduction clauses.",
      categoryName: "Agreements & Contracts",
      content: `EMPLOYMENT CONTRACT

THIS CONTRACT is made on [TODAY'S DATE]

BETWEEN:

[CLIENT NAME] (RC No: [FIRM REG NUMBER]) of [REGISTERED OFFICE ADDRESS] (the "Employer")

AND

[CLIENT NAME / EMPLOYEE NAME] of [CLIENT ADDRESS] (the "Employee").

1. POSITION: The Employee is engaged as [JOB TITLE — e.g. Operations Manager] reporting to [SUPERVISOR TITLE].

2. COMMENCEMENT: Employment commences on [LEASE START DATE / START DATE] with a probation period of [PROBATION PERIOD — e.g. three (3) months].

3. REMUNERATION: The Employee is entitled to a gross monthly salary of [RENT AMOUNT / SALARY], subject to statutory deductions (PAYE, pension contributions under the Pension Reform Act 2014, NHF where applicable).

4. HOURS: Normal working hours are [WORKING HOURS] Mondays to Fridays.

5. LEAVE: The Employee is entitled to [ANNUAL LEAVE DAYS] working days annual leave, plus sick leave in accordance with the Labour Act.

6. TERMINATION: Either party may terminate this contract by [NOTICE PERIOD] written notice or payment in lieu. Gross misconduct entitles the Employer to summary dismissal.

7. CONFIDENTIALITY: The Employee shall not, during or after employment, disclose the Employer's confidential information.

8. DISPUTES: Disputes arising from this contract fall within the exclusive jurisdiction of the National Industrial Court of Nigeria.

9. GOVERNING LAW: This contract is governed by the laws of the Federal Republic of Nigeria.

SIGNED:

_______________________________          _______________________________
For: [CLIENT NAME] — Employer          Employee

IN THE PRESENCE OF:

_______________________________
Name / Signature of Witness`,
    },
    {
      name: "Termination Letter (Notice)",
      description:
        "Employment termination-by-notice letter — final entitlements, company property and reference clauses.",
      categoryName: "Correspondence",
      content: `[FIRM NAME]
[FIRM ADDRESS]

[NOTICE DATE]

[CLIENT NAME / EMPLOYEE NAME]
[CLIENT ADDRESS]

PRIVATE & CONFIDENTIAL

Dear [EMPLOYEE NAME],

RE: TERMINATION OF EMPLOYMENT

We refer to your contract of employment dated [START DATE] and write to notify you, in accordance with its terms, that your employment with [CLIENT NAME] will terminate on [LEASE END DATE / TERMINATION DATE].

1. NOTICE: This letter constitutes [NOTICE PERIOD] written notice, in line with your contract.

2. FINAL ENTITLEMENTS: Your salary up to the termination date, accrued untaken leave and any other entitlements will be paid on or before [PAYMENT DATE], subject to statutory deductions.

3. COMPANY PROPERTY: Kindly return all company property (laptop, identity card, documents, keys) to [DEPARTMENT/PERSON] on or before your last working day.

4. HANDOVER: You shall complete a full handover of ongoing tasks to [SUCCESSOR NAME] as directed by your line manager.

5. CONFIDENTIALITY: Your obligations of confidentiality and non-disculation survive the termination of your employment.

6. REFERENCE: A reference confirming your period of service and role may be requested from the Human Resources Department.

We thank you for your service and wish you well in your future endeavours.

Yours faithfully,

[SIGNATORY NAME]
[SIGNATORY TITLE]
For: [CLIENT NAME]`,
    },
  ],

  "Banking & Finance": [
    {
      name: "Loan Default Demand Notice",
      description:
        "Post-default demand notice for a lender — acceleration, security enforcement and 7-day demand window.",
      categoryName: "Correspondence",
      content: `[FIRM NAME]
[FIRM ADDRESS]

[TODAY'S DATE]

[OPPOSING PARTY NAME / BORROWER]
[REGISTERED OFFICE ADDRESS]

BY REGISTERED MAIL

Dear Sir/Madam,

RE: DEMAND FOR REPAYMENT OF OUTSTANDING FACILITY — [FACILITY/ACCOUNT REFERENCE]

We act as Solicitors to [CLIENT NAME] (the "Bank") whose instructions we have to write you as follows.

1. FACILITY: By a letter of offer dated [START DATE], the Bank granted you a [FACILITY TYPE] facility in the principal sum of [CLAIM AMOUNT], secured by [SECURITY — e.g. legal mortgage over the property at PROPERTY ADDRESS].

2. DEFAULT: You have failed to service the facility as agreed; the total outstanding (principal, accrued interest and charges) as at [DEADLINE DATE] is [CLAIM AMOUNT OUTSTANDING].

3. DEMAND: The Bank hereby demands FULL repayment of the outstanding sum within SEVEN (7) days of your receipt of this letter.

4. ACCELERATION AND ENFORCEMENT: In the event of non-payment, the Bank shall, without further notice, exercise its rights under the security documents and applicable law, including the realization of the charged assets, appointment of a receiver, and recovery proceedings at the {{HIGH_COURT_CAPTION}} or the Federal High Court, as appropriate.

5. COSTS: All enforcement costs, including legal fees, shall be for your account.

Yours faithfully,

[SIGNATORY NAME]
[SIGNATORY TITLE]
For: [FIRM NAME]`,
    },
  ],

  "Intellectual Property": [
    {
      name: "Cease and Desist Letter (Trade Mark)",
      description:
        "Trade-mark infringement cease-and-desist letter — registration priority, deception likelihood and undertakings demand.",
      categoryName: "Correspondence",
      content: `[FIRM NAME]
[FIRM ADDRESS]

[TODAY'S DATE]

[OPPOSING PARTY NAME]
[REGISTERED OFFICE ADDRESS]

BY EMAIL AND REGISTERED MAIL

Dear Sir/Madam,

RE: UNAUTHORISED USE OF TRADE MARK "[MARK NAME]" — CEASE AND DESIST

We act as Solicitors to [CLIENT NAME], the registered proprietor of the trade mark "[MARK NAME]" registered in Nigeria in classes [CLASSES] with registration number [REGISTRATION NUMBER].

Our client's said registration confers the exclusive right to use the mark in the course of trade. It has come to our client's attention that you are using an identical/confusingly similar mark "[INFRINGING MARK]" in respect of [GOODS/SERVICES], which constitutes infringement of our client's registered rights and is calculated to deceive or cause confusion in the course of trade, contrary to the Trade Marks Act.

DEMAND: We demand that within SEVEN (7) days of receipt of this letter you:

(a) cease and desist immediately from all use of the said mark or any confusingly similar mark;
(b) deliver up for destruction all infringing materials, packaging and signage;
(c) provide written undertakings to that effect; and
(d) account to our client for profits made from the infringing use.

TAKE NOTICE that failing compliance, we shall seek injunctive relief, damages, and delivery-up orders at the Federal High Court, together with costs — entirely at your risk as to costs and consequences.

Yours faithfully,

[SIGNATORY NAME]
[SIGNATORY TITLE]
For: [FIRM NAME]`,
    },
  ],

  "Tax Law": [
    {
      name: "Tax Audit Response Letter (FIRS)",
      description:
        "Response to a FIRS/state tax authority audit or assessment query — objection, supporting schedules and reconciliation.",
      categoryName: "Correspondence",
      content: `[FIRM NAME]
[FIRM ADDRESS]

[TODAY'S DATE]

The Executive Chairman
Federal Inland Revenue Service / [STATE INTERNAL REVENUE SERVICE]
[COURT ADDRESS / TAX AUTHORITY ADDRESS]

ATTN: [TAX OFFICER NAME / AUDIT TEAM]

RE: RESPONSE TO AUDIT QUERY / ADDITIONAL ASSESSMENT — [CLIENT NAME] (TIN: [TIN NUMBER])

We act as Tax Consultants/Solicitors to [CLIENT NAME] and refer to your [QUERY/ASSESSMENT NOTICE] dated [DEADLINE DATE] reference [REFERENCE NUMBER].

1. OBJECTION: Without prejudice, our client OBJECTS to the additional assessment/audit findings on the grounds that [GROUNDS OF OBJECTION — e.g. the disallowed expenses were wholly, exclusively, necessarily and reasonably incurred for the purposes of the trade under s.24 of the Companies Income Tax Act].

2. RECONCILIATION: We attach the following in support:
   (a) Schedule of the disputed expenses with ledger extracts (Exhibit A);
   (b) Corresponding bank statements and payment vouchers (Exhibit B);
   (c) Revised computation reconciling the declared and assessed positions (Exhibit C).

3. RELIEF SOUGHT: We respectfully request that the additional assessment be withdrawn/abated accordingly, or in the alternative, that a meeting be convened for reconciliation.

4. STATUTORY RESERVATION: This response is served within the statutory period and without prejudice to our client's right of appeal to the Tax Appeal Tribunal.

We look forward to your kind consideration.

Yours faithfully,

[SIGNATORY NAME]
[SIGNATORY TITLE]
For: [FIRM NAME]`,
    },
  ],

  "Oil & Gas": [
    {
      name: "Regulatory Compliance Advisory (NUPRC/NMDPRA)",
      description:
        "Client advisory on upstream/downstream regulatory obligations — licence renewals, local content and penalty exposure.",
      categoryName: "Legal Opinions",
      content: `PRIVILEGED & CONFIDENTIAL — PREPARED FOR THE ADDRESSEE ONLY

[TODAY'S DATE]

[CLIENT NAME]
[REGISTERED OFFICE ADDRESS]

RE: REGULATORY COMPLIANCE REVIEW — [LICENCE/PERMIT REFERENCE]

1. INSTRUCTIONS: We have reviewed your operations under [LICENCE TYPE — e.g. Oil Mining Licence / Gas Processing licence] reference [REFERENCE NUMBER], against the requirements of the Petroleum Industry Act 2021 and applicable NUPRC/NMDPRA regulations.

2. FINDINGS:
   (a) [FINDING 1 — e.g. annual licence fees are current to DATE.]
   (b) [FINDING 2 — e.g. decommissioning and abandonment plan requires updating per s.232 PIA.]
   (c) [FINDING 3 — e.g. Nigerian content compliance reports outstanding.]

3. RISK ASSESSMENT: Non-compliance exposes the company to [PENALTY EXPOSURE — administrative fines, licence suspension], and in certain cases personal liability for officers.

4. RECOMMENDATIONS:
   (a) File the outstanding returns within [CURE PERIOD];
   (b) [RECOMMENDATION 2];
   (c) We can engage the Commission on your behalf regarding [SPECIFIC ISSUE].

5. QUALIFICATIONS: This advice is based on the documents listed in the Schedule and current legislation as at the date hereof; it is private and confidential and may not be relied upon by any third party.

[SIGNATORY NAME]
[SIGNATORY TITLE]
For: [FIRM NAME]`,
    },
  ],

  "Maritime & Admiralty": [
    {
      name: "Maritime Claim Pre-Action Letter",
      description:
        "Pre-action demand for a maritime claim (freight/demurrage/damage) reserving admiralty arrest rights at the Federal High Court.",
      categoryName: "Correspondence",
      content: `[FIRM NAME]
[FIRM ADDRESS]

[TODAY'S DATE]

[OPPOSING PARTY NAME / CHARTERER]
[REGISTERED OFFICE ADDRESS]

BY EMAIL AND REGISTERED MAIL

Dear Sir/Madam,

RE: MARITIME CLAIM — [VESSEL NAME] — OUTSTANDING [FREIGHT/DEMURRAGE/HIRE]

We act as Solicitors to [CLIENT NAME] (the "Owners") in respect of the above claim.

1. By a charterparty dated [START DATE] on terms of [CHARTER TYPE — e.g. NYPE 93/GENCON], the Owners let the m.v. [VESSEL NAME] to you for [VOYAGE/PREIOD].

2. Under statement of accounts attached (Exhibit A), the outstanding sum of [CLAIM AMOUNT] comprises [BREAKDOWN — hire, demurrage, bunkers].

3. DEMAND: We demand payment of the said sum within SEVEN (7) days of your receipt of this letter, in default of which the Owners shall:
   (a) commence an admiralty action in rem at the Federal High Court of Nigeria; and
   (b) apply for the arrest of the m.v. [VESSEL NAME] or any sister vessel within Nigerian waters for the said claim, as the Admiralty Jurisdiction Act permits.

4. INTEREST AND COSTS: Interest and costs are reserved.

Yours faithfully,

[SIGNATORY NAME]
[SIGNATORY TITLE]
For: [FIRM NAME]`,
    },
  ],

  "Tech, Data & Compliance": [
    {
      name: "NDPA Data Subject Notice (Employee Data)",
      description:
        "Employee personal-data processing notice per the NDPA 2023 — purposes, lawful basis, retention and data-subject rights.",
      categoryName: "Legal Opinions",
      content: `[FIRM NAME]
[FIRM ADDRESS]

[TODAY'S DATE]

TO ALL EMPLOYEES — [CLIENT NAME]

RE: NOTICE ON PROCESSING OF EMPLOYEE PERSONAL DATA (NIGERIA DATA PROTECTION ACT 2023)

This notice explains how [CLIENT NAME] ("we") collects and processes your personal data.

1. DATA WE PROCESS: identity and contact details, next-of-kin, payroll/bank details, performance records, [OTHER CATEGORIES].

2. PURPOSES AND LAWFUL BASIS: we process your data to perform the employment contract, comply with statutory obligations (PAYE, pension, NSITF), and for legitimate operational purposes — security, IT administration and audits.

3. RETENTION: employment records are retained for the period required by statute and no longer than necessary for the purposes above.

4. YOUR RIGHTS: under the NDPA 2023 you may request access, rectification, erasure (where applicable), restriction, and data portability; you may also object to processing and lodge a complaint with the Nigeria Data Protection Commission.

5. CONTACT: our Data Protection Officer is reachable at [DPO CONTACT EMAIL].

[SIGNATORY NAME]
[SIGNATORY TITLE]
For: [CLIENT NAME]`,
    },
  ],

  "General Practice": [
    {
      name: "Power of Attorney (General)",
      description:
        "General power of attorney — Powers of Attorney Act, execution and attestation formalities.",
      categoryName: "Agreements & Contracts",
      content: `GENERAL POWER OF ATTORNEY

THIS GENERAL POWER OF ATTORNEY is made on [TODAY'S DATE]

BY:

[CLIENT NAME] of [CLIENT ADDRESS] (the "Donor")

IN FAVOUR OF:

[ATTORNEY NAME] of [ATTORNEY ADDRESS] (the "Attorney")

I, [CLIENT NAME], HEREBY APPOINT the above-named Attorney as my true and lawful attorney to do, execute and perform in my name and on my behalf all or any of the following acts and things in Nigeria:

1. To demand, sue for, collect and receive all sums of money due or becoming due to me;

2. To sign, execute and deliver cheques, receipts, documents and instruments;

3. To manage my real property, collect rents, grant tenancies and renew leases;

4. To appear before courts, government ministries, departments and agencies, and to appoint counsel;

5. To open, operate and close bank accounts on my behalf.

I AGREE to ratify all that my said Attorney lawfully does by virtue of these presents.

EXECUTED as a Deed by the Donor in the presence of:

_______________________________          _______________________________
[CLIENT NAME] — Donor                 Name / Address / Signature of Witness

NOTE: This Power of Attorney is presented for registration in accordance with the Powers of Attorney Act. Where executed abroad, it requires notarization and authentication for use in Nigeria.`,
    },
    {
      name: "Engagement Letter (General Practice)",
      description: "Standard retainer letter for general practice matters — scope, fees and reporting.",
      categoryName: "Engagement Letters",
      content: `[FIRM NAME]
[FIRM ADDRESS]

[TODAY'S DATE]

[CLIENT NAME]
[CLIENT ADDRESS]

RE: ENGAGEMENT — [MATTER TITLE]

Dear [CLIENT NAME],

Thank you for instructing this firm. We confirm our engagement to act for you in the above matter on the following terms:

1. SCOPE: [SCOPE OF ENGAGEMENT].

2. FEES: [LEGAL FEES] plus disbursements and VAT; interim invoices rendered [BILLING FREQUENCY].

3. HANDLING SOLICITOR: [SOLICITOR NAME].

4. UPDATES: We will update you on material developments and respond to your enquiries within two (2) working days.

5. DOCUMENTS: All originals supplied will be returned at the conclusion of the matter.

6. GOVERNING LAW: Nigerian law.

Kindly countersign and return a copy to confirm acceptance.

Yours faithfully,

[SIGNATORY NAME]
[SIGNATORY TITLE]
For: [FIRM NAME]

ACCEPTED:

_______________________________          _______________________________
[CLIENT NAME]                          Date`,
    },
  ],

  "Immigration": [
    {
      name: "Immigration Petition Cover Letter",
      description:
        "Cover letter to the Nigeria Immigration Service / Comptroller-General for residence permits, STR or regularization.",
      categoryName: "Correspondence",
      content: `[FIRM NAME]
[FIRM ADDRESS]

[TODAY'S DATE]

The Comptroller-General
Nigeria Immigration Service
[COURT ADDRESS / NIS HQ ADDRESS]

RE: APPLICATION FOR [PERMIT TYPE — e.g. STR / RESIDENCE PERMIT / RE-ENTRY VISA] — [CLIENT NAME] (PASSPORT NO: [PASSPORT NUMBER])

We act as Solicitors to [CLIENT NAME], a national of [COUNTRY] seeking [PERMIT TYPE] to [PURPOSE — take up employment with / join spouse in] Nigeria.

We forward for your kind consideration:

1. Application form (immmp [FORM NUMBER]) duly completed;
2. Passport data page of the applicant (Exhibit A);
3. Letter of employment / [SUPPORTING DOCUMENT] (Exhibit B);
4. Expatriate quota approval where applicable (Exhibit C);
5. Evidence of payment of the prescribed fees;
6. [FIRM REG NUMBER] — NBA seal confirmation.

We respectfully request that the application be given kind consideration and the permit issued accordingly.

Yours faithfully,

[SIGNATORY NAME]
[SIGNATORY TITLE]
For: [FIRM NAME]`,
    },
  ],
};

// ---------------------------------------------------------------------------
// ATRIUM (property) — keyed by portfolio-type key (ATRIUM_PROFILES keys)
// ---------------------------------------------------------------------------

export const ATRIUM_DOCUMENT_TEMPLATES: Record<string, DocumentTemplateBlueprint[]> = {
  residential: [
    {
      name: "Tenancy Agreement (Residential)",
      description:
        "Residential tenancy agreement with the state's tenancy-law notice clause — rent, deposit and quiet enjoyment.",
      categoryName: "Tenancy Documents",
      content: `TENANCY AGREEMENT (RESIDENTIAL)

THIS AGREEMENT is made on [TODAY'S DATE] BETWEEN [LANDLORD NAME] ("the Landlord") AND [TENANT NAME] ("the Tenant").

1. The Landlord lets to the Tenant: [PROPERTY ADDRESS] (the "Premises").

2. TERM: from [LEASE START DATE] to [LEASE END DATE].

3. RENT: [RENT AMOUNT] per annum, payable in advance on or before [RENT DUE DATE].

4. DEPOSIT: [SECURITY DEPOSIT], refundable at the end of the tenancy less deductions for damage beyond fair wear and tear.

5. The Tenant shall use the Premises for residential purposes only and shall not sublet without the Landlord's written consent.

6. The Landlord shall keep the roof and main structure in good repair; the Tenant shall keep the interior clean and in good condition.

7. The Tenant shall pay for electricity, water and waste charges consumed on the Premises, excluding amounts covered by [SERVICE CHARGE].

8. TERMINATION: Either party may terminate by [NOTICE PERIOD — per the tenancy law of {{STATE_NAME}}] written notice in accordance with the applicable tenancy law of {{STATE_NAME}}.

9. This Agreement is governed by the laws of the Federal Republic of Nigeria.

SIGNED:

_______________________________          _______________________________
[LANDLORD NAME] — Landlord              [TENANT NAME] — Tenant

WITNESS: _______________________________ (Name / Address / Signature)`,
    },
    {
      name: "Rent Demand Notice",
      description:
        "Rent demand notice to a defaulting tenant — outstanding amount, late penalties and recovery warning.",
      categoryName: "Tenancy Documents",
      content: `[FIRM NAME / LANDLORD LETTERHEAD]
[FIRM ADDRESS]

[NOTICE DATE]

[TENANT NAME]
[PROPERTY ADDRESS]

DELIVERED BY HAND / BY BALIFF

RE: DEMAND FOR OUTSTANDING RENT — [PROPERTY ADDRESS]

TAKE NOTICE that rent on the above Premises stands unpaid as follows:

  Rent for the period [LEASE START DATE] to [LEASE END DATE] .......... [RENT AMOUNT]
  Late payment penalty (per clause [CLAUSE NO.]) ..................... [PENALTY RATE / AMOUNT]
  TOTAL OUTSTANDING .................................................... [TOTAL AMOUNT]

You are required to pay the total outstanding sum within SEVEN (7) days of receiving this notice to [PAYMENT ACCOUNT DETAILS].

FURTHER TAKE NOTICE that failing payment, the Landlord shall enforce recovery in accordance with the applicable tenancy/recovery of premises law of {{STATE_NAME}}, including recovery of possession and arrears, entirely at your cost.

[LANDLORD NAME] / [SIGNATORY NAME]
[SIGNATORY TITLE]`,
    },
    {
      name: "Notice to Quit",
      description:
        "Statutory notice to quit determining a tenancy — notice period per the state's recovery-of-premises law.",
      categoryName: "Tenancy Documents",
      content: `[FIRM NAME / LANDLORD LETTERHEAD]
[FIRM ADDRESS]

[NOTICE DATE]

[TENANT NAME]
[PROPERTY ADDRESS]

BY BALIFF / REGISTERED POST

RE: NOTICE TO QUIT AND DELIVER UP POSSESSION — [PROPERTY ADDRESS]

TAKE NOTICE that, pursuant to the applicable recovery of premises law of {{STATE_NAME}}, the Landlord hereby requires you to QUIT and deliver up peaceful possession of the above Premises on or before the expiration of [NOTICE PERIOD — statutory period] from the service of this notice, i.e. on or before [DEADLINE DATE].

The tenancy will NOT be renewed. Kindly note:

1. Rent must continue to be paid to date for the period of your occupation;
2. All outstanding charges ([SERVICE CHARGE] etc.) must be settled before exit;
3. The Premises must be returned in good condition, fair wear and tear excepted;
4. Your [SECURITY DEPOSIT] will be refunded after the exit inspection and settlement of all outgoings.

FURTHER TAKE NOTICE that if you fail to comply, the Landlord shall commence recovery of possession proceedings at the appropriate court without further reference to you, at your cost.

[LANDLORD NAME] / [SIGNATORY NAME]
[SIGNATORY TITLE]`,
    },
  ],
  commercial: [
    {
      name: "Tenancy Agreement (Commercial)",
      description:
        "Commercial lease — use covenants, service charge contribution, insurance and rent review clauses.",
      categoryName: "Tenancy Documents",
      content: `COMMERCIAL TENANCY AGREEMENT

THIS AGREEMENT is made on [TODAY'S DATE] BETWEEN [LANDLORD NAME] ("the Landlord") AND [TENANT NAME] ("the Tenant").

1. The Landlord lets to the Tenant: [PROPERTY ADDRESS] (the "Premises") for use as [PERMITTED USE — e.g. retail shop / office].

2. TERM: [TENANCY TERM] from [LEASE START DATE] to [LEASE END DATE].

3. RENT: [RENT AMOUNT] per annum, payable in advance. Rent review: the rent may be reviewed upward by mutual agreement at [REVIEW INTERVAL].

4. SERVICE CHARGE: The Tenant shall pay [SERVICE CHARGE] per annum as contribution to common services (security, cleaning, refuse disposal, common-area electricity), payable [BILLING FREQUENCY] and subject to annual reconciliation.

5. The Tenant shall not alter the Premises structurally without written consent, and shall keep the interior in good repair.

6. The Tenant shall insure its stock and fittings; the Landlord insures the structure.

7. The Tenant shall not assign or sublet without the Landlord's prior written consent.

8. TERMINATION: [NOTICE PERIOD] written notice, in accordance with the applicable law of {{STATE_NAME}}.

9. This Agreement is governed by the laws of the Federal Republic of Nigeria.

SIGNED:

_______________________________          _______________________________
[LANDLORD NAME] — Landlord              [TENANT NAME] — Tenant

WITNESS: _______________________________ (Name / Address / Signature)`,
    },
    {
      name: "Service Charge Demand Notice",
      description:
        "Annual service charge demand with reconciliation line items and due date.",
      categoryName: "Tenancy Documents",
      content: `[FIRM NAME / LANDLORD LETTERHEAD]
[FIRM ADDRESS]

[NOTICE DATE]

[TENANT NAME]
[PROPERTY ADDRESS]

RE: SERVICE CHARGE DEMAND — [BILLING PERIOD / YEAR]

We refer to your tenancy of the above Premises. The service charge contribution for [BILLING PERIOD] is assessed as follows:

  Security ......................................................... [AMOUNT]
  Cleaning & waste ................................................ [AMOUNT]
  Common-area electricity & water ................................. [AMOUNT]
  Repairs & maintenance ........................................... [AMOUNT]
  Facility management fee ......................................... [AMOUNT]
  ------------------------------------------------------------
  TOTAL SERVICE CHARGE ............................................ [SERVICE CHARGE]

DUE DATE: [RENT DUE DATE]. Payment to [PAYMENT ACCOUNT DETAILS].

The total is based on the actualized costs for the period; a reconciliation statement against your prior advance payment is attached (Exhibit A), with the balance carried forward as shown.

Please note that service charge is payable within the tenancy agreement's stipulated time; persistent default is a breach of covenant.

[LANDLORD NAME] / [SIGNATORY NAME]
[SIGNATORY TITLE]`,
    },
  ],
  shortlet: [
    {
      name: "Short-Let Agreement (Serviced Apartment)",
      description:
        "Nightly/weekly serviced-apartment agreement — check-in rules, deposit, house rules and cancellation.",
      categoryName: "Tenancy Documents",
      content: `SHORT-LET AGREEMENT

THIS AGREEMENT is made on [TODAY'S DATE] BETWEEN [LANDLORD NAME] ("the Host") AND [TENANT NAME] ("the Guest").

1. PREMISES: [PROPERTY ADDRESS] (the "Apartment"), booked for [NUMBER OF GUESTS].

2. PERIOD: from [LEASE START DATE] (check-in [CHECK-IN TIME]) to [LEASE END DATE] (check-out [CHECK-OUT TIME]).

3. RATE: [RENT AMOUNT] per night, totalling [TOTAL AMOUNT] for the stay, paid in advance.

4. DEPOSIT: [SECURITY DEPOSIT], refundable within [REFUND PERIOD] after check-out subject to deductions for damage, missing items, or breach of house rules.

5. The rate includes: electricity, water, Wi-Fi, weekly cleaning, and [INCLUDED SERVICES]. Excluded: laundry, [EXCLUDED SERVICES].

6. HOUSE RULES: no parties, no subletting, no pets unless agreed; quiet hours [QUIET HOURS].

7. CANCELLATION: [CANCELLATION POLICY — e.g. free cancellation up to 48 hours before check-in; thereafter one night is charged].

8. This Agreement is governed by the laws of the Federal Republic of Nigeria.

SIGNED:

_______________________________          _______________________________
[LANDLORD NAME] — Host                  [TENANT NAME] — Guest`,
    },
  ],
  land: [
    {
      name: "Offer of Sale (Land)",
      description:
        "Offer of sale for a land parcel — survey details, payment terms and governor's-consent condition.",
      categoryName: "Tenancy Documents",
      content: `OFFER OF SALE

[NOTICE DATE]

[TENANT NAME / OFFEREE NAME]
[CLIENT ADDRESS]

RE: OFFER OF SALE — [PROPERTY ADDRESS] / [PLOT DESCRIPTION]

We act for [LANDLORD NAME] (the "Vendor"), the holder of a [TITLE TYPE — e.g. Certificate of Occupancy / registered deed of assignment] over ALL THAT parcel of land more particularly described and delineated on the survey plan no. [SURVEY NUMBER] (the "Land").

1. OFFER: The Vendor offers the Land for sale at [RENT AMOUNT / CONSIDERATION AMOUNT].

2. PAYMENT: [PAYMENT TERMS — e.g. 30% initial deposit, balance within 60 days].

3. DOCUMENTS: Upon full payment, the Vendor shall execute a Deed of Assignment in the Offeree's favour and deliver the original title documents and survey plan.

4. GOVERNOR'S CONSENT: The assignment is subject to the Governor's consent under the Land Use Act 1978; consent fees in {{STATE_NAME}} shall be borne by [PARTY — customarily the Assignee].

5. VALIDITY: This offer is open for acceptance until [DEADLINE DATE].

Acceptance is effective on payment of the initial deposit.

[LANDLORD NAME] / [SIGNATORY NAME]
[SIGNATORY TITLE]`,
    },
  ],
};

// ---------------------------------------------------------------------------
// Resolver helpers (same shape as getProfilesForAreas — unknown keys ignored)
// ---------------------------------------------------------------------------

/**
 * Legal templates for the selected practice areas, rendered for the firm's
 * primary state. Unknown area keys are ignored; stateOnly templates are
 * filtered by the firm's primary state; results are name-de-duplicated.
 */
export function getLegalDocumentTemplates(
  areas: string[],
  stateKey?: string,
): { name: string; description: string; categoryName: string; content: string; placeholders: string[] }[] {
  const out: ReturnType<typeof renderTemplateBlueprint>[] = [];
  const seen = new Set<string>();
  for (const area of areas) {
    const bps = LEGAL_DOCUMENT_TEMPLATES[area] || [];
    for (const bp of bps) {
      if (bp.stateOnly && bp.stateOnly !== stateKey) continue;
      const rendered = renderTemplateBlueprint(bp, stateKey);
      const key = rendered.name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(rendered);
    }
  }
  return out;
}

/** Atrium templates for the selected portfolio types (focus overlays add none). */
export function getAtriumDocumentTemplates(
  portfolioTypes: string[],
  stateKey?: string,
): { name: string; description: string; categoryName: string; content: string; placeholders: string[] }[] {
  const out: ReturnType<typeof renderTemplateBlueprint>[] = [];
  const seen = new Set<string>();
  for (const ptype of portfolioTypes) {
    const bps = ATRIUM_DOCUMENT_TEMPLATES[ptype] || [];
    for (const bp of bps) {
      if (bp.stateOnly && bp.stateOnly !== stateKey) continue;
      const rendered = renderTemplateBlueprint(bp, stateKey);
      const key = rendered.name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(rendered);
    }
  }
  return out;
}
