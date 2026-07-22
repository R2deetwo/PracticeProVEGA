# PracticePro — Comprehensive Architecture & UI/UX Audit Report

**Date:** 2026-07-19
**Auditor:** Principal Software Engineer + Senior UI/UX Architect
**Scope:** Full codebase (src/) — Engineering logic (7 domains) + UI/UX (10 categories)
**Method:** Parallel agent-based static analysis of ~280 component files

---

## EXECUTIVE SUMMARY

| Domain | P0 | P1 | P2 | P3 | Total |
|--------|----|----|----|----|----|
| State Management | 0 | 9 | 5 | 1 | 15 |
| API/Async Handling | 3 | 5 | 8 | 3 | 19 |
| Form Validation | 0 | 4 | 6 | 4 | 14 |
| Navigation/Routing | 2 | 9 | 11 | 8 | 30 |
| Data Persistence | 1 | 3 | 9 | 5 | 18 |
| Error Handling | 0 | 9 | 9 | 0 | 18 |
| Performance | 5 | 14 | 8 | 5 | 32 |
| **Engineering Subtotal** | **11** | **53** | **56** | **26** | **146** |
| UI/UX Typography | 0 | 3 | 2 | 3 | 8 |
| UI/UX Forms/Inputs | 1 | 4 | 2 | 2 | 9 |
| UI/UX Navigation | 0 | 2 | 3 | 4 | 9 |
| UI/UX Layouts | 0 | 3 | 2 | 1 | 6 |
| UI/UX Cards/Modals | 0 | 4 | 2 | 0 | 6 |
| UI/UX Color/Theming | 0 | 4 | 2 | 0 | 6 |
| UI/UX Mobile/Responsive | 0 | 2 | 4 | 0 | 6 |
| UI/UX Accessibility | 6 | 1 | 2 | 0 | 9 |
| UI/UX Animations | 1 | 2 | 2 | 0 | 5 |
| UI/UX Empty/Loading/Error | 0 | 4 | 2 | 0 | 6 |
| **UI/UX Subtotal** | **8** | **29** | **21** | **10** | **70** |
| **GRAND TOTAL** | **19** | **82** | **77** | **36** | **216** |

**Top 3 systemic issues (fix these first — highest leverage):**
1. **6 of 7 React Context providers have unmemoized `value` objects** — causes cascading re-renders across the entire app on every state change.
2. **`logout()` doesn't clear user-scoped localStorage** — cross-user data leak (security).
3. **No global `prefers-reduced-motion` or `:focus-visible`** — accessibility blockers for keyboard + vestibular-disorder users.

---

## PART A — ENGINEERING AUDIT

### A1. State Management (15 findings)

#### P1 — High Priority

| # | File:Line | Bug | Fix |
|---|-----------|-----|-----|
| 1 | AuthContext:883-924 | `value={{...}}` unmemoized; all consumers re-render on every provider render | `useMemo` value; `useCallback` inline fns |
| 2 | AuthContext:142 | `localUserOverrides` (incl. `portalAccessToken`) NEVER cleared on logout — cross-user token bleed | `setLocalUserOverrides(null)` in logout |
| 3 | AuthContext:805-812 | Inner `setTimeout(500ms)` not tracked by effect cleanup — can silently re-authenticate logged-out user | Track inner timer in ref; clear in cleanup |
| 4 | DocumentContext:29-47 | `documentState`, `documentActions`, `value` all fresh literals every render | `useMemo` all three |
| 5 | UIContext:636-661 | `value={{...}}` unmemoized; 6 inline arrow fns recreated each render | `useMemo` value; `useCallback` fns |
| 6 | UIContext:282-295 | User-switch guard fires only when `prevId && nextId && prevId !== nextId` — on logout (`nextId` undefined), guard does nothing. Prior user's history/modals/viewState persist | Also reset when `prevId && !nextId` |
| 7 | CoreContext:147-194 | `coreState` & `coreActions` rebuilt every render — holds ALL app state | `useMemo` both |
| 8 | MatterContext:34-58 | Same pattern — `matterState`, `matterActions`, `value` all fresh | `useMemo` |
| 9 | DataProvider:596 | `DataStateContext.Provider value={{...}}` fresh literal every render (DataActionsContext IS memoized at 348-410 — copy that pattern) | `useMemo` |
| 10 | DataProvider:52,146-165 | `recentlyDeletedRef` 60s expiry too short for slow networks; on mutation FAILURE entry not cleared (item stays hidden 60s then reappears); not persisted to sessionStorage | Clear on failure; persist to sessionStorage; extend to 5min |
| 11 | DataProvider:493-593 | `appState` NEVER reset on logout — prior user's matters/contacts/documents briefly visible to next user | `useEffect(() => { if (!currentUser) setAppState(EMPTY_APP_STATE) })` |

