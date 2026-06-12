# Task 2 — Fix Portal Name Mismatch Bug

## Summary
Fixed the portal name mismatch where tenant names could differ between the portal invite, the users table, and the property/tenancy record. The property/tenancy record is now enforced as the single source of truth for tenant names.

## Files Modified
1. `convex/portals.ts` — Backend fixes for createPortalInvite, setupPortalPassword, and getTenantInfo
2. `src/components/settings/PortalAccessSettings.tsx` — Frontend invite form auto-fill and read-only enforcement
3. `src/components/tenant/TenantPortal.tsx` — Display tenant name from property record

## Key Changes
- `createPortalInvite`: Resolves canonical tenant name from property record before creating invite
- `setupPortalPassword`: Syncs user name with property record's tenant name on both create and update
- `getTenantInfo`: Returns `tenantName` from property/unit record for portal display
- `PortalAccessSettings`: Name field is read-only when auto-filled from tenant record, with visual indicator
- `TenantPortal`: Displays `tenantInfo?.tenantName` instead of `currentUser.name`

## Status: COMPLETED
