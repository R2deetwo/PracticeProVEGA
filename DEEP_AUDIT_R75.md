# DEEP AUDIT — R75 (2026-11-08)

**Scope:** page-by-page deep dive across both apps (Vega + Atrium), the marketing sites, the
founder/admin app, the portals, the messaging stack, and — as a separate study — the full AI
stack, benchmarked against how modern AI tools work (skills, artifacts, agents, streaming).
**Basis:** every finding below was verified by reading the live code at `176eb905` (R74,
v1.0.744, build-1138) with file:line references. Four parallel audits covered the app core,
messaging/Atrium/portals/admin, the sites + all prior planning docs, and the AI stack; the
three highest-impact claims were independently re-verified (dead components, schema-validation
revert, PII bypass).

**How to read this:** Sections 1–2 answer the owner's questions directly. Sections 3–9 are
the page-by-page record (what works / what's broken / what's missing vs modern standard).
Section 10 is the step-by-step roadmap (R75+) we execute from, one round at a time, in the
project's usual style — full quality gates, live verification, promotion records.

---

## 1. Executive summary

| Area | Verdict | One-line summary |
|---|---|---|
| Data layer (Convex + DataProvider) | **Solid** | Real optimistic CRUD, offline write-through, demo state correctly gated to the demo account only |
| Messaging | **Half-done** | Real send/attachments/push/scheduled/WhatsApp, but the exact deep-link the owner reported is still broken, no search, no typing, notification-derived unread |
| Vega core views | **Good, with holes** | 13 areas audited; strong matters/contacts/calendar/billing; dead drag-drop in Notes, dead download in matter DocumentsTab, ~1,500 lines of dead matter components |
| Navigation model | **Structural gap** | In-memory history desyncs from the browser; filters/tabs/selection are not URLs — nothing filtered is deep-linkable or refresh-safe |
| Atrium suite | **Strong** | Ledger/vacancy/payments/automation all real; ticket deep-link promise broken; service-charge money tracked in two stores |
| Portals | **Strong** | Magic-link + password auth, self-heal mutations show real production hardening; payments still bank-transfer + manual verify |
| Founder/admin app | **Solid** | 18 views all wired; lacks pagination/search at platform scale |
| Marketing sites | **Shipped R66–R74** | Hero video, ticker, lightbox, presence roster, fresh captures, "Live Shot" retired — all verified in code; SEO/analytics are the gap, not visuals |
| AI stack | **Capable but scattered** | Streaming chat with a real 14-tool loop exists — but 5 services, 6 prompt sources, localStorage-bound drafts, porous PII, zero evals |
| Stack currency | **Drifting** | Vite 5→8.3.5, React 18→19.3.1, Tailwind 3→4.3.4, Router 6→7.18.5 available; Convex/Capacitor/genai current-major |
| Ops | **Green + one standing failure** | Vercel prod green through R74; Cloudflare mirror frozen at v1.0.635 (2026-09-18) on an inactive token |

**Top 10 findings, ranked by user impact**

1. **[P0] Messaging deep-link still broken** — the exact flow the owner reported: opening a DM
   from the roster/channel creation lands on the generic inbox. `MessagesView` never consumes
   `activeConversationId` (only `initialTab`/`selectedInboxId`/`systemInbox` are read,
   `MessagesView.tsx:346-406`). Senders: `NewDirectMessageForm.tsx:139,145`,
   `NewChannelForm.tsx:49`, `ComposeModal.tsx:857`. Notification-bell and push-tap links DO
   work (they carry `selectedInboxId` via `NotificationCenter.tsx:55-67` and
   `usePushNotifications.ts:163-199`). Fix ≈ 10 lines in the tab-init effect.
2. **[P0] AI drafts are not artifacts** — legal drafts live in localStorage until a manual
   save (`draftSession.ts:65`); the Aloa-X library is localStorage-only and quota-capped
   (`AloaXView.tsx:76-92`). A lawyer can lose a generated court process on device loss. No
   versioning, no regenerate-and-compare, no artifact history anywhere.
3. **[P0] PII redaction is porous** — `stripPII` covers user text and system instructions
   (`geminiService.ts:489,549,601,759,812`) but NOT attachment-extracted text
   (`geminiService.ts:503-517` pushes `docContext` raw), research source content
   (`useResearch.ts:88`), or ResearchAgent prompts. Client confidences can reach the model
   unredacted despite the consent modal's data-minimization promise (`AIConsentModal.tsx:38`).
4. **[P1] schemaValidation is still off** — `convex/schema.ts:2947` carries the PHASE 0
   REVERT; the full insert audit the REFACTOR_BLUEPRINT called its "single most damaging
   issue" was never done.
5. **[P1] History model desync** — no popstate sync; browser Back changes the URL but not
   the in-memory stack that owns all tab/filter/selection state (`UIContext.tsx:772-823`);
   context dies on refresh (location.state).
6. **[P1] No message search** — `search.searchAll` excludes messages
   (`FullScreenSearch.tsx:69-78`); `getChatMessages` is capped at 500/1000 rows
   (`myFunctions.ts:1013`), so even client-side search would be unreliable.
7. **[P1] Zero funnel analytics on the sites** — PostHog is initialized but there is not a
   single `track` call in `src/sites/**` or `src/components/marketing/**`; every CTA, demo
   open, lightbox open and signup start is unmeasured.
8. **[P1] Dead interactions that look alive** — Notes drag-drop is a silent no-op
   (`NotesView.tsx:104-109` vs real Draggables in `NoteColumn.tsx:135-137`); matter
   DocumentsTab download is a no-op for storage-backed files (`DocumentsTab.tsx:67-69`);
   `DocumentComparisonModal` renders an apology screen (`DocumentComparisonModal.tsx:25-27`);
   data export promises a zip of CSVs and delivers one JSON
   (`DataManagementSettings.tsx:402` vs `DataProvider.tsx:538-576`).
9. **[P1] AI: five services, six prompt sources, two research paths** — `aiService.ts` is a
   34-line passthrough; `sendMessage`/`streamMessage` duplicate ~250 lines; Research Studio
   and Research Chat are separate implementations; model strings are hardcoded outside the
   registry in 5 places (`RpcGuidanceAgent.tsx:44`, `ScaleOfChargesAgent.tsx:50`,
   `DataProtectionAgent.tsx:61`, `GeminiStructurer.ts:13-17`, `geminiService.ts:1465-1469`).
10. **[P1] Cloudflare mirror frozen 7 weeks** — inactive `CLOUDFLARE_API_TOKEN`; the mirror
    serves v1.0.635 (2026-09-18) — no video hero, no R72 ticker — to anyone hitting the
    workers.dev URL. Health-watchdog is report-only, so the freeze persists indefinitely.