#### P2 — Medium

| # | File:Line | Bug | Fix |
|---|-----------|-----|-----|
| 12 | UIContext:542-547 | `navigateTo` reads `historyIndex` from closure inside `setHistory(prev => prev.slice(0, historyIndex+1))` — rapid double-nav corrupts history | Use ref for historyIndex |
| 13 | MatterContext:43-51 | `deleteMatter` calls cascade then `deleteItem` sequentially — no transaction. Half-deleted state possible | Single Convex mutation, or rollback |
| 14 | DataProvider:139-166 | `deleteItem` optimistic without rollback (intentional but masks server errors) | Roll back on network/auth failure |
| 15 | DataProvider:493-593 | Effect deps include `isDataLoaded`/`isFullyLoaded` set in body — fragile, any future edit = infinite loop | Move to refs; remove from deps |

---

### A2. API/Async Handling (19 findings)

#### P0 — Critical (data loss / leak / wrong UI)

| # | File:Line | Bug | Fix |
|---|-----------|-----|-----|
| 1 | AloaChat:402-431 | `loadMessages` no cancellation. User switches A→B→C fast, stale query overwrites correct messages | Add `cancelled` flag in cleanup; verify `activeConversationId` before `setMessages` |
| 2 | DocumentDetailView:38-68 | `fetch(activeUrl).then(blob => setBlobUrl(...))` no cancellation. Stale fetch overwrites new blob with wrong file | **FIXED** — added AbortController + cancelled flag |
| 3 | MessagesView:579, CommsView:541 | `useQuery(api.feedback.getMyFeedbackReplies, { userId: currentUser?.id \|\| '' })` — no skip; fires with empty string when logged out | **FIXED** — `currentUser?.id ? {...} : "skip"` |

#### P1 — High (user-facing failures)

| # | File:Line | Bug | Fix |
|---|-----------|-----|-----|
| 4 | LegalIntelligenceHub:426 | `useQuery(api.legalRepo.getLicensesForFirm, { firmId })` — backend arg required; throws if firmId undefined | **FIXED** — `firmId ? {...} : "skip"` |
| 5 | MatterList:273-279 | `bulkClose` no try/catch; one failure aborts loop, no toast, button looks idle | try/catch + `isBulkClosing` state + `Promise.allSettled` |
| 6 | DraftProEditor:1843-1902 | `handleAiHelpForPlaceholder` no abort; clicking A then B leaves both streams running | Track `requestIdRef`; only apply if id matches |
| 7 | BillingMonitorView:801 | `onUpdate({...}).then(() => setEditing(false))` no `.catch()` | Add `.catch(err => addToast(...))` |
| 8 | DataProvider:493-593 | Effect deps include state set inside effect | Remove `isDataLoaded`/`isFullyLoaded` from deps |

#### P2 — Medium (silent failures)

| # | File:Line | Bug |
|---|-----------|-----|
| 9 | AloaChat:1965, 2269 | `.then()` without `.catch()` on dynamic imports |
| 10 | LocalDocumentManager:126 | `updateFirmSettings(...).then(toast)` no `.catch()` |
| 11 | DocumentList:511-518 | `try { await deleteItem } catch {}` empty catch; toast says "deleted" even if failed |
| 12 | DocumentList:564-588 | Download fails silently — no feedback |
| 13 | MessagesView:1027-1031 | `markInboundRead(...).catch(() => {})` then toasts "marked" before completion |
| 14 | TenantPortal:146, ClientDashboard:192 | `try { import(...).then(...) } catch {}` — can't catch async rejection |
| 15 | ContactsView:98-108 | `handleSyncGoogleContacts` is a stub that toasts "synced" — false success |
| 16 | BillingMonitorView:208-211 | `useQuery(..., {})` empty args, no firmId, no skip |
| 17 | DraftProEditor:1164-1173 | Content-sync effect overwrites user's in-progress edits if parent re-renders with shorter content |
| 18 | DocumentDetailView:64-67 | Blob URL never revoked — memory leak per PDF navigation | **FIXED** — revoke previous blob in cleanup |
| 19 | DataProvider:581-591 | `localStorage.setItem(JSON.stringify(appState))` on every Convex push | Debounce 500ms |

---

### A3. Form Validation (14 findings)

#### Cross-cutting (all forms)

