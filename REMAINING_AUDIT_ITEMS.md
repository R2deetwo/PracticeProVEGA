# PracticePro — Remaining Items from 6-Pillar Audit

## Context for Another LLM

PracticePro is a legal practice management platform built with Vite/React + Convex backend. It has three products:
- **Vega** (legal-only) — assistant name: ALOA
- **Atrium** (property-only) — assistant name: ARIA
- **Komplete** (both legal + property) — assistant name: ALOA (default), has both feature sets

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Convex (backend/database), Framer Motion, TipTap (rich text editor for DraftPro), Vercel (deployment)

**Brand Colors:** Primary = Dark Moss Green `#4A694C` (RGB 74, 105, 76)

---

## PILLAR 1: UI Consistency & Visual Polish

### Issue 1.1: Border-Radius Scale Not Enforced (Medium)
**Status (Phase 5, Aug 2026): DONE.** The bulk normalization (rounded-xl 880 → 53)
was completed in a prior session. Phase 5 finished the job: all remaining
53 `rounded-xl` uses normalized per context (buttons/chips/inputs → rounded-md,
cards/panels/alerts/dropdowns → rounded-lg, modal containers → rounded-2xl)
and the shared `inputModern` form style updated. Enforcement added via
`eslint.config.mjs` — a `no-restricted-syntax` rule (error) flags any string
or template literal containing `rounded-xl`, with the migration targets in
the message. Current count of `rounded-xl` in src/: 0.

**Scale reference (STYLE_GUIDE.md §2):**
- `rounded-md` for inputs, buttons, small chips
- `rounded-lg` for cards, list items, dropdowns
- `rounded-2xl` for modals, hero blocks, large containers

### Issue 1.2: ALOA Suggestion Colors (Already Fixed, Verify)
**Status:** Fixed in `src/utils/markdownUtils.ts` — uses `#FCE8E6` (red), `#E6F4EA` (mint), `#E8F0FE` (blue) with darker text colors. CalendarView borders also fixed. Verified post-deploy.

---

## PILLAR 2: Navigation Integrity

### Issue 2.1: portalTermsOfUse Route Not Kebab-Cased (Low)
**Status (Phase 5): Verified DONE (fixed in a prior session).**
`src/contexts/UIContext.tsx` navigateTo maps `portalTermsOfUse` → `/portal-terms-of-use`.

### Issue 2.2: ALOA "aloaHelp" Modal Title Hardcoded (Low)
**Status (Phase 5): Verified DONE (fixed in a prior session).**
`src/contexts/UIContext.tsx` returns 'AI Assistant Help' (neutral).

---

## PILLAR 3: Core UX & Diary Workflows

### Issue 3.1: Diary Mode — Task Pinning from ALOA (Medium)
**Status (Phase 5): Verified DONE (fixed in a prior session).** The
`create_task` tool description in `src/services/geminiService.ts` now says
"Always set dueDate when creating a task so it automatically appears in the
user's chronological Diary Mode view on that date", and the `dueDate`
parameter carries the same instruction.

### Issue 3.2: Stale Matter — Also Check for Documents/Notes (Medium)
**Status: DONE in Phase 4.** `convex/proactive.ts` detectAnomalies now
cross-checks the newest document and notePage per stale candidate — matters
with recent doc/note activity are no longer falsely flagged.

---

## PILLAR 4: AI Engine UX

### Issue 4.1: Manual-to-Auto Focus Reset (Low — Partially Fixed)
**Status (Phase 5): DEFERRED by design.** Audit marks this "If Needed" —
no user request for a two-mode system; ALOA remains single-mode with
auto-focus after Stop/response completion. Revisit only if users ask.

### Issue 4.2: cancelAll Defensive Reset (Low)
**Status (Phase 5): Verified DONE (fixed in a prior session).**
`src/utils/aiRequestQueue.ts` cancelAll now resets `this.processing = false`
with an explanatory comment about the race window.

---

## PILLAR 5: Copywriting & Documentation

### Issue 5.1: "ARIA" Used on Vega (Legal) Surfaces (High)
**Status (Phase 5): DONE.** All Vega-surface violations fixed:
- `src/agents/ResearchAgent.ts` — persona now "ALOA (Advanced Legal Office
  Assistant)"; both `ARIA:` response-prime suffixes → `ALOA:`
- `src/agents/IngestionAgent.ts` — "You are ALOA, an elite Legal Ingestion
  Engine" + error log label
- `src/agents/DraftingAgent.ts` — "the ALOA professional standard"
- `src/agents/AgencyHub.ts` — "X BRAIN" name now branches on isAtriumMode;
  legal library block relabeled ALOA-X
