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
