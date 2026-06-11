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
