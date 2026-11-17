/**
 * brandClarity.test.ts — Brand Clarity Pass regression pins (Phase 4).
 *
 * Pins the surfaces the website tests do NOT cover: the splash end-card,
 * the App→splash product mapping, the APK pipeline naming/signing, the
 * per-product wrapper machinery, and the agent-doc brand pointers.
 * The standard itself: docs/brand-architecture.md. The audit that started
 * this round: docs/brand/BRAND_CONSISTENCY_AUDIT.md.
 *
 * Add pins, never weaken them (AGENTS.md, brand rules).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    COMPANY_ATTRIBUTION,
    normalizeSplashProduct,
    resolveSplashEndCard,
    type SplashProduct,
} from '../../src/components/splashEndCard';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

// ─── Phase 1 — the splash end-card resolver ─────────────────────────────────

describe('Brand Clarity S1/S2 — the splash ends on the product being opened', () => {
    it('normalizes every product identifier the app produces', () => {
        // ProductContext canonical values.
        expect(normalizeSplashProduct('vega')).toBe('vega');
        expect(normalizeSplashProduct('atrium')).toBe('atrium');
        expect(normalizeSplashProduct('unified')).toBe('komplete');
        // Legacy/alias values (the old App.tsx bug compared against
        // 'property' AFTER canonicalization — impossible, so Atrium firms
        // resolved to 'vega'. The normalizer accepts them all up front).
        expect(normalizeSplashProduct('legal')).toBe('vega');
        expect(normalizeSplashProduct('property')).toBe('atrium');
        expect(normalizeSplashProduct('komplete')).toBe('komplete');
        // Unknown / logged-out degrades to the company card.
        expect(normalizeSplashProduct(undefined)).toBe('practicepro');
        expect(normalizeSplashProduct('sentry' as unknown as SplashProduct)).toBe('practicepro');
    });

    it('each product heroes its own mark with the company attribution', () => {
        for (const p of ['vega', 'atrium', 'komplete'] as const) {
            const card = resolveSplashEndCard(p);
            expect(card.mark).toBe(p);
            expect(card.name).toBeTruthy();
            expect(card.attribution).toBe(COMPANY_ATTRIBUTION);
            expect(card.lockup).toBe(false);
        }
    });

    it('the company card carries the product lockup instead of a product mark (Gate A, option b)', () => {
        const card = resolveSplashEndCard('practicepro');
        expect(card.mark).toBe('practicepro');
        expect(card.name).toBeNull();
        expect(card.lockup).toBe(true);
    });

    it('App.tsx resolves the splash product through the normalizer (S2 fix)', () => {
        const app = read('src/components/App.tsx');
        expect(app).toContain('normalizeSplashProduct(product)');
        // The dead comparison that mapped every firm (incl. Atrium) to
        // 'vega' must not return.
        expect(app).not.toContain("product === 'property' ? 'atrium' : 'vega'");
    });

    it('SplashScreen actually reads the product prop and renders the product marks (S1 fix)', () => {
        const splash = read('src/components/SplashScreen.tsx');
        // The prop is destructured (the original defect: declared, never read).
        expect(splash).toMatch(/product,\s*\n\s*onComplete/);
        expect(splash).toContain('resolveSplashEndCard(product)');
        expect(splash).toContain('VegaMark');
        expect(splash).toContain('AtriumMark');
        expect(splash).toContain('KompleteMark');
    });

    it('the Komplete mark exists and mirrors the favicon register (S4)', () => {
        const marks = read('src/components/marketing/brand/ProductMarks.tsx');
        expect(marks).toContain('export const KompleteMark');
        // Resolved hex, deliberately NOT tokens — the R60 pin bans the
        // retired burnt-orange value from index.css, and the committed
        // favicon (public/brand/komplete/favicon.svg) carries the same
        // raw register. The mark mirrors that static asset exactly.
        expect(marks).toContain('#E07A3F');
        expect(marks).toContain('#0C7A57');
        expect(marks).toContain('#3D5A3A');
        // ProductMark covers all three products.
        expect(marks).toContain("product: 'vega' | 'atrium' | 'komplete'");
        // The komplete orange never re-enters the shared token file
        // (aligns with the R60 pin in websiteRepositioning.test.ts).
        const css = read('src/index.css');
        expect(css).not.toContain('224 122 63');
        expect(css).not.toContain('--color-komplete-vega-coin');
    });
});

// ─── Phase 2 — the APK pipeline ─────────────────────────────────────────────

describe('Brand Clarity A3/A4/A5 — APK naming, release distribution, stable signing', () => {
    const workflow = read('.github/workflows/build-apk.yml');

    it('artifact names follow <product>-<version>-<channel>.apk', () => {
        expect(workflow).toContain('practicepro-${VERSION}-${CHANNEL}.apk');
        // The old company-only name is retired.
        expect(workflow).not.toContain('PracticePro-v${VERSION}.apk');
    });

    it('the release build is the distribution target when signing is available (A4)', () => {
        expect(workflow).toContain('assembleRelease');
        expect(workflow).toContain('app/build/outputs/apk/release/app-release.apk');
        // The debug APK remains only as the signed-fallback channel.
        expect(workflow).toContain('CHANNEL="debug"');
    });

    it('release signing decodes a stable keystore secret — never generates one (A5)', () => {
        expect(workflow).toContain('RELEASE_KEYSTORE_BASE64');
        // The random per-run release keystore generation step is gone
        // (the debug.keystore gen step may stay — that key is committed).
        expect(workflow).not.toContain('Generate release.keystore if missing');
        expect(workflow).not.toMatch(/keytool[\s\S]{0,120}release\.keystore/);
    });

    it('version.json records the channel alongside the URL', () => {
        expect(workflow).toContain('v.apkChannel = process.env.APK_CHANNEL');
    });

    it('the founder APK is never a public release asset (guardrail 8)', () => {
        const admin = read('.github/workflows/build-admin-apk.yml');
        // No public Release publishing step (a comment mention is fine).
        expect(admin).not.toContain('uses: softprops/action-gh-release');
        expect(admin).toContain('practicepro-founder-');
        expect(admin).toContain('RELEASE_KEYSTORE_BASE64');
    });
});

describe('Brand Clarity A1/A2/A7 — per-product wrapper variants', () => {
    it('every product config shares the universal applicationId (guardrail 1)', () => {
        for (const p of ['vega', 'atrium', 'komplete']) {
            const cfg = read(`capacitor.${p}.config.ts`);
            expect(cfg).toContain("appId: 'com.practicepro.app'");
            expect(cfg).toMatch(/appName: '(Vega|Atrium|Komplete)'/);
        }
    });

    it('the swap script patches app_name only — never the applicationId', () => {
        const swap = read('scripts/sync-product-config.cjs');
        expect(swap).toContain('app_name');
        expect(swap).not.toMatch(/applicationId\s*"\$\{/);
    });

    it('the npm scripts expose per-product builds', () => {
        const pkg = JSON.parse(read('package.json'));
        for (const s of [
            'apk:vega:release', 'apk:atrium:release', 'apk:komplete:release',
            'cap:sync:vega', 'cap:sync:atrium', 'cap:sync:komplete',
        ]) {
            expect(pkg.scripts[s], `missing script ${s}`).toBeTruthy();
        }
    });

    it('the product workflow names artifacts per product and never bumps the version', () => {
        const wf = read('.github/workflows/build-product-apks.yml');
        expect(wf).toContain('$P-$VERSION-$CHANNEL.apk');
        // Reads PATCH only to LABEL the artifacts — never increments it
        // and never writes the update manifest (the universal build is the
        // version authority).
        expect(wf).not.toContain('CURRENT + 1');
        expect(wf).not.toContain("sed -i \"s/^PATCH");
        expect(wf).not.toContain('public/version.json');
        expect(wf).toContain('version authority');
    });
});

// ─── Phase 3 — agent + docs brand pointers ─────────────────────────────────

describe('Brand Clarity D1/D2/D3 — docs point at the standard', () => {
    it('AGENTS.md carries the brand rules section', () => {
        const agents = read('AGENTS.md');
        expect(agents).toContain('Brand rules — PracticePro is the company');
        expect(agents).toContain('docs/brand-architecture.md');
        expect(agents).toContain('brandClarity.test.ts');
    });

    it('CONTEXT.md routes naming/branding tasks to the standard', () => {
        expect(read('CONTEXT.md')).toContain('Naming/branding of any user-visible surface');
    });

    it('README names the products per the standard (not "Vega OS")', () => {
        const readme = read('README.md');
        expect(readme).toContain('**PracticePro Vega**');
        expect(readme).toContain('**PracticePro Atrium**');
        expect(readme).not.toContain('Vega OS');
        expect(readme).not.toContain('Atrium OS');
    });
});
