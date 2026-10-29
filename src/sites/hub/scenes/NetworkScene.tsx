import React, { useEffect, useRef } from 'react';

/**
 * NetworkScene — R42 "many systems, one process" (the corporate hero).
 *
 * Owner direction (R42): the living orb has served; the hero should now
 * show NETWORKING — "how systems get connected together… systems sort of
 * coming together to become one process" — still interactive, still 3D,
 * the mouse must have an effect, and nothing should "plop onto the
 * screen". Replaces the living-orb scene on the daylight glassmorphic hero.
 *
 * The picture, on the ivory ground:
 *   1. SIX SYSTEM CLUSTERS — small constellations of soft nodes, each on
 *      its own slow orbit, in the brand greens with teal/sky/slate
 *      accents. The systems a business already runs.
 *   2. ONE PROCESS — a quiet ring engine at the hub right-of-centre: a
 *      breathing inner ring, a travelling outer arc, a soft core.
 *   3. CONVERGING LINKS — every node arcs toward the hub on a bowed
 *      bezier; light pulses travel the arcs continuously and the ring
 *      receives them with a soft flash. A few faint inter-cluster links
 *      let the systems talk to each other too.
 *   4. THE VISITOR'S HAND — pointer parallax on the camera; nodes and
 *      links lean and brighten near the cursor; a soft presence halo
 *      follows the pointer; a click sends its own pulse into the process.
 *
 * Build-in (the anti-plop): nodes scale in staggered by cluster, the
 * links DRAW themselves from the systems toward the hub, the ring forms
 * last, and only then do the pulses begin to flow — ~2.6s, all time-
 * based, reversible-free (nothing jumps because only alphas/sizes are
 * driven, never positions of the choreography itself).
 *
 * Engineering contract (same as the orb scene before it / SystemCoreScene):
 * - three.js imported DYNAMICALLY — its own lazy chunk; /vega, /atrium
 *   and the logged-in app never download it.
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

            const isSmall = host.clientWidth < 700;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.5 : 1.75));
            renderer.setSize(host.clientWidth, host.clientHeight);
            renderer.domElement.style.width = '100%';
            renderer.domElement.style.height = '100%';
            renderer.domElement.style.display = 'block';
            host.appendChild(renderer.domElement);

            const W = () => host.clientWidth;
            const H = () => Math.max(1, host.clientHeight);
            const camera = new THREE.PerspectiveCamera(42, W() / H(), 0.1, 60);
            // Portrait viewports pull the camera back so the whole
            // convergence still fits behind the stacked copy.
            const NARROW = W() / H() < 0.95;
            const CAM_Z = NARROW ? 10.8 : 7.4;
            camera.position.set(0, 0.12, CAM_Z);

            const scene = new THREE.Scene();
            const world = new THREE.Group(); // everything except camera
            scene.add(world);

            // ── Palette (daylight register — see docs/design/TOKENS.md) ──
            const C = {
                emerald: new THREE.Color('#16A34A'),
                emeraldDeep: new THREE.Color('#047857'),
                mint: new THREE.Color('#34D399'),
                teal: new THREE.Color('#0D9488'),
                sky: new THREE.Color('#0369A1'),
                slate: new THREE.Color('#64748B'),
                ink: new THREE.Color('#334155'),
            };

            // The hub sits right-of-centre on wide screens (the copy owns
            // the left); centres itself on narrow ones.
            const HUB = new THREE.Vector3(NARROW ? 0 : 1.28, NARROW ? 0.3 : 0.08, 0);

            // ── Deterministic authoring: six clusters on a ring ────────
            // Angles avoid the deep left (where the H1 lives).
            const CLUSTERS = [
                { ang: -1.35, rad: 2.05, hue: C.emerald, n: 5 },
                { ang: -0.52, rad: 2.42, hue: C.teal, n: 6 },
                { ang: 0.18, rad: 2.16, hue: C.sky, n: 4 },
                { ang: 0.92, rad: 2.55, hue: C.emeraldDeep, n: 5 },
                { ang: 1.72, rad: 2.1, hue: C.slate, n: 4 },
                { ang: 2.55, rad: 2.62, hue: C.mint, n: 3 },
            ];

            type NodeSpec = {
                base: import('three').Vector3;     // orbit anchor (cluster centre + jitter)
                orbitR: number; orbitW: number; phase: number; z: number;
                size: number; hue: import('three').Color; reveal: number; // stagger 0..1
                pos: import('three').Vector3; lean: import('three').Vector3;
            };
            const nodes: NodeSpec[] = [];
            const clusterAnchors: import('three').Vector3[] = [];
            const rand = (() => { let s = 42; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
            CLUSTERS.forEach((cl, ci) => {
                const anchor = new THREE.Vector3(
                    HUB.x + Math.cos(cl.ang) * cl.rad,
                    HUB.y + Math.sin(cl.ang) * cl.rad * 0.72,
                    Math.sin(cl.ang * 2.3) * 0.55,
                );
                clusterAnchors.push(anchor);
                for (let i = 0; i < cl.n; i++) {
                    const a = rand() * Math.PI * 2;
                    const r = 0.16 + rand() * 0.34;
                    nodes.push({
                        base: new THREE.Vector3(
                            anchor.x + Math.cos(a) * r,
                            anchor.y + Math.sin(a) * r * 0.8,
                            anchor.z + (rand() - 0.5) * 0.5,
                        ),
                        orbitR: 0.05 + rand() * 0.09,
                        orbitW: 0.25 + rand() * 0.45,
                        phase: rand() * Math.PI * 2,
                        z: (rand() - 0.5) * 0.3,
                        size: 0.05 + rand() * 0.055,
                        hue: cl.hue,
                        reveal: ci / CLUSTERS.length + i * 0.035 + rand() * 0.05,
                        pos: new THREE.Vector3(),
                        lean: new THREE.Vector3(),
                    });
                }
            });
            const NODE_COUNT = nodes.length;

            // ── Links: every node → hub (bowed), plus faint spokes ────
            type LinkSpec = {
                a: import('three').Vector3; ctrl: import('three').Vector3; b: import('three').Vector3;
                hue: import('three').Color; alpha: number; ambient: boolean; // ambient = inter-cluster
                reveal: number; segs: number; v0: number; // vertex offset in merged buffer
                mid: import('three').Vector3;
            };
            const SEG = 22;
            const links: LinkSpec[] = [];
            const pushLink = (a: import('three').Vector3, b: import('three').Vector3, hue: import('three').Color, alpha: number, ambient: boolean, reveal: number) => {
                // Control point: midpoint, pushed perpendicular for a bow.
                const mid = a.clone().add(b).multiplyScalar(0.5);
                const dir = b.clone().sub(a);
                const perp = new THREE.Vector3(-dir.y, dir.x, 0).normalize();
                const bow = (ambient ? 0.22 : 0.3 + rand() * 0.35) * (rand() > 0.5 ? 1 : -1);
                mid.add(perp.multiplyScalar(bow));
                mid.z += (rand() - 0.5) * 0.5;
                links.push({ a: a.clone(), ctrl: mid, b: b.clone(), hue, alpha, ambient, reveal, segs: SEG, v0: 0, mid });
            };
            nodes.forEach((nd, i) => pushLink(nd.base, HUB, nd.hue, 0.16 + rand() * 0.1, false, 0.28 + nd.reveal * 0.4));
            // A few inter-cluster threads — the systems also talk to each other.
            for (let i = 0; i < CLUSTERS.length; i++) {
                const j = (i + 1) % CLUSTERS.length;
                pushLink(clusterAnchors[i], clusterAnchors[j], C.slate, 0.07, true, 0.5 + i * 0.06);
            }
            const LINK_COUNT = links.length;
            const LINK_VERTS = LINK_COUNT * SEG * 2; // segment pairs

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

            // ── Node cloud ─────────────────────────────────────────────
            const nodeGeo = new THREE.BufferGeometry();
            const nodePos = new Float32Array(NODE_COUNT * 3);
            const nodeCol = new Float32Array(NODE_COUNT * 3);
            const nodeSize = new Float32Array(NODE_COUNT);
            const nodeAlpha = new Float32Array(NODE_COUNT);
            nodes.forEach((nd, i) => nd.hue.toArray(nodeCol, i * 3));
            nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
            nodeGeo.setAttribute('aColor', new THREE.BufferAttribute(nodeCol, 3));
            nodeGeo.setAttribute('aSize', new THREE.BufferAttribute(nodeSize, 1));
            nodeGeo.setAttribute('aAlpha', new THREE.BufferAttribute(nodeAlpha, 1));
            const nodeMat = new THREE.ShaderMaterial({
                vertexShader: pointVert, fragmentShader: pointFrag,
                transparent: true, depthWrite: false,
                uniforms: { uPx: { value: pxScale() } },
            });
            const nodeCloud = new THREE.Points(nodeGeo, nodeMat);
            world.add(nodeCloud);

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
            const linkWeb = new THREE.LineSegments(linkGeo, linkMat);
            world.add(linkWeb);

            // ── Pulses — light travelling the arcs toward the hub ──────
            const PULSE_COUNT = 26;
            const pulseGeo = new THREE.BufferGeometry();
            const pulsePos = new Float32Array(PULSE_COUNT * 3);
            const pulseCol = new Float32Array(PULSE_COUNT * 3);
            const pulseSize = new Float32Array(PULSE_COUNT);
            const pulseAlpha = new Float32Array(PULSE_COUNT);
            const pulses: { link: number; t: number; speed: number }[] = [];
            for (let i = 0; i < PULSE_COUNT; i++) {
                pulses.push({ link: i % links.length, t: rand(), speed: 0.1 + rand() * 0.16 });
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
            const pulseCloud = new THREE.Points(pulseGeo, pulseMat);
            world.add(pulseCloud);

            // ── Click pulses — the visitor's own input joins the flow ──
            const CLICK_POOL = 6;
            const clickGeo = new THREE.BufferGeometry();
            const clickPos = new Float32Array(CLICK_POOL * 3);
            const clickCol = new Float32Array(CLICK_POOL * 3);
            const clickSize = new Float32Array(CLICK_POOL);
            const clickAlpha = new Float32Array(CLICK_POOL);
            const clickPulses: { active: boolean; t: number; from: import('three').Vector3; ctrl: import('three').Vector3 }[] = [];
            for (let i = 0; i < CLICK_POOL; i++) {
                clickPulses.push({ active: false, t: 0, from: new THREE.Vector3(), ctrl: new THREE.Vector3() });
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
            const clickCloud = new THREE.Points(clickGeo, clickMat);
            world.add(clickCloud);

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
            const presPoint = new THREE.Points(presGeo, presMat);
            world.add(presPoint);

            // ── The hub — one process ──────────────────────────────────
            const hubGroup = new THREE.Group();
            hubGroup.position.copy(HUB);
            world.add(hubGroup);
            const ringGeo = new THREE.RingGeometry(0.3, 0.325, 72);
            const ringMat = new THREE.MeshBasicMaterial({
                color: C.emeraldDeep, transparent: true, opacity: 0.75, side: THREE.DoubleSide,
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = -0.16;
            hubGroup.add(ring);
            // A travelling arc on the outside — the ring is alive.
            const arcGeo = new THREE.RingGeometry(0.44, 0.455, 72, 1, 0, Math.PI * 0.72);
            const arcMat = new THREE.MeshBasicMaterial({
                color: C.teal, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
            });
            const arc = new THREE.Mesh(arcGeo, arcMat);
            arc.rotation.x = -0.16;
            hubGroup.add(arc);
            // Soft core.
            const coreGeo = new THREE.BufferGeometry();
            const corePos = new Float32Array([0, 0, 0]);
            const coreCol = new Float32Array([0.05, 0.53, 0.35]);
            const coreSize = new Float32Array([0.16]);
            const coreAlpha = new Float32Array([0.9]);
            coreGeo.setAttribute('position', new THREE.BufferAttribute(corePos, 3));
            coreGeo.setAttribute('aColor', new THREE.BufferAttribute(coreCol, 3));
            coreGeo.setAttribute('aSize', new THREE.BufferAttribute(coreSize, 1));
            coreGeo.setAttribute('aAlpha', new THREE.BufferAttribute(coreAlpha, 1));
            const coreMat = new THREE.ShaderMaterial({
                vertexShader: pointVert, fragmentShader: pointFrag,
                transparent: true, depthWrite: false,
                uniforms: { uPx: { value: pxScale() } },
            });
            hubGroup.add(new THREE.Points(coreGeo, coreMat));

            // ── Pointer state ──────────────────────────────────────────
            let pointerX = 0, pointerY = 0;   // NDC -1..1
            let curX = 0, curY = 0;           // eased
            // Time refs live above the handlers that close over them
            // (declared at the raycaster block, before any listener fires).
            const cursorWorld = new THREE.Vector3(999, 999, 0); // unprojected, eased
            const cursorTarget = new THREE.Vector3(999, 999, 0);
            let cursorLive = false;
            const raycaster = new THREE.Raycaster();
            const ndc = new THREE.Vector2();
            const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
            let hubFlash = 0;
            // Scene clock + last-move stamp — declared before the handlers
            // above run (boot() is synchronous past this point; events
            // cannot interleave, so the closure is safe).
            let timeRef = 0;
            const lastMoveRef = { v: -10 };

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
                const slot = clickPulses.find((cp) => !cp.active) || clickPulses[0];
                slot.active = true;
                slot.t = 0;
                slot.from.copy(hit);
                const mid = hit.clone().add(HUB).multiplyScalar(0.5);
                const dir = HUB.clone().sub(hit);
                mid.add(new THREE.Vector3(-dir.y, dir.x, 0).normalize().multiplyScalar(0.4));
                slot.ctrl.copy(mid);
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
                coreMat.uniforms.uPx.value = px;
            });
            ro.observe(host);

            // ── The frame ─────────────────────────────────────────────
            // Intro clock: 0 → 1 over INTRO seconds (ease applied per use).
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
                const intro = easeOut(introT / INTRO);

                // Camera parallax — eased, gentle.
                curX += (pointerX - curX) * 0.045;
                curY += (pointerY - curY) * 0.045;
                camera.position.x = curX * 0.5;
                camera.position.y = 0.12 - curY * 0.34;
                camera.lookAt(HUB.x * 0.55, HUB.y * 0.4, 0);
                world.rotation.y = curX * 0.045;
                world.rotation.x = -curY * 0.03;

                // Pointer presence eases toward the cursor; fades when idle.
                const present = Math.max(0, 1 - (timeRef - lastMoveRef.v) / 3.5);
                cursorWorld.lerp(cursorTarget, 0.08);
                presPos[0] = cursorWorld.x; presPos[1] = cursorWorld.y; presPos[2] = cursorWorld.z;
                presAlpha[0] = 0.14 * present * intro;
                presSize[0] = 0.5 + Math.sin(timeRef * 1.4) * 0.05;

                // ── Nodes: orbit + lean toward the cursor + reveal ──
                for (let i = 0; i < NODE_COUNT; i++) {
                    const nd = nodes[i];
                    const t = timeRef * nd.orbitW + nd.phase;
                    nd.pos.set(
                        nd.base.x + Math.cos(t) * nd.orbitR,
                        nd.base.y + Math.sin(t * 0.9) * nd.orbitR * 0.8,
                        nd.base.z + Math.sin(t * 0.7) * 0.05 + nd.z * 0.4,
                    );
                    // Lean: systems reach toward the visitor's hand.
                    const dx = cursorWorld.x - nd.pos.x;
                    const dy = cursorWorld.y - nd.pos.y;
                    const dist = Math.hypot(dx, dy);
                    const prox = Math.max(0, 1 - dist / 2.0);
                    nd.lean.set(dx, dy, 0).multiplyScalar(0.09 * prox * prox * present);
                    nd.pos.add(nd.lean);
                    nodePos.set([nd.pos.x, nd.pos.y, nd.pos.z], i * 3);
                    const rv = easeOut((introT - nd.reveal * INTRO * 0.5) / (INTRO * 0.5));
                    nodeSize[i] = nd.size * rv * (1 + prox * 0.5);
                    nodeAlpha[i] = (0.5 + prox * 0.45) * rv;
                }
                nodeGeo.attributes.position.needsUpdate = true;
                nodeGeo.attributes.aSize.needsUpdate = true;
                nodeGeo.attributes.aAlpha.needsUpdate = true;

                // ── Links: draw-in + proximity glow ──
                // Segment s of a link is revealed when intro passes its
                // fraction — links literally draw from the systems toward
                // the process (the hub end of the curve is s = SEG-1).
                for (let li = 0; li < LINK_COUNT; li++) {
                    const lk = links[li];
                    const prox = Math.max(0, 1 - lk.mid.distanceTo(cursorWorld) / 2.2) * present;
                    const base = lk.alpha * (1 + prox * 2.4);
                    const revealLink = easeOut((introT - lk.reveal * INTRO) / (INTRO * 0.55));
                    for (let s = 0; s < SEG; s++) {
                        // Draw direction: from the node (s=0) toward the hub.
                        const segReveal = Math.max(0, Math.min(1, revealLink * SEG - s));
                        const a = base * segReveal;
                        const o = lk.v0 + s * 2;
                        linkAlpha[o] = a; linkAlpha[o + 1] = a;
                        if (s === 0) {
                            // Per-link hue set once per frame at the first segment.
                            const shade = 0.85 + prox * 0.15;
                            for (let k = 0; k < SEG * 2; k++) {
                                linkCol[(lk.v0 + k) * 3] = lk.hue.r * shade;
                                linkCol[(lk.v0 + k) * 3 + 1] = lk.hue.g * shade;
                                linkCol[(lk.v0 + k) * 3 + 2] = lk.hue.b * shade;
                            }
                        }
                    }
                }
                linkGeo.attributes.aAlpha.needsUpdate = true;
                linkGeo.attributes.aColor.needsUpdate = true;

                // ── Pulses: travel node → hub, fade both ends ──
                const pulseReady = easeOut((introT - INTRO * 0.55) / (INTRO * 0.45));
                for (let i = 0; i < PULSE_COUNT; i++) {
                    const p = pulses[i];
                    const lk = links[p.link];
                    bezOut(lk, p.t, tmpV);
                    pulsePos.set([tmpV.x, tmpV.y, tmpV.z], i * 3);
                    const env = Math.sin(Math.PI * Math.min(1, Math.max(0, p.t))) ** 0.7;
                    pulseAlpha[i] = (0.55 + 0.3 * Math.sin(timeRef * 2 + i)) * env * pulseReady;
                    pulseSize[i] = (0.052 + 0.02 * env) * (1 + env * 0.6);
                }
                pulseGeo.attributes.position.needsUpdate = true;
                pulseGeo.attributes.aAlpha.needsUpdate = true;
                pulseGeo.attributes.aSize.needsUpdate = true;

                // ── Click pulses ──
                for (let i = 0; i < CLICK_POOL; i++) {
                    const cp = clickPulses[i];
                    if (cp.active) {
                        cp.t += 0.016 * 1.35;
                        if (cp.t >= 1) { cp.active = false; hubFlash = Math.min(1, hubFlash + 0.35); }
                    }
                    if (cp.active) {
                        const u = 1 - cp.t;
                        tmpV.set(
                            u * u * cp.from.x + 2 * u * cp.t * cp.ctrl.x + cp.t * cp.t * HUB.x,
                            u * u * cp.from.y + 2 * u * cp.t * cp.ctrl.y + cp.t * cp.t * HUB.y,
                            0,
                        );
                        clickPos.set([tmpV.x, tmpV.y, tmpV.z], i * 3);
                        clickAlpha[i] = Math.sin(Math.PI * cp.t) * 0.95;
                        clickSize[i] = 0.075 + Math.sin(Math.PI * cp.t) * 0.04;
                    } else {
                        clickAlpha[i] = 0;
                    }
                }
                clickGeo.attributes.position.needsUpdate = true;
                clickGeo.attributes.aAlpha.needsUpdate = true;
                clickGeo.attributes.aSize.needsUpdate = true;

                // ── The hub: breathe, receive ──
                hubFlash *= 0.955;
                const breathe = 1 + Math.sin(timeRef * 0.5) * 0.025;
                const hubReveal = easeOut((introT - INTRO * 0.45) / (INTRO * 0.55));
                hubGroup.scale.setScalar(breathe * (0.65 + 0.35 * hubReveal));
                ringMat.opacity = (0.55 + hubFlash * 0.4) * hubReveal;
                arcMat.opacity = (0.3 + hubFlash * 0.3) * hubReveal;
                arc.rotation.z = timeRef * 0.28;
                coreAlpha[0] = (0.85 + hubFlash * 0.15) * hubReveal;
                coreSize[0] = 0.16 * (1 + hubFlash * 0.5);
                coreGeo.attributes.aAlpha.needsUpdate = true;
                coreGeo.attributes.aSize.needsUpdate = true;
                presGeo.attributes.aAlpha.needsUpdate = true;
                presGeo.attributes.aSize.needsUpdate = true;
                presGeo.attributes.position.needsUpdate = true;

                renderer.render(scene, camera);
            };

            const advancePulses = (dt: number) => {
                for (const p of pulses) {
                    p.t += p.speed * dt;
                    if (p.t >= 1) {
                        p.t = 0;
                        p.link = Math.floor(Math.random() * links.length);
                        if (Math.random() < 0.4) hubFlash = Math.min(1, hubFlash + 0.08);
                    }
                }
            };

            timeRef = reducedMotion ? INTRO : 0;

            if (reducedMotion) {
                renderFrame(INTRO); // one assembled frame, no loop.
            } else {
                const loop = (now: number) => {
                    if (!running) { rafId = null; return; }
                    const dt = Math.min(0.05, (now - last) / 1000);
                    last = now;
                    if (inView) {
                        timeRef += dt;
                        advancePulses(dt);
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
                ringGeo.dispose(); ringMat.dispose();
                arcGeo.dispose(); arcMat.dispose();
                coreGeo.dispose(); coreMat.dispose();
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