| # | Bug | Affected | Fix |
|---|-----|----------|-----|
| 1 | Submit button not disabled during async submit → double-submit risk | PropertyForm, TaskForm, EventForm, InvoiceForm, UserForm, TimeEntryForm, ExpenseForm, LinkMatterToContactForm, LeadForm, ShareDocumentModal, ComposeEmailModal, TrustTransactionForm | Add `isSubmitting` state + `disabled={isSubmitting}` |
| 2 | No `maxLength` on any text input → Convex row-size overflow risk | All 14 forms | Add `maxLength={N}` + char counter |
| 3 | Required-field asterisk inconsistent | Only LeadForm uses `*` | Standardize `*` on every `required` field |
| 4 | `type="tel"` no pattern validation | ContactForm, MatterForm, VisitorPortal | Add `pattern="^\+?[0-9\s\-()]{7,20}$"` |
| 5 | Number inputs silently accept NaN/0 when cleared | InvoiceForm, TimeEntryForm, PropertyForm | `isNaN` guard in handleSubmit |
| 6 | Errors don't clear when field corrected | DocumentForm | Clear `error` in `onChange` |
| 7 | No file-type validation on uploads | DocumentForm (size only), PropertyForm (no checks) | Whitelist MIME types; add size check to PropertyForm |

#### Form-specific (HIGH)

| Form | Bug | Fix |
|------|-----|-----|
| InvoiceForm:148-208 | No `dueDate > issueDate` validation | Add check before submit |
| PropertyForm:387-529 | No `leaseEnd > leaseStart` validation per unit | Loop unitsData, reject invalid ranges |
| ComposeEmailModal:51-73 | `to`/`cc`/`bcc` no email regex; comma-split accepts `",,,"`; `handleSend` doesn't await send | Validate tokens; await; disable button during send |

---

### A4. Navigation/Routing (30 findings)

#### P0 — Critical

| # | File:Line | Bug | Fix |
|---|-----------|-----|-----|
| 1 | tabNavigation.ts:224-225 | `openDraftProNewTab` falls back to `'in-place'` on popup-blocked — destroys ALOA chat session (the exact bug it was created to prevent) | Return `'blocked'` sentinel; callers show retry toast |
| 2 | App.tsx:766-775 | `window.history.replaceState({}, '', url)` clobbers React Router's `history.state` — in-app navigation context silently destroyed | `replaceState(history.state, '', url)` |

#### P1 — High

| # | File:Line | Bug | Fix |
|---|-----------|-----|-----|
| 3 | UIContext:542-547 | Stale-closure: `setHistory(prev => prev.slice(0, historyIndex+1))` uses closure `historyIndex` | Use ref or compute from `prev.length` |
| 4 | UIContext:553-567 | `goBack` else branch calls `window.history.back()` — exits app from deep-linked DraftPro | Add `document.referrer.startsWith(origin)` guard |
| 5 | UIContext:618-627 | `openEditor` builds `/editor/<docId>` but WordProcessor only reads `?draftKey=` — docId discarded | Route `/editor/:docId` to `loadDocument(docId)` |
| 6 | DocumentList:455-456 | Raw `navigate('/documents/'+id)` bypasses `navigateTo()` — in-app history unsynced | Use `navigateTo('documentDetail', id)` |
| 7 | No Capacitor `backButton` listener | Android hardware back exits app from deep-linked route | Install `App.addListener('backButton', …)` in main.tsx |
| 8 | DocumentList:731 | `window.open(url, 'draftpro-new')` — fixed name reuses tab, loses unsaved drafts | Per-session draftKey + `noopener,noreferrer` |
| 9 | DraftProEditor:1310-1318 | Citation→Research fallback calls `navigateTo` without `attemptNavigation` — unsaved draft abandoned | Wrap in `attemptNavigation` |
| 10 | draftTabs.ts:99-103 | Mobile: `window.location.href = opts.url` — hard nav nukes ALOA chat state | Route through `navigateTo('editor', null, ctx)` |
| 11 | Multiple files | `window.open('','_blank')` + `document.write(html)` with user data — XSS vector | Use `URL.createObjectURL(new Blob([html]))` + HTML-escape |

---

### A5. Data Persistence/Syncing (18 findings)

#### P0 — Security

| # | File:Line | Bug | Fix |
|---|-----------|-----|-----|
| 1 | AuthContext:582-674 | `logout()` does NOT clear `practicepro_offline_queue` — user A's queued mutations replay under user B's session | **FIXED** — added comprehensive localStorage sweep |

#### P1 — High

