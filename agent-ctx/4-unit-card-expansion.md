# Task 4: Fix Unit Card Expansion Behavior on Mobile

## Agent: Main Agent

## Summary
Fixed the unit card expansion behavior in PropertyDetailView.tsx so that when a unit card is tapped, it expands IN PLACE instead of injecting a separate expansion panel after the current row. This ensures users on mobile can immediately see the expanded content without scrolling.

## Changes Made
- **File**: `/home/z/my-project/src/components/details/PropertyDetailView.tsx`
- **Lines affected**: ~873-1386 (previously ~873-1460, net reduction of ~74 lines)

### Key Changes:
1. Removed row-based grouping logic (COLS_XL, rows[], selectedRowIdx, rows.flatMap)
2. Changed from `rows.flatMap()` to direct `units.map()` rendering
3. Each card is now self-contained with inline expanded content (rendered within the card div when `isSelected`)
4. Added `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` via ref callback when card expands
5. Added `transition-all duration-300 ease-in-out` CSS for smooth padding/style transitions
6. Expanded card spans all grid columns: `col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4`
7. Moved handler functions (handleWhatsApp, handleEmailTenant, etc.) to per-card scope
8. Added `e.stopPropagation()` to all action buttons in the expanded view
9. Removed the `expansionPanel` variable and the `[...cards, expansionPanel]` injection pattern

### Preserved Functionality:
- Edit Unit button → openModal('editProperty')
- Record Payment button → openModal('collectRent')
- Legal/Management File button → handleInitializeMatter()
- Message Tenant toggle → setShowUnitMessaging()
- WhatsApp (gated by Growth+/KOMPLETE), Email, Call, Portal, Compose buttons
- Close button (X icon) → setSelectedUnit(null)
- Remove Unit button → handleRemoveUnit()
- All metadata: tenant name, rent, lease end, phone, email, service charge, outstanding balance, legal fee, agency fee, caution deposit, term progress

## Verification:
- Brace count balanced: 704 open / 704 close
- File compiles (pre-existing type errors unrelated to changes)
- All structural elements verified present: scrollIntoView, animate-fade-in, col-span, transition, no rows.flatMap, no expansionPanel, no selectedRowIdx
