**Tag:** Data Privacy
**Read Time:** 21 min read
**Summary:** A practical, audit-ready compliance primer for Nigerian law firms under the NDPA 2023 — data controller registration, lawful basis, data subject rights, breach notification, vendor DPAs, and a retention schedule template. Written for practice managers and managing partners, not privacy specialists.

---

# Data Privacy for Law Firms: The NDPA 2023 Compliance Primer

## Executive Summary

The Nigerian Data Protection Act 2023 didn't just formalize an existing informal expectation — it created enforceable obligations, a real regulator (the Nigeria Data Protection Commission, NDPC), and real penalties for firms that treat client data casually. Law firms sit in an unusual position under the Act: they are data controllers in their own right, handle some of the most sensitive personal data that exists (litigation records, financial disclosures, biometric identifiers on affidavits), and are simultaneously bound by confidentiality obligations that predate the NDPA by decades under professional conduct rules.

This primer is written to get a firm from "we've heard of the NDPA" to "we could survive an NDPC audit" — covering registration, lawful basis for processing, data subject rights, breach response, vendor management, and a retention schedule a firm can adapt directly. It closes with an audit-readiness checklist.

## 1. Are You a Data Controller? (Almost Certainly, Yes)

Under the NDPA, a **Data Controller** is any person or entity that determines the purposes and means of processing personal data. If your firm does any of the following, you are a data controller and the obligations below apply to you in full:

- Maintains client records — names, addresses, identification documents, next-of-kin details
- Processes financial information — bank details, payment records, fee narratives
- Stores biometric data — signatures, photographs, thumbprints on sworn documents
- Manages employee or staff records — payroll, performance records, disciplinary files
- Handles opposing-party or third-party personal data obtained through discovery, litigation, or transactional due diligence

There is no size threshold that exempts a small firm. A three-partner practice handling conveyancing files is a data controller in exactly the same legal sense as a full-service firm with 200 lawyers.

**Action required:** Register as a data controller via the NDPC portal (ndpc.gov.ng). Firms above certain processing thresholds may face additional obligations, including designating a Data Protection Officer — confirm your firm's specific threshold status directly with the NDPC or a data protection advisor, since thresholds and their application can change.

## 2. Lawful Basis: Naming It, Not Just Having It

Every processing activity needs a defined lawful basis — and "we're a law firm, of course we can process this" is not, on its own, a lawful basis. For most firm activity, the applicable bases are:

| Basis | When It Applies | Example |
|---|---|---|
| **Contractual necessity** | Processing required to perform the engagement | Holding a client's ID and address to open a file and issue invoices |
| **Legal obligation** | Compliance with a court order or regulatory requirement | Producing discovery documents, complying with AML/KYC checks |
| **Legitimate interest** | Firm interest that doesn't override the individual's rights | Retaining closed-file records for professional indemnity purposes |
| **Consent** | Explicit, freely given, specific | Using a client's matter as an anonymized case study in marketing |

**The discipline that actually matters:** be able to state, for any category of data the firm holds, which basis applies — in a document, not just in someone's head. This is the single most common gap an audit finds: firms that are compliant in substance but cannot demonstrate it because nothing is written down.

## 3. Data Subject Rights: What Clients Can Actually Demand

Clients (and, in litigation, sometimes opposing parties whose data the firm holds) have enforceable rights under the NDPA:

- **Right of Access** — to request a copy of the personal data the firm holds on them
- **Right to Rectification** — to correct inaccurate or incomplete data
- **Right to Erasure** — to request deletion once the purpose for holding it has concluded, subject to the firm's legal retention obligations (see Section 4)
- **Right to Portability** — to receive their data in a structured, commonly used, machine-readable format

**Operational reality:** a firm needs a defined process for handling a rights request — who receives it, who verifies the requester's identity, what the response timeline is, and how a request is balanced against the firm's own retention obligations (a client cannot compel deletion of records the firm is legally required to retain for professional indemnity or CAMA purposes). Without this process documented, even a compliant firm will respond inconsistently, and inconsistency is what an audit flags first.

## 4. Retention: A Schedule, Not a Guess

The NDPA requires deletion once the purpose for collection has been fulfilled — but "fulfilled" for a law firm interacts with several other retention obligations that often run longer. A defensible retention schedule reconciles all of them rather than picking whichever is most convenient.

