# Task 8: Portal Documents, Agreements, and Consents

## Summary
Added the ability for portal users (both Client and Tenant) to view and print their agreements, consents, and documentation.

## Changes Made

### 1. `convex/portals.ts` — New Queries
- **`getTenantDocuments`** — Returns documents shared with a tenant's property by looking up the tenant's assigned properties/units and finding documents linked to the property's matterId.
- **`getPortalUserConsentRecords`** — Returns consent/acceptance records for a portal user by querying `portal_invites` for accepted invites with `termsAcceptedAt`.
- **`getTenantLeaseDetails`** — Returns lease/rental details for a tenant's property, pulling from the `properties` table (rentalDetails, unitDetails) and `tenancies` table.
- **`getClientConsentRecords`** — Returns consent/acceptance records for a client portal user (same data as getPortalUserConsentRecords, named separately for semantic clarity).

### 2. `src/components/tenant/TenantPortal.tsx` — New Documents Tab
- Added `'documents'` to the `TabId` type union
- Added "Documents" tab to the tab bar with a DocumentIcon
- Created `DocumentsTab` component with four sections:
  - **Lease Agreement** — Shows property/unit details, rent amount, lease dates with a "Print" button that generates a professional print-ready HTML document
  - **Terms & Consents** — Shows accepted terms with acceptance date from `portal_invites.termsAcceptedAt` with a "Print" button
  - **Shared Documents** — Shows documents linked to the tenant's matters with "View" and "Print" buttons
  - **Payment Proofs** — Shows submitted payment proofs with status badges and "Print" button
- Added local icons: `PrinterIcon`, `FolderOpenIcon`, `ShieldCheckIcon`
- All print functionality uses `window.open()` with professional HTML templates including `@media print` CSS and a print button

### 3. `src/components/client/ClientDashboard.tsx` — Enhanced Documents Tab
- Added `clientConsentRecords` query using `api.portals.getClientConsentRecords`
- Added **Terms & Consents** section to the Documents tab showing:
  - Portal type (Client/Resident)
  - Terms acceptance date
  - Acceptance status badge
  - "Print" button for each consent record
- Added **Print** button to each shared document in the document list
- Split the documents tab into clearly labeled sections: "Terms & Consents" and "Shared Documents"
- Print functionality generates professional print-ready HTML with PracticePro VEGA branding

### 4. `src/index.css` — Print Styles
- Added `@media print` CSS rules:
  - Hides nav, buttons, and `.no-print` elements
  - Forces white background and dark text
  - Removes shadows for cleaner print output
  - Shows link URLs inline
  - Adds `.print-no-break` utility class

## Key Design Decisions
- Print views open in a new browser window with `window.open()` for maximum compatibility and user control
- Each print template includes a floating "Print" button that hides via `@media print` CSS
- Professional branding (PracticePro ATRIUM for tenants, PracticePro VEGA for clients) on all print outputs
- All print templates include NDPA 2023 compliance footer
- Lease details pull from both `properties.rentalDetails` and `tenancies` table for comprehensive coverage
- Consent records come from `portal_invites.termsAcceptedAt` which is set when a user accepts their portal invite

## Files Modified
1. `/home/z/my-project/convex/portals.ts` — Added 4 new queries
2. `/home/z/my-project/src/components/tenant/TenantPortal.tsx` — Added Documents tab with 4 sections
3. `/home/z/my-project/src/components/client/ClientDashboard.tsx` — Enhanced documents tab with consents and print
4. `/home/z/my-project/src/index.css` — Added print styles
