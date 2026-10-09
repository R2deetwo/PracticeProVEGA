import React, { useEffect, useRef } from 'react';

/**
 * MorphScene — W8 "structured fluidity" (the corporate hero's living system).
 *
 * Alpha 3D (W7) was an organic blob: soft, amorphous, all fluid. W8 keeps the
 * fluid DNA but gives it a skeleton — the hero now shows a SYSTEM:
 *
 *   1. A faceted crystal core — an icosahedral lattice whose surface breathes
 *      on the same simplex-noise engine as the orb, but chunkier (lower
 *      frequency, lower amplitude) so the structure stays readable while it
 *      morphs. Flat per-face normals make every facet catch light like cut
 *      glass — architecture, not jelly.
 *   2. The crystal's exact wireframe — the same displaced vertices drawn as
 *      edges, so the skeleton always matches the flesh.
 *   3. Glowing nodes at the crystal's vertices — the "modules", pulsing.
 *   4. Two counter-rotating orbital rings with traveling energy arcs —
 *      the motion that keeps the whole thing feeling alive.
 *   5. An outer constellation network — nodes on a shell wired to their
 *      nearest neighbours: a literal picture of "we build systems".
 *
 * Engineering notes (carried over from W7):
 * - three.js is imported DYNAMICALLY so it lands in its own lazy chunk:
 *   visitors to /vega, /atrium or the logged-in app never download it.
 * - Displacement happens in the vertex shader (GPU); all three core passes
 *   (solid, wire, nodes) share the SAME displacement formula and uniforms,
 *   so edges and nodes ride the morphing surface exactly.
 * - Flat shading comes from CPU-computed per-face normals (no GLSL
 *   derivatives, no version games — maximum compatibility).
 * - Pauses when offscreen or the tab is hidden; one static frame under
 *   prefers-reduced-motion; silent CSS fallback when WebGL is unavailable.
 */
