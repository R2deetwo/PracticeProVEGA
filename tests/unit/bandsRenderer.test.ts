/**
 * R53 — the flowing-bands hero: source-contract tests.
 *
 * The renderer itself runs WebGL2 in a browser (verified by the r53 QA
 * harness against the dev server); these tests pin the CONTRACT in
 * source, the way this repo pins every other visual system:
 *   - dependency-free (the spec's Phase 2 item 3: no three/ogl/regl/
 *     pixi/gsap/lottie anywhere),
 *   - the shader carries the required techniques (fractal domain warp,
 *     fwidth AA, contour bands, right-side mask, dither),
 *   - the renderer implements the spec's runtime rules (quality ladder,
 *     dt clamp, pointer lerp, pauses, reduced-motion single frame,
 *     CSS fallback, dispose),
 *   - the heroes are wired: hub = bands as THE background (photo gone),
 *     Vega = clean photo (the R50 lines retired), SwirlBands deleted.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const read = (...p: string[]) => readFileSync(join(__dirname, '..', '..', ...p), 'utf8');

describe('R53 dependency-free (Phase 2, item 3)', () => {
    it('the bands implementation imports no graphics/animation libraries', () => {
        // NOTE: package.json carries a pre-existing unused "three" entry —
        // R53 adds nothing and the bands sources import none of them.
        const sources = [
            read('src', 'lib', 'bands', 'shader.frag.ts'),
            read('src', 'lib', 'bands', 'createBandsRenderer.ts'),
            read('src', 'sites', 'shared', 'BandsBackground.tsx'),
        ].join('\n');
        for (const lib of ['three', 'ogl', 'regl', 'pixi', 'gsap', 'lottie', 'p5', 'd3']) {
            expect(sources).not.toMatch(new RegExp(`from ['"]${lib}`));
            expect(sources).not.toMatch(new RegExp(`require\\(['"]${lib}`));
        }
    });
});

describe('R53 the shader (src/lib/bands/shader.frag.ts)', () => {
    const frag = read('src', 'lib', 'bands', 'shader.frag.ts');

    it('is a WebGL2 (#version 300 es) fragment shader', () => {
        expect(frag).toContain('#version 300 es');
        expect(frag).toContain('out vec4 outColor');
    });

    it('folds the field with fractal domain warping (fbm of fbm of fbm)', () => {
        expect(frag).toContain('fbm(p*1.1');
        expect(frag).toContain('uWarp*q');
        expect(frag).toContain('uWarp*r');
        expect(frag).toContain('for(int i=0;i<4;i++)');
    });

    it('slices contour bands with screen-space AA and a dither', () => {
        expect(frag).toContain('uBandCount');
        expect(frag).toContain('fract(k)');
        expect(frag).toContain('fwidth(k)');       // crisp at any DPR
        expect(frag).toContain('/ 255.0');         // the silky dither
    });

    it('keeps the effect on the right and blends to the ground colour', () => {
        expect(frag).toContain('smoothstep(0.30, 0.80, uv.x)');
        expect(frag).toContain('mix(uPal[0], col, mask)');
    });

    it('is pointer-reactive through the uPointer uniform', () => {
        expect(frag).toContain('uPointer');
        expect(frag).toContain('(uPointer - 0.5) * 0.15');
    });
});

describe('R53 the renderer (src/lib/bands/createBandsRenderer.ts)', () => {
    const r = read('src', 'lib', 'bands', 'createBandsRenderer.ts');

    it('draws one fullscreen triangle via gl_VertexID — no per-frame allocations', () => {
        expect(r).toContain('gl_VertexID');
        expect(r).toContain('drawArrays(gl!.TRIANGLES, 0, 3)');
    });

    it('scales for high DPI and steps quality DOWN only (1 → 0.75 → 0.5 at >20ms avg)', () => {
        expect(r).toContain('Math.min(window.devicePixelRatio || 1, MAX_DPR)');
        expect(r).toContain('QUALITY_STEPS = [1, 0.75, 0.5]');
        expect(r).toContain('FRAME_BUDGET_MS = 20');
        expect(r).toContain('idx < QUALITY_STEPS.length - 1'); // never steps back up
    });

    it('clamps frame delta to 0.1s (no jump after a tab switch)', () => {
        expect(r).toContain('Math.min(cost / 1000, 0.1)');
    });

    it('lerps the pointer at 0.05 per frame', () => {
        expect(r).toContain('* 0.05');
    });

    it('pauses when off-screen or hidden', () => {
        expect(r).toContain('IntersectionObserver');
        expect(r).toContain("document.addEventListener('visibilitychange'");
        expect(r).toContain('!visible || document.hidden');
    });

    it('renders ONE static frame at uTime = 12.0 under prefers-reduced-motion', () => {
        expect(r).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
        expect(r).toContain('STATIC_TIME = 12.0');
    });

    it('boots the first (expensive) draw on idle — never competing with hydration', () => {
        // Measured: a synchronous first draw on a software renderer cost
        // 1,270ms of Lighthouse TBT. The hero shows the ground colour
        // until idle, then the bands arrive.
        expect(r).toContain('requestIdleCallback(boot, { timeout: 1200 })');
        expect(r).toContain('booted = true');
    });

    it('starts SOFTWARE renderers (SwiftShader/llvmpipe) at the lowest quality step', () => {
        expect(r).toMatch(/swiftshader\|software\|llvmpipe/i);
        expect(r).toContain('stats.qualityScale = 0.5');
    });

    it('handles context loss, restore, and dispose — WITHOUT killing the context', () => {
        expect(r).toContain('webglcontextlost');
        expect(r).toContain('webglcontextrestored');
        expect(r).toContain('dispose()');
        // The StrictMode lesson: losing the context is PERMANENT for the
        // canvas element, so dispose must only delete OUR objects — a dev
        // double-mount (or HMR remount) must find a usable canvas.
        expect(r).not.toContain('loseContext()');
        expect(r).toContain("gl.deleteProgram(program)");
    });

    it('degrades gracefully when the canvas context is already lost', () => {
        expect(r).toContain('gl.isContextLost()');
    });

    it('falls back to a CSS gradient when WebGL2 is unavailable — never crashes', () => {
        expect(r).toContain('linear-gradient(160deg');
        expect(r).toContain('stats.fallback = true');
    });
});

describe('R53 the heroes (hub bands, Vega clean)', () => {
    it('the hub hero IS the bands: photo and overlay retired', () => {
        const hero = read('src', 'sites', 'hub', 'sections', 'HeroSection.tsx');
        expect(hero).toContain('<BandsBackground');
        expect(hero).toContain("palette={HUB_BANDS_PALETTE}");
        // The ground colour equals palette[0] — the seam-free contract.
        expect(hero).toContain('style={{ background: HUB_BANDS_PALETTE[0] }}');
        expect(hero).not.toContain('ambient-still');
        // No full-bleed gradient OVERLAY masks the bands (the CTA button's
        // own gradient is fine) — the bands ARE the background.
        expect(hero).not.toContain('absolute inset-0 z-10 bg-gradient-to-b');
        expect(hero).not.toContain('<img');
    });

    it('the palette is the PracticePro register: navy ground, gilt line', () => {
        const hero = read('src', 'sites', 'hub', 'sections', 'HeroSection.tsx');
        expect(hero).toContain("'#050B18'");
        expect(hero).toContain("'#D8B45C'");
    });

    it('Vega keeps the clean photograph hero — no bands, no lines', () => {
        const vega = read('src', 'sites', 'vega', 'sections', 'VegaHero.tsx');
        expect(vega).toContain('vega-hero-2.jpg');
        expect(vega).not.toContain('BandsBackground');
        expect(vega).not.toContain('SwirlBands');
    });

    it('the R50 SwirlBands and its hero stills are deleted', () => {
        expect(existsSync(join(__dirname, '..', '..', 'src', 'sites', 'shared', 'SwirlBands.tsx'))).toBe(false);
        expect(existsSync(join(__dirname, '..', '..', 'public', 'assets', 'landing', 'hero', 'ambient-still.jpg'))).toBe(false);
        expect(existsSync(join(__dirname, '..', '..', 'public', 'assets', 'landing', 'hero', 'ambient-still-panel.jpg'))).toBe(false);
    });

    it('the React wrapper is a thin, typed, self-disposing client component', () => {
        const wrap = read('src', 'sites', 'shared', 'BandsBackground.tsx');
        expect(wrap).toContain('createBandsRenderer');
        expect(wrap).toContain('dispose()');
        expect(wrap).toContain('pointer-events-none');
        expect(wrap).toContain('aria-hidden="true"');
    });
});