| # | File:Line | Bug | Fix |
|---|-----------|-----|-----|
| 2 | DataProvider:544-573 | Race: Convex push overwrites in-flight optimistic UPDATEs | Track pending update IDs like `recentlyDeletedRef` |
| 3 | WordProcessor:171 + DraftProEditor:789-810 | `onContentChange` fires on every keystroke → synchronous `localStorage.setItem` | Debounce 500ms; flush on `beforeunload` |
| 4 | AuthContext:582-674 | Logout doesn't clear `draft_newEvent`, `draftpro:*`, `aloax_doc_*`, `practicepro_cached_appstate`, `local_cached_files` | **FIXED** — sweep all user-scoped keys |

#### P2 — Medium

| # | File:Line | Bug |
|---|-----------|-----|
| 5 | DataProvider:139-165 | Optimistic delete without rollback (masks server errors) |
| 6 | DataProvider:580-591 | Synchronous `JSON.stringify(appState)` + `localStorage.setItem` on every firmData change |
| 7 | useProperties:22-38 | `handleDeleteProperty` uses `removeItemFromState` (bypasses `markRecentlyDeleted`) |
| 8 | LocalDocumentManager:70 | `new Set(JSON.parse(saved))` — NO try/catch; corrupt data crashes component |
| 9 | AloaXView:56-93 | `saveDocToLibrary` caps at 3MB; if still over quota, doc silently DROPPED |
| 10 | CheckpointManager:50-69 | `saveChunk` evicts oldest 5 on quota error but doesn't retry — chunk lost |
| 11 | DraftProEditor:651-654 | `installBeforeUnloadGuard` only WARNS — doesn't flush pending draft |
| 12 | All `practicepro_*` keys | No schema version prefix — schema changes break cached parses |

---

### A6. Error Handling & Resilience (18 findings)

#### P1 — High

| # | File:Line | Bug | Fix |
|---|-----------|-----|-----|
| 1 | App.tsx:368 | Missing ErrorBoundary around `WordProcessor` | **FIXED** — wrapped in `<ViewWrapper>` |
| 2 | AloaPanel.tsx:64 | `ErrorBoundary` imported but never wrapped `<AloaChat>` | **FIXED** — wrapped |
| 3 | AloaChat:424 | `console.error("Failed to load conversation history")` — no toast | `addToast(..., {type:'error'})` + retry |
| 4 | MatterDetailView:299 | `console.error('Delete failed')` — no toast on delete failure | `addToast(..., {type:'error'})` |
| 5 | DraftProEditor:1237 | `console.error('save before leave failed')` — silent on navigation | `addToast('Unsaved changes may be lost', {type:'warning'})` |
| 6 | reportGenerator.ts:362,372 + ReceiptDetailView:156 | `invoice.matter.title` — no null check | **FIXED** — `invoice?.matter?.title \|\| 'General Receipt'` |
| 7 | aiRequestQueue.ts:34,159 | 15s default timeout for ALL ALOA tasks including streaming/research (can take 60-90s) | Pass `120000` for chat/research |
| 8 | brainService.ts:55-72 | No timeout on embedding calls; `seedFirm` runs sequentially over thousands of chunks | `Promise.race([fetch, timeout(30s)])` + Cancel button |
| 9 | aiUtils.ts:33,150 | `streamGemini`/`streamGeminiMultipart` no AbortController/timeout | Pass `signal`; 90s timeout |

#### P2 — Medium

| # | File:Line | Bug |
|---|-----------|-----|
| 10 | ConnectionStatus:80 | `console.error("Scan failed")` — no toast |
| 11 | ResearchStudio:189 | `console.error('Analysis failed')` — no toast |
| 12 | ResearchSourceColumn:145 | `console.error('[Research] Web search failed')` — no toast |
| 13 | GatekeeperInterface:179 | `console.error('Checkout failed')` — no toast |
| 14 | DocumentList:574 | Convex download fails → silently falls through |
| 15 | 7 FileReader calls | Missing `onerror` handler — perpetual loading on read failure |
| 16 | Systemic | `coreState.firmDetails.X` accessed without `?.` in 30+ forms — crashes on loading/orphaned accounts |
| 17 | MessagesView:1028 + TenantPortal:1725 | `markXxxRead({}).catch(() => {})` — read-receipt failures silently swallowed |
| 18 | ConvexErrorBoundary:236-260 | Error details + stack trace shown to end users — NDPA/GDPR risk |

---

### A7. Performance (32 findings)

#### P0 — Critical

