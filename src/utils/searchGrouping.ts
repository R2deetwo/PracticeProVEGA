/**
 * searchGrouping — the pure projection of searchAll results into the
 * grouped shape FullScreenSearch renders (K-1, KOMPLETE unified-product
 * integrity).
 *
 * Extracted from the component so the grouping (categories, counts,
 * per-type ordering) is unit-testable: the mobile search previously
 * omitted properties entirely and had no error/empty contract. The
 * desktop CommandPalette covers the same five categories client-side;
 * this projection keeps mobile and desktop consistent.
 */

export type SearchResultType = 'Matter' | 'Contact' | 'Document' | 'Task' | 'Property';

export interface ServerSearchResult {
    matters: { id: string; title: string; suitNumber?: string }[];
    contacts: { id: string; name: string; email?: string }[];
    documents: { id: string; title: string }[];
    tasks: { id: string; title: string }[];
    properties: { id: string; address: string; status?: string }[];
}

export interface GroupedSearchResults {
    grouped: Record<SearchResultType, { id: string; label: string; subtitle?: string }[]>;
    totalCount: number;
}

/**
 * Group a searchAll response into display rows per category.
 * Empty/missing keys are tolerated (the server guarantees the five keys,
 * but legacy cached responses may predate the properties key).
 */
export function groupServerResults(
    server: ServerSearchResult | null | undefined
): GroupedSearchResults | null {
    if (!server) return null;

    const grouped: GroupedSearchResults['grouped'] = {
        Matter: (server.matters || []).map((m) => ({
            id: m.id,
            label: m.title || 'Untitled matter',
            subtitle: m.suitNumber,
        })),
        Property: (server.properties || []).map((p) => ({
            id: p.id,
            label: p.address || 'Unnamed property',
            subtitle: p.status,
        })),
        Contact: (server.contacts || []).map((c) => ({
            id: c.id,
            label: c.name || 'Unnamed contact',
            subtitle: c.email,
        })),
        Document: (server.documents || []).map((d) => ({
            id: d.id,
            label: d.title || 'Untitled document',
        })),
        Task: (server.tasks || []).map((t) => ({
            id: t.id,
            label: t.title || 'Untitled task',
        })),
    };

    const totalCount = Object.values(grouped).reduce((n, rows) => n + rows.length, 0);
    return { grouped, totalCount };
}

/** The navigation target for a result row — one place, so every result
 *  type lands on the correct underlying product surface. */
export function searchResultDestination(
    dataType: SearchResultType,
    id: string
): { view: string; id: string | null; modal?: string } {
    switch (dataType) {
        case 'Matter': return { view: 'matterDetail', id };
        case 'Property': return { view: 'propertyDetail', id };
        case 'Contact': return { view: 'contactDetail', id };
        case 'Document': return { view: 'documentDetail', id };
        case 'Task': return { view: 'tasks', id: null, modal: 'viewTask' };
    }
}
