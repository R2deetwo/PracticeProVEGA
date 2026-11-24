/**
 * settingsSearch — pure nav quick-search for the Settings sidebar
 * (2026-11-25, Antigravity audit response: "Navigation Overload — over 18
 * settings sections in a single nested list, making it hard to locate
 * specific preferences").
 *
 * PURE module — no React imports — so the filter grammar is unit-testable
 * and reusable by any nav (settings, admin, drawer variants).
 *
 * Match rules (deliberate, deterministic):
 *   - empty / whitespace-only query → the groups pass through untouched;
 *   - a GROUP-level hit (label or description) keeps the group AND all of
 *     its children (the user searched for the group, not one panel);
 *   - a CHILD-only hit prunes the group to the matching children (the
 *     user searched for a specific panel);
 *   - matching is case-insensitive substring on trimmed input;
 *   - no hits → empty array (the caller renders the "no match" note).
 */

export interface SearchableChild {
  label: string;
}

export interface SearchableGroup<C extends SearchableChild> {
  label: string;
  description?: string;
  children: C[];
}

export function filterSettingsGroups<
  C extends SearchableChild,
  G extends SearchableGroup<C>,
>(groups: G[], rawQuery: string): G[] {
  const query = rawQuery.trim().toLowerCase();

  if (!query) return groups;

  const out: G[] = [];
  for (const group of groups) {
    const groupLabel = group.label.toLowerCase();
    const groupDescription = (group.description ?? "").toLowerCase();
    if (groupLabel.includes(query) || groupDescription.includes(query)) {
      // Group-level hit: keep the group with ALL of its children.
      out.push(group);
      continue;
    }
    const childHits = group.children.filter((child) =>
      child.label.toLowerCase().includes(query),
    );
    if (childHits.length > 0) {
      // Child-only hit: prune to the matching children.
      out.push({ ...group, children: childHits } as G);
    }
  }
  return out;
}

/** True when the query is active and produced zero groups (empty state). */
export function isSettingsSearchActive(query: string): boolean {
  return query.trim().length > 0;
}
