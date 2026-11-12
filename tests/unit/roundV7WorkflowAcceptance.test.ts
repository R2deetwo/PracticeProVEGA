/**
 * roundV7WorkflowAcceptance.test.ts — V7: UX, PERFORMANCE AND QUALITY
 * Acceptance tests for the workflow gaps named in the V7 brief (§H) plus
 * the V7 changes themselves (bundle/lazy-loading, offline-first, mobile
 * reachability, accessibility, workflow quality).
 *
 * The V7 brief's §H list is checked against existing coverage first —
 * areas already covered by earlier rounds are NOT re-tested here:
 *   matter create→close→archive (roundV3MatterLifecycle), client
 *   onboarding/merges/invitations (roundV3ContactsAndConflicts),
 *   document engine + versioning + DraftPro session recovery
 *   (roundV4DocumentEngine), retainer cycle + trust-ledger mathematics
 *   (roundV2FinancialTruth), portal authorisation (roundV1C/portalLayer),
 *   Sidebar↔BottomNav entitlement parity (navParity).
 *
 * What this file closes:
 *   H-4/5   overflow markers + dead-query removal in getFirmData (V7-B)
 *   H-6     citation integrity in RENDERED outputs (draftHtml markers)
 *   H-10    unified-firm data payload shape (both products, one payload)
 *   H-12    mobile reachability: phone search entry, More-sheet surface
 *           exposure, FullScreenSearch dialog semantics
 *   H-13    destructive actions: client-side confirmation coverage
 *   §A      lazy-loading contracts (ModalManager forms, portal routes,
 *           dev-only test controls, React runtime chunking)
 *   §E      touch targets + real controls in the matter list
 *   §G      honest gating (Terms gate explains itself; demo mode fires no
 *           firm-scoped queries)
 *
 * Source-scanned assertions follow the repo's established precedent
 * (navParity.test.ts, silkRuntime.test.ts) for React components that
 * cannot be mounted without a full app shell.
 */
/* eslint-disable no-restricted-syntax -- this suite asserts the rounded-xl
   ratchet itself; the deprecated class name must appear as a literal. */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getFirmData } from '../../convex/myFunctions';
import { hashSessionToken } from '../../convex/sessions';
import { placeholdersToSpans } from '../../src/utils/draftHtml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../src/components/App.tsx'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf8');

// ═══════════════════════════════════════════════════════════════════════════
// Fixture-backed ctx — the established harness (roundV3 pattern, verbatim
// semantics: withIndex/filters over in-memory tables, insert/patch/delete,
// runMutation/runQuery re-entry). No mocks of code under test.
// ═══════════════════════════════════════════════════════════════════════════
type Row = Record<string, any>;

function makeCtx(fix: { tables?: Record<string, Row[]> } = {}) {
    const tables: Record<string, Row[]> = {
        sessions: [], users: [], firms: [], matters: [], contacts: [], tasks: [],
        documents: [], invoices: [], events: [], notePages: [], researchSources: [],
        properties: [], ledger_entries: [], service_charges: [], archive: [],
        legal_modules: [], statutes: [], firm_licenses: [],
        ...(fix.tables ?? {}),
    };
    const findRows = (table: string, conds: Array<[string, any]>) =>
        (tables[table] ?? []).filter((r: any) => conds.every(([f, v]) => r[f] !== undefined && String(r[f]) === String(v)));
    const chainFor = (rows: Row[]) => {
        const chain: any = {
            first: async () => (rows[0] ?? null),
            unique: async () => (rows[0] ?? null),
            collect: async () => rows,
            take: async (n: number) => rows.slice(0, n),
            order: (_d: string) => chain,
            filter: (_fn: any) => chain,
        };
        return chain;
    };
    const db: any = {
        query: (table: string) => ({
            withIndex: (_name: string, fn: (q: any) => any) => {
                const conds: Array<[string, any]> = [];
                const q: any = { eq: (field: string, value: any) => { conds.push([field, value]); return q; } };
                fn(q);
                return chainFor(findRows(table, conds));
            },
            order: () => chainFor(tables[table] ?? []),
            collect: async () => (tables[table] ?? []),
            take: async (n: number) => (tables[table] ?? []).slice(0, n),
            first: async () => (tables[table] ?? [])[0] ?? null,
        }),
        get: async (id: any) => {
            const idStr = String(id);
            for (const rows of Object.values(tables)) {
                const hit = rows.find((r: any) => String(r._id) === idStr);
                if (hit) return hit;
            }
            return null;
        },
        insert: async (table: string, value: any) => {
            const _id = `${table}_${tables[table]?.length ?? 0}_${Math.floor(Math.random() * 1e6)}`;
            (tables[table] = tables[table] ?? []).push({ _id, _creationTime: Date.now(), ...value });
            return _id as any;
        },
        patch: async (id: any, value: any) => {
            const idStr = String(id);
            for (const rows of Object.values(tables)) {
                const hit = rows.find((r: any) => String(r._id) === idStr);
                if (hit) Object.assign(hit, value);
            }
            return null;
        },
        delete: async (id: any) => {
            const idStr = String(id);
            for (const rows of Object.values(tables)) {
                const idx = rows.findIndex((r: any) => String(r._id) === idStr);
                if (idx >= 0) rows.splice(idx, 1);
            }
            return null;
        },
    };
    const ctx: any = {
        db,
        runMutation: vi.fn(async (fn: any, args: any) => (fn as any)._handler(ctx, args)),
        runAction: vi.fn(async () => ({ success: true })),
        runQuery: vi.fn(async (fn: any, args: any) => (fn as any)._handler(ctx, args)),
        scheduler: { runAfter: vi.fn(async () => null) },
        auth: { getUserIdentity: async () => null },
    };
    return { ctx, tables };
}

