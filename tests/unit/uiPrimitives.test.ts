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
