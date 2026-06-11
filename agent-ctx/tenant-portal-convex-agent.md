# Task: Build out the Residents' Portal with real Convex data connections

## Summary
Rewrote `/home/z/my-project/src/components/tenant/TenantPortal.tsx` to replace all hardcoded placeholder data with real Convex queries and mutations. Also added a new `getInboundMessagesByTenant` query to `convex/portals.ts`.

## Changes Made

### 1. `convex/portals.ts` — Added new query
- **`getInboundMessagesByTenant`** — Queries `atrium_inbound_messages` by `tenantId` index for the Messages tab

### 2. `src/components/tenant/TenantPortal.tsx` — Complete rewrite

#### Architecture
- 4 tabs: Ledger, Receipts, Maintenance, Messages (new)
- All data comes from real Convex queries using `useQuery` with proper `"skip"` patterns
- Mutations via `useMutation` for maintenance ticket creation

#### Financial Ledger Tab
- `useQuery(api.portals.getTenantLedger, { firmId, tenantId })` for ledger entries
- `useQuery(api.sentry.getServiceChargesByFirm, { firmId })` for service charges, filtered by tenantId
- Summary cards computed from real data: Current Month SC, Current Month MV, Outstanding Balance
- Service charges section shows SC/MV breakdown with status badges
- Ledger table shows period, type, amount, status (cleared/pending/defaulted), txHash
- Empty state: "No payment records found. Your property manager will add ledger entries as payments become due."

#### Receipts Tab
- Filters ledger entries where `status === "cleared"` to show as receipts
- Each receipt shows: date, amount, description, payment reference
- Download PDF button → toast "PDF generation coming soon"
- Empty state: "No receipts yet. Receipts will appear here after your payments are confirmed."

#### Maintenance Tab
- `useQuery(api.portals.getMaintenanceTicketsByTenant, { tenantId })` for existing tickets
- `useMutation(api.portals.createMaintenanceTicket)` for new ticket creation
- Form: Category (plumbing/electrical/structural/other), Subject, Description
- Auto-resolves propertyId from `coreState.properties` matching tenant's ID
- Loading state with `isSubmitting` flag
- Status badges: open (amber), in_progress (blue), resolved (green), closed (slate)
- Empty state: "No maintenance tickets"

#### Messages Tab (NEW)
- `useQuery(api.portals.getInboundMessagesByTenant, { tenantId })` for tenant messages
- Channel icons: WhatsApp (green SVG), Email (blue MailIcon), SMS (violet ChatIcon)
- Read/unread indicator (green dot + left border accent)
- Scrollable message list with `max-h-[60vh]`
- Empty state: "No messages from your property manager."

#### Design Patterns
- Feature gating preserved via `canUseTenantPortal` from `useFeatures()`
- Emerald/green colour scheme maintained
- Mobile-responsive (shorter tab labels on mobile, responsive padding)
- Trust badges at footer (Secure Portal, Payment Verified, Audit Trail)
- Loading skeleton states for all tabs
- Proper empty states for all tabs when queries return empty arrays

## Build Verification
- `npx vite build` — ✅ Built successfully in 12.44s
- No TypeScript errors in TenantPortal.tsx or portals.ts
