---
Task ID: portal-fixes-1
Agent: Main Agent
Task: Fix portal onboarding flow - login navigation, delete confirmation, copy link, user cleanup, grouped dropdown, portal preview

Work Log:
- Fixed portal login pages (ClientPortalLogin.tsx, TenantPortalLogin.tsx) to navigate to '/' after successful login - this was the root cause of "portal shows welcome toast but refreshes login page"
- Fixed 'Copy Invite Link' to use /setup-password URL instead of /portal/login URL - prevents "already accepted" error for new users
- Added delete confirmation dialog (DeleteConfirmDialog component) to PortalAccessSettings - prevents accidental deletion without warning
- Added deletePortalInviteAndCleanup mutation to convex/portals.ts - when deleting portal access, also resets the associated user (role to Pending, clears password/verification) so the same email can be re-invited without "already accepted" error
- Changed property/unit dropdown to use <optgroup> for grouped addresses (non-selectable address headers with selectable units below)
- Fixed auto-fill logic in InviteForm to always override name/email/phone from tenant data when a unit is selected (removed the `!name` guard that prevented overwriting empty fields)
- Added "View Portal" (Eye icon) button on active invites in PortalAccessSettings - uses loginAsUser impersonation to preview the portal as that client/resident
- Added impersonation revert banners to ClientDashboard and TenantPortal - shows "You are previewing the portal as [name]" with "Return to Admin" button
- Fixed SetupPassword.tsx dynamic Tailwind classes (bg-${productColor}-500/10) that wouldn't compile with JIT - replaced with concrete class variables
- Fixed PortalAccessSettings export from named to default import in SettingsView.tsx
- Installed missing 'three' dependency that was causing Vite server crash
- Started Vite dev server on http://localhost:5000

Stage Summary:
- Portal login now properly navigates to the correct dashboard after authentication
- Delete confirmation dialog prevents accidental portal access deletion
- Deleting portal access now also resets the associated user account, allowing clean re-invitation
- Copy invite link points to setup-password flow (correct for both new and existing users)
- Property/unit dropdown shows addresses as non-selectable group headers with units below
- Admin can preview the portal as a specific client/resident via impersonation
- Impersonation revert banner appears in portal views when previewing
- Dev server running on http://localhost:5000
---
Task ID: 1
Agent: Main Agent
Task: Fix portal login and routing - comprehensive portal system overhaul

