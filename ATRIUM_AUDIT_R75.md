# ATRIUM OS — BASELINE TECHNICAL AND FUNCTIONAL AUDIT (2026-11-08)

**Scope:** the complete Atrium OS product (property/estate management) — every module from the
staff app, resident portal, gatehouse, and public surfaces, down to its Convex backend, crons,
money paths, AI assistant (ARIA), and security posture. Audit-only: **no code was modified.**

**Basis:** five parallel deep-dive tracks (structure/properties, residents/payments/charges,
maintenance/amenities/VMS/portal, comms/ARIA/roles/reports, reliability/security/quality) over
the working tree at `c4552d0c` (= R74 application code `176eb905` + the R75 audit doc), every
finding with file:line evidence. The four highest-severity claims (wallet funding replay,
unauthenticated tenant reads, discarded-session maintenance writes, conditional-auth proof
approval) were additionally re-verified by direct read after the tracks returned. Non-destructive
technical checks were executed locally: `tsc --noEmit` **125 errors** (identical to the known
baseline — zero new), `vitest run` **1,424 tests / 83 files, all passing**, `vite build` **green
in 23.7 s**, `eslint .` **0 errors / 77 warnings** (style-guide deprecations, almost all on the
marketing sites).

**Relationship to DEEP_AUDIT_R75.md:** that audit (both apps, sites, AI stack) remains the master
list; its findings are **kept on the list** and carried forward in §11 below. This document is
the Atrium-specific, prompt-structured deep dive the owner requested — it goes deeper on every
Atrium module and adds a large set of newly-confirmed security and money-integrity defects that
the R75 pass did not surface.

**Naming note (read before using this doc):** "Sentry Pass" = visitor management, which lives in
`convex/visitorManagement.ts`. `convex/sentry.ts` is **not** visitor management — it is the
Atrium ledger / service-charge / automation-log engine (1,821 lines). `src/utils/sentry.ts` is
Sentry.io crash reporting. Three unrelated "sentry" things; this doc uses "Sentry Pass" only for
VMS.

---

## 1. Application architecture overview

**Stack:** one SPA (React 18, Vite 5, TypeScript, Tailwind 3) + Convex backend + Capacitor
Android wrappers (main + admin APKs). Three marketing surfaces (hub `/`, `/vega`, `/atrium`,
`/komplet`) share the SPA; the staff app, resident portal (`/portal/tenant`), gatehouse tablet
(`/gatehouse?firmId=`), public vacancy application (`/apply/:propertyId`), and portals are
in-app routes of the same build. Product identity resolves through `ProductContext`
(`isLegal` / `hasPropertyFeatures`; Komplete = both).

**Frontend → backend map (Atrium-specific surfaces):**

| Surface | Route / entry | Backend (Convex) | Tables |
|---|---|---|---|
| Property list (`PropertyManagerView.tsx`) | `/properties`, BottomNav primary for property firms | `myFunctions.getFirmData/createItem/updateItem/deletePropertyCascade` | `properties` |
| Property detail, 6 tabs (`details/PropertyDetailView.tsx`, 2,938 ln) | `/properties/:id` | `getPropertyDetails`, `portals.getMaintenanceTicketsByProperty`, notices CRUD, `sentry.addLedgerEntry`, `propertyRelationships.*` | `properties`, `maintenance_tickets`, `portal_notices`, `ledger_entries` |
| Tracking / leases (`details/PropertyTrackingView.tsx`, `LeaseProgressBars`, `ServiceChargeBars`) | detail tab | `sentry.addLedgerEntry/settleUnitPeriods`, `reportGenerator.generateReceiptPdf` | `properties` (embedded history arrays), `ledger_entries` |
| Relationships (`details/PropertyRelationshipsTab.tsx`) | detail tab | `propertyRelationships.*` (16 system types, Nigerian land-law ontology, LUA s.22 consent tracking) | `property_relationships`, `relationship_types` |
| Vacancy pipeline (`atrium/VacancyPipeline.tsx`) + public form (`atrium/AtriumPublicApplicationForm.tsx`) | Financials → Vacancies; `/apply/:propertyId` public | `sentry.addLeadToPipeline/submitPublicLead/advanceLeadStage/getPipelineByFirm` | `leads_pipeline` |
| Service-charge monitor (`atrium/ServiceChargeMonitor.tsx`) | Financials → Service Charges | `sentry.upsertServiceCharge/markChargeAsPaid/applyLatePenalty`, `chargeTypes.*` | `service_charges`, `charge_types`, `automation_logs` |
| Ledger manager (`atrium/LedgerManager.tsx`) | Financials → Payments & Receipts | `sentry.addLedgerEntry/getLedgerByFirm/getCashFlowSummary`, `financialIntegrity.*` | `ledger_entries`, `financial_audit_log` |
| Automation center (`atrium/AutomationCenter.tsx`) + `messaging/AutomationWorkflows.tsx` + `ScheduledTab.tsx` | Financials → Reminder Rules; Messages | `automationEngine.*` (workflows, steps, opt-outs, queue), `sentry.getAutomationLogs` | `automation_workflows`, `automation_dispatch_log`, `automation_unit_opt_outs` |
| Payment proofs (`atrium/PaymentProofsScreen.tsx` / `PaymentProofsTab.tsx`) | Financials → Payment Proofs | `portals.submitPaymentProof/updatePaymentProofStatus/getPaymentProofsByFirm` | `payment_proofs` |
| Resident portal (`tenant/TenantPortal/*`, 10 tabs) | `/portal/tenant`, login `/portal/tenant/login` | `portals.*` (tenant data, conversations, notices, proofs, tickets, docs), `wallets.*`, `visitorManagement.*`, `estateCommunity.*` | most Atrium tables |
| Visitor invite (`portal/VisitorPortal.tsx`, resident-side) | portal "Visitors" tab | `visitorManagement.generateVisitorToken/revoke/getResidentTokens` | `visitor_tokens` |
| Gatehouse (`portal/GatekeeperInterface.tsx`) | `/gatehouse?firmId=` public tablet URL | `visitorManagement.verifyToken/checkInVisitor/checkOutVisitor/getGatehouseLogs/getGatekeeperProperties` | `visitor_tokens` |
| Community (`tenant/EstateCommunityResidentView.tsx` + `settings/EstateCommunitySettings.tsx` toggles-only) | portal "Community" tab; Settings | `estateCommunity.*` (CRUD + reads) | `estate_amenities`, `estate_amenity_bookings`, `estate_bulletins`, `estate_service_providers` |
| Compose modal (`atrium/ComposeModal.tsx`) | global overlay | `communications.sendEmail/sendWhatsApp`, `portals.sendPortalMessage`, `sentry.logAutomation` | `automation_logs`, `scheduled_messages`, portal messaging |

**Crons (Atrium-relevant, `convex/crons.ts`):** `flagOverdueServiceCharges` (6-hourly) ·
`walletAutoDeduct` 06:15 UTC · `automationEngine` 06:30 UTC (the single orchestration pass —
rent/SC ladders, lease milestones, suppression gates, dedup ledger) · `ruleEngineSweep` 06:45 ·
`processScheduledMessages` (5-min dispatcher with claim/reclaim) · `monthlyServiceChargeReset`
(1st 00:30) · `cleanupExpiredVisitorTokens` (15-min) · `leaseExpiryAlerts` 07:00 · WhatsApp
template sync 05:45 · quota reset (1st) · proactive `detectAnomalies`/`generateMorningBriefing`.
Two legacy reminder crons retired 2026-09-14 (bodies still exported, unused).

