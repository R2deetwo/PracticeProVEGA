---
name: Unit array deep-merge fix
description: Why and how the updateItem optimistic updater must deep-merge the embedded `units` array instead of replacing it.
---

## Rule
When `updateItem('properties', item)` is called and `item.units` is an array, the optimistic update must **map over the existing units and replace only the matching unit by ID**, not replace the whole array.

**Why:** The old code did `{ ...existingItem, ...item }` — if `item` only carried one unit (e.g. a single edited unit), the spread replaced the entire `units` array, causing all other units to disappear from the UI until Convex re-synced.

**How to apply:** In `DataProvider.tsx` `baseActions.updateItem`, after computing `merged = { ...i, ...item }`, if both `i.units` and `item.units` are non-empty arrays, overwrite `merged.units` with:
```ts
merged.units = i.units.map(eu => {
  const uid = eu.id || eu._id;
  const updated = item.units.find(u => (u.id || u._id) === uid);
  return updated ? { ...eu, ...updated } : eu;
});
// also append genuinely new units
item.units.forEach(u => { if (!i.units.find(eu => (eu.id||eu._id) === (u.id||u._id))) merged.units.push(u); });
```
