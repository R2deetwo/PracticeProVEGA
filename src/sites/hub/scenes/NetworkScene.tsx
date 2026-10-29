import React, { useEffect, useRef } from 'react';

/**
 * NetworkScene — R44 "the map of the internet" (the corporate hero).
 *
 * Owner direction (R44): the convergence ring "is not really how networks
 * look. Have you ever seen a heat map of the internet? … little clusters
 * communicating with each other." The reference is the Opte/Peer1 style
 * internet map: a MESH of small clusters, each with a hub and its leaf
 * nodes, joined by a brighter BACKBONE of long arcs, with light
 * travelling the backbone constantly — traffic routing through the map.
 *
 * The picture, over the ambient workspace video on the ivory ground:
 *   1. CLUSTERS — 12 on desktop (7 on small screens): a hub node plus
 *      4-8 leaves in tight local orbits. Three tier-1 hubs run larger
 *      and brighter (the major carriers of the map).
 *   2. THE BACKBONE — every hub joins its 2-3 nearest neighbours (3-4
 *      for tier-1) through long bowed arcs, brighter than the tendrils.
 *   3. TRAFFIC — pulses travel the backbone and ROUTE at hubs: on
 *      arrival a pulse picks a new arc from that hub's adjacency, so
 *      light visibly flows THROUGH the map, cluster to cluster.
 *   4. THE VISITOR'S HAND — pointer parallax; nodes and arcs brighten
 *      near the cursor; nodes lean toward it; a soft presence halo
 *      follows; a click finds the nearest hub and fires pulses along
 *      every arc it owns — the visitor's own traffic entering the map.
 *
 * Build-in (the anti-plop): hubs scale in staggered across the field,
 * leaves pop after their hub, the backbone draws itself, then the
 * traffic begins — ~2.6s, all time-based.
 *
 * Engineering contract (unchanged from every prior scene):
 * - three.js imported DYNAMICALLY — its own lazy chunk.
 * - Pauses offscreen (IntersectionObserver) and when the tab is hidden.
 * - One fully-assembled static frame under prefers-reduced-motion.
 * - Silent CSS fallback (.r42-net-fallback) when WebGL is unavailable.
 * - Everything drawn lives inside this component's own canvas.
 */
