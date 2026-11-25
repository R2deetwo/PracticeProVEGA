/**
 * vmsEntitlement.test.ts — VMS / Sentry Pass entitlement gate contract.
 *
 * WHY SOURCE-SCAN: the gate lives inside a Convex mutation that needs the
 * Convex runtime + a firm record to execute, so we pin the CONTRACT on the
 * source (the house pattern from automationEngine.test.ts PART 3): if
 * someone re-adds a tier bypass or the "Included in your plan" UI, this
 * file fails CI.
 *
 * OWNER RULE (2026-11-22) — the contract REVERSED:
 *   "The sentry pass should always be an add-on that can be gotten by
 *   anybody if they want… it should be an add-on always… it shouldn't come
 *   automatically with complete."
 *
 * PINS (one per user-visible promise):
 *   1. NO tier-based bypass: the gate never special-cases Komplete or
 *      Enterprise — every firm passes the same add-on status check, so a
 *      Komplete firm with vms.status 'none' hits VMS_ADDON_REQUIRED like
 *      everyone else.
 *   2. getVmsAddonStatus returns only real add-on statuses
 *      (none/trial/active/expired) — the synthetic 'included' status is
 *      gone, so every plan sees the trial/purchase path.
 *   3. VmsAddonPanel has no "Included with your … plan" state — the
 *      add-on price header and the trial/purchase CTAs render for all.
 *   4. The add-on gate branches survive for firms without an add-on
 *      (VMS_ADDON_REQUIRED / VMS_TRIAL_EXPIRED + trial auto-expiry).
 *   5. No marketing surface promises Sentry Pass "included" with any
 *      plan — the Atrium FAQ sells it as an add-on for every plan.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolve(here, '../../convex/visitorManagement.ts'))
    ? resolve(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

const GATE = 'convex/visitorManagement.ts';
const MYFNS = 'convex/myFunctions.ts';
const SUBS = 'src/components/settings/SubscriptionSettings.tsx';

describe('VMS / Sentry Pass entitlement gate (source-scanned contract)', () => {
    const gate = read(GATE);

    it('1. NO tier bypass: Komplete/Enterprise are never special-cased in the gate', () => {
        // The Aug 2026 bypass line is deleted for good.
        expect(gate).not.toContain('isVmsIncludedInPlan');
        expect(gate).not.toContain("plan === 'Komplete' || plan === 'Enterprise'");
        // The add-on check runs unconditionally inside `if (firm)` —
        // the owner rule comment marks the reversal. Scoped to
        // generateVisitorToken's own body: TASK 94 extracted a canonical
        // assertVmsEntitlement (SAME rules, used by issueStaffPass) above it,
        // so a whole-file index scan would hit the copy first.
        const genBody = gate.slice(gate.indexOf('export const generateVisitorToken'), gate.indexOf('export const sendVisitorWhatsApp'));
        expect(genBody).toContain('ADD-ON GATE (owner rule, 2026-11-22)');
        const ruleIdx = genBody.indexOf('ADD-ON GATE (owner rule, 2026-11-22)');
        const addonCheckIdx = genBody.indexOf("const vmsAddon = (firm.subscriptionAddons as any)?.vms;");
        const requiredIdx = genBody.indexOf('VMS_ADDON_REQUIRED');
        expect(ruleIdx).toBeGreaterThan(-1);
        expect(addonCheckIdx).toBeGreaterThan(ruleIdx);
        expect(requiredIdx).toBeGreaterThan(addonCheckIdx);
    });

    it('2. getVmsAddonStatus never returns the synthetic "included" status', () => {
        const fns = read(MYFNS);
        const statusIdx = fns.indexOf('export const getVmsAddonStatus');
        expect(statusIdx).toBeGreaterThan(-1);
        const body = fns.slice(statusIdx, statusIdx + 2500);
        expect(body).not.toContain("status: 'included'");
        expect(body).not.toContain("plan === 'Komplete'");
        // the real statuses survive
        expect(body).toContain("status: 'none' as const");
    });

    it('3. VmsAddonPanel has NO included state — every plan sees the add-on price', () => {
        const subs = read(SUBS);
        const panelIdx = subs.indexOf('const VmsAddonPanel');
        expect(panelIdx).toBeGreaterThan(-1);
        const panel = subs.slice(panelIdx, panelIdx + 9000);
        expect(panel).not.toContain("status === 'included'");
        expect(panel).not.toContain('Included with your');
        expect(panel).not.toContain('no add-on activation needed');
        // the add-on price header + trial CTA survive for everyone
        expect(panel).toContain('Start 30-Day Free Trial');
    });

    it('4. NO REGRESSION: firms without the add-on still hit the gate', () => {
        expect(gate).toContain('VMS_ADDON_REQUIRED');
        expect(gate).toContain('VMS_TRIAL_EXPIRED');
        // The trial-expiry auto-marking (trial → expired) must survive.
        expect(gate).toContain("vmsAddon.status = 'expired'");
    });

    it('5. no marketing surface promises Sentry Pass "included" with any plan', () => {
        const faq = read('src/sites/atrium/sections/AtriumFAQ.tsx');
        expect(faq).not.toContain('included at no extra cost on Komplete');
        // it is sold as an add-on available to every plan
        expect(faq).toContain('₦7,500/month as an add-on');
    });

    it('6. the Komplete tier definition never mentions Sentry Pass (owner: no need to mention it inside Komplete)', () => {
        const tiers = read('src/constants/tiers.ts');
        const kIdx = tiers.indexOf('export const KOMPLETE_TIER');
        expect(kIdx).toBeGreaterThan(-1);
        const kBody = tiers.slice(kIdx, tiers.indexOf('export', kIdx + 10) === -1 ? kIdx + 4000 : tiers.indexOf('export', kIdx + 10));
        expect(kBody).not.toMatch(/sentry/i);
        expect(kBody).not.toMatch(/VMS/i);
        // the upgrade modal list is equally clean
        const modal = read('src/components/modals/UpgradeModal.tsx');
        expect(modal).not.toContain('Sentry Pass (VMS) included');
    });
});
