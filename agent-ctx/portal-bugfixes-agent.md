# Portal System Bug Fixes

## Task: Fix critical bugs in the portal system (3 fixes)

### Fix 1: Data Linkage (Portal user -> Tenant -> Unit -> Property)

**Problem**: When a portal user (Tenant role) logs in and tries to submit a maintenance ticket, they get "not linked to a property" because `getTenantInfo` can't find the property/unit assignment.

**Root Cause**: `setupPortalPassword` action creates a user but doesn't update the property's unit record to point `currentTenantId`/`tenantId` to the new user's Convex `_id`.

**Changes made**:

1. **`convex/portals.ts`** - Added `internalQuery` and `internalMutation` to imports
2. **`convex/portals.ts`** - Added `findPropertyByCustomId` internal query to find properties by custom ID or Convex _id
3. **`convex/portals.ts`** - Added `linkPortalUserToProperty` internal mutation to update property tenant info
4. **`convex/portals.ts`** - Modified `setupPortalPassword` action:
   - Track `portalUserDocId` (the new/existing user's Convex _id)
   - After user creation/update, add step 3.5 that links portal user to property/unit
   - Parse `relatedId` format (`propertyId_unitId` or just `propertyId`)
   - Find property using internal query (actions can't use ctx.db directly)
   - Update unit's `currentTenantId`, `tenantId`, `tenantEmail`, `tenantName` for multi-unit properties
   - Update property-level `currentTenantId`/`tenantId` for single properties
   - Non-blocking: if linking fails, user can still access portal (email fallback in getTenantInfo)

### Fix 1b: Improved getTenantInfo email matching

**Problem**: `getTenantInfo` only matched by `unitTenantId` but not by `unit.tenantEmail`, which is stored when the unit is linked.

**Changes made**:

1. **`convex/portals.ts`** - In `getTenantInfo` query, restructured unit-level matching:
   - Added `unitTenantEmail` matching against `unit.tenantEmail`
   - Split logic into `matchesUserId` and `matchesEmail` for clarity
   - Now matches when `unitTenantEmail` equals the user's email (case-insensitive)

### Fix 2: Session Conflict (Portal vs App on Same Browser)

**Problem**: Both portal and app sessions share the same localStorage key `practicepro_user_session`. Logging into one overwrites the other.

**Changes made**:

1. **`src/contexts/AuthContext.tsx`**:
   - Added `PORTAL_SESSION_KEY = 'practicepro_portal_session'` constant
   - Added `isPortalRoute()` helper to detect portal routes
   - Updated `getInitialToken()`:
     - If on portal route, prioritize portal session (sessionStorage then localStorage)
     - Then check app session keys
     - Fallback: check portal session even if not on portal route
   - Updated `login()` function:
     - Detect portal context (via `practicepro_portal_type` or URL path)
     - Store in `PORTAL_SESSION_KEY` for portal users, `LOCAL_STORAGE_USER_KEY` for app users
     - Clear the other session type to prevent conflict
   - Updated `logout()` function:
     - Clear both `LOCAL_STORAGE_USER_KEY` and `PORTAL_SESSION_KEY` from both sessionStorage and localStorage
   - Updated safety timeout:
     - Also clear `PORTAL_SESSION_KEY` when session times out

### Fix 3: Session Persistence on Refresh

**Problem**: Portal users get kicked to landing page on refresh because the portal remember check only looks at `practicepro_portal_type` and has a 10s timeout.

**Changes made**:

1. **`src/components/App.tsx`**:
   - Extended `hasRememberedPortal` check to also look for `practicepro_portal_session` in both sessionStorage and localStorage
   - Increased timeout from 10s to 15s to give more time for session restoration

## Files Modified

1. `/home/z/my-project/convex/portals.ts` - Property/unit linking + getTenantInfo email matching
2. `/home/z/my-project/src/contexts/AuthContext.tsx` - Separate portal session keys
3. `/home/z/my-project/src/components/App.tsx` - Portal session persistence on refresh