**Shared with Vega/Komplete (not Atrium-owned):** `MessagesView` (Atrium inbox + portal
conversations), `BillingView` (unified Financials, per-tab product tags, legal/property/combined
scope), `ContactsView`, `TasksView`, `CalendarView` (+ Atrium virtual events), documents stack,
`NotesView`, `SettingsView`, `ReportingView`, `AloaChat` (ARIA persona), `ComposeModal`
(the one app-wide composer), Header/Sidebar/BottomNav product branching. Legal-only (gated):
Matters, Research, Contract Analyzer, Compliance, Retainer Monitor, Trust Account.

**Load-bearing architectural facts** (they explain most findings below):
1. **Units are embedded in `properties`** (`schema.ts:947` `units: v.array(v.any())`) and the app
   *also* treats sibling property rows sharing an address as units — two live unit models, four
   historical `unitId` shapes, mitigated by `unitLookup.ts` (a resolver that exists purely
   because the data model allowed four shapes).
2. **Isolation is firm-level only.** There is no "estate" or organisation entity in the data
   model; estate grouping is client-side address clustering (`usePropertyGroups.ts`). Firm A vs
   firm B isolation is enforced in *authed* code but is absent on a specific set of portals/
   estateCommunity endpoints (§5).
3. **`convex/portals.ts` (6,922 lines) is the resident-facing service layer and never received
   the R16/R17 auth hardening** that `visitorManagement.ts`, `wallets.ts`, and
   `estateCommunity.ts` got. That inversion — hardened backends whose *frontends* forgot to pass
   the new tokens, and an unhardened backend whose frontends work fine — produces both the worst
   security holes and the worst UX bugs in this audit.
4. **`schemaValidation:false`** (`schema.ts:2942-2947`, PHASE 0 REVERT) — the DB accepts
   off-schema inserts silently (e.g. server code reads `properties.name`, which is not a schema
   field, at `visitorManagement.ts:651`, `portals.ts:3803,5733`; the gatehouse property selector
   shows `undefined` names for schema-clean data — matching TS errors at
   `CommandPalette.tsx:136-137`).

---

## 2. Complete Atrium feature inventory

Staff: property CRUD + presets + bulk ops · property detail (summary/units/notices/financials/
relationships/tracking) · lease setup with auto termination-date calc · statutory eviction state
machine (Quit drafted/served/superseded, 7-day notice) · unit occupancy inline edit + soft-
archive + restore · shareable `/apply` vacancy links · vacancy Kanban (Inquiry → Vetted →
Lease_Generated → Closed) + public application form with move-in cost disclosure and rate
limiting · service-charge obligations store + registry-extensible charge types + defaulter
dashboard + 5% late penalty + monthly reset with minimum-vend auto-charges · ledger with offline
queue, idempotency keys, void/test/reinstate lifecycle + append-only financial audit log + cash-
flow KPIs · rent collection modal (ledger + management-fee invoice + receipt PDF) · payment-proof
review queue · automation engine (rent 7-step / SC 4-step ladders, lease-expiry, rent-review
workflows; per-step config; suppression gates; dedup dispatch ledger; one-reminder-per-day) ·
Automation Studio rules (8 triggers; 4 property triggers deliberately engine-owned) · scheduled
messages with claim/reclaim + per-firm digest notification · ComposeModal 4-channel broadcast
with per-recipient results and targeted retry · WhatsApp template registry with auto-sync ·
estate community toggles · lease-expiry alerts (30/60/90) · ARIA chat/drafting/packets.

Resident portal (10 tabs): dashboard (info, outstanding, rent-due/lease cards, wallet card,
quick services) · notices · ledger (charges + SC) · receipts (print) · maintenance (create with
attachments + offline queue, cancel, track) · messages (threaded, own active-conversation state)
· payments (Paystack inline when configured, else bank transfer + proof upload + history) ·
documents (lease, consent records, docs, proofs) · visitors (Sentry Pass invite with code +
WhatsApp delivery, revoke, history) · community (amenities/bulletins/providers/booking) · help &
security content. Auth: email+password, magic-link invites, password setup, recovery-code reset,
bearer sessions, per-user font scaling.

Gatehouse: property picker, 6-digit verify with grace periods, check-in/out, today's activity,
offline cache of last 100 verifications (expiry-honored).

Public: vacancy application form (rate-limited, server-derived firm), marketing site `/atrium`.

Backend cross-cutting: wallets (balance, auto-deduct cron, Paystack funding), visitor token
lifecycle, estate community CRUD, communications (Brevo email, Chakra→Meta WhatsApp with 402
gate, quota, template fallback), FCM push, proactive insights + morning briefing, financial
integrity lifecycle, observability (`withCronReporting` → `error_events`), R2 nightly backups.

---

## 3. Feature-by-feature functionality assessment

Classification key: **A** implemented & functional · **B** implemented but incomplete · **C** UI
exists, backend missing/disconnected · **D** backend exists, UI missing/inaccessible · **E**
broken/defective · **F** not implemented. Nothing below was classified functional merely because
a screen exists — every module was traced frontend → Convex → tables.

| Module | Class | Verdict in one line |
|---|---|---|
| Dashboard (property firm) | **A** | Real widgets, real data; "Managed Units" counts property rows not units (Dashboard.tsx:178-195) |
| Analytics — Financial tab | **B** (mis-scoped) | Invoice/time/expense content with a ₦5M default target — legal domain, shows zeros for rent-ledger firms (FinancialReports.tsx:115-207) |
| Analytics — BI Property tab | **A** | Real occupancy/YTD-rent/table; Pro+-gated; stale-memo bug; "expected rent" falls back to property valuation (PropertyReports.tsx:68,110) |
| Report Generator (property) | **F** | 5 report types, all legal; no rent roll, arrears, or SC collection report; no property export |
| Properties & units (list) | **A−** | Real CRUD/bulk/cascade-delete; no sorting, no persisted filters |
| Property detail (6 tabs) | **A** | All tabs real; ticket-strip deep link broken (E); dead add-unit form |
| Bulk edit properties | **E** | Writes status/category values that are not members of the app's enums — properties fall out of every preset filter (BulkEditPropertyModal.tsx:51-75 vs types.ts:299-300) |
| Residents & tenancy (relationships) | **A** | 16-type Nigerian ontology, consent tracking, idempotent import, soft-end lifecycle |
| Residents & tenancy (lease model) | **B** | Lease data lives in `rentalDetails`; renewal = manual patch; `tenancies` table is write-orphaned dead schema |
| Tenant onboarding (portal invites) | **A** | Token expiry/revocation/replay guards, admin-account conflict refusal, unit linking |
| Rent collection — ledger engine | **A−** | Idempotency keys, offline queue, lifecycle, audit log — solid; no unique index on the key (race) |
| Rent collection — CollectRentModal | **B** | 4+ non-atomic mutations, no idempotency key; retry can double-book |
| Payment proofs | **B−** | Upload/dedup/suppression all real; **approval records no money anywhere**; approval UI is broken for legit staff (§4) |
| Resident wallets | **C+** | Backend + tenant UI real; wallet card always ₦0 (token not passed); no staff view; no refund path; replayable top-up |
| Service charges | **B** | Obligations store + crons + wallets integration real; **dual store** with lease `scPeriods` un-reconciled |
| Financial reporting | **B−** | Cash-flow KPIs + 30/60/90 projections real; no rent roll/arrears aging/exports; receipt numbering has two competing schemes, no uniqueness |
| Maintenance & work orders | **A−** | End-to-end real (create→conversation link→assign→resolve→notify); staff UI has no priority control; email branch is dead code; create/status endpoints unauthenticated |
| Amenities & community (resident) | **E** | Entire Community tab errors for every resident — backend blocks Tenant role and frontend passes no bearer (§4 H3) |
| Amenities & community (admin) | **D** | Full backend CRUD exists with **zero UI callers**; bookings can never be approved; "Estate tab" referenced in settings copy does not exist |
| Visitor management / Sentry Pass | **A−** | Genuine end-to-end (invite→code→gate verify→check-in/out→logs); gate mutations unauthenticated; verify leaks PII with no rate limit; cross-firm token mint possible |
| Resident portal (10 tabs) | **A/B** | 7 tabs A/A− (notices, ledger, receipts, maintenance, messages, payments, documents); visitors A−; dashboard wallet card E; community E |
| Notifications & communication | **A** | WhatsApp/email/push stack is the strongest subsystem (402 gate, template fallback, quota, digest batching); send primitives are unauthenticated; several notification types never emitted |
| Automation engine | **A** | Well-engineered: dedup ledger, suppression gates, one-reminder-per-day, reclaim-safe dispatcher; no run-now; SMS stub; failed sends terminal |
| ARIA AI assistant | **B** | Real 17-tool agent loop + property identity/prompt assembly; cannot answer "who owes rent?"; identity prompt overclaims; tier claim "AI-personalized notices" has no implementation |
| User management & permissions | **B** | Solid client-side matrix + sessions; backend enforces "any staff" only (no role tiers server-side); founder impersonation path stale/broken; no property-native roles |
| Reports & document management | **C+/B−** | Nigerian tenancy templates, quit-notice framework, receipt PDFs, ARIA packets — genuinely strong; property reporting thin, UI-only, Pro-gated, no exports |

