/**
 * coreServicesToggle.test.ts — regression guard for the founder request
 * (2026-09-17): "all things can be turned off, including service charge".
 *
 * ROOT CAUSE THIS FILE PINS:
 * The Property form's Core Services grid hard-locked Service Charge as
 * always-active — a disabled toggle with a padlock, "Service Charge is
 * always active" tooltip, AND a save-path force
 * (`coreServices: { ...coreServices, serviceCharge: true }`) that silently
 * re-enabled it even if state drifted. The Residents' Portal dashboard
 * then hardcoded its Service Charge tile to `disabled: false`, ignoring
 * the flag entirely — so even a stored `serviceCharge: false` never
 * reached residents.
 *
 * CONTRACT (source-scanned, house pattern — see strictIdentityCallSites):
 *   1. PropertyForm must NOT force serviceCharge back on at save time.
 *   2. No service in the Core Services grid may be locked/untoggleable.
 *   3. The Residents' Portal Service Charge tile must gate on
 *      coreServices.serviceCharge exactly like electricity/internet/waste.
 *   4. The backend passes the stored flag through (default true for
 *      legacy properties) — the chain from toggle → resident is unbroken.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolve(here, '../../convex/schema.ts'))
    ? resolve(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

describe('core services: every service is toggleable, service charge included', () => {
    it('PropertyForm — save path does not force serviceCharge back on', () => {
        const src = read('src/components/forms/PropertyForm.tsx');
        // The old force — must be gone:
        expect(src).not.toContain('coreServices: { ...coreServices, serviceCharge: true }');
        // The honest save — persists exactly what the manager toggled:
        expect(src).toMatch(/coreServices,\n/);
    });

    it('PropertyForm — no locked/untoggleable services in the Core Services grid', () => {
        const src = read('src/components/forms/PropertyForm.tsx');
        expect(src).not.toContain('locked: true');
        expect(src).not.toContain('disabled={service.locked}');
        expect(src).not.toContain('Service Charge is always active');
        // Every service key is toggleable through the same handler:
        expect(src).toMatch(/\{ key: 'serviceCharge' as const, label: 'Service Charge' \}/);
        expect(src).toMatch(/onClick=\{\(\) => setCoreServices\(prev => \(\{ \.\.\.prev, \[service\.key\]: !prev\[service\.key\] \}\)\)\}/);
    });

    it('Residents Portal — Service Charge tile gates on coreServices.serviceCharge', () => {
        const src = read('src/components/tenant/TenantPortal/DashboardTab.tsx');
        // The exact gating pattern used by the other core services:
        expect(src).toContain(
            "label: 'Service Charge', tab: 'ledger' as TabId, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400', disabled: !coreServices.serviceCharge"
        );
        // The hardcoded always-on tile must stay dead:
        expect(src).not.toMatch(/label: 'Service Charge',[^\n]*disabled: false/);
    });

    it('backend — schema allows serviceCharge: false and portals pass it through', () => {
        const schema = read('convex/schema.ts');
        expect(schema).toMatch(/coreServices: v\.optional\(v\.object\(\{[\s\S]*?serviceCharge: v\.optional\(v\.boolean\(\)\)/);

        const portals = read('convex/portals.ts');
        // Pass-through with legacy-friendly default (properties without the
        // field keep behaving as service-charge-active):
        expect(portals).toContain('serviceCharge: primaryPropertyRecord?.coreServices?.serviceCharge ?? true');
    });
});
