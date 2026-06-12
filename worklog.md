---
Task ID: 1
Agent: Main Agent
Task: Redesign unit card UX - fix cog menu overflow, compact expanded card, plan Quit Notice automation

Work Log:
- Analyzed two user screenshots showing: (1) cog menu with 6+ items, (2) expanded unit card taking 60-70% of viewport height with menu cut off at bottom
- Read PropertyDetailView.tsx (~1732 lines) to understand current unit card + cog menu implementation
- Identified root cause of menu cutoff: hardcoded estimatedMenuHeight=340, no actual measurement, no flip logic
- Identified root cause of tall expanded card: full metadata grid + messaging panel + action buttons = 400+px

Changes Implemented:
1. Smart cog menu positioning: Added useEffect that measures actual rendered menu height via ref, auto-flips upward if it overflows viewport bottom, auto-shifts rightward if it overflows left edge. Added unitMenuInnerRef for measurement.
2. Two-tier unit card design: Tier 1 is a compact quick-action bar (~40px) with Pay, Demand, Message, Edit, and More buttons. Tier 2 (shown on "More" click) reveals full metadata + secondary actions (Quit Notice, Legal File, Ledger Entry, etc.).
3. Reset showFullUnitDetail state on card click/deselect.

Automation Plan Presented (not yet implemented):
- Quit Notice → Mark Served → Mark Delivered → Auto-schedule 7-Day Notice → Auto-generate draft
- New data model: evictionTracker on unit record
- Convex cron for scheduled 7-Day Notice generation
- Context-sensitive action buttons based on eviction status

Stage Summary:
- PropertyDetailView.tsx: 1732 → 1796 lines (net +64, mainly from two-tier structure)
- Build passes, TypeScript clean, braces/parens balanced
- Git commit: b205943
- Quit Notice automation plan presented for user review before implementation

---
Task ID: 2
Agent: Main Agent
Task: Fix scrolling, simplify property app for debut, implement Quit Notice → 7-Day Notice automation

Work Log:
- Diagnosed scroll hierarchy: 4 layers of overflow-hidden above PropertyDetailView's scroll container. The scroll container used `flex-grow` which doesn't guarantee bounded height in nested flex chains. Fixed by changing to `min-h-0 flex-1 overflow-y-auto`.
- Added `overflow-hidden` to PropertyDetailView root div to prevent competing scroll contexts
- Found and fixed duplicate `activeTab === 'docs'` blocks — merged financial overview + documents into single tab
- Simplified Automation Status section: replaced verbose enabled/disabled cards with compact dot+label format, removed fake "Sales Lead Tracking" stub
- Simplified Revenue Monitor promo card: replaced large card with compact one-line bar
- Implemented full Quit Notice → 7-Day Notice eviction workflow with correct Nigerian notice periods
- Added EvictionTracker data model stored in rentalDetails.evictionTracker
- Added visual eviction status badges on collapsed unit cards
- Added context-sensitive action buttons that progress through the workflow
- Gated eviction workflow by Growth+/KOMPLETE plans
- 7-Day Notice button pulses red when due date has passed

Stage Summary:
- PropertyDetailView.tsx: 1732 → 1983 lines
- 4 git commits pushed: b205943, 0a4f8da, a4ec966, ce52eb8
- Build passes, TypeScript clean, braces/parens balanced
- All changes pushed to remote

---
Task ID: 2
Agent: Main Agent
Task: Accounting overhaul + UI polish for Atrium property app ship readiness

Work Log:
- Analyzed user screenshot of CollectRentModal showing: management fee deducted from source (Net to Client), address truncated in Property/Unit display, Receipt icon used for payment action
- Read CollectRentModal.tsx, PropertyDetailView.tsx, PropertyForm.tsx, propertyPayload.ts, DataProvider.tsx, Convex schema/mutations
- Identified 6 issues to fix and implemented all

Changes Implemented:
1. **Accounting overhaul (CollectRentModal)**: Receipts now reflect FULL amount paid — no deductions shown. Management fees are invoiced separately to the landlord (not deducted from source). The financial breakdown panel shows receipt amount at full, with an informational section showing management fee and net-to-client. Added `transactionRef` to link receipt, invoice, and ledger entries. Management fee invoice is NOT auto-marked as paid.

2. **Fix address cropping**: Removed `truncate` from Property/Unit display in CollectRentModal. Now uses `break-words` so the full address is always visible.

3. **Fix edit modal save**: Commented out `onSave(contact.id, [])` in PropertyForm that was wiping the contact's properties array after save, causing stale unit data and broken status updates.

4. **Fix updateEvictionTracker scope bug**: Changed from `units.find()` (out of scope) to `(coreState.properties || []).find()` for the full unit record lookup.

5. **Replace Copy with Export**: Replaced "Copy Unit Details" (clipboard) with "Export Unit Report" (FileDown icon) in both the cog menu and Tier 2 expanded card. Placeholder toast for now.

6. **Replace Receipt icon**: Changed from `Receipt` to `BanknotesIcon` for rent payment actions (Pay button and cog menu entry) — more appropriate for payment/receipt context.

7. **Scroll fix**: Added `overscroll-contain` to main content scroll area.

8. **Schema update**: Added `management_fee` type to Convex `ledger_entries` schema and `addLedgerEntry` mutation.

Stage Summary:
- Commit: 590155a
- Build passes, Vite build successful
- Pre-existing TS errors remain (autoRentDemand, PropertyForm rentalDetails types) — not introduced by this work