---

## 4. Confirmed defects versus suspected issues

Everything in this section was read end-to-end at file:line by the audit tracks; items marked
**[re-verified]** were additionally confirmed by a second direct read after the tracks returned.
Full remedies and tests for every item are in §9 and the master issue register (§12).

### 4.1 Critical — confirmed

- **C1. Wallet top-up is replayable — direct monetary loss. [re-verified]**
  `verifyWalletFunding` (wallets.ts:204-226) is a public action with no caller auth; it credits
  via internal `fundWallet` (125-156), which performs **no dedup on `paystackReference`**, and
  `wallet_transactions` has no unique/paystackReference index (schema.ts:2802-2806). Paystack
  verify returns `success` forever for a completed transaction — replaying the reference (it is
  visible in the redirect URL) re-credits the wallet on every call. `tenantId`/`firmId`/
  `propertyId` are all caller-supplied. `initiateWalletFunding` (170-199) is likewise public.
- **C2. Unauthenticated tenant-data reads — mass PII exposure. [re-verified]**
  `portals.ts` tenant queries take caller-supplied firm/tenant ids with zero session checks:
  `getTenantInfo` (:3739), `getTenantLedger` (:4045), `getTenantServiceCharges` (:4118),
  `getInboundMessagesByTenant` (:4162), `getTenantDocuments` (:5606), `getTenantLeaseDetails`
  (:5714), `getPaymentProofsByTenant` (:5525), `getPaymentProofsByFirm` (:5511),
  `getMaintenanceTicketsByTenant` (:176), `getMaintenanceTicketsByFirm` (:207), `getTicketById`
  (:223), `getActiveNotices` (:6094), `getFirmPortalSettings` (:5849),
  `getScheduledMessagesByFirm` (:3117), `getPendingScheduledMessages` (:3128). Anyone who knows
  a resident's email can read their full financial ledger, documents, messages, and payment
  proofs (including receipt `storageIds`). Convex function URLs ship in the public JS bundle.
- **C3. Forgeable portal writes. [re-verified]**
  `createMaintenanceTicket` (portals.ts:40) destructures `sessionToken` into `_st` and discards
  it (:59) — forged tickets into any firm under any tenant name, each firing admin notifications
  + FCM (spam/social-engineering vector). `createClientServiceRequest` (:949) has no auth args
  at all. `sendPortalMessage` (:4566) and `sendAdminReply` (:4796) trust caller-supplied
  `senderId`/`senderRole`/`adminId` — anyone can inject a message **posing as the property
  manager** ("your payment is confirmed") into any resident conversation.
  `cancelMaintenanceTicket` (:460) trusts `cancelledBy`; `markConversationReadByParticipant`
  (:5060), `markInboundMessagesReadByTenant` (:5096), `ensurePortalAccessToken` (:6218,
  unauthenticated user-record write) complete the set.
- **C4. Conditional-auth anti-pattern — approval broken for staff, open to attackers.
  [re-verified]**
  `updatePaymentProofStatus` (portals.ts:5539) and `updateMaintenanceTicketStatus` (:242) only
  authenticate **when `userEmail` is supplied** (`if (args.userEmail)` at :5554 / :258). The
  legit UI passes email **without a bearer** (PaymentProofsTab.tsx:138-143) → `requireFirmUser`
  throws "Unauthenticated" → **staff can never approve/reject a proof from the UI**; meanwhile
  an anonymous caller that omits the email sails through. The staff maintenance path passes no
  identity at all (MessagesView.tsx:930-934) — it works only *because* auth is skipped.
- **C5. Estate Community cross-firm IDOR.**
  `estateCommunity.ts` reads never `assertSameFirm`: `getAmenities` (:468), `getBookingsForResident`
  (:482), `getBookingsForFirm` (:500), `getBulletins` (:514), `getServiceProviders` (:533,
  exposes vendor phone/email/WhatsApp), `getServiceProvider` (:550). `cancelBooking` (:262-284)
  lets any firm's Admin cancel another firm's bookings (role checked, firm not).
- **C6. Public send primitives — spam relay.**
  `communications.sendEmail` (:49) and `sendWhatsApp` (:173) are public actions with no caller
  auth; WhatsApp quota is charged to a caller-supplied `firmId`. Open relay through the
  platform's Brevo/Chakra accounts.
- **C7. Inbound WhatsApp webhook accepts forged signatures.**
  `sentryWebhook.ts:10-22` — signature check is header-*presence* only; the HMAC comparison is
  an explicit TODO. A garbage `X-Chakra-Signature` value passes; when the secret is unset,
  unsigned webhooks are accepted. Forged "WhatsApp from resident" messages land in firm inboxes
  (`sentry.processInboundMessage`, sentry.ts:1207-1247).
- **C8. Unauthenticated gate mutations + PII leak + no rate limit.**
  `checkInVisitor` (visitorManagement.ts:452) and `checkOutVisitor` (:477) are fully public
  state changes; `verifyToken` (:354-447) returns visitor phone + resident name + address for a
  6-digit code with **no rate limiting** (10^6 space, firmId is in the gatehouse URL);
  `getGatekeeperProperties` (:641) publicly lists firm property names/addresses.

### 4.2 High — confirmed

- **H1. Proof approval is a financial no-op.** Approving a payment proof patches status and
  cancels reminder ladders only (portals.ts:5539-5596) — no ledger entry, no charge settlement,
  no invoice payment. Money received via the primary collection rail is invisible in the books
  unless staff manually double-enter it. INVOICE_GENERATION.md §3 claims otherwise (doc is
  wrong).
- **H2. Wallet auto-deduct revenue never reaches the ledger.** `processAutoDeductions` marks
  charges paid and moves wallet money (wallets.ts:303-321) but writes no `ledger_entries` row —
  all wallet-collected revenue is missing from every financial view. Systematic understatement.
- **H3. Estate Community resident tab is broken for every resident.** The view calls
  `requireFirmUser` endpoints without a bearer (EstateCommunityResidentView.tsx:71-119) and
  `requireFirmUser` blocks the Tenant role anyway (authHelpers.ts:74-85) — the paid Community
  tab errors 100% of the time for its intended users.
- **H4. Estate Community admin management has no UI (class D).** No screen calls
  createAmenity/createBulletin/createServiceProvider/reviewBooking/getBookingsForFirm —
  amenities cannot be created, resident bookings stay `pending` forever; the "Estate tab" the
  settings copy points to does not exist.