---

## 2. The messaging answer (the owner's open question)

*"I had said we should work on the messaging aspect of things, but I'm not sure if that was done."*

**Partially.** What R27–R74 actually shipped, verified in code:

- **Works today:** atomic server-side send with idempotency + FCM push
  (`myFunctions.ts:3840`), attachments and voice notes via Convex storage
  (`MessagesView.tsx:2108-2158`), edit + delete with the ⋮/long-press action menu
  (`MessageThread.tsx:24-30,325-382`, `ChatMessageBubble.tsx:180-249`), unread badges,
  60s-heartbeat presence dots (`myFunctions.ts:69-140`), scheduled sends with a real cron
  claim/reclaim loop (`portals.ts:3140,3228`), WhatsApp/Email outbound with template fallback
  and a 402-gate banner (`communications.ts`, `ComposeModal.tsx:1039`), portal threads with
  durable unread counters, and — separately — **notification-bell and push-tap deep-links do
  open the right conversation** (`NotificationCenter.tsx:55-67`,
  `usePushNotifications.ts:163-199`, server sets both ids `myFunctions.ts:4018-4026`).
- **Still broken — the exact thing the owner tried:** opening a conversation from the
  presence roster ("Send Direct Message") or after creating a channel/DM. Those flows pass
  only `activeConversationId`, which `MessagesView` ignores — you land on the generic inbox
  page. Same class: ContactDetailView's message rows deep-link to a permanent
  "Loading conversation…" spinner (`ContactDetailView.tsx:216,241` →
  `MessagesView.tsx:811-824,2835-2855`), and PropertyDetailView's ticket strip promises
  "Tap to view in Conversations" but navigates with no context at all
  (`PropertyDetailView.tsx:1669`).
- **Missing vs any modern messaging tool:** message search (none anywhere), typing
  indicators (none), per-message read receipts (unread is derived from notifications,
  `MessagesView.tsx:728-735`), "delete for me" (both flags hard-delete for everyone,
  `useMessaging.ts:108-110`), rich-text composer, mobile keyboard dodging
  (`AutoExpandingChatInput.tsx:102` handles Enter only). ComposeModal's in-app channel
  creates a **duplicate DM conversation per send** — no existing-chat dedup
  (`ComposeModal.tsx:829-848`), unlike `NewDirectMessageForm.tsx:67-80` which does dedup.

**The fix for #1 is small and high-leverage:** in the tab-init effect
(`MessagesView.tsx:346-406`), consume `context.activeConversationId` →
`setSelectedInboxId(id); setSelectedSection('team')`. That one change fixes the roster DM
open, the DM create, and the channel create at once. Scheduled as R75 item 1.

---

## 3. State of the stack (the "issues discovered with my stack" review)

Current majors vs npm latest (checked 2026-11-08):

