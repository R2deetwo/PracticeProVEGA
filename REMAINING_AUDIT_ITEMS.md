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
**Current State:** 4 different border-radii are mixed freely across 250+ component files:
- `rounded-md` (219 uses)
- `rounded-lg` (1049 uses)
- `rounded-xl` (880 uses)
- `rounded-2xl` (304 uses)

**What Needs to Happen:**
1. Create a `STYLE_GUIDE.md` document that defines a 3-tier radius scale:
   - `rounded-md` for inputs, buttons, small chips
   - `rounded-lg` for cards, list items, dropdowns
   - `rounded-2xl` for modals, hero blocks, large containers
2. Consider enforcing via `eslint-plugin-tailwindcss` with `no-restricted-syntax` rule
3. Audit each component file and standardize — this is a manual pass through `src/components/`

### Issue 1.2: ALOA Suggestion Colors (Already Fixed, Verify)
**Status:** Fixed in `src/utils/markdownUtils.ts` — uses `#FCE8E6` (red), `#E6F4EA` (mint), `#E8F0FE` (blue) with darker text colors. CalendarView borders also fixed. Verify after deploy.

---

## PILLAR 2: Navigation Integrity

### Issue 2.1: portalTermsOfUse Route Not Kebab-Cased (Low)
**File:** `src/contexts/UIContext.tsx:514-538`
**Current:** Other public docs use kebab-case URLs (`/privacy-policy`, `/terms-of-service`), but `portalTermsOfUse` falls through to `/portalTermsOfUse` (camelCase).
**Fix:** Add `else if (newView === 'portalTermsOfUse') path = '/portal-terms-of-use';` in the `navigateTo` function, and add the corresponding route mapping in `src/components/App.tsx` router.

### Issue 2.2: ALOA "aloaHelp" Modal Title Hardcoded (Low)
**File:** `src/contexts/UIContext.tsx:150`
**Current:** `case 'aloaHelp': return 'ARIA Help';` — hardcoded as ARIA. ModalManager.tsx overrides this to 'AI Assistant Help', so it never reaches the DOM. But any direct caller of `getModalTitle('aloaHelp')` would get the wrong name.
**Fix:** Change to `return 'AI Assistant Help';` (neutral) or call `getAssistantName()` (requires React context, not available in this pure function).

---

## PILLAR 3: Core UX & Diary Workflows

### Issue 3.1: Diary Mode — Task Pinning from ALOA (Medium)
**Current:** Diary Mode exists and works (`src/components/CalendarView.tsx` — DiaryModeView component). Tasks with due dates appear in the diary.
**Gap:** When ALOA creates a task via `create_task` tool, the task doesn't automatically appear in the diary because the `dueDate` parameter is optional and the AI doesn't always set it.
**Fix:** Update the `create_task` tool description in `src/services/geminiService.ts` to tell the AI: "Always set dueDate when creating a task — it will appear in the lawyer's Diary Mode on that date."

### Issue 3.2: Stale Matter — Also Check for Documents/Notes (Medium)
**File:** `convex/proactive.ts:347-355`
**Current:** Staleness is calculated from `matter.updatedAt` or `_creationTime` only. It doesn't check if documents or notes were added to the matter recently.
**Fix:** Also query `documents` and `notePages` tables for the matter's most recent activity. Use the latest timestamp across matter updates, document uploads, and note additions.

---

## PILLAR 4: AI Engine UX

### Issue 4.1: Manual-to-Auto Focus Reset (Low — Partially Fixed)
**Current:** Auto-focus is now called after Stop and after response completion. But there's no "Auto Mode" vs "Manual Mode" concept in the current architecture — ALOA is always in a single mode.
**If Needed:** If the user wants a true "Auto Mode" that resets after manual interactions, this would require:
1. A `mode` state in AloaChat (`'auto' | 'manual'`)
2. A useEffect that watches for user interactions and resets to 'auto' after a timeout
3. Visual indicator showing the current mode

