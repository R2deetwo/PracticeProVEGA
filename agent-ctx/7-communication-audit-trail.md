# Task 7: Communication Audit Trail & Print Functionality

## Agent: Communication Audit Trail Agent

## Summary
Added comprehensive communication audit trail and print functionality to the PracticePro Atrium app.

## Changes Made

### 1. Schema (`convex/schema.ts`)
- Added `messageContent`, `direction` (outbound/inbound), `senderName` fields to `automation_logs` table
- Added `portal` as valid channel in both `automation_logs` and `atrium_inbound_messages`
- Added `by_firm_channel` index to both tables

### 2. Backend (`convex/sentry.ts`)
- Extended `logAutomation` mutation with `messageContent`, `direction`, `senderName` args
- Added `getAuditTrail` query — merges outbound + inbound comms into chronological timeline with filters (unitId, tenantId, channel, messageType, dateRange)
- Added `getCommunicationsForPrint` query — returns full detail for A4 printing
- Exported `AuditTrailEntry` TypeScript interface

### 3. Types (`src/types.ts`)
- Extended `AutomationLog` with `messageContent`, `direction`, `senderName`
- Added `AuditTrailEntry` interface

### 4. ComposeModal (`src/components/atrium/ComposeModal.tsx`)
- `logAuto` now stores: `messagePreview` (truncated 200 chars), `messageContent` (full), `direction: 'outbound'`, `senderName`

### 5. New Component: CommunicationPrintView (`src/components/atrium/CommunicationPrintView.tsx`)
- Professional print-friendly modal with firm letterhead
- Chronological timeline with direction indicators
- A4-formatted with `window.print()` support
- Close and Print buttons

### 6. AtriumInbox (`src/components/atrium/AtriumInbox.tsx`)
- Added Inbox/Audit Trail sub-tab navigation
- Added "Print" button in header
- Added per-tenant print button in thread detail
- Audit Trail section with expandable filters (channel, message type, date range)
- Chronological timeline with date separators and direction indicators
- Per-entry print button

### 7. CSS (`src/index.css`)
- `@media print` styles for A4 page setup
- Print-content class styling, page-break-avoid for entries
- Letterhead formatting, overlay cleanup

## Files Modified
- `convex/schema.ts`
- `convex/sentry.ts`
- `src/types.ts`
- `src/components/atrium/ComposeModal.tsx`
- `src/components/atrium/AtriumInbox.tsx`
- `src/index.css`

## Files Created
- `src/components/atrium/CommunicationPrintView.tsx`
