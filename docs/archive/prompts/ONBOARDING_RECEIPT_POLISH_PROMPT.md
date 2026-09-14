# PracticePro Onboarding & Receipt Polish — Implementation Prompt

## Context

PracticePro is a Nigerian legal + property management SaaS (Vega for law firms, Atrium for property managers, Komplete for both). The app has a "Getting Started" checklist sidebar widget and a Dashboard banner that guide new users through onboarding steps. It also has rent/service-charge payment logging with automatic receipt generation.

The current implementation has several UX and logic issues that make the app feel confusing and unwieldy for new users. This prompt specifies exactly what needs to be fixed and how.

## Problem Statement

Users testing the app report these issues:

1. **Checklist doesn't tick off** after completing an action (e.g., adding a resident to a unit doesn't check off "Add a resident to a unit").
2. **Highlighting is invisible** — clicking "Add a court date" navigates to Matters but doesn't highlight what to do next.
3. **"Add a resident"** navigates to the properties list but doesn't guide the user to open a property and edit a unit.
4. **Receipt failure shows conflicting states** — "receipt auto issuance failed" but then also says "automatically generated" and shows a "View" button.
5. **"View Receipt" goes to generic Messages page** instead of the specific receipt or conversation.
6. **Admin gets a firm notification** when they mark a payment — confusing self-notification.
7. **Management-only properties** — need to verify rent fields are hidden for all property/unit editing flows.

---

## Objective 1: Fix Reactive Checklist Updates

### Root Cause

The `getGettingStartedChecklist` query in `convex/myFunctions.ts` (line ~6449) uses `.first()` to check only the FIRST property/matter. If the user adds a tenant to a DIFFERENT property (not the first one in the DB), the check returns `false` and the checklist item never ticks off.

### Fix

**File:** `convex/myFunctions.ts` — function `getGettingStartedChecklist` (line ~6449)

Change the existence checks from `.first()` to `.take(N)` + filter, so ALL properties/matters are checked:

```typescript
// BEFORE (buggy — only checks first property):
const firstProperty = await ctx.db.query("properties")
  .withIndex("by_firm", (q) => q.eq("firmId", fid))
  .first();
const hasTenantOnProperty = firstProperty
  ? !!(firstProperty as any).rentalDetails?.tenantContactId
  : false;

// AFTER (correct — checks ALL properties):
const allProperties = await ctx.db.query("properties")
  .withIndex("by_firm", (q) => q.eq("firmId", fid))
  .take(500);
const hasTenantOnProperty = allProperties.some((p: any) =>
  !!(p.rentalDetails?.tenantContactId || p.rentalDetails?.tenantPhone)
);
```

Apply the same fix to:
- `hasCourtDateOnMatter` — check ALL matters, not just the first, for any with `nextAdjournedDate`, `nextCourtDate`, or `courtDate` set.
- `hasServiceCharge` — already uses `.first()` but should also check all properties.

### Verification

1. Add a tenant to the SECOND property (not the first) → checklist item "Add a resident to a unit" should tick off immediately.
2. Add a court date to any matter → "Add a court date" should tick off.

---

## Objective 2: Fix "Add a Court Date" Navigation & Highlighting

### Problem

"Add a court date" currently navigates to the Matters list page (`view: 'matters'`), but there's no visible highlight and no clear next step. The user doesn't know they need to:
1. Open a matter
2. Navigate to the matter's calendar/schedule tab
3. Add a court date event

### Fix

**Option A (Simpler — recommended):** Change the checklist item to be more achievable.

**File:** `src/components/GettingStartedChecklist.tsx`

Change the Vega checklist item from:
```typescript
{ key: 'hasCourtDateOnMatter', label: 'Add a court date', action: { kind: 'view', view: 'matters' } }
```
to:
```typescript
{ key: 'hasCourtDateOnMatter', label: 'Open a matter and add a court date', action: { kind: 'view', view: 'matters' }, hint: 'Open any matter → Schedule tab → Add court date.' }
```

