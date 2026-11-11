/**
 * roundQAPerf.test.ts — ROUND QA (§2 performance) source contracts.
 *
 * THE GAP THIS LOCKS IN: the eager entry chunk carried ~760 KB of code no
 * first-time visitor ever opens — a keyless PostHog SDK (206 KB), six
 * legal-text pages (~210 KB), the resources page (72 KB), the three
 * heaviest form modals (~141 KB), the changelog (38 KB), the gatehouse
 * surface (22 KB) and the demo fixtures (29 KB). All of it is lazy now
 * (2,006 KB → 1,242 KB eager, gzip 543 KB → 326 KB). These pins make a
 * regression (a static import sneaking back) fail the suite.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/schema.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf8');

describe('QA §2 — the legal/resource/gatehouse cluster is lazy, not eager', () => {
    const app = read('src/components/App.tsx');

    const lazyPages: Array<[string, string]> = [
        ['PrivacyPolicy', "./PrivacyPolicy"],
        ['TermsOfService', "./TermsOfService"],
        ['PortalTermsOfUse', "./PortalTermsOfUse"],
        ['DataProcessingAgreement', './DataProcessingAgreement'],
        ['CookiePolicy', './CookiePolicy'],
        ['UsagePolicy', './UsagePolicy'],
        ['ResourcesPage', './ResourcesPage'],
        ['GatekeeperInterface', './portal/GatekeeperInterface'],
        ['WhatsNew', './WhatsNew'],
    ];

    it('every cluster page is a lazyWithReload dynamic import', () => {
        for (const [name, path] of lazyPages) {
            expect(app).toContain(`import('${path}')`);
            // …and NOT a static import anymore.
            const staticForms = [
                `import ${name} from '${path}'`,
                `import { ${name} } from '${path}'`,
            ];
            for (const form of staticForms) {
                expect(app.includes(form)).toBe(false);
            }
        }
    });

    it('every render site of the cluster is Suspense-wrapped (no bare <Page)', () => {
        for (const [name] of lazyPages) {
            const bare = new RegExp(`<${name}[\\s/>]`);
            const matches = app.match(bare) ?? [];
            // Every occurrence must sit inside a Suspense on the same line.
            const lines = app.split('\n').filter((l) => bare.test(l));
            expect(
                lines.every((l) => l.includes('<React.Suspense') || l.includes('<Suspense')),
                `${name} render without Suspense:\n${lines.join('\n')}`
            ).toBe(true);
            expect(matches.length, `${name} has render sites`).toBeGreaterThan(0);
        }
    });
});

describe('QA §2 — PostHog SDK is lazy and key-gated', () => {
    const src = read('src/utils/analytics.ts');

    it('no static import of posthog-js', () => {
        expect(src.includes("import posthog from 'posthog-js'")).toBe(false);
        expect(src.includes("import('posthog-js')")).toBe(true); // dynamic only
    });

    it('the SDK loads only when a key is configured', () => {
        // initPostHog returns BEFORE any import when the key is empty.
        const head = src.slice(src.indexOf('export function initPostHog'));
        const keyCheck = head.indexOf('if (!POSTHOG_KEY)');
        const importCall = head.indexOf("import('posthog-js')");
        expect(keyCheck).toBeGreaterThan(-1);
        expect(importCall).toBeGreaterThan(keyCheck);
    });

    it('every capture/identify/reset guards on the module being loaded', () => {
        expect(src.split('!posthogModule').length - 1).toBeGreaterThanOrEqual(3);
    });
});

describe('QA §2 — the three heaviest form modals are lazy in ModalLayer', () => {
    const src = read('src/overlays/layers/ModalLayer.tsx');

    it('PropertyForm / MatterForm / SmartMatterModal are React.lazy', () => {
        for (const [name, path] of [
            ['PropertyForm', '../../components/forms/PropertyForm'],
            ['MatterForm', '../../components/forms/MatterForm'],
            ['SmartMatterModal', '../../components/forms/SmartMatterModal'],
        ] as Array<[string, string]>) {
            expect(src).toContain(`React.lazy(() => import('${path}')`);
            expect(src.includes(`import ${name} from '${path}'`)).toBe(false);
            expect(src.includes(`import { ${name} } from '${path}'`)).toBe(false);
        }
    });

    it('their render sites are Suspense-wrapped', () => {
        const tagLine = /<(PropertyForm|MatterForm|SmartMatterModal)(\s|>|\/|$)/;
        const all = src.split('\n');
        const idxs = all.map((l, i) => (tagLine.test(l) ? i : -1)).filter((i) => i >= 0);
        expect(idxs.length).toBeGreaterThanOrEqual(3);
        for (const i of idxs) {
            // The Suspense wrapper opens on this line or the one above it.
            const ctx = all[i] + all[i - 1] ?? '';
            expect(
                ctx.includes('Suspense'),
                `render at line ${i + 1} lost its Suspense wrapper`
            ).toBe(true);
        }
    });
});

describe('QA §2 — demo fixtures load on demand only', () => {
    it('DataProvider has no static demoData import; loads it in the demo branch', () => {
        const src = read('src/contexts/DataProvider.tsx');
        expect(src.includes("from '../utils/demoData'")).toBe(false);
        expect(src.includes("import('../utils/demoData')")).toBe(true);
        // The dynamic import sits INSIDE the isDemo branch.
        const demoIdx = src.indexOf('if (isDemo)');
        const importIdx = src.indexOf("import('../utils/demoData')");
        expect(importIdx).toBeGreaterThan(demoIdx);
    });
});
