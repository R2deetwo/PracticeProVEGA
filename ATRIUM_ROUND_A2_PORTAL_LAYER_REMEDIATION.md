# ATRIUM OS — ROUND A2: PORTAL-LAYER REMEDIATION REPORT (2026-11-08)

**Companion to:** ATRIUM_AUDIT_R75.md (the R75 audit register) and the Round A
stop-the-bleed (commit `3992a360`). **Round A commit is untouched**; this work
is a separate commit on top.

**Mandate (owner):** review all 44 additional portal-layer functions identified
as potentially vulnerable in the Round A report; classify each by *actual*
authentication requirements and risk — not blindly gating everything; fix
unauthenticated reads, unauthorised mutations, impersonation and cross-firm
access; preserve intentionally-public token-based invitation and login flows;
add regression tests for authorised and unauthorised scenarios; verify resident
and staff portal workflows still work.

---

## 1. Method

1. Enumerated **every public (non-internal) function** in the five portal-layer
   modules (`portals.ts`, `estateCommunity.ts`, `visitorManagement.ts`,
   `wallets.ts`, `communications.ts`) — 156 public functions — and flagged all
   that call none of the auth helpers (`requirePortalCaller`,
   `requireStaffCaller`, `resolveCaller`, `requireFirmUser`, `requireAdmin`,
   `requireFounder`, `assertSameFirm`-family). That produced **59 unauth-marked
   public functions**: 43 in `portals.ts`, 11 in `estateCommunity.ts`, 5 in
   `visitorManagement.ts` — a superset of the 44 flagged in the Round A report
   (the report's list predated this sweep's verification that 11
   estateCommunity mutations and 5 gatehouse functions belong to other
   categories).
2. For each flagged function: read the full handler, traced **every caller
   repo-wide** (frontend `src/`, server-side `convex/` cross-references,
   tests) to establish the *intended* access model, and classified it.
3. Remediated per class (§3–§6), added regression tests (§8), and re-ran the
   full quality gates (§9).

**Auth vocabulary used below** (all server-side, from `callerAuth.ts` /
`authHelpers.ts`, R16 strict-identity mode — bearer session or rejection,
no anonymous fallback):
- **staff auth** — `requireStaffCaller`: Admin/Lawyer/Paralegal/ExternalCounsel/Founder; portal roles rejected; optional firm binding.
- **portal auth** — `requirePortalCaller`: Tenant/Client only; staff rejected.
- **any-session** — `resolveCaller`: any signed-in user.
- **firm binding** — `assertSameFirm(caller, firmId)`: the firm on the *server-side record*, never a caller-supplied id.
- **identity rebinding** — caller-supplied ids/emails are accepted **only** when they are one of the session caller's own aliases (`_id`, login email, `tokenIdentifier`, legacy `tenantId`, linked contact id); anything foreign is rebound to the caller (reads) or the write is bound to the session (writes).

---

## 2. Classification summary (all 59 unauth-marked functions)

| Class | Count | Action |
|---|---|---|
| **A. Live + vulnerable → fixed** | 29 | Server-side auth + firm binding + identity rebinding (per-function model in §3) |
| **B. Dead code (zero callers) → deleted** | 9 | Removed from the public API (Round 8 precedent: dead + unauthenticated = deleted) |
| **C. Dead-but-internally-used → internalised** | 1 | `getPortalInviteById` → `internalQuery` (off the public surface; its one caller is the staff-gated `resendPortalInvite`) |
| **D. Intentionally public token flows → preserved** | 4 | `getInviteByToken`, `acceptPortalInviteByToken`, `verifyInviteToken`, `setupPortalPassword` — the crypto-random invite token is the capability |
| **E. False positives (already strict)** | 11 | estateCommunity admin mutations — all call `requireAdmin` (strict session + Admin role + entity firm binding) |
| **F. Intentionally public, Round A mitigations in force** | 5 | Gatehouse surface (`verifyToken`, `checkInVisitor`, `checkOutVisitor`, `getGatehouseLogs`, `getGatekeeperProperties`) — throttled, code-possession check-ins, minimised PII (C8) |

---

## 3. Class A — the 29 fixed functions, with their access models

### 3.1 Staff ticket management (`convex/portals.ts`)

