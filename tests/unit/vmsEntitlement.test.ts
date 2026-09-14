/**
 * vmsEntitlement.test.ts — VMS / Sentry Pass entitlement gate contract.
 *
 * WHY SOURCE-SCAN: the gate lives inside a Convex mutation that needs the
 * Convex runtime + a firm record to execute, so we pin the CONTRACT on the
 * source (the house pattern from automationEngine.test.ts PART 3): if
 * someone deletes or reorders the tier bypass, the add-on branch, or the
 * "Included in your plan" UI, this file fails CI.
 *
 * PINS (one per user-visible promise):
 *   1. The gate has a tier-based bypass for Komplete (the tier the pricing
 *      page promises "included at no extra cost on Komplete") — and it runs
 *      BEFORE the add-on status check, so a Komplete firm never sees
 *      VMS_ADDON_REQUIRED even with subscriptionAddons.vms.status 'none'.
 *   2. getVmsAddonStatus returns a DISTINCT 'included' status (not
 *      active/trial/none) so the panel can render the included state.
 *   3. VmsAddonPanel renders "Included with your … plan" + no add-on fee
 *      for status 'included' (no trial/purchase CTA for those tiers).
 *   4. NO REGRESSION for below-Komplete tiers: the VMS_ADDON_REQUIRED and
 *      VMS_TRIAL_EXPIRED branches must still exist for Starter/Core/Growth/
 *      Pro firms without an add-on.
 *   5. The pricing-page promise copy and the gate stay in sync: if the
 *      "included at no extra cost on Komplete" claim is removed from the
 *      landing page, this test fails so the gate copy is revisited too.
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
const LANDING = 'src/components/LandingPage.tsx';

describe('VMS / Sentry Pass entitlement gate (source-scanned contract)', () => {
    const gate = read(GATE);

    it('1. tier bypass exists for Komplete (and Enterprise) before the add-on check', () => {
        const bypass = "const isVmsIncludedInPlan = plan === 'Komplete' || plan === 'Enterprise';";
        expect(gate).toContain(bypass);

        // ORDER MATTERS: the bypass must be evaluated BEFORE the add-on
        // status branch — otherwise a Komplete firm with vms.status 'none'
        // would still hit VMS_ADDON_REQUIRED.
        const bypassIdx = gate.indexOf(bypass);
        const addonCheckIdx = gate.indexOf('if (!isVmsIncludedInPlan)');
        const requiredIdx = gate.indexOf('VMS_ADDON_REQUIRED');
        expect(bypassIdx).toBeGreaterThan(-1);
        expect(addonCheckIdx).toBeGreaterThan(bypassIdx);
        expect(requiredIdx).toBeGreaterThan(addonCheckIdx);
    });

    it('2. getVmsAddonStatus returns a distinct "included" status for qualifying plans', () => {
        const fns = read(MYFNS);
        const statusIdx = fns.indexOf('export const getVmsAddonStatus');
        expect(statusIdx).toBeGreaterThan(-1);
        const body = fns.slice(statusIdx, statusIdx + 2500);
        expect(body).toContain("plan === 'Komplete' || plan === 'Enterprise'");
        expect(body).toContain("status: 'included'");
    });

    it('3. VmsAddonPanel renders the included state (badge + copy, no trial/purchase CTA)', () => {
        const subs = read(SUBS);
        const panelIdx = subs.indexOf('const VmsAddonPanel');
        expect(panelIdx).toBeGreaterThan(-1);
        const panel = subs.slice(panelIdx, panelIdx + 9000);
        expect(panel).toContain("status === 'included'");
        expect(panel).toContain('Included with your');
        expect(panel).toContain('no add-on activation needed');
    });

    it('4. NO REGRESSION: below-Komplete firms still hit the add-on gate', () => {
        expect(gate).toContain('VMS_ADDON_REQUIRED');
        expect(gate).toContain('VMS_TRIAL_EXPIRED');
        // The trial-expiry auto-marking (trial → expired) must survive.
        expect(gate).toContain("vmsAddon.status = 'expired'");
    });

    it('5. pricing promise copy and gate stay in sync ("included at no extra cost on Komplete")', () => {
        const landing = read(LANDING);
        expect(landing).toContain('included at no extra cost on Komplete');
    });
});
