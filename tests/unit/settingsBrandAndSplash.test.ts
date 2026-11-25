// @vitest-environment jsdom
/**
 * settingsBrandAndSplash.test.ts — the 2026-11-25 owner-brief round:
 * Settings brand-color standardization + Compliance consolidation +
 * numeric-input guards + bank-account cap/purpose tagging + the bell
 * popover order + the banner preview cycler + the two-stage splash.
 *
 * House pattern: pure modules get real unit tests; UI contracts get
 * source-scan pins (same recipe as sessionLockSettings / voxUsageTracking
 * / strictIdentityCallSites rounds).
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
    BANNER_TEST_PRESETS,
    MAX_TEST_BANNERS,
    pushTestBanner,
    clearTestBanners,
    getTestBanners,
    subscribeTestBanners,
    __resetTestBannersForTests,
} from '../../src/utils/bannerTestCycler';
import {
    getCachedSplashProduct,
    cacheSplashProduct,
    clearCachedSplashProduct,
} from '../../src/utils/splashProductCache';
import { SPLASH_TIMINGS } from '../../src/components/SplashScreen';
import { getTourBackdropSegments } from '../../src/components/OnboardingTour';
import { REVEAL_TIMINGS } from '../../src/components/ProductReveal';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

// ─── 1. The banner test cycler (pure pub/sub) ───────────────────────────────

describe('Banner test cycler — internal banner preview tool', () => {
    beforeEach(() => { __resetTestBannersForTests(); });
    afterEach(() => { __resetTestBannersForTests(); });

    it('the owner-named preset families exist with broadcast-shaped types', () => {
        expect(BANNER_TEST_PRESETS.map(p => p.id)).toEqual([
            'founder_announcement',
            'platform_notice',
            'urgent_alert',
        ]);
        for (const preset of BANNER_TEST_PRESETS) {
            expect(preset.type).toMatch(/^broadcast_(announcement|info|urgent)$/);
            expect(preset.title).toBeTruthy();
            expect(preset.message).toBeTruthy();
            expect(preset.buttonLabel).toBeTruthy();
        }
    });

    it('push mints a FRESH session-dismissable row every time', () => {
        const a = pushTestBanner('founder_announcement');
        const b = pushTestBanner('founder_announcement');
        expect(a).not.toBeNull();
        expect(b).not.toBeNull();
        expect(a!.id).not.toBe(b!.id);
        // Fresh ids mean a dismissed preset can always be re-triggered.
        expect(getTestBanners().length).toBe(2);
        for (const row of getTestBanners()) {
            expect(row.persistenceMode).toBe('session');
            expect(row.targetProduct).toBe('all');
            expect(row._isTestBanner).toBe(true);
        }
    });

    it('caps at MAX_TEST_BANNERS and clear empties the queue', () => {
        for (let i = 0; i < MAX_TEST_BANNERS + 3; i++) {
            pushTestBanner('platform_notice');
        }
        expect(getTestBanners().length).toBe(MAX_TEST_BANNERS);
        clearTestBanners();
        expect(getTestBanners()).toEqual([]);
    });

    it('subscribers are notified on push and clear, and can unsubscribe', () => {
        const seen: number[] = [];
        const unsub = subscribeTestBanners(rows => seen.push(rows.length));
        pushTestBanner('urgent_alert');
        expect(seen).toEqual([1]);
        clearTestBanners();
        expect(seen).toEqual([1, 0]);
        unsub();
        pushTestBanner('urgent_alert');
        expect(seen).toEqual([1, 0]); // no notification after unsubscribe
    });

    it('unknown presets are rejected without throwing', () => {
        expect(pushTestBanner('nonsense' as any)).toBeNull();
        expect(getTestBanners()).toEqual([]);
    });

    it('BroadcastBanner merges test banners into the carousel (wired, not dead)', () => {
        const src = read('src/components/BroadcastBanner.tsx');
        expect(src).toContain('subscribeTestBanners');
        expect(src).toContain('getTestBanners');
        expect(src).toMatch(/\[\.\.\.systemBanners,\s*\.\.\.visibleBroadcasts,\s*\.\.\.visibleTests\]/);
        // Dismissed test banners actually leave the carousel (the session
        // dismissal filter runs on the merged queue).
        expect(src).toMatch(/testBanners\.filter\(\s*b => !isSessionDismissed\(b\.broadcastId, b\.id\)/);
    });

    it('the cycler card is admin-gated and lives in NotificationSettings', () => {
        const src = read('src/components/settings/NotificationSettings.tsx');
        expect(src).toContain('BannerPreviewCycler');
        expect(src).toMatch(/currentUser\?\.role !== 'Admin'\) return null/);
        expect(src).toContain('BANNER_TEST_PRESETS');
    });
});

// ─── 2. The splash product cache (pure localStorage) ────────────────────────

describe('Splash product cache — the resolved activeProduct persists locally', () => {
    beforeEach(() => { clearCachedSplashProduct(); });
    afterEach(() => { clearCachedSplashProduct(); });

    it('starts empty, stores normalized products, survives round-trips', () => {
        expect(getCachedSplashProduct()).toBeNull();
        cacheSplashProduct('vega');
        expect(getCachedSplashProduct()).toBe('vega');
        cacheSplashProduct('komplete');
        expect(getCachedSplashProduct()).toBe('komplete');
        cacheSplashProduct('atrium');
        expect(getCachedSplashProduct()).toBe('atrium');
    });

    it('clears cleanly', () => {
        cacheSplashProduct('vega');
        clearCachedSplashProduct();
        expect(getCachedSplashProduct()).toBeNull();
    });

    it('garbage values in storage degrade to null (never a crash)', () => {
        localStorage.setItem('pp_splash_product', 'sentry');
        expect(getCachedSplashProduct()).toBeNull();
        localStorage.setItem('pp_splash_product', 'unified');
        expect(getCachedSplashProduct()).toBeNull(); // raw values only — App normalizes BEFORE writing
    });

    it('App.tsx wires the cache on both sides (boot read + resolution write)', () => {
        const app = read('src/components/App.tsx');
        expect(app).toContain('getCachedSplashProduct()');
        expect(app).toContain('cacheSplashProduct(live');
        expect(app).toContain('bootSplashProductRaw');
        expect(app).toContain('ProductReveal');
    });
});

// ─── 3. Splash timing guardrails (the owner's numbers) ─────────────────────

describe('Splash timings — the two-stage sequence stays within the brief', () => {
    it('Stage 1: black → amber → green with a brief hold', () => {
        expect(SPLASH_TIMINGS.amberAt).toBeGreaterThanOrEqual(300);
        expect(SPLASH_TIMINGS.greenAt).toBeGreaterThan(SPLASH_TIMINGS.amberAt);
        // Green holds ~400ms before Stage 2 begins.
        expect(SPLASH_TIMINGS.stageTwoAt - SPLASH_TIMINGS.greenAt).toBeGreaterThanOrEqual(300);
    });

    it('Stage 2: a 300–450ms reveal after the fade-through-black', () => {
        const reveal = SPLASH_TIMINGS.productRevealAt - SPLASH_TIMINGS.stageTwoAt;
        expect(reveal).toBeGreaterThanOrEqual(300);
        expect(reveal).toBeLessThanOrEqual(450);
    });

    it('the product-known sequence completes within the ~1.8–2.4s target', () => {
        expect(SPLASH_TIMINGS.completeAt).toBeGreaterThanOrEqual(1800);
        expect(SPLASH_TIMINGS.completeAt).toBeLessThanOrEqual(2400);
    });

    it('the unauthenticated sequence completes earlier (Stage 1 only)', () => {
        expect(SPLASH_TIMINGS.unauthCompleteAt).toBeLessThan(SPLASH_TIMINGS.completeAt);
    });

    it('the post-login reveal eases in 300–450ms and out 300–450ms', () => {
        expect(REVEAL_TIMINGS.entryMs).toBeGreaterThanOrEqual(300);
        expect(REVEAL_TIMINGS.entryMs).toBeLessThanOrEqual(450);
        expect(REVEAL_TIMINGS.exitMs).toBeGreaterThanOrEqual(300);
        expect(REVEAL_TIMINGS.exitMs).toBeLessThanOrEqual(450);
    });
});

describe('Tour spotlight and startup splash lifecycle', () => {
    it('leaves a padded cutout around the target while dimming the rest of the viewport', () => {
        const segments = getTourBackdropSegments(
            { top: 200, left: 100, right: 400, bottom: 350 },
            1000,
            800,
        );

        expect(segments).toEqual([
            { top: 0, left: 0, width: 1000, height: 192 },
            { top: 358, left: 0, width: 1000, height: 442 },
            { top: 192, left: 0, width: 92, height: 166 },
            { top: 192, left: 408, width: 592, height: 166 },
        ]);
    });

    it('clips the spotlight cutout at viewport edges and supports body steps', () => {
        expect(getTourBackdropSegments(
            { top: -30, left: -20, right: 60, bottom: 40 },
            100,
            100,
        )).toEqual([
            { top: 48, left: 0, width: 100, height: 52 },
            { top: 0, left: 68, width: 32, height: 48 },
        ]);
        expect(getTourBackdropSegments(null, 100, 80)).toEqual([
            { top: 0, left: 0, width: 100, height: 80 },
        ]);
    });

    it('tracks target layout changes and removes the viewport-wide blur from its bounds', () => {
        const tour = read('src/components/OnboardingTour.tsx');
        expect(tour).toContain("window.addEventListener('scroll', schedulePositionUpdate, true)");
        expect(tour).toContain("window.removeEventListener('scroll', schedulePositionUpdate, true)");
        expect(tour).toContain('new ResizeObserver(schedulePositionUpdate)');
        expect(tour).toContain('new MutationObserver(schedulePositionUpdate)');
        expect(tour).toContain('getTourBackdropSegments(');
        expect(tour).not.toContain('shadow-[0_0_0_9999px');
    });

    it('finishes and permanently dismisses the initial splash when the app shell is ready', () => {
        const app = read('src/components/App.tsx');
        const splash = read('src/components/SplashScreen.tsx');
        expect(app).toMatch(
            /if \(isDataLoaded \|\| forceEntry\) \{[\s\S]*?setSplashAnimationComplete\(true\);[\s\S]*?setHasInitialSplashFinished\(true\);[\s\S]*?\}, \[currentUser, visualsComplete, isDataLoaded, forceEntry, modal, closeModal\]\);/,
        );
        expect(splash).toContain('isVisible && !hasStarted.current && !hasDismissed.current');
        expect(splash).toMatch(/hasDismissed\.current = true;[\s\S]*?clearAllTimers\(\);/);
    });
});

// ─── 4. Settings brand-color standardization contracts ──────────────────────

describe('Settings accent standardization — Brand Blue default, green only for Property', () => {
    it('the Settings nav (SettingsView) is primary-accent, not emerald', () => {
        const src = read('src/components/settings/SettingsView.tsx');
        // Active nav states + sub-tabs carry the skin-scoped primary.
        expect(src).toContain('bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300');
        expect(src).toContain('bg-primary-100 dark:bg-primary-800/40 text-primary-600 dark:text-primary-300');
        expect(src).toContain('bg-primary-500 flex-shrink-0');
        // The old emerald active classes are gone.
        expect(src).not.toContain('bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700');
        expect(src).not.toContain('bg-emerald-100 dark:bg-emerald-800/40');
        // The property-only exception survives (Revenue Protection Guide).
        expect(src).toMatch(/Revenue Protection Guide[\s\S]*text-emerald-500/);
    });

    it('the standalone Compliance nav item is retired', () => {
        const src = read('src/components/settings/SettingsView.tsx');
        expect(src).not.toContain("navigateTo('compliance')");
        expect(src).not.toContain('Practicing fees, CPD & standards');
        // The compliance VIEW stays reachable (deep-link route in App.tsx).
        const app = read('src/components/App.tsx');
        expect(app).toContain("case 'compliance'");
    });

    it('NotificationSettings: general toggles primary, property rows emerald, legal/portal/system blue', () => {
        const src = read('src/components/settings/NotificationSettings.tsx');
        // The shared PrefSwitch defaults to the primary accent.
        expect(src).toMatch(/tone = 'primary'/);
        expect(src).toMatch(/tone === 'emerald' \? 'bg-emerald-500' : 'bg-primary-600'/);
        // The category row toggle: property → emerald, everything else → primary.
        expect(src).toContain("category === 'property'");
        expect(src).toContain("'bg-emerald-500 focus:ring-emerald-500/30'");
        expect(src).toContain("'bg-primary-600 focus:ring-primary-500/30'");
        // Legal + portal + system category chips are Brand Blue.
        expect(src).not.toContain('text-violet-600 dark:text-violet-400 bg-violet-50');
        const legalChips = src.match(/color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900\/20'/g) || [];
        expect(legalChips.length).toBeGreaterThanOrEqual(3); // legal + portal + system
        // The property chip stays emerald (the one green exception).
        expect(src).toContain('text-emerald-600 dark:text-emerald-400 bg-emerald-50');
    });

    it('Display / AI / Security / Trust accents are primary, never accent-emerald', () => {
        const display = read('src/components/settings/DisplaySettings.tsx');
        expect(display).not.toContain('hover:border-emerald-500/50');
        expect(display).not.toContain('focus:ring-emerald-500/30');
        expect(display).toContain('bg-primary-500/10 text-primary-700 dark:text-primary-300');

        const agents = read('src/components/settings/AgentSettings.tsx');
        expect(agents).not.toContain('bg-emerald-100 dark:bg-emerald-900/30 rounded-lg');
        expect(agents).toContain('bg-primary-100 dark:bg-primary-900/30 rounded-lg');

        const security = read('src/components/settings/SecuritySettings.tsx');
        expect(security).not.toContain('text-white bg-green-600 rounded-lg hover:bg-green-700');
        expect(security).toContain('text-white bg-primary-600 rounded-lg hover:bg-primary-700');

        const firm = read('src/components/settings/FirmSettings.tsx');
        expect(firm).not.toContain("trustAccountingEnabled ? 'bg-emerald-600'");
        expect(firm).toContain("trustAccountingEnabled ? 'bg-primary-600'");
    });
});

// ─── 5. Compliance consolidation + numeric guards ────────────────────────────

describe('Compliance & Professional Standards consolidation', () => {
    it('the firm-level toggle exists, defaults OFF, and writes firmDetails', () => {
        const firm = read('src/components/settings/FirmSettings.tsx');
        expect(firm).toContain('Compliance & Professional Standards');
        expect(firm).toContain('complianceTrackingEnabled: !firmDetails.complianceTrackingEnabled');
        expect(firm).toMatch(/aria-label="Track compliance and professional standards"/);
        // The team-facing report is linked from the card.
        expect(firm).toContain("navigateTo('compliance')");
    });

    it('the firm toggle gates the member Professional Standards card (OFF by default)', () => {
        const profile = read('src/components/settings/ProfileSettings.tsx');
        expect(profile).toContain('complianceTrackingEnabled');
        expect(profile).toMatch(/&& complianceTrackingEnabled && \(/);
    });

    it('the compliance view is gated on the same toggle with an honest off-state', () => {
        const reports = read('src/components/reports/ComplianceReports.tsx');
        expect(reports).toContain('complianceTrackingEnabled');
        expect(reports).toContain('currently');
        // The Stamp & Seal column (JSX entity form).
        expect(reports).toContain('Stamp &amp; Seal');
    });

    it('schema + types carry the firm toggle (persists through Convex)', () => {
        const schema = read('convex/schema.ts');
        expect(schema).toContain('complianceTrackingEnabled: v.optional(v.boolean())');
        const types = read('src/types.ts');
        expect(types).toContain('complianceTrackingEnabled?: boolean;');
    });
});

describe('Numeric input guards — no negative CPD hours, bounded year', () => {
    it('CPD hours clamp to a 0 floor (manual typing + arrow/scroll decrements)', () => {
        const profile = read('src/components/settings/ProfileSettings.tsx');
        expect(profile).toContain('MIN_CPD_HOURS = 0');
        expect(profile).toContain('clampCpdHours');
        expect(profile).toMatch(/Math\.max\(MIN_CPD_HOURS, Math\.min\(raw, 1000\)\)/);
        expect(profile).toMatch(/min=\{MIN_CPD_HOURS\}/);
        // The practicing-fee year has sensible bounds too.
        expect(profile).toContain('MIN_FEE_YEAR = 1990');
        expect(profile).toMatch(/min=\{MIN_FEE_YEAR\}/);
    });

    it('the Stamp & Seal slot is a status record, never an artifact store', () => {
        const profile = read('src/components/settings/ProfileSettings.tsx');
        expect(profile).toMatch(/stampAndSealStatus: e\.target\.value as 'not_submitted' \| 'submitted' \| 'verified'/);
        expect(profile).toMatch(/status only, the seal artifact is held by you/);
    });
});

// ─── 6. Bank accounts: cap + Komplete purpose tagging ──────────────────────

describe('Financial configuration — 5-account cap + fund segregation', () => {
    it('the server enforces the cap (defense in depth, not just the button)', () => {
        const convex = read('convex/myFunctions.ts');
        expect(convex).toContain('MAX_BANK_ACCOUNTS = 5');
        expect(convex).toMatch(/current\.length >= MAX_BANK_ACCOUNTS/);
        expect(convex).toContain('BANK_ACCOUNT_PURPOSES');
        expect(convex).toMatch(/law_firm.*estate_property.*unified/s);
    });

    it('FirmSettings disables Add at 5 with the contact-us message', () => {
        const firm = read('src/components/settings/FirmSettings.tsx');
        expect(firm).toContain('MAX_BANK_ACCOUNTS = 5');
        expect(firm).toContain('bankCapReached');
        expect(firm).toMatch(/reached the \{MAX_BANK_ACCOUNTS\}-account limit/);
        expect(firm).toContain('Contact our team');
    });

    it('the purpose picker is Komplete-only with the three canonical options', () => {
        const form = read('src/components/forms/BankAccountForm.tsx');
        expect(form).toContain('isUnified');
        expect(form).toContain('{isUnified && (');
        expect(form).toMatch(/law_firm.*estate_property.*unified/s);
        // The client mirror of the server cap lives in the form too.
        expect(form).toContain('MAX_BANK_ACCOUNTS = 5');
        expect(form).toContain('capReached');
    });

    it('saved accounts render their purpose badge (estate = green, others = blue)', () => {
        const firm = read('src/components/settings/FirmSettings.tsx');
        expect(firm).toContain('account.purpose');
        expect(firm).toContain("purpose === 'estate_property'");
        expect(firm).toContain('bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700');
        expect(firm).toContain('bg-primary-50 dark:bg-primary-900/20 text-primary-700');
    });

    it('the BankAccount type carries the designation', () => {
        const types = read('src/types.ts');
        expect(types).toContain("export type BankAccountPurpose = 'law_firm' | 'estate_property' | 'unified'");
        expect(types).toMatch(/purpose\?: BankAccountPurpose;/);
    });
});

// ─── 7. The notification bell popover order + labels ────────────────────────

describe('Bell popover — Firm first, default, and short labels', () => {
    it("defaults to 'firm'", () => {
        const header = read('src/components/Header.tsx');
        expect(header).toMatch(/useState<'firm' \| 'platform'>\('firm'\)/);
    });

    it('renders Firm FIRST and uses the short labels', () => {
        const header = read('src/components/Header.tsx');
        const firmPos = header.indexOf('onClick={() => setNotifTab(\'firm\')}');
        const platformPos = header.indexOf('onClick={() => setNotifTab(\'platform\')}');
        expect(firmPos).toBeGreaterThan(-1);
        expect(platformPos).toBeGreaterThan(-1);
        expect(firmPos).toBeLessThan(platformPos);
        expect(header).not.toContain('Firm Notices');
        expect(header).not.toContain('Platform Notices');
        // The short labels exist as standalone text children of their buttons.
        expect(header).toMatch(/\n\s+Firm\n/);
        expect(header).toMatch(/\n\s+Platform\n/);
    });
});
