/**
 * kompleteSearch.test.ts — the K-1 mobile-search contract (source-scanned
 * where the code needs the Convex runtime, pure where it does not).
 *
 * Covers the required test list:
 *   5. Mobile search — the bearer is forwarded; loading / empty / error /
 *      permission-denied states exist; properties render and navigate.
 *   6. Property search results — searchAll searches properties by address
 *      for property-capable firms, server-side.
 *   7. Cross-firm search isolation — firmId comes from the verified
 *      session, every category filters on it, and the product scope is
 *      derived from the FIRM RECORD (never caller input).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    groupServerResults,
    searchResultDestination,
} from '../../src/utils/searchGrouping';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolve(here, '../../convex/search.ts'))
    ? resolve(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

const SEARCH_BACKEND = 'convex/search.ts';
const MOBILE_UI = 'src/components/FullScreenSearch.tsx';
const SCHEMA = 'convex/schema.ts';

describe('5. Mobile search — the bearer fix and the honest states', () => {
    const ui = read(MOBILE_UI);

    it('forwards the session bearer on the searchAll query (the infinite "Searching…" fix)', () => {
        // The old query passed { userEmail, query } only — requireFirmUser
        // rejected every call ("a verified session is required") and the
        // UI hung on "Searching…" forever.
        expect(ui).toContain('sessionToken: bearerToken ?? undefined');
    });

    it('does not throw on query errors (loading/error/empty are rendered, not crashed)', () => {
        expect(ui).toContain('throwOnError: false');
        expect(ui).toContain("queryState.status === 'pending'");
        expect(ui).toContain("queryState.status === 'error'");
    });

    it('renders the permission-denied / session-expired guidance from the server message', () => {
        // requireFirmUser's rejections: invalid session, portal users.
        expect(ui).toMatch(/session|sign in|Unauthenticated|Portal users/i);
    });

    it('renders an explicit empty state', () => {
        expect(ui).toContain('No results found');
    });

    it('uses the object-form query hook (the error contract depends on it)', () => {
        expect(ui).toContain('useQuery_experimental');
    });
});

describe('6. Property search results — server-side, product-scoped', () => {
    const backend = read(SEARCH_BACKEND);
    const schema = read(SCHEMA);

    it('the properties table has the search index the query needs', () => {
        expect(schema).toContain('.searchIndex("search_address", { searchField: "address" })');
    });

    it('searchAll queries properties by address', () => {
        expect(backend).toContain('query("properties")');
        expect(backend).toContain('withSearchIndex("search_address"');
    });

    it('property results are returned in the stable response shape', () => {
        // The properties key is ALWAYS present (empty array for legal-only
        // firms) so clients can rely on the shape.
        expect(backend).toContain('properties: [] }');
        expect(backend).toMatch(/properties: properties\.map/);
    });

    it('the property capability check covers every accepted product spelling', () => {
        expect(backend).toContain("p === \"property\" || p === \"atrium\" || p === \"unified\" || p === \"komplete\" || p === \"sentry\"");
    });

    it('groupServerResults projects properties with address + status', () => {
        const grouped = groupServerResults({
            matters: [],
            contacts: [],
            documents: [],
            tasks: [],
            properties: [{ id: 'p1', address: '12 Admiralty Way, Lekki', status: 'Occupied' }],
        });
        expect(grouped?.grouped.Property).toHaveLength(1);
        expect(grouped?.grouped.Property[0]).toMatchObject({
            id: 'p1',
            label: '12 Admiralty Way, Lekki',
            subtitle: 'Occupied',
        });
        expect(grouped?.totalCount).toBe(1);
    });

    it('a property result navigates to the property detail surface', () => {
        expect(searchResultDestination('Property', 'p1')).toEqual({ view: 'propertyDetail', id: 'p1' });
    });

    it('every other category still groups and navigates (nothing was dropped)', () => {
        const grouped = groupServerResults({
            matters: [{ id: 'm1', title: 'Recovery suit', suitNumber: 'FHC/L/CS/1/2025' }],
            contacts: [{ id: 'c1', name: 'Adaeze', email: 'a@x.ng' }],
            documents: [{ id: 'd1', title: 'Pleading' }],
            tasks: [{ id: 't1', title: 'File motion' }],
            properties: [],
        });
        expect(grouped?.totalCount).toBe(4);
        expect(grouped?.grouped.Matter[0].subtitle).toBe('FHC/L/CS/1/2025');
        expect(searchResultDestination('Matter', 'm1').view).toBe('matterDetail');
        expect(searchResultDestination('Contact', 'c1').view).toBe('contactDetail');
        expect(searchResultDestination('Document', 'd1').view).toBe('documentDetail');
        expect(searchResultDestination('Task', 't1')).toEqual({ view: 'tasks', id: null, modal: 'viewTask' });
    });

    it('null/undefined results and missing keys are tolerated', () => {
        expect(groupServerResults(null)).toBeNull();
        expect(groupServerResults(undefined)).toBeNull();
        // A legacy cached response without the properties key still groups.
        const legacy = groupServerResults({
            matters: [], contacts: [], documents: [], tasks: [],
        } as any);
        expect(legacy?.grouped.Property).toEqual([]);
        expect(legacy?.totalCount).toBe(0);
    });
});

describe('7. Cross-firm search isolation — session-derived, server-enforced', () => {
    const backend = read(SEARCH_BACKEND);

    it('the ONLY entry is requireFirmUser (session-derived firmId)', () => {
        expect(backend).toContain('await requireFirmUser(ctx, args.userEmail, args.sessionToken)');
        expect(backend).toContain('const firmId = auth.firmId;');
    });

    it('every searched category filters on the session-derived firmId', () => {
        const filters = backend.match(/q\.eq\(q\.field\("firmId"\), firmId\)/g) || [];
        // matters (x2: title + suit), contacts, documents, tasks, properties
        expect(filters.length).toBeGreaterThanOrEqual(6);
    });

    it('there is no caller-supplied firmId or product parameter in the args', () => {
        expect(backend).not.toContain('args.firmId');
        expect(backend).not.toContain('args.product');
        expect(backend).not.toContain('args.includeProperties');
    });

    it('the product scope is derived from the FIRM RECORD, not the request', () => {
        expect(backend).toContain('const firm = await resolveFirm(ctx, firmId);');
        expect(backend).toContain('const propertySearchEnabled = isPropertyCapableProduct(firm?.product);');
    });
});
