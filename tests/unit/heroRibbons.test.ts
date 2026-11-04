/**
 * R55 — the hairline-ribbon hero: source-contract tests.
 *
 * Replaces tests/unit/bandsRenderer.test.ts (the R53 WebGL2 contour
 * shader, retired by owner direction: "NO topographic / contour-map
 * look. NO noise, NO fbm… NO WebGL, NO shaders… Plain 2D canvas
 * only."). These tests pin the NEW contract in source, the way this
 * repo pins every other visual system:
 *   - plain 2D canvas, dependency-free (no three/ogl/regl/pixi/gsap,
 *     no WebGL, no shaders — the Phase-spec DO-NOTs),
 *   - the preset: 2 ribbons × 64 lines, right side (cx 0.80/0.84),
 *     additive 'lighter' blend, the PracticePro green kept in sync
 *     with the --color-primary-500 token (rgb 22 163 74),
 *   - the component's runtime rules (DPR clamp, dt clamp, pause
 *     off-screen/hidden, ONE static frame under reduced-motion,
 *     mobile fade opacity-40),
 *   - the hero wiring (ribbons first child, content z-20 above, navy
 *     ground unchanged) and the old animation fully deleted.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const read = (...p: string[]) => readFileSync(join(__dirname, '..', '..', ...p), 'utf8');

describe('R55 dependency-free, plain 2D canvas (the spec DO-NOTs)', () => {
    it('imports no graphics/animation libraries', () => {
        const sources = [
            read('src', 'lib', 'ribbons.ts'),
            read('src', 'components', 'HeroRibbons.tsx'),
        ].join('\n');
        for (const lib of ['three', 'ogl', 'regl', 'pixi', 'gsap', 'lottie', 'p5', 'd3']) {
            expect(sources).not.toMatch(new RegExp(`from ['"]${lib}`));
            expect(sources).not.toMatch(new RegExp(`require\\(['"]${lib}`));
        }
    });

    it('uses NO WebGL and NO shaders — getContext(2d) only', () => {
        const comp = read('src', 'components', 'HeroRibbons.tsx');
        expect(comp).toContain("getContext('2d')");
        expect(comp).not.toMatch(/webgl/i);
        expect(comp).not.toMatch(/shader/i);
        const lib = read('src', 'lib', 'ribbons.ts');
        expect(lib).not.toMatch(/webgl|glsl|shader|fbm|perlin|simplex|noise/i);
    });

    it('adds no dependency: the ribbon sources are the only new imports of the pair', () => {
        // NOTE: package.json legitimately KEEPS "three" — it is a live
        // dependency of SystemCoreScene.tsx (hub) and VegaScalesScene.tsx
        // (vega) via dynamic import('three'). The R53 note calling it
        // "unused" was wrong (it only checked static imports). The ribbon
        // hero itself adds zero packages.
        const pkg = read('package.json');
        expect(pkg).not.toContain('"ogl"');
        expect(pkg).not.toContain('"regl"');
        expect(pkg).not.toContain('"pixi"');
    });
});

describe('R55 the preset (src/lib/ribbons.ts)', () => {
    const lib = read('src', 'lib', 'ribbons.ts');

    it('two ribbons of 64 hairlines, additive blend, 1.1px base width', () => {
        expect(lib).toContain("blend: 'lighter'");
        expect(lib).toContain('lines: 64');
        expect(lib).toContain('lw: 1.1');
        expect(lib).toContain('aMin: 0.05');
        expect(lib).toContain('aMax: 0.85');
        // exactly two ribbon specs
        const cxMatches = lib.match(/cx: [0-9.]+/g) ?? [];
        expect(cxMatches).toHaveLength(2);
    });

    it('both ribbons live on the RIGHT (cx 0.80 / 0.84 of the canvas width)', () => {
        expect(lib).toContain('cx: 0.80');
        expect(lib).toContain('cx: 0.84');
    });

    it('the line green is the repo token --color-primary-500 (rgb 22 163 74, #16A34A)', () => {
        // The task's eyedropper sample read #1CB74C (28,183,76), which
        // exists nowhere in the repo; the favicon, logo.svg, theme-color
        // and --color-primary-500 are all #16A34A. Per the task's palette
        // rule ("if the repo already defines tokens for these colors, use
        // those and keep the rgb values in the preset in sync") the
        // preset carries the token values.
        expect(lib).toContain('rgb: [22, 163, 74]');
        expect(lib).not.toContain('28, 183, 76');
        expect(lib).not.toContain('[28, 183, 76]');
        // and the sync target is real: the CSS token carries the same rgb
        const css = read('src', 'index.css');
        expect(css).toContain('--color-primary-500: 22 163 74');
    });

    it('draws stroked polylines only — no filled shapes, no blobs', () => {
        expect(lib).toContain('ctx.beginPath()');
        expect(lib).toContain('ctx.moveTo(x, y)');
        expect(lib).toContain('ctx.lineTo(x, y)');
        expect(lib).toContain('ctx.stroke()');
        expect(lib).not.toContain('fill(');
        expect(lib).not.toContain('fillRect');
        expect(lib).not.toContain('arc(');
    });

    it('one edge bright, the other nearly invisible — the silk fade', () => {
        // edge = (1 - s)^3.2 drives both alpha and width toward aMin
        expect(lib).toContain('Math.pow(1 - s, 3.2)');
        expect(lib).toContain('o.aMin + (o.aMax - o.aMin) * edge');
        expect(lib).toContain('o.lw * (0.6 + 0.9 * edge)');
    });

    it('clears each frame and takes the blend from the options', () => {
        expect(lib).toContain('ctx.clearRect(0, 0, W, H)');
        expect(lib).toContain('ctx.globalCompositeOperation = o.blend');
    });
});

describe('R55 the component (src/components/HeroRibbons.tsx)', () => {
    const comp = read('src', 'components', 'HeroRibbons.tsx');

    it('clamps DPR to 2 on resize', () => {
        expect(comp).toContain('Math.min(window.devicePixelRatio || 1, 2)');
    });

    it('clamps frame delta to 0.1s (no jump after a tab switch)', () => {
        expect(comp).toContain('Math.min((now - last) / 1000, 0.1)');
    });

    it('pauses when off-screen or hidden, resumes only when safe', () => {
        expect(comp).toContain('IntersectionObserver');
        expect(comp).toContain("document.addEventListener('visibilitychange'");
        expect(comp).toContain('!raf && !reduce && visible && !document.hidden');
    });

    it('renders ONE static frame under prefers-reduced-motion — the loop never starts', () => {
        expect(comp).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
        expect(comp).toContain('t = reduce ? 2 : 0');
        expect(comp).toContain('if (!raf && !reduce');
    });

    it('cleans up observers and listeners on unmount', () => {
        expect(comp).toContain('ro.disconnect(); io.disconnect();');
        expect(comp).toContain("removeEventListener('visibilitychange', onVis)");
    });

    it('is a non-interactive layer, faded on mobile, full on md+', () => {
        expect(comp).toContain('pointer-events-none');
        expect(comp).toContain('aria-hidden="true"');
        expect(comp).toContain('opacity-40 md:opacity-100');
    });
});

describe('R55 the hero wiring (src/sites/hub/sections/HeroSection.tsx)', () => {
    const hero = read('src', 'sites', 'hub', 'sections', 'HeroSection.tsx');

    it('renders <HeroRibbons /> as the FIRST child of the hero wrapper', () => {
        const firstChildAt = hero.indexOf('<HeroRibbons />');
        expect(firstChildAt).toBeGreaterThan(-1);
        // it precedes the content column and the featured card (the exact
        // render strings, not JSDoc mentions)
        expect(firstChildAt).toBeLessThan(hero.indexOf('hero-stagger relative z-20 container'));
        expect(firstChildAt).toBeLessThan(hero.indexOf('<FeaturedSolutionsCard onOpenProduct'));
        // and the wrapper is relative + overflow-hidden + full height
        expect(hero).toContain('relative overflow-hidden min-h-[100dvh]');
    });

    it('all hero content sits above the canvas (z-20)', () => {
        expect(hero).toContain('hero-stagger relative z-20');
        expect(hero).toContain('absolute bottom-10 right-6 xl:right-10 z-20');
    });

    it('the hero ground colour is unchanged (#050B18, the R53 navy)', () => {
        expect(hero).toContain("HUB_HERO_GROUND = '#050B18'");
        expect(hero).toContain('style={{ background: HUB_HERO_GROUND }}');
    });

    it('the old animations are fully unmounted — no bands, no swirl, no photo', () => {
        expect(hero).not.toContain('BandsBackground');
        expect(hero).not.toContain('SwirlBands');
        expect(hero).not.toContain('<img');
        expect(hero).not.toContain('ambient-still');
    });
});

describe('R55 the old animation is deleted, not just unmounted', () => {
    it('the R53 bands sources no longer exist', () => {
        expect(existsSync(join(__dirname, '..', '..', 'src', 'lib', 'bands'))).toBe(false);
        expect(existsSync(join(__dirname, '..', '..', 'src', 'lib', 'bands', 'shader.frag.ts'))).toBe(false);
        expect(existsSync(join(__dirname, '..', '..', 'src', 'lib', 'bands', 'createBandsRenderer.ts'))).toBe(false);
        expect(existsSync(join(__dirname, '..', '..', 'src', 'sites', 'shared', 'BandsBackground.tsx'))).toBe(false);
        expect(existsSync(join(__dirname, '..', '..', 'tests', 'unit', 'bandsRenderer.test.ts'))).toBe(false);
    });
});