- `src/components/ResourcesPage.tsx` — the `aloa-best-practices` article and
  all VEGA-guide/NDPA mentions now read ALOA (was "ARIA®, your dedicated
  Legal AI Copilot")
- `src/components/WhatsNew.tsx` — v1.10/v1.9/v1.6 legal release notes
  de-ARIA'd (v1.10's title no longer contradicts its own ALOA description)
- `src/components/forms/MatterIntakeWizard.tsx` — "ARIA Insight" → "ALOA Insight"
- `src/components/MessagesView.tsx` — system-inbox conversation name now
  `getAssistantName(isProperty) + ' Assistant'` (was hardcoded ARIA)
- `src/components/Sidebar.tsx` — indexer nav item relabeled ALOA-X (matches
  the AloaXView internals: aloax_ storage prefix, aloa-x-search id)
- `src/config/matterProcessConfig.ts` — draftingExpectations now says ALOA

Verified clean: remaining "ARIA" strings in src/ are legitimate (Atrium
landing/tour/onboarding sections, ATRIUM-mode prompts, dual "ALOA/ARIA"
mentions, code comments, and the neutral AIUsageDashboard agent-key map).
Note: AiIntakeAnalysis.tsx, DemoUpsellModal.tsx, and AIUsageDashboard label
were already fixed in a prior session.

### Issue 5.2: Style Guide Document (Needed)
**Status: DONE.** `STYLE_GUIDE.md` exists in the repo root (115 lines) —
covers brand colors, the 3-tier radius scale, shadow scale, Golden-Ratio-
aligned spacing, page-transition principles, typography, and component
patterns (buttons/inputs/cards/modals). Audit 1.1's eslint rule now
cross-references it.

---

## PILLAR 6: Performance & Database

> **Phase 4 status (Aug 2026):** 6.1 indexes — DONE (index definitions pre-existed; Phase 4 converted the consuming queries to index seeks and added matters.by_retainer, contacts.by_phone, notifications.by_type, users.by_email, tasks.search_title). 6.2 searchIndex — DONE (schema pre-existed; Phase 4 added `convex/search.ts` + rewrote FullScreenSearch to server-side search). 6.3 N+1 batching — DONE (prior session, verified). 6.4 convex deploy — DONE (deployed via APK workflow on push). Stale-matter activity check (3.2) also done in Phase 4.

### Issue 6.1: Missing Convex Indexes (High — Requires `npx convex deploy`)
**File:** `convex/schema.ts`

Missing indexes that cause table scans (`.filter()` after `.withIndex()`):

| Table | Missing Index | Used By | Impact |
|---|---|---|---|
| `matters` | `by_status` (status) | `proactive.ts:346`, `myFunctions.ts:3349` | Filters all firms' matters by status after firm index |
| `matters` | `by_client` (firmId, clientId) | `myFunctions.ts:3346-3350` | Cascading delete checks |
| `tasks` | `by_status` (firmId, status) | Dashboard counts, report filters | Scans all tasks per firm |
| `tasks` | `by_dueDate` (firmId, dueDate) | Deadline scanner | Scans all tasks per firm |
| `proactive_insights` | `by_firm_entity` (firmId, entityType, entityId) | `proactive.ts:375-379` | Dedup check scans all insights per firm |
| `documents` | `by_status` (firmId, status) | Archived/published filtering | — |
| `documents` | `by_category` (firmId, categoryId) | Category filtering | — |

**Fix:** Add these indexes to the schema, then run `npx convex dev` to push. Then convert `.filter()` chains to `.withIndex()` predicates in the consuming queries.

**How to Add an Index (example):**
```typescript
// In convex/schema.ts, find the matters table definition:
matters: defineTable({
  // ... existing fields
})
  .index("by_firm", ["firmId"])
  .index("by_status", ["firmId", "status"])           // NEW
  .index("by_client", ["firmId", "clientId"])          // NEW
  .index("by_custom_id", ["id"])
```

### Issue 6.2: No searchIndex — Full-Text Search Done Client-Side (High)
**File:** `convex/schema.ts` (entire file), `src/components/FullScreenSearch.tsx:27-41`

**Current:** No `searchIndex` defined anywhere. Full-text search uses Fuse.js which loads ALL matters/contacts/documents/tasks into memory. For firms with >5k records, this will cause lag.