| Function | Was | Now | Model |
|---|---|---|---|
| `assignTicketToTeamMember` | **Unauthenticated staff write** — anyone could reassign any ticket, auto-create tasks, and post portal messages as "Admin" | staff auth + record firm binding + assignee firm check + `assignedBy`/`deletedBy`-style audit fields bound to the session caller | Staff of the ticket's firm; the assigner is always the session caller |
| `getServiceRequestTypes` | Firm-scoped catalog read by bare `firmId` | any-session + firm binding | Signed-in resident/client/staff of that firm (portal renders it post-login) |
| `getAllServiceRequestTypes` | Same, but includes disabled types (admin config) | staff auth + firm binding | Staff only |
| `createServiceRequestType` | **Unauthenticated admin write** (also auto-posts a pinned notice) | staff auth + firm binding | Staff only |
| `getMaintenanceTicketsByProperty` | Bare `propertyId` read — tickets carry tenant context | staff auth + **property's own firm** binding (resolves `_id` then custom id) | Staff of the property's firm |

### 3.2 Invite directory (contains live invitation tokens)

| Function | Was | Now | Model |
|---|---|---|---|
| `getPortalInvitesByFirm` | The invite list (incl. **live tokens**) was readable by anyone | staff auth + firm binding | Staff of the firm |
| `getPortalInvitesByEmail` | Email probe over invite records across ALL firms | staff auth + results filtered to the caller's firm | Staff; only their firm's invites ever return |

### 3.3 Portal self-service

| Function | Was | Now | Model |
|---|---|---|---|
| `relinkPortalUserToProperty` | **Unauthenticated mutation rewriting property tenancy links** for any email in any firm | portal auth + firm binding + email forced to the session caller's own | The signed-in resident may relink **themselves**, inside their own firm only |
| `resolveFirmFromInvite` | **Unauthenticated account-existence oracle** — probe any email → their firm + portal type | any-session + email rebound to the caller's own aliases | Post-login firm resolution (its only callers: DataProvider, TenantPortal, ClientDashboard, ClientMatterDetailView — all pass the bearer now) |

### 3.4 Client-portal data (IDOR class — bare ids)

| Function | Was | Now | Model |
|---|---|---|---|
| `getClientServiceRequestsByClient` | Read any client's requests by bare `clientId` | portal auth + `clientId` rebound (contact-id-aware aliases) | The client reads their own; foreign ids return their own/none |
| `getClientContactByUserId` | Contact record (name/email/phone/address) by bare `userId` | portal auth + firm binding + `userId` rebound | The client's own contact only |
| `getClientMattersByUserId` | Matter list by bare `userId` | portal auth + firm binding + `userId` rebound | The client's own matters only |
| `getClientMessages` | Client messages by bare `firmId`+`contactId` | portal auth + firm binding + `contactId` rebound | The client's own messages only |
| `getClientActivity` | Same, activity feed | same | same |
| `getClientInvoices` | Same, invoices | same | same |
| `getPortalUserConsentRecords` | Consent records by bare `email` (probe) | portal auth + email rebound | The resident's own records only |
| `getClientConsentRecords` | Same, client variant | same | same |

### 3.5 Portal messaging (IDOR + impersonation class)

| Function | Was | Now | Model |
|---|---|---|---|
| `getPortalConversationsByFirm` | Staff inbox (participant names/emails/previews) readable by anyone | staff auth + firm binding | Staff of the firm |
| `getPortalConversationsByParticipant` | Conversation list by bare `participantId` | portal auth + `participantId` rebound (contact-id-aware) | The caller's own conversations only |
| `getConversationMessages` | **The IDOR: a bare conversation id returned the whole thread to anyone** (used by staff inbox AND resident/client threads) | any-session; staff → conversation firm binding; portal user → must **be** the participant | Staff of the firm, or the conversation's own participant |
| `softDeletePortalMessage` | `requesterId` was caller-supplied — anyone could delete anyone's message by pairing ids | session auth runs **first** (unauthenticated callers learn nothing, not even existence); sender must be one of the caller's aliases; `deletedBy` = session caller | A portal user deletes their own message |
| `adminDeletePortalMessage` | The "cross-firm guard" compared a **caller-supplied** `firmId` and checked **no session at all** — anyone could soft-delete any portal message by id | staff auth + server-side record firm (message's, else its conversation's) + `deletedBy` = session caller | Staff of the message's firm |
| `hardDeleteConversation` | Code comment admitted "We don't have a firmId check here because the caller (MessagesView) already verifies" — client-side checks are not security | staff auth + conversation firm binding | Staff of the firm |
| `getPortalMessagesByFirm` | Firm-wide message read | staff auth + firm binding | Staff of the firm |
| `replyToPortalMessage` | Deprecated-but-live: **unauthenticated** patch + post-as-"Admin" | staff auth + message firm binding | Staff of the message's firm |

### 3.6 Notices, preferences

