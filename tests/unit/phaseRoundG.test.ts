/**
 * phaseRoundG.test.ts — UX-03 (Critical: time-entry access) + UX-28 (dead
 * legacy stack) source contracts, Phase 0 audit roadmap.
 *
 * UX-03: non-admin lawyers in a multi-lawyer firm had NO way to log billable
 *   time or expenses from any screen — the sole entry point lived inside the
 *   canViewBilling-gated Financials tab, while onboarding told every user to
 *   log time. The Tasks & Events tab (visible to the whole matter team) now
 *   carries the affordance.
 * UX-28: the orphaned legacy component stack (MatterBrief,
 *   MatterProcessTracking, ProcessActionCenter, FilingDeadlineNotice,
 *   ActivityLogTab, MatterReviewReminderPanel, BacklinksPanel,
 *   ResearchSourcePanel) and the dead viewInvoice modal type are deleted.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const src = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf8');

describe('UX-03 — every staff member can log billable work', () => {
    const md = src('src/components/details/MatterDetailView.tsx');
    it('the Tasks & Events tab carries Log Time / Log Expense actions', () => {
        expect(md).toContain("openModal('newTimeEntry', matterData.id)");
        expect(md).toContain("openModal('newExpense', matterData.id)");
        expect(md).toContain('Billable work');
    });
    it('the affordance lives OUTSIDE the canViewBilling gate', () => {
        // it is on the schedule_tasks branch, not the billing branch
        const tasksIdx = md.indexOf("activeTab === 'schedule_tasks' ?");
        const timeIdx = md.indexOf("openModal('newTimeEntry', matterData.id)");
        const billingIdx = md.indexOf("activeTab === 'billing' ?");
        expect(tasksIdx).toBeGreaterThan(-1);
        expect(billingIdx).toBeGreaterThan(-1);
        expect(timeIdx).toBeGreaterThan(tasksIdx);
        expect(timeIdx).toBeLessThan(billingIdx);
    });
});

describe('UX-28 — the dead legacy stack is deleted', () => {
    const DEAD = [
        'src/components/details/MatterBrief.tsx',
        'src/components/details/MatterProcessTracking.tsx',
        'src/components/details/ProcessActionCenter.tsx',
        'src/components/details/ActivityLogTab.tsx',
        'src/components/details/FilingDeadlineNotice.tsx',
        'src/components/BacklinksPanel.tsx',
        'src/components/details/MatterReviewReminderPanel.tsx',
        'src/components/research/ResearchSourcePanel.tsx',
    ];
    it.each(DEAD)('%s no longer exists', (f) => {
        expect(existsSync(resolvePath(repoRoot, f))).toBe(false);
    });
    it('no live imports of the dead stack remain', () => {
        for (const f of [
            'src/components/details/MatterDetailView.tsx',
            'src/components/TasksView.tsx',
            'src/components/details/DocumentDetailView.tsx',
            'src/components/App.tsx',
        ]) {
            const code = src(f);
            expect(code).not.toMatch(/import\s+\w+\s+from\s+'.*(MatterBrief|MatterProcessTracking|ProcessActionCenter|ActivityLogTab|FilingDeadlineNotice|BacklinksPanel|MatterReviewReminderPanel|ResearchSourcePanel)'/);
        }
    });
    it('the dead viewInvoice modal type is gone from every registration site', () => {
        for (const f of [
            // UX-01: ModalLayer is THE modal pipeline — the legacy
            // ModalManager.tsx is deleted.
            'src/overlays/layers/ModalLayer.tsx',
            'src/components/modals/DockedModal.tsx',
            'src/overlays/registry/modalRegistry.tsx',
            'src/contexts/UIContext.tsx',
            'src/types.ts',
        ]) {
            const code = src(f);
            expect(code).not.toContain("case 'viewInvoice'");
            expect(code).not.toContain("'viewInvoice'");
        }
        // and nobody opens it
        expect(src('src/components/details/BillingSummaryWidget.tsx')).toContain("openModal('newTimeEntry', matter.id)");
    });
});