Work Log:
- Diagnosed portal login failure: after login, navigate('/') caused race conditions with auth state loading and flow state machine
- Changed portal login pages to use window.location.href = '/' instead of navigate('/') for robust full-page reload
- Added redirect for authenticated portal users who revisit login pages (ClientPortalLogin, TenantPortalLogin)
- Added portal user bypass in App.tsx flow state machine: skip splash screen, skip data loading wait
- Set isDataLoaded=true immediately for portal users in DataProvider (they don't need full firm data)
- Skipped firm data queries (getFirmMetadata, getFirmData) for portal users to avoid unnecessary loading
- Added ProductContext fallback for portal users using currentUser.product when firmDetails not loaded
- Fixed setupPortalPassword in convex/portals.ts to always set firmId for existing users (was missing before)
- Fixed deletePortalInviteAndCleanup to also delete all other invites for same email and clear firmId
- Added online presence privacy: Tenant (property portal) users are hidden from getActivePeers by default
- Added portalPresenceHidden field to User type and AuthContext
- Added visual indicators for portal users: RoleBadge shows "Client Portal" / "Resident Portal" labels
- Added "Portal" badge next to portal user names in FirmSettings team list with camera icon
- Enhanced portal preview button in PortalAccessSettings with text label and navigation after impersonation
- Added Sign Out button to both TenantPortal and ClientDashboard headers
- Moved hasInitialSplashFinished and splashAnimationComplete state declarations above their first usage
- Built and deployed successfully: Vite build ✓, Convex deploy ✓

Stage Summary:
- Portal login should now work: uses full page reload + skips splash/data loading for portal users
- firmId is always set for portal users (critical for ProductContext and data loading)
- Delete portal access now fully cleans up (all invites + user reset)
- Tenant presence is hidden by default from admin view
- Portal users have visual indicators distinguishing them from team members
- Preview portal button navigates to portal view after impersonation
- Sign out buttons added to both portal dashboards
---
Task ID: portal-fixes-3
Agent: Main Agent
Task: Fix portal users blocked by "speak to administrator/manager" screen - comprehensive portal access fix

Work Log:
- Diagnosed ROOT CAUSE: DataProvider skips firm data loading for portal users (Client/Tenant), causing useFeatures() to default to Core plan. This makes canUseClientPortal and canUseTenantPortal return false, showing "Portal Unavailable" / "Residents' Portal Unavailable" screens instead of the actual portal dashboard.
- Added getFirmBasicInfo query to convex/myFunctions.ts - lightweight query that returns just the firm record (subscriptionPlan, product, etc.) without loading all the heavy data
- Modified DataProvider to load firm basic info for portal users via getFirmBasicInfo and merge into appState.firmDetails so useFeatures works correctly
- Modified useFeatures to add currentUser-based fallback for plan/product derivation - portal users assume Komplete access until firm data loads
- Fixed ClientDashboard to skip canUseClientPortal gate for authenticated Client role users - portal users with valid accounts should ALWAYS access their portal regardless of feature gate
- Fixed TenantPortal to skip canUseTenantPortal gate for authenticated Tenant role users - same safety net
- Fixed "invitation already accepted" dead-end in verifyInviteToken and setupPortalPassword by checking if user's role is Pending or isVerified is false - allows re-acceptance after portal access deletion
- Committed and pushed to git: commit 27d3eb0

Stage Summary:
- ROOT CAUSE FIXED: Portal users can now access their portal dashboards because firm data is loaded for them
- Double safety net: Both DataProvider loads firm data AND portal components skip feature gates for correct roles
- "Already accepted" error fixed for re-invite scenarios where user was reset but stale invite remains
- All changes pushed to git (main branch)
---
Task ID: 3
Agent: Main Agent
Task: Fix smart fill / placeholder issues in DraftProEditor (modal not dismissing, multiple pasting, stale positions, incorrect replacement)

Work Log:
- Read LegalPlaceholder.tsx extension: identified that it dispatches 'open-placeholder-modal' CustomEvent with label in detail, but the editor handler ignored the label
- Read DraftProEditor.tsx (1434+ lines): found fill_placeholders modal at lines 1122-1184 with multiple bugs
- Bug 1 - Modal not dismissing: processFill() used separate editor.chain().deleteRange().insertContentAt().run() per placeholder, each as a separate transaction. If any threw an error, setActiveModal(null) was never reached
- Bug 2 - Multiple pasting: (a) No guard against duplicate submissions — user could click "Apply All" multiple times. (b) Each .run() dispatched a separate transaction using stale positions from the render-time closure, causing content to be inserted at wrong positions or duplicated
- Bug 3 - Stale positions: nodesToFill array was captured at render time inside IIFE. When processFill ran, it used these stale positions. Even bottom-up sorting couldn't fully compensate because each .run() changed the document independently
- Bug 4 - Wrong placement: Same root cause as Bug 3 — stale positions caused replacements at incorrect document positions

Fixes applied to DraftProEditor.tsx:
1. Added `isFillingRef` (useRef<boolean>) as a processing guard — processFill exits immediately if already filling, preventing duplicate submissions
2. Added `targetPlaceholderLabel` state — captures the clicked placeholder's label from the open-placeholder-modal event detail, used for autoFocus on the corresponding form input
3. Fixed event listener to extract label: `const label = e?.detail?.label || null; setTargetPlaceholderLabel(label);`
4. Rewrote processFill to:
   - Guard with isFillingRef to prevent duplicate calls
   - Re-fetch positions FRESH from editor.state.doc.descendants() inside processFill (not stale render-time positions)
   - Use a SINGLE ProseMirror transaction (editor.state.tr) with tr.replaceWith() for all replacements instead of multiple chain().run() calls
   - Sort bottom-up (b.pos - a.pos) so higher positions are replaced first, keeping lower positions stable
   - Wrap in try-catch-finally to guarantee modal closes even on error
   - Always reset isFillingRef in finally block
   - Always clear targetPlaceholderLabel in finally block
5. Replaced all setActiveModal(null) calls in the fill modal with closeFillModal() helper that also clears targetPlaceholderLabel
6. Added autoFocus prop to the input matching targetPlaceholderLabel for UX improvement
7. Added disabled:opacity-50 disabled:cursor-not-allowed classes to submit button for visual feedback

No changes needed to LegalPlaceholder.tsx — the extension correctly dispatches the event with label detail

Stage Summary:
- Modal now ALWAYS dismisses after filling (try-catch-finally guarantees setActiveModal(null))
- No more multiple pasting (isFillingRef guard + single transaction prevents duplicate processing)
- No more stale positions (positions re-fetched fresh from current document state inside processFill)
- All instances of the same placeholder label are replaced correctly in a single atomic transaction
- Clicking a specific placeholder auto-focuses the corresponding field in the fill modal
---
Task ID: 1
Agent: Main Agent
Task: Remove SMS from communication channels, gate WhatsApp behind Growth+/KOMPLETE, replace "Full Compose in Revenue Monitor →" with direct Portal and Compose buttons

Work Log:
- Removed 'sms' from AutomationChannel type in types.ts (was `'whatsapp' | 'email' | 'sms' | 'portal'`, now `'whatsapp' | 'email' | 'portal'`)
- Updated types.ts CommunicationIntegration interface: replaced sms with portal in availableChannels, monthlyLimits, and currentUsage
- ComposeModal.tsx: Removed `sms` from CHANNEL_COLORS record
- ComposeModal.tsx: Removed `else if (channel === 'sms')` block from handleSend (the simulated SMS send)
- ComposeModal.tsx: Fixed closing brace issue after email handler (was left as bare code after SMS removal)
- ComposeModal.tsx: Imported `useFeatures` from `../../hooks/useFeatures`
- ComposeModal.tsx: Added WhatsApp gating in channel selector — disabled button + lock icon + tooltip when not Growth+/KOMPLETE
- ComposeModal.tsx: Added WhatsApp plan guard in handleSend — shows toast "WhatsApp requires Growth plan or above" and returns early
- ComposeModal.tsx: Updated channel initialization — if WhatsApp is preferred but not allowed, falls back to 'email'
- ComposeModal.tsx: Removed SMS text from channel button label mapping
- PropertyDetailView.tsx: Imported ComposeModal, ComposeModalPrefill, useConvex, useFeatures
- PropertyDetailView.tsx: Added state for showCompose and composePrefill
- PropertyDetailView.tsx: Added convex = useConvex() and { isGrowthOrAbove, isKompleteFirm } = useFeatures()
- PropertyDetailView.tsx: Added handleSendPortalMessage handler — sends portal message via convex.mutation(api.portals.sendPortalMessage)
- PropertyDetailView.tsx: Added handleOpenCompose handler — sets prefill data and opens ComposeModal
- PropertyDetailView.tsx: Replaced "Full Compose in Revenue Monitor →" button with:
  - Portal button (violet, sends portal message directly)
  - Compose button (opens ComposeModal inline with prefill)
- PropertyDetailView.tsx: Added WhatsApp gating on WhatsApp button — shows disabled/locked version when not Growth+/KOMPLETE
- PropertyDetailView.tsx: Added ComposeModal rendering at component bottom
- AtriumInbox.tsx: Removed `sms` from CHANNEL_COLORS
- AutomationCenter.tsx: Removed `sms` from CHANNEL_COLORS, updated description text from "WhatsApp · Email · SMS" to "WhatsApp · Email · Portal"
- TenantPortal.tsx: Removed `case 'sms'` from channel icon switch statement
- communicationIntegration.ts: Replaced all smsLimit with portalLimit, updated features arrays, replaced SMS references with Portal in getAvailableChannels, updated usesSMS param to usesPortal
- convex/communications.ts: No SMS code found — no changes needed
- TypeScript compilation check: no errors in src/ directory

Stage Summary:
- SMS channel completely removed from all UI, types, and services
- WhatsApp is gated behind Growth plan or above, or KOMPLETE variant — locked button with tooltip for unauthorized plans
- PropertyDetailView messaging panel now shows: WhatsApp (gated) | Email | Call | Portal | Compose
- "Full Compose in Revenue Monitor →" replaced with direct Portal send + ComposeModal inline
- Portal channel works without phone/email — sends to tenant's portal inbox
- All CHANNEL_COLORS records updated consistently across AtriumInbox, AutomationCenter, ComposeModal
---
Task ID: 2
Agent: Main Agent
Task: Fix portal name mismatch bug — ensure tenant name source of truth is the property record, not the invite

Problem:
When a portal invite is created for a tenant, the name stored on the portal invite (inviteeName) could differ from the actual tenant name stored on the property/unit. This caused confusion where the portal showed one name but the settings page showed another.

Root Cause:
1. createPortalInvite accepted inviteeName from admin's manual input without checking the property record
2. setupPortalPassword used invite.inviteeName or user-provided name for the user's name in the users table
3. setupPortalPassword wrote the user/invite name TO the property record's tenantName field (overwriting the canonical name)
4. TenantPortal displayed currentUser.name (from users table, sourced from invite) instead of the property record name
5. getTenantInfo didn't expose the tenantName from the property/unit record

Changes Made:

### 1. convex/portals.ts — createPortalInvite action
- Added property record lookup BEFORE inserting the invite record
- When portalType === "resident" and relatedId is provided, resolves the canonical tenant name from the property/unit record
- Uses findPropertyByCustomId internal query to find the property, then extracts tenantName from the matching unit or property
- Overrides inviteeName with the resolved name from the property record
- Uses resolvedInviteeName throughout: in inviteeGreeting, toName for emails, and in the invite record

### 2. convex/portals.ts — setupPortalPassword action
- Added property record lookup BEFORE user creation/update (step 1.5)
- Resolves canonicalTenantName from the property/unit record using same logic as createPortalInvite
- For NEW user creation: uses canonicalTenantName as the primary name source (falls back to args.name, invite.inviteeName, email)
- For EXISTING user update: always syncs name with canonicalTenantName if available (overwrites existing name to match property record)
- In property linking section: uses canonicalTenantName instead of portalUser.name for the unit's tenantName field
- Removed the now-unnecessary ctx.runQuery to look up the portal user just for their name

### 3. convex/portals.ts — getTenantInfo query
- Added tenantName field to tenantProperties items (from rentalDetails.tenantName or property.tenantName)
- Added tenantName field to tenantUnits items (from unit.tenantName)
- Added tenantName to the top-level return value, resolved from primaryUnit.tenantName or tenantProperties
- This allows the TenantPortal to display the canonical name from the property record

### 4. src/components/settings/PortalAccessSettings.tsx — InviteForm
- Added isNameAutoFilled state to track when the name was auto-filled from a tenant record
- Updated handleRelatedChange: sets isNameAutoFilled=true when a unit with tenantName is selected, false otherwise
- When no unit is selected (deselected), resets isNameAutoFilled to false
- Name field label: shows "· from tenant record" (emerald) when auto-filled, "(optional)" otherwise
- Name input: becomes read-only when isProperty && isNameAutoFilled, with emerald border/bg styling
- Added helper text: "This name is from the property's tenant record and will be used as the official name on the portal."
- If user edits the name (removing readOnly), isNameAutoFilled is reset to false

### 5. src/components/tenant/TenantPortal.tsx
- Welcome message: changed from currentUser.name to tenantInfo?.tenantName || currentUser.name
- Impersonation banner: changed from currentUser.name to tenantInfo?.tenantName || currentUser.name || currentUser.email
- Now displays the canonical tenant name from the property record as the primary name source

Key Principle Enforced:
The property/tenancy record is the SOLE source of truth for a tenant's name. The portal invite, user record, and portal display all sync FROM the property record, never the other way around.
---
Task ID: 4
Agent: Main Agent
Task: Fix unit card expansion behavior on mobile — expand in-place instead of injecting expansion panel after row

Problem:
When a user clicks on a unit in the mobile view of PropertyDetailView, the expanded unit card opens in the MIDDLE of the other units (inserted as a separate card after the current row), requiring the user to scroll down to see it. For properties with many units, users may not even notice the card opened.

Root Cause:
The unit cards were rendered in rows (chunks of 4 for xl breakpoint). When a unit was selected, a separate expansion panel div was injected AFTER the row containing the selected unit. This panel spanned all grid columns but appeared below the current row of cards, pushing content down and requiring scrolling.

Changes Made to /home/z/my-project/src/components/details/PropertyDetailView.tsx:

1. Removed row-based grouping logic (COLS_XL, rows, selectedRowIdx, rows.flatMap pattern)
   - Old: Units were grouped into rows of 4, expansion panel injected after the row
   - New: Units are rendered directly with units.map(), no row grouping

2. Made each unit card self-contained with inline expansion
   - Each card conditionally renders expanded content WITHIN itself when selected
   - Expanded content includes: detail header with close button, metadata grid, messaging panel, action buttons
   - All the same functionality as the old expansion panel is preserved

3. Added inline expanded view section inside each card
   - When isSelected is true, the card expands to show: Unit Detail header, detail grid (tenant, rent, lease end, phone, email, service charge, etc.), messaging panel (WhatsApp, Email, Call, Portal, Compose), action buttons (Edit Unit, Record Payment, Legal File, Message Tenant, Remove Unit)
   - Uses animate-fade-in class for smooth content appearance
   - Uses border-t separator between compact and expanded content

4. Added scroll-into-view behavior
   - When a card is selected/expanded, a ref callback scrolls it into view with `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` after a 120ms delay
   - Ensures the expanded card is always visible to the user

5. Added CSS transitions for smooth expansion
   - Card div uses `transition-all duration-300 ease-in-out` for smooth padding and style changes
   - When expanded: card spans all grid columns (col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4), gets p-5 padding, primary border with ring
   - When collapsed: card stays in its grid position with p-2.5 padding, default border

6. Moved handler functions to per-card scope
   - handleWhatsApp, handleEmailTenant, handleOpenInbox, handleSendPortalMessage, handleOpenCompose are now defined per-card using the current unit's data
   - This replaces the old pattern where they were defined inside the expansion panel using selectedUnit

7. Added e.stopPropagation() to all action buttons in the expanded view
   - Prevents the card's onClick (which toggles selection) from firing when clicking action buttons

8. Removed the expansion panel injection code entirely
   - Deleted the expansionPanel variable, the IIFE that created it, and the `[...cards, expansionPanel]` return pattern
---

---
Task ID: 6
Agent: Main Agent
Task: Create Portal Terms of Use and integrate into existing Terms & Conditions flow

## Summary
Created a comprehensive Portal Terms of Use document and integrated it into the PracticePro SaaS app's existing terms and conditions flow. Portal invitees must now acknowledge the Portal Terms of Use before they can create their password and access the portal.

## Files Created

### `/home/z/my-project/src/components/PortalTermsOfUse.tsx` (NEW)
- Full-page component rendering the Portal Terms of Use with professional legal language
- Accepts `onBack` and `activeProduct` props ('vega' | 'atrium') for product-aware wording
- 11 sections covering: Purpose & Scope, User Responsibilities, Privacy & Data Protection (NDPA 2023), Communication Through the Portal, Payment Submissions & Proof of Payment, Maintenance Requests & Service Charges, Intellectual Property Restrictions, Limitation of Liability, Termination of Portal Access, Governing Law (Nigeria/Lagos State), Contact Information
- Dark mode compatible design matching existing TermsOfService component styling
- Conditional content for VEGA (Client Portal) vs ATRIUM (Residents' Portal)

## Files Modified

### `/home/z/my-project/src/components/TermsOfService.tsx`
- Added Section 23: "PORTAL TERMS OF USE" after the existing Section 22 (Contact Information)
- Added entry in Table of Contents
- Section incorporates Portal Terms by reference, stating that portal users are bound by additional terms when using the Client Portal or Residents' Portal
- Covers: Incorporation by Reference, Binding Effect, Scope, Amendment, and Portal Access as a Privilege

### `/home/z/my-project/src/components/portal/SetupPassword.tsx`
- Added `termsError` state for validation messaging
- Updated terms checkbox text to: "I agree to the Portal Terms of Use and the PracticePro Terms and Conditions of Service"
- Added link to Portal Terms of Use (opens modal) and PracticePro Terms of Service (opens in new tab)
- Added validation: if checkbox is not ticked, shows error message in rose/red text
- Checkbox border turns red when terms error is shown
- Replaced the old simple terms overlay with a comprehensive 11-section Portal Terms of Use modal
- Modal includes "I Agree" button that auto-checks the checkbox, "Close" button, and "View Full Terms" external link
- Updated `handleSubmit` to validate terms acceptance before submission

### `/home/z/my-project/src/components/App.tsx`
- Added import for `PortalTermsOfUse` component
- Added routing case for `view === 'portalTermsOfUse'` in both the main view switch and the unauthenticated view section
- Routes use `activeProduct` prop derived from product context (same pattern as TermsOfService)

### `/home/z/my-project/src/types.ts`
- Added `'portalTermsOfUse'` to the `View` union type

### `/home/z/my-project/convex/schema.ts`
- Added `termsAcceptedAt: v.optional(v.number())` field to the `portal_invites` table definition

### `/home/z/my-project/convex/portals.ts`
- Updated `setupPortalPassword` action to record `termsAcceptedAt: Date.now()` when marking the invite as accepted
- Updated `acceptPortalInviteByToken` mutation to record `termsAcceptedAt: Date.now()` when marking the invite as accepted

## Design Decisions
- The Portal Terms of Use is a separate component from TermsOfService to allow independent viewing and updating
- Terms checkbox must be explicitly ticked before the "Set Up Password & Activate" button becomes enabled
- The modal preview shows all 11 sections in summary form with links to the full terms
- Clicking "I Agree" in the modal auto-checks the checkbox for convenience
- The terms acceptance timestamp is recorded in the database for audit/compliance purposes

---
Task ID: 8
Agent: Main Agent
Task: Add ability for portal users to view and print their agreements, consents, and documentation

Work Log:
- Added 4 new queries to convex/portals.ts: getTenantDocuments, getPortalUserConsentRecords, getTenantLeaseDetails, getClientConsentRecords
- Added "Documents" tab to TenantPortal.tsx with 4 sections: Lease Agreement, Terms & Consents, Shared Documents, Payment Proofs
- Each section has View/Print buttons that open professional print-ready HTML in a new window
- Enhanced ClientDashboard.tsx Documents tab with Terms & Consents section and Print buttons for each document
- Added @media print CSS rules to index.css for clean print output
- Print templates use PracticePro ATRIUM branding (tenants) and PracticePro VEGA branding (clients)
- Consent records pull from portal_invites.termsAcceptedAt for accurate acceptance timestamps
- Lease details pull from both properties.rentalDetails and tenancies table

### `/home/z/my-project/convex/portals.ts`
- Added `getTenantDocuments` query — returns documents linked to a tenant's property matters
- Added `getPortalUserConsentRecords` query — returns accepted terms/consent records for a portal user
- Added `getTenantLeaseDetails` query — returns lease/rental details from properties and tenancies
- Added `getClientConsentRecords` query — returns consent records for client portal users

### `/home/z/my-project/src/components/tenant/TenantPortal.tsx`
- Added 'documents' to TabId type
- Added Documents tab with DocumentIcon to tab bar
- Created DocumentsTab component with Lease Agreement, Terms & Consents, Shared Documents, Payment Proofs sections
- Added PrinterIcon, FolderOpenIcon, ShieldCheckIcon local icons
- All print functions generate professional HTML with @media print support and floating print button

### `/home/z/my-project/src/components/client/ClientDashboard.tsx`
- Added clientConsentRecords query
- Enhanced renderDocuments() with Terms & Consents section showing accepted terms with Print button
- Added Print button to each shared document
- Split documents tab into labeled sections: Terms & Consents + Shared Documents

### `/home/z/my-project/src/index.css`
- Added @media print CSS: hides nav/buttons, forces white background, removes shadows, shows link URLs

## Design Decisions
- Print views open in new browser window via window.open() for maximum compatibility
- Each print template includes a floating "Print" button that hides via @media print CSS
- Professional branding consistent with PracticePro product (ATRIUM for property, VEGA for legal)
- Consent records use portal_invites.termsAcceptedAt which is set during invite acceptance
- Lease details pull from multiple sources (properties.rentalDetails, units, tenancies) for comprehensive coverage
---
Task ID: 5
Agent: Main Agent
Task: Fix KOMPLETE variant signing context issue — documents and communications should sign as the user who owns the app, not guess the role based on product variant. Also add Mini ALOA integration for placeholder context gathering.

## Problem
When using KOMPLETE (unified) variant, the app was hardcoding the user as "Lawyer/Solicitor" in document drafting and ARIA prompts, instead of using the user's actual profile role. This meant property consultants, managing directors, and other non-lawyer professionals using KOMPLETE would get incorrectly signed documents.

Additionally, when ARIA (the AI assistant) needed more context while filling documents, there was no way to get quick answers — users had to leave the editor and search manually, resulting in poor quality text.

## Files Modified

### 1. `/home/z/my-project/src/contexts/ProductContext.tsx`
- Added `SignerContext` interface with `signerName`, `signerTitle`, and `userRole` fields
- Added `signerContext` to `ProductContextValue` — only populated when `isUnified` (KOMPLETE mode)
- `signerTitle` is derived from the user's `UserRole` enum with a default mapping, or from a custom `signerTitle` in `firmDetails.settings`
- Added `useSignerContext()` hook export for easy access from any component
- VEGA/ATRIUM variants are unaffected — `signerContext` is null for them

### 2. `/home/z/my-project/src/services/aiService.ts`
- Updated `streamDraft` context type to accept optional `signerContext: SignerContext | null`
- Passes `signerContext` through to `geminiService.streamDraft`

### 3. `/home/z/my-project/src/services/geminiService.ts`
- Imported `SignerContext` from ProductContext and `getAloaProtocol` from aloaPrompts
- Updated `streamDraft` context type to accept `signerContext`
- When `signerContext` is present (KOMPLETE mode): builds a role-aware context block that tells ARIA the user's actual name and title, instructs it NOT to assume "Lawyer" or "Property Manager"
- When `signerContext` is absent (VEGA/ATRIUM): preserves existing behavior ("The user is ALWAYS the Lawyer/Solicitor")
- Uses `getAloaProtocol()` to select the appropriate ALOA protocol variant

### 4. `/home/z/my-project/src/constants/aloaPrompts.ts`
- Preserved original `ALOA_PRECISION_PROTOCOL` unchanged (VEGA/ATRIUM use this)
- Added new `ALOA_KOMPLETE_PROTOCOL` — a KOMPLETE-specific variant that:
  - Does NOT assume the user is a Lawyer/Solicitor
  - Requires ARIA to use signer name/title from CONTEXT block
  - Tells ARIA to use [BRACKETED PLACEHOLDERS] when unsure rather than guessing roles
  - Includes context-aware signing rules and "needing more context" guidance
  - Uses role-appropriate Nigerian terminology based on the user's actual profession
- Added `getAloaProtocol(isUnified, signerContext)` helper function that returns the correct protocol

### 5. `/home/z/my-project/src/components/documents/tiptap/DraftProEditor.tsx`
- Imported `useSignerContext` and `useAloa` hooks
- Added `isUnified` flag from `useProduct()`
- Passes `signerContext` to `aiService.streamDraft()` for KOMPLETE-aware document generation
- Added AI Help feature for placeholder filling:
  - New state: `aiHelpLabel`, `aiHelpLoading`, `aiHelpResult`
  - `handleAiHelpForPlaceholder(label)` function that:
    1. Opens MiniAloa with context about the current placeholder and document
    2. Simultaneously makes a quick inline AI suggestion using `streamMessage` (flash model)
    3. When the suggestion arrives, it's shown as a default value in the placeholder input with a "AI suggested — edit or accept" indicator
  - Updated fill_placeholders modal UI:
    - Each placeholder input now has an "Ask ARIA" button (violet themed) next to the label
    - When AI suggestion is available, it's set as the input's `defaultValue` and `placeholder`
    - A small indicator shows "AI suggested — edit or accept" below the input
    - Loading state shows "Asking..." on the button while the AI is processing

## Key Design Decisions
- `signerContext` is ONLY populated for KOMPLETE (unified) mode — VEGA and ATRIUM behavior is completely unchanged
- The `signerTitle` can be customized via `firmDetails.settings.signerTitle` for users who want a non-default title
- The `AriaChatContext` interface was used correctly for `openWithContext()` to ensure type safety
- Inline AI suggestions use the `flash` model for speed — slower `pro` model would delay the UX
- MiniAloa opens alongside for deeper context gathering, while the inline suggestion provides a quick answer
- All existing VEGA/ATRIUM document structures, prompts, and signing conventions are preserved exactly

---
Task ID: 7
Agent: Communication Audit Trail Agent
Task: Add communication audit trail and print functionality

Work Log:
- Updated convex/schema.ts: Added `messageContent`, `direction` (outbound/inbound), `senderName` fields to `automation_logs` table. Added `portal` as valid channel option in both `automation_logs` and `atrium_inbound_messages` tables. Added `by_firm_channel` index.
- Updated convex/sentry.ts: Extended `logAutomation` mutation with `messageContent`, `direction`, `senderName` args. Added `getAuditTrail` query that merges outbound (automation_logs) and inbound (atrium_inbound_messages) communications into a single chronological timeline with filtering by unitId, tenantId, channel, messageType, and date range. Added `getCommunicationsForPrint` query returning full detail for printing. Added `AuditTrailEntry` TypeScript interface.
- Updated src/types.ts: Added `messageContent`, `direction`, `senderName` fields to `AutomationLog` interface. Added new `AuditTrailEntry` interface with all fields for the merged timeline.
- Updated src/components/atrium/ComposeModal.tsx: Modified `handleSend` to log full `messageContent` (in addition to truncated `messagePreview` of 200 chars), set `direction: 'outbound'`, and include `senderName` in the `logAuto` call.
- Created src/components/atrium/CommunicationPrintView.tsx: Professional print-friendly modal component with firm letterhead (name, address, phone, email), tenant/unit header, chronological communications timeline with direction indicators (sent/received), channel labels, status badges, and A4-formatted print CSS. Includes Print and Close buttons.
- Rewrote src/components/atrium/AtriumInbox.tsx: Added Inbox/Audit Trail sub-tab navigation. Added "Print" button in header for printing all communications. Added per-tenant print button in thread detail view. Added Audit Trail section with: expandable filter panel (channel, message type, date range), chronological timeline with date separators, direction indicators (arrow icons for sent/received), channel and status badges, and per-entry print button. Imported CommunicationPrintView component.
- Updated src/index.css: Added comprehensive `@media print` styles including A4 page setup (`@page { size: A4 portrait; margin: 1.5cm 2cm; }`), print-content class styling, print-comm-entry page-break-avoid, letterhead formatting, and overlay cleanup for print mode.

Stage Summary:
- All communications (WhatsApp, Email, Portal) are now logged with full message content, direction, and sender info
- Audit Trail tab in the Revenue Engine inbox shows merged inbound + outbound timeline
- Filters allow narrowing by channel, message type, and date range
- Print button opens professional A4-formatted print view with firm letterhead
- TypeScript compilation passes with zero new errors in modified files

---
Task ID: 9
Agent: Main Agent
Task: Add back and forward navigation buttons to the mobile app for ease of navigation

Work Log:
- Examined UIContext.tsx: Found existing navigation history stack (`history: HistoryEntry[]`, `historyIndex`, `canGoBack`, `canGoForward`, `goBack`, `goForward`, `navigateTo`). The `goBack`/`goForward` functions used React Router's `navigate(-1)`/`navigate(1)` but did NOT update `historyIndex`, causing `canGoBack`/`canGoForward` computed values to fall out of sync with actual navigation state.
- Fixed UIContext.tsx: Updated `goBack` to check `historyIndex > 0`, call `setHistoryIndex(prev => prev - 1)`, then `navigate(-1)`. Updated `goForward` to check `historyIndex < history.length - 1`, call `setHistoryIndex(prev => prev + 1)`, then `navigate(1)`. This ensures `canGoBack`/`canGoForward` remain accurate after navigation.
- Examined Header.tsx: Found desktop back/forward buttons already exist (`hidden md:flex`). Mobile only showed the Logo icon on the left side with no navigation controls.
- Added mobile back/forward buttons in Header.tsx: New `md:hidden` section before the mobile Logo with back (chevron-left) and forward (chevron-right) arrow buttons. Buttons use dynamic styling — active state with hover/press effects (slate-600/zinc-300) when enabled, faded appearance (slate-300/zinc-600) when disabled. Proper `aria-label` attributes for accessibility. Slightly larger icons (w-5 h-5) compared to desktop (w-4 h-4) for better touch targets on mobile.
- Did NOT modify BottomNav.tsx per task requirements — back/forward controls belong in the header area, not duplicated in the bottom nav.
- TypeScript compilation: No new errors introduced in modified files (UIContext.tsx, Header.tsx).

Files Modified:
- `/home/z/my-project/src/contexts/UIContext.tsx` — Fixed `goBack`/`goForward` to sync `historyIndex` state
- `/home/z/my-project/src/components/Header.tsx` — Added mobile back/forward navigation buttons


---
Task IDs: 10, 11, 12, 13, 14, 15, 16
Agent: Main Agent
Task: Fix ALL critical portal bugs (Bug 10-16)

Work Log:

### Bug 10: Portal Sign-Out
- Made Sign Out buttons more prominent in both TenantPortal and ClientDashboard
- Added a red-outlined style with LogoutIcon (SVG) so the button is visually distinct
- Both buttons already called `logout()` from AuthContext which correctly redirects portal users to their login page
- Files: `TenantPortal.tsx`, `ClientDashboard.tsx`

### Bug 11: Portal Session Persistence on Refresh
- Root cause: `practicepro_portal_type` was stored only in `sessionStorage`, which doesn't persist across new tabs. After login, the URL changes to `/` (not a portal route), so `isPortalRoute()` relied solely on sessionStorage to detect portal users.
- Fix: Changed `practicepro_portal_type` to also persist in `localStorage` (in addition to sessionStorage)
- Updated `isPortalRoute()` to check both `sessionStorage` AND `localStorage` for the portal type flag
- Updated `App.tsx` `hasSavedSession` to check for portal session keys too (not just app session)
- Updated `App.tsx` redirect effect to check localStorage for portal type
- Updated `App.tsx` `hasRememberedPortal` in `renderAppContent()` to also check localStorage
- Files: `AuthContext.tsx`, `App.tsx`

### Bug 12: Portal Dashboard Data Display
- Root cause: `getTenantLedger` query only searched by `tenantId`, but ledger entries might be stored with the user's email as the tenant ID (not their Convex _id)
- Fix: Added optional `email` parameter to `getTenantLedger` query
- The query now also includes the email in `possibleTenantIds`, and resolves the user's Convex _id from their email
- Updated both `LedgerTab` and `ReceiptsTab` in TenantPortal to pass the email parameter
- Files: `portals.ts`, `TenantPortal.tsx`

### Bug 13: "Not Linked to a Property" for Maintenance Reports
- The MaintenanceTab already correctly uses `tenantInfo?.primaryPropertyId` and `tenantInfo?.primaryUnitId`
- Added a loading check: if `tenantInfo` is undefined (still loading), show "Still loading" instead of "No property linked"
- This prevents the confusing error when the tenant info hasn't loaded yet
- Also fixed pre-existing TypeScript error: `createMaintenanceTicket` used `attachments` field but the schema has `images` — mapped `attachments` → `images` in the insert
- Files: `TenantPortal.tsx`, `portals.ts`

### Bug 14: Session Conflict Between Portal and App
- Root cause: When an app subscriber (non-portal user) logged in, `practicepro_portal_type` was not cleared from storage, so on next refresh `isPortalRoute()` returned true, causing the app session to be deprioritized
- Fix: When a non-portal login occurs, explicitly clear `practicepro_portal_type` from both `sessionStorage` AND `localStorage`
- Also, when `currentUser` is loaded and has a non-portal role (Admin, etc.), the portal type effect now clears the flag from both storages
- Files: `AuthContext.tsx`

### Bug 15: "Invitation Already Accepted" Error on Re-invite
- Root cause: `insertInviteRecord` only superseded invites for the same firm AND portal type, leaving stale "accepted" invites from other contexts that blocked re-invitation
- Fix: Changed `insertInviteRecord` to supersede ALL existing invites for the same email, regardless of firm/portal type
- Also enhanced `verifyInviteToken` to check additional reset conditions (no password, no firmId) in addition to role=Pending and isVerified=false
- Enhanced `setupPortalPassword` with the same thorough reset detection
- Files: `portals.ts`

### Bug 16: Portal Name Auto-fill + Delete to Forget Email
- Name auto-fill was already fixed in a previous task (PortalAccessSettings auto-fills from tenant record)
- Delete to forget email: Enhanced `deletePortalInviteAndCleanup` to also clear `product`, `portalPresenceHidden`, and `onboardingCompleted` from the user record — ensuring a thorough reset so the same email can be re-invited cleanly
- Delete confirmation dialog was already implemented (DeleteConfirmDialog)
- Files: `portals.ts`

Stage Summary:
- All 7 critical portal bugs fixed across 5 files
- Convex typecheck passes cleanly
- Key architectural change: portal type flag now uses localStorage for cross-session persistence
- Ledger query now handles email-to-ID mapping for robust data retrieval
- Invite system is more aggressive about superseding stale invites to prevent "already accepted" errors

---
Task ID: audit-phase-a
Agent: Main Agent
Task: Systematic audit and fix of PracticePro portal infrastructure and global navigation

Work Log:
- Mapped all routes, views, and modals in App.tsx (28+ views, 6 portal-specific pages)
- Deep-audited 6 portal components against 4 lenses (State, Layout, Data Integrity, Friction)
- Found 34 findings: 7 Critical, 10 High, 9 Medium, 8 Low
- Deep-audited 6 navigation/layout components against same 4 lenses
- Found 31 findings: 7 Critical, 10 High, 9 Medium, 5 Low

Critical Fixes Applied:
1. ClientMatterDetailView: Added loading skeleton + "Not Found" state (was returning null)
2. ClientMatterDetailView: Implemented Action Items tab (was a shipped stub)
3. ClientMatterDetailView: Added URL-driven tab state via hash persistence
4. ClientDashboard: Fixed matters tab showing empty state during loading
5. ClientDashboard: Fixed summary cards showing 0 during loading (now shows "—")
6. ClientDashboard: Styled the "Access Denied" screen (was bare unstyled text)
7. ClientDashboard: Added URL-driven tab state via hash persistence
8. ClientDashboard: Fixed getUserName for portal users (falls back to firm name)
9. TenantPortal: Added URL-driven tab state via hash persistence
10. TenantPortal: Added loading state for tenantInfo in header
11. TenantPortal: Removed dead uploadFilesToConvex function
12. TenantPortal: Added robust system theme listener for isDark detection
13. ClientIntakePortal: Fixed flash of "not found" during loading (added loading skeleton)
14. ClientIntakePortal: Added cancel confirmation dialog
15. Sidebar: Removed plan card from footer (de-clutter A10)
16. Sidebar: Removed dead appMode prop
17. Sidebar: Added error + empty states to workspace dropdown
18. BottomNav: Aligned labels with Sidebar ("Finance" → "Financials", "Docs" → "Documents")
19. BottomNav: Added Escape key handler for More menu
20. ContextMenu: Fixed first-render position calculation (useLayoutEffect)
21. ContextMenu: Added Escape key handler
22. ContextMenu: Fixed scroll handler closing menu when scrolling inside it
23. ContextMenu: Removed no-op Download menu item
24. App.tsx: Gated all console.log/warn behind import.meta.env.DEV
25. UIContext: Gated console.log behind DEV, silenced heartbeat error
26. Fixed addToast() call signature in MatterDetailView and ClientMatterDetailView
27. Fixed handleUpdateClientActionItem argument type (boolean not object)

Stage Summary:
- Phase A1 (Route Mapping): Complete
- Phase A2 (Portal Lifecycle): Complete - all Critical + High fixes applied
- Phase A3 (Navigation & Layout): Complete - all Critical + High fixes applied
- Remaining: Phase B (Vega), Phase C (Atrium), git push
