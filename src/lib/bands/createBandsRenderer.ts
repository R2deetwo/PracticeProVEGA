/**
 * createBandsRenderer — the WebGL2 host for the flowing-bands shader
 * (R53). Dependency-free, one fullscreen triangle, one draw call per
 * frame, zero per-frame allocations.
 *
 * Contract (owner-supplied spec):
 *   - Canvas size = CSS size × min(devicePixelRatio, 2) × qualityScale.
 *     qualityScale starts at 1; if the 30-frame average frame time
 *     exceeds 20 ms it steps 1 → 0.75 → 0.5 and NEVER steps back up.
 *   - Time accumulates frame delta clamped to 0.1 s (no jump after a
 *     tab switch).
 *   - The pointer uniform lerps toward the real pointer at 0.05/frame
 *     (the canvas itself is pointer-events-none; window-level tracking).
 *   - The loop pauses when the canvas is off-screen
 *     (IntersectionObserver) or the tab is hidden (visibilitychange).
 *   - prefers-reduced-motion: renders ONE frame at uTime = 12.0 and
 *     never animates (resize still re-renders the static frame).
 *   - webglcontextlost/restored handled; dispose() tears down
 *     everything (observers, listeners, GL resources, loop).
 *   - WebGL2 unavailable → a static CSS fallback (linear-gradient from
 *     palette[0] to palette[1] on the container) and NO crash.
 */

import { BANDS_FRAGMENT_SHADER } from './shader.frag';