| Package | In repo | Latest | Drift | Note |
|---|---|---|---|---|
| vite | ^5.0.0 | 8.3.5 | **3 majors** | Vite 5 no longer receives fixes; several rollup/esbuild CVE eras have passed since |
| react / react-dom | ^18.3.1 | 19.3.1 | **1 major** | React 19's Actions/useOptimistic are exactly the primitives the UX gaps want |
| tailwindcss | ^3.4.0 | 4.3.4 | **1 major** | v4 = Oxide engine + CSS-first config; config migration required |
| react-router-dom | ^6.21.0 | 7.18.5 | **1 major** | 7 is largely a data-API-compatible step from late 6.x |
| typescript | ^5.3.0 | 5.9.x | minor | fine |
| convex | ^1.32.0 | 1.49.0 | minor | current major — healthy |
| @capacitor/* | ^8.4.0 | 8.6.0 | minor | current — healthy |
| @google/genai | ^2.8.0 | 2.32.0 | minor | current major; notable minor drift (new model support lands in minors) |
| framer-motion | ^12.43.0 | 12.x | none | current |
| zod | ^4.4.3 | 4.x | none | current |

**Position:** the owner is staying on this stack — the right call given the codebase's
maturity. The drift is real but concentrated in the build/UX layer (Vite/React/Tailwind/
Router); the data layer (Convex) and both mobile wrappers (Capacitor) and the AI SDK are
current-major. Upgrade path is staged, one round each, behind the existing quality gates
(tsc baseline 125, vitest 1421, UI ratchet 2312) — never two majors in one round.

**Known stack-level issues to carry forward:**
- `schemaValidation:false` revert (`convex/schema.ts:2942-2947`) — the insert audit was
  never run; this is the REFACTOR_BLUEPRINT's #1 item and still open.
- Offline queue incomplete: OFFLINE_AUDIT counted 158 direct mutation sites and ~40
  unregistered mutations; no queue registry exists in src today.
- Three parallel modal systems (`ModalManager.tsx` 792 ln, `DockedModal.tsx` 696 ln,
  `overlays/ModalLayer.tsx` 416 ln + lazy registry) with duplicated modal types (e.g.
  TaskDetailModal in all three).
- Two UI-primitive systems (`components/toolkit/*` and `components/ui/*`) plus 1,693 raw
  `<button>` elements; the ADR-0004 "ratchet ban" has no lint enforcement
  (`OnboardingWizard.tsx:38-40`).
- `p-retry` is a declared dependency with zero imports (`package.json` vs grep);
  `p-limit` used, `p-retry` dead weight.

---

## 4. Vega core app — page by page (staff side)

*(Full evidence chain per area; severity [P0] broken, [P1] missing vs modern standard,
[P2] polish.)*

### 4.1 Dashboard (`Dashboard.tsx`, `dashboard/*`)
- **Works:** all widgets read real context state (`Dashboard.tsx:128-143`); skeletons
  (`FocusMatterWidget.tsx:7,169-179`); banner crashes isolated
  (`Dashboard.tsx:284,301,311`); downgrade data-hidden state (`Dashboard.tsx:421-427`);
  first-run create-modal with sessionStorage guard (`Dashboard.tsx:222-239`).
- **Gaps:** [P2] DailyFocus slot skeleton is a single bar, not layout-matched
  (`Dashboard.tsx:316-320`); [P2] stats recompute client-side per render
  (`Dashboard.tsx:185-190`); [P2] DailyFocus gated behind
  `firmDetails.aiSettings.enableAllAiFeatures` (`Dashboard.tsx:161,320`); [P2] up to two
  banners can stack once records exist.

### 4.2 Matters (`MatterList`, `MatterBoardView`, `MatterDetailView` + tabs)
- **Works:** skeletons; type filter + search (`MatterList.tsx:287-292`); bulk
  assign/close/export-CSV (`MatterList.tsx:398-425`); cascade-aware delete with
  "Archive Instead" (`MatterList.tsx:108-137`); board dnd stage moves + checklist
  automation prompt (`MatterBoardView.tsx:142-163`); orphaned-client chips
  (`MatterList.tsx:180-190`); detail tabs with "new" badges
  (`MatterDetailView.tsx:553-568`); privacy toggle (`MatterDetailView.tsx:467`).
- **Broken/gaps:** [P1] **dead components** — `MatterBrief` (173 ln) imports
  `ActivityLogTab`/`FilingDeadlineNotice`/`MatterProcessTracking`/`ProceduralComplianceReport`
  (`MatterBrief.tsx:5-9`) but nothing imports `MatterBrief`; `MatterDetailView.tsx:25-27`
  has the imports commented out; `BacklinksPanel` (164 ln) has no importers;
  `StatutoryTaskTimeline` is imported by `TasksAndEventsTab.tsx:9` (verify rendered vs
  unused). Net: ~1,500 lines of orphan UI advertising compliance/timeline/filing-deadline
  features that don't exist in-product. [P1] board workflow is picked from `matters[0].type`
  only (`MatterBoardView.tsx:139`) — mixed-type boards collapse to "Other". [P1] no
  date-column/sorting in list view. [P2] "Edit Case Stages" only visible in board mode
  (`MatterList.tsx:388-400`); [P2] "open in new tab" re-opens the same in-memory view
  (`MatterDetailView.tsx:403`).

### 4.3 Contacts
- **Works:** keyboard nav (`ContactsView.tsx:93-99`); archived filtering
  (`ContactsView.tsx:76`); real activity timeline aggregating matters/tasks/docs/invoices
  (`ContactDetailView.tsx:40-114`); merge/link/external-counsel modals all wired
  (`ModalLayer.tsx:305`, `ModalManager.tsx:264,619-620`).
- **Gaps:** [P1] search covers name+email only — phone displayed but unsearchable, no
  organisation search (`ContactsView.tsx:81-84`); [P1] no bulk actions; [P2] CSV/vCard
  import removed — "not yet implemented" (`ContactsView.tsx:122-123`); [P2] no dedupe
  detector.

### 4.4 Tasks
- **Works:** groupBy none/status/priority/matter (`TasksView.tsx:186-248`); bulk
  archive/delete/status (`TasksView.tsx:111-133` + `BulkActionBar`); mobile swipe
  right=done/left=actions (`TaskList.tsx:281-316`); keyboard nav (`TaskList.tsx:801-803`);
  per-user filter persisted in history entry (`TasksView.tsx:67-76`); delete surfaces
  errors and keeps the modal open for retry (`TasksView.tsx:163-171`).
- **Gaps:** [P1] Kanban retired over dnd reliability ("recurring drag-and-drop reliability
  issues", `TasksView.tsx:52-60`) — matters has a board, tasks doesn't; [P1] text filter
  matches title only (`TasksView.tsx:87`); [P2] groupBy not persisted across visits;
  [P2] `UserTaskSummaryPanel` only in `appMode==='multi'` (`TasksView.tsx:270`).

### 4.5 Calendar
- **Works:** overlap clustering + same-attendee conflict flagging (`CalendarView.tsx:26-76`);
  recurrence with frequency+end date (`EventForm.tsx:72-98,223`); `expandRecurringEvents`
  + Atrium virtual events (`calendarUtils`); view mode persisted per user
  (`CalendarView.tsx:470-472`); highlight scroll-to-event (`CalendarView.tsx:521-527`).
- **Gaps:** [P1] **no drag-drop to reschedule** — no dnd import in `CalendarView.tsx`;
  every reschedule goes through the edit modal (below Google/Notion standard); [P2]
  month cells show 2 events then "+N more" (`CalendarView.tsx:89-91`).

### 4.6 Notes
- **Works:** `[[ ]]` link autocomplete over matters/contacts/docs (`NoteEditor.tsx:642-668`);
  debounced autosave 1.5s (`NoteEditor.tsx:614-628`); 4-stage mobile column nav
  (`NotesView.tsx:97-101`); scope filtering firm/private (`NotesView.tsx:42-44`); offline-
  capable saves through the generic CRUD path.
- **Broken/gaps:** [P1] **`onDragEnd` is a no-op** (`NotesView.tsx:104-109`) while
  `NoteColumn` renders real Draggables (`NoteColumn.tsx:3,135-137`) — drag & drop silently
  does nothing; [P1] **no search across notes at all** — no search input exists in
  `NotesView.tsx`; [P1] backlinks UI orphaned (`BacklinksPanel` has no importers — the
  `[[ ]]` links are written but never surfaced); [P2] no toolbar undo/redo (StarterKit
  Cmd+Z only, `NoteEditor.tsx:630-636`).

### 4.7 Documents (vault, DraftPro, PDF)
- **Works:** storage-backed downloads via `downloadFromConvex` (`DocumentList.tsx:436-440`);
  drag-drop upload routing single/batch (`DocumentsTab.tsx:41-63`); typed+drawn signatures
  (`SignDocumentModal.tsx:15-28`); sequential batch uploads with status
  (`BatchUploadModal.tsx:16,30-66`); DraftPro undo/redo toolbar (`DraftProEditor.tsx:2482-2483`),
  debounced save + unmount flush (`:990`), draft sessions/tabs + `?draftKey=` hydration
  (`draftTabs.ts`, `draftSession.ts`, `DraftProEditor.tsx:557`); pdf.js viewer (1,003 ln);
  letterhead HeaderDesigner/Renderer.
- **Broken/gaps:** [P1] **DocumentsTab download is a silent no-op for storage-backed
  files** — `if (!doc.file?.dataUrl) return;` ignores `storageId`
  (`DocumentsTab.tsx:67-69`), unlike `DocumentList.tsx:436`; [P1]
  **`DocumentComparisonModal` is a stub** — "Inline redline comparison is not yet
  available" (`DocumentComparisonModal.tsx:25-27`); [P2] docx export is a "minimal valid
  structure" (`docxExport.ts:161-162`) — below Word fidelity; [P2] ShareDocumentModal
  shares only as internal chat message (`ShareDocumentModal.tsx:66-78`) — no external
  link/permissions; [P2] no inline rename / folder tree in main list.

### 4.8 Billing
- **Works:** void/reinstate with mandatory reason + audit trail (`BillingView.tsx:81,90-97`);
  desktop table + mobile cards; per-status row actions (`BillingView.tsx:150-177`);
  BillingMonitor outbox state machine with lawyer overrides and "backend not deployed"
  resilience (`BillingMonitorView.tsx:1-24`); real invoice PDFs
  (`InvoiceDetailView.tsx:7,126`); unbilled time/expense selection
  (`InvoiceGeneratorForm.tsx:37-40`); TrustAccountTab real ledger with offline queue and
  delete-reason modal (`TrustAccountTab.tsx:126-166`).
- **Gaps:** [P1] no online payment collection — reminders/void only (vs Clio/Stripe
  standard); Paystack pending; [P2] `invoiceService.ts` is a deprecated 18-line husk
  (`invoiceService.ts:16-18`); [P2] tab deep-link via context only, not URL
  (`BillingView.tsx:352-364`).

### 4.9 Reports
- **Works:** lazy jsPDF/autotable (`reportGenerator.ts:2-24`); correct user-attribution for
  shared matters (`ReportingView.tsx:63-108`); portal roles excluded from timesheets
  (`ReportingView.tsx:32-34`); all report components consume real contexts; no mock data.
- **Gaps:** [P1] PDF-only — no CSV/XLSX, no scheduled/emailed reports, no saved configs;
  [P2] button-spinner loading, no preview before download (`ReportingView.tsx:38-41`).

### 4.10 Misc views
- **Archive:** real list + restore + permanent delete, fuse search, soft-archived-contact
  restore wired (`ArchiveView.tsx:22-34`). ✔
- **Help/Resources:** real content hubs; Help includes Aloa ask-AI with disabled state
  (`HelpView.tsx:1093-1094`).
- **DailyFocus:** real prioritized focus logic, AI-gated (`DailyFocusView.tsx:21-45`).
- **Timeline:** real case roadmap; reachable via CommandPalette (`CommandPalette.tsx:58-63`).
- **WorkflowBuilder:** drag-reorder + inline rename (`WorkflowBuilderView.tsx:35-64`) —
  only reachable inside Settings→Templates (`TemplatesSettings.tsx:175`).
- **ComplianceView:** thin wrapper around ComplianceReports (fine).

### 4.11 Settings suite
- **Works:** 17 subviews, mobile drawer + desktop sidebar, deep-link `settingsTargetId`
  routing (`SettingsView.tsx:573-600,646-700`); real WhatsApp template sync
  (`IntegrationSettings.tsx:55-180`); real prefs + test push
  (`NotificationSettings.tsx:61-62,356`); SubscriptionSettings 2,010 ln; PortalAccess
  1,614 ln; LegalIntelligenceHub wired (`SettingsView.tsx:682`).
- **Broken/gaps:** [P1] **data export lies** — UI promises ".zip containing CSV
  spreadsheets… and a JSON backup" (`DataManagementSettings.tsx:402`) but
  `handleExportData` downloads one JSON file (`DataProvider.tsx:538-576`); [P1] backup
  restore is stubs — "not yet available" toasts (`DataProvider.tsx:536-537`); [P2]
  `registerBroadcastHandler`/`handleRemoteAction` are empty no-ops
  (`DataProvider.tsx:579-580`).

### 4.12 Onboarding & first-run
- **Works:** real multi-step wizard with crash resume (`OnboardingWizard.tsx:186-204`);
  practice-blueprint engine, idempotent (`usePracticeProfile.ts` 822 ln +
  `practiceProfileLibrary.ts` 2,852 ln); GettingStartedChecklist 828 ln with durable
  dismissal (`GettingStartedChecklist.tsx:194-198`); viewport-aware tour
  (`OnboardingTour.tsx:19-46`); WorkspaceSetupModal wired (`ModalManager.tsx:697`).
- **Gaps:** [P2] `onSuccess={() => { }}` no-op (`ModalManager.tsx:697`).

### 4.13 Global chrome & cross-cutting
- **Works:** CommandPalette (fuse.js, focus trap, product-filtered,
  `CommandPalette.tsx:31-77`); FullScreenSearch on server-side `search.searchAll` with
  250ms debounce (`FullScreenSearch.tsx:9-15`); NotificationCenter real mark-read +
  context pass-through (`NotificationCenter.tsx:35-60`); 3-layer offline detection
  (events + Convex ping + 15s poll, `UIContext.tsx:595-657`) with global banner
  (`UIContext.tsx:348-374`); error-boundary trio with Sentry
  (`GlobalErrorBoundary.tsx:19`); LockScreen re-auth with attempt limiting
  (`LockScreen.tsx:27-44`); sidebar product filtering + unread badges
  (`Sidebar.tsx:139-169`).
- **Structural gaps:** [P1] the history model (see §3) — no popstate sync, filters/tabs/
  selection never in URLs, context lost on refresh (`UIContext.tsx:772-823`); goBack has
  a sensible deep-link fallback parent map (`UIContext.tsx:848-866`) — the model is
  fixable in place, not a rewrite.

**Mock/demo check:** demo state loads only for `demo@practicepro.ng`
(`DataProvider.tsx:700,779-781`); demo session DEV-gated (`AuthContext.tsx:449`). One
flag: `research/LawReportsView.tsx:7` imports `MOCK_CASE_LAW` — real users can see mock
case law in the research surface.

---

## 5. Atrium, portals, admin, auth

### 5.1 Atrium suite
- **Works:** PropertyManagerView presets + lease-urgency chips + bulk ops
  (`PropertyManagerView.tsx:31-36,107-118`); PropertyDetailView 6 tabs with unit deep-link
  highlight (`PropertyDetailView.tsx:367-432`) and dead unit-messaging strip removed
  (`:1515-1521`); LeaseProgressBars/ServiceChargeBars with management-only variant
  (`PropertyTrackingView.tsx:491-497`); LedgerManager with offline queue + idempotency
  keys (`LedgerManager.tsx:11`) and financial-lifecycle checks; VacancyPipeline Kanban fed
  by the public form (`AtriumPublicApplicationForm.tsx` → `addLeadToPipeline`); Payment
  Proofs approve/reject closing a real gap; AutomationCenter run-now + Outbox links
  (`AutomationCenter.tsx:421`); ServiceChargeMonitor obligations/enforcement store;
  EstateCommunity amenity/bulletin/directory per-firm gated; AtriumInbox/
  CommunicationPrintView **deleted cleanly** — merged into MessagesView (no dead imports).
- **Gaps:** [P1] ticket strip deep-link broken (`PropertyDetailView.tsx:1669` — see §2);
  [P2] service-charge money in two stores (documented dual system,
  `ServiceChargeMonitor.tsx:5-16`) — reconciliation confusion risk; [P2] no saved
  column/sort preferences in property list.

### 5.2 Portals (clients + residents)
- **Works:** magic-link invite (`portals.ts:2359` verifyInviteToken) + password setup
  (`portals.ts:2480`) + reset by recovery code (`portals.ts:2758`); self-heal mutations
  (repairPortalUserFirmId, relink, selfHealClientContactLink) — evidence of real
  production hardening; ClientDashboard 2,265 ln with milestones/docs/billing;
  ClientBillingTab trust-model fix — clients can no longer self-mark invoices Paid
  (`ClientBillingTab.tsx:37-41`); TenantPortal 13 tabs; TenantPortal MessagesTab is a
  self-contained correct implementation with its own `activeConversationId` state +
  read-marking effect (`TenantPortal/MessagesTab.tsx:38,114-118`) — ironically the exact
  pattern the admin MessagesView lacks; GatekeeperInterface tablet-optimized with
  offline cache of last 100 verifications; VisitorPortal 6-digit codes; per-user font
  scaling (`PortalFontSizeControl`).
- **Gaps:** [P2] no in-portal push (registration exists `portals.ts:2830`); [P2] client
  payment = bank transfer + manual verification (Paystack webhook not active).

### 5.3 Founder/admin app
- **Works:** self-contained shell (`AdminApp.tsx:1-9`), separate build/APK
  (`admin.html`, `vite.admin.config.ts`, `capacitor.admin.config.ts`); 18 views all
  wired: OrganizationsHub (722 ln), FirmManagement, UserManagement, Analytics,
  FounderSignals, SystemStatus, AuditLogs (noise-filtered), AloaUsageCenter (privacy-safe
  AI usage), FounderNotificationsCenter (4 sources), BroadcastConsole (679 ln),
  SalesPipeline, SubscriptionRequestsCenter (512 ln), RefundRequestsCenter (527 ln),
  FeedbackInbox (crash-proofed + restore), SecurityCenter, FinancialSettings, ExportCenter,
  Settings (FLAG_SECURE persistence). No dead views.
- **Gaps:** [P2] several list views lack pagination/search at platform scale
  (UserManagement 121 ln, FirmManagement 206 ln).

### 5.4 Auth & security screens
- **Works:** Login 594 ln / Signup 666 ln with real ToS consent (NDPA);
  ConnectionStatus diagnostics + repair flows (385 ln); LockScreen attempt limiting;
  biometric = native + WebAuthn fallback gating a stored session, never the password
  (`utils/biometric.ts`); TermsAcceptance dual persistence (localStorage + Convex
  `recordConsent`, `myFunctions.ts:3590`); usePermissions role+plan matrix consumed by
  BottomNav/Sidebar.
- **Gaps:** [P2] no biometric button on LockScreen (lives in Login flow only).

---

## 6. Marketing sites (hub / vega /atrium) — page by page

**Architecture:** one SPA, three surfaces — `LandingPage.tsx:26-33` routes `/` → HubSite,
`/vega` → VegaSite, `/atrium` → AtriumSite, key-remounted; per-product title/favicon/OG
swapped client-side only (`useSiteChrome`, `useProductBranding`).

### 6.1 Verified shipped (R66–R74) — all confirmed in code
- Hero video as background at every width + seamless clip playlist, poster-first LCP,
  webm+mp4, network-gated clip 2 (`HeroVideo.tsx`, `public/video/vega-hero*`).
- Capabilities ticker docked flush to page-1 bottom, 48px bar, no cream seam
  (`MarqueeSection.tsx:99-135`, hero `min-h-[calc(100dvh-3rem)]`).
- Capabilities gallery lightbox — 14-exhibit walk, keyboard, focus return, scroller lock
  (`AppShotLightbox.tsx`, 229 ln).
- Presence roster + DM composer demo on the landing dashboard (`CollabPresence.tsx`,
  R74), workspace/profile/ALOA hotspots (`DashboardHotspots.tsx`, 469 ln).
- Fresh captures: 22 app captures dated 2026-11-08 in `public/assets/landing/app/`.
- "Live Shot" labels fully retired (zero matches in src/ + public/; R74 comment in
  `SystemTour.tsx:53`). Fake `app.practicepro.ng` **links** gone from marketing surfaces —
  the remaining string in `VegaHero.tsx:164` is a decorative address bar, not a link.
- Pricing matrix renders `VEGA_TIERS` from `tiers.ts` — single source of truth, no drift
  (`VegaPricing.tsx:20-35` vs `tiers.ts:153-238`).

### 6.2 Issues
- **[P1] SEO is JS-only** — per-route meta/OG exists only after hydration; no prerender,
  no sitemap.xml, no JSON-LD (hub comment at `hub/index.tsx:30` claims structured data —
  stale, zero matches). Non-JS unfurlers (WhatsApp) see the hub card on /vega and /atrium.
- **[P1] Zero funnel analytics** — `initPostHog` exists (`utils/analytics.ts:27`) but
  zero `track` calls in `src/sites/**` / `marketing/**`; labeled sources ('Hub Hero',
  'Vega Pricing', 'Mobile Sticky CTA') only reach Convex on drawer submit; public
  page-views go to a parallel raw-Convex stream invisible to PostHog
  (`App.tsx:770-778`).
- **[P1] Footer/legal links are `<span onClick>`** (`HubShell.tsx:283-287`, both product
  shells) — not crawlable, weak semantics. "Komplete — both" footer button opens Contact
  Sales although a `/komplet` route exists — mildly confusing.
- **[P1] "99.9% Platform Uptime"** (`AtriumStats.tsx:22`) — no public status page or SLA
  backs it (fails the project's own claims-audit honesty standard).
- **[P1] ContactSalesDrawer** — no focus trap, no `role="dialog"` verification; error
  path leaks a gmail fallback (`ContactSalesDrawer.tsx:94`) inconsistent with
  `dpo@practicepro.ng` (`HubShell.tsx:288`).
- **[P2] Polish:** Atrium hero JPG lacks width/height/srcset (CLS/LCP risk);
  `useSiteScroll` tracks 3 of 12 atrium sections (coarse nav state); woosh.dpdns.org is a
  fragile free-subdomain link (`OurWorkSection.tsx:278`); hub nav lacks focus-visible
  rings (`HubShell.tsx:152-156`); Vega FAQ doesn't mention the WhatsApp reminder channel
  split; FAQ accordion lacks `aria-controls`.

---

## 7. AI stack deep dive (the separate study)

### 7.1 Architecture as-built

| Surface | Path | Transport | Models | Output destination |
|---|---|---|---|---|
| ALOA/ARIA chat | `AloaChat.tsx` → `aiService.ts:6-33` → `geminiService` | REST → Convex-proxy fallback | `AI_CONFIG` ladders | Chat bubble (streamed) + `aloaConversations` (`AloaChat.tsx:167,2334`) + `ai_output_logs` |
| DraftPro drafting | `start_drafting` tool → `streamDraft` (`geminiService:881-1164`) | SSE → Convex `/ai/stream` | `draftingPlan` pro-first | Editor via onChunk + `draftContentStore`; **localStorage** `draftSession.ts:65-77`; explicit save → documents |
| Research Studio | `ResearchAgent.analyzeSources` → `streamGemini` (`aiUtils:191-375`) | **Blocking** REST | 2.5-flash + ladder | `researchAnalysisResults` (Convex) |
| Research Chat | `useResearch:53-200` | **@google/genai SDK inline** (`:123-124`) | default model | `researchMessages` (Convex) |
| Doc intelligence (ALDIA) | `AdvancedLegalDocumentIntelligenceAgent` — from `DataProvider:461`, `AloaChat:1391`, `useMatters:148` | SDK direct | default | `riskAnalysis`/metadata on document; PII report → `PIIShieldBadge` |
| Micro-agents (jurisdiction/tax/scale/RPC/NDPA) | SmartMatterModal etc. → each agent | SDK one-shot | **hardcoded** `'gemini-2.5-flash'` | Structured JSON → form fields |
| Matter ingestion | `IngestionAgent:121` | SDK lazy | default | Pre-filled MatterForm |
| Aloa-X indexer | `AloaXView` → `GeminiStructurer` + `CheckpointManager` | raw fetch 90s | local `GEMINI_MODEL_CHAIN` | **localStorage only**, capped 500 sections (`AloaXView:76-92`) |
| Note dictation | `transcribeAudio` (`geminiService:1447-1522`) | Convex action | 3-model chain | `notePages.rawTranscript` + `cleanedTranscript` — **best artifact pattern in the repo** |
| Server background | `conversationMemory`, `proactive.ts:578,804` | server fetch | `BACKGROUND_MODEL` | `conversation_summaries`, proactive insights |
| Brain RAG | `useBrainAutoIndex` → `generateEmbedding` (`aiUtils:506-547`) | client REST | `text-embedding-004` pinned | `embeddings` table |

**Model registry (exact strings):** `gemini-2.5-flash` (default/flash),
`gemini-3.1-pro-preview` (pro/research), `fallbackPlan: [2.5-flash, flash-latest,
3.8-flash, 3.1-pro-preview]`, `draftingPlan: [3.1-pro-preview, 2.5-flash, flash-latest,
3.8-flash]` (`aiUtils.ts:45-87`); backend mirror `aiModels.ts:25-26`. 1.5/2.0/2.5-pro
were actively retired (R31/R32) — the registry is *maintained* but **duplicated in 6
places**.

**Prompt sources (6):** `aloaPrompts.ts` (448 ln, 3 protocol variants); `ai/prompts/*.md`
via ICM `loadPrompts.ts`; hardcoded `SYSTEM_PROMPT` in 8 agents; inline strings
(GeminiStructurer, noteDictation, proactive, useResearch:127); AgencyHub assembly; and
`nigerian-litigation-drafting/` — **a Claude-skill-style 414-line markdown pack at repo
root with zero runtime references** — a dead, unwired prototype of exactly the pattern
the owner wants.

### 7.2 Assessment against modern patterns

| Dimension | Rating | Evidence |
|---|---|---|
| Skills | PARTIAL | Ingredients exist (ICM markdown, litigationSkeletons, proceduralRules, legalModules, jurisdictionConfig) but no registry; 8 agents hardcode prompts; no tool binding or validation per skill; the one real skill (nigerian-litigation-drafting) is unwired |
| Artifacts | PARTIAL | Chat + dictation + research persist to Convex; drafts are localStorage-first; Aloa-X localStorage-bound; **no versioning, no regenerate-and-compare, no artifact history anywhere** |
| Agent architecture | PARTIAL | One genuine agent loop: chat with 14 function-declared tools, 6-iteration loop, thoughtSignature preservation (`geminiService:37-316,469-481`); the "11 agents" are misnamed — 9 are one-shot prompt→JSON calls; ALDIA "orchestrator" is one call told to emulate three sub-agents (`:105-115`) |
| Streaming & UX | TODAY for chat/draft; MISSING for research | SSE token streaming since 2026-09-23 (`AloaChat:2287-2297`); streaming drafts with cancel at 30s + AbortSignal; Regenerate button (`AloaChat:2744,3895`); research is blocking, no cancel (`useResearch:131`) |
| Structured output | PARTIAL | `responseSchema` used correctly in 6 agents; but the highest-value surfaces parse free text post-hoc: citation pipe format (`citationParser.ts`), `[[source_id]]` regex (`ResearchAgent:149-168`), HTML tag-balance repair (`validateStreamedHtml`), JSON substring slicing (`geminiService:1376-1379`) |
| Context management | PARTIAL (rich, budgetless) | AgencyHub assembles identity → entities → jurisdiction → RAG → dashboard → roll call → 30-day schedules (`AgencyHub:87-391`); **zero token accounting**; truncation ad-hoc per call site (15k/60k/3k chars) |
| Model strategy | PARTIAL | Real tiering + user selector (`AloaChat` ModelBadge), pro-first drafting, OpenAI-compat provider seam, key-health probes, Convex-proxy fallback; hardcoded strings bypass registry in 5 places; no token/cost accounting (charCount only, `aiAudit:44`); tier gating exists only as marketing copy (`tiers.ts:190,219`) — no runtime quota |
| Reliability | PARTIAL | Model-ladder fallbacks, per-attempt timeouts, FIFO `AIRequestQueue`, friendly error classifier; `p-retry` never imported; no circuit breaker; offline queue doesn't cover AI; stale copy "timed out after 15 seconds" vs real 120s (`aiRequestQueue:34` vs `:163`); attachment processing failures swallowed (`geminiService:526-528`) |
| Evaluation | MISSING | Tests cover plumbing only (`aiProvider.test.ts`, `aiTrust.test.ts`, `identityRedaction.test.ts`, `aloaSendIntegrity.test.ts`); zero prompt-quality evals, no golden sets; `deterministicReview` (`geminiService:1258-1332`) is the seed of an eval harness but runs in production only |
| Simplification | — | 5 services + 4 transport idioms + 6 prompt sources for what should be 1 gateway + 1 skills registry + 1 artifact store |

**Safety/PII specifics:** `stripPII` covers user text + system instructions in chat and
research user message (`useResearch:133`) but **not** attachment-extracted text
(`geminiService:503-517` — verified), research source content (`useResearch:88`), or
ResearchAgent prompts. Safety settings are `BLOCK_NONE` on all four categories
(`geminiService:552-557,817-822,1018-1024`) and dropped entirely on the OpenAI-compat
path (`aiProvider:230`) — a governance risk for a legal product. Atrium's advertised
"AI-personalized notices" (`tiers.ts:330`) has **no implementing code** — live
claims-audit exposure.

### 7.3 Target architecture (the modernization plan)

1. **`src/ai/gateway.ts` — one service.** Owns provider resolution (keep the existing
   `aiProvider` seam — it's well designed), model ladders, streaming, retries/timeouts,
   safety, PII strip, audit + usage metering, Convex-proxy fallback. All surfaces call
   `gateway.chat() / stream() / generate({ skillId, input }) / embed()`. Delete
   `aiService.ts`, `streamGemini`, `streamGeminiMultipart`, per-agent SDK clients.
2. **`src/ai/skills/` — one registry.** A skill = `{ id, prompt (markdown, ICM-style),
   tools, responseSchema?, validation }`. Seed with 12: aloa-chat, aria-chat, draft,
   draft-review, research-analyze, research-chat, doc-intelligence (absorbing ALDIA +
   RPC + NDPA), jurisdiction, tax-deductibility, scale-of-charges, matter-ingest,
   transcribe, indexer-extract. `nigerian-litigation-drafting` becomes
   `skills/litigation-drafting/` with its skeletons merged into `litigationSkeletons`.
3. **`src/ai/artifacts/` — one store.** Convex-first: every generation writes an
   `artifacts` row (type, version, sourceSkill, model, prompt-hash, content, citations)
   linked to matter/notebook. Surfaces render side-by-side (draft v1 vs v2), support
   regenerate-with-history, export. localStorage becomes a write-through cache, not the
   system of record (fixes AloaX device-binding and draft loss).
4. **`src/ai/evals/` — one harness.** Golden prompts + `deterministicReview` as CI
   assertions on skill outputs; schema-validation tests for every `responseSchema` skill.

**Deletion net:** `aiService.ts` (34-ln passthrough), `ResearchAgent.chatWithSources`
(zero callers), one of the two RPC implementations (`RpcGuidanceAgent` vs ALDIA's inline
RPC Guardian `ALDIA:225-241`), `DataProtectionAgent` (merge into ALDIA's
`dataProtection` schema — identical NDPA analysis), one of the two jurisdiction systems,
`streamGemini`/`streamGeminiMultipart`, ~250 lines of `sendMessage`/`streamMessage`
duplication, hardcoded model strings, `p-retry`. Net effect: 5 services → 1; roughly
half of ~7,000 lines of agent/service code; every model call metered and auditable in
one place.

---

## 8. Prior-plan reconciliation ("what I said a year ago")

| Document | Status today |
|---|---|
| SAAS_HARDENING_PLAN.md | R13/14/15/16/17 identity+webhook work done. **Still open:** Paystack live keys (user-side); tier-enforcement audit vs `tiers.ts`; staging restore drill ("half pending staging Convex setup"). Doc frozen ~Sept. |
| REFACTOR_BLUEPRINT.md | **0.1 schema validation — REVERTED, still open** (`convex/schema.ts:2947`, verified). 0.6 plaintext passwords half-done (deliberate soft-migration, documented `authUtils.ts:77-80`). 0.2-0.4 cross-firm write holes likely fixed in the strict-identity sweep — unverified line-by-line. |
| OFFLINE_AUDIT.md | **Still open:** 158 direct mutation sites, ~40 unregistered mutations, no queue registry in src today — offline-queue work stalled since the audit. |
| PRICING_STRATEGY.md (docs/archive) | **Obsolete** — "Core ₦15k/Pro ₦45k/Ultimate ₦80k" tiers no longer exist (code ships Free/Growth ₦45k/Pro ₦80k/Enterprise); conflicts with Atrium ladder. Misleading if read as current. |
| SALES_PLAYBOOK.md (docs/archive) | **Obsolete/risky** — "Vector Database lock-in", ₦250k "pure margin" framing, "Included in Ultimate Plan" (plan gone). Retire or rewrite. |
| DIGITIZATION_BUSINESS_MODEL.md (docs/archive) | **Obsolete** — no digitization/RAG ingest product shipped; no vector-indexed archive ingestion in code. |
| CLAUDE_PRICING_PROMPT.md (docs/archive) | **Accurate** — matches current `tiers.ts` exactly (ironically the freshest pricing doc is the archived prompt). |
| AI_FEATURES.md, SETUP_WIZARD_DESIGN.md, ESTATE_COMMUNITY.md | Done/accurate; wizard shipped incl. receipt-polish items 1-3. |
| DEV_TOOLKIT.md | tsc baseline "153" stale (current 125). |
| GIT_AI_GUIDE.md | references Windows path `c:\Users\USER\Desktop\pp` — obsolete. |
| Root doc index | drifted — most "root" docs actually live under `docs/archive/{specs,strategy,prompts,audits}/`. |

---

## 9. Deploy & ops

- 14 workflows: production-deploy (pinned-sha promote: quality gate → Vercel → Convex
  probe → Cloudflare mirror), staging, staging-seed, build-apk, build-admin-apk, tests,
  health-watchdog (cron probes, auto issue), backup-restore-drill, observability-drill,
  convex-backfill, whatsapp-live-test, 2 inspect harnesses.
- **Cloudflare mirror standing failure:** inactive `CLOUDFLARE_API_TOKEN` → fail-fast;
  mirror frozen at `04d798b3` / 2026-09-18 / v1.0.635 while Vercel serves R74
  (`176eb905`). ~100+ APK versions behind; its /vega predates the video hero. No
  workflow auto-retries/rotates the token; watchdog is report-only — the freeze persists
  until the owner rotates the secret.
- `vercel.json` / `wrangler.jsonc` sane; CSS-filename rotation plugin compensates for
  edge poisoning; `public/version.json` regenerates per build.
- 13 round-pinned live-verify harnesses (r21→r71) — strong per-round verification
  culture; keep it.

---

## 10. Roadmap — R75 onward (step by step; owner picks the pace)

Gates for every round: `tsc` at baseline 125 (zero new), vitest green (1,421 today), UI
ratchet 2312 held, vite build green, live verification on Vercel prod + worklog record.

**Phase A — make the clicks land (interaction truth)**
- **R75 — Deep-links & dead interactions.** (1) `MessagesView` consumes
  `activeConversationId` → `setSelectedInboxId` + `setSelectedSection('team')`
  (`MessagesView.tsx:346-406`) — fixes roster DM open/create + channel create at once;
  (2) ContactDetailView rows: resolve `clientMessages` in the 'flat' lookup
  (`ContactDetailView.tsx:216,241`, `MessagesView.tsx:811-824`) — kill the permanent
  spinner; (3) PropertyDetailView ticket strip carries real context
  (`PropertyDetailView.tsx:1669`); (4) wire or remove Notes drag-drop
  (`NotesView.tsx:104-109`); (5) unify document download on the `storageId` helper
  (`DocumentsTab.tsx:67-69`); (6) make data export honest — ship the promised zip of
  CSVs or fix the copy (`DataManagementSettings.tsx:402`). Acceptance: scripted
  click-through of every listed path lands on the right thread/screen; no silent no-ops.
- **R76 — Messaging to daily-driver level, part 1.** Message search (server-side:
  extend `search.searchAll` + conversation-scoped; index beyond the 500/1000 caps),
  typing indicators on the existing presence table, per-message read state replacing
  notification-derived unread (`MessagesView.tsx:728-735`), "delete for me" honored
  (`useMessaging.ts:108-110`). Acceptance: search finds a message older than the current
  cap from another device; typing dot appears <2s.
- **R77 — Messaging part 2 + polish.** ComposeModal DM dedup (`ComposeModal.tsx:829-848`),
  markdown/rich composer, visualViewport keyboard dodging
  (`AutoExpandingChatInput.tsx:102`), moderation basics (mute/report).

**Phase B — app-wide model fixes**
- **R78 — URL/history model.** Popstate sync of the in-memory stack; move filter/tab/
  selection state into query params; deep-linkable filtered states; context survives
  refresh (`UIContext.tsx:772-823`). Acceptance: browser Back/Forward match app state at
  every step; a filtered view URL rehydrates identically after refresh; shareable URLs.
- **R79 — Dead code & consolidation.** Decide per component: revive or delete the 7
  orphaned matter components (~1,500 ln) + BacklinksPanel + notes search; three modal
  systems → one (behind the lazy registry); toolkit/ui unification + lint-enforced
  ratchet (replace the unenforced comment ban, `OnboardingWizard.tsx:38-40`);
  `LawReportsView` off `MOCK_CASE_LAW`.

**Phase C — AI modernization (the separate mandate)**
- **R80 — Gateway unification.** Build `src/ai/gateway.ts`; delete `aiService.ts`,
  `streamGemini`/`streamGeminiMultipart`, per-agent SDK clients; dedupe
  `sendMessage`/`streamMessage`; single model registry injected into Convex at build
  time; kill hardcoded model strings (5 sites).
- **R81 — Skills registry.** `src/ai/skills/` with 12 seed skills from the 6 prompt
  sources; wire `nigerian-litigation-drafting` as the first runtime skill (or delete
  it); every skill carries `responseSchema` where structured — retire the citation
  pipe-regex and `[[source_id]]` post-hoc parsing.
- **R82 — Artifacts store.** Convex `artifacts` table; drafts/AloaX/research outputs
  become versioned first-class objects; regenerate-and-compare UI in DraftPro;
  localStorage demoted to write-through cache. Acceptance: a generated draft survives
  device loss; two versions render side-by-side.
- **R83 — Research modernization.** One research path (merge Studio + Chat), streaming
  with cancel, tool use.
- **R84 — AI safety, metering, evals.** Extend `stripPII` to attachments + research
  sources; revisit `BLOCK_NONE` safety settings (and the OpenAI path that drops them,
  `aiProvider:230`); token/cost accounting per call + runtime tier quotas (enforce the
  "Uncapped Priority" copy or change the copy, `tiers.ts:219`); golden-prompt evals in
  CI seeded from `deterministicReview`.

**Phase D — stack currency (one major per round, order = risk)**
- **R85 — Vite 5 → 8** (step through 6/7 if plugin friction demands; verify
  `bust-css-cache` and chunk-hash assumptions).
- **R86 — React 18 → 19** (adopt useOptimistic/Actions to close the optimistic-update
  gaps in §4).
- **R87 — Tailwind 3 → 4** (Oxide; CSS-first config; audit dark-mode classes).
- **R88 — react-router 6 → 7** (pairs naturally with R78's URL work; consider folding
  R78 into this round).

**Phase E — sites & growth**
- **R89 — Marketing SEO + analytics.** Per-route meta at build time (prerender or edge
  injection), sitemap.xml + JSON-LD (or fix the stale hub comment), PostHog funnel
  tracking on every labeled CTA, footer `<span onClick>` → real links, ContactSalesDrawer
  focus trap + dialog semantics, publish a status page to back (or change) the 99.9%
  claim, Atrium hero srcset + width/height.

**Phase F — data integrity & commerce**
- **R90 — schemaValidation program.** The full insert audit, then flip
  `schemaValidation:true` (`convex/schema.ts:2947`). This is the REFACTOR_BLUEPRINT's #1
  item and unlocks schema as real protection.
- **R91 — Offline queue completion.** `useQueuedMutation` registry for the ~40
  unregistered mutations; AI calls covered; retire or implement
  `registerBroadcastHandler` no-ops.
- **R92 — Payments.** Paystack live keys (owner action) + webhook, online invoice
  collection in ClientBillingTab, kill the `invoiceService.ts` husk.

**Standing owner actions (not code):** rotate `CLOUDFLARE_API_TOKEN` and re-run the
mirror job; decide Paystack go-live; retire/rewrite the three obsolete strategy docs;
review the "AI-personalized notices" tier copy (tiers.ts:330) until R84 ships it or the
copy changes.

---

## Appendix — verification basis

- Audited tree: `176eb905` (R74, v1.0.744, build-1138, 2026-11-07). Vercel prod green;
  Cloudflare mirror frozen (standing).
- Four parallel audits (app core / messaging+Atrium+portals+admin / sites+prior plans /
  AI stack), each code-verified with file:line; the three highest-impact claims
  (schemaValidation revert, PII attachment bypass, dead matter components) independently
  re-verified by direct read; stack versions cross-checked against the npm registry on
  2026-11-08.
- Quality-gate baselines at time of audit: tsc 125, vitest 1,421, UI ratchet 2,312.
