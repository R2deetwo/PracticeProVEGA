# Proposal — Komplete Client-Facing Identity (K-7)

**Status: PROPOSAL ONLY — awaiting owner approval. No property/rent portal functionality is introduced or changed by this document.**

Date: 2026-11-11
Scope: The client-facing (portal) experience of unified (Komplete) firms.

---

## 1. Current state (investigated, not changed)

A unified firm operates one business with two service lines, but its client-facing
surfaces are branded and siloed as if it were two companies:

| Surface | Current behaviour for a unified firm |
| --- | --- |
| Portal invite emails | Hardcoded `productName = "VEGA"` or `"ATRIUM"` (convex/portals.ts ~1536, ~1991) — the client is told they are joining "VEGA" even when the firm is Komplete |
| Portal-type resolution | `user.product === 'atrium' ? 'resident' : 'client'` (portals.ts ~4115) — unified-firm users default to the legal **client** portal; there is no path to the resident portal for the same firm |
| Client portal content | ClientDashboard is legal-only: matters, documents, invoices, messages. No property or rent data is visible, even for a client who is also a tenant/landlord of the firm |
| Resident portal | Tenancy-scoped (rent ledger, service charges, maintenance). No matter visibility |
| Setup/password screens | `productName = isClientPortal ? 'VEGA' : 'ATRIUM'` (SetupPassword.tsx ~201) |
| Legal/consent headers | ClientDashboard print/consent header renders "PracticePro VEGA" regardless of firm product |
| Terms/privacy routing | PortalTermsOfUse/PrivacyPolicy receive `activeProduct: 'vega'` (or `undefined`, which defaults to vega) for unified firms |
| Dual-portal settings | PortalAccessSettings already shows both sections for unified firms (`showClientPortal = hasLegalFeatures`, `showResidentPortal = hasPropertyFeatures`) — the only unified-aware surface today |

## 2. Problems this creates

1. **Identity confusion**: a client of a Komplete firm receives an email inviting
   them to "VEGA", logs into a portal branded "PracticePro VEGA", and sees none of
   the property relationship the firm also manages for them.
2. **Split relationships**: the same human — landlord of Plot 5 AND litigation
   client — has two portal accounts with no connection; the firm cannot present
   one coherent picture of the relationship.
3. **Confidentiality asymmetry by accident, not design**: the current split is a
   branding artifact, not a deliberate confidentiality boundary. Nothing today
   documents what a client may see of their property affairs or what a resident
   may see of their legal affairs.

## 3. Proposal (decision options)

### Option A — One Komplete client portal (recommended)

One portal per person, branded **PracticePro** (firm name forward), with
service-line sections:

- **Branding**: neutral PracticePro identity for unified firms (VEGA/ATRIUM
  branding retained for single-product firms). Invite emails use the firm's name
  + "PracticePro" — never a product line the firm didn't buy.
- **Service distinction**: two clearly labelled sections — "Legal Services"
  (matters, documents, legal invoices) and "Property Services" (their tenancies,
  rent ledger, service-charge statements, maintenance requests) — each visible
  only if the person actually has records of that type.
- **Property/rent visibility**: a client sees only the properties where they are
  the tenant, landlord, or owner on record — the same scoping the resident
  portal applies today, reused as a section.
- **Matter ↔ property relationship presentation**: where a matter is linked to a
  property (matter.specialtyData.realEstate.propertyId), each side shows a
  cross-reference card ("Related: Plot 5 tenancy" / "Related: Recovery suit
  FHC/L/CS/123/2025"). Cross-links never leak content — they name the record and
  link to its section.
- **Client access permissions**: per-person, derived from their records:
  - legal section ⇐ they are a contact on ≥1 matter (existing client-portal rule)
  - property section ⇐ they are tenant/landlord/owner on ≥1 property or unit
    (existing resident-portal rule)
  - nothing else; no firm-wide views.
- **Confidentiality boundaries** (explicit, documented, enforced server-side):
  - a person sees ONLY their own matters/tenancies/invoices — never another
    client's, never the firm's ledgers;
  - legal-privileged content (documents, matter notes) never renders in the
    property section and vice versa;
  - internal annotations (task notes, AI drafts, worklogs) are never portal-
    visible (already true; restated as a boundary);
  - the cross-reference cards expose only record TITLES, never content, so the
    existence of a linked record is the only new information.

**Migration path**: keep both existing portals for single-product firms; for
unified firms, resolve one portal per person with both sections. The
`portalType` resolution gains a unified branch. No data migration needed — both
account types exist today and are linked by email/firm.

### Option B — Two portals, honest branding

Keep two separate portals (legal + resident) but rebrand both to the firm's
PracticePro identity for unified firms, fix the invite-email product names, and
add cross-links between them ("You also have a property relationship with this
firm — open Property Services"). Lower effort, but the client still juggles two
logins and two inboxes.

### Option C — Status quo with corrected naming only

Fix the hardcoded VEGA/ATRIUM strings in invite emails, SetupPassword, consent
headers and terms routing (small, safe), and defer the unified portal. This
solves the most visible confusion (the emails) but not the split relationship.

## 4. Owner decisions required

1. **Which option** (A / B / C) — A is the strategic fit for "one unified
   product" but is the largest build; C can ship independently this week.
2. **Brand rule**: does "PracticePro" (platform brand) front the client
   experience for unified firms, with VEGA/ATRIUM reserved for single-product
   firms? (Marketing-site language currently promises per-product portals.)
3. **Cross-section visibility default**: may a client's property section show
   legal record TITLES (cross-reference cards) by default, or opt-in per
   relationship? (Confidentiality posture decision.)
4. **Naming**: "Property Services" / "Legal Services" as section labels, or
   owner's preferred wording.

## 5. Explicitly NOT in this proposal

- No new property/rent portal functionality is implemented.
- No change to the resident portal's existing capabilities.
- No change to Paystack, WhatsApp templates, or external provider contracts
  (the invite-email product name is OUR copy, not a provider template variable).
- Portal data-access rules are already server-scoped; this proposal changes
  presentation and one resolution branch, and every new surface would reuse the
  existing per-person scoping rather than inventing new access rules.

— End of proposal. Implementation begins only after owner approval.