| # | File:Line | Issue | Fix |
|---|-----------|-------|-----|
| 1 | CoreContext:147-194 | `coreState` & `coreActions` rebuilt every render — ALL consumers re-render on ANY state change | `useMemo` + split contexts |
| 2 | UIContext:636-661 | Provider `value` not memoized | `useMemo` |
| 3 | 7 contexts | All have unmemoized-value pattern | `useMemo` every context value |
| 4 | MessagesView:876-877 | `messages.filter()` TWICE inside `.sort()` comparator → O(N log N × M) per render | Pre-build `Map<convId, lastMsgTime>` |
| 5 | MessagesView:690,916 | `messages.filter(...)` repeated per-conversation in render loop | Memoize `messagesByConv` |

#### P1 — High

| # | File:Line | Issue | Fix |
|---|-----------|-------|-----|
| 6 | MatterList:448 | All matters rendered via `.map()` — no virtualization | `react-window` `List` |
| 7 | ContactsView:163 | No virtualization | Virtualize |
| 8 | TaskList:347 | No virtualization | Virtualize or paginate |
| 9 | MessagesView:296 | Entire message thread no virtualization | Virtualize |
| 10 | NoteColumn:132 + NotesView:250,272 | **Two NoteEditor (TipTap) instances mounted simultaneously** — hidden via CSS, still consuming memory | Conditionally mount |
| 11 | AloaChat:2456-2465 | ConversationList kept MOUNTED (hidden via CSS) — Convex subscription active when closed | Unmount when `!showHistory` |
| 12 | CommandPalette:57-123 | `searchIndex` & `fuse` rebuilt on every change even when palette closed | Defer until `isCommandPaletteOpen` |
| 13 | Sidebar:136,187,191 | 5+ `.filter()` calls on notifications/messages/tasks every render | `useMemo` each |
| 14 | ActivityLogTab:20-25 | O(n×m) filter: `documents.find` & `tasks.find` inside `.filter()` | Build `Map<id, matterId>` |
| 15 | DocumentsTab:121-122 | `documents.sort(...)` MUTATES prop array in-place + runs every render | `useMemo(() => [...documents].sort(...))` |
| 16 | TaskList:54 | `assignedUsers = (...).map(id => users.find(...))` per row per render | Lift lookup to parent as `Map` |
| 17 | TaskList:60-68 | Every TaskRow registers its own `document.mousedown` listener | Single listener at parent |
| 18 | CommsView:558-559 | Same `messages.filter` inside `.sort()` as MessagesView | Memoize `Map` |
| 19 | App.tsx:19-99 | All 30+ route views imported synchronously — none lazy-loaded | `React.lazy` + `<Suspense>` |
| 20 | reportGenerator.ts:2-3 | `jsPDF` + `jspdf-autotable` imported at module top | `const jsPDF = await import('jspdf')` |
| 21 | PdfViewer.tsx:21 | `pdfjs-dist` imported synchronously | Dynamic import in `useEffect` |
| 22 | attachmentProcessor.ts:28 | `pdfjs-dist` at top-level | Dynamic import |
| 23 | AloaXView.tsx:2-3 | `pdfjs-dist` + `fuse.js` synchronous | `React.lazy` entire route |
| 24 | ~20 `<img>` tags | Zero use `loading="lazy"` — no width/height, layout shift | Add `loading="lazy"` + dimensions |
| 25 | useContentProtection:72 | `setInterval(handler, 500)` polls localStorage forever | Remove; rely on `storage` event |
| 26 | Sidebar:135,190 | Duplicate `useQuery` subscriptions also in Header, AtriumInbox, MessagesView | Shared `useFirmInbox()` hook |

---

## PART B — UI/UX AUDIT

### B1. Typography & Hierarchy (8 findings)

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | `text-[10px]` is 3rd-most-used size (979 uses) — no design token | P1 | Add `text-2xs` (10px) + `text-3xs` (9px) tokens; codemod |
| 2 | Page-title tier drifts across h1/h2 — 7 different sizes for same semantic role | P1 | 3-tier contract: h1=text-3xl, h2=text-2xl, h3=text-lg |
| 3 | `text-slate-400` on white = 2.85:1 contrast (fails WCAG AA 4.5:1); 543 occurrences lack dark: variant | P1 | Sweep → `text-slate-500 dark:text-zinc-400` |
| 4 | `Unbounded` & `Space Grotesk` imported in CSS but never used — dead 80KB network request | P2 | Remove `@import` or wire into config |
| 5 | 20+ unique label className combos — no `<FieldLabel>` primitive | P2 | Extract `<FieldLabel>` component |
| 6 | `font-serif` (9 uses) never themed — browser default Times/Georgia | P3 | Define `fontFamily.serif` token |
| 7 | Inline `font-family: 'Times New Roman'` in JS template strings co-mingles with Inter | P3 | Move to `.prose-legal` CSS class |
| 8 | `text-zinc-500/600` in light mode without dark: variants | P3 | Swap to `text-slate-*` in light mode |

