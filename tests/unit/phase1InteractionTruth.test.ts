/**
 * phase1InteractionTruth.test.ts — Phase 1 (interaction-truth quick wins)
 * regression tests, per the 2026-11-12 Phase 0 UI/UX audit roadmap
 * (docs/audits/2026-11-12-phase0-ux-audit.md, roadmap row 1).
 *
 * Scope of this round (all rated S in the register):
 *   UX-05 the permanently-stubbed Case Law tab is folded into AI Notebooks
 *   UX-06 the matter-stage success toast now reflects the actual write
 *   UX-09 the public vacancy application names the actual property
 *   UX-10 the Estate Community upsell CTAs are wired (were #subscription)
 *   UX-11 the vacancy pipeline distinguishes loading from empty
 *   UX-12 portal invite links derive from the (allowlisted) deployment origin
 *   UX-25 the invoice status filter has a rendered control
 *   UX-30 the rent ledger skeleton gates on real hydration
 *   UX-31 expected rent never falls back to the property valuation
 *   UX-39 the upgrade modal names the ACTIVE product's assistant
 *   UX-40 the dashboard money KPI follows canViewBilling (not isAdmin)
 *   UX-41 the contact Properties tab is visible for property-capable firms
 *   UX-49 the workspace switcher surfaces failure (was silent catch)
 *   UX-58 the last native window.prompt is gone
 *   UX-60 the demo persona gets honest search copy
 *
 * Plus the 2026-11-12 production Research crash hotfix:
 *   getResearchMessages/getResearchAnalysisResults resolve a notebook by its
 *   CLIENT uuid (nb.id) without handing it to db.get() — covered by the
 *   extended roundDWave3b suite; here we pin the caller contract.
 *
 * Testing style: source-contract tests (the R16/R77/R79/R80 pattern) plus a
 * real unit test of the client origin resolver.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allowedPortalOrigin, portalInviteUrl, portalSetupPasswordBase } from '../../src/utils/portalOrigins';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

/** Recursively collect .ts/.tsx files under a directory (for repo-wide bans). */
function collectFiles(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(resolvePath(repoRoot, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.git') continue;
            collectFiles(rel, acc);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
            acc.push(rel);
        }
    }
    return acc;
}

describe('Phase 1 — UX-05: the Case Law stub tab is folded into AI Notebooks', () => {
    const src = read('src/components/ResearchView.tsx');

    it('no longer renders the Case Law tab or mounts LawReportsView', () => {
        expect(src).not.toContain("{ id: 'case_law', label: 'Case Law' }");
        expect(src).not.toContain("<LawReportsView />");
        expect(src).not.toContain("import LawReportsView");
    });

    it('keeps the corpus disclosure where research actually happens', () => {
        expect(src).toContain('LAW_REPORTS_DISCLOSURE');
        // the disclosure is rendered inside the AI Notebooks empty state
        const placeholderAt = src.indexOf('const ResearchPlaceholder');
        const disclosureAt = src.indexOf('{LAW_REPORTS_DISCLOSURE}');
        expect(placeholderAt).toBeGreaterThan(-1);
        expect(disclosureAt).toBeGreaterThan(placeholderAt);
    });

    it('the LawReportsView component file survives for the licensed-corpus future (no feature deleted)', () => {
        expect(existsSync(resolvePath(repoRoot, 'src/components/research/LawReportsView.tsx'))).toBe(true);
    });
});

describe('Phase 1 — UX-06: the matter-stage toast reflects the actual write', () => {
    const src = read('src/components/details/MatterDetailView.tsx');

    it('awaits the mutation before the success toast', () => {
        expect(src).toContain('await onUpdateStage(matterData!.id, newStage);');
        // the toast is INSIDE the try, after the await — not fired blind
        const tryAt = src.indexOf('await onUpdateStage(matterData!.id, newStage);');
        const toastAt = src.indexOf('`Matter moved to ${newStage}`');
        expect(tryAt).toBeGreaterThan(-1);
        expect(toastAt).toBeGreaterThan(tryAt);
    });

    it('updateMatter is a promise-returning action (the await is real)', () => {
        const ctxSrc = read('src/contexts/MatterContext.tsx');
        expect(ctxSrc).toContain('updateMatter: (matter: Partial<Matter> & { id: string }) => Promise<void>');
    });
});

