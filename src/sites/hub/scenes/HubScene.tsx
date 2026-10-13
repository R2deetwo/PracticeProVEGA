import React, { useEffect, useRef, useState } from 'react';

/**
 * HubScene — "One order, start to finish" (hub-restore Phase C).
 *
 * Problem being fixed: the hero used to show an abstract polyhedron that
 * meant nothing to a shop owner, a lawyer or a landlord. This scene shows
 * a story a Nigerian business owner recognises in one glance:
 *
 *   1. A phone with a WhatsApp-green chat bubble floats in.   "Order arrives"
 *   2. The bubble becomes a card slotting into a tray queue.  "Nobody loses it"
 *   3. The tray feeds a glowing ledger book.                  "Money recorded"
 *   4. A paper receipt with a naira sign slides out.          "Receipt sent"
 *
 * Everything is built from three.js primitives (boxes) — no model files,
 * no new dependencies (CSP-safe; the naira mark is drawn as strokes, not
 * a font glyph). Soft low-poly look: flat shading, few lights, slow loop
 * of 14s. Brand green plus warm paper/brass accents.
 *
 * Performance + safety contract (C5):
 *   - three.js imported DYNAMICALLY (its own lazy chunk).
 *   - Mounted only when scrolled into view (IntersectionObserver — no
 *     rAF/timer dependency, so deterministic captures still paint it).
 *   - devicePixelRatio capped at 1.5.
 *   - Rendering pauses offscreen and on hidden tabs.
 *   - prefers-reduced-motion: ONE static frame (the four-stage tableau).
 *   - WebGL unavailable: a static SVG poster of the same four stages.
 *   - Renderer + geometries + materials disposed on unmount.
 *   - The host box reserves its height (aspect ratio) — zero layout shift.
 *   - No new utilities: the scene depends on nothing outside this file.
 */

const STAGES = [
    { t0: 0, label: 'Order arrives' },
    { t0: 3.5, label: 'Nobody loses it' },
    { t0: 7, label: 'Money recorded' },
    { t0: 10.5, label: 'Receipt sent' },
] as const;
const LOOP = 14;

/** Static SVG poster — the WebGL-free face of the same four stages. */
export const HubScenePoster: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg viewBox="0 0 640 300" className={className} role="img"
        aria-label="One order, start to finish: order arrives, nobody loses it, money recorded, receipt sent">
        {/* panel 1 — the phone with a WhatsApp-green bubble */}
        <g>
            <rect x="18" y="60" width="120" height="180" rx="14" fill="#1F2937" stroke="#374151" />
            <rect x="30" y="74" width="96" height="132" rx="6" fill="#0B1220" />
            <rect x="52" y="120" width="60" height="34" rx="10" fill="#25D366" />
            <rect x="58" y="128" width="38" height="4" rx="2" fill="#D9F7E4" />
            <rect x="58" y="137" width="26" height="4" rx="2" fill="#D9F7E4" />
            <rect x="40" y="170" width="44" height="18" rx="9" fill="#1E3A2F" stroke="#34D399" strokeWidth="1" />
        </g>
        <text x="78" y="266" textAnchor="middle" fill="#A7F3D0" fontSize="11" fontFamily="ui-monospace, monospace" letterSpacing="1">ORDER ARRIVES</text>
        {/* panel 2 — the queue tray, one card highlighted */}
        <g>
            <rect x="184" y="150" width="120" height="16" rx="4" fill="#1F2937" />
            <rect x="188" y="118" width="6" height="34" fill="#374151" /><rect x="241" y="118" width="6" height="34" fill="#374151" /><rect x="294" y="118" width="6" height="34" fill="#374151" />
            <rect x="196" y="96" width="40" height="46" rx="4" fill="#E5E7EB" opacity="0.45" />
            <rect x="249" y="96" width="40" height="46" rx="4" fill="#E5E7EB" opacity="0.45" />
            <rect x="200" y="88" width="44" height="52" rx="4" fill="#F5EFDF" stroke="#34D399" strokeWidth="1.5" />
            <path d="M214 108 l6 6 l10 -12" fill="none" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <text x="244" y="266" textAnchor="middle" fill="#A7F3D0" fontSize="11" fontFamily="ui-monospace, monospace" letterSpacing="1">NOBODY LOSES IT</text>
        {/* panel 3 — the glowing ledger */}
        <g>
            <ellipse cx="390" cy="150" rx="70" ry="26" fill="#E9B34A" opacity="0.14" />
            <path d="M330 152 q30 -12 60 0 q30 -12 60 0 l0 20 q-30 12 -60 0 q-30 12 -60 0 Z" fill="#F5EFDF" stroke="#D6C9A8" />
            <path d="M336 160 q24 -9 54 0 M336 172 q24 -9 54 0 M396 160 q24 -9 54 0 M396 172 q24 -9 54 0" stroke="#8B7E5E" strokeWidth="3" fill="none" strokeLinecap="round" />
            <rect x="386" y="140" width="8" height="34" rx="3" fill="#E9B34A" />
        </g>
        <text x="390" y="266" textAnchor="middle" fill="#A7F3D0" fontSize="11" fontFamily="ui-monospace, monospace" letterSpacing="1">MONEY RECORDED</text>
        {/* panel 4 — the receipt with the naira sign (strokes, no font) */}
        <g>
            <rect x="520" y="70" width="90" height="150" rx="6" fill="#F5EFDF" stroke="#D6C9A8" />
            <path d="M544 100 l0 34 M544 100 l22 34 M544 113 l22 0 M544 121 l22 0" stroke="#3F3A2C" strokeWidth="4" fill="none" strokeLinecap="round" />
            <rect x="546" y="152" width="40" height="5" rx="2.5" fill="#C9BE9E" />
            <rect x="546" y="164" width="30" height="5" rx="2.5" fill="#C9BE9E" />
            <rect x="546" y="176" width="38" height="5" rx="2.5" fill="#C9BE9E" />
            <path d="M526 208 l6 8 l6 -8 M550 208 l6 8 l6 -8 M574 208 l6 8 l6 -8" stroke="#C9BE9E" strokeWidth="2" fill="none" />
        </g>
        <text x="565" y="266" textAnchor="middle" fill="#A7F3D0" fontSize="11" fontFamily="ui-monospace, monospace" letterSpacing="1">RECEIPT SENT</text>
    </svg>
);

