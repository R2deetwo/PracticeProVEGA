import React, { useEffect, useRef } from 'react';

/**
 * SystemCoreScene — W13→W14 "the system core, come alive" (What we do).
 *
 * Owner direction after the W13 review, in their own words: the shapes
 * "should be not just cubes — prisms, pyramids, other five- and six-sided
 * shapes… changing, rotating… occasionally morphing into another shape";
 * they should react when the mouse rises too ("it mainly reacts left and
 * right"); and on scroll the shapes "should go down into" the capability
 * cards. The caption jargon "Seven modules. One system." is replaced with
 * the owner's own phrase: "Making your systems one."
 *
 * The scene: a faceted engine core with seven GLASS SHAPES orbiting it —
 * one per capability card below. Each shape lives on a superellipsoid
 * engine (see SHAPES): cubes melt into pyramids, prisms, octahedra, gems
 * and back, each on its own clock, its wireframe riding the same vertices
 * so the skeleton always matches the flesh. Energy links pulse from the
 * core to every shape. Vertical pointer motion now tilts the whole system
 * as strongly as horizontal motion does. And as the visitor scrolls, the
 * shapes DESCEND — they spiral down toward the bottom of the canvas and
 * fade, "transporting" into the cards below, which receive each shape with
 * a landing animation (see .w14-landed in index.css). Scroll back up and
 * they return to orbit. Everything is a pure function of (time, pointer,
 * scroll) — no timers to desync, fully reversible.
 *
 * Engineering contract (unchanged, same as MorphScene — the owner's hero):
 * - three.js is imported DYNAMICALLY so it lands in its own lazy chunk;
 *   visitors to /vega, /atrium or the logged-in app never download it.
 * - Everything this scene draws lives INSIDE its own canvas, a plain block
 *   in the document flow — nothing portaled, nothing fixed, nothing can
 *   ever cross a heading. (The W12 lesson, made structural.)
 * - The scene pauses when offscreen or the tab is hidden; one static,
 *   fully-assembled frame under prefers-reduced-motion; a quiet CSS
 *   fallback (see .w13-fallback in index.css) shows if WebGL is missing.
 * - Vertex morphing is CPU-side but only runs WHILE a shape is actually
 *   morphing (dormant shapes skip the write entirely), so the steady
 *   state costs almost nothing.
 */

/** One shape per capability card — keep in sync with WHAT_WE_DO. */
const MODULE_COUNT = 7;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOutCubic = (x: number) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

/** Deterministic per-shape seeds — the composition is authored, not random. */
const ORBIT_RADIUS = [1.58, 2.14, 1.86, 2.44, 1.98, 2.58, 2.22];
const ORBIT_SPEED = [0.150, 0.132, 0.170, 0.118, 0.158, 0.108, 0.140];
const ORBIT_PHASE = [0.0, 2.35, 4.10, 1.15, 5.30, 3.20, 0.65];
const MODULE_SCALE = [1.14, 0.90, 1.00, 0.86, 1.06, 0.94, 0.90];
const SETTLE_SECONDS = 2.0;

/* ── W14: the shape engine ────────────────────────────────────────────────
 * Every shape is a SUPERELLIPSOID: project a direction d onto the surface
 * |x|^m + |y|^m + |z|^m = 1. m = 1 is an octahedron, m = 2 a sphere, and
 * m → 9 a (soft-cornered) cube — so ONE formula morphs smoothly between
 * every form the owner asked for. Anisotropic scale (sx/sy/sz), a taper
 * toward +y and a y-shift bend the family further: pyramids, prisms,
 * gems, spires. */
