/**
 * listControls — ROUND E (Wave E4): the pure list brain behind the property
 * and resident consoles' search / sort / pagination.
 * ─────────────────────────────────────────────────────────────────────────
 * The owner brief (§5) asks for search, sort/filter and pagination across
 * the property and resident surfaces. Search existed (both consoles) but
 * sort and pagination did not — every console rendered the ENTIRE filtered
 * roster in insertion order. This module is the shared, framework-free
 * engine both consoles now run:
 *
 *   applyListControls(rows, {
 *     search,        // case-insensitive substring across searchFields
 *     searchFields,  // (row) => string[] — which fields the search reads
 *     filter,        // predicate for status/class chips
 *     sortKey,       // field selector (row) => value
 *     sortDir,       // 'asc' | 'desc'
 *     page,          // 1-based; out-of-range pages clamp to the last page
 *     pageSize,      // rows per page; 0/falsy = all rows (single page)
 *   })
 *
 * Sorting rules (pinned by tests/unit/roundEWave4.test.ts):
 *   - STABLE: rows with equal keys keep their input order (Array.prototype
 *     sort is stable in every engine this app runs on).
 *   - NULLS LAST: a missing sort value sorts to the end in BOTH directions
 *     — a resident with no lease end is "unknown", not "the earliest lease
 *     in history".
 *   - TYPE-AWARE: numbers compare numerically (₦500,000 after ₦90,000),
 *     everything else compares case-insensitively as a string. ISO dates
 *     (YYYY-MM-DD) compare correctly as strings by construction.
 *
 * Pure on purpose: no React, no hooks — the consoles own the state, this
 * module owns the math, and every branch is directly testable.
 */

export type SortDirection = 'asc' | 'desc';

export interface ListControls<T> {
    /** Case-insensitive substring search across `searchFields` results. */
    search?: string;
    /** The fields the search reads (returning [] matches nothing). */
    searchFields?: (row: T) => string[];
    /** Extra predicate (status chips etc.) applied BEFORE search. */
    filter?: (row: T) => boolean;
    /** Value selector for the active sort. */
    sortKey?: (row: T) => unknown;
    sortDir?: SortDirection;
    /** 1-based page number; values past the end clamp to the last page. */
    page?: number;
    /** Rows per page. 0 / undefined = everything on one page. */
    pageSize?: number;
}

export interface ListControlsResult<T> {
    /** Rows after filter + search (before pagination) — used for counts. */
    searchMatched: number;
    /** Total filtered rows (same as searchMatched when no search). */
    total: number;
    /** Number of pages (>= 1 when there are rows; 0 for an empty roster). */
    pageCount: number;
    /** The clamped 1-based page actually rendered. */
    page: number;
    /** Index (1-based, inclusive) of the first row on the page. */
    from: number;
    /** Index (1-based, inclusive) of the last row on the page. */
    to: number;
    /** The sorted, paginated slice to render. */
    pageRows: T[];
}

/** Null-aware value comparison: nulls/undefined always sort LAST. */
function compareValues(a: unknown, b: unknown, dir: SortDirection): number {
    const aEmpty = a === null || a === undefined || (typeof a === 'string' && a.trim() === '');
    const bEmpty = b === null || b === undefined || (typeof b === 'string' && b.trim() === '');
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1; // nulls last, regardless of direction
    if (bEmpty) return -1;

    let cmp: number;
    if (typeof a === 'number' && typeof b === 'number') {
        cmp = a - b;
    } else {
        const sa = String(a).toLowerCase();
        const sb = String(b).toLowerCase();
        cmp = sa < sb ? -1 : sa > sb ? 1 : 0;
    }
    return dir === 'desc' ? -cmp : cmp;
}

/**
 * Sort rows stably by `sortKey` in `sortDir`, nulls last. Exported for
 * direct testing and for consoles that sort without paginating.
 */
export function sortRows<T>(rows: T[], sortKey: (row: T) => unknown, sortDir: SortDirection): T[] {
    return [...rows].sort((a, b) => compareValues(sortKey(a), sortKey(b), sortDir));
}

/** Case-insensitive multi-field substring match. Empty query matches all. */
export function matchesSearch<T>(row: T, search: string | undefined, searchFields: (row: T) => string[]): boolean {
    const q = String(search ?? '').trim().toLowerCase();
    if (!q) return true;
    return searchFields(row).some((f) => String(f ?? '').toLowerCase().includes(q));
}

/**
 * Filter → search → sort → paginate. Every stage is optional; omitting
 * `pageSize` returns the whole (possibly sorted) roster on page 1.
 */
export function applyListControls<T>(rows: T[], controls: ListControls<T>): ListControlsResult<T> {
    const { search, searchFields, filter, sortKey, sortDir = 'asc', page, pageSize } = controls;

    // 1. Class/status filter (chips, presets).
    let working = filter ? rows.filter(filter) : rows;

    // 2. Search across the caller's fields.
    if (searchFields) {
        working = working.filter((row) => matchesSearch(row, search, searchFields));
    }
    const total = working.length;

    // 3. Stable sort, nulls last.
    if (sortKey) {
        working = sortRows(working, sortKey, sortDir);
    }

    // 4. Pagination (clamped 1-based pages; pageSize 0/undefined = all).
    const size = Math.max(0, Math.floor(pageSize ?? 0));
    if (size === 0) {
        return {
            searchMatched: total,
            total,
            pageCount: total > 0 ? 1 : 0,
            page: 1,
            from: total > 0 ? 1 : 0,
            to: total,
            pageRows: working,
        };
    }

    const pageCount = Math.max(total > 0 ? 1 : 0, Math.ceil(total / size));
    const requested = Math.floor(page ?? 1);
    const clamped = Math.min(Math.max(1, requested), pageCount);
    const from = (clamped - 1) * size;
    const pageRows = working.slice(from, from + size);

    return {
        searchMatched: total,
        total,
        pageCount,
        page: clamped,
        from: total > 0 ? from + 1 : 0,
        to: Math.min(from + size, total),
        pageRows,
    };
}
