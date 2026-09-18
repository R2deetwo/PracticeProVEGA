/**
 * Shared UI primitives contract suite (design-system Chunk A, ADR-0004).
 *
 * These tests pin the CONTRACTS that make the primitive layer trustworthy:
 *
 *   1. SAFETY — Button defaults type="button" (1,818 buttons existed with
 *      only 137 typed; untyped buttons inside forms silently submit).
 *      The default must never regress, and `type` must never leak into
 *      the prop spread (which would let caller values bypass the default).
 *   2. SINGLE SOURCE OF TRUTH — Button/Badge/Card consume designTokens.ts
 *      and formStyles.ts instead of re-declaring class strings; those
 *      constants match the measured dominant patterns verbatim so pilot
 *      adoption is zero-visual-change.
 *   3. A11Y WIRING — Input/Select auto-connect label -> htmlFor ->
 *      aria-describedby -> aria-invalid; icon-only Buttons warn when no
 *      accessible name is provided.
 *   4. NO NEW SYSTEMS — useToastFeedback is a facade over UIContext.addToast
 *      (the app's toast system stays unified); EmptyState is re-exported,
 *      not duplicated.
 *   5. TOKEN GATE TIE-IN — no gray-* classes in the new layer (batch 2
 *      eliminated the scale; its Tailwind key is deleted).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolve(here, '../../convex/myFunctions.ts'))
    ? resolve(here, '../..')
    : process.cwd();

const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

const buttonSrc = read('src/components/ui/Button.tsx');
const inputSrc = read('src/components/ui/Input.tsx');
const selectSrc = read('src/components/ui/Select.tsx');
const cardSrc = read('src/components/ui/Card.tsx');
const badgeSrc = read('src/components/ui/Badge.tsx');
const toastSrc = read('src/components/ui/useToastFeedback.ts');
const barrelSrc = read('src/components/ui/index.ts');
const tokensSrc = read('src/utils/designTokens.ts');
const formStylesSrc = read('src/utils/formStyles.ts');
const finBadgeSrc = read('src/components/ui/FinancialStatusBadge.tsx');
const pilotSrc = read('src/components/forms/BankAccountForm.tsx');

/** Strip /* … *​/ and // comments so prose can't satisfy a class contract. */
function stripComments(src: string): string {
    let out = '';
    let i = 0;
    let inString: string | null = null;
    while (i < src.length) {
        const c = src[i];
        if (inString) {
            out += c;
            if (c === '\\') { out += src[i + 1] ?? ''; i += 2; continue; }
            if (c === inString) inString = null;
            i++; continue;
        }
        if (c === '"' || c === "'" || c === '`') { inString = c; out += c; i++; continue; }
        if (c === '/' && src[i + 1] === '*') {
            const end = src.indexOf('*/', i + 2);
            i = end === -1 ? src.length : end + 2;
            continue;
        }
        if (c === '/' && src[i + 1] === '/') {
            const end = src.indexOf('\n', i);
            i = end === -1 ? src.length : end;
            continue;
        }
        out += c; i++;
    }
    return out;
}

describe('Button — safety contracts', () => {
    it('defaults type="button" (the accidental-submit footgun fix)', () => {
        expect(stripComments(buttonSrc)).toContain("type = 'button'");
    });

    it('destructures `type` so caller values pass through, never spread', () => {
        // If `type` were NOT destructured, {...rest} would override the default
        // only when passed — but the DEFAULT itself would disappear (undefined
        // type still submits!). The destructure + default is the contract.
        expect(stripComments(buttonSrc)).toMatch(/type = 'button',/);
    });

    it('exposes submit/reset explicitly through a narrowed type', () => {
        expect(stripComments(buttonSrc)).toContain("'button' | 'submit' | 'reset'");
    });

    it('keeps touch-target and active-press OPT-IN (dominant patterns are 36px)', () => {
        const src = stripComments(buttonSrc);
        expect(src).toContain('minTouchTarget = false');
        expect(src).toContain('activePress = false');
        // ...and they are appended conditionally, not baked into BASE/VARIANTS.
        expect(src.match(/touch-target/g)?.length).toBe(1);
        expect(src.match(/active-press/g)?.length).toBe(1);
    });

    it('warns at dev time when iconOnly has no accessible name', () => {
        expect(stripComments(buttonSrc)).toContain('iconOnly requires aria-label');
    });

    it('sets aria-busy and disables while loading', () => {
        const src = stripComments(buttonSrc);
        expect(src).toContain('aria-busy={loading || undefined}');
        expect(src).toContain('disabled={disabled || loading}');
    });
});

