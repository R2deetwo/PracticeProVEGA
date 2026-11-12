/**
 * phaseRoundK.test.ts — UX-21 (Phase 6 contrast) source contracts.
 *
 * The audit's computed failures: slate-400 placeholders (~2.9:1 on white,
 * 26 sites), bare dim-400 in light contexts (~2.8:1), the 8px Sidebar group
 * labels, and --text-subtle=slate-400. All raised to AA-safe pairs.
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

describe('UX-21 — secondary text passes AA on light', () => {
    it('no placeholder ships the 2.9:1 slate-400 any more', () => {
        const offenders: string[] = [];
        for (const f of ['src/components/auth/Signup.tsx', 'src/components/MessagesView.tsx',
            'src/components/LockScreen.tsx', 'src/components/client/ClientDashboard.tsx',
            'src/components/atrium/ComposeModal.tsx', 'src/components/modals/LeadCaptureModal.tsx',
            'src/sites/shared/ContactSalesDrawer.tsx', 'src/admin/views/SubscriptionRequestsCenter.tsx']) {
            if (src(f).includes('placeholder:text-slate-400')) offenders.push(f);
        }
        expect(offenders).toEqual([]);
    });
    it('the audit census dim-400 sites are paired for light', () => {
        const tl = src('src/components/TaskList.tsx');
        expect(tl).toContain('text-dim-500 dark:text-dim-400 italic text-xs');
        expect(tl).toContain('text-3xs text-dim-500 dark:text-dim-400');
        const mbv = src('src/components/MatterBoardView.tsx');
        expect(mbv).toContain('text-2xs uppercase text-dim-500 dark:text-dim-400 block');
    });
    it('Sidebar group labels are 10px (was 8px) at AA-safe colors', () => {
        const sb = src('src/components/Sidebar.tsx');
        expect(sb).toContain('text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest');
        expect(sb).not.toContain('text-3xs font-bold text-slate-400 dark:text-zinc-500');
    });
    it('--text-subtle is slate-500 (7:1), not slate-400 (2.9:1)', () => {
        const css = src('src/index.css');
        expect(css).toContain('--text-subtle:   var(--color-slate-500);');
        expect(css).not.toContain('--text-subtle:   var(--color-slate-400);');
    });
});