- **H5. Vacancy pipeline conversion is a dead end.** `leads_pipeline.convertedTenantId`
  (schema.ts:1551) is never written by any mutation and never read by any UI — advancing to
  Lease_Generated/Closed performs no conversion (no rentalDetails update, no relationship, no
  portal invite, no lease doc). Also no firm notification on public-lead submission
  (sentry.ts:753-763).
- **H6. Bulk edit writes invalid enum values.** BulkEditPropertyModal offers statuses
  (Available/Leased/For Sale/Under Renovation) and categories (Residential/Commercial/…) that
  are not members of `PropertyStatus`/`PropertyCategory` (types.ts:299-300), hidden by `as`
  casts — bulk-edited properties vanish from presets and can flip detail tabs off.
- **H7. Ticket-strip deep link broken (R75 known issue — still true).** "N Open Tickets — Tap
  to view in Conversations" navigates with no context (PropertyDetailView.tsx:1667-1670);
  tickets carry `conversationId` (schema.ts:1778) — it is simply not passed. Same family as the
  R75 messaging-deep-link finding (MessagesView ignores `activeConversationId`).
- **H8. Resident wallet card always shows ₦0.** `getMyWallet` requires a portal session but
  DashboardTab passes none (DashboardTab.tsx:41) → always throws → balance ₦0 forever and the
  auto-deduct toggle never renders. (The funding flow itself works.)
- **H9. Residents get no out-of-band notifications.** Status-change email branch is dead code —
  it gates on `ticket.tenantEmail`, a field that does not exist on the schema (portals.ts:316);
  web push registration call omits the now-mandatory session token (App.tsx:1110 vs
  portals.ts:2835) so the smart-delivery flag never sets.
- **H10. Tenant dashboard "Outstanding Balance" is always ₦0.** `getTenantInfo` never returns
  `outstandingBalance` (DashboardTab.tsx:50 vs portals.ts:3909-3947) — defaulting residents see
  "All Caught Up" regardless of arrears.
- **H11. ARIA cannot answer "who owes rent?"** The portfolio roster and `query_firm_data`
  property results carry rent/SC amounts and lease dates but no payment status, arrears, or
  outstanding balance (portfolioContext.ts:176-205); `rentPaymentHistory` is explicitly stripped
  from context (AgencyHub.tsx:275); `openWithContext` is imported but never called from property
  pages (PropertyDetailView.tsx:131). The identity prompt claims "real-time portfolio revenue
  status — outstanding, defaults" (ai/prompts/02-aria-property-identity.md:42) — an overclaim.
- **H12. Founder impersonation path is stale/broken.** `verifyImpersonationToken` returns only
  `targetEmail`, which the client installs as a session token with no bearer
  (AuthContext.tsx:195-199) — the R17 validity gate retires email-only sessions on boot
  (:353-371). Only `startImpersonationSession` (myFunctions.ts:172-217, mints a real session
  with audit) works.
- **H13. Silent money-mutation failures.** LedgerManager AddEntry has `try/finally` with no
  catch (LedgerManager.tsx:83-124); ServiceChargeMonitor mark-paid/partial have no try/catch
  (:611-670); PropertyManagerView bulk/single deletes use `allSettled`, swallow failures, and
  unconditionally toast success (:312-314, :352, :379-383).
- **H14. `schemaValidation:false` (R75 known — re-confirmed).** schema.ts:2942-2947; the insert
  audit was never run; off-schema reads/writes commit silently (see §1 fact 4).
- **H15. Firm Admins can approve their own subscription upgrades.** `approveSubscriptionRequest`
  allows plain `Admin` (myFunctions.ts:7972-7973, TODO comment admits intent was Founder-only).
- **H16. Cross-firm visitor tokens.** `generateVisitorToken` never checks the property belongs
  to the caller's firm (visitorManagement.ts:187-242) — tokens can be minted against another
  firm's estate.
- **H17. seedSentry is production-runnable and hard-deletes financial rows.** Founder-gated but
  not environment-gated; deletes `ledger_entries` outright (seedSentry.ts:14-25), violating the
  codebase's own no-delete financial rule.
- **H18. Open AI proxy + inverted inspect gate.** `/ai/stream` spends the platform Gemini key
  for unauthenticated callers with `Access-Control-Allow-Origin: *` (http.ts:53-115);
  `/api/agent/inspect` is **open when `AGENT_INSPECT_SECRET` is unset** (http.ts:189-198 —
  inverted gate; the drill endpoint beside it does this correctly at :309-324).
- **H19. Payment-proof status is caller-controlled on submit.** A tenant can submit a proof
  with `status: 'approved'` (portals.ts:5441, :5480 — free string, server never forces
  `pending_review`).

### 4.3 Medium — confirmed (condensed; full register in §12)

M1 dual service-charge stores (ServiceChargeMonitor.tsx:5-27; mapped precisely in §8) ·
M2 two maintenance stores (`properties.maintenanceHistory` vs `maintenance_tickets`, never
synced — tracking-tab "active maintenance" ignores portal tickets) · M3 property analytics
thin/mislabeled (legal Financial tab default; no rent roll/arrears/SC reports; BI Pro-gated;
expected-rent falls back to valuation PropertyReports.tsx:68; stale memo deps :110) ·
M4 "Managed Units" counts property rows not units (Dashboard.tsx:178-195) · M5 money floats
unrounded on dedicated mutations (sentry.ts:126-131, :540-554; wallets.ts:139-152) + no
server-side `amount > 0` validation (sentry.ts:78-133) + overpayments silently discarded
(sentry.ts:497-531) · M6 CollectRentModal non-atomic, no idempotency key
(CollectRentModal.tsx:279-360) · M7 Paystack webhook auto-verify is dead code for portal
payments — webhook matches `pending_verification` (paystack.ts:556) but UI submits
`pending_review` (PaymentsTab.tsx:119) · M8 receipt numbering: random `REC-ts-rand`
(CollectRentModal.tsx:262) vs invoice-shared client counter (invoiceHelpers.ts:158-174), no
uniqueness anywhere · M9 no wallet refund path, no staff wallet view · M10
`portal_payment_proof` notification type configurable but never emitted (portals.ts:6472;
NotificationSettings.tsx:142) — staff must poll the proofs screen · M11 ComposeModal creates a
duplicate DM conversation per send (ComposeModal.tsx:829-848; R75 known) · M12 amenity booking
never validates `operatingHours`/`bookingWindowDays` server-side; UI offers fixed 6–21 h slots
only (estateCommunity.ts:158-232) · M13 booking approval/rejection never notifies the resident
(explicit TODO, estateCommunity.ts:257-258) · M14 gate code brute-force exposure (no lockout,
§C8) · M15 `aggregateDailyMetrics` date frozen at deploy time (crons.ts:6-11 evaluated at
module load; usage history permanently wrong) · M16 unbounded scans/render-all: wallet
auto-deduct `.collect()` over all past-due charges (wallets.ts:240-241); tenant portal
full-scans firm properties per call — no tenant index (portals.ts:3762, :4049, :4121 vs
schema.ts:991-994); property list renders everything (PropertyManagerView.tsx:489) · M17
backend role granularity: `requireStaffCaller` authorizes any staff role for every staff
mutation (callerAuth.ts:136-148) — role tiers are client-side only · M18 Paystack client key
hardcoded `pk_test_…` fallback silently diverts to bank transfer (PaymentsTab.tsx:63-68) ·
M19 VMS billing bypass by firm-name substring "practicepro" (visitorManagement.ts:169-171) ·
M20 AutomationCenter copy contradicts the engine (lease-end vs rent-due anchors,
AutomationCenter.tsx:332-351; stale comment sentry.ts:592-599) · M21 no engine run-now —
`runAutomationEngine` is internal/cron-only (automationEngine.ts:699) · M22 `tenancies` table
write-orphaned dead schema (schema.ts:996-1012) · M23 failed scheduled sends are terminal — no
auto-retry, manual WhatsApp retry capped 50 (portals.ts:3536-3545; communications.ts:855-923) ·
M24 audit trails: `audit_logs` has exactly one writer (consent, myFunctions.ts:3617); proof
approvals, wallet movements, visitor check-ins, property deletes leave no who/when/why ·
M25 off-schema `properties.name` read server-side breaks the gatehouse property selector for
schema-clean data (visitorManagement.ts:651; portals.ts:3803, :5733; TS errors
CommandPalette.tsx:136-137).

