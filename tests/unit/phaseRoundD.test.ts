/**
 * phaseRoundD.test.ts — Phase 3 identity implementation (UX-08) + Phase 5
 * rent-collection defaults (UX-35) source contracts, per the Phase 0 audit
 * roadmap. Testing style: the R16/R77 source-contract pattern.
 *
 * UX-08 (Phase 3, ADR-0005 identity direction): the five hard-coded dark
 *   surfaces in the Atrium money hub (Payments & Receipts, Service Charges,
 *   Vacancies, Reminder Rules, Communications panel) now speak the SAME
 *   light/dark token idiom as their sibling tabs (Overview, Reconciliation,
 *   Reports, Maintenance): paired bg/border/text classes, the app input
 *   idiom on every field, and status hues that pass contrast on WHITE, not
 *   only on slate-950. A light-mode user flipping tabs keeps one theme.
 * UX-35 (Phase 5): the rent-collection modal prefills the covered period
 *   from the lease timeline (not "today") and the management-fee default is
 *   ONE chain — PropertyForm and CollectRentModal derive it from the same
 *   constant, and an explicit 0% is never overwritten (?? not ||).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_MANAGEMENT_FEE_PERCENT } from '../../src/utils/propertyDefaults';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const src = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf8');

describe('UX-08 — Atrium money hub re-skinned to the shared token idiom', () => {
    const FILES = [
        'src/components/atrium/LedgerManager.tsx',
        'src/components/atrium/ServiceChargeMonitor.tsx',
        'src/components/atrium/VacancyPipeline.tsx',
        'src/components/atrium/AutomationCenter.tsx',
        'src/components/settings/IntegrationSettings.tsx',
    ];

    it.each(FILES)('%s carries no hard-coded dark page root', (f) => {
        const code = src(f);
        expect(code).not.toContain('bg-slate-950 text-white');
        expect(code).not.toMatch(/className="[^"]*\bbg-slate-950\b/);
    });

    it.each(FILES)('%s pairs every remaining slate surface with a dark: twin', (f) => {
        const code = src(f);
        // any bg-/border- slate-8xx/9xx literal that survived must be paired
        const unpaired = code
            .split('\n')
            .filter(l => /bg-slate-(950|900|800)|border-slate-(800|700)/.test(l))
            .filter(l => !l.includes('dark:bg-zinc') && !l.includes('dark:border-zinc')
                && !l.includes('dark:bg-slate') && !l.includes('dark:hover:bg-zinc'));
        // the one deliberate exception: ServiceChargeMonitor's floating
        // confirmation toast is dark in BOTH modes (like the app toast card)
        const allowed = (line: string) =>
            f.endsWith('ServiceChargeMonitor.tsx') && line.includes('fixed bottom-6');
        expect(unpaired.filter(l => !allowed(l))).toEqual([]);
    });

    it('the four money tabs render the paired input idiom (formStyles family)', () => {
        for (const f of FILES.slice(0, 4).concat([FILES[4]])) {
            const code = src(f);
            expect(code).toContain('bg-slate-50 dark:bg-zinc-800/60 border border-slate-300 dark:border-zinc-700');
        }
    });

    it('status hues are paired for light mode (no bare 300/400 text on light)', () => {
        const code = src('src/components/atrium/LedgerManager.tsx');
        // TYPE_COLORS map: every hue is paired
        expect(code).toContain("rent: 'text-emerald-600 dark:text-emerald-400'");
        expect(code).toContain("penalty: 'text-rose-600 dark:text-rose-400'");
        // entry amounts: paired per status
        expect(code).toContain("'text-emerald-600 dark:text-emerald-400'");
        expect(code).not.toMatch(/className="[^"]*text-slate-400[^"]*"/);
    });

    it('ServiceChargeMonitor status pills are paired (emerald/amber/rose/neutral)', () => {
        const code = src('src/components/atrium/ServiceChargeMonitor.tsx');
        expect(code).toContain("'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'");
        expect(code).toContain("'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'");
        expect(code).toContain("'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'");
        expect(code).not.toContain("'bg-slate-900 border-slate-800'");
    });
});

describe('UX-35 — one rent-default chain (period prefill + fee default)', () => {
    it('exports the shared fee constant both consumers import', () => {
        expect(DEFAULT_MANAGEMENT_FEE_PERCENT).toBe(10);
        const modal = src('src/components/modals/CollectRentModal.tsx');
        const form = src('src/components/forms/PropertyForm.tsx');
        expect(modal).toContain("from '../../utils/propertyDefaults'");
        expect(form).toContain("from '../../utils/propertyDefaults'");
    });

    it('CollectRentModal uses ?? (explicit 0% survives) not ||', () => {
        const modal = src('src/components/modals/CollectRentModal.tsx');
        expect(modal).toContain('property.managementFeePercentage ?? DEFAULT_MANAGEMENT_FEE_PERCENT');
        expect(modal).not.toContain('property.managementFeePercentage ||');
    });

    it('PropertyForm seeds the fee field with ?? (saved 0% is not reset to 10)', () => {
        const form = src('src/components/forms/PropertyForm.tsx');
        expect(form).toContain('propertyToEdit?.managementFeePercentage ?? DEFAULT_MANAGEMENT_FEE_PERCENT');
        expect(form).not.toContain('propertyToEdit?.managementFeePercentage || 10');
    });

    it('the covered period is prefilled from the lease timeline, not today', () => {
        const modal = src('src/components/modals/CollectRentModal.tsx');
        expect(modal).toContain('buildRentTimeline({');
        expect(modal).toContain('summarizeTimeline(periods).nextDueDate');
        // the prefill feeds the state BEFORE "today" is consulted
        const idx = modal.indexOf('const [periodStart, setPeriodStart] = useState(timelinePeriodStart');
        expect(idx).toBeGreaterThan(-1);
    });

    it('the prefill covers the partial/overdue/due statuses the engine emits', () => {
        const modal = src('src/components/modals/CollectRentModal.tsx');
        expect(modal).toContain("p.status === 'due' || p.status === 'overdue' || p.status === 'outstanding' || p.status === 'partial'");
    });
});