describe('Phase 1 — UX-09: the public vacancy application names the property', () => {
    const src = read('src/components/atrium/AtriumPublicApplicationForm.tsx');

    it('the fetched property address wins over the generic route label', () => {
        expect(src).toContain("const displayName = ((property as any)?.address) || propertyName;");
        // header and success state both use the resolved name
        expect(src).toContain('Applying for:');
        expect(src).toContain('Thank you for your interest in {displayName}');
    });
});

describe('Phase 1 — UX-10: the Estate Community upsell CTAs are wired', () => {
    const src = read('src/components/settings/EstateCommunitySettings.tsx');

    it('no dead #subscription anchors remain', () => {
        expect(src).not.toContain('href="#subscription"');
        expect(src).toContain("openModal('upgradePlan')");
    });
});

describe('Phase 1 — UX-11: the vacancy pipeline distinguishes loading from empty', () => {
    const src = read('src/components/atrium/VacancyPipeline.tsx');

    it('gates the board on the live query resolving', () => {
        expect(src).toContain('liveLeads === undefined && Boolean(firmId)');
        // the loading branch renders a status indicator, not "No applicants"
        expect(src).toContain('Loading vacancy pipeline');
    });
});

describe('Phase 1 — UX-30: the rent ledger skeleton gates on real hydration', () => {
    const src = read('src/components/atrium/LedgerManager.tsx');

    it('uses the isDataLoaded flag, not the coerced entries array', () => {
        expect(src).toContain('{!isDataLoaded ? (');
        // the dead `!entries` gate is gone
        expect(src).not.toContain('{!entries ? (');
    });
});

describe('Phase 1 — UX-31: expected rent never falls back to the valuation', () => {
    const src = read('src/components/reports/PropertyReports.tsx');

    it('the || p.value fallback is gone', () => {
        expect(src).not.toContain('p.rentalDetails?.rentAmount || p.value');
        expect(src).toContain('p.rentalDetails?.rentAmount || 0');
    });
});

describe('Phase 1 — UX-39: the upgrade modal names the ACTIVE product assistant', () => {
    const src = read('src/components/modals/UpgradeModal.tsx');

    it('derives the assistant name from the product context', () => {
        expect(src).toContain('getAssistantName(isProperty)');
        expect(src).not.toContain('"ARIA AI Copilot (Uncapped Priority)"');
        expect(src).not.toContain('"ARIA AI Assistant (Uncapped Priority)"');
    });
});

describe('Phase 1 — UX-40: the dashboard money KPI follows canViewBilling', () => {
    const src = read('src/components/dashboard/StatsWidget.tsx');

    it('the OutstandingCard gate is the same rule as the Financials view', () => {
        expect(src).toContain('const { canViewBilling } = usePermissions();');
        expect(src).toContain('const showFinanceCard = canViewBilling && (isLegal || hasPropertyFeatures);');
        // the admin-only gate is gone
        expect(src).not.toContain('const showFinanceCard = isAdmin &&');
    });
});

describe('Phase 1 — UX-41: the contact Properties tab is the bridge entry point', () => {
    const src = read('src/components/details/ContactDetailView.tsx');

    it('visible for property-capable firms even with zero properties', () => {
        expect(src).toContain('const showPropertiesTab = hasPropertyFeatures || hasRealEstateMatters || allProperties.length > 0;');
        expect(src).toContain('{showPropertiesTab && (');
    });

    it('the empty state points at the Add Property action', () => {
        expect(src).toContain("Use “Add Property” above to record this contact's first property.");
    });
});

describe('Phase 1 — UX-49: the workspace switcher surfaces failure', () => {
    const src = read('src/components/Sidebar.tsx');

    it('no silent catch remains', () => {
        expect(src).not.toContain('// Error handled silently');
        expect(src).toContain('Could not switch workspace');
        expect(src).toContain("addToast(");
    });
});

describe('Phase 1 — UX-58: no native dialogs remain anywhere in the app', () => {
    it('window.prompt is gone from src/ (window.confirm/alert were already migrated in V7)', () => {
        const offenders: string[] = [];
        for (const f of collectFiles('src')) {
            if (read(f).includes('window.prompt')) offenders.push(f);
        }
        expect(offenders).toEqual([]);
    });

    it('FirmSettings deactivation uses the app confirmation dialog', () => {
        expect(read('src/components/settings/FirmSettings.tsx')).not.toContain('window.prompt');
        expect(read('src/components/settings/FirmSettings.tsx')).toContain("openModal('deleteConfirmation'");
    });
});

