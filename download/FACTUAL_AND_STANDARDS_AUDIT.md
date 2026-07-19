# PracticePro — Factual Accuracy & Standards Compliance Audit

**Date:** 2026-07-19
**Scope:** Legal accuracy, contradictions, broken features, NDPA/WCAG compliance, data integrity
**Total findings:** 43 (12 Critical, 13 High, 12 Medium, 6 Low)

## TOP 12 CRITICAL ISSUES (Fix before launch)

### 1. Auth bypass — `convex/authHelpers.ts:26-28`
Unauthenticated callers can pass any email and access any firm's data. `requireFirmUser` falls back to client-supplied `userEmail` when no auth session exists.

### 2. Trust Account is firm-wide, not per-client — `convex/trustAccount.ts`
Marketed as per-client trust ledger but implements a single running balance. Client A's deposit can be withdrawn for Client B's matter = commingling = RPC Rule 23 violation.

### 3. Consent stored in localStorage, not DB — `TermsAcceptance.tsx`
ToS claims consent is "stored in our database" but it's only in localStorage (volatile, device-local). NDPA §25 requires demonstrable consent records.

### 4. 9 stub handlers fire fake success toasts — `DataProvider.tsx:368-388`
`handleSyncGoogleContacts`, `handleExportData`, `handleInviteExternalCounsel`, etc. — all show "success" but do nothing.

### 5. "Download Archive" produces no file — `DataManagementSettings.tsx:405`
Violates NDPA §37(1)(e) right to data portability. Button calls stub handler.

### 6. Privacy Policy misrepresents AI data flow — `PrivacyPolicy.tsx:255`
Claims PracticePro uses Google Gemini API as sub-processor. Reality: user provides their own API key (browser→Google directly). Different legal data-flow model.

### 7. Two different entity names in legal docs
PortalTermsOfUse says "PracticePro Technologies Limited"; ToS/DPA/Privacy Policy say "PracticePro Legal Technologies Limited". Ambiguous who user contracts with.

### 8. Fake payment gateway — `PaymentGatewayModal.tsx`
No Paystack/Flutterwave integration exists, but DPA lists them as sub-processors. Modal just shows bank transfer instructions + a checkbox.

### 9. ToS says SHA-256, code is PBKDF2 — `TermsOfService.tsx:310`
Contradicts actual implementation (PBKDF2-SHA512 100k iterations).

### 10. "Recovery of Premises Act" cited as federal law — `PropertyDetailView.tsx:637`
No federal Act by that name. Recovery is governed by STATE laws (e.g., Lagos Tenancy Law 2011).

### 11. Floating-point naira in Convex schema — financial precision loss
All currency stored as `v.number()` (JS float). 0.1 + 0.2 = 0.30000000000000004. Silent rounding errors in ledgers and invoices.

### 12. CSP allows unsafe-eval + unsafe-inline — `index.html:8`
Combined with localStorage API key, any XSS = full API-key theft.

## REMAINING FINDINGS BY CATEGORY

### Legal/Factual Errors (11 findings)
- NBA "enrollment number" should be "Call to Bar Number / SCN"
- RPC title inconsistent across ToS (two different titles)
- Court of Appeal citation format non-standard
- Statement of Claim timing wrong (should be concurrent with Writ)
- Remuneration scale missing tiers (over-charges on high-rent leases)
- Magistrate Court monetary limits are 1990s-era figures
- Remuneration Order applied to non-land matters (outside scope)

### Contradictions (15 findings)
- Invitation expiry: UI says 7 days, code says 30 days
- SOC 2 badge with no SOC 2 attestation
- ISO 27001 "alignment" with no certificate
- ALOA® vs ALOA™ (® illegal for unregistered marks)
- Three different "Effective Dates" across legal docs
- "Payment Confirmed" badge shown after unverified checkbox
- NairaSymbol component drops className prop

### Stubs/Dead Features (9 findings)
- Bookmark case feature doesn't persist
- Client "Mark as Reviewed" doesn't sync to server
- External counsel invite doesn't send
- Data export produces no file
- uiUtils.ts is a placeholder file

### Standards Violations (16 findings)
- Viewport disables pinch-zoom (WCAG 1.4.4)
- No account-termination deletion cron (NDPA §35)
- DPO contact is free Gmail address
- PBKDF2 iterations below OWASP minimum (100k vs 600k)
- Plaintext password comparison in legacy migration path
- No rate-limit on visitor token / setupPassword endpoints
- Cross-border transfer vague (NDPA §41)
- No per-IP rate limiting on auth endpoints

### Data Integrity (13 findings)
- Receipt/invoice/reference numbers use Math.random (collisions likely)
- Non-atomic invoice sequence (race condition)
- Trust transaction deletion rewrites history (no audit trail)
- Date-only strings parse as UTC (timezone display errors)
- Phone number normalization incomplete
- parseFormattedNumber silently accepts invalid input
