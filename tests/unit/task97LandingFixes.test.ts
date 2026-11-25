import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Task 97 (2026-11-25) — source pins for the landing-page polish round:
 *   1. /vega hero: the video band sits FLUSH under the fixed header
 *      (the retired R68 top-24 de-shove left a header-height white gap
 *      between the navbar and the clip).
 *   2. The global :focus-visible indicator no longer paints the green
 *      square around auto-focused chat composers (text entries excluded;
 *      color product-scoped).
 *   3. The landing ALOA/ARIA widget: common-questions drawer COLLAPSED
 *      by default; every action accent (send, bubble, step, CTA, header
 *      wash) is a product token — no unscoped corporate green on /vega;
 *      the placeholder fits the composer on one line.
 *   4. The update toast resolves its accent from the URL (Vega blue on
 *      /vega, Atrium emerald on /atrium) instead of the corporate green.
 *   5. The in-app dynamic chat form focus ring follows the primary ramp.
 */
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const heroVideo = read('src', 'components', 'HeroVideo.tsx');
const vegaHero = read('src', 'sites', 'vega', 'sections', 'VegaHero.tsx');
const indexCss = read('src', 'index.css');
const aloaFab = read('src', 'sites', 'shared', 'AloaAssistantFab.tsx');
const refreshToast = read('src', 'components', 'ToastRefreshNotification.tsx');
const dynamicForm = read('src', 'components', 'aloa', 'DynamicChatForm.tsx');

describe('Task 97 — the /vega hero band is flush under the fixed header', () => {
    it('the band top is the header height (h-16) + safe-area inset, not the retired top-24', () => {
        expect(heroVideo).toContain('top-[calc(4rem+env(safe-area-inset-top,0px))] z-0');
        expect(heroVideo).not.toContain('top-24 z-0');
    });

    it('the copy wrapper tracks the band offset (seat into the band unchanged at 11.5vw)', () => {
        expect(vegaHero).toContain('pt-[calc(4rem+env(safe-area-inset-top,0px)+11.5vw)]');
        expect(vegaHero).toContain('min-h-[calc(4rem+env(safe-area-inset-top,0px)+56.25vw)]');
        expect(vegaHero).not.toContain('pt-[calc(6rem+11.5vw)]');
    });
});

describe('Task 97 — no green :focus-visible square around chat composers', () => {
    it('text-entry elements are excluded from the global focus outline', () => {
        // The exclusion list on BOTH rules (outline + corner smoothing).
        const matches = indexCss.match(/:focus-visible:where\(:not\(textarea, input, select, \[contenteditable\], \[contenteditable="true"\], \.focus-ring-clean\)\)/g);
        expect(matches?.length).toBeGreaterThanOrEqual(2);
        // The old all-elements rule is gone.
        expect(indexCss).not.toMatch(/^:focus-visible \{$/m);
    });

    it('the focus outline color is product-scoped via the primary ramp, not hardcoded green', () => {
        expect(indexCss).toContain('outline: 2px solid rgb(var(--color-primary-600, 21 128 61))');
        expect(indexCss).not.toContain('outline: 2px solid rgb(22 163 74)');
    });

    it('the corner-radius override only touches real controls (a/button/roles/tabindex)', () => {
        expect(indexCss).toContain('button, [role="button"], [role="tab"]');
    });
});

describe('Task 97 — the landing assistant: drawer collapsed + product parity', () => {
    it('the common-questions drawer starts collapsed', () => {
        expect(aloaFab).toContain('const [topicsOpen, setTopicsOpen] = useState(false)');
        expect(aloaFab).not.toContain('const [topicsOpen, setTopicsOpen] = useState(true)');
    });

    it('the action accents are product tokens (Vega blue / Atrium emerald), never unscoped green', () => {
        // The widget brands every accent through the BRAND record now.
        expect(aloaFab).toContain("wash: 'from-[#EFF6FF] to-white'");
        expect(aloaFab).toContain("bubble: 'bg-[#1E3A8A]'");
        expect(aloaFab).toContain("step: 'bg-[#1E3A8A]'");
        expect(aloaFab).toContain("send: 'bg-[#1E3A8A] hover:bg-[#1E40AF]'");
        expect(aloaFab).toContain("cta: 'bg-[#1E3A8A] hover:bg-[#1E40AF]'");
        // The usages are token-driven…
        expect(aloaFab).toContain('${brand.wash}');
        expect(aloaFab).toContain('${brand.bubble}');
        expect(aloaFab).toContain('${brand.step}');
        expect(aloaFab).toContain('${brand.send}');
        expect(aloaFab).toContain('${brand.cta}');
        // …and the unscoped green ramp no longer leaks into the widget.
        expect(aloaFab).not.toContain("'from-primary-50 to-white'");
        expect(aloaFab).not.toContain("'bg-primary-600'");
        expect(aloaFab).not.toContain("'bg-primary-600 hover:bg-primary-700'");
    });

    it('the composer placeholder fits one line (no wrap/scrollbar at panel width)', () => {
        expect(aloaFab).toContain("'Ask about Vega — features, plans…'");
        expect(aloaFab).not.toContain("'Ask about Vega — features, workflows, plans…'");
    });
});

describe('Task 97 — the update toast wears the product accent', () => {
    it('the accent resolves from the URL like the error boundary', () => {
        expect(refreshToast).toContain("resolveRecoveryAccent()");
        expect(refreshToast).toContain("button: 'bg-[#1E3A8A] hover:bg-[#1E40AF]'");
        expect(refreshToast).toContain("button: 'bg-emerald-600 hover:bg-emerald-500'");
        // The hub register keeps the primary ramp (skin-scoped in-app).
        expect(refreshToast).toContain("button: 'bg-primary-600 hover:bg-primary-500'");
    });
});

describe('Task 97 — in-app chat form focus ring follows the primary ramp', () => {
    it('the dynamic form input uses primary, not hardcoded emerald', () => {
        expect(dynamicForm).toContain('focus:ring-primary-500/40 focus:border-primary-500');
        expect(dynamicForm).not.toContain('focus:ring-emerald-500/40 focus:border-emerald-500');
    });
});