/** Fullscreen triangle, no buffers — gl_VertexID does the work. */
const VERTEX_SHADER = /* glsl */ `#version 300 es
void main(){
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

export interface BandsRendererOptions {
    /** hex colours: [bg, mid, bright, line]. bg MUST equal the page/hero background. */
    palette: [string, string, string, string];
    /** contour band density. Default 14. */
    bandCount?: number;
    /** line half-width in cell units. Default 0.035. */
    lineWidth?: number;
    /** fold intensity. Higher = more intricate fractal folding. Default 2.4. */
    warp?: number;
    /** drift speed multiplier. Default 1.0. */
    speed?: number;
    /** whether pointer movement subtly warps the field. Default true. */
    pointerReactive?: boolean;
}

export interface BandsRendererStats {
    /** frames drawn since creation */
    frames: number;
    /** rolling average frame cost in ms (rAF-to-rAF), last 30 frames */
    avgFrameMs: number;
    /** current internal quality scale (1 | 0.75 | 0.5) */
    qualityScale: number;
    /** true when WebGL2 was unavailable and the CSS fallback was applied */
    fallback: boolean;
    /** true while the loop is paused (off-screen / hidden tab) */
    paused: boolean;
}

export interface BandsRenderer {
    dispose(): void;
    readonly stats: BandsRendererStats;
}

/** '#RRGGBB' | '#RGB' → [r,g,b] in 0..1 (sRGB, passed to the shader as-is). */
function hexToRgb01(hex: string): [number, number, number] {
    let h = hex.trim().replace(/^#/, '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    if (!Number.isFinite(n) || h.length !== 6) return [0, 0, 0];
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const MAX_DPR = 2;
const FRAME_WINDOW = 30;
const FRAME_BUDGET_MS = 20;
const QUALITY_STEPS = [1, 0.75, 0.5];

export function createBandsRenderer(
    canvas: HTMLCanvasElement,
    opts: BandsRendererOptions,
): BandsRenderer {
    const {
        palette,
        bandCount = 14,
        lineWidth = 0.035,
        warp = 2.4,
        speed = 1.0,
        pointerReactive = true,
    } = opts;

    const stats: BandsRendererStats = {
        frames: 0, avgFrameMs: 0, qualityScale: 1, fallback: false, paused: false,
    };

    // ── GL setup ─────────────────────────────────────────────────────────
    let gl: WebGL2RenderingContext | null = null;
    try {
        gl = canvas.getContext('webgl2', {
            alpha: false,
            antialias: false,          // the shader is full-screen; AA is done in-shader (fwidth)
            depth: false,
            stencil: false,
            powerPreference: 'low-power',
            preserveDrawingBuffer: false,
        }) as WebGL2RenderingContext | null;
    } catch {
        gl = null;
    }

    if (!gl || gl.isContextLost()) {
        // CSS fallback — a quiet vertical wash, never a crash. (A
        // pre-lost context can happen after a StrictMode double-mount or
        // an HMR remount disposed a previous renderer on this canvas —
        // WEBGL_lose_context is permanent for the element, so degrade.)
        stats.fallback = true;
        const host = canvas.parentElement;
        if (host) {
            host.style.background = `linear-gradient(160deg, ${palette[0]} 0%, ${palette[1]} 100%)`;
        }
        canvas.style.display = 'none';
        return { dispose() { /* nothing running */ }, stats };
    }

    const compile = (type: number, src: string): WebGLShader | null => {
        const sh = gl!.createShader(type);
        if (!sh) return null;
        gl!.shaderSource(sh, src);
        gl!.compileShader(sh);
        if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) {
            console.warn('[BandsBackground] shader compile failed:', gl!.getShaderInfoLog(sh));
            gl!.deleteShader(sh);
            return null;
        }
        return sh;
    };

    let program: WebGLProgram | null = null;
    let vao: WebGLVertexArrayObject | null = null;
    // Locations are null-checked once at init; uniform*() calls tolerate
    // a null location as a documented no-op, and the shader compiles or
    // the renderer bails before any draw.
    let uRes: WebGLUniformLocation | null = null;
    let uTime: WebGLUniformLocation | null = null;
    let uPointer: WebGLUniformLocation | null = null;
    let uPal: WebGLUniformLocation | null = null;
    let uBandCount: WebGLUniformLocation | null = null;
    let uLineWidth: WebGLUniformLocation | null = null;
    let uWarp: WebGLUniformLocation | null = null;

    const initGL = (): boolean => {
        const vs = compile(gl!.VERTEX_SHADER, VERTEX_SHADER);
        const fs = compile(gl!.FRAGMENT_SHADER, BANDS_FRAGMENT_SHADER);
        if (!vs || !fs) return false;
        program = gl!.createProgram();
        gl!.attachShader(program!, vs);
        gl!.attachShader(program!, fs);
        gl!.linkProgram(program!);
        gl!.deleteShader(vs);
        gl!.deleteShader(fs);
        if (!gl!.getProgramParameter(program!, gl!.LINK_STATUS)) {
            console.warn('[BandsBackground] program link failed:', gl!.getProgramInfoLog(program!));
            return false;
        }
        vao = gl!.createVertexArray();
        gl!.bindVertexArray(vao);
        gl!.useProgram(program!);
        uRes = gl!.getUniformLocation(program!, 'uRes');
        uTime = gl!.getUniformLocation(program!, 'uTime');
        uPointer = gl!.getUniformLocation(program!, 'uPointer');
        uPal = gl!.getUniformLocation(program!, 'uPal[0]');
        uBandCount = gl!.getUniformLocation(program!, 'uBandCount');
        uLineWidth = gl!.getUniformLocation(program!, 'uLineWidth');
        uWarp = gl!.getUniformLocation(program!, 'uWarp');
        // Static uniforms — uploaded once per program instance.
        const pal = new Float32Array(12);
        palette.forEach((hex, i) => {
            const [r, g, b] = hexToRgb01(hex);
            pal[i * 3] = r; pal[i * 3 + 1] = g; pal[i * 3 + 2] = b;
        });
        gl!.uniform3fv(uPal, pal);
        gl!.uniform1f(uBandCount, bandCount);
        gl!.uniform1f(uLineWidth, lineWidth);
        gl!.uniform1f(uWarp, warp);
        return true;
    };

    if (!initGL()) return { dispose() { /* compile failed — nothing to tear down */ }, stats };

    // ── Sizing: CSS size × min(DPR,2) × qualityScale ─────────────────────
    let cssW = 0, cssH = 0;
    const resize = () => {
        const rect = canvas.getBoundingClientRect();
        cssW = Math.max(1, Math.round(rect.width));
        cssH = Math.max(1, Math.round(rect.height));
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        const w = Math.max(1, Math.round(cssW * dpr * stats.qualityScale));
        const h = Math.max(1, Math.round(cssH * dpr * stats.qualityScale));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            gl!.viewport(0, 0, w, h);
        }
        if (reduced) drawOnce(STATIC_TIME); // static frame must follow a resize
    };

    // ── Pointer: lerp 0.05/frame toward the real pointer ─────────────────
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    const onPointerMove = (e: PointerEvent) => {
        if (!pointerReactive) return;
        const rect = canvas.getBoundingClientRect();
        pointer.tx = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5;
        pointer.ty = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5;
    };

    // ── Draw ─────────────────────────────────────────────────────────────
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const STATIC_TIME = 12.0;
    let time = 0;

    const drawFrame = (t: number) => {
        gl!.uniform2f(uRes, canvas.width, canvas.height);
        gl!.uniform1f(uTime, t);
        gl!.uniform2f(uPointer, pointer.x, 1.0 - pointer.y); // shader y is up
        gl!.drawArrays(gl!.TRIANGLES, 0, 3);
        stats.frames++;
    };
    const drawOnce = (t: number) => drawFrame(t);

    // ── The loop ─────────────────────────────────────────────────────────
    let raf = 0;
    let last = performance.now();
    let visible = true;
    const frameCosts: number[] = [];   // rolling rAF-to-rAF costs (ms)
    let framesSinceCheck = 0;

    let disposed = false;
    let lastCheckAt = performance.now();

    const maybeStepQuality = (minSamples = FRAME_WINDOW) => {
        if (frameCosts.length < minSamples) return;
        const avg = frameCosts.reduce((a, b) => a + b, 0) / frameCosts.length;
        stats.avgFrameMs = avg;
        const idx = QUALITY_STEPS.indexOf(stats.qualityScale);
        if (avg > FRAME_BUDGET_MS && idx < QUALITY_STEPS.length - 1) {
            stats.qualityScale = QUALITY_STEPS[idx + 1];
            frameCosts.length = 0;
            resize(); // rebuild buffers at the new scale
        } else {
            // Keep the window rolling.
            frameCosts.splice(0, frameCosts.length - FRAME_WINDOW);
        }
    };

    const frame = (now: number) => {
        if (disposed) return;
        raf = requestAnimationFrame(frame);
        // Off-screen or hidden tab: skip work entirely (clock keeps pace
        // via `last` so no giant dt accumulates).
        if (!visible || document.hidden) { last = now; return; }
        const cost = now - last;
        last = now;
        frameCosts.push(cost);
        // Check the budget every FRAME_WINDOW frames — or every 2s once
        // we have ≥10 samples, so a very slow device (software GL, low-end
        // GPU) scales down within seconds instead of after a full
        // 30-frame window at 4fps.
        if (++framesSinceCheck >= FRAME_WINDOW) {
            framesSinceCheck = 0;
            lastCheckAt = now;
            maybeStepQuality();
        } else if (now - lastCheckAt > 2000 && frameCosts.length >= 10) {
            // Very slow device (software GL, low-end GPU): scale down
            // within seconds instead of after a full 30-frame window.
            lastCheckAt = now;
            maybeStepQuality(10);
        }

        // dt clamped to 0.1 s — no jump after a tab switch.
        const dt = Math.min(cost / 1000, 0.1);
        time += dt * speed;

        // Pointer easing (0.05 per frame, frame-rate independent enough
        // at the 30–120 fps range this targets).
        pointer.x += (pointer.tx - pointer.x) * 0.05;
        pointer.y += (pointer.ty - pointer.y) * 0.05;

        drawFrame(time);
    };

    // ── Observers & lifecycle ────────────────────────────────────────────
    const io = new IntersectionObserver(
        (entries) => {
            visible = entries.some((e) => e.isIntersecting);
            stats.paused = !visible;
        },
        { threshold: 0 },
    );
    io.observe(canvas);

    const ro = new ResizeObserver(() => resize());
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const onVisibility = () => { last = performance.now(); stats.paused = document.hidden; };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const onContextLost = (e: Event) => { e.preventDefault(); cancelAnimationFrame(raf); };
    const onContextRestored = () => {
        if (disposed) return;
        if (!initGL()) return;       // re-create program + uniforms on the new context
        resize();
        last = performance.now();
        if (!reduced) raf = requestAnimationFrame(frame);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    resize();

    if (reduced) {
        // ONE static composition, never animated (spec: uTime = 12.0).
        drawOnce(STATIC_TIME);
    } else {
        raf = requestAnimationFrame(frame);
    }

    return {
        dispose() {
            disposed = true;
            cancelAnimationFrame(raf);
            io.disconnect();
            ro.disconnect();
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('webglcontextlost', onContextLost);
            canvas.removeEventListener('webglcontextrestored', onContextRestored);
            if (gl) {
                // Delete OUR objects — but NEVER call WEBGL_lose_context:
                // losing the context is PERMANENT for the canvas element,
                // which breaks React StrictMode's dev double-mount (and
                // HMR remounts): the second effect run would receive a
                // dead context and render nothing. The GPU memory is
                // reclaimed when the unmounted canvas is collected.
                gl.deleteProgram(program);
                gl.deleteVertexArray(vao);
            }
        },
        stats,
    };
}
