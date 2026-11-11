/**
 * navParity.test.ts — the K-2 contract: BottomNav and Sidebar apply the
 * SAME entitlement rules (source-scanned — both are React components).
 *
 * Covers required test 9 (Sidebar/BottomNav parity). The rule set pinned
 * here (one interpretation, both surfaces):
 *
 *   | Module      | Visibility                          | Lock                            |
 *   |-------------|-------------------------------------|---------------------------------|
 *   | Properties  | property-capable firms only         | never locked                    |
 *   | Matters     | legal-capable firms only            | never locked                    |
 *   | Documents   | legal-capable firms only            | never locked                    |
 *   | Research    | legal-capable firms only            | Growth+ (else upgrade modal)    |
 *   | Financials  | canViewBilling (role + product)     | property-capable: never; Vega: Pro+ |
 *   | Analytics   | canViewBilling (role + product)     | Growth+ (else upgrade modal)    |
 *
 * Before this round: mobile showed Properties to Vega-only firms, showed
 * Documents to Atrium-only firms, had no plan locks at all (a Core Vega
 * admin could open Research/Financials from mobile while desktop showed
 * them locked), and desktop showed Financials to staff the mobile side
 * correctly hid (canViewBilling false).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolve(here, '../../src/components/BottomNav.tsx'))
    ? resolve(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

const BOTTOM = 'src/components/BottomNav.tsx';
const SIDE = 'src/components/Sidebar.tsx';

describe('BottomNav ↔ Sidebar parity (one entitlement interpretation, both surfaces)', () => {
    const bottom = read(BOTTOM);
    const side = read(SIDE);

    it('both surfaces derive product capability from the SAME context (useProduct)', () => {
        expect(bottom).toContain("useProduct()");
        expect(side).toContain("useProduct()");
        // ...not from a local re-derivation of firmDetails.product
        expect(bottom).not.toContain("firmDetails?.product === 'property'");
    });

    it('Properties: hidden for Vega-only firms on BOTH surfaces', () => {
        // Desktop
        expect(side).toMatch(/\{hasPropertyFeatures && \(/);
        // Mobile
        expect(bottom).toContain("if (item.view === 'properties' && !hasPropertyFeatures) return false;");
    });

    it('Matters/Research/Documents: legal-only modules hidden for Atrium-only firms on BOTH surfaces', () => {
        // Desktop pins isLegal on all three; mobile pins the same filter
        expect(side).toMatch(/\{isLegal && \(/);
        expect(bottom).toContain("if (item.view === 'matters' && !isLegal) return false;");
        expect(bottom).toContain("if (item.view === 'research' && !isLegal) return false;");
        expect(bottom).toContain("if (item.view === 'documents' && !isLegal) return false;");
    });

    it('Research plan lock (Growth+) applies on BOTH surfaces and opens the SAME upgrade modal', () => {
        expect(side).toContain('locked={!features.canUseResearchStudio}');
        expect(side).toContain("openModal('upgradePlan')");
        expect(bottom).toContain('research: !features.canUseResearchStudio,');
        expect(bottom).toContain("openModal('upgradePlan')");
    });

    it('Financials: property-capable firms never lock, Vega-only firms lock below Pro — BOTH surfaces', () => {
        expect(side).toContain('locked={hasPropertyFeatures ? false : !features.canUseAdvancedBilling}');
        expect(bottom).toContain('billing: !hasPropertyFeatures && !features.canUseAdvancedBilling,');
    });

    it('Financials/Analytics visibility uses the SAME role+product permission on BOTH surfaces', () => {
        // Desktop gates the items on permissions.canViewBilling
        expect(side).toContain('{permissions.canViewBilling && (');
        expect(side).toContain('const permissions = usePermissions();');
        // Mobile's static list already permission-gates both items
        expect(bottom).toMatch(/view: 'billing'.*p\.canViewBilling/);
        expect(bottom).toMatch(/view: 'reporting'.*p\.canViewBilling/);
    });

    it('Analytics plan lock (Growth+) applies on BOTH surfaces', () => {
        expect(side).toContain('locked={!features.canUseReportGenerator}');
        expect(bottom).toContain('reporting: !features.canUseReportGenerator,');
    });

    it('mobile locks are enforced on tap for BOTH the primary bar and the More sheet', () => {
        expect(bottom).toContain('const handleNavTap = (e: React.MouseEvent, view: View) => {');
        expect(bottom).toContain('if (lockedViews[view]) {');
        // More sheet honors the same locks
        expect(bottom).toMatch(/handleMoreItemClick[\s\S]*?if \(lockedViews\[view\]\)/);
    });

    it('the one entitlement source: BOTH surfaces consume useFeatures (utils/entitlements.ts)', () => {
        expect(bottom).toContain("useFeatures()");
        expect(side).toContain("const features = useFeatures();");
    });
});

describe('Desktop CommandPalette agrees with the nav surfaces', () => {
    const palette = read('src/components/CommandPalette.tsx');

    it('uses the authoritative product context (no local re-derivation)', () => {
        expect(palette).toContain("const { isLegal, hasPropertyFeatures } = useProduct();");
        expect(palette).not.toContain("firmProduct === 'unified'");
    });

    it('property results and commands render only for property-capable firms', () => {
        expect(palette).toMatch(/if \(isPropertyFirm\) \{/);
        expect(palette).toContain("...(isPropertyFirm ? ([{ id: 'nav-properties'");
    });

    it('legal-only commands (Matters, Research) render only for legal-capable firms', () => {
        expect(palette).toContain("...(isLegalFirm ? ([{ id: 'nav-matters'");
        expect(palette).toContain("...(isLegalFirm ? ([{ id: 'nav-research'");
    });
});

describe('Backend entitlement parity (K-3 server-side)', () => {
    it('estateCommunity requires a property-capable product (matches the frontend gate)', () => {
        const ec = read('convex/estateCommunity.ts');
        expect(ec).toContain("firmProduct === 'property' || firmProduct === 'atrium'");
        expect(ec).toContain("|| firmProduct === 'unified' || firmProduct === 'komplete'");
        expect(ec).toContain('if (!isPropertyCapable) return false;');
    });

    it('tierLimits no longer grants unlimited limits to unified-product firms on lower plans', () => {
        const tl = read('convex/tierLimits.ts');
        expect(tl).toContain('isUnifiedEntitledPlan');
        expect(tl).toContain('effectiveFirmPlan');
        // The unified non-entitled branch applies BOTH limit tables
        expect(tl).toContain('const vega = VEGA_LIMITS[p] || VEGA_LIMITS.Core;');
        expect(tl).toContain('const atrium = ATRIUM_LIMITS[p] || ATRIUM_LIMITS.Core;');
    });
});