/** The stage captions as a row (poster/reduced-motion mode). */
const PosterCaptions: React.FC = () => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 w-full">
        {STAGES.map((s) => (
            <span key={s.label} className="text-center text-[11px] sm:text-xs font-semibold tracking-wide text-emerald-200/80">
                {s.label}
            </span>
        ))}
    </div>
);

/** Live caption — the current stage, crossfading, with progress dots. */
const LiveCaption: React.FC<{ stage: number }> = ({ stage }) => (
    <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 px-4 pb-3 pointer-events-none">
        <div className="flex items-center gap-1.5" aria-hidden="true">
            {STAGES.map((s, i) => (
                <span key={s.label}
                    className={`h-1.5 rounded-full transition-all duration-500 ${i === stage ? 'w-6 bg-emerald-400' : 'w-1.5 bg-white/25'}`} />
            ))}
        </div>
        <p key={stage} className="text-xs sm:text-sm font-semibold text-emerald-200/90 tracking-wide animate-swap-in">
            {STAGES[stage].label}
        </p>
        <span className="sr-only" aria-live="polite">{STAGES[stage].label}</span>
    </div>
);

export const HubScene: React.FC<{ className?: string }> = ({ className = '' }) => {
    const hostRef = useRef<HTMLDivElement>(null);
    const [mode, setMode] = useState<'loading' | 'live' | 'poster'>('loading');
    const [stage, setStage] = useState(0);
    const stageRef = useRef(0);
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReduced(mq.matches);
        const on = () => setReduced(mq.matches);
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;
        let disposed = false;
        let cleanupScene: (() => void) | null = null;

        // Mount only when visible (IO fires without rAF/timers — captures
        // under a killed rAF still mount and paint one frame).
        const mount = () => {
            if (disposed) return;
            (async () => {
                let THREE: typeof import('three');
                try {
                    THREE = await import('three');
                } catch {
                    setMode('poster');
                    return;
                }
                if (disposed || !host.isConnected) return;
                try {
                    cleanupScene = buildScene(THREE, host, reduced, (s) => {
                        if (stageRef.current !== s) { stageRef.current = s; setStage(s); }
                    });
                    if (!cleanupScene) { setMode('poster'); return; }
                    setMode('live');
                } catch {
                    setMode('poster');
                }
            })();
        };
        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver((entries) => {
                if (entries.some((e) => e.isIntersecting)) { io.disconnect(); mount(); }
            }, { threshold: 0.05 });
            io.observe(host);
            return () => { io.disconnect(); disposed = true; cleanupScene?.(); };
        }
        mount();
        return () => { disposed = true; cleanupScene?.(); };
    }, [reduced]);

    return (
        <div className={`relative w-full aspect-[4/3] max-h-[26rem] mx-auto overflow-hidden rounded-2xl ${className}`}
            role="img"
            aria-label="One order, start to finish: an order arrives by chat, joins a queue nothing loses, is recorded in a ledger, and a receipt is sent">
            {/* structural fallback cloud — paints before WebGL arrives */}
            <div className="absolute inset-0 w8-lattice-fallback" aria-hidden="true" />
            <div ref={hostRef} className="absolute inset-0" aria-hidden="true" />
            {mode === 'poster' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-4 sm:px-10">
                    <HubScenePoster className="w-full h-auto max-h-[70%]" />
                    <div className="w-full max-w-sm"><PosterCaptions /></div>
                </div>
            )}
            {mode === 'live' && (reduced
                ? <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-3"><PosterCaptions /></div>
                : <LiveCaption stage={stage} />)}
        </div>
    );
};