This sets the expectation that it's a multi-step action, not a single click.

**Option B (More guided):** When the user clicks the checklist item, navigate to the matters page and show a tooltip popover explaining the steps:

1. Navigate to `matters` view with `context: { checklistAction: 'hasCourtDateOnMatter' }`
2. On the Matters page, read the `checklistAction` from `modalContext` and render a floating tooltip:
   ```
   "Step 1: Click any matter to open it.
    Step 2: Go to the Schedule tab.
    Step 3: Click 'Add Event' and set type to 'Court Date'."
   ```
3. The tooltip should be dismissable and should not reappear once the user opens a matter.

**File to modify for Option B:** `src/components/MatterList.tsx` — add a conditional tooltip that reads `modalContext?.checklistAction`.

### Fix Highlight Visibility

**File:** `src/hooks/useHighlight.ts`

The existing `useHighlight` hook applies a pulse animation. Verify:
1. The `animate-shimmer` CSS class exists in `src/index.css` (it should, but confirm).
2. The hook scrolls the target element into view before applying the animation.
3. The animation duration is long enough (currently 1500ms for shimmer — consider increasing to 3000ms).
4. If the target element has `data-item-id="checklist-cta-hasCourtDateOnMatter"`, it should be found and highlighted.

**File:** `src/components/MatterList.tsx`

The "New" button already has `data-item-id="checklist-cta-hasMatter"`. For "Add a court date", either:
- Add a separate `data-item-id="checklist-cta-hasCourtDateOnMatter"` to the same button (the user can create a matter first, then add a court date)
- OR change the action to open the first matter directly: `action: { kind: 'view', view: 'matterDetail', context: { initialTab: 'schedule_tasks' } }` — but this requires a matter to exist first (use prerequisite interception).

### Verification

1. Click "Add a court date" in the checklist → user lands on Matters page with a visible pulse ring on the "New" button.
2. If no matters exist → intercept with "No matters found — create your first matter before adding a court date."

---

## Objective 3: Fix "Add a Resident" Navigation

### Problem

"Add a resident to a unit" navigates to the Properties page, but the user doesn't know they need to:
1. Open a property
2. Edit a unit
3. Enter the tenant's name in the rental details

### Fix

**File:** `src/components/GettingStartedChecklist.tsx`

Update the Atrium checklist item:
```typescript
{ key: 'hasTenantOnProperty', label: 'Add a resident to a unit', action: { kind: 'view', view: 'properties' },
  hint: 'Open a property → edit a unit → enter the resident\'s name under Rental Details.' }
```

**File:** `src/components/PropertyManagerView.tsx`

When the user navigates to the Properties page from the checklist (detect via `modalContext?.checklistAction === 'hasTenantOnProperty'`):
1. Show a floating tooltip at the top: "Click a property to open it, then edit a unit and enter the resident's name."
2. If properties exist, highlight the first property card with a pulse ring.
3. If no properties exist, show the prerequisite interception toast (already implemented).

### Prerequisite Interception (already implemented — verify)

If the user clicks "Add a resident to a unit" but `hasProperty` is false:
- Show toast: "No properties found — add your first property before assigning residents."
- Toast includes a "Create Property" link that opens the `newProperty` modal.

### Verification

1. With no properties → click "Add a resident to a unit" → see "No properties found" toast with "Create Property" link.
2. With properties → click "Add a resident to a unit" → navigate to Properties page → see tooltip explaining next steps → first property card has pulse ring.
3. Open a property → edit a unit → enter resident name → save → checklist item ticks off.

---

## Objective 4: Fix Receipt Failure State & View Link

### Problem A: Conflicting Receipt States

When a service charge payment is logged, the `autoIssueReceipt` function in `src/components/details/ServiceChargeBars.tsx` (line ~752) calls `api.portals.sendPortalMessage`. If this fails, the UI shows "receipt auto issuance failed" but the button still says "automatically generated" and shows "View."

### Fix A

**File:** `src/components/details/ServiceChargeBars.tsx` — function `autoIssueReceipt` (line ~752)