const NetworkScene: React.FC<{ className?: string }> = ({ className = '' }) => {
    const hostRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;

        let disposed = false;
        let teardown: (() => void) | undefined;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const boot = async () => {
            let THREE: typeof import('three');
            try {
                THREE = await import('three');
            } catch {
                return; // no three — CSS fallback shows through.
            }
            if (disposed || !host.isConnected) return;

            let renderer: import('three').WebGLRenderer;
            try {
                renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
            } catch {
                return; // CSS fallback.
            }

            const W = () => host.clientWidth;
            const H = () => Math.max(1, host.clientHeight);
            const isSmall = W() < 700;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.5 : 1.75));
            renderer.setSize(W(), H());
            renderer.domElement.style.width = '100%';
            renderer.domElement.style.height = '100%';
            renderer.domElement.style.display = 'block';
            host.appendChild(renderer.domElement);

            const NARROW = W() / H() < 0.95;
            const CAM_Z = NARROW ? 10.6 : 7.4;
            const camera = new THREE.PerspectiveCamera(42, W() / H(), 0.1, 60);
            camera.position.set(0, 0.12, CAM_Z);

            const scene = new THREE.Scene();
            const world = new THREE.Group();
            scene.add(world);

            // ── Palette (daylight register — see docs/design/TOKENS.md) ──
            const C = {
                emerald: new THREE.Color('#16A34A'),
                emeraldDeep: new THREE.Color('#047857'),
                mint: new THREE.Color('#34D399'),
                teal: new THREE.Color('#0D9488'),
                sky: new THREE.Color('#0369A1'),
                slate: new THREE.Color('#64748B'),
                moss: new THREE.Color('#4D7C0F'),
            };

            // ── Deterministic authoring ─────────────────────────────────
            const rnd = (() => { let s = 1337; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

            // Visible field at z=0 (the cluster field lives on z≈0).
            const halfH = Math.tan((42 * Math.PI) / 360) * CAM_Z;   // ≈2.84 desktop
            const halfW = halfH * camera.aspect;

            // HUBS — rejection-sampled with a minimum separation, biased
            // to the right two-thirds of the field (the copy owns the
            // left). Two strays are allowed further left at low alpha.
            type Hub = { x: number; y: number; tier1: boolean; hue: import('three').Color; reveal: number; flash: number };
            const HUB_N = isSmall ? 7 : 12;
            const hubs: Hub[] = [];
            const MIN_D = isSmall ? 1.05 : 1.18;
            const HUES = [C.emerald, C.teal, C.sky, C.emeraldDeep, C.mint, C.slate, C.moss];
            let guard = 0;
            while (hubs.length < HUB_N && guard++ < 600) {
                const u = rnd(), v = rnd();
                // Right bias: x in [-0.42..0.95] of halfW (u^0.75 skews right).
                const x = (-0.42 + Math.pow(u, 0.72) * 1.37) * halfW;
                const y = (v - 0.5) * 1.62 * halfH;
                if (hubs.some((h) => Math.hypot(h.x - x, h.y - y) < MIN_D)) continue;
                hubs.push({
                    x, y,
                    tier1: hubs.length < 3,
                    hue: HUES[hubs.length % HUES.length],
                    reveal: (hubs.length / HUB_N) * 0.55 + rnd() * 0.12,
                    flash: 0,
                });
            }

            // LEAVES — 4-8 per hub, tight local orbits.
            type Leaf = {
                hub: number; ax: number; ay: number; az: number;
                orbitR: number; orbitW: number; phase: number;
                size: number; reveal: number;
                pos: import('three').Vector3; lean: import('three').Vector3;
            };
            const leaves: Leaf[] = [];
            hubs.forEach((h, hi) => {
                const n = 4 + Math.floor(rnd() * 5); // 4..8
                for (let i = 0; i < n; i++) {
                    const a = rnd() * Math.PI * 2;
                    const r = 0.16 + rnd() * 0.3;
                    leaves.push({
                        hub: hi,
                        ax: h.x + Math.cos(a) * r,
                        ay: h.y + Math.sin(a) * r * 0.8,
                        az: (rnd() - 0.5) * 0.45,
                        orbitR: 0.04 + rnd() * 0.08,
                        orbitW: 0.25 + rnd() * 0.5,
                        phase: rnd() * Math.PI * 2,
                        size: 0.048 + rnd() * 0.05,
                        reveal: h.reveal + 0.08 + rnd() * 0.14,
                        pos: new THREE.Vector3(),
                        lean: new THREE.Vector3(),
                    });
                }
            });
            const NODE_COUNT = hubs.length + leaves.length;

            // ── Links ───────────────────────────────────────────────────
            type Link = {
                a: import('three').Vector3; ctrl: import('three').Vector3; b: import('three').Vector3;
                hue: import('three').Color; alpha: number; backbone: boolean;
                reveal: number; segs: number; v0: number; mid: import('three').Vector3;
                hubA: number; hubB: number; // backbone adjacency (−1 for tendrils)
            };
            const SEG = 22;
            const links: Link[] = [];
            const pushLink = (
                a: import('three').Vector3, b: import('three').Vector3,
                hue: import('three').Color, alpha: number, backbone: boolean,
                reveal: number, hubA = -1, hubB = -1,
            ) => {
                const mid = a.clone().add(b).multiplyScalar(0.5);
                const dir = b.clone().sub(a);
                const perp = new THREE.Vector3(-dir.y, dir.x, 0).normalize();
                const bow = (backbone ? 0.3 + rnd() * 0.3 : 0.06 + rnd() * 0.1) * (rnd() > 0.5 ? 1 : -1);
                mid.add(perp.multiplyScalar(bow));
                mid.z += (rnd() - 0.5) * (backbone ? 0.45 : 0.18);
                links.push({ a: a.clone(), ctrl: mid, b: b.clone(), hue, alpha, backbone, reveal, segs: SEG, v0: 0, mid, hubA, hubB });
            };

            // Backbone: each hub joins its k nearest (tier-1: k+1).
            const edgeSeen = new Set<string>();
            hubs.forEach((h, hi) => {
                const near = hubs
                    .map((o, oi) => ({ oi, d: Math.hypot(o.x - h.x, o.y - h.y) }))
                    .filter((o) => o.oi !== hi)
                    .sort((p, q) => p.d - q.d);
                const k = h.tier1 ? 4 : 3;
                for (let i = 0; i < k && i < near.length; i++) {
                    const oi = near[i].oi;
                    const key = hi < oi ? `${hi}-${oi}` : `${oi}-${hi}`;
                    if (edgeSeen.has(key)) continue;
                    edgeSeen.add(key);
                    // Backbone hue: blend of the two hubs' colours.
                    const hue = h.hue.clone().lerp(hubs[oi].hue, 0.5);
                    pushLink(
                        new THREE.Vector3(h.x, h.y, 0),
                        new THREE.Vector3(hubs[oi].x, hubs[oi].y, 0),
                        hue, 0.3 + rnd() * 0.12, true,
                        0.34 + Math.min(h.reveal, hubs[oi].reveal) * 0.5, hi, oi,
                    );
                }
            });
            // Tendrils: every leaf to its hub.
            const hubVec = (hi: number) => new THREE.Vector3(hubs[hi].x, hubs[hi].y, 0);
            leaves.forEach((lf) => {
                pushLink(
                    new THREE.Vector3(lf.ax, lf.ay, lf.az),
                    hubVec(lf.hub),
                    hubs[lf.hub].hue, 0.16 + rnd() * 0.08, false,
                    lf.reveal,
                );
            });
            const LINK_COUNT = links.length;
            const LINK_VERTS = LINK_COUNT * SEG * 2;

            // Backbone adjacency (hub index -> link indices) for routing.
            const adjacency: number[][] = hubs.map(() => []);
            links.forEach((lk, li) => {
                if (lk.hubA >= 0) { adjacency[lk.hubA].push(li); adjacency[lk.hubB].push(li); }
            });

            // ── Shaders ────────────────────────────────────────────────
            const lineVert = `
                attribute vec3 aColor; attribute float aAlpha;
                varying vec3 vC; varying float vA;
                void main() {
                    vC = aColor; vA = aAlpha;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`;
            const lineFrag = `
                varying vec3 vC; varying float vA;
                void main() { gl_FragColor = vec4(vC, vA); }`;

            const pointVert = `
                attribute float aSize; attribute vec3 aColor; attribute float aAlpha;
                uniform float uPx; varying vec3 vC; varying float vA;
                void main() {
                    vC = aColor; vA = aAlpha;
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = aSize * uPx / max(0.001, -mv.z);
                    gl_Position = projectionMatrix * mv;
                }`;
            const pointFrag = `
                varying vec3 vC; varying float vA;
                void main() {
                    float d = length(gl_PointCoord - vec2(0.5));
                    float a = smoothstep(0.5, 0.16, d);
                    gl_FragColor = vec4(vC, a * vA);
                }`;

            const pxScale = () => (H() * renderer.getPixelRatio()) / (2 * Math.tan((42 * Math.PI) / 360));

            // ── Node cloud: hubs then leaves ────────────────────────────
            const nodeGeo = new THREE.BufferGeometry();
            const nodePos = new Float32Array(NODE_COUNT * 3);
            const nodeCol = new Float32Array(NODE_COUNT * 3);
            const nodeSize = new Float32Array(NODE_COUNT);
            const nodeAlpha = new Float32Array(NODE_COUNT);
            hubs.forEach((h, i) => (h.tier1 ? C.emeraldDeep : h.hue).toArray(nodeCol, i * 3));
            leaves.forEach((lf, i) => hubs[lf.hub].hue.toArray(nodeCol, (hubs.length + i) * 3));
            nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
            nodeGeo.setAttribute('aColor', new THREE.BufferAttribute(nodeCol, 3));
            nodeGeo.setAttribute('aSize', new THREE.BufferAttribute(nodeSize, 1));
            nodeGeo.setAttribute('aAlpha', new THREE.BufferAttribute(nodeAlpha, 1));
            const nodeMat = new THREE.ShaderMaterial({
                vertexShader: pointVert, fragmentShader: pointFrag,
                transparent: true, depthWrite: false,
                uniforms: { uPx: { value: pxScale() } },
            });
            world.add(new THREE.Points(nodeGeo, nodeMat));

            // ── Link web (merged LineSegments) ─────────────────────────
            const linkGeo = new THREE.BufferGeometry();
            const linkPos = new Float32Array(LINK_VERTS * 3);
            const linkCol = new Float32Array(LINK_VERTS * 3);
            const linkAlpha = new Float32Array(LINK_VERTS);
            {
                const bez = (t: number, a: import('three').Vector3, c: import('three').Vector3, b: import('three').Vector3, out: import('three').Vector3) => {
                    const u = 1 - t;
                    out.set(
                        u * u * a.x + 2 * u * t * c.x + t * t * b.x,
                        u * u * a.y + 2 * u * t * c.y + t * t * b.y,
                        u * u * a.z + 2 * u * t * c.z + t * t * b.z,
                    );
                };
                const pA = new THREE.Vector3(), pB = new THREE.Vector3();
                links.forEach((lk, li) => {
                    lk.v0 = li * SEG * 2;
                    for (let s = 0; s < SEG; s++) {
                        bez(s / SEG, lk.a, lk.ctrl, lk.b, pA);
                        bez((s + 1) / SEG, lk.a, lk.ctrl, lk.b, pB);
                        const o = (lk.v0 + s * 2) * 3;
                        linkPos.set([pA.x, pA.y, pA.z], o);
                        linkPos.set([pB.x, pB.y, pB.z], o + 3);
                    }
                });
            }
            linkGeo.setAttribute('position', new THREE.BufferAttribute(linkPos, 3));
            linkGeo.setAttribute('aColor', new THREE.BufferAttribute(linkCol, 3));
            linkGeo.setAttribute('aAlpha', new THREE.BufferAttribute(linkAlpha, 1));
            const linkMat = new THREE.ShaderMaterial({
                vertexShader: lineVert, fragmentShader: lineFrag,
                transparent: true, depthWrite: false,
            });
            world.add(new THREE.LineSegments(linkGeo, linkMat));

            // ── Traffic — pulses that ROUTE through the map ────────────
            const PULSE_COUNT = 30;
            const pulseGeo = new THREE.BufferGeometry();
            const pulsePos = new Float32Array(PULSE_COUNT * 3);
            const pulseCol = new Float32Array(PULSE_COUNT * 3);
            const pulseSize = new Float32Array(PULSE_COUNT);
            const pulseAlpha = new Float32Array(PULSE_COUNT);
            const pulses: { link: number; t: number; speed: number; fwd: boolean }[] = [];
            const backboneIdx = links.map((lk, i) => (lk.backbone ? i : -1)).filter((i) => i >= 0);
            const spawnPulse = (p: { link: number; t: number; speed: number; fwd: boolean }) => {
                p.link = backboneIdx[Math.floor(rnd() * backboneIdx.length)];
                p.t = 0;
                p.speed = 0.1 + rnd() * 0.15;
                p.fwd = rnd() > 0.5;
            };
            for (let i = 0; i < PULSE_COUNT; i++) {
                const p = { link: 0, t: rnd(), speed: 0.12, fwd: true };
                spawnPulse(p);
                pulses.push(p);
                new THREE.Color('#10B981').toArray(pulseCol, i * 3);
            }
            pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3));
            pulseGeo.setAttribute('aColor', new THREE.BufferAttribute(pulseCol, 3));
            pulseGeo.setAttribute('aSize', new THREE.BufferAttribute(pulseSize, 1));
            pulseGeo.setAttribute('aAlpha', new THREE.BufferAttribute(pulseAlpha, 1));
            const pulseMat = new THREE.ShaderMaterial({
                vertexShader: pointVert, fragmentShader: pointFrag,
                transparent: true, depthWrite: false,
                uniforms: { uPx: { value: pxScale() } },
            });
            world.add(new THREE.Points(pulseGeo, pulseMat));

            // ── Click traffic — the visitor's input enters the map ─────
            const CLICK_POOL = 8;
            const clickGeo = new THREE.BufferGeometry();
            const clickPos = new Float32Array(CLICK_POOL * 3);
            const clickCol = new Float32Array(CLICK_POOL * 3);
            const clickSize = new Float32Array(CLICK_POOL);
            const clickAlpha = new Float32Array(CLICK_POOL);
            const clickPulses: { active: boolean; t: number; speed: number; fwd: boolean; link: number }[] = [];
            for (let i = 0; i < CLICK_POOL; i++) {
                clickPulses.push({ active: false, t: 0, speed: 0.3, fwd: true, link: 0 });
                new THREE.Color('#047857').toArray(clickCol, i * 3);
            }
            clickGeo.setAttribute('position', new THREE.BufferAttribute(clickPos, 3));
            clickGeo.setAttribute('aColor', new THREE.BufferAttribute(clickCol, 3));
            clickGeo.setAttribute('aSize', new THREE.BufferAttribute(clickSize, 1));
            clickGeo.setAttribute('aAlpha', new THREE.BufferAttribute(clickAlpha, 1));
            const clickMat = new THREE.ShaderMaterial({
                vertexShader: pointVert, fragmentShader: pointFrag,
                transparent: true, depthWrite: false,
                uniforms: { uPx: { value: pxScale() } },
            });
            world.add(new THREE.Points(clickGeo, clickMat));

            // ── Pointer presence — a soft aware halo ───────────────────
            const presGeo = new THREE.BufferGeometry();
            const presPos = new Float32Array(3);
            const presCol = new Float32Array([0.02, 0.44, 0.3]);
            const presSize = new Float32Array([0.5]);
            const presAlpha = new Float32Array([0]);
            presGeo.setAttribute('position', new THREE.BufferAttribute(presPos, 3));
            presGeo.setAttribute('aColor', new THREE.BufferAttribute(presCol, 3));
            presGeo.setAttribute('aSize', new THREE.BufferAttribute(presSize, 1));
            presGeo.setAttribute('aAlpha', new THREE.BufferAttribute(presAlpha, 1));
            const presMat = new THREE.ShaderMaterial({
                vertexShader: pointVert, fragmentShader: pointFrag,
                transparent: true, depthWrite: false,
                uniforms: { uPx: { value: pxScale() } },
            });
            world.add(new THREE.Points(presGeo, presMat));

            // ── Pointer state (clock refs declared before handlers) ────
            let timeRef = 0;
            const lastMoveRef = { v: -10 };
            let pointerX = 0, pointerY = 0;
            let curX = 0, curY = 0;
            const cursorWorld = new THREE.Vector3(999, 999, 0);
            const cursorTarget = new THREE.Vector3(999, 999, 0);
            let cursorLive = false;
            const raycaster = new THREE.Raycaster();
            const ndc = new THREE.Vector2();
            const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

            const onPointerMove = (e: PointerEvent) => {
                const r = host.getBoundingClientRect();
                if (r.width === 0 || r.height === 0) return;
                pointerX = ((e.clientX - r.left) / r.width) * 2 - 1;
                pointerY = -(((e.clientY - r.top) / r.height) * 2 - 1);
                lastMoveRef.v = timeRef;
                ndc.set(pointerX, pointerY);
                raycaster.setFromCamera(ndc, camera);
                const hit = new THREE.Vector3();
                if (raycaster.ray.intersectPlane(plane, hit)) {
                    cursorTarget.copy(hit);
                    if (!cursorLive) { cursorWorld.copy(hit); cursorLive = true; }
                }
            };
            const onPointerDown = (e: PointerEvent) => {
                const r = host.getBoundingClientRect();
                if (r.width === 0 || r.height === 0) return;
                const px = ((e.clientX - r.left) / r.width) * 2 - 1;
                const py = -(((e.clientY - r.top) / r.height) * 2 - 1);
                ndc.set(px, py);
                raycaster.setFromCamera(ndc, camera);
                const hit = new THREE.Vector3();
                if (!raycaster.ray.intersectPlane(plane, hit)) return;
                // The nearest hub takes the visitor's traffic: fire a
                // pulse along EVERY arc it owns, in both directions.
                let best = 0, bestD = Infinity;
                hubs.forEach((h, hi) => {
                    const d = Math.hypot(h.x - hit.x, h.y - hit.y);
                    if (d < bestD) { bestD = d; best = hi; }
                });
                hubs[best].flash = Math.min(1, hubs[best].flash + 0.6);
                adjacency[best].forEach((li, k) => {
                    const slot = clickPulses.find((cp) => !cp.active) ?? clickPulses[k % CLICK_POOL];
                    slot.active = true;
                    slot.t = 0;
                    slot.link = li;
                    // Outbound from this hub: know direction from link endpoints.
                    slot.fwd = links[li].hubA === best;
                    slot.speed = 0.32;
                });
            };
            window.addEventListener('pointermove', onPointerMove, { passive: true });
            host.addEventListener('pointerdown', onPointerDown);

            // ── Visibility management ─────────────────────────────────
            let inView = true;
            const io = new IntersectionObserver((entries) => {
                inView = entries.some((en) => en.isIntersecting);
            }, { threshold: 0 });
            io.observe(host);
            const onVis = () => { inView = !document.hidden; };
            document.addEventListener('visibilitychange', onVis);

            const ro = new ResizeObserver(() => {
                const w = W(), h = H();
                if (w === 0 || h === 0) return;
                renderer.setSize(w, h);
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                const px = pxScale();
                nodeMat.uniforms.uPx.value = px;
                pulseMat.uniforms.uPx.value = px;
                clickMat.uniforms.uPx.value = px;
                presMat.uniforms.uPx.value = px;
            });
            ro.observe(host);

            // ── The frame ─────────────────────────────────────────────
            const INTRO = 2.6;
            const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
            const bezOut = (lk: { a: import('three').Vector3; ctrl: import('three').Vector3; b: import('three').Vector3 }, t: number, out: import('three').Vector3) => {
                const u = 1 - t;
                out.set(
                    u * u * lk.a.x + 2 * u * t * lk.ctrl.x + t * t * lk.b.x,
                    u * u * lk.a.y + 2 * u * t * lk.ctrl.y + t * t * lk.b.y,
                    u * u * lk.a.z + 2 * u * t * lk.ctrl.z + t * t * lk.b.z,
                );
            };
            const tmpV = new THREE.Vector3();

            let last = performance.now();
            let running = true;
            let rafId: number | null = null;

            const renderFrame = (introT: number) => {
                // Camera parallax — eased, gentle.
                curX += (pointerX - curX) * 0.045;
                curY += (pointerY - curY) * 0.045;
                camera.position.x = curX * 0.5;
                camera.position.y = 0.12 - curY * 0.34;
                camera.lookAt(0, 0, 0);
                world.rotation.y = curX * 0.045;
                world.rotation.x = -curY * 0.03;

                const present = Math.max(0, 1 - (timeRef - lastMoveRef.v) / 3.5);
                cursorWorld.lerp(cursorTarget, 0.08);
                presPos[0] = cursorWorld.x; presPos[1] = cursorWorld.y; presPos[2] = cursorWorld.z;
                presAlpha[0] = 0.13 * present * easeOut(introT / INTRO);
                presSize[0] = 0.5 + Math.sin(timeRef * 1.4) * 0.05;

                // ── Hubs ──
                hubs.forEach((h, i) => {
                    h.flash *= 0.955;
                    const rv = easeOut((introT - h.reveal * INTRO) / (INTRO * 0.4));
                    const d = Math.hypot(cursorWorld.x - h.x, cursorWorld.y - h.y);
                    const prox = Math.max(0, 1 - d / 2.2) * present;
                    nodePos.set([h.x, h.y, 0], i * 3);
                    nodeSize[i] = (h.tier1 ? 0.135 : 0.09) * rv * (1 + prox * 0.5 + h.flash * 0.6);
                    nodeAlpha[i] = (0.75 + prox * 0.25 + h.flash * 0.25) * rv;
                });

                // ── Leaves ──
                leaves.forEach((lf, i) => {
                    const ni = hubs.length + i;
                    const t = timeRef * lf.orbitW + lf.phase;
                    lf.pos.set(
                        lf.ax + Math.cos(t) * lf.orbitR,
                        lf.ay + Math.sin(t * 0.9) * lf.orbitR * 0.8,
                        lf.az + Math.sin(t * 0.7) * 0.04,
                    );
                    const dx = cursorWorld.x - lf.pos.x;
                    const dy = cursorWorld.y - lf.pos.y;
                    const dist = Math.hypot(dx, dy);
                    const prox = Math.max(0, 1 - dist / 1.8);
                    lf.lean.set(dx, dy, 0).multiplyScalar(0.09 * prox * prox * present);
                    lf.pos.add(lf.lean);
                    nodePos.set([lf.pos.x, lf.pos.y, lf.pos.z], ni * 3);
                    const rv = easeOut((introT - lf.reveal * INTRO) / (INTRO * 0.4));
                    nodeSize[ni] = lf.size * rv * (1 + prox * 0.5);
                    nodeAlpha[ni] = (0.5 + prox * 0.45) * rv;
                });
                nodeGeo.attributes.position.needsUpdate = true;
                nodeGeo.attributes.aSize.needsUpdate = true;
                nodeGeo.attributes.aAlpha.needsUpdate = true;

                // ── Links: draw-in + proximity glow ──
                for (let li = 0; li < LINK_COUNT; li++) {
                    const lk = links[li];
                    const prox = Math.max(0, 1 - lk.mid.distanceTo(cursorWorld) / 2.2) * present;
                    const base = lk.alpha * (1 + prox * (lk.backbone ? 2.0 : 2.6));
                    const revealLink = easeOut((introT - lk.reveal * INTRO) / (INTRO * 0.5));
                    const shade = 0.85 + prox * 0.15;
                    for (let k = 0; k < SEG * 2; k++) {
                        linkCol[(lk.v0 + k) * 3] = lk.hue.r * shade;
                        linkCol[(lk.v0 + k) * 3 + 1] = lk.hue.g * shade;
                        linkCol[(lk.v0 + k) * 3 + 2] = lk.hue.b * shade;
                    }
                    for (let s = 0; s < SEG; s++) {
                        const segReveal = Math.max(0, Math.min(1, revealLink * SEG - s));
                        const a = base * segReveal;
                        const o = lk.v0 + s * 2;
                        linkAlpha[o] = a; linkAlpha[o + 1] = a;
                    }
                }
                linkGeo.attributes.aAlpha.needsUpdate = true;
                linkGeo.attributes.aColor.needsUpdate = true;

                // ── Traffic ──
                const pulseReady = easeOut((introT - INTRO * 0.55) / (INTRO * 0.45));
                for (let i = 0; i < PULSE_COUNT; i++) {
                    const p = pulses[i];
                    const lk = links[p.link];
                    bezOut(lk, p.fwd ? p.t : 1 - p.t, tmpV);
                    pulsePos.set([tmpV.x, tmpV.y, tmpV.z], i * 3);
                    const env = Math.sin(Math.PI * Math.min(1, Math.max(0, p.t))) ** 0.7;
                    pulseAlpha[i] = (0.6 + 0.25 * Math.sin(timeRef * 2 + i)) * env * pulseReady;
                    pulseSize[i] = (0.05 + 0.018 * env) * (1 + env * 0.6);
                }
                pulseGeo.attributes.position.needsUpdate = true;
                pulseGeo.attributes.aAlpha.needsUpdate = true;
                pulseGeo.attributes.aSize.needsUpdate = true;

                // ── Click traffic ──
                for (let i = 0; i < CLICK_POOL; i++) {
                    const cp = clickPulses[i];
                    if (cp.active) {
                        cp.t += 0.016 * cp.speed;
                        if (cp.t >= 1) {
                            cp.active = false;
                            // Arrive: flash the destination hub.
                            const dest = cp.fwd ? lk2hub(cp.link, false) : lk2hub(cp.link, true);
                            if (dest >= 0) hubs[dest].flash = Math.min(1, hubs[dest].flash + 0.3);
                        }
                    }
                    if (cp.active) {
                        bezOut(links[cp.link], cp.fwd ? cp.t : 1 - cp.t, tmpV);
                        clickPos.set([tmpV.x, tmpV.y, tmpV.z], i * 3);
                        clickAlpha[i] = Math.sin(Math.PI * cp.t) * 0.95;
                        clickSize[i] = 0.07 + Math.sin(Math.PI * cp.t) * 0.045;
                    } else {
                        clickAlpha[i] = 0;
                    }
                }
                clickGeo.attributes.position.needsUpdate = true;
                clickGeo.attributes.aAlpha.needsUpdate = true;
                clickGeo.attributes.aSize.needsUpdate = true;

                presGeo.attributes.aAlpha.needsUpdate = true;
                presGeo.attributes.aSize.needsUpdate = true;
                presGeo.attributes.position.needsUpdate = true;

                renderer.render(scene, camera);
            };

            // Helper: which hub is at which end of a backbone link.
            const lk2hub = (li: number, fromA: boolean) => (fromA ? links[li].hubA : links[li].hubB);

            const advanceTraffic = (dt: number) => {
                for (const p of pulses) {
                    p.t += p.speed * dt;
                    if (p.t >= 1) {
                        // ROUTE: arrive at a hub, pick a new arc from its
                        // adjacency — traffic flows THROUGH the map.
                        const arriveHub = p.fwd ? links[p.link].hubB : links[p.link].hubA;
                        if (arriveHub >= 0 && adjacency[arriveHub].length > 0 && rnd() > 0.18) {
                            const options = adjacency[arriveHub].filter((li) => li !== p.link);
                            const next = options.length ? options[Math.floor(rnd() * options.length)] : p.link;
                            p.link = next;
                            p.fwd = links[next].hubA === arriveHub;
                            p.t = 0;
                            p.speed = 0.1 + rnd() * 0.15;
                            hubs[arriveHub].flash = Math.min(1, hubs[arriveHub].flash + 0.06);
                        } else {
                            spawnPulse(p);
                        }
                    }
                }
            };

            timeRef = reducedMotion ? INTRO : 0;

            if (reducedMotion) {
                // One fully-assembled static frame: mid-traffic pose.
                advanceTraffic(3.2);
                renderFrame(INTRO);
            } else {
                const loop = (now: number) => {
                    if (!running) { rafId = null; return; }
                    const dt = Math.min(0.05, (now - last) / 1000);
                    last = now;
                    if (inView) {
                        timeRef += dt;
                        advanceTraffic(dt);
                        renderFrame(Math.min(INTRO, timeRef));
                    }
                    rafId = requestAnimationFrame(loop);
                };
                rafId = requestAnimationFrame(loop);
            }

            teardown = () => {
                running = false;
                if (rafId !== null) cancelAnimationFrame(rafId);
                io.disconnect();
                ro.disconnect();
                window.removeEventListener('pointermove', onPointerMove);
                host.removeEventListener('pointerdown', onPointerDown);
                document.removeEventListener('visibilitychange', onVis);
                nodeGeo.dispose(); nodeMat.dispose();
                linkGeo.dispose(); linkMat.dispose();
                pulseGeo.dispose(); pulseMat.dispose();
                clickGeo.dispose(); clickMat.dispose();
                presGeo.dispose(); presMat.dispose();
                renderer.dispose();
                if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
            };
        };

        void boot();

        return () => {
            disposed = true;
            teardown?.();
        };
    }, []);

    return <div ref={hostRef} className={className} aria-hidden="true" role="presentation" />;
};

export default NetworkScene;