**Illustrative retention schedule** (firms should confirm exact periods against current statutory requirements and their professional indemnity insurer's requirements):

| Record Category | Typical Retention Trigger | Notes |
|---|---|---|
| Active client files | Duration of matter, plus a post-closure period | Aligns with professional indemnity and negligence limitation considerations |
| Financial and accounting records | Statutory minimum under CAMA and tax law | Independent of the matter's own retention period |
| Closed litigation files | Longer of limitation period for the underlying claim, or firm policy | Litigation files often warrant longer retention than transactional files |
| Marketing and business development records | Only while consent remains valid | Should be purged on withdrawal of consent, not left to expire passively |
| Employee records | Per labour law and pension requirements | Distinct from client-data retention rules |

**A retention schedule that isn't written down and actively enforced is not a retention schedule — it's an aspiration.** The practical failure mode isn't over-retention causing a breach; it's firms discovering, only when an NDPC inquiry lands, that they cannot say with confidence what they hold, why, or for how long.

## 5. Breach Notification: The 72-Hour Clock

The NDPA requires that data breaches likely to adversely affect the rights and freedoms of data subjects be reported to the NDPC within a defined window from the point the firm becomes aware of the breach — commonly referenced as 72 hours. That clock starts on *awareness*, not resolution, which is the detail most firms get wrong in a live incident.

**A firm's breach response procedure, in sequence:**

1. **Contain** — stop the breach from continuing (revoke access, isolate the affected system)
2. **Assess** — determine scope: what data, how many individuals, what likely harm
3. **Notify the NDPC** — within the statutory window, even if the full picture isn't yet known; supplementary detail can follow
4. **Notify affected individuals** — "without undue delay" where the risk to them is high
5. **Log it fully** — a breach register entry covering what happened, when it was discovered, what was done, and when notifications went out

**Have this written down before an incident, not during one.** In an active breach, the firm that already knows who calls the NDPC and who drafts the client notice responds in hours. The firm improvising this for the first time loses the 72 hours arguing about who's responsible.

## 6. Vendor Management: Your Compliance Extends to Every Processor

A **Data Processor** is a third party who processes personal data on the firm's behalf. Every processor in the firm's stack needs to be governed by a Data Processing Agreement (DPA) — and a surprising number of firms have vendors touching client data with no DPA in place at all.

| Vendor Category | Data Typically Processed | DPA Required |
|---|---|---|
| Cloud storage / practice management software | Full client and matter data | Yes |
| Email service provider | Client correspondence, attachments | Yes |
| Video conferencing tools | Meeting recordings, participant data | Yes |
| Payment processors | Financial and identity data | Yes |
| AI drafting/research tools | Whatever context is fed into prompts | Yes — see the companion paper on AI governance for the specific risks here |

**Minimum DPA terms to insist on:** processing restricted to documented purpose only, no sub-processing without written authorization, defined security standards, a committed breach notification timeline to the firm (so the firm can meet its own 72-hour obligation to the NDPC), and support for data subject rights requests.

## 7. PracticePro's Role as Your Processor

PracticePro acts as a Data Processor on behalf of your firm, the Data Controller. Our Data Processing Agreement:

- Restricts processing to documented, agreed purposes only
- Prohibits sub-processing without written authorization
- Aligns security practice with ISO 27001 principles
- Commits to breach notification to your firm within 24 hours of our own awareness — ahead of the statutory NDPC window, so your firm has runway to meet its own obligations
- Supports data subject rights requests through built-in export tooling, rather than requiring manual data extraction

## 8. Audit-Readiness Checklist

A firm that can answer "yes" to each of these could reasonably expect to survive an NDPC inquiry without major findings:

- [ ] We are registered as a data controller with the NDPC
- [ ] We have a written data map: what personal data we hold, where, and why
- [ ] Every category of processing has a documented lawful basis
- [ ] We have a written, adapted retention schedule — not just "we'll keep it a while"
- [ ] We have a documented process for handling data subject rights requests
- [ ] We have a written breach response procedure, tested at least notionally
- [ ] Every vendor touching personal data has a signed DPA on file
- [ ] Staff have received basic NDPA awareness training

## Conclusion

NDPA compliance for a law firm is not a one-time registration exercise — it's an operational discipline that has to survive contact with a live breach, a client's rights request, or an NDPC inquiry. Firms that write the policies down before they need them, and choose vendors and platforms that carry compliance obligations rather than create them, are the firms that treat this as manageable rather than existential. PracticePro is built to be the latter kind of vendor.

---

*This paper is provided for general guidance and does not constitute legal advice. Firms should confirm current statutory thresholds, timelines, and registration requirements directly with the NDPC or a qualified data protection advisor.*