type ShapeDef = {
    m: number;
    sx: number; sy: number; sz: number;
    taper: number;   // 1 = none; <1 narrows x/z toward the top → pyramid
    yShift: number;  // lifts the body slightly → gem/spire silhouettes
};
const SHAPES: ShapeDef[] = [
    { m: 9.0, sx: 1.00, sy: 1.00, sz: 1.00, taper: 1.00, yShift: 0.00 },  // soft cube
    { m: 9.0, sx: 0.90, sy: 1.30, sz: 0.74, taper: 1.00, yShift: 0.00 },  // tall cuboid
    { m: 1.35, sx: 1.05, sy: 1.28, sz: 1.05, taper: 0.55, yShift: 0.10 }, // pyramid
    { m: 1.00, sx: 1.05, sy: 1.18, sz: 1.05, taper: 1.00, yShift: 0.00 }, // octahedron
    { m: 1.10, sx: 1.45, sy: 0.62, sz: 0.95, taper: 1.00, yShift: 0.00 }, // flat prism
    { m: 2.40, sx: 0.95, sy: 1.05, sz: 0.95, taper: 1.00, yShift: 0.00 }, // rounded gem
    { m: 1.55, sx: 0.92, sy: 1.44, sz: 0.92, taper: 0.80, yShift: 0.05 }, // spire
];
const MORPH_SECONDS = 1.15;
const DWELL_MIN = 2.6, DWELL_VAR = 3.0;
/** World-space half-extent of a shape's face (the old cubes were 0.56 wide). */
const SHAPE_SIZE = 0.27;

/** Interpolate two shape defs — m lerps in log space (it is multiplicative). */
const lerpShape = (a: ShapeDef, b: ShapeDef, t: number, out: ShapeDef): ShapeDef => {
    out.m = Math.exp(Math.log(a.m) * (1 - t) + Math.log(b.m) * t);
    out.sx = a.sx + (b.sx - a.sx) * t;
    out.sy = a.sy + (b.sy - a.sy) * t;
    out.sz = a.sz + (b.sz - a.sz) * t;
    out.taper = a.taper + (b.taper - a.taper) * t;
    out.yShift = a.yShift + (b.yShift - a.yShift) * t;
    return out;
};