| Function | Was | Now | Model |
|---|---|---|---|
| `archiveNotice` | Unauthenticated bare-id patch + activity log | staff auth + notice firm binding | Staff of the notice's firm |
| `restoreNotice` | Same | same | same |
| `getAllNotices` | Admin board (incl. archived content) by bare `firmId` | staff auth + firm binding | Staff of the firm |
| `getNotificationPreferences` | Read unauthenticated (its paired update was already staff-gated — an inconsistency) | staff auth + firm binding | Staff of the firm |

---

## 4. Class B — deleted dead functions (9)

Each verified to have **zero callers repo-wide** (frontend, convex
cross-references, tests, both other products) before deletion:

| Function | Was |
|---|---|
| `respondToServiceRequest` | Unauthenticated status patch + admin message post (superseded by the Round-A-secured `updateMaintenanceTicketStatus` / `updateClientServiceRequestStatus`) |
| `getClientServiceRequestsByFirm` | Firm-wide client-request read |
| `getServiceRequestsByFirm` | Firm-wide ticket read |
| `getPortalMessagesBySender` | Per-sender message read |
| `getPortalMessageById` | Bare-id message read |
| `getNotice` | Bare-id notice read |
| `resolvePortalUserByToken` | `portalAccessToken` → email/name/firmId lookup, zero callers (App.tsx reads the token from the session user object, not the API) |
| `getFirmPortalInvites` | Duplicate of `getPortalInvitesByFirm` |
| `updateNotice` | Bare-id notice patch; its `sessionToken` arg existed but was never checked |

## 5. Class C — internalised (1)

`getPortalInviteById` was a public bare-id invite read returning **live
invitation tokens**. Its only caller is `resendPortalInvite` (a
`requireStaffCaller`-gated action). Converted to `internalQuery` and the caller
re-pointed to `internal.portals.getPortalInviteById` — the function is now
unreachable from the public API surface while the staff resend flow is
unchanged. (This is the one function the "zero callers" grep initially missed —
the in-module `ctx.runQuery(api.portals.…)` reference — caught by the Convex
typecheck during the round and resolved by internalisation, not deletion.)

## 6. Classes D/E/F — preserved public, false positives, intentional surface

- **D (4) — token flows, deliberately public.** `getInviteByToken`,
  `acceptPortalInviteByToken`, `verifyInviteToken`, `setupPortalPassword`:
  possession of the 12-char crypto-random invite token (62⁠char alphabet,
  `crypto.getRandomValues`) is the capability; these power the magic-link
  acceptance and password-setup pages that by definition run before any
  session exists. Status/expiry/revocation checks intact; re-accept
  guardrails intact. **Pinned by regression tests** (§8) so a future sweep
  cannot silently break the invitation flow by over-authenticating it.
- **E (11) — estateCommunity false positives.** `createAmenity`,
  `updateAmenity`, `deleteAmenity`, `reviewBooking`, `createBulletin`,
  `updateBulletin`, `archiveBulletin`, `createServiceProvider`,
  `updateServiceProvider`, `deleteServiceProvider` each call
  `requireAdmin(ctx, userEmail, sessionToken)` → `requireFirmUser` (R16
  strict mode: bearer session or rejection; no anonymous fallback) + explicit
  Admin-role guard + entity firm comparison. Verified by source-contract
  tests; no change needed (Round A C5 had already hardened this file's
  query layer and `cancelBooking`/`createBooking`).
- **F (5) — gatehouse, intentionally public.** The `/gatehouse` tablet is an
  unauthenticated kiosk by design; Round A (C8) added 30/min verify
  throttling, 6-digit-code-possession check-ins, dropped street addresses
  and internal ids, 60/min log throttle. Unchanged this round; pinned by
  the existing Round A tests plus a source-contract pin here.

---

## 7. Frontend bearer sweep

46 call sites across 16 files now pass the session bearer to the newly-secured
functions (the bearer loads synchronously from storage in `AuthContext`, so
first render carries it):

`MessagesView.tsx` (conversation list, firm messages, thread reads ×2, notice
board, bulk delete, bubble delete, legacy reply, ticket assign) · `Sidebar.tsx`
(unread badge) · `PropertyDetailView.tsx` (property tickets, notice board,
archive/restore) · `NoticeBoardTab.tsx` · `ServiceRequestTypesConfig.tsx`
(catalog read + create) · `PortalAccessSettings.tsx` (invite list + email
probe) · `NotificationSettings.tsx` · resident portal: `TenantPortal/index.tsx`,
`hooks.ts` (badges + self-heal relink), `MaintenanceTab.tsx`,
`MessagesTab.tsx` (conversations, thread, own-message delete),
`DocumentsTab.tsx` (consent records), `PortalStates.tsx` (repair-and-relink
button) · `ClientDashboard.tsx` (9 call sites) · `ClientMatterDetailView.tsx`
(4 call sites) · `DataProvider.tsx` (firm resolution).