**Fix:** Add Convex `searchIndex` to key tables:
```typescript
matters: defineTable({
  // ... fields
})
  .searchIndex("search_title", { searchField: "title" })
  .searchIndex("search_suit", { searchField: "suitNumber" })

contacts: defineTable({
  // ... fields
})
  .searchIndex("search_name", { searchField: "name" })

documents: defineTable({
  // ... fields
})
  .searchIndex("search_title", { searchField: "title" })
```

Then update `FullScreenSearch.tsx` to use Convex `search()` queries instead of client-side Fuse.js.

### Issue 6.3: N+1 Query Pattern in Anomaly Detection Cron (Medium)
**File:** `convex/proactive.ts:335-380`

**Current:** For each firm, iterates all active matters and runs 2 DB queries per matter (dedup check + entity check). For a firm with 500 matters, that's 1000 sequential queries per cron tick.

**Fix:** Batch the queries:
1. Fetch all non-dismissed insights for the firm in ONE query
2. Build a `Set` of `dedupKey` strings in memory
3. Build a `Map` of `entityType:entityId` → existing insight
4. Check membership against these in-memory structures instead of querying per matter

```typescript
// Before the loop:
const allFirmInsights = await ctx.db
  .query("proactive_insights")
  .withIndex("by_firm", (q) => q.eq("firmId", firmId))
  .filter((q) => q.eq(q.field("dismissed"), false))
  .collect();
const existingDedupKeys = new Set(allFirmInsights.map(i => i.dedupKey));
const existingEntities = new Set(allFirmInsights.map(i => `${i.entityType}:${i.entityId}`));

// Inside the loop, replace DB queries with:
if (!existingDedupKeys.has(dedupKey) && !existingEntities.has(`matter:${matter._id}`)) {
  // create insight
}
```

### Issue 6.4: Convex Backend Not Deployed (Critical for Several Features)
**Current State:** `npx convex deploy` has NOT been run. Several backend changes are in the code but not live:
- `welcomeEmailSent` field on users schema
- `sendWelcomeEmail` internalAction
- `fixProductMode` mutation
- `searchWeb` action (for ALOA web search)
- Proactive insight dedupKey fixes (no more daily duplicates)
- 30-day stale matter threshold

**Action Required:** Run `npx convex dev` or `npx convex deploy` from a machine with Convex credentials configured. This will:
1. Push the new schema (with `welcomeEmailSent` field)
2. Push all new mutations/actions
3. Regenerate `convex/_generated/api.d.ts` and `api.js` (so frontend type errors for `api.webFetch.*` resolve)

---

## Summary — Priority Action List

> **Phase 5 status (Aug 2026): ALL items closed or verified.** Pillars 1-5
> complete: 5.1 ARIA→ALOA sweep done (agents + 7 components + config),
> STYLE_GUIDE.md in place, radius scale fully enforced (0 `rounded-xl`, new
> eslint guard), 2.1/2.2/3.1/4.2 verified fixed, 4.1 deferred by design.
> Pillar 6 was completed in Phase 4. The 6-pillar audit is now fully
> remediated.

| Priority | Issue | Effort | Requires Convex Deploy? |
|---|---|---|---|
| ~~Critical~~ | ~~Run `npx convex deploy`~~ — done (Phase 3) | 5 min | N/A |
| ~~High~~ | ~~Add Convex indexes~~ — done (Phase 3/4) | 30 min | Yes |
| ~~High~~ | ~~Add Convex searchIndex~~ — done (Phase 3/4) | 30 min | Yes |
| ~~High~~ | ~~Fix "ARIA" → "ALOA" on Vega surfaces~~ — done (Phase 5) | 1 hour | No |
| ~~High~~ | ~~Batch anomaly detection cron queries~~ — done (prior session) | 1 hour | Yes |
| ~~Medium~~ | ~~Create STYLE_GUIDE.md~~ — done | 1 hour | No |
| ~~Medium~~ | ~~Enforce border-radius scale~~ — done (Phase 5 + eslint rule) | 2-3 hours | No |
| ~~Medium~~ | ~~Stale matter: documents/notes activity~~ — done (Phase 4) | 1 hour | Yes |
| ~~Medium~~ | ~~Diary Mode: AI always sets dueDate~~ — done (prior session) | 15 min | No |
| ~~Low~~ | ~~portalTermsOfUse kebab-case route~~ — done (prior session) | 15 min | No |
| ~~Low~~ | ~~aloaHelp modal title fix~~ — done (prior session) | 5 min | No |
| ~~Low~~ | ~~cancelAll defensive processing reset~~ — done (prior session) | 5 min | No |
| Low | Full auto-mode/manual-mode system — DEFERRED (not requested) | 3+ hours | No |
