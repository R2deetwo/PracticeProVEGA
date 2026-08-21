# PracticePro Comprehensive Refactor Blueprint

## Executive Summary

A deep audit of the entire codebase (schema, security, data integrity, onboarding, UI/UX, themes) has identified **7 critical root causes** and **30+ secondary issues** that explain why the app "is getting worse and more complicated." This blueprint organizes fixes into phases by impact and risk.

The single most damaging issue: `schemaValidation: false` in `convex/schema.ts` — this disables ALL runtime validation despite 2,019 lines of careful validators, silently accepting bad data that surfaces as UI bugs weeks later.

---

## Phase 0: Stop the Bleeding (Critical Security + Data Integrity)

### 0.1 Enable Schema Validation
**File:** `convex/schema.ts:2019`
**Change:** `schemaValidation: false` → `schemaValidation: true`
**Impact:** Surfaces ~20-30 latent bugs at once. Each is a one-line fix (missing `createdAt`/`updatedAt` on inserts).

### 0.2 Close Cross-Firm Write Hole
**File:** `convex/myFunctions.ts:2542` (`createItem`)
**Bug:** When `userEmail` is not passed, `requireFirmUser` returns `firmId: ""`. Then `createItem` falls back to `data.firmId` from the client — allowing any caller to write into any firm.
**Fix:** Change `firmId || sanitizedData.firmId || ''` to throw if firmId is empty. Don't accept firmId from client data.

### 0.3 Fail-Closed RLS on Update/Delete
**File:** `convex/myFunctions.ts:3055, 3067, 3078, 3582`
**Bug:** `if (firmId && existing.firmId && existing.firmId !== firmId)` only fires when BOTH are non-empty. Anonymous callers bypass the check.
**Fix:** Change to `if (!firmId || !existing.firmId || existing.firmId !== firmId) throw new Error("Unauthorized")`.

### 0.4 Add Auth to Cascade Mutations
**File:** `convex/myFunctions.ts:4341, 4411, 4467`
**Bug:** `deleteMatterCascade`, `deletePropertyCascade`, `deleteContactCascade` accept `firmId` from the client and perform NO auth check.
**Fix:** Add `requireAdmin(ctx, args.userEmail)` at the top of each, verify `auth.firmId === args.firmId`.

### 0.5 Fix notePages Cross-Firm Data Leak
**File:** `convex/myFunctions.ts:318`
**Bug:** `getFirmData` returns ANY `notePages` row that has `matterId` set, regardless of which firm owns it.
**Fix:** Add `iFirmId === tFirmId` to the filter condition.

### 0.6 Remove Plaintext Password Acceptance
**File:** `convex/authUtils.ts:78`
**Bug:** `verifyPassword` accepts plaintext password matches.
**Fix:** Return `valid: false` for non-PBKDF2 hashes. Run migration to re-hash.

---

## Phase 1: Onboarding Fixes (Immediate UX Improvements)

### 1.1 Fix Highlight View Mismatches
**File:** `src/components/GettingStartedChecklist.tsx`
**Bug:** `setHighlightTarget({ view: 'matters', ... })` but user lands on `matterDetail`. The highlight never fires.
**Fix:** Use the correct view for each item:
- `hasCourtDateOnMatter` → `view: 'matterDetail'`
- `hasTenantOnProperty` → `view: 'propertyDetail'`

### 1.2 Pass Deep-Link Context
**Bug:** Checklist items navigate to pages but don't pass tab/sub-view context.
**Fix:**
- `hasCourtDateOnMatter` → pass `initialSubView: 'events'` to TasksAndEventsTab
- `hasTenantOnProperty` → pass `tab: 'units'` to PropertyDetailView
- `hasInvitedUser` → pass `settingsTargetId: 'user-management'`
- `hasInvitedResidentToPortal` → pass `settingsTargetId: 'portal-access'`

### 1.3 Fix Misleading Hints
**Bug:** `hasServiceCharge` hint says "Service Charge tab" — no such tab exists.
**Fix:** Update to "Open a property → Units tab → edit a unit → set service charge."

### 1.4 Defer OnboardingTour Auto-Start
**File:** `src/components/App.tsx:1074`
**Bug:** Tour fires at T+800ms, same time as auto-open create modal. Tour's z-[9999] covers the modal.
**Fix:** Defer tour to T+5000ms, or suppress on first Dashboard mount.

### 1.5 Fix `hasBillingRate` Dead Item
**File:** `convex/myFunctions.ts:6551`
**Bug:** `hasBillingRate` checks `allMatters.length > 0` — same as `hasMatter`. Auto-completes with no separate action.
**Fix:** Either remove the item or check for explicitly-set billing rate configuration.

### 1.6 Add "All Done" Celebration
**File:** `src/components/GettingStartedChecklist.tsx:92-103`
**Bug:** When last item completes, checklist silently disappears.
**Fix:** Show celebration toast + confetti before auto-dismiss.

