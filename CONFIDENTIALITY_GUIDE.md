# CONFIDENTIALITY & DATA PROTECTION GUIDE

PracticePro holds privileged legal work product, client identity data, tenant financial records, and estate access logs. This document describes the confidentiality architecture — what protects that data, and what staff/operators must do to keep it protected.

Aligned to the **Nigeria Data Protection Act (NDPA) 2023**.

---

## 1. Platform-level protections (built-in)

| Protection | Mechanism |
|------------|-----------|
| **Firm isolation** | Row-level security: every query/mutation calls `requireFirmUser()` — a user in Firm A can never read or write Firm B's rows |
| **Portal user isolation** | Tenant/Client roles are blocked from firm-level operations; portal users resolve only to their own records |
| **AI PII Shield** | Text sent to the AI model passes through PII stripping/redaction first (Data Protection agent); badge shows shield state in the UI |
| **API key hygiene** | Gemini API key is held in memory only — never written to localStorage |
| **Notification ownership** | `markNotificationRead` verifies the caller owns the notification before patching |
| **Impersonation control** | Demo/impersonation requires short-lived, single-use, founder-only tokens (`convex/impersonation.ts`) — the old unsigned `?impersonate=` URL is gone |
| **Soft delete** | Records are soft-deleted with `deletedAt`/`deletedBy` — recoverable, auditable, never silently destroyed |
| **Audit trail** | Admin actions and security events are logged (`founderNotifications`, security logs) |
| **Screenshot protection** | Android: FLAG_SECURE; web: screenshot overlay in sensitive views |
| **Session replay: OFF** | Sentry crash reporting is enabled, but session replay is disabled by design — crash metadata only, never screen content |

---

## 2. Data handling rules for operators

1. **Never share portal credentials.** Portal invitations are per-person (`createPortalInvite`); each resident/client has their own account. Shared logins break the audit trail.
2. **Payment proofs contain bank details.** They are visible only to firm admins (`getPaymentProofsByFirm`); never forward them outside the platform.
3. **Gatehouse logs are personal data** (visitor names, phones, entry times). Guards see only what verification requires (`getGatehouseLogs` is property-scoped, not estate-wide).
4. **Exported data is your responsibility.** Founder-app exports (metrics, ledgers) contain client PII — store exports encrypted, share over secure channels only.
5. **AI transcripts stay in-platform.** Conversation memory is firm-scoped (`conversationMemory.ts`); do not paste privileged text into external AI tools.
6. **Report suspected breaches** through in-app Feedback immediately — it routes to the founder inbox with priority.

---

## 3. Resident/client rights (NDPA)

- **Access:** residents can view their own ledger, leases, documents, and receipts in the portal (self-service, no staff gatekeeper)
- **Portability:** firms can export ledgers/invoices on request from Billing
- **Rectification:** portal profiles let residents correct their own contact details; KYC corrections flow to the firm for approval
- **Erasure:** firm-side soft delete + feedback-thread data-restore/purge requests are handled via `submitDataRestoreRequest` (admin-reviewed)

---

## 4. What PracticePro does NOT do

- We do not sell or share firm data with third parties.
- We do not use firm data to train models — AI calls are stateless to the provider beyond the request.
- We do not read firm content operationally; support access happens only through logged, token-gated impersonation with the firm's own invite.

---

## 5. Breach response

1. Founder is notified through the priority feedback channel.
2. Affected sessions/tokens are revoked (impersonation and portal access tokens are revocable server-side).
3. Impacted firms are contacted with scope and remediation.
4. An incident note is added to the audit trail; NDPA supervisory authority notification is made where required by the Act.

For questions: **Privacy Policy** (`/privacy-policy`), **Data Processing Agreement** (`/data-processing-agreement`) — both public routes in-app.