describe('Phase 1 — UX-60: honest search copy for the demo persona', () => {
    const src = read('src/components/FullScreenSearch.tsx');

    it('branches the !canSearch copy on the demo state', () => {
        expect(src).toContain("{isDemo");
        expect(src).toContain('Search is disabled in the demo build');
        expect(src).toContain('Sign in with your firm account to search');
    });
});

describe('Phase 1 — UX-25: the invoice status filter has a control', () => {
    const src = read('src/components/BillingView.tsx');

    it('the statusFilter state is now rendered as a select', () => {
        expect(src).toContain('id="invoice-status-filter"');
        expect(src).toContain("value={statusFilter}");
        expect(src).toContain("(Object.values(InvoiceStatus) as InvoiceStatus[])");
    });
});

describe('Phase 1 — UX-12: portal invite links derive from the allowlisted deployment origin', () => {
    it('the server resolves the base from an allowlist, not a hard-coded domain', () => {
        const src = read('convex/portals.ts');
        expect(src).toContain('function resolvePortalBase(');
        // both former hard-coded sites now derive
        expect(src).not.toContain('const portalBase = "https://practice-pro-vega.vercel.app/setup-password";');
        expect(src.match(/resolvePortalBase\(args\.origin\)/g)?.length).toBe(2);
        // the invite action returns the exact link the email carries
        expect(src).toContain('inviteUrl: string;');
        expect(src).toContain('return {\n      inviteId,\n      token,\n      inviteUrl,');
    });

    it('the client passes the deployment origin on create and resend', () => {
        const src = read('src/components/settings/PortalAccessSettings.tsx');
        expect(src).toContain('origin: window.location.origin');
        expect(src).not.toContain("const inviteLink = `https://practice-pro-vega.vercel.app/setup-password?token=");
    });

    it('client resolver: known origins pass, unknown origins fall back to production', () => {
        expect(allowedPortalOrigin('https://practice-pro-vega.vercel.app')).toBe('https://practice-pro-vega.vercel.app');
        expect(allowedPortalOrigin('https://practice-pro-vega.prototypechigo.workers.dev')).toBe('https://practice-pro-vega.prototypechigo.workers.dev');
        // a Vercel preview of this project is a known deployment
        expect(allowedPortalOrigin('https://practice-pro-vega-git-staging-abc123.vercel.app')).toBe('https://practice-pro-vega-git-staging-abc123.vercel.app');
        // trailing slashes are tolerated
        expect(allowedPortalOrigin('https://practice-pro-vega.vercel.app/')).toBe('https://practice-pro-vega.vercel.app');
        // hostile/unknown origins fall back to production — never pass through
        expect(allowedPortalOrigin('https://evil-phishing.example.com')).toBe('https://practice-pro-vega.vercel.app');
        expect(allowedPortalOrigin(null)).toBe('https://practice-pro-vega.vercel.app');
        expect(allowedPortalOrigin('')).toBe('https://practice-pro-vega.vercel.app');
        // look-alike domains do not match the preview pattern
        expect(allowedPortalOrigin('https://practice-pro-vega.evil.example.com')).toBe('https://practice-pro-vega.vercel.app');
    });

    it('client resolver: invite URLs are built on the resolved base', () => {
        expect(portalSetupPasswordBase('https://practice-pro-vega.vercel.app')).toBe('https://practice-pro-vega.vercel.app/setup-password');
        expect(portalInviteUrl('tok 123', undefined)).toBe('https://practice-pro-vega.vercel.app/setup-password?token=tok%20123');
    });
});

describe('Phase 1 — Research hotfix: the caller passes the notebook client id (nb.id)', () => {
    it('ResearchView keys both research reads on selectedNotebook.id and skips until a notebook exists', () => {
        const src = read('src/components/ResearchView.tsx');
        expect(src).toContain('notebookId: selectedNotebook.id, sessionToken: bearerToken ?? undefined');
        expect(src).toContain('selectedNotebook && bearerToken');
    });
});