### B2. Forms & Inputs (9 findings)

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | 17 inputs/selects/textareas have NO focus styling — keyboard users can't see active field | P0 | Sweep; add `focus-visible:ring-*` |
| 2 | Three competing shared input styles in `formStyles.ts` (different radius/padding/bg) | P1 | Collapse to one with size variants |
| 3 | Focus-ring inconsistency: `focus:ring-1`, `focus:ring-2`, `focus:ring-4`, `focus:ring-emerald`, `focus:ring-amber` | P1 | Standardize `focus-visible:ring-2 ring-primary-500` |
| 4 | `formStyles` shared variants have NO `disabled:` styling | P1 | Add `disabled:opacity-60 disabled:cursor-not-allowed` |
| 5 | Border-radius on inputs spans 4 values (md/lg/xl/2xl) with no contract | P2 | Pick one (`rounded-lg`) |
| 6 | Label typography varies wildly — 20+ distinct className strings | P2 | `<FieldLabel>` primitive |
| 7 | Required-field asterisk color inconsistent (red-500 vs rose-500) | P3 | Pick `text-rose-500` |
| 8 | Inline labels coexist with above-field labels without rule | P3 | Document convention |

### B3. Navigation (9 findings)

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | Sidebar vs BottomNav active-state mismatch — two different visual languages | P1 | Pick one; same accent color |
| 2 | Tab-bar indicator split: underline (13 files) vs pill (6 files) with no rule | P1 | Rule: top-level tabs=underline, in-card=pill |
| 3 | Sidebar exceeds Miller's Law (7±2) — up to 13 top-level items | P2 | Group/collapse |
| 4 | Breadcrumbs on only 4 of 7 detail views | P2 | Adopt `<Breadcrumbs>` everywhere |
| 5 | Header search affordance split across 3 breakpoints | P2 | Consolidate to 2 |
| 6 | `RevenueEngineNavItem` is dead code | P3 | Delete |
| 7 | More-sheet icons `w-6 h-6` vs primary nav `w-5 h-5` | P3 | Standardize |
| 8 | Icon-accent color drift (`green-600` vs `emerald-500`) | P3 | Remove dead code |
| 9 | Sidebar section/badge use arbitrary `text-[9px]` | P3 | Resolves with B1#1 token |

### B4. Layouts & Spacing (6 findings)

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | Page padding inconsistent (4 scales: p-3 sm:p-6 lg:p-8 / px-4 sm:px-6 lg:px-8 / p-6 / p-4) | P1 | One token `PAGE_PAD` |
| 2 | Content max-width missing on ultra-wide (2560px+) | P1 | `max-w-screen-2xl mx-auto` |
| 3 | Sticky header z-index conflicts (z-30 vs z-3000 vs z-9999) | P1 | `zIndex` token scale in config |
| 4 | Card padding inconsistent (p-3, p-4, p-5, p-6) | P2 | Tokenize `CARD_PAD_SM/MD/LG` |
| 5 | Gap scale mixed (space-y-2/3/4/5/6/8, gap-2/3/4/6, mb-2/3) | P2 | Standardize `gap-4` cards, `gap-2` tight |
| 6 | Orphan edge-touching elements | P3 | Document safe-area pattern |

### B5. Cards, Modals & Surfaces (6 findings)

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | Shadow scale chaos (shadow-sm/md/lg/xl/2xl mixed randomly) | P1 | 3-level: `shadow-card/popover/modal` |
| 2 | Border-radius on cards inconsistent (lg/xl/2xl/3xl) | P1 | Tokenize `radius-card/modal/sheet` |
| 3 | Modal sizing overlap — many modals bypass `Modal`/`DockedModal`/`ConfirmDialog` | P1 | Force through shared components |
| 4 | Two parallel confirm dialogs (`ConfirmDialog` + `DeleteConfirmationModal`) | P1 | Consolidate |
| 5 | Modal footer alignment inconsistent | P2 | Standard footer pattern |
| 6 | Empty states bypass `<EmptyState>` component | P2 | Mandate `<EmptyState>` |