export default HubScene;

// ─────────────────────────────────────────────────────────────────────────
// The three.js scene. Everything below depends on nothing outside this
// file (the C5 ≤60-lines-per-new-utility budget is unused).
// ─────────────────────────────────────────────────────────────────────────
function buildScene(
    THREE: typeof import('three'),
    host: HTMLDivElement,
    reducedMotion: boolean,
    onStage: (s: number) => void,
): (() => void) | null {
    // ── renderer (throws under --disable-webgl → poster) ──
    let renderer: import('three').WebGLRenderer;
    try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
        return null;
    }
    if (!renderer.getContext()) return null;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, host.clientWidth / host.clientHeight, 0.1, 60);
    camera.position.set(0, 2.3, 8.6);
    camera.lookAt(0, 0.35, 0);

    // ── lights: soft key, emerald rim, warm lamp over the ledger ──
    scene.add(new THREE.AmbientLight(0xF2E9DC, 0.55));
    const key = new THREE.DirectionalLight(0xFFFFFF, 0.85); key.position.set(-3, 6, 5); scene.add(key);
    const rim = new THREE.PointLight(0x34D399, 0.5, 30); rim.position.set(-6.5, 2.5, 2); scene.add(rim);
    const lamp = new THREE.PointLight(0xE9B34A, 0.0, 18); lamp.position.set(1.4, 4.6, 1.2); scene.add(lamp);

    const mats: import('three').Material[] = [];
    const geos: import('three').BufferGeometry[] = [];
    const M = (m: import('three').Material) => { mats.push(m); return m; };
    const G = (g: import('three').BufferGeometry) => { geos.push(g); return g; };
    const box = (w: number, h: number, d: number) => G(new THREE.BoxGeometry(w, h, d));
    const mat = (color: number, opts: { emissive?: number; ei?: number; rough?: number } = {}) =>
        M(new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: opts.rough ?? 0.55, metalness: 0.04, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.ei ?? 0 }));

    // ── stage 1: the phone with a WhatsApp-green bubble ──
    const phone = new THREE.Group();
    phone.add(new THREE.Mesh(box(1.7, 3.3, 0.22), mat(0x1F2937)));
    const screen = new THREE.Mesh(box(1.5, 3.05, 0.06), mat(0x0B1220, { emissive: 0x0E1B14, ei: 0.55, rough: 0.3 })); screen.position.z = 0.13; phone.add(screen);
    const bubble = new THREE.Mesh(box(1.05, 0.62, 0.08), mat(0x25D366, { emissive: 0x1E9E4E, ei: 0.35, rough: 0.35 })); bubble.position.set(-0.16, 0.55, 0.2); phone.add(bubble);
    const t1 = new THREE.Mesh(box(0.62, 0.07, 0.02), mat(0xD9F7E4)); t1.position.set(-0.42, 0.62, 0.25); phone.add(t1);
    const t2 = new THREE.Mesh(box(0.42, 0.07, 0.02), mat(0xD9F7E4)); t2.position.set(-0.42, 0.48, 0.25); phone.add(t2);
    phone.position.set(1.9, 0.2, 0.4); phone.rotation.set(-0.06, -0.28, 0.05); scene.add(phone);

    // ── stage 2: the tray queue ──
    const tray = new THREE.Group();
    tray.add(new THREE.Mesh(box(3.4, 0.28, 1.15), mat(0x243044)));
    const slot = (x: number) => { const s = new THREE.Mesh(box(0.09, 0.5, 1.05), mat(0x374151)); s.position.set(x, 0.36, 0); tray.add(s); };
    slot(-0.62); slot(0); slot(0.62);
    const idleCard = (x: number) => { const c = new THREE.Mesh(box(0.56, 0.66, 0.72), mat(0xE5E7EB, { rough: 0.7 })); c.position.set(x, 0.55, 0); tray.add(c); return c; };
    idleCard(-0.62); idleCard(0);
    const liveCard = new THREE.Mesh(box(0.56, 0.66, 0.72), mat(0xF5EFDF, { emissive: 0x2E7D5B, ei: 0.12, rough: 0.5 })); liveCard.position.set(0.62, 2.6, 0); tray.add(liveCard);
    tray.position.set(-1.55, -0.5, -0.2); tray.rotation.y = 0.24; tray.visible = false; scene.add(tray);

    // ── stage 3: the ledger book ──
    const ledger = new THREE.Group();
    ledger.add(new THREE.Mesh(box(2.9, 0.16, 1.7), mat(0x3A3126)));
    const pageL = new THREE.Mesh(box(1.34, 0.1, 1.42), mat(0xF5EFDF)); pageL.position.set(-0.72, 0.14, 0); pageL.rotation.z = 0.1; ledger.add(pageL);
    const pageR = new THREE.Mesh(box(1.34, 0.1, 1.42), mat(0xF5EFDF)); pageR.position.set(0.72, 0.14, 0); pageR.rotation.z = -0.1; ledger.add(pageR);
    const spine = new THREE.Mesh(box(0.16, 0.3, 1.5), mat(0xE9B34A, { emissive: 0xC98F2F, ei: 0.0, rough: 0.35 })); spine.position.set(0, 0.2, 0); ledger.add(spine);
    const entries: import('three').Mesh[] = [];
    for (let i = 0; i < 4; i++) {
        const e = new THREE.Mesh(box(0.8 - i * 0.1, 0.05, 0.05), mat(0x8B7E5E));
        e.position.set(0.72 - (i % 2) * 0.1, 0.22, -0.42 + i * 0.26);
        e.rotation.z = -0.1; e.visible = false; ledger.add(e); entries.push(e);
    }
    ledger.position.set(1.35, -0.62, -0.3); ledger.rotation.y = -0.2; ledger.visible = false; scene.add(ledger);

    // ── stage 4: the receipt (naira mark drawn as strokes on a canvas) ──
    const receipt = new THREE.Group();
    const rc = document.createElement('canvas'); rc.width = 128; rc.height = 220;
    const rx = rc.getContext('2d')!;
    rx.fillStyle = '#F5EFDF'; rx.fillRect(0, 0, 128, 220);
    rx.strokeStyle = '#3F3A2C'; rx.lineWidth = 13; rx.lineCap = 'round';
    rx.beginPath(); rx.moveTo(46, 52); rx.lineTo(46, 108); rx.lineTo(82, 52); rx.stroke();  // the N
    rx.lineWidth = 9;
    rx.beginPath(); rx.moveTo(36, 74); rx.lineTo(92, 74); rx.moveTo(36, 92); rx.lineTo(92, 92); rx.stroke(); // the two bars
    rx.fillStyle = '#C9BE9E';
    [138, 158, 178].forEach((y, i) => rx.fillRect(38, y, 84 - i * 16, 9));
    rx.strokeStyle = '#C9BE9E'; rx.lineWidth = 4;
    for (let x = 22; x < 106; x += 16) { rx.beginPath(); rx.moveTo(x, 206); rx.lineTo(x + 8, 214); rx.stroke(); }
    const rtex = new THREE.CanvasTexture(rc);
    const receiptFace = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.06), M(new THREE.MeshBasicMaterial({ map: rtex })));
    receiptFace.position.z = 0.032; receipt.add(receiptFace);
    const receiptBody = new THREE.Mesh(box(0.62, 1.06, 0.05), mat(0xEFE7D3)); receipt.add(receiptBody);
    receipt.position.set(2.6, -0.3, 0.1); receipt.rotation.set(0.1, -0.34, 0.06); receipt.visible = false; scene.add(receipt);
    geos.push(receiptFace.geometry);

    // ── the desk all four objects live on ──
    const desk = new THREE.Mesh(G(new THREE.CylinderGeometry(4.6, 4.6, 0.14, 10)), mat(0x16202E, { rough: 0.85 }));
    desk.position.y = -0.98; scene.add(desk);

    // ── animation ──
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    const ease = (t: number) => t * t * (3 - 2 * t); // smoothstep
    const easeOutBack = (t: number) => { const c = 1.35; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };

    const draw = (t: number) => {
        const lt = t % LOOP;
        const st = lt < 3.5 ? 0 : lt < 7 ? 1 : lt < 10.5 ? 2 : 3;
        onStage(st);

        // Stage 1 — the phone floats in, the bubble pops.
        const a1 = clamp01(lt / 0.9);
        phone.visible = lt < 4.6;
        phone.position.y = 0.2 + Math.sin(lt * 1.6) * 0.06;
        phone.position.x = 1.9 - (1 - ease(a1)) * 5.5;
        phone.scale.setScalar(0.92 + 0.08 * ease(a1));
        const pop = clamp01((lt - 0.85) / 0.35);
        bubble.scale.setScalar(easeOutBack(pop) || 0.001);
        t1.visible = t2.visible = pop > 0.8;

        // Stage 2 — the bubble becomes the card; the card slots into the tray.
        const a2 = clamp01((lt - 3.5) / 0.6);
        tray.visible = lt >= 3.1 && lt < 7.6;
        tray.position.y = -0.5 - (1 - ease(clamp01((lt - 3.5) / 0.9))) * 3.2;
        const drop = clamp01((lt - 4.1) / 0.75);
        liveCard.position.y = 2.6 - ease(drop) * 2.05;
        (liveCard.material as import('three').MeshStandardMaterial).emissiveIntensity = 0.12 + 0.25 * clamp01((lt - 4.85) / 0.4);

        // Stage 3 — the tray feeds the ledger; entries tick in; the lamp warms.
        const a3 = clamp01((lt - 7) / 0.8);
        ledger.visible = lt >= 6.9;
        ledger.position.y = -0.62 - (1 - ease(a3)) * 2.6;
        // The tray slides its live card across to the ledger and hands it over.
        const feed = clamp01((lt - 7.6) / 0.85);
        tray.position.x = -1.55 + ease(feed) * 1.35;
        tray.scale.setScalar(1 - 0.12 * feed);
        entries.forEach((e, i) => { e.visible = lt > 8.35 + i * 0.22; });
        (spine.material as import('three').MeshStandardMaterial).emissiveIntensity = 0.15 + 0.75 * clamp01((lt - 8.2) / 0.6);
        lamp.intensity = 0.3 + 1.15 * clamp01((lt - 8.0) / 0.7);

        // Stage 4 — the receipt slides out with the naira mark; the lamp settles.
        const a4 = clamp01((lt - 10.5) / 0.8);
        receipt.visible = lt >= 10.4;
        receipt.position.x = 2.6 - (1 - ease(a4)) * 1.5;
        receipt.position.y = -0.3 + ease(a4) * 0.28 + Math.sin(lt * 1.4) * 0.03;
        if (lt > 10.5) lamp.intensity = 0.9 + 0.25 * Math.sin(lt * 2.2);

        // Camera: a slow drift so nothing is ever fully static.
        camera.position.x = Math.sin(t * 0.08) * 0.35;
        camera.lookAt(0, 0.3, 0);
    };

    if (reducedMotion) {
        // One static frame: the four-stage tableau (matches the poster).
        onStage(0);
        tray.visible = ledger.visible = receipt.visible = true;
        tray.position.set(-2.6, -0.5, -0.4);
        phone.position.set(3.35, 0.35, 0.6);
        ledger.position.set(0.9, -0.62, -0.3);
        receipt.position.set(2.9, -0.1, 0.2);
        entries.forEach((e) => { e.visible = true; });
        (spine.material as import('three').MeshStandardMaterial).emissiveIntensity = 0.6; lamp.intensity = 1.0;
        renderer.render(scene, camera);
    } else {
        let visible = true;
        let raf = 0;
        const t0 = performance.now();
        const frame = (now: number) => {
            if (!visible) { raf = 0; return; }
            draw((now - t0) / 1000);
            renderer.render(scene, camera);
            raf = requestAnimationFrame(frame);
        };
        draw(0);
        renderer.render(scene, camera);
        raf = requestAnimationFrame(frame);
        const io = new IntersectionObserver((es) => {
            const was = visible;
            visible = es.some((e) => e.isIntersecting);
            if (visible && raf === 0) raf = requestAnimationFrame(frame);
            if (!visible && was) renderer.render(scene, camera); // hold last frame
        }, { threshold: 0.02 });
        io.observe(host);
        const onVis = () => {
            if (document.hidden) { visible = false; }
        };
        document.addEventListener('visibilitychange', onVis);
        return () => {
            io.disconnect();
            document.removeEventListener('visibilitychange', onVis);
            if (raf) cancelAnimationFrame(raf);
            rtex.dispose();
            mats.forEach((m) => m.dispose());
            geos.forEach((g) => g.dispose());
            desk.geometry.dispose();
            renderer.dispose();
            if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
        };
    }
    // reduced-motion cleanup path
    return () => {
        rtex.dispose();
        mats.forEach((m) => m.dispose());
        geos.forEach((g) => g.dispose());
        desk.geometry.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
}