A window-based verifier (`scripts/roundA2_verify_callsites2.py`) asserts every
reference to a secured function either passes the bearer inline, through a
shared args object, or at every invocation of its mutation variable — run
clean (46/46).

## 8. Regression tests — `tests/unit/portalLayerSecurity.test.ts` (105 new)

- **The unauthenticated sweep (29 tests):** every fixed function, called with
  no session, throws `Unauthenticated`/`verified session` — the endpoint
  sweep from the Round A acceptance gates, extended to this round's surface.
- **Authorised workflows (both directions):** staff assign/reply/delete/
  notice-archive/invite-read/catalog-create succeed with a same-firm session;
  residents/clients read their own tickets catalog, conversations, threads,
  contact, matters, messages, invoices, consent records, and delete their own
  messages; the self-heal relink works for the signed-in resident.
- **Abuse cases:** cross-firm record access (ticket, property tickets,
  conversation, message delete, notice archive, catalog read) throws;
  cross-tenant IDOR (another resident's thread, another client's contact/
  requests/messages) is refused or rebound to the caller's own data;
  impersonation is closed (`assignedBy` and `deletedBy` bind to the session
  caller even when the caller supplies a forged id; a forged `requesterId`
  cannot delete another sender's message); the caller-supplied-firmId bypass
  on `adminDeletePortalMessage` is dead; the `resolveFirmFromInvite` oracle
  returns the caller's own resolution when probing a foreign email.
- **Public-flow preservation pins:** the four token flows keep working
  without a session (valid/invalid/revoked invite paths), and
  `setupPortalPassword` remains token-gated (source contract: no
  session requirement inside).
- **Deletion source contracts:** the 9 dead exports are gone from the module
  and its source; `getPortalInviteById` exists only as `internalQuery`.
- **estateCommunity strictness pins:** all 10 admin mutations keep calling
  `requireAdmin`; `authHelpers` has no anonymous fallback; the gatehouse
  surface stays public-but-throttled.

## 9. Quality gates

| Gate | Result |
|---|---|
| `tsc --noEmit` (app) | **126 errors = HEAD baseline 126 — zero new** (verified by stash-diff of the error sets; the only deltas are pre-existing errors at shifted line numbers) |
| `tsc --noEmit` (convex) | clean |
| `vitest run` | **1,600 / 1,600 passed** (85 files; Round A's 1,495 + 105 new) |
| `vite build` | green in 22.2 s |
| `eslint .` | 0 errors / 77 warnings (baseline) |

## 10. Residual exposure (honest list)

1. **`getInviteByToken` returns the full invite record** (invitee email, name,
   firm id, related property id) to anyone holding a valid 12-char token.
   Kept as-is: the token is the capability and the setup flow needs the
   fields; the risk window is the invite's 7-day life and is equivalent to
   the emailed link itself being forwarded. A future hardening could minimise
   the response like `verifyInviteToken` already does.
2. **`acceptPortalInviteByToken` accepts on visit** (marks the invite
   accepted before the password is set). Idempotent and status-guarded;
   accepting grants nothing without `setupPortalPassword`.
3. **Invitation tokens remain bearer credentials** — compromise of an invite
   email/link allows account takeover until expiry/revocation. Inherent to
   magic-link invitations; revocation (`revokePortalInvite`) and 7-day expiry
   are the controls.
4. **`completePortalTask` (not in the flagged set — it already had auth)
   gates on `requireFirmUser`, which rejects portal roles**, yet its name and
   notification text ("A portal user marked…") imply a resident-facing
   action. Zero frontend callers today. Flagged for Round C (broken
   workflows) review rather than changed blind here.
5. **Rate limiting**: the newly-secured functions are now authenticated, so
   abuse requires a session; no additional per-function throttling was added
   this round (sessions can be revoked/suspended via the existing
   founder-gated security tooling).
6. Standing owner actions from Round A remain open (CHAKRA_WEBHOOK_SECRET on
   production, ALLOW_DEMO_SEED unset, CLOUDFLARE_API_TOKEN rotation).

## 11. Files changed (this round)

- `convex/portals.ts` — 29 functions secured, 1 internalised, 9 deleted, 1 helper added (`portalCallerExtendedAliases`)
- `src/` — 16 files updated (bearer sweep, §7)
- `tests/unit/portalLayerSecurity.test.ts` — new, 105 tests
- `worklog.md`, `ATRIUM_ROUND_A2_PORTAL_LAYER_REMEDIATION.md` — this record

No Vega OS / Komplete module was modified: all touched components are shared
Atrium surfaces whose Convex functions now enforce the auth their UIs already
assumed; every deletion was verified caller-free across all three products.