### B6. Color & Theming (6 findings)

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | 219 raw hex occurrences across 36 files | P1 | Replace with tokens |
| 2 | `primary` green hardcoded as hex literals — theme remapping can't touch it | P1 | Move to CSS variables |
| 3 | Three neutral scales (`slate`, `zinc`, `gray`) all in use redundantly | P1 | Pick one; sweep `gray-*` → `slate-*` |
| 4 | Status badge colors inconsistent (green vs emerald vs primary; red vs rose) | P1 | Define `badge-success/warning/danger/info` classes |
| 5 | Dark-mode parity gaps (light color without dark equivalent) | P2 | Define `surface-1/2/3` tokens |
| 6 | Loading state colors inconsistent (primary, blue, white) | P2 | One spinner component with `currentColor` |

### B7. Mobile/Responsive (6 findings)

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | Tables don't become cards on mobile — all 6 report tables force horizontal scroll at 375px | P1 | `<table>` → card list below `sm:` |
| 2 | Touch targets < 44px everywhere (`.touch-target` class exists but only ~20 buttons use it) | P1 | Add `.touch-target` to every `<button>` |
| 3 | Text truncation to illegibility on mobile (`max-w-[100px]` shows ~10 chars) | P2 | Use `line-clamp-2` for descriptions |
| 4 | ConfirmDialog doesn't become bottom-sheet on mobile | P2 | Add `items-end sm:items-center` |
| 5 | `window.innerWidth` direct reads instead of `useIsMobile()` hook | P2 | Migrate to hook |
| 6 | Horizontal scroll risk at 375px without visual indicator | P2 | Fade-gradient or "More" popover |

### B8. Accessibility (9 findings — 6 P0)

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | Most interactive elements missing `aria-label` (only ~40 across 280 files) | P0 | Every icon-only button needs `aria-label` |
| 2 | No `role="tab"/"tablist"/"tabpanel"` anywhere | P0 | Apply ARIA tab pattern |
| 3 | No `aria-live` for form errors | P0 | `<p role="alert" aria-live="assertive">` |
| 4 | No `aria-invalid`/`aria-describedby` on inputs with error | P0 | Add to every error input |
| 5 | Focus-visible styles missing globally | **P0 FIXED** | Added global `:focus-visible` in index.css |
| 6 | Modal focus trap missing on ConfirmDialog, DockedModal, AloaPanel, CommandPalette | P0 | Extract `useFocusTrap` hook |
| 7 | Keyboard shortcut conflicts (F, R fire while typing in inputs) | P1 | Guard with `e.target instanceof HTMLInputElement` |
| 8 | Skip-link missing | P1 | Add "Skip to main content" |
| 9 | Images missing alt text (4 instances) | P2 | Add meaningful alt or `alt=""` |

### B9. Animations & Transitions (5 findings)

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | `prefers-reduced-motion` not respected ANYWHERE | **P0 FIXED** | Added global media query in index.css |
| 2 | Duration scale chaos (75/100/150/200/300/500/700/1000/3000ms) | P1 | Lock to 4: fast/base/slow/slower |
| 3 | Easing curve inconsistency (ease-out, ease-in-out, 3 different cubic-beziers) | P2 | Define `ease-standard/enter/exit` |
| 4 | Hover states jumping (scale without transition-transform) | P2 | Always pair `scale-*` with `transition-transform` |
| 5 | `animate-pulse` overuse (8+ elements) + no reduced-motion = a11y hazard | P0 | See #1; replace decorative pulse with static dot |

### B10. Empty/Loading/Error States (6 findings)

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | Empty states bypass `<EmptyState>` component | P1 | Mandate `<EmptyState>` |
| 2 | Loading states use spinner where skeleton should be | P1 | Use `<MattersSkeleton>` etc. |
| 3 | Error states missing retry button | P1 | Every error UI: icon + message + Retry + support link |
| 4 | Blank screens on conditional `return null` | P1 | Distinguish loading/empty/error |
| 5 | Loading flash < 200ms (flicker) | P2 | `useDelayedTruth(isLoading, 200)` hook |
| 6 | Error details leaked in production (stack traces shown to users) | P2 | Gate behind `import.meta.env.DEV` |

---

## FIXES APPLIED IN THIS AUDIT

