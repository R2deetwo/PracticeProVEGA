# ComposeModal Revamp — Work Record

## Task ID: composemodal-revamp
## Agent: Main Agent
## Date: 2026-03-04

## Summary
Revamped the Atrium ComposeModal component from a cluttered 8+ field form to a streamlined two-mode design with multi-recipient support, proper unit/tenant display, and an upcoming messages panel.

## Changes Made

### File: `/home/z/my-project/src/components/atrium/ComposeModal.tsx`

**Preserved (unchanged):**
- `buildMessage` function — exact copy, all template logic preserved
- `ComposeModalPrefill` interface — all fields kept
- Helper functions (`formatNumberWithCommas`, `parseFormattedNumber`)
- Constants (`MSG_TYPE_LABELS`, `MSG_TYPE_ICONS`, `CHANNEL_COLORS`)
- Custom SVG icons (`SendIcon`, `EyeIcon`, `ZapIcon`)

**New features implemented:**

1. **Two-mode design (Quick Compose / Detailed):**
   - Default view shows 3 fields: Message Type, Channel (as button group), and Recipients (multi-select)
   - Financial fields (Rent, SC, Caution Deposit, Legal Fee, Agency Fee, Due Date) are hidden behind a collapsible "Show Financial Details" toggle
   - Message Content textarea always visible

2. **Multi-recipient support:**
   - Replaced single `unitId` dropdown with `selectedRecipientIds: string[]` state
   - Multi-select chip input: search dropdown + removable chips
   - Each chip shows "Unit X — Tenant Name" with × to remove
   - "Select All Tenanted" / "Deselect All" button
   - Bulk send: loops through each recipient with personalized messages
   - Multi-recipient preview shows first 3 messages with "+ N more" indicator
   - Warning badge: "Bulk send: each recipient gets a personalized message"

3. **Fixed dropdown display:**
   - Old: `units.map(u => <option>{u.label}</option>)` where `u.label = p.address`
   - New: `selectableRecipients` useMemo extracts:
     - Multi-unit properties: "Unit {unitName} — {tenantName}" per unit
     - Single-tenant: "{address first line} — {tenantName}"
     - No "All / General" option — replaced by "Select All Tenanted" button
   - Each recipient includes tenantPhone, tenantEmail, rentAmount, and all financial fields

4. **Upcoming Messages panel:**
   - Collapsible section below compose form
   - Fetches from `automation_logs` via `convex.query(api.sentry.getAutomationLogs)`
   - Shows: message type icon, channel badge, type label, sent date, status badge
   - "Scheduled message queue coming soon" note displayed
   - Loading and empty states handled

5. **Channel selector redesigned:**
   - Changed from dropdown to button group (📱 WA / ✉️ Email / 💬 SMS)
   - Channel color badges applied to active button

6. **Preview step enhanced:**
   - Multi-recipient: shows summary box with recipient chips + first 3 personalized messages
   - Single recipient: shows full message preview (same as before)
   - Send button shows count: "Confirm & Send (5)"
   - Toast summary: "3 message(s) logged (channel not configured). 3 simulated."

## Build Verification
- `npx vite build` compiles successfully with no TypeScript errors
- All existing imports and exports preserved
- `ComposeModalPrefill` and `buildMessage` still exported for use by `AtriumInbox` and `AutomationCenter`