### 4.4 Low — confirmed (condensed)

L1 portal font scale persists into the staff app after impersonation/logout
(PortalFontSizeControl.tsx:54) · L2 `ensurePortalAccessToken` unauth user-record write +
`resolvePortalUserByToken` email/firmId oracle (portals.ts:6191, :6218) · L3 SMS channel is a
dead stub offered in the schema (portals.ts:3409-3410) · L4 cycle math uses fixed 30/90/365-day
offsets + monthly reset re-anchors +30 d — billing dates drift (sentry.ts:516, :1687;
wallets.ts:316) · L5 "Restrict Access" on defaulters sends a notice only — no gate/VMS linkage
(ServiceChargeMonitor.tsx:697-711) · L6 `checkEmailForPortalConflict` public staff-roster probe
(role+name per email) with a 500-user scan cap (portalSecurity.ts:16-46) · L7 `debug_env`
publicly reports env-config presence incl. mailer key prefix (debug_env.ts:4-34) · L8 legacy
SHA-256 + plaintext password verification branches still live (authUtils.ts:69-84; never-logged-
in users keep plaintext hashes forever) · L9 `revokeAllUserSessions` unauthenticated — anyone
can force-logout any user (sessions.ts:201-216) · L10 SOP/doc drift: VMS_GATEHOUSE_SOPS.md
(14 vs 30-day trial self-contradiction, "queued and synced" offline verifications don't exist,
"last 50" vs unbounded, ₦15,000 vs ₦7,500 pricing, Math.random claim stale) and
INVOICE_GENERATION.md (claims atomic writes, collision-checked numbering, a RevenueMonitor.tsx
that doesn't exist) · L11 no unique constraint on `idempotencyKey` — concurrent same-key
submits can both insert (schema.ts:1368) · L12 session `lastSeenAt` set at insert, never
updated (sessions.ts:117) · L13 ARIA-X saves to Convex but never loads back — library is
device-bound despite server rows (AloaXView.tsx:96-102; indexer.ts:11-14) · L14 staff ticket
UI has no priority selector, no cost field, no SLA beyond the 24 h stale flag · L15 dead
add-unit form + never-invoked `addUnitToProperty`/`removeUnitFromProperty` mutations
(PropertyDetailView.tsx:1273-1357; myFunctions.ts:7005/7037) · L16 `p-retry` dependency with
zero imports (R75 known) · L17 property list has no sorting and no persisted filter prefs
(R75 known).

### 4.5 Suspected (pattern suggests; not fully traced to a live failure)

- **S1.** The idempotency race (L11) can produce duplicate ledger rows under concurrent
  double-submit — read-then-insert without a unique index; OCC may or may not conflict.
- **S2.** Gatehouse property selector showing `undefined` names for schema-clean properties
  (M25) — verified as a type mismatch; whether production data currently carries off-schema
  `name` fields is a data question (schemaValidation is off, so both states can exist).
- **S3.** Concurrent two-staff proof approval — both succeed (no already-reviewed guard); the
  second overwrites `reviewedBy` with no trace. Money effect is idempotent; the audit gap is not.
- **S4.** Whether any resident wallet currently holds a positive balance in production is
  unknown — if none, C1's exposure is latent until Paystack goes live; the code defect is
  confirmed regardless.

---

## 5. Security and operational risks

Ranked by exposure. All confirmed unless noted.

1. **Unauthenticated portal service layer (C2/C3/C4).** ~20 `portals.ts` read/write endpoints
   trust caller-supplied identity. Net effect: full financial/document/message read of any
   resident by knowing their email; forged tickets; impersonated messages (including as the
   property manager); anonymous ticket/proof status changes. This is the single largest risk in
   the product and it is *systemic* (a module was never retrofitted), not a set of one-off bugs.
2. **Direct monetary loss paths (C1 + H1 + H2 + M6).** Wallet top-up replay (unbounded free
   credit once Paystack is live); proof approval records no money (books wrong — revenue
   understated or rent double-collected); wallet auto-deduct invisible to the ledger;
   CollectRent retry double-booking. For a property-management product, money truth is the
   product.
3. **Spam/forgery relays (C6 + C7 + C8).** Public email/WhatsApp senders (platform accounts
   foot the bill and the reputation); forged inbound WhatsApp; forged/unauthenticated gate
   check-ins; 6-digit code brute force with no lockout leaking visitor/resident PII.
4. **Cross-tenant IDOR (C5 + H16 + M19 + L2).** Estate-community reads/cancels across firms;
   cross-firm visitor token minting; VMS billing bypass by name substring; token oracles.
5. **Privilege-escalation-adjacent (H15 + H17 + H18 + M17 + L9).** Admin self-approving
   subscriptions; production-runnable seeder that hard-deletes ledger rows; open platform-key
   AI proxy (CORS *); no server-side role tiers; unauthenticated global logout.
6. **Auth-session hygiene (H12 + L8 + L12).** PBKDF2 for new hashes is solid; legacy
   plaintext/SHA-256 branches verify forever; stale founder-impersonation path; sessions never
   rotate in the 30-day window.
7. **Operational reliability.** Cron failures are captured to `error_events` but **not
   retried** — a failed `walletAutoDeduct`/`automationEngine` day is lost until tomorrow;
   `aggregateDailyMetrics` writes a frozen deploy date every night; failed scheduled sends are
   terminal; WhatsApp/email fetches have no timeout (a hung gateway stalls the serial
   dispatcher). Backups (R2 nightly) and observability exist and are healthy.
8. **Audit-trail gaps (M24).** Only ledger/invoice lifecycle events and consent are audited.
   Payment-proof decisions, wallet movements, visitor check-ins, and property deletions leave
   no who/when/why.
9. **Data-integrity posture (H14 + §1 fact 1).** schemaValidation off + `v.any()` on the core
   property/unit/rentalDetails fields + four unitId shapes + two unit models + two maintenance
   stores + two service-charge stores. The DB cannot enforce the shape of the product's most
   important data.

---

## 6. UI/UX weaknesses

**Broken promises (looks functional, does nothing):**
- "Tap to view in Conversations" ticket strip → generic inbox (H7).
- Estate Community settings copy: "you define the content, residents consume it" → no admin UI
  exists at all (H4); resident Community tab errors outright (H3).
- Wallet card on the resident dashboard → always ₦0 (H8); Outstanding Balance card → always
  "All Caught Up" (H10).
- "Approve" on a payment proof → error toast for legit staff every time (C4).
- "Restrict Access" on critical defaulters → sends a message only (L5).
- SOP-promised gatehouse behaviors (queued offline verifications, cancel button, admin audit
  view) don't exist (L10).

**Missing vs any modern property-management tool:**
- No property reports a manager can hand an owner: no rent roll, no arrears aging, no
  service-charge collection report, no exports of any property data (M3).
- No message search anywhere (R75 known); no typing indicators; unread derived from
  notifications (R75 known).
- No lead→resident conversion: the pipeline ends at a label (H5).
- No wallet refund path or staff wallet visibility (M9).
- No priority/cost/SLA controls on maintenance for staff (L14).
- No automation run-now/testing (M21); config changes wait for the next 06:30 UTC cron.
- Property list: no sorting, no saved views (L17); analytics behind a Pro gate that most
  property firms won't have (M3).

**Polish:** silent money-action failures (H13) · font scale leaks out of the portal (L1) ·
receipts in the portal are print-to-PDF only · duplicate DM threads from the composer (M11) ·
AutomationCenter help table describes the wrong anchors (M20) · dashboard "Managed Units"
undercounts multi-unit properties (M4) · bulk-edit dropdowns write values the rest of the app
can't read (H6).

---

## 7. AI capability assessment (ARIA)

**What's real and good:** one genuine streaming agent loop (17 function-declared tools,
6-iteration loop, thoughtSignature preservation, geminiService.ts:37-316); correct ALOA/ARIA
identity switching (assistantIdentity.ts); an Atrium-specific system protocol
(`ALOA_ATRIUM_PROTOCOL`, aloaPrompts.ts:436-448) and identity file with full portfolio roster
injection (portfolioContext.ts:93-131); property-aware document packets (tenancy agreements,
service-charge demand notices with reconciliation lines, quit-notice framework with
state-aware notice periods); proactive insights that are genuinely property-relevant
(14-day defaulters, defaulter-ratio anomaly, morning briefing with revenue-at-risk and
occupancy); model ladders + user model selector + Convex-proxy fallback.