const call = (fn: any, ctx: any, args: any) => (fn as any)._handler(ctx, args);

function sessionRow(token: string, userId: string) {
    return {
        tokenHash: hashSessionToken(token),
        userId,
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
}

// A unified (Komplete) firm: both products, one payload.
const UNIFIED_FIRM: Row = { _id: 'firm-u', id: 'firm-u', name: 'Unified Chambers', subscriptionPlan: 'Enterprise', product: 'komplete' };
const UNIFIED_ADMIN: Row = { _id: 'u-admin', id: 'u-admin', email: 'admin@unified.ng', name: 'Ada Admin', role: 'Admin', firmId: 'firm-u' };
const UNIFIED_AUTH = { userEmail: UNIFIED_ADMIN.email, sessionToken: 'tok-v7' };

function overflowWorld(matterCount: number) {
    const matters: Row[] = Array.from({ length: matterCount }, (_, i) => ({
        _id: `m-${i}`, id: `m-${i}`, firmId: 'firm-u', title: `Matter ${i}`,
        status: 'Open', stage: 'Pleadings',
    }));
    const properties: Row[] = Array.from({ length: 3 }, (_, i) => ({
        _id: `p-${i}`, id: `p-${i}`, firmId: 'firm-u', address: `${i} Unity Road, Lagos`,
    }));
    return makeCtx({
        tables: {
            firms: [UNIFIED_FIRM],
            users: [UNIFIED_ADMIN],
            sessions: [sessionRow('tok-v7', 'u-admin')],
            matters,
            properties,
            // Bait: rows that the REMOVED dead queries used to read.
            legal_modules: [{ _id: 'lm-1', name: 'Module', firmId: 'firm-u' }],
            statutes: Array.from({ length: 5 }, (_, i) => ({ _id: `st-${i}`, title: `Statute ${i}` })),
            firm_licenses: [{ _id: 'fl-1', firmId: 'firm-u', plan: 'Enterprise' }],
        },
    });
}

// ═══════════════════════════════════════════════════════════════════════════
describe('V7 §B/H-4 — getFirmData overflow markers (visible truncation)', () => {
    it('a firm with 1001 matters gets EXACTLY 1000 rows AND a visible overflow marker', async () => {
        const w = overflowWorld(1001);
        const res: any = await call(getFirmData, w.ctx, { ...UNIFIED_AUTH, firmId: 'firm-u' });
        expect(res).toBeTruthy();
        expect(res.matters).toHaveLength(1000); // the probe row is dropped
        expect(res.overflowTables).toEqual(['matters']);
        // Other tables below the cap are NOT flagged.
        expect(res.overflowTables).not.toContain('properties');
        expect(res.properties).toHaveLength(3);
    });

    it('a firm at 999 matters gets no marker — truncation must not be claimed falsely', async () => {
        const w = overflowWorld(999);
        const res: any = await call(getFirmData, w.ctx, { ...UNIFIED_AUTH, firmId: 'firm-u' });
        expect(res.matters).toHaveLength(999);
        expect(res.overflowTables).toEqual([]);
    });

    it('exactly 1000 rows is NOT an overflow (the probe row decides, not the count)', async () => {
        const w = overflowWorld(1000);
        const res: any = await call(getFirmData, w.ctx, { ...UNIFIED_AUTH, firmId: 'firm-u' });
        expect(res.matters).toHaveLength(1000);
        expect(res.overflowTables).toEqual([]);
    });
});

describe('V7 §B/H-10 — getFirmData dead-query removal + unified payload shape', () => {
    it('legal reference tables and licenses are fetched-then-discarded NO MORE: the payload has no such keys', async () => {
        const w = overflowWorld(2);
        const res: any = await call(getFirmData, w.ctx, { ...UNIFIED_AUTH, firmId: 'firm-u' });
        // The three dead queries (legal_modules, statutes, firm_licenses) were
        // removed — their data must not leak into the payload under any name.
        expect(res.legalModules).toBeUndefined();
        expect(res.statutes).toBeUndefined();
        expect(res.firmLicenses).toBeUndefined();
        // A unified firm still receives BOTH product surfaces in one payload.
        expect(res.matters.length + res.properties.length).toBeGreaterThan(0);
        expect(res.firmDetails.name).toBe('Unified Chambers');
    });

    it('the recovery full-scan is gone from the source (no RECOVERY_TABLES)', () => {
        const src = read('convex/myFunctions.ts');
        expect(src).not.toContain('RECOVERY_TABLES');
        // The overflow probe is the new truncation mechanism.
        expect(src).toContain('FIRM_ROW_LIMIT + 1');
        expect(src).toContain('overflowTables');
    });

    it('the client consumes the marker WITHOUT polluting AppState (DataProvider skips the key)', () => {
        const src = read('src/contexts/DataProvider.tsx');
        expect(src).toContain("if (key === 'overflowTables') continue");
        expect(src).toContain('setOverflowTables');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('V7 §H-6 — citation integrity in RENDERED outputs (draftHtml)', () => {
    it('numeric citation markers [1] [12] [2023] survive rendering — never become placeholders', () => {
        const html = placeholdersToSpans('<p>The position is settled <sup>[1]</sup> and restated <sup>[12]</sup> in the 2023 amendments <sup>[2023]</sup>.</p>');
        expect(html).toContain('[1]');
        expect(html).toContain('[12]');
        expect(html).toContain('[2023]');
        expect(html).not.toContain('data-type="legal-placeholder"');
    });

    it('real placeholders still convert with a resolved category — the citation exemption is narrow', () => {
        const html = placeholdersToSpans('<p>[SUIT NUMBER] and [FULL NAME OF TENANT]</p>');
        expect(html.match(/data-type="legal-placeholder"/g)).toHaveLength(2);
        expect(html).toContain('data-category="court"');
        expect(html).toContain('data-category="parties"');
    });

    it('mixed content: citations preserved AND placeholders converted in the same document', () => {
        const html = placeholdersToSpans('<p>In <sup>[4]</sup> the court held the [RENT AMOUNT] was due on [COMMENCEMENT DATE].</p>');
        expect(html).toContain('[4]');
        expect(html.match(/data-type="legal-placeholder"/g)).toHaveLength(2);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('V7 §H-12 — mobile reachability', () => {
    it('the phone (<640px) header has a SEARCH entry — FullScreenSearch is openable on phones', () => {
        const header = read('src/components/Header.tsx');
        // The trigger was `hidden sm:block lg:hidden` — invisible on phones.
        // It must now render at every width below lg.
        expect(header).not.toContain('hidden sm:block lg:hidden');
        expect(header).toMatch(/block lg:hidden/);
        expect(header).toMatch(/aria-label="Search"/);
    });

    it('BottomNav exposes Financials and Analytics through the More sheet with the SAME permission gates as desktop', () => {
        const bottom = read('src/components/BottomNav.tsx');
        expect(bottom).toMatch(/view:\s*'billing',\s*text:\s*'Financials'/);
        expect(bottom).toMatch(/permission:\s*\(p\)\s*=>\s*p\.canViewBilling/);
        expect(bottom).toContain('More Options');
    });

    it('FullScreenSearch is a real dialog layer: semantics, labelled input, Esc close, live results', () => {
        const fs = read('src/components/FullScreenSearch.tsx');
        expect(fs).toContain('role="dialog"');
        expect(fs).toContain('aria-modal="true"');
        expect(fs).toMatch(/aria-label="Search matters, properties, contacts, documents and tasks"/);
        expect(fs).toMatch(/e\.key === 'Escape'/);
        expect(fs).toContain('aria-live="polite"');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('V7 §H-13 — destructive actions: client-side confirmation coverage', () => {
    it('SubscriptionSettings uses the app ConfirmDialog system — zero native window.confirm calls', () => {
        const src = read('src/components/settings/SubscriptionSettings.tsx');
        expect(src.match(/window\.confirm\(/g)).toBeNull();
        expect((src.match(/useConfirm\(\)/g) || []).length).toBeGreaterThanOrEqual(3);
        // Every panel that confirms also RENDERS its dialog node.
        expect((src.match(/\{Confirm\}/g) || []).length).toBeGreaterThanOrEqual(3);
    });

    it('add-on cancellations and refund withdrawal are marked destructive (danger styling)', () => {
        const src = read('src/components/settings/SubscriptionSettings.tsx');
        const dangers = (src.match(/danger: true/g) || []).length;
        expect(dangers).toBeGreaterThanOrEqual(3); // VMS cancel, EC cancel, refund withdraw
    });

    it('the matter-list delete/archive action is labelled for screen readers and sized for touch', () => {
        const src = read('src/components/MatterList.tsx');
        expect(src).toMatch(/aria-label=\{canArchiveMatters \? `Delete or archive matter: \$\{matter\.title\}`/);
        expect(src).toMatch(/p-1\.5 transition-colors/); // ≥26px hit area for the 14px icon
    });

    it('Matter selection is a REAL control: keyboard-operable, 24px (WCAG 2.2 AA target minimum)', () => {
        const src = read('src/components/MatterList.tsx');
        expect(src).not.toContain('onChange={() => {}}'); // the old dummy input
        expect(src).toMatch(/onChange=\{\(\) => \{ onSelect\?\.\(matter\.id, !isSelected\); \}\}/);
        expect(src).toMatch(/aria-label=\{`Select \$\{matter\.title\}`\}/);
        expect(src).toMatch(/w-6 h-6 rounded border-dim-300/); // 24px
    });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('V7 §A — lazy-loading + initial payload contracts', () => {
    it('ModalManager lazily loads EVERY form/modal — no static form imports remain', () => {
        const src = read('src/components/modals/ModalManager.tsx');
        expect(src).not.toMatch(/^import\s+\w+\s+from\s+'\.\.\/forms\//m);
        expect(src).not.toMatch(/^import\s+\{[^}]+\}\s+from\s+'\.\.\/forms\//m);
        expect(src).not.toMatch(/^import\s+\w+\s+from\s+'\.\/\w+Modal'/m);
        expect((src.match(/lazyWithReload\(/g) || []).length).toBeGreaterThanOrEqual(40);
        // The single render point suspends with an in-frame loading skeleton.
        expect(src).toContain('<Suspense fallback={<ModalSkeleton />}>');
    });

    it('portal/recovery auth routes load on demand (not in the eager entry)', () => {
        const app = read('src/components/App.tsx');
        expect(app).not.toMatch(/^import\s+ClientPortalLogin\s+from/m);
        expect(app).not.toMatch(/^import\s+SetupPassword\s+from/m);
        expect(app).toMatch(/lazyWithReload\(\(\) => import\('\.\/portal\/ClientPortalLogin'\)\)/);
        expect(app).toMatch(/lazyWithReload\(\(\) => import\('\.\/portal\/SetupPassword'\)\)/);
        expect(app).toMatch(/lazyWithReload\(\(\) => import\('\.\/auth\/ResetPasswordView'\)\)/);
    });

    it('the dev test toolkit never ships in production bundles', () => {
        const app = read('src/components/App.tsx');
        expect(app).not.toMatch(/^import\s+FloatingTestControls\s+from/m);
        expect(app).toMatch(/import\.meta\.env\.DEV\s*\n\s*\? lazyWithReload\(\(\) => import\('\.\/FloatingTestControls'\)\)/);
    });

    it('the React runtime is claimed by ONE chunk (no jsx-runtime duplication)', () => {
        const vite = read('vite.config.ts');
        expect(vite).toMatch(/react\|react-dom\|react-router\|react-router-dom\|scheduler\|use-sync-external-store/);
        // The framer-motion manual chunk (which forced an eager facade import
        // + a duplicated React copy) is retired.
        expect(vite).not.toMatch(/if \(id\.includes\('framer-motion'\)\)/);
    });

    it('Sidebar lazy-loads the onboarding checklist', () => {
        const side = read('src/components/Sidebar.tsx');
        expect(side).not.toMatch(/^import\s+GettingStartedChecklist\s+from/m);
        expect(side).toMatch(/lazyWithReload\(\(\) => import\('\.\/GettingStartedChecklist'\)\)/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('V7 §G — honest gating and demo-mode integrity', () => {
    it('the Terms gate explains itself: blocked creation shows a toast + the acceptance bar (no silent no-op)', () => {
        const ui = read('src/contexts/UIContext.tsx');
        expect(ui).toContain('CREATE_MODAL_TYPES');
        expect(ui).toContain('You need to accept the Terms of Service and Privacy Policy before creating new entries');
        expect(ui).toContain('setShowTermsBar(true)');
    });

    it('the UI context TYPE declares the terms-bar members the provider supplies (no phantom state)', () => {
        const ui = read('src/contexts/UIContext.tsx');
        const iface = ui.slice(ui.indexOf('export interface UIContextType'), ui.indexOf('}', ui.indexOf('export interface UIContextType')) + 1);
        expect(iface).toContain('showTermsBar: boolean');
        expect(iface).toContain('setShowTermsBar');
    });

    it('demo sessions fire NO firm-scoped server queries (the activity-feed leak is fixed)', () => {
        const dp = read('src/contexts/DataProvider.tsx');
        expect(dp).toContain("currentUser.email !== 'demo@practicepro.ng'");
    });

    it('modal layering: the Terms acceptance bar renders BELOW open modals (mobile modal controls stay reachable)', () => {
        const terms = read('src/components/TermsAcceptance.tsx');
        // UX-18: z-index moved to the named tier ladder — the bar takes
        // Z_TIERS.termsBar (2990), one rung below the modal tier (3000).
        expect(terms).not.toContain('z-[9998]');
        expect(terms).toContain('Z_CLASS.termsBar');
        const tiers = read('src/overlays/constants.ts');
        expect(tiers).toContain('termsBar: 2990');
        expect(tiers).toContain('modal: 3000');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('V7 §E/F — accessible modals and wayfinding', () => {
    it('hideHeader modals are still NAMED for screen readers (aria-label fallback)', () => {
        const modal = read('src/components/modals/Modal.tsx');
        expect(modal).toContain("...(hideHeader ? { 'aria-label': title } : { 'aria-labelledby': 'modal-title' })");
    });

    it('the Modal focus trap recaptures focus that escapes the dialog', () => {
        const modal = read('src/components/modals/Modal.tsx');
        expect(modal).toContain('!modalRef.current.contains(document.activeElement)');
    });

    it('Sidebar nav items announce the current location (aria-current) and group operations logically', () => {
        const side = read('src/components/Sidebar.tsx');
        expect(side).toMatch(/aria-current=\{isActive \? 'page' : undefined\}/);
        // The legal cluster (Matters…Research) must precede Properties and the
        // shared utilities — grouping by business operation.
        const matters = side.indexOf("view: 'matters'");
        const documents = side.indexOf("view: 'documents'");
        const research = side.indexOf("view: 'research'");
        const properties = side.indexOf("view: 'properties'");
        const tasks = side.indexOf("view: 'tasks'");
        expect(matters).toBeGreaterThan(-1);
        expect(documents).toBeGreaterThan(matters);
        expect(research).toBeGreaterThan(documents);
        expect(properties).toBeGreaterThan(research);
        expect(tasks).toBeGreaterThan(properties);
    });

    it('the inline review-reminder control is labelled and stateful (aria-expanded)', () => {
        const imr = read('src/components/InlineMatterReview.tsx');
        expect(imr).toContain('aria-label="Set review reminder"');
        expect(imr).toContain('aria-expanded={isOpen}');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('V7 §F — quality ratchets updated', () => {
    it('the design-token gate ratchets the deprecated rounded-xl scale (may only shrink)', () => {
        const gate = read('scripts/check-design-tokens.mjs');
        expect(gate).toContain('ROUNDED_XL_BASELINE');
        expect(gate).toContain('rounded-xl usage grew');
    });

    it('the overflow banner uses the ui Button primitive (ADR-0004 — the ratchet stays at 2295)', () => {
        const app = read('src/components/App.tsx');
        expect(app).toMatch(/import \{ Button \} from '\.\/ui'/);
    });
});