---

## Phase 2: Schema Tightening (1-2 Weeks)

### 2.1 Add Missing Indexes
- `notifications`: `by_user` on `["userId"]`
- `timeEntries`, `expenses`, `chatConversations`, `externalCounselInvites`: `by_matter` on `["matterId"]`
- `invoices`: add top-level `matterId`/`clientId` fields + `by_matter`/`by_client` indexes
- `securityEvents`: `by_firm` on `["firmId"]`

### 2.2 Standardize Timestamp Types
Pick one (`v.number()` epoch ms recommended). Migrate old ISO string fields.

### 2.3 Make Required Fields Required
- `matters`: `clientId`, `title`, `firmId`, `status`
- `tasks`: `firmId`, `title`, `assignedUsers`
- `contacts`: `firmId`, `name`
- `documents`: `firmId`, `title`
- `invoices`: `firmId`, `matterId`, `clientId`, `invoiceNumber`

### 2.4 Replace `v.any()` with Typed Validators
- `documents.file` → `v.string()` (storageId)
- `invoices.client` → top-level `clientId: v.string()`
- `invoices.matter` → top-level `matterId: v.string()`
- `firms.bankAccounts` → `v.array(v.object({ bankName, accountNumber, accountName }))`

### 2.5 Consolidate Contact→Matter Links
Pick one: keep `matterIds: v.array(v.string())`, drop `matterId` (singular). Backfill existing data.

### 2.6 Consolidate Property Person Fields
Keep `contactId` + `ownerId`. Drop `landlordId`, `tenantId`, `currentTenantId` — tenant relationships belong in `tenancies`.

---

## Phase 3: Table Consolidification (2-4 Weeks)

### 3.1 Merge `notifications` + `app_notifications`
Add `persistent: boolean` field. Migrate existing rows.

### 3.2 Drop Dead Tables
- `clientMessages` — no writes since `portal_messages` was added
- `documentTemplateCategories` — merge with `documentCategories` + `scope` field

### 3.3 Extract Embedded Sub-Collections
- `properties.units` → `units` table with `propertyId` foreign key
- `invoices.lineItems` → `invoice_line_items` table with `invoiceId` foreign key

---

## Phase 4: Auth Hardening (1-2 Weeks)

### 4.1 Remove Anonymous Fallback
**File:** `convex/authHelpers.ts:57-72`
Make `userEmail` required on all mutations. Audit all 118 exports.

### 4.2 Replace Dual-ID System
Drop `id` field from 14 tables. Migrate to Convex `_id` strings. Remove `resolveRecordForUpdate` 3-strategy cascade.

### 4.3 Add Per-Mutation Input Validators
Replace `data: v.any()` on `createItem`/`updateItem` with table-specific validators.

---

## Phase 5: Theme System Completion

### 5.1 Verify --color-white Fix
The `--color-white` override fix has been applied to `.dark` and all `theme-*` classes. Verify on the live deploy that cards/modals/sidebars now render in theme colors.

### 5.2 Audit Remaining Hardcoded Colors
Search for `bg-white` WITHOUT `dark:bg-zinc-*` in all components. Each is a theme bug.

### 5.3 Component Consistency
- Ensure all modals use the same Modal primitive
- Standardize on `inputClassic` vs `inputModern`
- Verify all forms share a common FormLayout

---

## Verification Checklist

### Security (Phase 0)
- [ ] `schemaValidation: true` in schema.ts
- [ ] `createItem` throws if firmId is empty (not falling back to client data)
- [ ] `updateItem`/`deleteItem` fail-closed (throw if either firmId is empty)
- [ ] Cascade mutations require Admin auth
- [ ] No plaintext password acceptance
- [ ] No cross-firm notePages leak

### Onboarding (Phase 1)
- [ ] Clicking "Add a court date" deep-links to matter detail with Tasks & Events tab open
- [ ] The "New Event" button has a visible pulse ring
- [ ] Clicking "Invite a team member" navigates to Settings → User Management
- [ ] Clicking "Invite a resident to portal" navigates to Settings → Portal Access
- [ ] `hasServiceCharge` hint correctly says "Units tab" (not "Service Charge tab")
- [ ] OnboardingTour doesn't fire at the same time as auto-open modal
- [ ] "All done!" celebration appears when last checklist item completes

### Schema (Phase 2)
- [ ] Missing indexes added (notifications.by_user, timeEntries.by_matter, etc.)
- [ ] Timestamp types standardized
- [ ] Required fields enforced on matters, tasks, contacts, documents, invoices
- [ ] `v.any()` replaced with typed validators on worst offenders

### Themes (Phase 5)
- [ ] Midnight theme colors cards/modals navy (not white)
- [ ] OLED theme colors cards/modals near-black
- [ ] Neon Cyber theme colors cards/modals purple
- [ ] No `bg-white` without `dark:` variant in core components