| # | File | Fix | Severity |
|---|------|-----|----------|
| 1 | AuthContext.tsx | Comprehensive localStorage/sessionStorage sweep on logout (clears offline queue, ALOA docs, draft sessions, cached app state, user overrides) | P0 Security |
| 2 | AuthContext.tsx | Clear `localUserOverrides` on logout (was carrying `portalAccessToken` across users) | P1 Security |
| 3 | DocumentDetailView.tsx | Added AbortController + cancelled flag to FileViewer blob fetch (prevents stale overwrite) | P0 Race |
| 4 | DocumentDetailView.tsx | Revoke previous blob URL in cleanup (memory leak fix) | P3 Perf |
| 5 | App.tsx | Wrapped `<WordProcessor>` in `<ViewWrapper>` (includes ErrorBoundary) | P1 Resilience |
| 6 | AloaPanel.tsx | Wrapped `<AloaChat>` in `<ErrorBoundary>` | P1 Resilience |
| 7 | MessagesView.tsx | Added `"skip"` token to `getMyFeedbackReplies` query | P0 API |
| 8 | CommsView.tsx | Added `"skip"` token to `getMyFeedbackReplies` query | P0 API |
| 9 | LegalIntelligenceHub.tsx | Added `"skip"` token to `getLicensesForFirm` query | P1 API |
| 10 | reportGenerator.ts | Fixed `invoice.matter.title` null check crash (→ `invoice?.matter?.title \|\| 'General Receipt'`) | P1 Crash |
| 11 | ReceiptDetailView.tsx | Same null check fix | P1 Crash |
| 12 | index.css | Added global `:focus-visible` style for keyboard users | P0 a11y |
| 13 | index.css | Added global `prefers-reduced-motion` media query | P0 a11y |

---

## RECOMMENDED NEXT STEPS (Priority Order)

### Phase 1 — Critical Security & Data Integrity (1-2 days)
1. Fix `openDraftProNewTab` regression (tabNavigation.ts:224) — return `'blocked'` not `'in-place'`
2. Fix `App.tsx:774` `history.replaceState` clobbering `history.state`
3. Add Capacitor `backButton` listener in main.tsx
4. Fix XSS in `window.open + document.write` patterns (7 files)

### Phase 2 — Context Memoization (1 day)
5. `useMemo` all 7 Context provider values (biggest single perf win)
6. `useCallback` all inline arrow fns in contexts

### Phase 3 — Race Conditions & Async (1-2 days)
7. Add cancellation to `AloaChat.loadMessages`
8. Add `requestIdRef` to `DraftProEditor.handleAiHelpForPlaceholder`
9. Increase AI queue timeout for streaming/research (15s → 120s)
10. Add timeouts to `generateEmbedding` (30s), `streamGemini` (90s), file uploads (2min)

### Phase 4 — Form Validation Sweep (1 day)
11. Add `isSubmitting` state + `disabled={isSubmitting}` to all 12 forms
12. Add `dueDate > issueDate` and `leaseEnd > leaseStart` validation
13. Add `maxLength` to all text inputs
14. Add file-type whitelist to DocumentForm + size+type to PropertyForm

### Phase 5 — Performance (2-3 days)
15. Virtualize MatterList, TaskList, ContactsView, MessagesView
16. Fix `messages.filter` inside `.sort()` in MessagesView + CommsView
17. Lazy-load PdfViewer, reportGenerator, attachmentProcessor, AloaXView, WordProcessor, ReportingView
18. Unmount hidden NoteEditor (TipTap) in NotesView
19. Debounce DraftProEditor localStorage writes (500ms)

### Phase 6 — UI/UX Token System (2-3 days)
20. Add `text-2xs`/`text-3xs` tokens + codemod `text-[10px]` → `text-2xs`
21. Collapse `formStyles.ts` to one input variant with size props
22. Define `zIndex` token scale in tailwind.config.js
23. Replace 219 raw hex colors with tokens
24. Collapse `slate`/`zinc`/`gray` → one neutral scale
25. Extract `<FieldLabel>` + `<Input size>` primitives

### Phase 7 — Accessibility (1-2 days)
26. Extract `useFocusTrap` hook; apply to ConfirmDialog, DockedModal, AloaPanel, CommandPalette
27. Add `aria-label` to every icon-only button
28. Apply ARIA tab pattern (`role="tablist"` + `aria-selected` + `aria-controls`)
29. Add `aria-invalid` + `aria-describedby` to error inputs
30. Add skip-link at top of App.tsx

### Phase 8 — Empty/Loading/Error States (1 day)
31. Mandate `<EmptyState>` for all empty branches
32. Replace ad-hoc pulse blocks with `<Skeleton>` components
33. Add Retry button to every error UI
34. Add `useDelayedTruth(isLoading, 200)` hook to prevent loading flicker

---

**Report generated:** 2026-07-19
**Total findings:** 216 (19 P0, 82 P1, 77 P2, 36 P3)
**Fixes applied:** 13 (5 P0, 6 P1, 2 P3)
**Remaining:** 203 findings — prioritized in "Recommended Next Steps" above
