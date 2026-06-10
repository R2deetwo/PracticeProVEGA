---
name: Unit add/remove Convex mutations
description: Dedicated Convex mutations for adding and removing embedded units from a property record; never use generic updateItem for this.
---

## Rule
Use `addUnitToProperty` and `removeUnitFromProperty` (in `convex/myFunctions.ts`) instead of `updateItemMutation` for changes to a property's embedded `units` array.

**Why:** The generic `updateItem` Convex mutation replaces the full record on the server. If the client only sends one unit in `item.units`, the server-side record loses all other units permanently (not just optimistically). Dedicated patch mutations avoid this by only touching the `units` field.

**How to apply:**
- Frontend: `baseActions.addUnit(propertyId, unitData)` / `baseActions.removeUnit(propertyId, unitId)` in `DataProvider.tsx`.
- Backend: Both mutations look up the property by custom `id` index fallback, patch `units` array and `numberOfUnits` atomically.
- Optimistic update: directly mutate `appState.properties[matching].units` in a `setAppState` call before awaiting the Convex mutation; rollback on error.