describe('Primitives — single source of truth', () => {
    it('Button variants come from designTokens.ts, not re-declared', () => {
        const src = stripComments(buttonSrc);
        expect(src).toContain("from '../../utils/designTokens'");
        for (const v of ['BTN_PRIMARY', 'BTN_SECONDARY', 'BTN_GHOST', 'BTN_DANGER', 'BTN_DANGER_SOFT', 'BTN_OUTLINE']) {
            expect(src).toContain(v);
        }
        // No re-declared primary color string in the component itself:
        expect(src).not.toMatch(/'bg-primary-600[^']*'/);
    });

    it('Card consumes CARD_BASE/CARD_WIDGET/CARD_PAD from designTokens', () => {
        const src = stripComments(cardSrc);
        expect(src).toContain("from '../../utils/designTokens'");
        expect(src).toContain('CARD_BASE');
        expect(src).toContain('CARD_WIDGET');
        expect(src).toContain('CARD_PAD');
    });

    it('Input/Select consume formStyles variants instead of duplicating them', () => {
        const i = stripComments(inputSrc);
        const s = stripComments(selectSrc);
        for (const src of [i, s]) {
            expect(src).toContain("from '../../utils/formStyles'");
            expect(src).toContain('inputModern');
            expect(src).toContain('inputClassic');
            expect(src).toContain('inputLarge');
        }
    });

    it('designTokens BTN_PRIMARY matches the dominant measured pattern', () => {
        expect(tokensSrc).toContain(
            'bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 shadow-sm transition-colors'
        );
    });

    it('danger-soft matches the 7x measured soft-danger pattern', () => {
        expect(tokensSrc).toContain(
            'bg-red-100 text-red-700 dark:text-red-400 dark:bg-red-900/50 dark:text-red-300 rounded-lg font-semibold hover:bg-red-200 dark:hover:bg-red-900/80'
        );
    });

    it('Badge tone strings mirror FinancialStatusBadge exactly', () => {
        const b = stripComments(badgeSrc);
        const fb = stripComments(finBadgeSrc);
        const tones: Array<[string, string]> = [
            ['success', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'],
            ['danger', 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'],
        ];
        for (const [tone, str] of tones) {
            expect(b).toContain(str);
            expect(fb).toContain(str.split(' ').slice(0, 4).join(' '));
        }
    });
});

describe('Input/Select — accessibility wiring', () => {
    it('Input generates ids and wires label + describedby + aria-invalid', () => {
        const src = stripComments(inputSrc);
        expect(src).toContain('useId()');
        expect(src).toContain('htmlFor={id}');
        expect(src).toContain('aria-invalid={error ? true : undefined}');
        expect(src).toContain('aria-describedby={describedBy}');
        expect(src).toContain('`' + '${id}-hint' + '`');
        expect(src).toContain('`' + '${id}-error' + '`');
    });

    it('Select wires the same contract', () => {
        const src = stripComments(selectSrc);
        expect(src).toContain('useId()');
        expect(src).toContain('htmlFor={id}');
        expect(src).toContain('aria-describedby={describedBy}');
    });

    it('errors are announced (role="alert")', () => {
        expect(stripComments(inputSrc)).toContain('role="alert"');
        expect(stripComments(selectSrc)).toContain('role="alert"');
    });
});

describe('Toast facade — no new toast system', () => {
    it('wraps UIContext.addToast, does not create state', () => {
        const src = stripComments(toastSrc);
        expect(src).toContain("from '../../contexts/UIContext'");
        expect(src).toContain('addToast');
        expect(src).not.toContain('useState');
        expect(src).not.toContain('setToast');
    });

    it('covers all four toast types', () => {
        const src = stripComments(toastSrc);
        for (const t of ['success', 'error', 'warning', 'info']) {
            expect(src).toContain(`type: '${t}'`);
        }
    });
});

describe('Barrel + adoption contracts', () => {
    it('index.ts exports every primitive from one path', () => {
        const src = stripComments(barrelSrc);
        for (const name of ['Button', 'Input', 'Select', 'Card', 'Badge', 'useToastFeedback', 'ConfirmDialog', 'FinancialStatusBadge', 'EmptyState']) {
            expect(src).toContain(name);
        }
    });

    it('re-exports EmptyState instead of duplicating it', () => {
        expect(existsSync(resolve(repoRoot, 'src/components/ui/EmptyState.tsx'))).toBe(false);
        expect(barrelSrc).toContain("from '../EmptyState'");
    });

    it('pilot (BankAccountForm) adopts Button + Input and drops direct formStyles import', () => {
        const src = stripComments(pilotSrc);
        expect(src).toContain("from '../ui'");
        expect(src).toContain('<Button');
        expect(src).toContain('<Input');
        expect(src).not.toContain("from '../../utils/formStyles'");
        // The one intentionally-kept hand-rolled control is the text-link
        // "Set as Default Account" button (no Button variant is a text link).
        expect(src.match(/<button/g)?.length).toBe(1);
    });

    it('second pilot (EventTypeForm) adopts the primitives; color swatches stay hand-rolled', () => {
        const src = stripComments(read('src/components/forms/EventTypeForm.tsx'));
        expect(src).toContain("from '../ui'");
        expect(src).toContain('<Button');
        expect(src).toContain('<Input');
        expect(src).not.toContain("from '../../utils/formStyles'");
        // PALETTE_COLORS swatches are color chips, not action buttons.
        expect(src.match(/<button/g)?.length).toBe(1);
    });
});

describe('Token-gate tie-in (batch 2)', () => {
    const files = [
        'src/components/ui/Button.tsx', 'src/components/ui/Input.tsx',
        'src/components/ui/Select.tsx', 'src/components/ui/Card.tsx',
        'src/components/ui/Badge.tsx', 'src/components/ui/useToastFeedback.ts',
        'src/components/ui/index.ts',
    ];
    it.each(files)('%s contains no gray-* classes (scale eliminated)', (f) => {
        expect(read(f)).not.toMatch(/\b(?:text|bg|border|ring|divide)-gray-\d+\b/);
    });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * Task 61 (ui-primitives adoption) — zero-visual-change equivalence proofs.
 *
 * For every element shape the ProfileSettings reference migration adopts,
 * the composed primitive class set must be a SUPERSET of the original
 * hand-rolled class string. Classes the primitive intentionally adds
 * (focus-visible ring, aria-driven, px-4 on a centered w-full button) do not
 * change resting pixels; documented conflicts (py-2 vs py-2.5, text-sm vs
 * text-base) resolve deterministically by Tailwind's stylesheet order
 * (numeric scale: later wins), verified against the built CSS.
 *
 * One deliberate token replacement: `flex` (original) -> `inline-flex`
 * (Button BASE). The tab bar / segmented parents are flex containers, and a
 * flex item's inline-level display value is blockified per the CSS spec, so
 * both render identically. The comparison excludes the display token.
 * ═══════════════════════════════════════════════════════════════════════ */
import { buildButtonClasses } from '../../src/components/ui/Button';
import {
    BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, BTN_DANGER, BTN_DANGER_SOFT, BTN_OUTLINE,
} from '../../src/utils/designTokens';
import { inputSettings } from '../../src/utils/formStyles';

const DISPLAY_TOKENS = new Set(['flex', 'inline-flex']);

/** Assert every original class token survives into the composed class set. */
function assertSuperset(original: string, composed: string, label: string) {
    const originalTokens = original.split(/\s+/).filter((t) => t && !DISPLAY_TOKENS.has(t));
    const composedSet = new Set(composed.split(/\s+/));
    const missing = originalTokens.filter((t) => !composedSet.has(t));
    expect(missing, `${label}: classes lost in migration: ${missing.join(', ')}\n  original: ${original}\n  composed: ${composed}`).toEqual([]);
}

describe('Task 61 — Button class equivalence (ProfileSettings migration)', () => {
    // ── Sub-tab buttons (General / Appearance) ──────────────────────────────
    const TAB_ACTIVE_ORIGINAL =
        'flex-shrink-0 pb-3 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 border-primary-500 text-primary-600 dark:text-primary-400';
    const TAB_INACTIVE_ORIGINAL =
        'flex-shrink-0 pb-3 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 border-transparent text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300';

    it('active tab: variant=tab-active + size=tab superset of the hand-rolled string', () => {
        assertSuperset(TAB_ACTIVE_ORIGINAL, buildButtonClasses({ variant: 'tab-active', size: 'tab' }), 'tab-active');
    });

    it('inactive tab: variant=tab + size=tab superset of the hand-rolled string', () => {
        assertSuperset(TAB_INACTIVE_ORIGINAL, buildButtonClasses({ variant: 'tab', size: 'tab' }), 'tab');
    });

    it('tab buttons keep the icon + label flex contract (items-center, gap-2)', () => {
        const composed = buildButtonClasses({ variant: 'tab', size: 'tab' });
        expect(composed).toContain('items-center');
        expect(composed).toContain('gap-2');
    });

    // ── Font-size segmented control ─────────────────────────────────────────
    const SEGMENTED_BASE =
        'w-full flex-shrink-0 flex-1 min-w-[100px] text-center px-4 py-2 rounded-md text-sm font-bold transition-all capitalize flex items-center justify-center gap-2';
    const SEGMENTED_INACTIVE_ORIGINAL = `${SEGMENTED_BASE} text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200`;
    const SEGMENTED_ACTIVE_ORIGINAL = `${SEGMENTED_BASE} bg-white dark:bg-zinc-700 shadow-sm text-slate-900 dark:text-white`;
    const SEGMENTED_CLASS_DELTAS = 'w-full flex-shrink-0 flex-1 min-w-[100px] text-center';

    it('inactive segment: variant=segmented + size=md superset of the hand-rolled string', () => {
        assertSuperset(
            SEGMENTED_INACTIVE_ORIGINAL,
            buildButtonClasses({ variant: 'segmented', size: 'md', className: SEGMENTED_CLASS_DELTAS }),
            'segmented'
        );
    });

    it('active segment: variant=segmented-active + size=md superset of the hand-rolled string', () => {
        assertSuperset(
            SEGMENTED_ACTIVE_ORIGINAL,
            buildButtonClasses({ variant: 'segmented-active', size: 'md', className: SEGMENTED_CLASS_DELTAS }),
            'segmented-active'
        );
    });

    // ── "Update Profile" emerald CTA ────────────────────────────────────────
    const SUCCESS_ORIGINAL =
        'w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors shadow-md';

    it('success CTA: variant=success + size=md + py-2.5 override superset of the hand-rolled string', () => {
        const composed = buildButtonClasses({ variant: 'success', size: 'md', className: 'w-full py-2.5' });
        assertSuperset(SUCCESS_ORIGINAL, composed, 'success');
        // py-2.5 must be present to win over size md's py-2: 'py-2' sorts
        // before 'py-2.5' lexicographically, so py-2.5 is emitted later and
        // wins (verified in the built CSS).
        expect(composed).toContain('py-2.5');
    });

    // ── "Update Standards" dark CTA ─────────────────────────────────────────
    const DARK_ORIGINAL =
        'w-full px-4 py-2 bg-slate-900 dark:bg-white dark:bg-zinc-900 text-white dark:text-slate-900 rounded-lg font-semibold hover:opacity-90 transition-all';

    it('dark CTA: variant=bare + verbatim classes (size overrides would lose lexicographically)', () => {
        // The original button declares NO text-size class (renders at the
        // inherited 16px). A text-base override on size md LOSES to text-sm
        // because Tailwind v3 emits 'text-base' BEFORE 'text-sm' in
        // lexicographic order — so the size system cannot express this button
        // without a visual change. variant="bare" carries the VERBATIM string.
        const composed = buildButtonClasses({ variant: 'bare', size: 'md', className: DARK_ORIGINAL });
        assertSuperset(DARK_ORIGINAL, composed, 'dark-bare');
        // The conflicting dark:bg-white / dark:bg-zinc-900 pair resolves to
        // zinc-900 ("z" > "w") — the pre-existing dark-mode rendering, kept.
        expect(composed).toContain('dark:bg-zinc-900');
        expect(composed).toContain('dark:bg-white');
    });
});

describe('Task 61 — Chunk A regression guards (BASE transition refactor)', () => {
    it('every Chunk A variant token still carries transition-colors (BASE removal is a no-op for them)', () => {
        for (const token of [BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, BTN_DANGER, BTN_DANGER_SOFT, BTN_OUTLINE]) {
            expect(token).toContain('transition-colors');
        }
    });

    it('composed primary button contains transition-colors exactly once (token, not duplicated by BASE)', () => {
        const composed = buildButtonClasses({ variant: 'primary', size: 'md' }).split(/\s+/);
        expect(composed.filter((c) => c === 'transition-colors')).toHaveLength(1);
    });

    it('Chunk B tokens exist and are wired (superset guard for the new variants)', () => {
        const variants: Array<Parameters<typeof buildButtonClasses>[0]['variant']> =
            ['success', 'dark', 'tab', 'tab-active', 'segmented', 'segmented-active'];
        for (const v of variants) {
            const composed = buildButtonClasses({ variant: v, size: v === 'tab' || v === 'tab-active' ? 'tab' : 'md' });
            expect(composed.split(/\s+/).length).toBeGreaterThan(5);
        }
    });
});

describe('Task 61 — formStyles settings input family equivalence', () => {
    it('inputSettings equals the measured settings-screen class string (mt-1 moved to the label gap)', () => {
        // Original commonInputClass in ProfileSettings.tsx:
        //   "mt-1 text-slate-900 dark:text-zinc-300 w-full bg-slate-50 dark:bg-zinc-700
        //    border border-slate-300 dark:border-zinc-600 rounded-md p-2"
        // The 4px gap came from the input's mt-1 (label had no bottom margin).
        // The ui/Input label provides mb-1 (4px) with no input margin — identical
        // 4px gap, so inputSettings is the original minus mt-1.
        const originalMinusMt1 =
            'text-slate-900 dark:text-zinc-300 w-full bg-slate-50 dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md p-2';
        expect(inputSettings.split(/\s+/).sort().join(' ')).toBe(originalMinusMt1.split(/\s+/).sort().join(' '));
        expect(inputSettings).not.toContain('shadow');
        expect(inputSettings).not.toContain('focus:'); // flat look is the measured pattern
    });
});