---
Task ID: 3
Agent: Main Agent
Task: Fix Residents Portal stuck on skeleton + mobile sign-out issues

Work Log:
- Investigated TenantPortal.tsx (2086 lines), App.tsx (752 lines), AuthContext.tsx, ClientDashboard.tsx
- Diagnosed skeleton root cause: In App.tsx renderView(), `showSkeleton` check (line 153) ran BEFORE portal-user checks (line 176). For portal users, `isDataLoaded` tracks admin data (matters/contacts/tasks) which portal users never load, so `showSkeleton` stayed `true` forever, and TenantPortal/ClientDashboard never rendered — only GenericSkeleton was shown.
- Diagnosed mobile sign-out issue: Portal users have no Header or BottomNav (both hidden via `!isPortalUser`). The only sign-out button was inside the portal component header, which scrolled away on mobile. Also, `logout()` never cleared in-memory React state (`sessionToken`), relying solely on `window.location.href` full reload.

Changes Implemented:
1. **Skeleton fix (App.tsx)**: Moved portal-user checks (isClient/isTenant) BEFORE the `showSkeleton` gate in `renderView()`. Portal users now bypass skeleton entirely and render their portal immediately. Added comment explaining why.
2. **Sticky header (TenantPortal.tsx)**: Made portal header `sticky top-0 z-20` so sign-out is always accessible while scrolling. Made buttons icon-only on mobile (`hidden sm:inline` for text). Added `active:scale-95` touch feedback. Reduced spacing/padding on mobile.
3. **Sticky header (ClientDashboard.tsx)**: Same treatment — sticky header, icon-only on mobile, touch feedback, responsive sizing.
4. **Logout state cleanup (AuthContext.tsx)**: Added `setSessionToken(null)` and `setOriginalSessionToken(null)` BEFORE clearing storage, so in-memory React state is immediately reset. This prevents stale renders on slow mobile devices where the `window.location.href` redirect hasn't completed yet.

Stage Summary:
- App.tsx: renderView() reordered — portal users bypass skeleton
- TenantPortal.tsx: sticky header, mobile-optimized sign-out
- ClientDashboard.tsx: sticky header, mobile-optimized sign-out
- AuthContext.tsx: logout() now clears in-memory state immediately
- No new TypeScript errors introduced (pre-existing react-beautiful-dnd type errors remain)

---
Task ID: 4
Agent: Main Agent
Task: Fix portal token persistence + add Notice Board feature for tenant portal

Work Log:
- Investigated full portal token/invite system: createPortalInvite, verifyInviteToken, acceptPortalInviteByToken, setupPortalPassword, resendPortalInvite
- Discovered: 7-day token expiry is ONLY for the invite/onboarding flow. Once a tenant sets their password, they can always log in via /portal/tenant/login with email+password
- The confusion was in messaging: "token expires in 7 days" made users think they'd lose portal access
- Also: sessions already persist via rememberMe=true (localStorage) by default

Changes Implemented:
1. **Token expiry extended**: 7 days → 30 days in both createPortalInvite and resendPortalInvite. Updated all email templates and WhatsApp message templates to say "30 days"
2. **Login page messaging**: Added "Your portal is always accessible — sign in anytime with your email and password" to TenantPortalLogin.tsx. Changed invite banner from "This invite expires [date]" to "Set up your password before [date] to get started"
3. **Expired invite message**: Changed from "This invitation has expired. Please request a new one" to "Your invitation link has expired, but you can still sign in if you already set up a password. Otherwise, ask your property manager for a new invitation."
4. **Security notice**: Updated PortalAccessSettings security text to clarify that the 7-day window only applies to initial invitation, not ongoing access

5. **Notice Board schema**: Added `portal_notices` table to convex/schema.ts with fields: firmId, authorId, authorName, title, body, priority (normal/important/urgent), isPinned, propertyId (optional scope), unitId (optional scope), status (active/archived), expiresAt (optional auto-expiry), createdAt, updatedAt. Indexes: by_firm, by_firm_status, by_firm_property, by_firm_pinned
6. **Notice Board Convex backend**: Added to convex/portals.ts: createNotice, updateNotice, archiveNotice, restoreNotice, getActiveNotices (with priority sorting + expired filtering + property/unit scoping), getAllNotices (admin view), getNotice
7. **Tenant Portal Notice Board tab**: Added "Notices" as the first tab in TenantPortal.tsx with NoticesTab component. Shows priority badges (Urgent/Important/General), pin indicators, author, dates, expiry. Empty state with helpful message. Uses getActiveNotices query with tenant's propertyId/unitId for scoped notices
8. **Admin Notice Board management**: Added NoticeBoardAdmin component in PortalAccessSettings.tsx. Create form with title, body, priority selector, pin toggle. Active notices list with archive button. Archived notices with restore. Only shown for property/unified products

Stage Summary:
- Schema: portal_notices table added (table #63)
- Convex: 7 new functions (createNotice, updateNotice, archiveNotice, restoreNotice, getActiveNotices, getAllNotices, getNotice)
- TenantPortal.tsx: Notices tab added as default tab, NoticesTab component
- PortalAccessSettings.tsx: NoticeBoardAdmin component + BellIcon import
- TenantPortalLogin.tsx: Clarified messaging about persistent access
- Token expiry: 7 → 30 days across all touchpoints
- No new TypeScript errors introduced