**Gaps (vs the modern skills/artifacts/agents standard the owner is benchmarking against):**
1. **ARIA is financially blind (H11).** No arrears/outstanding/payment-status data reaches the
   tools or the roster; `rentPaymentHistory` is stripped; property pages never inject deep
   context. The assistant literally cannot answer its own marketing question ("who owes
   rent?"), while its identity prompt claims it can (02-aria-property-identity.md:42).
2. **"AI-personalized notices" (Pro tier copy, tiers.ts:330) has no implementing code** —
   re-confirmed; the only AI in any notice path is none.
3. **Artifacts are localStorage-bound where they matter most:** ARIA-X saves to Convex but never
   reads back (L13) — device-bound library; drafts remain localStorage-first (R75 P0 #2).
4. **Tier gating is client-side only** (useFeatures.ts:84) — no server plan check on AI paths.
5. Structured outputs: `responseSchema` used well in 6 agents, but high-value surfaces still
   parse free text post-hoc; 5 services / 6 prompt sources / duplicated model registries
   (R75 §7 — unchanged).
6. Evals: zero prompt-quality tests (R75 §7 — unchanged).

**Direction:** the R75 target architecture (one gateway, one skills registry, one artifacts
store, one eval harness — R80–R84) remains the right plan. This audit adds one Atrium-specific
prerequisite: **feed ARIA the money** (per-unit payment status + outstanding balances in
`query_firm_data`, plus `openWithContext` wiring on property pages) — otherwise the assistant
stays a chatbot next to a ledger it can't see.

---

## 8. Technical debt assessment

**Data model:** the properties table is the product's weakest foundation — nearly all fields
nullable, `rentalDetails`/`units`/history arrays typed `v.any()` (schema.ts:926-994);
`schemaValidation:false` (H14); four unitId shapes requiring a runtime resolver (unitLookup.ts);
two unit models (embedded vs sibling rows); dead `tenancies` table (M22); **two service-charge
stores** — the `service_charges` obligations store (monitor, crons, wallets, portal dues) vs
lease `scPeriods` settlement (unit pills, finance tab, receipts) with no reconciliation
(ServiceChargeMonitor.ts:5-27; the R75 phrasing "invoices/outbox system" is corrected here) —
and **two maintenance stores** (M2).

**Money correctness:** float naira everywhere with rounding only on generic paths (M5); no
server-side amount validation; overpayment credit discarded; receipt numbering without
uniqueness (M8); CollectRent non-atomic (M6); cycle anchors drift (L4).

**Monoliths:** portals.ts 6,922 ln (auth debt concentrated here); sentry.ts 1,821;
PropertyDetailView 2,938; AloaChat ~4,400; SubscriptionSettings 2,010. Two live composers
(atrium/ComposeModal vs modals/ComposeEmailModal). Role taxonomy is legal-only with display
relabels for property firms (L17 in §4.4).

**Tests:** 83 files / 1,424 tests, all green — but they are pure-function tests.
**Zero coverage** on: wallet funding/auto-deduct/replay, visitor verification/check-in/expiry,
payment-proof pipeline, maintenance lifecycle, sentry mutations (markChargeAsPaid idempotency),
webhook handlers, and every Atrium UI component. The Critical items in §4.1 are all in
untested territory.

**Toolchain (non-destructive checks run 2026-11-08):** tsc 125 errors = exact baseline (3 touch
Atrium files: CommandPalette.tsx:136-137 `Property.name/type` — the off-schema field again);
vitest 1,424 passed; vite build green; eslint 0 errors / 77 warnings (deprecated `rounded-xl`
on marketing sites). Stack drift (Vite 5→8, React 18→19, Tailwind 3→4, Router 6→7) is carried
from R75 §3 unchanged — Convex/Capacitor/genai current-major. `p-retry` dead dependency (L16).

**Docs debt:** INVOICE_GENERATION.md materially wrong (H1, M8); VMS_GATEHOUSE_SOPS.md drifted
(L10); DEV_TOOLKIT baselines stale (R75 §8); ESTATE_COMMUNITY.md accurate.

---

## 9. Prioritised improvement recommendations

Every recommendation carries its issue IDs (register in §12). Quality gates per round, as
always: tsc at 125 baseline (zero new), vitest green (1,424), build green, live verification,
worklog record.

**Wave S1 — Security stop-the-bleed (highest priority; nothing else ships before this).**
Retrofit auth on the portals.ts service layer (C2, C3, C4): `requirePortalCaller` on tenant
reads, `requireStaffCaller` on staff reads/writes, unconditional (not conditional) auth on
status mutations, derive sender/tenant identity from the session; pass `sessionToken` from
every portal tab and `MessagesView`/`PaymentProofsTab` (fixes the broken legit UI in the same
stroke). Wallet funding: dedup on `paystackReference` + unique index + portal-caller auth +
bind tenant/firm from Paystack metadata (C1). Require staff/portal session on
communications senders with per-caller rate limits (C6). Implement the Chakra webhook HMAC
(R75-style: mirror paystack.ts:307-327) (C7). Gatekeeper: device PIN or signed device token for
mutations, rate-limit + minimize `verifyToken` response (C8, M14). Estate community
`assertSameFirm` on all reads + firm-check in cancelBooking (C5). Founder-only subscription
approval (H15); environment-gate seedSentry + void-not-delete (H17); invert the
agent-inspect gate + auth the AI proxy (H18); force `pending_review` on proof submit (H19).
*Acceptance:* an unauthenticated script sweep over every endpoint in §4.1 returns 401/throw;
the PaymentProofsTab approve flow succeeds in-app; wallet replay is a no-op.

**Wave S2 — Money truth.** Proof approval writes a ledger entry atomically (+ optional charge
linkage) (H1); wallet auto-deduct writes a ledger row (idempotency key
`wallet-deduct-{chargeId}-{cycle}`) (H2); CollectRent gets one idempotency key + a single
server-side atomic mutation (M6); server-side receipt numbering with uniqueness (M8);
`amount > 0` validation + `roundMoney` on every dedicated money mutation (M5); overpayment
credit carried forward (M5); webhook auto-verify accepts the status the UI actually submits
(M7); auto-retry (bounded) for failed scheduled sends (M23); reconciliation checker cron
(ledger ↔ service_charges ↔ wallet_transactions ↔ proofs) — the natural extension of
financialIntegrity.ts. *Acceptance:* a proof approved in-app appears in the ledger within one
transaction; a ₦100 test payment cannot credit twice; two same-second receipts get distinct
sequential numbers.

**Wave S3 — Interaction truth (merges with R75 Phase A).** MessagesView consumes
`activeConversationId` (R75 item 1 — fixes roster DM, DM create, channel create at once);
ticket strip passes `selectedInboxId` + `selectedInboxType` (H7); ContactDetailView row
deep-link fix (R75 §2); wallet card passes the bearer (H8); tenant Outstanding Balance
computed server-side (H10); Community tab gets portal-caller endpoints + bearer (H3); resident
notifications actually delivered (email field stored at creation + push token passed) (H9);
`portal_payment_proof` notification emitted on submit (M10); vacancy conversion flow
(prefill lease + optional portal invite + stamp `convertedTenantId` + new-lead notification)
(H5); bulk-edit selects populated from the real enums (H6); error toasts on all money actions
(H13); ComposeModal DM dedup (M11); Notes drag-drop / DocumentsTab download / export honesty
(R75 Phase A items).

**Wave S4 — Admin surfaces & community.** Build the Estate Community admin CRUD + booking
review queue (amenities, bulletins, providers, bookings) — backend is already there and tested
(H4); booking validation (operating hours, window) + review notifications (M12, M13); staff
wallet view + audited refund mutation (M9); founder impersonation path retired or fixed to
mint real sessions (H12); automation run-now (admin-authed wrapper — the dedup ledger makes it
safe) (M21); staff ticket priority/cost controls (L14).

**Wave S5 — Data model & reporting.** Property reports for the generator + exports: rent
roll, arrears aging, SC collection, occupancy (M3); fix expected-rent valuation fallback +
stale memo + Managed-Units count (M3, M4); unify maintenance on `maintenance_tickets` (migrate
embedded history) (M2); single source of truth for service charges (derive unit SC status from
`service_charges` or write-through on settle) (M1); properties schema typed + tenant index +
pagination/virtualization (M16, M25); the schemaValidation insert-audit program (H14 — same as
R75 R90); tenancies table decision (M22); cron date fix + retry policy for money-adjacent
dailies (M15); legacy password migration sweep (L8).

**Wave S6 — ARIA & polish.** Feed ARIA the money (arrears in roster/tools, `openWithContext`
on property pages) + fix the overclaiming identity prompt (H11); decide the "AI-personalized
notices" claim — build it or change the copy (tier exposure); ARIA-X server read-back (L13);
server-side AI tier gate; then the R80–R84 AI modernization program (gateway/skills/artifacts/
evals) as already roadmaped; doc corrections (INVOICE_GENERATION.md, VMS SOPs,
AutomationCenter copy) (L10, M20); font-scale reset, SMS stub removal, `p-retry`, dead
add-unit code cleanup (L1, L3, L15, L16).

---

## 10. Files and components likely to require modification

**Backend (Convex):**
- `convex/portals.ts` — auth retrofit across ~20 functions; proof-approval money write;
  notification writes (proof submitted, booking review); tenant outstanding computation;
  scheduled-send retry; email field on tickets.
- `convex/wallets.ts` — verify/initiate auth + reference dedup; auto-deduct ledger write;
  refund mutation; staff wallet queries; bound the past-due collect.
- `convex/estateCommunity.ts` — `assertSameFirm` on reads; portal-caller variants; booking
  validation; review notifications; cancelBooking firm check.
- `convex/visitorManagement.ts` — gatehouse credential for mutations; rate limit + minimized
  verifyToken; property-firm check on token mint; response shape for `getGatekeeperProperties`.
- `convex/communications.ts` — caller auth + rate limits; fetch timeouts.
- `convex/sentryWebhook.ts` — HMAC validation.
- `convex/schema.ts` — `wallet_transactions.by_paystack_reference`; properties typing; tenant
  index; audit fields; (Wave S5) the schemaValidation program.
- `convex/myFunctions.ts` — subscription Founder-only; seedSentry gating; scanLeaseExpiries
  unchanged (healthy); removeUnit/addUnit cleanup; cron date fix in `crons.ts`.
- `convex/http.ts` — agent-inspect gate inversion; `/ai/stream` auth.
- `convex/callerAuth.ts` / `authHelpers.ts` — role-parameterized guards
  (`requireAdminCaller`).
- `convex/paystack.ts` — auto-verify status alignment.
- `convex/sessions.ts`, `authUtils.ts`, `portalSecurity.ts`, `debug_env.ts`, `seedSentry.ts`
  — hygiene items.

**Frontend (src/):**
- `components/MessagesView.tsx` (deep-link consumption + ticket actions pass session token),
  `components/atrium/PaymentProofsTab.tsx` (bearer), `components/details/PropertyDetailView.tsx`
  (ticket strip context, dead add-unit removal, `openWithContext` for ARIA),
  `components/tenant/TenantPortal/DashboardTab.tsx` (wallet bearer, outstanding),
  `components/tenant/EstateCommunityResidentView.tsx` (portal callers + bearer),
  `components/settings/EstateCommunitySettings.tsx` + new admin CRUD surface,
  `components/modals/BulkEditPropertyModal.tsx` (enums), `components/modals/CollectRentModal.tsx`
  (idempotency/atomicity), `components/atrium/LedgerManager.tsx` +
  `ServiceChargeMonitor.tsx` + `PropertyManagerView.tsx` (error surfacing, sorting),
  `components/atrium/ComposeModal.tsx` (DM dedup), `components/atrium/VacancyPipeline.tsx`
  (conversion flow), `components/reports/PropertyReports.tsx` + `ReportingView.tsx` +
  `services/reportGenerator.ts` (property reports + exports), `components/Dashboard.tsx`
  (unit count), `components/App.tsx` (push registration token), `components/portal/GatekeeperInterface.tsx`
  (stale banner), `utils/portfolioContext.ts` + `contexts/AloaProvider`-side AgencyHub (ARIA
  arrears), `contexts/AuthContext.tsx` (impersonation), `components/indexer/AloaXView.tsx`
  (read-back).

**Docs:** `INVOICE_GENERATION.md`, `VMS_GATEHOUSE_SOPS.md`, `src/constants/tiers.ts`
(AI-personalized-notice copy decision), AutomationCenter help copy.

---

## 11. Carried-forward list (R75 known issues — kept on the list per the owner)

From `DEEP_AUDIT_R75.md`, still open and not superseded by this audit (Atrium/shared-relevant
subset; the full list with evidence lives there):

1. [P0] Messaging deep-link — `MessagesView` never consumes `activeConversationId`
   (MessagesView.tsx:346-406) — now Wave S3 item 1; this audit adds the ticket-strip (H7) and
   re-confirms ContactDetailView spinner and ComposeModal duplicate-DM (M11).
2. [P0] AI drafts are not artifacts (localStorage-first) → R82 artifacts store.
3. [P0] PII redaction porous (attachment text, research sources) → R84.
4. [P1] `schemaValidation:false` → H14 here; Wave S5 / R90.
5. [P1] History/URL model desync → R78.
6. [P1] No message search → R76.
7. [P1] Zero funnel analytics on the sites → R89.
8. [P1] Dead interactions bundle (Notes drag-drop, DocumentsTab download, comparison stub,
   export zip lie) → R75 Phase A / Wave S3.
9. [P1] AI stack 5 services / 6 prompt sources / no evals → R80–R84.
10. [P1] Cloudflare mirror frozen on inactive token (owner action).
11. Offline queue incomplete (158 sites) → R91; three modal systems / two primitive systems →
    R79; stack drift (Vite/React/Tailwind/Router) → R85–R88; Paystack live keys (owner action)
    → R92 — **note Wave S2's webhook-status fix (M7) must land before or with R92, or card
    payments still won't auto-verify.**
12. Atrium marketing-site items (SEO JS-only, 99.9% claim, footer semantics) → R89.

**Messaging verdict re-stated (the owner's standing question):** half-done and unchanged since
R75 — send/attachments/push/scheduled/WhatsApp are real; the specific deep links the owner
reported are still broken; the fix remains ~10 lines plus the ticket-strip context, scheduled
as Wave S3.

---

## 12. Master issue register (referenceable IDs)

Format: ID · severity · feature · location · problem · remedy · test. Severity scale:
Critical / High / Medium / Low. (Condensed rows; §4 carries the narrative.)

| ID | Sev | Feature | Location | Problem → Remedy → Test |
|---|---|---|---|---|
| C1 | Critical | Wallet top-up | wallets.ts:125-156,170-226; schema.ts:2802 | Replay re-credits; unauth verify → dedup on reference + index + portal auth + metadata-bound identity → replay same reference twice, balance rises once |
| C2 | Critical | Tenant privacy | portals.ts:176,207,223,3117,3128,3739,4045,4118,4162,5511,5525,5606,5714,5849,6094 | Unauth tenant reads → requirePortalCaller/requireStaffCaller + session-derived scoping → unauth script gets 401 |
| C3 | Critical | Portal writes | portals.ts:40,460,949,4566,4796,5060,5096,6218 | Forgeable tickets/messages/cancels → session auth + derive identity → forged create rejected |
| C4 | Critical | Proof/ticket status | portals.ts:258,5554; PaymentProofsTab.tsx:138-143; MessagesView.tsx:930-934 | Conditional auth; legit UI broken → unconditional staff auth + UI passes bearer → approve works in-app; anonymous rejected |
| C5 | Critical | Estate community | estateCommunity.ts:262-284,468-561 | Cross-firm IDOR → assertSameFirm everywhere → foreign-firm query throws |
| C6 | Critical | Comms relay | communications.ts:49,173 | Public senders → auth + rate limits → unauth send 401 |
| C7 | Critical | WhatsApp inbound | sentryWebhook.ts:10-22 | Signature unvalidated → HMAC-SHA256 of raw body → garbage signature 401 |
| C8 | Critical | Gatehouse | visitorManagement.ts:354-494,641 | Unauth mutations; PII leak; no rate limit → device credential + throttle + minimized response → scripted check-in fails; 1000 verifies throttle |
| H1 | High | Proof approval | portals.ts:5539-5596 | No money recorded → atomic ledger write + charge link → approved proof appears in ledger |
| H2 | High | Wallet auto-deduct | wallets.ts:303-321 | Ledger-blind → write ledger row w/ idempotency key → cron result visible in LedgerManager |
| H3 | High | Community tab | estateCommunity.ts + EstateCommunityResidentView.tsx:69-119; authHelpers.ts:74-85 | Broken for residents → portal-caller endpoints + bearer → tenant sees bulletins |
| H4 | High | Community admin | estateCommunity.ts CRUD; zero UI callers | Class D → build admin CRUD + review queue → amenity creatable; booking approvable |
| H5 | High | Vacancy conversion | schema.ts:1551; sentry.ts:753-763 | Dead end → conversion flow + lead notification → Closed lead produces lease + invite + stamped id |
| H6 | High | Bulk edit | BulkEditPropertyModal.tsx:51-75 vs types.ts:299-300 | Invalid enums → populate from real enums → bulk-edited property stays in presets |
| H7 | High | Ticket strip | PropertyDetailView.tsx:1667-1670 | No context → pass selectedInboxId/Type → click opens the exact conversation |
| H8 | High | Wallet card | DashboardTab.tsx:41 | No bearer → pass sessionToken → balance renders |
| H9 | High | Resident notify | portals.ts:316; App.tsx:1110 | Dead email branch; push flag never set → store email; pass token; web fallback → status change notifies |
| H10 | High | Outstanding card | DashboardTab.tsx:50 vs portals.ts:3909 | Never computed → server-side outstanding → defaulting tenant sees arrears |
| H11 | High | ARIA blindness | portfolioContext.ts:176-205; AgencyHub.tsx:275; PropertyDetailView.tsx:131; 02-aria-property-identity.md:42 | No arrears context → add payment status to tools + openWithContext → "who owes rent?" lists units |
| H12 | High | Impersonation | impersonation.ts:101-135; AuthContext.tsx:195-199 | Stale path → mint real session or retire → founder flow survives guarded calls |
| H13 | High | Silent failures | LedgerManager.tsx:83-124; ServiceChargeMonitor.tsx:611-670; PropertyManagerView.tsx:312-383 | No error surfacing → catch + toast; check allSettled → offline submit shows red toast |
| H14 | High | DB integrity | schema.ts:2942-2947 | Validation off → insert-audit program → staging validation-on deploy passes |
| H15 | High | Subscriptions | myFunctions.ts:7972-7973 | Admin self-approve → Founder-only → admin attempt throws |
| H16 | High | Visitor tokens | visitorManagement.ts:187-242 | Cross-firm mint → property-firm check → foreign propertyId throws |
| H17 | High | Seeder | seedSentry.ts:14-25 | Prod-runnable; hard deletes → env gate + void lifecycle → prod run refuses |
| H18 | High | HTTP surface | http.ts:53-115,189-198 | Open AI proxy; inverted gate → auth stream; 404-when-unset → curl without key fails |
| H19 | High | Proof submit | portals.ts:5441,5480 | Caller-controlled status → force pending_review → submitted 'approved' stored as pending |
| M1–M25 | Medium | (see §4.3) | (see §4.3) | Each carries its own location/remedy/test inline |
| L1–L17 | Low | (see §4.4) | (see §4.4) | Each carries its own location/remedy/test inline |

---

## 13. Recommended implementation sequence

One wave per round (or split across rounds at the owner's pace), in this order, with the
existing R75–R92 roadmap slots shown where they merge:

1. **Round A (new) — Wave S1 Security.** Gates: endpoint sweep script returns 401s;
   PaymentProofsTab approve succeeds; wallet replay no-op. *Nothing else should ship first —
   C1–C8 are internet-reachable today.*
2. **Round B — Wave S2 Money truth.** Gates: proof→ledger atomicity test; receipt numbering
   uniqueness test; reconciliation cron green on demo firm.
3. **Round C — Wave S3 Interaction truth = existing R75 Phase A (deep links & dead
   interactions), now including H5–H10, H13, M10, M11.**
4. **Round D — Wave S4 Admin surfaces & community.** Gates: amenity created + booking approved
   end-to-end; wallet refund audited; run-now dispatches respect dedup.
5. **Round E — Wave S5 Data model & reporting (merges with R78 history model and R90
   schemaValidation program where they overlap).**
6. **Round F — Wave S6 ARIA & polish (merges with R80–R84).**
7. **Owner standing actions (unchanged):** rotate `CLOUDFLARE_API_TOKEN`; decide Paystack
   go-live (Wave S2's M7 fix should land first); review the "AI-personalized notices" tier
   copy; retire/rewrite obsolete strategy docs.

**This audit proposes no code changes and changes nothing until approved.**

---

*Verification basis: five parallel read-only audit tracks over the working tree at `c4552d0c`
(application code identical to promoted R74 `176eb905`); cross-track agreement on all Critical
items plus independent direct re-reads of C1–C4; technical checks executed locally 2026-11-08
(tsc 125 = baseline, vitest 1,424 passed, vite build green, eslint 0 errors / 77 warnings).
Baselines for future rounds: tsc 125 · vitest 1,424 · build green.*