const SystemCoreScene: React.FC<{ className?: string }> = ({ className = '' }) => {
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
                return; // no three, no scene — CSS fallback shows through.
            }
            if (disposed || !host.isConnected) return;

            // ── WebGL availability ────────────────────────────────────
            let renderer: import('three').WebGLRenderer;
            try {
                renderer = new THREE.WebGLRenderer({
                    antialias: true,
                    alpha: true,
                    powerPreference: 'high-performance',
                });
            } catch {
                return; // CSS fallback.
            }

            const isSmall = host.clientWidth < 560;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.5 : 1.75));
            renderer.setSize(host.clientWidth, host.clientHeight);
            renderer.domElement.style.width = '100%';
            renderer.domElement.style.height = '100%';
            renderer.domElement.style.display = 'block';
            host.appendChild(renderer.domElement);

            // ── Scene graph ───────────────────────────────────────────
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(40, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 60);
            // Portrait hosts pull the camera back so the widest orbit fits.
            camera.position.set(0, 0, isSmall ? 8.4 : 6.7);

            // Brand constants (see src/index.css :root).
            const COLOR_MOSS = new THREE.Color('#16A34A');
            const COLOR_EMERALD = new THREE.Color('#059669');
            const COLOR_MINT = new THREE.Color('#6EE7B7');

            // ── The cluster: everything orbits inside this tilted group.
            const TILT_X = 0.50;
            const cluster = new THREE.Group();
            cluster.rotation.x = TILT_X;
            scene.add(cluster);

            // ── 1. The core — a faceted engine, moss→emerald with an
            //       mint rim. Opaque, so shapes and links pass behind it
            //       honestly.
            const coreGeo = new THREE.IcosahedronGeometry(0.52, 0);
            {
                // Flat per-face normals — every facet catches light like
                // cut glass (same trick as the hero crystal).
                const posAttr = coreGeo.getAttribute('position') as import('three').BufferAttribute;
                const flat = new Float32Array(posAttr.count * 3);
                const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
                const cb = new THREE.Vector3(), ab = new THREE.Vector3(), n = new THREE.Vector3();
                for (let i = 0; i < posAttr.count; i += 3) {
                    a.fromBufferAttribute(posAttr, i);
                    b.fromBufferAttribute(posAttr, i + 1);
                    c.fromBufferAttribute(posAttr, i + 2);
                    cb.subVectors(c, b);
                    ab.subVectors(a, b);
                    n.crossVectors(ab, cb).normalize();
                    for (let k = 0; k < 3; k++) flat.set([n.x, n.y, n.z], (i + k) * 3);
                }
                coreGeo.setAttribute('normal', new THREE.BufferAttribute(flat, 3));
            }
            const coreMat = new THREE.ShaderMaterial({
                uniforms: {
                    uColorA: { value: COLOR_MOSS },
                    uColorB: { value: COLOR_EMERALD },
                    uColorC: { value: COLOR_MINT },
                },
                vertexShader: `
                    varying vec3 vNormal;
                    varying vec3 vView;
                    void main() {
                        vNormal = normalize(normalMatrix * normal);
                        vec4 mv = modelViewMatrix * vec4(position, 1.0);
                        vView = normalize(-mv.xyz);
                        gl_Position = projectionMatrix * mv;
                    }
                `,
                fragmentShader: `
                    uniform vec3 uColorA;
                    uniform vec3 uColorB;
                    uniform vec3 uColorC;
                    varying vec3 vNormal;
                    varying vec3 vView;
                    void main() {
                        float top = clamp(vNormal.y * 0.5 + 0.5, 0.0, 1.0);
                        vec3 col = mix(uColorA, uColorB, top);
                        col *= 0.52 + top * 0.62;
                        float fres = pow(1.0 - clamp(dot(vNormal, vView), 0.0, 1.0), 2.4);
                        col += uColorC * fres * 0.55;
                        gl_FragColor = vec4(col, 1.0);
                    }
                `,
            });
            const core = new THREE.Mesh(coreGeo, coreMat);
            cluster.add(core);

            // ── 2. The halo — a soft emerald mist behind the core. Normal
            //       blending (NOT additive): this section sits on white,
            //       where additive glow would simply disappear.
            const haloGeo = new THREE.SphereGeometry(1.02, 32, 24);
            const haloMat = new THREE.ShaderMaterial({
                transparent: true,
                depthWrite: false,
                depthTest: false,
                uniforms: { uColor: { value: COLOR_EMERALD }, uFade: { value: 0 } },
                vertexShader: `
                    varying vec3 vNormal;
                    varying vec3 vView;
                    void main() {
                        vNormal = normalize(normalMatrix * normal);
                        vec4 mv = modelViewMatrix * vec4(position, 1.0);
                        vView = normalize(-mv.xyz);
                        gl_Position = projectionMatrix * mv;
                    }
                `,
                fragmentShader: `
                    uniform vec3 uColor;
                    uniform float uFade;
                    varying vec3 vNormal;
                    varying vec3 vView;
                    void main() {
                        float facing = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
                        float a = pow(facing, 2.4) * 0.20 * uFade;
                        gl_FragColor = vec4(uColor, a);
                    }
                `,
            });
            const halo = new THREE.Mesh(haloGeo, haloMat);
            halo.renderOrder = -2;
            cluster.add(halo);

            // ── 3. Guide rings — thin dashed circles under the orbits, so
            //       the cluster reads as an engineered diagram, not a mob.
            const makeRing = (radius: number, opacity: number) => {
                const SEG = 128;
                const pts: number[] = [];
                for (let i = 0; i <= SEG; i++) {
                    const th = (i / SEG) * Math.PI * 2;
                    pts.push(Math.cos(th) * radius, 0, Math.sin(th) * radius);
                }
                const g = new THREE.BufferGeometry();
                g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
                const m = new THREE.LineDashedMaterial({
                    color: COLOR_EMERALD,
                    transparent: true,
                    opacity,
                    dashSize: 0.045,
                    gapSize: 0.16,
                    depthWrite: false,
                });
                const line = new THREE.Line(g, m);
                line.computeLineDistances();
                line.renderOrder = -1;
                return { line, mat: m, baseOpacity: opacity };
            };
            const ringA = makeRing(2.02, 0.22);
            const ringB = makeRing(2.62, 0.16);
            cluster.add(ringA.line, ringB.line);

            // ── 4. The seven shapes (W14: the morphing engine) ─────────
            // All shapes share ONE topology — an icosphere of 80 faces /
            // 240 (non-indexed) vertices / 42 unique lattice points — and a
            // shared table of unit direction vectors. Each frame a shape is
            // "morphing", its vertices are re-projected onto the current
            // superellipsoid and its flat normals recomputed; the wireframe
            // rides the very same buffer (same trick as the hero crystal),
            // so the skeleton always matches the flesh. Dormant shapes skip
            // the vertex pass entirely.
            const baseGeo = new THREE.IcosahedronGeometry(1, 1);
            const baseAttr = baseGeo.getAttribute('position') as import('three').BufferAttribute;
            const V_COUNT = baseAttr.count;                       // 240
            const baseDirs = new Float32Array(baseAttr.array as ArrayLike<number>); // unit dirs
            // Deduped edge index for the wireframe pass (same as MorphScene).
            const pkey = (i: number) => `${baseAttr.getX(i).toFixed(3)}|${baseAttr.getY(i).toFixed(3)}|${baseAttr.getZ(i).toFixed(3)}`;
            const canon = new Map<string, number>();
            for (let i = 0; i < V_COUNT; i++) if (!canon.has(pkey(i))) canon.set(pkey(i), i);
            const edgeSeen = new Set<string>();
            const edgeIndex: number[] = [];
            for (let f = 0; f < V_COUNT; f += 3) {
                const tri = [f, f + 1, f + 2];
                for (let e = 0; e < 3; e++) {
                    const aIdx = tri[e], bIdx = tri[(e + 1) % 3];
                    const ca = canon.get(pkey(aIdx))!, cbn = canon.get(pkey(bIdx))!;
                    const ek = ca < cbn ? `${ca}-${cbn}` : `${cbn}-${ca}`;
                    if (!edgeSeen.has(ek)) { edgeSeen.add(ek); edgeIndex.push(aIdx, bIdx); }
                }
            }
            baseGeo.dispose(); // only the base table was needed

            const glassVertex = `
                varying vec3 vNormal;
                varying vec3 vView;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    vView = normalize(-mv.xyz);
                    gl_Position = projectionMatrix * mv;
                }
            `;
            const glassFragment = `
                uniform vec3 uColorA;
                uniform vec3 uColorB;
                uniform vec3 uColorC;
                uniform float uFade;
                varying vec3 vNormal;
                varying vec3 vView;
                void main() {
                    float top = clamp(vNormal.y * 0.5 + 0.5, 0.0, 1.0);
                    vec3 col = mix(uColorA, uColorB, top);
                    float fres = pow(1.0 - clamp(dot(vNormal, vView), 0.0, 1.0), 2.0);
                    col = mix(col, uColorC, fres * 0.40);
                    col += vec3(0.10) * top;
                    float a = (0.10 + fres * 0.26) * uFade;
                    gl_FragColor = vec4(col, a);
                }
            `;

            type Module = {
                pivot: import('three').Object3D;
                holder: import('three').Object3D;
                glass: import('three').Mesh;
                edges: import('three').LineSegments;
                glassMat: import('three').ShaderMaterial;
                edgeMat: import('three').LineBasicMaterial;
                posAttr: import('three').BufferAttribute;
                nrmAttr: import('three').BufferAttribute;
                radius: number;
                scale: number;
                spin: number;
                delay: number;
                // W14: the shape clock
                from: number; to: number;
                t: number;             // morph progress 0..1 (1 = settled)
                dwelling: boolean;
                dwellLeft: number;
                needsMorph: boolean;   // vertex pass required this frame
                def: ShapeDef;         // scratch for the interpolated def
            };
            const modules: Module[] = [];
            const scratch = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), cb: new THREE.Vector3(), ab: new THREE.Vector3(), n: new THREE.Vector3() };

            const disposables: Array<{ dispose: () => void }> = [coreGeo, coreMat, haloGeo, haloMat, ringA.line.geometry, ringA.mat, ringB.line.geometry, ringB.mat];

            for (let i = 0; i < MODULE_COUNT; i++) {
                const pivot = new THREE.Object3D();
                pivot.rotation.y = ORBIT_PHASE[i];
                cluster.add(pivot);

                const holder = new THREE.Object3D();
                pivot.add(holder);

                // Non-indexed mesh (flat per-face normals) + indexed wire
                // sharing the SAME position buffer.
                const meshGeo = new THREE.BufferGeometry();
                const posAttr = new THREE.BufferAttribute(new Float32Array(baseDirs), 3);
                posAttr.setUsage(THREE.DynamicDrawUsage);
                const nrmAttr = new THREE.BufferAttribute(new Float32Array(V_COUNT * 3), 3);
                nrmAttr.setUsage(THREE.DynamicDrawUsage);
                meshGeo.setAttribute('position', posAttr);
                meshGeo.setAttribute('normal', nrmAttr);

                const glassMat = new THREE.ShaderMaterial({
                    transparent: true,
                    depthWrite: false,
                    uniforms: {
                        uColorA: { value: COLOR_MOSS },
                        uColorB: { value: COLOR_EMERALD },
                        uColorC: { value: COLOR_MINT },
                        uFade: { value: 0 },
                    },
                    vertexShader: glassVertex,
                    fragmentShader: glassFragment,
                });
                const glass = new THREE.Mesh(meshGeo, glassMat);
                glass.scale.setScalar(MODULE_SCALE[i]);
                holder.add(glass);

                const wireGeo = new THREE.BufferGeometry();
                wireGeo.setAttribute('position', posAttr);   // shared buffer
                wireGeo.setIndex(edgeIndex);
                const edgeMat = new THREE.LineBasicMaterial({
                    color: COLOR_MOSS,
                    transparent: true,
                    opacity: 0,
                    depthWrite: false,
                });
                const edges = new THREE.LineSegments(wireGeo, edgeMat);
                edges.scale.setScalar(MODULE_SCALE[i]);
                holder.add(edges);

                disposables.push(meshGeo, glassMat, wireGeo, edgeMat);
                modules.push({
                    pivot, holder, glass, edges, glassMat, edgeMat, posAttr, nrmAttr,
                    radius: ORBIT_RADIUS[i],
                    scale: MODULE_SCALE[i],
                    spin: 0.9 + i * 0.13,
                    delay: 0.08 + i * 0.055,
                    from: i % SHAPES.length,
                    to: i % SHAPES.length,
                    t: 1,
                    dwelling: true,
                    dwellLeft: 1.6 + i * 0.7,
                    needsMorph: true,   // first frame must write vertices
                    def: { m: 9, sx: 1, sy: 1, sz: 1, taper: 1, yShift: 0 },
                });
            }

            /** Project the shared direction table onto `def` and rewrite
             *  positions + flat normals for one module. */
            const applyShape = (m: Module, def: ShapeDef, dip: number) => {
                const pos = m.posAttr.array as Float32Array;
                const nrm = m.nrmAttr.array as Float32Array;
                const invM = 1 / def.m;
                for (let v = 0; v < V_COUNT; v++) {
                    const dx = baseDirs[v * 3], dy = baseDirs[v * 3 + 1], dz = baseDirs[v * 3 + 2];
                    const L = Math.pow(Math.abs(dx), def.m) + Math.pow(Math.abs(dy), def.m) + Math.pow(Math.abs(dz), def.m);
                    const r = 1 / Math.max(1e-6, Math.pow(L, invM));
                    let px = dx * r * def.sx, py = dy * r * def.sy, pz = dz * r * def.sz;
                    if (def.taper !== 1) {
                        // Narrow toward the top: y∈[-1,1] → k∈[1..taper].
                        const k = 1 - (1 - def.taper) * clamp01((py + 0.45) / 1.45);
                        px *= k; pz *= k;
                    }
                    py += def.yShift;
                    pos[v * 3] = px * SHAPE_SIZE * dip;
                    pos[v * 3 + 1] = py * SHAPE_SIZE * dip;
                    pos[v * 3 + 2] = pz * SHAPE_SIZE * dip;
                }
                // Flat per-face normals from the morphed positions.
                const { a, b, c, cb, ab, n } = scratch;
                for (let f = 0; f < V_COUNT; f += 3) {
                    a.set(pos[f * 3], pos[f * 3 + 1], pos[f * 3 + 2]);
                    b.set(pos[(f + 1) * 3], pos[(f + 1) * 3 + 1], pos[(f + 1) * 3 + 2]);
                    c.set(pos[(f + 2) * 3], pos[(f + 2) * 3 + 1], pos[(f + 2) * 3 + 2]);
                    cb.subVectors(c, b);
                    ab.subVectors(a, b);
                    n.crossVectors(ab, cb).normalize();
                    for (let k = 0; k < 3; k++) nrm.set([n.x, n.y, n.z], (f + k) * 3);
                }
                m.posAttr.needsUpdate = true;
                m.nrmAttr.needsUpdate = true;
            };

            // ── 5. The energy links — core → shape, in WORLD space (they
            //       are scene children, so they stay straight no matter how
            //       the cluster tilts). A light pulse travels each one.
            type Link = {
                geo: import('three').BufferGeometry;
                attr: import('three').BufferAttribute;
                mat: import('three').ShaderMaterial;
                phase: number;
                speed: number;
                module: Module;
            };
            const links: Link[] = [];
            const tmpV = new THREE.Vector3();
            for (let i = 0; i < MODULE_COUNT; i++) {
                const geo = new THREE.BufferGeometry();
                const attr = new THREE.BufferAttribute(new Float32Array(6), 3);
                attr.setUsage(THREE.DynamicDrawUsage);
                geo.setAttribute('position', attr);
                const tArr = new Float32Array([0, 1]);
                geo.setAttribute('aT', new THREE.BufferAttribute(tArr, 1));
                const mat = new THREE.ShaderMaterial({
                    transparent: true,
                    depthWrite: false,
                    uniforms: {
                        uTime: { value: 0 },
                        uPhase: { value: (i * 0.37) % 1 },
                        uSpeed: { value: 0.14 + (i % 3) * 0.05 },
                        uFade: { value: 0 },
                        uColorA: { value: COLOR_EMERALD },
                        uColorB: { value: COLOR_MINT },
                    },
                    vertexShader: `
                        attribute float aT;
                        varying float vT;
                        void main() {
                            vT = aT;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragmentShader: `
                        uniform float uTime;
                        uniform float uPhase;
                        uniform float uSpeed;
                        uniform float uFade;
                        uniform vec3 uColorA;
                        uniform vec3 uColorB;
                        varying float vT;
                        void main() {
                            vec3 col = mix(uColorA, uColorB, smoothstep(0.15, 0.85, vT));
                            float cycle = fract(vT - uPhase - uTime * uSpeed);
                            float pk = exp(-pow(cycle * 2.0 - 1.0, 2.0) * 20.0);
                            float alpha = (0.16 + 0.55 * pk) * uFade;
                            gl_FragColor = vec4(col, alpha);
                        }
                    `,
                });
                scene.add(new THREE.Line(geo, mat));
                disposables.push(geo, mat);
                links.push({ geo, attr, mat, phase: (i * 0.37) % 1, speed: 0.14 + (i % 3) * 0.05, module: modules[i] });
            }

            // ── Pointer parallax (lerped, never jumpy — hero contract).
            // W14: the tilt is now as alive vertically as it always was
            // horizontally — raise the mouse and the whole system leans
            // back with you, the camera rises, and the shapes bob harder.
            let pointerX = 0, pointerY = 0, curX = 0, curY = 0;
            const onPointerMove = (e: PointerEvent) => {
                pointerX = (e.clientX / window.innerWidth) * 2 - 1;
                pointerY = (e.clientY / window.innerHeight) * 2 - 1;
            };
            window.addEventListener('pointermove', onPointerMove, { passive: true });

            // ── Visibility management ─────────────────────────────────
            let inView = false;
            let settleStarted = false;
            const io = new IntersectionObserver((entries) => {
                inView = entries.some((en) => en.isIntersecting);
                if (inView) settleStarted = true;
            }, { threshold: 0.15 });
            io.observe(host);
            const onVis = () => { inView = !document.hidden && inView; };
            document.addEventListener('visibilitychange', onVis);

            // ── Resize ────────────────────────────────────────────────
            const ro = new ResizeObserver(() => {
                const w = host.clientWidth, h = host.clientHeight;
                if (w === 0 || h === 0) return;
                renderer.setSize(w, h);
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
            });
            ro.observe(host);

            // ── Animation loop ────────────────────────────────────────
            let rafId: number | null = null;
            let running = true;
            let last = performance.now();
            let time = 0;
            let settleT = 0; // 0 → 1 over SETTLE_SECONDS once first seen

            const renderFrame = (desc: number) => {
                // Settle: each shape has its own slice of the timeline.
                const eCore = easeOutCubic(clamp01(settleT / 0.55));
                const linkFade = clamp01((settleT - 0.35) / 0.45) * clamp01(1 - desc * 1.3);

                // Core + halo. The core dims politely as its shapes leave.
                const coreFade = 1 - desc * 0.25;
                core.scale.setScalar((0.55 + 0.45 * eCore) * coreFade);
                core.rotation.y = time * 0.22;
                core.rotation.x = Math.sin(time * 0.17) * 0.22;
                haloMat.uniforms.uFade.value = eCore * (1 - desc * 0.6);
                halo.scale.setScalar(0.8 + 0.2 * eCore);
                ringA.mat.opacity = ringA.baseOpacity * clamp01((settleT - 0.15) / 0.5) * (1 - desc * 0.7);
                ringB.mat.opacity = ringB.baseOpacity * clamp01((settleT - 0.25) / 0.5) * (1 - desc * 0.7);

                // Shapes: spiral home from wide orbit, live there, and —
                // as the visitor scrolls toward the cards — DESCEND out of
                // the scene toward them (reversible: scroll back up and
                // they return to orbit).
                for (let i = 0; i < MODULE_COUNT; i++) {
                    const m = modules[i];
                    const span = clamp01((settleT - m.delay) / Math.max(0.2, 1 - m.delay));
                    const e = easeOutCubic(span);
                    // 2.55× radius at e=0 → 1× at e=1: a clean spiral-in.
                    const dist = m.radius * (1 + (1 - e) * 1.55);
                    // The descent: each shape sinks toward the cards below
                    // at its own rate, fading as it goes.
                    const drop = desc * (2.5 + i * 0.3);
                    const fade = e * clamp01(1 - desc * 1.25);
                    m.holder.position.set(dist, -drop, 0);
                    const bob = Math.sin(time * 0.7 + i * 1.3) * 0.075 * (1 + Math.abs(curY) * 0.9);
                    m.glass.position.y = bob;
                    m.edges.position.y = bob;
                    m.glassMat.uniforms.uFade.value = fade;
                    m.edgeMat.opacity = 0.85 * fade;
                    // Orbits run a little faster mid-descent — a transport,
                    // not a fade-out. Pure function of (time, desc), so it
                    // reverses perfectly.
                    m.pivot.rotation.y = ORBIT_PHASE[i] + time * ORBIT_SPEED[i] * (1 + desc * 1.7);
                    m.glass.rotation.x = time * 0.18 + i * 0.4 + desc * i * 0.5;
                    m.glass.rotation.y = time * 0.23 + i * 0.7;
                    m.edges.rotation.copy(m.glass.rotation);

                    // The morphing engine: dwell in a shape, melt to the
                    // next, repeat. Only morphing shapes pay the vertex cost.
                    if (m.dwelling) {
                        m.dwellLeft -= lastDt;
                        if (m.dwellLeft <= 0) {
                            m.dwelling = false;
                            m.from = m.to;
                            m.to = (m.to + 1 + Math.floor(Math.random() * (SHAPES.length - 1))) % SHAPES.length;
                            m.t = 0;
                            m.needsMorph = true;
                        }
                    } else {
                        m.t = Math.min(1, m.t + lastDt / MORPH_SECONDS);
                        m.needsMorph = true;
                        if (m.t >= 1) {
                            m.dwelling = true;
                            m.dwellLeft = DWELL_MIN + Math.random() * DWELL_VAR;
                        }
                    }
                    if (m.needsMorph) {
                        const ei = easeInOutCubic(m.t);
                        lerpShape(SHAPES[m.from], SHAPES[m.to], ei, m.def);
                        // A soft dip mid-melt — the shape "lets go" of its
                        // form for a moment, then the next one arrives.
                        const dip = m.dwelling && m.t >= 1 ? 1 : 1 - 0.10 * Math.sin(Math.PI * ei);
                        applyShape(m, m.def, dip);
                        m.needsMorph = m.t < 1 || !m.dwelling;
                    }
                }

                // Cluster: gentle auto-turn + lerped pointer lean — now
                // with real vertical authority (W14).
                curX += (pointerX - curX) * 0.05;
                curY += (pointerY - curY) * 0.05;
                cluster.rotation.y = time * 0.045 + curX * 0.16;
                cluster.rotation.x = TILT_X + curY * 0.24;
                cluster.position.y = curY * 0.16;
                camera.position.x = curX * 0.30;
                camera.position.y = -curY * 0.38;
                camera.lookAt(0, 0, 0);

                // Links: world-space, from the core's surface to each
                // shape's near face — recomputed every frame.
                cluster.updateMatrixWorld(true);
                for (let i = 0; i < links.length; i++) {
                    const lk = links[i];
                    const m = lk.module;
                    m.glass.getWorldPosition(tmpV);
                    const dirX = tmpV.x, dirY = tmpV.y, dirZ = tmpV.z;
                    const len = Math.max(0.0001, Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ));
                    const ux = dirX / len, uy = dirY / len, uz = dirZ / len;
                    const startR = 0.60;                                  // just off the core's surface
                    const endR = len - (0.40 * m.scale + 0.06);           // just off the shape's face
                    lk.attr.setXYZ(0, ux * startR, uy * startR, uz * startR);
                    lk.attr.setXYZ(1, ux * endR, uy * endR, uz * endR);
                    lk.attr.needsUpdate = true;
                    lk.mat.uniforms.uTime.value = time;
                    lk.mat.uniforms.uFade.value = linkFade;
                }

                renderer.render(scene, camera);
            };

            // The loop carries dt for the shape clocks (renderFrame reads
            // it through lastDt — a single shared clock, no drift).
            let lastDt = 1 / 60;
            /** 0 while the canvas owns the fold; → 1 as the cards take over. */
            const descentProgress = () => {
                const rect = host.getBoundingClientRect();
                const vh = window.innerHeight || 1;
                return clamp01((vh - rect.bottom) / (vh * 0.9));
            };

            if (reducedMotion) {
                // One static, fully-assembled frame — the wow stays, the
                // movement goes.
                settleT = 1;
                time = 4.2;
                for (const m of modules) { m.from = m.to; m.t = 1; m.needsMorph = true; }
                renderFrame(0);
            } else {
                const loop = (now: number) => {
                    if (!running) { rafId = null; return; }
                    const dt = Math.min(0.05, (now - last) / 1000);
                    last = now;
                    lastDt = dt;
                    if (inView) {
                        time += dt;
                        if (settleStarted && settleT < 1) {
                            settleT = Math.min(1, settleT + dt / SETTLE_SECONDS);
                        }
                        renderFrame(descentProgress());
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
                document.removeEventListener('visibilitychange', onVis);
                for (const d of disposables) d.dispose();
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

export default SystemCoreScene;