Track the receipt issuance success/failure:

```typescript
const autoIssueReceipt = useCallback(async (period, chargeType, periodsKey) => {
  let receiptIssued = false;
  try {
    const receiptNumber = `RC-${Date.now().toString().slice(-6)}-${period.index}`;
    const receiptBody = generateReceiptBody(period, chargeType, unitName);

    // Try to send via portal
    await sendPortalMessage({
      firmId,
      senderId: currentUser.id,
      senderRole: 'admin',
      content: receiptBody,
      unitId: unit.id,
      // ...other args
    });

    // Persist receipt number to the period
    await onUpdate(updatedRental);
    receiptIssued = true;

    addToast(`Receipt ${receiptNumber} issued to resident.`, { type: 'success' });
  } catch (err) {
    console.error('[autoIssueReceipt] failed:', err);
    receiptIssued = false;
    addToast('Payment logged, but receipt could not be sent to the resident. You can generate it manually.', { type: 'warning', duration: 8000 });
  }

  // Only update the period's receiptNumber if issuance succeeded
  if (!receiptIssued) {
    // Do NOT set receiptNumber on the period — leave the button as "Generate Receipt"
    return;
  }
}, [/* deps */]);
```

**Key principle:** Only set `period.receiptNumber` if the portal message was actually sent. If it failed, leave the period without a receipt number so the button shows "Generate Receipt" (not "View Issued Receipt").

### Problem B: "View Receipt" Goes to Generic Messages

The notification created by `sendPortalMessage` links to `{ view: "messaging", initialTab: "inbox" }` — a generic messages page, not the specific conversation.

### Fix B

**File:** `convex/portals.ts` — function `sendPortalMessage` (line ~4172)

Change the notification link to include the conversation ID:

```typescript
// BEFORE:
link: { view: "messaging", initialTab: "inbox" },

// AFTER:
link: { view: "messaging", initialTab: "inbox", activeConversationId: conversation._id },
```

**File:** `src/components/MessagesView.tsx`

Read `activeConversationId` from the navigation context and auto-select that conversation:

```typescript
const { modalContext } = useUI();
useEffect(() => {
  if (modalContext?.activeConversationId) {
    setSelectedConversationId(modalContext.activeConversationId);
    // Optionally scroll to the specific receipt message
    if (modalContext?.highlightMessageId) {
      // Scroll to the message in the conversation
    }
  }
}, [modalContext]);
```

### Alternative: Dedicated Receipt View

Instead of routing to Messages, route to a dedicated receipt view:

**File:** `src/components/details/ReceiptDetailView.tsx` (may need to be created or enhanced)

Route the "View Receipt" button to:
```
navigateTo('receiptDetail', receiptDocId)
```

where `receiptDocId` is the ID of the receipt document saved in the `documents` table.

### Verification

1. Log a payment → receipt generation succeeds → success toast with "View Receipt" link → click → opens the specific receipt document (or the specific conversation, not generic messages).
2. Log a payment → receipt generation fails → warning toast (no success banner) → button still says "Generate Receipt" (not "View Issued Receipt") → click → opens ReceiptModal to retry.

---

## Objective 5: Suppress Admin Self-Notifications

### Root Cause

**File:** `convex/portals.ts` — function `sendPortalMessage` (line ~4160-4178)

When an admin sends a portal message (e.g., a receipt to a resident), the function calls `notifyFirmAdmins` at line 4167. This sends a "New portal message from {senderName}" notification to ALL firm admins — including the admin who just sent the message.

This is the self-notification bug: the admin marks a payment, the receipt is sent to the resident, and the admin gets a notification saying "New portal message from [yourself]."

### Fix

**File:** `convex/portals.ts` — function `sendPortalMessage` (line ~4160)

Skip the `notifyFirmAdmins` call when the sender IS an admin:

```typescript
// BEFORE (line ~4160-4178):
// Notify firm admins that a portal user sent a new message
try {
  await notifyFirmAdmins(ctx, {
    firmId: args.firmId,
    title: `New portal message from ${args.senderName || 'portal user'}`,
    message: `${args.senderName || 'A portal user'} sent: ${args.content.substring(0, 120)}...`,
    type: "portal_new_message",
    link: { view: "messaging", initialTab: "inbox" },
    actorName: args.senderName,
    actorEmail: args.senderEmail,
  });
} catch (err) {
  console.warn("[sendPortalMessage] Failed to notify admins:", (err as any)?.message);
}

// AFTER:
// Only notify firm admins when the message is FROM a portal user (Tenant/Client).
// When an admin sends a receipt or message TO a resident, the admin already knows
// they sent it — no self-notification needed.
if (!isAdminMessage) {
  try {
    await notifyFirmAdmins(ctx, {
      firmId: args.firmId,
      title: `New portal message from ${args.senderName || 'portal user'}`,
      message: `${args.senderName || 'A portal user'} sent: ${args.content.substring(0, 120)}...`,
      type: "portal_new_message",
      link: { view: "messaging", initialTab: "inbox", activeConversationId: conversation._id },
      actorName: args.senderName,
      actorEmail: args.senderEmail,
    });
  } catch (err) {
    console.warn("[sendPortalMessage] Failed to notify admins:", (err as any)?.message);
  }
}
```

The `isAdminMessage` variable is already computed at line ~4032:
```typescript
const isAdminMessage = args.senderRole === 'admin' || args.senderRole === 'Admin';
```

### Verification

1. Admin logs a payment → receipt sent to resident → admin does NOT receive a notification.
2. Resident sends a message via portal → admin DOES receive a notification.
3. Admin sends a manual message to resident → admin does NOT receive a self-notification.

---

## Objective 6: Verify Management-Only Unit Validation

### Current State

**File:** `src/components/forms/PropertyForm.tsx` (line ~1484)

When `rentCollectionMode === 'Management Only (No Rent)'`, the Rent Amount and Rent Frequency fields are hidden, replaced with an informational callout.

### What to Verify

1. **Property creation flow:** Create a new property → set Collection Mode to "Management Only (No Rent)" → verify Rent Amount and Rent Frequency fields are hidden.
2. **Property edit flow:** Edit an existing property → change Collection Mode to "Management Only" → verify rent fields disappear.
3. **Unit editing within a property:** Open a property → edit a unit → verify rent fields are hidden if the parent property is Management Only.
4. **Existing management-only properties:** Open a property that was already set to Management Only → verify rent fields are hidden on load.

### Additional Check

**File:** `src/components/details/PropertyDetailView.tsx`

Verify that management-only properties don't show:
- "Collect Rent" buttons
- Rent amount in StatCards
- Rent columns in unit tables

The existing `isManagementOnly` check is at line ~1750:
```typescript
const isManagementOnly = property.rentCollectionMode === 'Management Only (No Rent)';
```

Confirm this is applied consistently across all rent-related UI.

### Verification

1. Create a Management Only property → rent fields hidden ✓
2. Add a unit → no rent amount field ✓
3. Open property detail → no "Collect Rent" button ✓
4. Change back to "Full (Collect Rent)" → rent fields reappear ✓

---

## Objective 7: Overall Getting Started Polish

### Make the Checklist More Educational

**File:** `src/components/GettingStartedChecklist.tsx`

Each checklist item should have:
- A clear label (what to do)
- A hint (how to do it — which page/modal to open)
- A visible pulse ring on the target CTA after navigation
- A tooltip popover explaining the next step (for multi-step actions)

### Add Progress Celebration

When a checklist item is completed:
- Show a brief celebration toast: "✓ {item label} complete!"
- The checklist widget should update reactively (Convex query auto-invalidation)
- The progress bar should animate to the new percentage

**File:** `src/components/GettingStartedChecklist.tsx`

Add a `useEffect` that watches the checklist data and shows a toast when an item transitions from incomplete to complete:

```typescript
const prevChecklistRef = useRef(checklist);
useEffect(() => {
  if (!prevChecklistRef.current || !checklist) return;
  const prev = prevChecklistRef.current;
  for (const item of items) {
    const wasDone = (prev as any)[item.key] === true;
    const isDone = (checklist as any)[item.key] === true;
    if (!wasDone && isDone) {
      addToast(`✓ ${item.label} complete!`, { type: 'success', duration: 4000 });
    }
  }
  prevChecklistRef.current = checklist;
}, [checklist, items, addToast]);
```

### Improve the Dashboard Banner

**File:** `src/components/CompleteSetupBanner.tsx`

The "Continue Setup" button should:
1. Navigate to the right page
2. Set the highlight target
3. Show a tooltip explaining what to do

Same pattern as the checklist items.

---

## Summary of Files to Modify

| File | Changes |
|------|---------|
| `convex/myFunctions.ts` | Fix `getGettingStartedChecklist` to check ALL properties/matters, not just the first |
| `convex/portals.ts` | Skip `notifyFirmAdmins` when sender is admin; add `activeConversationId` to notification link |
| `src/components/GettingStartedChecklist.tsx` | Add hints to multi-step items; add completion celebration toast |
| `src/components/CompleteSetupBanner.tsx` | Same improvements as checklist |
| `src/components/details/ServiceChargeBars.tsx` | Track receipt issuance success/failure; don't set `receiptNumber` on failure |
| `src/components/details/PropertyDetailView.tsx` | Verify management-only gates are consistent |
| `src/components/MatterList.tsx` | Add tooltip for checklist action; verify highlight works |
| `src/components/PropertyManagerView.tsx` | Add tooltip for checklist action; highlight first property card |
| `src/components/MessagesView.tsx` | Read `activeConversationId` from context and auto-select conversation |
| `src/hooks/useHighlight.ts` | Verify shimmer animation is visible; increase duration to 3000ms |

---

## Verification Checklist

1. [ ] Adding a resident to ANY property (not just the first) ticks off "Add a resident to a unit."
2. [ ] Adding a court date to ANY matter ticks off "Add a court date."
3. [ ] Clicking "Add a court date" shows a tooltip or hint explaining it's a multi-step action.
4. [ ] Clicking "Add a resident to a unit" with no properties shows the "Create Property" interception toast.
5. [ ] Clicking "Add a resident to a unit" with properties navigates to Properties and highlights the first card.
6. [ ] The highlight ring (shimmer animation) is clearly visible on target CTAs.
7. [ ] When receipt generation fails, no "View Issued Receipt" button appears — only "Generate Receipt."
8. [ ] When receipt generation succeeds, "View Receipt" navigates to the specific receipt or conversation, not generic Messages.
9. [ ] Admin does NOT receive a firm notification when they log a payment or send a receipt.
10. [ ] Admin DOES receive a notification when a resident sends a portal message.
11. [ ] Management-only properties hide rent fields in the unit creation/editing modal.
12. [ ] Completing a checklist item shows a celebration toast: "✓ {item} complete!"
13. [ ] The checklist progress bar animates smoothly when an item is completed.
14. [ ] The Dashboard banner "Continue Setup" button navigates and highlights the right CTA.

---

## Technical Notes

- **Convex reactivity:** Convex queries auto-invalidate when underlying data changes. If the checklist doesn't update after an action, verify the mutation actually writes to the `properties`/`matters`/`contacts` table (not just local state).
- **useHighlight hook:** Located at `src/hooks/useHighlight.ts`. It finds elements by `data-item-id` attribute and applies a pulse animation. The `shimmer` color variant uses the `animate-shimmer` CSS class.
- **Notification link structure:** `{ view: View, initialTab: string, activeConversationId?: string }` — the `activeConversationId` tells MessagesView which conversation to auto-select.
- **Management-only check:** `property.rentCollectionMode === 'Management Only (No Rent)'` — this is the Property-level field. There is no per-unit `managementType` field; the property-level setting applies to all units.
