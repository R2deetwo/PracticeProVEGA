/**
 * phaseRoundI.test.ts — UX-14 (server search parity) + UX-38 (Financials
 * tab/scope behaviour) + UX-56 (onboarding banner dedup) source contracts.
 *
 * UX-14: the desktop CommandPalette routes DATA queries through the same
 *   api.search.searchAll server index as mobile FullScreenSearch — the
 *   1,000-row/table client sync cap used to give the two form factors
 *   different answers. Commands stay local; the legacy client index is the
 *   demo/no-auth fallback; the 15-row cap now discloses what it hides.
 * UX-38: property firms land on Overview (not the legal-flavoured Invoices
 *   tab), a scope switch falls back to the scope's natural home tab instead
 *   of dumping the user on the first tab of the new list, and deep links
 *   keep priority.
 * UX-56: the Dashboard banner stack is deduplicated against the sidebar
 *   checklist — ONE shared progress number, welcome suppressed at >=50%,
 *   and the setup banner only renders once the checklist is dismissed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checklistProgressPct } from '../../src/components/GettingStartedChecklist';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const src = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf8');

describe('UX-14 — one search index for both form factors', () => {
    const cp = src('src/components/CommandPalette.tsx');
    it('the palette queries the server search index with a debounce', () => {
        expect(cp).toContain('api.search.searchAll');
        expect(cp).toContain('setDebouncedQuery(query)');
        expect(cp).toContain("trimmedServerQuery.length >= 2");
    });
    it('server data results replace the client index when available', () => {
        expect(cp).toContain('const serverDataItems = useMemo');
        expect(cp).toContain('serverDataItems ?? searchIndex');
    });
    it('the 15-row cap discloses truncation', () => {
        expect(cp).toContain('totalMatches > results.length');
        expect(cp).toContain('refine your search to see the rest');
    });
});

describe('UX-38 — Financials tab/scope behaviour', () => {
    const bv = src('src/components/BillingView.tsx');
    it('a pure-property firm lands on Overview', () => {
        expect(bv).toContain("isProperty && !isUnified ? 'overview' : 'invoices'");
    });
    it('a scope switch falls back to the scope natural home, not tabs[0]', () => {
        expect(bv).toContain("productScope === 'property' && tabs.some(t => t.id === 'overview')");
        expect(bv).not.toContain("setActiveTab('invoices');\n        }\n    }, [tabs, activeTab]);");
    });
    it('deep links still win over defaults', () => {
        expect(bv).toContain('const t = currentHistoryEntry.context?.billingTab as FinancialsTab | undefined;\n        // UX-38');
    });
});

describe('UX-56 — one onboarding surface at a time', () => {
    const dash = src('src/components/Dashboard.tsx');
    it('welcome is suppressed at >=50% checklist progress', () => {
        expect(dash).toContain('welcomeSuppressedByProgress');
        expect(dash).toContain('!welcomeDismissed && !welcomeSuppressedByProgress');
    });
    it('the setup banner only renders once the checklist is dismissed', () => {
        expect(dash).toContain("setupChecklist?.dismissed === true && <CompleteSetupBanner />");
    });
    it('the progress number is shared with the sidebar widget (one export)', () => {
        const cl = src('src/components/GettingStartedChecklist.tsx');
        expect(cl).toContain('export function checklistProgressPct');
        expect(dash).toContain("import { checklistProgressPct } from './GettingStartedChecklist'");
    });
    it('checklistProgressPct computes the solo-path progress correctly', () => {
        // Legal set = 7 items (practice profile, matter, contact, bank
        // account, billing rate, court date, invited-user). The fake marks
        // profile + matter done and takes the solo skip path for the team
        // invite: 3 of 7 = 43%.
        const fake = { hasPracticeProfile: true, hasMatter: true, hasContact: false, skippedTeamInvite: true };
        expect(checklistProgressPct(fake, false, false)).toBe(43);
        const done = {
            hasPracticeProfile: true, hasMatter: true, hasContact: true, hasBankAccount: true,
            hasBillingRate: true, hasCourtDateOnMatter: true, hasInvitedUser: true,
        };
        expect(checklistProgressPct(done, false, false)).toBe(100);
        expect(checklistProgressPct(null, false, false)).toBeNull();
    });
});