### Issue 4.2: cancelAll Defensive Reset (Low)
**File:** `src/utils/aiRequestQueue.ts:101-113`
**Current:** `cancelAll()` only aborts if `this.queue.length > 0`. If the queue is empty (task already shifted), it's a no-op. The `processing` flag is reset by the `finally` block, but there's a tiny race window.
**Fix:** Add `this.processing = false;` inside `cancelAll()` as a defensive reset.

---

## PILLAR 5: Copywriting & Documentation

### Issue 5.1: "ARIA" Used on Vega (Legal) Surfaces (High)
The assistant name for Vega (legal) is **ALOA**, not ARIA. But several files hardcode "ARIA" on surfaces that appear for legal users:

| File | Line | Issue |
|---|---|---|
| `src/app/page.tsx` | 1177-1178 | FAQ says "How does ARIA, the AI assistant, work?" on Vega landing page |
| `src/components/WhatsNew.tsx` | 242, 251, 300, 302 | Release notes say "ARIA is now aware of…" |
| `src/components/settings/AgentSettings.tsx` | 326 | "ARIA's memory is built from your portfolio's documents…" |
| `src/components/details/AiIntakeAnalysis.tsx` | 51 | "Generated by ARIA®" on legal matter intake |
| `src/components/modals/DemoUpsellModal.tsx` | 48 | "ARIA® AI is just getting warmed up." |
| `src/components/settings/AIUsageDashboard.tsx` | 58 | Hardcoded `label: 'ARIA®'` |

**Fix:** Import `getAssistantName` from `src/utils/assistantIdentity.ts` and use `getAssistantName(isProperty)` instead of hardcoded "ARIA". For static marketing pages (`page.tsx`), use product-neutral copy or branch on the active product.

**Note:** `src/utils/assistantIdentity.ts` already has `getAssistantName(isProperty)` which returns 'ARIA' for Atrium and 'ALOA' for Vega/Komplete. The `isProperty` flag comes from `useProduct()` hook.

### Issue 5.2: Style Guide Document (Needed)
**Current:** No `STYLE_GUIDE.md` exists. The brand color spec, radius scale, shadow scale, and spacing grid are not documented anywhere.
**What to Create:** A `STYLE_GUIDE.md` in the project root with:
1. **Brand Colors:** Primary Moss Green `#4A694C`, semantic colors (red/mint/blue)
2. **Radius Scale:** `rounded-md` (inputs), `rounded-lg` (cards), `rounded-2xl` (modals)
3. **Shadow Scale:** `shadow-sm` (default), `shadow-md` (hover), `shadow-xl` (modals)
4. **Spacing:** Golden Ratio increments (8px, 13px, 21px, 34px, 55px)
5. **Typography:** Font families, sizes, weights
6. **Component Patterns:** Button styles, input styles, card styles

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

| Priority | Issue | Effort | Requires Convex Deploy? |
|---|---|---|---|
| **Critical** | Run `npx convex deploy` | 5 min | N/A |
| **High** | Add Convex indexes (matters.by_status, tasks.by_status, etc.) | 30 min | Yes |
| **High** | Add Convex searchIndex (matters.title, contacts.name, documents.title) | 30 min | Yes |
| **High** | Fix "ARIA" → "ALOA" on Vega surfaces (6 files) | 1 hour | No |
| **High** | Batch anomaly detection cron queries | 1 hour | Yes |
| **Medium** | Create STYLE_GUIDE.md | 1 hour | No |
| **Medium** | Enforce border-radius scale | 2-3 hours | No |
| **Medium** | Stale matter: also check documents/notes activity | 1 hour | Yes |
| **Medium** | Diary Mode: AI always sets task dueDate | 15 min | No |
| **Low** | portalTermsOfUse kebab-case route | 15 min | No |
| **Low** | aloaHelp modal title fix | 5 min | No |
| **Low** | cancelAll defensive processing reset | 5 min | No |
| **Low** | Full auto-mode/manual-mode system | 3+ hours | No |
