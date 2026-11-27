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
 * ENTITLEMENT RESTRUCTURE (2026-11-27) — the gate is now TWO server-side
 * layers on the firm record (never a plan-name check in a UI component):
 *   1. PRODUCT SCOPE — Vega (legal-only) workspaces can never hold VMS
 *      (VMS_NOT_AVAILABLE, Forbidden).
 *   2. CAPABILITY — firms.vmsEnabled === true, granted only by founder
 *      approval (decideVmsAccessRequest) or the cutover backfill
 *      (migrations.backfillVmsEntitlementFlags). Absent flag = rejected
 *      (VMS_NOT_ENABLED).
 *   3. BILLING — the separately-purchased add-on
 *      (firm.subscriptionAddons.vms) per the 2026-11-22 owner rule: every
 *      plan, Komplete and Enterprise included.
 *
 * PINS (one per user-visible promise):
 *   1. NO tier-based bypass: the gate never special-cases Komplete or
 *      Enterprise — every firm passes the same checks, so a Komplete firm
 *      without vmsEnabled/add-on hits the gate like everyone else.
 *   2. The capability gate enforces firms.vmsEnabled === true, and Vega
 *      firms are Forbidden outright.
 *   3. getVmsAddonStatus returns only real add-on statuses
 *      (none/trial/active/expired) — the synthetic 'included' status is
 *      gone, so every plan sees the trial/purchase path.
 *   4. VmsAddonPanel has no "Included with your … plan" state — the
 *      add-on price header (annual, approval-required) and the
 *      trial/purchase CTAs render for all.
 *   5. The add-on gate branches survive for firms without an add-on
 *      (VMS_ADDON_REQUIRED / VMS_TRIAL_EXPIRED + trial auto-expiry).
 *   6. No marketing surface promises Sentry Pass "included" with any
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
        // The canonical gate (assertVmsEntitlementCore) runs the add-on
        // check unconditionally — the owner rule comment marks it, and
        // generateVisitorToken delegates to the SAME canonical gate
        // (TASK 94 extracted it; the 2026-11-27 restructure added the
        // capability layer above it).
        const coreIdx = gate.indexOf('async function assertVmsEntitlementCore');
        expect(coreIdx).toBeGreaterThan(-1);
        const core = gate.slice(coreIdx, gate.indexOf('export async function assertVmsEntitlement'));
        expect(core).toContain('ADD-ON GATE (owner rule, 2026-11-22)');
        const ruleIdx = core.indexOf('ADD-ON GATE (owner rule, 2026-11-22)');
        const addonCheckIdx = core.indexOf('const vmsAddon = (firm.subscriptionAddons as any)?.vms;');
        const requiredIdx = core.indexOf('VMS_ADDON_REQUIRED');
        expect(ruleIdx).toBeGreaterThan(-1);
        expect(addonCheckIdx).toBeGreaterThan(ruleIdx);
        expect(requiredIdx).toBeGreaterThan(addonCheckIdx);
        // generateVisitorToken routes through the canonical gate — no
        // parallel inline copy can drift back in.
        const genBody = gate.slice(gate.indexOf('export const generateVisitorToken'), gate.indexOf('export const sendVisitorWhatsApp'));
        expect(genBody).toContain('await assertVmsEntitlement(ctx, args.firmId);');
        // EVERY public VMS query/mutation routes through the entitlement
        // core (2026-11-27 acceptance: enforce vmsEnabled on the backend).
        for (const fn of [
            'generateVisitorToken', 'verifyToken', 'checkInVisitor', 'checkOutVisitor',
            'revokeVisitorToken', 'getResidentTokens', 'getGatehouseLogs',
            'getGatekeeperProperties', 'recordDeniedEntry', 'searchExpectedVisitors',
            'getSentryDailyReport', 'getSentryOnSite', 'getSentryHistorical',
            'getSentrySecurityReport', 'issueStaffPass', 'getStaffAttendance',
        ]) {
            const start = gate.indexOf(`export const ${fn} =`);
            expect(start).toBeGreaterThan(-1);
            const end = gate.indexOf('export const', start + 10) === -1 ? gate.length : gate.indexOf('export const', start + 10);
            const body = gate.slice(start, end);
            expect(
                body.includes('assertVmsEntitlement') || body.includes('assertVmsEntitlementReadOnly') || body.includes('assertVmsEntitlementForProperty'),
                `${fn} must route through the canonical VMS entitlement gate`,
            ).toBe(true);
        }
    });

    it('2. CAPABILITY gate: vmsEnabled === true required; Vega is Forbidden', () => {
        const coreIdx = gate.indexOf('async function assertVmsEntitlementCore');
        const core = gate.slice(coreIdx, gate.indexOf('export async function assertVmsEntitlement'));
        // The capability flag is checked strictly (absent = not enabled).
        expect(core).toContain('firm.vmsEnabled !== true');
        expect(core).toContain('VMS_NOT_ENABLED');
        // Vega (legal-only) workspaces are Forbidden outright — the
        // isLegalOnlyProduct helper + its core gate call.
        expect(core).toContain('VMS_NOT_AVAILABLE');
        expect(core).toContain('isLegalOnlyProduct(firm)');
        expect(gate).toContain("product === 'legal' || product === 'vega'");
    });

    it('3. getVmsAddonStatus never returns the synthetic "included" status', () => {
        const fns = read(MYFNS);
        const statusIdx = fns.indexOf('export const getVmsAddonStatus');
        expect(statusIdx).toBeGreaterThan(-1);
        const body = fns.slice(statusIdx, statusIdx + 2500);
        expect(body).not.toContain("status: 'included'");
        expect(body).not.toContain("plan === 'Komplete'");
        // the real statuses survive
        expect(body).toContain("status: 'none' as const");
    });

    it('4. VmsAddonPanel has NO included state — every plan sees the add-on price', () => {
        const subs = read(SUBS);
        const panelIdx = subs.indexOf('const VmsAddonPanel');
        expect(panelIdx).toBeGreaterThan(-1);
        const panel = subs.slice(panelIdx, subs.indexOf('const VmsKompleteAddonCard'));
        expect(panel).not.toContain("status === 'included'");
        expect(panel).not.toContain('Included with your');
        expect(panel).not.toContain('no add-on activation needed');
        // the annual add-on price header + trial CTA survive for everyone
        expect(panel).toContain('90,000');
        expect(panel).toContain('Start 30-Day Free Trial');
        // 2026-11-27: approval-required positioning — the request path
        // renders for workspaces without the founder-approved capability.
        expect(panel).toContain('Approval Required');
        expect(panel).toContain('Request Activation');
        // The Komplete variant card is clearly an EXTERNAL add-on, never an
        // included feature.
        const kIdx = subs.indexOf('const VmsKompleteAddonCard');
        expect(kIdx).toBeGreaterThan(-1);
        const kCard = subs.slice(kIdx, kIdx + 3200);
        expect(kCard).toContain('External Estate Operations Add-On');
        expect(kCard).not.toContain('Included');
        // The panel only renders for Atrium; the external card for Komplete.
        expect(subs).toContain("resolveProductMode(firmDetails.product) === 'property'");
        expect(subs).toContain("resolveProductMode(firmDetails.product) === 'unified'");
    });

    it('5. NO REGRESSION: firms without the add-on still hit the gate', () => {
        expect(gate).toContain('VMS_ADDON_REQUIRED');
        expect(gate).toContain('VMS_TRIAL_EXPIRED');
        // The trial-expiry auto-marking (trial → expired) must survive.
        expect(gate).toContain("vmsAddon.status = 'expired'");
    });

    it('6. no marketing surface promises Sentry Pass "included" with any plan', () => {
        const faq = read('src/sites/atrium/sections/AtriumFAQ.tsx');
        expect(faq).not.toContain('included at no extra cost on Komplete');
        // it is sold as an add-on available to every plan
        expect(faq).toContain('₦7,500/month as an add-on');
    });

    it('7. the Komplete tier definition never mentions Sentry Pass (owner: no need to mention it inside Komplete)', () => {
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