const MorphScene: React.FC<{ className?: string }> = ({ className = '' }) => {
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

            const isSmall = host.clientWidth < 700;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.5 : 1.75));
            renderer.setSize(host.clientWidth, host.clientHeight);
            renderer.domElement.style.width = '100%';
            renderer.domElement.style.height = '100%';
            renderer.domElement.style.display = 'block';
            host.appendChild(renderer.domElement);

            // ── Scene graph ───────────────────────────────────────────
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(42, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 60);
            // Portrait viewports pull the camera back; the lattice is allowed
            // to run past the frame edges — it reads as infinite structure.
            camera.position.set(0, 0, isSmall ? 8.6 : 6.8);

            // Brand constants (see src/index.css :root).
            const COLOR_MOSS = new THREE.Color('#16A34A');
            const COLOR_EMERALD = new THREE.Color('#059669');
            const COLOR_MINT = new THREE.Color('#6EE7B7');

            // Materials that tick with uTime — collected so the loop only
            // has to touch a list instead of reaching through the graph.
            const timed: import('three').ShaderMaterial[] = [];
            const clock = (m: import('three').ShaderMaterial) => { timed.push(m); return m; };

            // The shared displacement GLSL — byte-identical in every core
            // pass so the wireframe and the nodes ride the surface exactly.
            // Ashima Arts 3D simplex noise (public domain).
            const NOISE_GLSL = `
                vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
                vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
                float snoise(vec3 v) {
                    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
                    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
                    vec3 i  = floor(v + dot(v, C.yyy));
                    vec3 x0 = v - i + dot(i, C.xxx);
                    vec3 g = step(x0.yzx, x0.xyz);
                    vec3 l = 1.0 - g;
                    vec3 i1 = min(g.xyz, l.zxy);
                    vec3 i2 = max(g.xyz, l.zxy);
                    vec3 x1 = x0 - i1 + C.xxx;
                    vec3 x2 = x0 - i2 + C.yyy;
                    vec3 x3 = x0 - D.yyy;
                    i = mod289(i);
                    vec4 p = permute(permute(permute(
                                i.z + vec4(0.0, i1.z, i2.z, 1.0))
                            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
                    float n_ = 0.142857142857;
                    vec3 ns = n_ * D.wyz - D.xzx;
                    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
                    vec4 x_ = floor(j * ns.z);
                    vec4 y_ = floor(j - 7.0 * x_);
                    vec4 x = x_ * ns.x + ns.yyyy;
                    vec4 y = y_ * ns.x + ns.yyyy;
                    vec4 h = 1.0 - abs(x) - abs(y);
                    vec4 b0 = vec4(x.xy, y.xy);
                    vec4 b1 = vec4(x.zw, y.zw);
                    vec4 s0 = floor(b0) * 2.0 + 1.0;
                    vec4 s1 = floor(b1) * 2.0 + 1.0;
                    vec4 sh = -step(h, vec4(0.0));
                    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
                    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
                    vec3 p0 = vec3(a0.xy, h.x);
                    vec3 p1 = vec3(a0.zw, h.y);
                    vec3 p2 = vec3(a1.xy, h.z);
                    vec3 p3 = vec3(a1.zw, h.w);
                    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
                    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
                    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
                    m = m * m;
                    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
                }

                // W8 crystal displacement: chunkier and slower than the W7
                // orb — lower frequency, lower amplitude, longer clock. The
                // structure must stay readable as a lattice while it moves.
                float crystalNoise(vec3 position, float uTime) {
                    float t = uTime * 0.16;
                    vec3 p = position;
                    float n = snoise(p * 0.55 + vec3(t, t * 0.7, 0.0)) * 0.65
                            + snoise(p * 1.45 - vec3(t * 1.35, 0.0, t * 0.9)) * 0.35;
                    return n;
                }
            `;

            // ── 1. The crystal core (solid + wireframe + nodes) ────────
            // Icosahedron detail 1: 80 faces, 240 (non-indexed) vertices,
            // 42 unique lattice points — small enough to stay crisp.
            const RADIUS = 1.55;
            const AMP = 0.30;
            const core = new THREE.Group();
            scene.add(core);

            const solidGeo = new THREE.IcosahedronGeometry(RADIUS, 1);
            const posAttr = solidGeo.getAttribute('position') as import('three').BufferAttribute;

            // Flat per-face normals (CPU, once) — the facets read as cut
            // glass without any GLSL derivative tricks.
            {
                const vCount = posAttr.count;
                const flat = new Float32Array(vCount * 3);
                const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
                const cb = new THREE.Vector3(), ab = new THREE.Vector3(), n = new THREE.Vector3();
                for (let i = 0; i < vCount; i += 3) {
                    a.fromBufferAttribute(posAttr, i);
                    b.fromBufferAttribute(posAttr, i + 1);
                    c.fromBufferAttribute(posAttr, i + 2);
                    cb.subVectors(c, b);
                    ab.subVectors(a, b);
                    n.crossVectors(ab, cb).normalize();
                    for (let k = 0; k < 3; k++) flat.set([n.x, n.y, n.z], (i + k) * 3);
                }
                solidGeo.setAttribute('normal', new THREE.BufferAttribute(flat, 3));
            }

            // Canonical lattice map — shared corners deduped by position, so
            // the wireframe never double-draws an edge and the node cloud
            // carries exactly one point per lattice vertex.
            const canon = new Map<string, number>();
            const nodeXYZ: number[] = [];
            const pkey = (i: number) => `${posAttr.getX(i).toFixed(3)}|${posAttr.getY(i).toFixed(3)}|${posAttr.getZ(i).toFixed(3)}`;
            for (let i = 0; i < posAttr.count; i++) {
                const k = pkey(i);
                if (!canon.has(k)) {
                    canon.set(k, i);
                    nodeXYZ.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
                }
            }
            // Deduped edge index for the wireframe pass.
            const edgeSeen = new Set<string>();
            const edgeIndex: number[] = [];
            for (let f = 0; f < posAttr.count; f += 3) {
                const tri = [f, f + 1, f + 2];
                for (let e = 0; e < 3; e++) {
                    const aIdx = tri[e], bIdx = tri[(e + 1) % 3];
                    const ca = canon.get(pkey(aIdx))!, cbn = canon.get(pkey(bIdx))!;
                    const ek = ca < cbn ? `${ca}-${cbn}` : `${cbn}-${ca}`;
                    if (!edgeSeen.has(ek)) { edgeSeen.add(ek); edgeIndex.push(aIdx, bIdx); }
                }
            }

            const coreVertex = `
                uniform float uTime;
                uniform float uAmp;
                uniform vec3 uPulseDir;
                uniform float uPulseAmp;
                uniform float uAntiAmp;
                uniform float uPulseWidth;
                varying float vNoise;
                varying vec3 vNormal;
                varying vec3 vView;
                ${NOISE_GLSL}
                void main() {
                    float n = crystalNoise(position, uTime);
                    vec3 dir = normalize(position);
                    vec3 p = position + dir * n * uAmp;
                    // W14: the pulse — a patch of the lattice zips toward the
                    // pointer and springs back through a damped wave; the far
                    // side answers with a softer, lagged echo (firePulse).
                    float ca = dot(dir, uPulseDir);
                    float nearW = exp(-pow(acos(clamp(ca, -1.0, 1.0)) / uPulseWidth, 2.0));
                    float antiW = exp(-pow(acos(clamp(-ca, -1.0, 1.0)) / (uPulseWidth * 1.8), 2.0));
                    p += uPulseDir * (nearW * uPulseAmp) - uPulseDir * (antiW * uAntiAmp * 0.5);
                    vNoise = n;
                    vNormal = normalize(normalMatrix * normal);
                    vec4 mv = modelViewMatrix * vec4(p, 1.0);
                    vView = normalize(-mv.xyz);
                    gl_Position = projectionMatrix * mv;
                }
            `;

            const PULSE_UNIFORMS = () => ({
                uPulseDir: { value: new THREE.Vector3(0, 0, 1) },
                uPulseAmp: { value: 0 },
                uAntiAmp: { value: 0 },
                uPulseWidth: { value: 0.62 },
            });

            // 1a. Solid — the faceted brand body.
            const solidMat = clock(new THREE.ShaderMaterial({
                uniforms: {
                    uTime: { value: 0 },
                    uAmp: { value: AMP },
                    uEdge: { value: 0 },
                    uColorA: { value: COLOR_MOSS },
                    uColorB: { value: COLOR_EMERALD },
                    uColorC: { value: COLOR_MINT },
                    ...PULSE_UNIFORMS(),
                },
                vertexShader: coreVertex,
                fragmentShader: `
                    uniform vec3 uColorA;
                    uniform vec3 uColorB;
                    uniform vec3 uColorC;
                    uniform float uEdge;
                    varying float vNoise;
                    varying vec3 vNormal;
                    varying vec3 vView;
                    void main() {
                        // Moss → emerald across the noise field…
                        float g = smoothstep(-0.6, 0.95, vNoise);
                        vec3 col = mix(uColorA, uColorB, g);
                        // …a mint kiss on the highest crests.
                        col = mix(col, uColorC, smoothstep(0.55, 1.05, vNoise) * 0.5);
                        // Directional top light — makes every facet read.
                        float top = clamp(vNormal.y * 0.5 + 0.5, 0.0, 1.0);
                        col *= 0.38 + top * 0.8;
                        // Mint fresnel rim — the brand's signature edge light.
                        // W10: the rim ignites as the pointer nears the rails
                        // (edge volatility) and banks back to calm at centre.
                        float fres = pow(1.0 - clamp(dot(vNormal, vView), 0.0, 1.0), 2.6);
                        col += uColorC * fres * (0.5 + uEdge * 0.45);
                        gl_FragColor = vec4(col, 1.0);
                    }
                `,
            }));
            core.add(new THREE.Mesh(solidGeo, solidMat));

            // 1b. Wireframe — same displaced vertices as edges.
            const wireGeo = new THREE.BufferGeometry();
            wireGeo.setAttribute('position', posAttr);
            wireGeo.setIndex(edgeIndex);
            const wireMat = clock(new THREE.ShaderMaterial({
                transparent: true,
                depthWrite: false,
                uniforms: {
                    uTime: { value: 0 },
                    uAmp: { value: AMP },
                    uColorA: { value: COLOR_EMERALD },
                    uColorB: { value: COLOR_MOSS },
                    uColorC: { value: COLOR_MINT },
                    ...PULSE_UNIFORMS(),
                },
                vertexShader: coreVertex,
                fragmentShader: `
                    uniform vec3 uColorA;
                    uniform vec3 uColorB;
                    uniform vec3 uColorC;
                    varying float vNoise;
                    void main() {
                        // Brighter than the solid beneath it — the skeleton
                        // must trace clearly over the facets it rides.
                        vec3 col = mix(uColorB, uColorA, 0.6 + vNoise * 0.4) + uColorC * 0.30 + vec3(0.22);
                        gl_FragColor = vec4(col, 0.85);
                    }
                `,
            }));
            core.add(new THREE.LineSegments(wireGeo, wireMat));

            // 1c. Nodes — one glowing point per lattice vertex, riding the
            // morph. Same displacement formula, so they never detach.
            const nodeGeo = new THREE.BufferGeometry();
            const nodeCount = nodeXYZ.length / 3;
            const nodeSeeds = new Float32Array(nodeCount);
            for (let i = 0; i < nodeCount; i++) nodeSeeds[i] = Math.random();
            nodeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nodeXYZ), 3));
            nodeGeo.setAttribute('aSeed', new THREE.BufferAttribute(nodeSeeds, 1));
            const nodeMat = clock(new THREE.ShaderMaterial({
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                uniforms: {
                    uTime: { value: 0 },
                    uAmp: { value: AMP },
                    uColorA: { value: COLOR_EMERALD },
                    uColorB: { value: COLOR_MINT },
                    ...PULSE_UNIFORMS(),
                },
                vertexShader: `
                    attribute float aSeed;
                    uniform float uTime;
                    uniform float uAmp;
                    uniform vec3 uPulseDir;
                    uniform float uPulseAmp;
                    uniform float uAntiAmp;
                    uniform float uPulseWidth;
                    varying float vSeed;
                    varying float vPulse;
                    ${NOISE_GLSL}
                    void main() {
                        vSeed = aSeed;
                        float n = crystalNoise(position, uTime);
                        vec3 dir = normalize(position);
                        vec3 p = position + dir * n * uAmp;
                        // Same pulse displacement as the crystal — the nodes
                        // ride the zip and the echo exactly.
                        float ca = dot(dir, uPulseDir);
                        float nearW = exp(-pow(acos(clamp(ca, -1.0, 1.0)) / uPulseWidth, 2.0));
                        float antiW = exp(-pow(acos(clamp(-ca, -1.0, 1.0)) / (uPulseWidth * 1.8), 2.0));
                        p += uPulseDir * (nearW * uPulseAmp) - uPulseDir * (antiW * uAntiAmp * 0.5);
                        vPulse = nearW * max(0.0, uPulseAmp);
                        vec4 mv = modelViewMatrix * vec4(p, 1.0);
                        // Each module pulses on its own phase — and the node
                        // being zipped SWELLS and ignites mint, so the eye
                        // follows the point that reached for the pointer.
                        float pulse = 0.75 + 0.45 * sin(uTime * 0.9 + aSeed * 19.0);
                        float hot = 1.0 + clamp(vPulse * 2.6, 0.0, 1.4);
                        gl_PointSize = clamp((170.0 / -mv.z) * (0.5 + pulse * 0.3) * hot, 8.0, 26.0);
                        gl_Position = projectionMatrix * mv;
                    }
                `,
                fragmentShader: `
                    uniform vec3 uColorA;
                    uniform vec3 uColorB;
                    varying float vSeed;
                    varying float vPulse;
                    void main() {
                        float d = distance(gl_PointCoord, vec2(0.5));
                        float alpha = smoothstep(0.5, 0.08, d) * 0.85;
                        alpha *= 1.0 + clamp(vPulse * 2.0, 0.0, 1.0);
                        vec3 col = vSeed > 0.82 ? uColorB : uColorA;
                        col = mix(col, uColorB, clamp(vPulse * 2.2, 0.0, 1.0));
                        gl_FragColor = vec4(col, alpha);
                    }
                `,
            }));
            core.add(new THREE.Points(nodeGeo, nodeMat));

            // ── 2. Orbital rings — structure in motion ────────────────
            // Two tilted rings; the gradient (and its bright arcs) travels
            // around each ring as it spins in its own plane. Fluid energy
            // flowing through a rigid frame — the whole W8 thesis in one
            // element.
            const makeRing = (radius: number, segments: number) => {
                const g = new THREE.BufferGeometry();
                const p = new Float32Array(segments * 3);
                const tArr = new Float32Array(segments);
                for (let i = 0; i < segments; i++) {
                    const th = (i / segments) * Math.PI * 2;
                    p[i * 3] = Math.cos(th) * radius;
                    p[i * 3 + 1] = Math.sin(th) * radius;
                    p[i * 3 + 2] = 0;
                    tArr[i] = i / segments;
                }
                g.setAttribute('position', new THREE.BufferAttribute(p, 3));
                g.setAttribute('aT', new THREE.BufferAttribute(tArr, 1));
                return g;
            };
            const ringMat = () => clock(new THREE.ShaderMaterial({
                transparent: true,
                depthWrite: false,
                uniforms: {
                    // uTime is required by the renderFrame ticker (every
                    // material in `timed` gets uTime set each frame) even
                    // though the rings rotate at the object level — a
                    // missing uniform here once killed the whole rAF loop.
                    uTime: { value: 0 },
                    uColorA: { value: COLOR_MOSS },
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
                    uniform vec3 uColorA;
                    uniform vec3 uColorB;
                    varying float vT;
                    void main() {
                        vec3 col = mix(uColorA, uColorB, smoothstep(0.15, 0.85, vT));
                        // Two bright arcs per ring — energy in transit.
                        float arc = 0.5 + 0.5 * sin(vT * 6.28318 * 2.0);
                        float alpha = 0.16 + 0.24 * arc;
                        gl_FragColor = vec4(col, alpha);
                    }
                `,
            }));

            const ringGroupA = new THREE.Group();
            ringGroupA.rotation.set(THREE.MathUtils.degToRad(68), 0, THREE.MathUtils.degToRad(14));
            const ringLoopA = new THREE.LineLoop(makeRing(2.72, isSmall ? 120 : 180), ringMat());
            ringGroupA.add(ringLoopA);
            scene.add(ringGroupA);

            const ringGroupB = new THREE.Group();
            ringGroupB.rotation.set(THREE.MathUtils.degToRad(-62), 0, THREE.MathUtils.degToRad(-18));
            const ringLoopB = new THREE.LineLoop(makeRing(3.08, isSmall ? 120 : 180), ringMat());
            ringGroupB.add(ringLoopB);
            scene.add(ringGroupB);

            // ── 3. The constellation network — "we build systems" ──────
            // Nodes on an outer shell (evenly spread), each wired to its
            // two nearest neighbours: a literal system diagram that breathes
            // and slowly counter-rotates around the crystal.
            const NET_N = isSmall ? 16 : 26;
            const netPts: Array<{ x: number; y: number; z: number }> = [];
            const GOLDEN = Math.PI * (3 - Math.sqrt(5));
            for (let i = 0; i < NET_N; i++) {
                const y = 1 - 2 * (i + 0.5) / NET_N;
                const rr = Math.sqrt(Math.max(0, 1 - y * y));
                const th = i * GOLDEN;
                const shell = 3.75 + (i % 3) * 0.32;
                netPts.push({ x: Math.cos(th) * rr * shell, y: y * shell, z: Math.sin(th) * rr * shell });
            }
            const netEdges: Array<[number, number]> = [];
            const netEdgeSeen = new Set<string>();
            for (let i = 0; i < NET_N; i++) {
                // Two nearest neighbours by Euclidean distance.
                const near: Array<{ j: number; d: number }> = [];
                for (let j = 0; j < NET_N; j++) {
                    if (j === i) continue;
                    const dx = netPts[i].x - netPts[j].x, dy = netPts[i].y - netPts[j].y, dz = netPts[i].z - netPts[j].z;
                    near.push({ j, d: dx * dx + dy * dy + dz * dz });
                }
                near.sort((p, q) => p.d - q.d);
                for (const { j } of near.slice(0, 2)) {
                    const ek = i < j ? `${i}-${j}` : `${j}-${i}`;
                    if (!netEdgeSeen.has(ek)) { netEdgeSeen.add(ek); netEdges.push([i, j]); }
                }
            }
            const network = new THREE.Group();
            network.rotation.x = 0.2;
            scene.add(network);

            const netLineGeo = new THREE.BufferGeometry();
            const netLinePos = new Float32Array(netEdges.length * 6);
            netEdges.forEach(([aI, bI], k) => {
                netLinePos.set([netPts[aI].x, netPts[aI].y, netPts[aI].z, netPts[bI].x, netPts[bI].y, netPts[bI].z], k * 6);
            });
            netLineGeo.setAttribute('position', new THREE.BufferAttribute(netLinePos, 3));
            const netLineMat = new THREE.LineBasicMaterial({
                color: COLOR_EMERALD,
                transparent: true,
                opacity: 0.16,
            });
            network.add(new THREE.LineSegments(netLineGeo, netLineMat));

            const netNodeGeo = new THREE.BufferGeometry();
            const netNodePos = new Float32Array(NET_N * 3);
            const netSeeds = new Float32Array(NET_N);
            netPts.forEach((p, i) => netNodePos.set([p.x, p.y, p.z], i * 3));
            for (let i = 0; i < NET_N; i++) netSeeds[i] = Math.random();
            netNodeGeo.setAttribute('position', new THREE.BufferAttribute(netNodePos, 3));
            netNodeGeo.setAttribute('aSeed', new THREE.BufferAttribute(netSeeds, 1));
            const netNodeMat = clock(new THREE.ShaderMaterial({
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                uniforms: { uTime: { value: 0 } },
                vertexShader: `
                    attribute float aSeed;
                    uniform float uTime;
                    varying float vSeed;
                    void main() {
                        vSeed = aSeed;
                        vec3 p = position;
                        // The whole shell breathes — one slow radial swell.
                        p *= 1.0 + sin(uTime * 0.22 + aSeed * 6.0) * 0.035;
                        vec4 mv = modelViewMatrix * vec4(p, 1.0);
                        float pulse = 0.7 + 0.5 * sin(uTime * 0.8 + aSeed * 23.0);
                        // Clamped tight: constellation pinpoints, never orbs.
                        gl_PointSize = clamp((170.0 / -mv.z) * (0.42 + pulse * 0.28), 6.0, 16.0);
                        gl_Position = projectionMatrix * mv;
                    }
                `,
                fragmentShader: `
                    varying float vSeed;
                    void main() {
                        float d = distance(gl_PointCoord, vec2(0.5));
                        float alpha = smoothstep(0.5, 0.1, d) * 0.6;
                        vec3 col = vSeed > 0.78 ? vec3(0.851, 0.467, 0.024) : vec3(0.024, 0.588, 0.412);
                        gl_FragColor = vec4(col, alpha);
                    }
                `,
            }));
            network.add(new THREE.Points(netNodeGeo, netNodeMat));

            // ── W14: the pulse — a lattice point zips toward the pointer ──
            // Two damped springs drive one shared displacement (see the
            // shaders above): the NEAR spring pulls a patch of the crystal's
            // surface toward the pointer; the FAR spring echoes on the
            // antipode a beat later, softer — the fluid "opposite reaction"
            // the owner asked for. Underdamped on purpose: zip out, overshoot
            // back, one or two quiet after-swings, settle. Nothing snaps.
            let pulseAmp = 0, pulseVel = 0;
            let antiAmp = 0, antiVel = 0;
            let antiKickAt = Infinity;      // scene-time when the echo fires
            let antiKickPower = 0;
            let nextPulseAt = 2.2 + Math.random() * 1.4;   // first zip comes early
            let velCooldownUntil = 0;
            const SPRING_K = 26, SPRING_C = 4.0;           // near: lively
            const ANTI_K = 19, ANTI_C = 4.6;               // far: lazier, softer
            const dirWorld = new THREE.Vector3();
            const firePulse = (mx: number, my: number, power = 1) => {
                if (reducedMotion) return;
                // Direction from the crystal's centre toward the pointer on
                // its own plane, then into the core's OBJECT space — the
                // shaders compare against object-space positions and the
                // core turns slowly beneath the pulse.
                const aspect = host.clientWidth / Math.max(1, host.clientHeight);
                dirWorld.set(mx * 2.5 * aspect, my * 2.5, 4.4).normalize();
                core.updateMatrixWorld();
                const dirObj = core.worldToLocal(dirWorld.clone()).normalize();
                solidMat.uniforms.uPulseDir.value.copy(dirObj);
                wireMat.uniforms.uPulseDir.value.copy(dirObj);
                nodeMat.uniforms.uPulseDir.value.copy(dirObj);
                pulseVel += 2.6 * power;        // the zip OUT toward the pointer
                antiKickAt = time + 0.14;       // the echo, a beat behind
                antiKickPower = 0.55 * power;
            };

            // ── Pointer parallax (lerped, never jumpy) ────────────────
            let pointerX = 0, pointerY = 0, curX = 0, curY = 0;
            // W14 "the reactivity should include where the mouse is": the
            // handler tracks velocity and recency — a fast flick fires a zip
            // toward the pointer AT ONCE, and a quietly present pointer still
            // gets an occasional reach-out every few seconds (see the loop).
            let lastMoveAt = -99, lastMX = 0, lastMY = 0, lastMoveStamp = 0;
            const onPointerMove = (e: PointerEvent) => {
                const nx = (e.clientX / window.innerWidth) * 2 - 1;
                const ny = (e.clientY / window.innerHeight) * 2 - 1;
                const now = performance.now();
                if (lastMoveStamp > 0) {
                    const dtMove = Math.max(8, now - lastMoveStamp) / 1000;
                    const speed = Math.hypot(nx - lastMX, ny - lastMY) / dtMove; // NDC units/s
                    if (speed > 1.35 && time > 1.0 && time >= velCooldownUntil) {
                        firePulse(nx, ny, 0.9);
                        velCooldownUntil = time + 1.15;
                    }
                }
                lastMX = nx; lastMY = ny; lastMoveStamp = now;
                lastMoveAt = time;
                pointerX = nx; pointerY = ny;
            };
            window.addEventListener('pointermove', onPointerMove, { passive: true });

            // ── Visibility management ─────────────────────────────────
            let inView = true;
            const io = new IntersectionObserver((entries) => {
                inView = entries.some((en) => en.isIntersecting);
            }, { threshold: 0 });
            io.observe(host);
            const onVis = () => { inView = !document.hidden; };
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
            const BASE_TIME = 7.0; // a pleasing static pose for reduced motion
            let time = reducedMotion ? BASE_TIME : 0;
            // W10 edge volatility — 0 with the pointer centred (the relaxed
            // drift of W8), 1 at the screen rails. Drives time acceleration,
            // morph amplitude, parallax gain and the fresnel rim, so the
            // hero feels calm mid-screen and comes alive as you push out.
            let edge = 0;

            const renderFrame = () => {
                for (const m of timed) m.uniforms.uTime.value = time;
                curX += (pointerX - curX) * 0.045;
                curY += (pointerY - curY) * 0.045;
                const targetEdge = Math.min(1, Math.pow(Math.abs(curX), 1.25) * 1.12 + Math.abs(curY) * 0.15);
                edge += (targetEdge - edge) * 0.05;
                const amp = AMP * (1 + edge * 0.55);
                solidMat.uniforms.uAmp.value = amp;
                wireMat.uniforms.uAmp.value = amp;
                nodeMat.uniforms.uAmp.value = amp;
                solidMat.uniforms.uEdge.value = edge;
                camera.position.x = curX * (0.55 + edge * 0.5);
                camera.position.y = -curY * (0.38 + edge * 0.22);
                camera.lookAt(0, 0, 0);
                // The crystal turns slowly; a gentle wobble keeps it alive.
                // Continuity note: only time RATE and lerped terms vary with
                // edge — never a time multiplier — so nothing ever jumps.
                core.rotation.y = time * 0.05 + curX * (0.2 + edge * 0.22);
                core.rotation.x = Math.sin(time * 0.05) * 0.14 + curY * (0.12 + edge * 0.12);
                const breathe = 1 + Math.sin(time * 0.16) * 0.012;
                core.scale.setScalar(breathe);
                // Ring gradients travel in-plane; the frames hold their tilt.
                ringLoopA.rotation.z = time * 0.05;
                ringLoopB.rotation.z = -time * 0.042;
                ringGroupA.rotation.y = time * 0.026;
                ringGroupB.rotation.y = -time * 0.02;
                // The network counter-rotates around its subject.
                network.rotation.y = -time * 0.022;
                network.rotation.x = 0.2 + Math.sin(time * 0.06) * 0.05;
                renderer.render(scene, camera);
            };

            if (reducedMotion) {
                renderFrame(); // one static frame, no loop.
            } else {
                const loop = (now: number) => {
                    if (!running) { rafId = null; return; }
                    const dt = Math.min(0.05, (now - last) / 1000);
                    last = now;
                    if (inView) {
                        // W10: time itself runs faster near the rails — every
                        // time-driven motion in the scene accelerates together
                        // and decelerates back, continuously (no jumps).
                        time += dt * (1 + edge * 1.75);

                        // ── W14: the pulse engine ─────────────────────────
                        // 1) An occasional reach toward a present pointer —
                        //    only when the visitor is actually around.
                        if (time >= nextPulseAt) {
                            if (time - lastMoveAt < 5.5) firePulse(pointerX, pointerY, 1.0);
                            nextPulseAt = time + 2.6 + Math.random() * 2.2;
                        }
                        // 2) The far-side echo kicks a beat after the zip.
                        if (time >= antiKickAt) {
                            antiVel += 2.6 * antiKickPower;
                            antiKickAt = Infinity;
                        }
                        // 3) Semi-implicit Euler on both springs — the wave
                        //    stays fluid because the integration is stable
                        //    even at 30fps (dt is clamped above).
                        pulseVel += (-SPRING_K * pulseAmp - SPRING_C * pulseVel) * dt;
                        pulseAmp = Math.max(-0.9, Math.min(0.9, pulseAmp + pulseVel * dt));
                        antiVel += (-ANTI_K * antiAmp - ANTI_C * antiVel) * dt;
                        antiAmp = Math.max(-0.6, Math.min(0.6, antiAmp + antiVel * dt));
                        solidMat.uniforms.uPulseAmp.value = pulseAmp;
                        wireMat.uniforms.uPulseAmp.value = pulseAmp;
                        nodeMat.uniforms.uPulseAmp.value = pulseAmp;
                        solidMat.uniforms.uAntiAmp.value = antiAmp;
                        wireMat.uniforms.uAntiAmp.value = antiAmp;
                        nodeMat.uniforms.uAntiAmp.value = antiAmp;

                        renderFrame();
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
                solidGeo.dispose();
                solidMat.dispose();
                wireGeo.dispose();
                wireMat.dispose();
                nodeGeo.dispose();
                nodeMat.dispose();
                ringLoopA.geometry.dispose();
                ringLoopB.geometry.dispose();
                (ringLoopA.material as import('three').Material).dispose();
                (ringLoopB.material as import('three').Material).dispose();
                netLineGeo.dispose();
                netLineMat.dispose();
                netNodeGeo.dispose();
                netNodeMat.dispose();
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

export default MorphScene;
