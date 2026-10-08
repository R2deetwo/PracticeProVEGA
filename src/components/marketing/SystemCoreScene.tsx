import React, { useEffect, useRef } from 'react';

/**
 * SystemCoreScene — W13 "the system core" (What we do).
 *
 * Owner direction (after the W12 review): NO mark in this section at all, and
 * a real 3D rendering instead. The W12 circuit-trace overlay also drew its
 * lines OVER the section's text — that class of bug is now structurally
 * impossible: everything this scene draws lives INSIDE its own canvas, a
 * plain block in the document flow. Nothing is portaled, nothing is fixed,
 * nothing can ever cross a heading again.
 *
 * The new story: a faceted core — the engine — with SEVEN glass modules
 * orbiting it, one for each capability card below (systems, integrations,
 * portals, payments, AI, workflow, hosting). Energy links pulse from the
 * core to every module: a literal, literal picture of "we build systems".
 * On first scroll-in the modules spiral home from wide orbit; after that
 * the system simply runs — modules drift on their orbits, each turning on
 * its own axis, links carrying light, the whole cluster leaning gently
 * toward the pointer.
 *
 * Engineering notes (same contract as MorphScene, the hero the owner kept):
 * - three.js is imported DYNAMICALLY so it lands in its own lazy chunk;
 *   visitors to /vega, /atrium or the logged-in app never download it.
 * - The scene pauses when offscreen or the tab is hidden; one static,
 *   fully-assembled frame under prefers-reduced-motion; a quiet CSS
 *   fallback (see .w13-fallback in index.css) shows if WebGL is missing.
 * - No scroll-linked math, no measured DOM geometry, no full-page
 *   overlays: the only inputs are time and the pointer.
 */

/** One module per capability card — keep in sync with WHAT_WE_DO. */
const MODULE_COUNT = 7;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

/** Deterministic per-module seeds — the composition is authored, not random. */
const ORBIT_RADIUS = [1.58, 2.14, 1.86, 2.44, 1.98, 2.58, 2.22];
const ORBIT_SPEED = [0.150, 0.132, 0.170, 0.118, 0.158, 0.108, 0.140];
const ORBIT_PHASE = [0.0, 2.35, 4.10, 1.15, 5.30, 3.20, 0.65];
const MODULE_SCALE = [1.14, 0.90, 1.00, 0.86, 1.06, 0.94, 0.90];
const SETTLE_SECONDS = 2.0;

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
            const COLOR_AMBER = new THREE.Color('#D97706');

            // ── The cluster: everything orbits inside this tilted group.
            const TILT_X = 0.50;
            const cluster = new THREE.Group();
            cluster.rotation.x = TILT_X;
            scene.add(cluster);

            // ── 1. The core — a faceted engine, moss→emerald with an
            //       amber rim. Opaque, so modules and links pass behind it
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
                    uColorC: { value: COLOR_AMBER },
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

            // ── 4. The seven modules. Each is a glass cube with bright
            //       edges, riding its own pivot on the shared tilted plane.
            //       pivot spins → holder rides the orbit → cube bobs and
            //       turns on its own axes.
            type Module = {
                pivot: import('three').Object3D;
                holder: import('three').Object3D;
                glass: import('three').Mesh;
                edges: import('three').LineSegments;
                glassMat: import('three').ShaderMaterial;
                edgeMat: import('three').LineBasicMaterial;
                radius: number;
                scale: number;
                spin: number;
                delay: number;
            };
            const modules: Module[] = [];

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

            const disposables: Array<{ dispose: () => void }> = [coreGeo, coreMat, haloGeo, haloMat, ringA.line.geometry, ringA.mat, ringB.line.geometry, ringB.mat];

            for (let i = 0; i < MODULE_COUNT; i++) {
                const pivot = new THREE.Object3D();
                pivot.rotation.y = ORBIT_PHASE[i];
                cluster.add(pivot);

                const holder = new THREE.Object3D();
                pivot.add(holder);

                const boxGeo = new THREE.BoxGeometry(0.56, 0.56, 0.56);
                const glassMat = new THREE.ShaderMaterial({
                    transparent: true,
                    depthWrite: false,
                    uniforms: {
                        uColorA: { value: COLOR_MOSS },
                        uColorB: { value: COLOR_EMERALD },
                        uColorC: { value: COLOR_AMBER },
                        uFade: { value: 0 },
                    },
                    vertexShader: glassVertex,
                    fragmentShader: glassFragment,
                });
                const glass = new THREE.Mesh(boxGeo, glassMat);
                glass.scale.setScalar(MODULE_SCALE[i]);
                holder.add(glass);

                const edgeGeo = new THREE.EdgesGeometry(boxGeo);
                const edgeMat = new THREE.LineBasicMaterial({
                    color: COLOR_MOSS,
                    transparent: true,
                    opacity: 0,
                    depthWrite: false,
                });
                const edges = new THREE.LineSegments(edgeGeo, edgeMat);
                edges.scale.setScalar(MODULE_SCALE[i]);
                holder.add(edges);

                disposables.push(boxGeo, glassMat, edgeGeo, edgeMat);
                modules.push({
                    pivot, holder, glass, edges, glassMat, edgeMat,
                    radius: ORBIT_RADIUS[i],
                    scale: MODULE_SCALE[i],
                    spin: 0.9 + i * 0.13,
                    delay: 0.08 + i * 0.055,
                });
            }

            // ── 5. The energy links — core → module, in WORLD space (they
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
                        uColorB: { value: COLOR_AMBER },
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

            const renderFrame = () => {
                // Settle: each module has its own slice of the timeline.
                const eCore = easeOutCubic(clamp01(settleT / 0.55));
                const linkFade = clamp01((settleT - 0.35) / 0.45);

                // Core + halo.
                core.scale.setScalar(0.55 + 0.45 * eCore);
                core.rotation.y = time * 0.22;
                core.rotation.x = Math.sin(time * 0.17) * 0.22;
                haloMat.uniforms.uFade.value = eCore;
                halo.scale.setScalar(0.8 + 0.2 * eCore);
                ringA.mat.opacity = ringA.baseOpacity * clamp01((settleT - 0.15) / 0.5);
                ringB.mat.opacity = ringB.baseOpacity * clamp01((settleT - 0.25) / 0.5);

                // Modules: spiral home from wide orbit, then live there.
                for (let i = 0; i < MODULE_COUNT; i++) {
                    const m = modules[i];
                    const span = clamp01((settleT - m.delay) / Math.max(0.2, 1 - m.delay));
                    const e = easeOutCubic(span);
                    // 2.55× radius at e=0 → 1× at e=1: a clean spiral-in.
                    const dist = m.radius * (1 + (1 - e) * 1.55);
                    m.holder.position.set(dist, 0, 0);
                    const bob = Math.sin(time * 0.7 + i * 1.3) * 0.075;
                    m.glass.position.y = bob;
                    m.edges.position.y = bob;
                    m.glassMat.uniforms.uFade.value = e;
                    m.edgeMat.opacity = 0.85 * e;
                    m.pivot.rotation.y = ORBIT_PHASE[i] + time * ORBIT_SPEED[i];
                    m.glass.rotation.x = time * 0.18 + i * 0.4;
                    m.glass.rotation.y = time * 0.23 + i * 0.7;
                    m.edges.rotation.copy(m.glass.rotation);
                }

                // Cluster: gentle auto-turn + lerped pointer lean.
                curX += (pointerX - curX) * 0.05;
                curY += (pointerY - curY) * 0.05;
                cluster.rotation.y = time * 0.045 + curX * 0.16;
                cluster.rotation.x = TILT_X + curY * 0.10;
                camera.position.x = curX * 0.30;
                camera.position.y = -curY * 0.16;
                camera.lookAt(0, 0, 0);

                // Links: world-space, from the core's surface to each
                // module's near face — recomputed every frame.
                cluster.updateMatrixWorld(true);
                for (let i = 0; i < links.length; i++) {
                    const lk = links[i];
                    const m = lk.module;
                    m.glass.getWorldPosition(tmpV);
                    const dirX = tmpV.x, dirY = tmpV.y, dirZ = tmpV.z;
                    const len = Math.max(0.0001, Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ));
                    const ux = dirX / len, uy = dirY / len, uz = dirZ / len;
                    const startR = 0.60;                                  // just off the core's surface
                    const endR = len - (0.40 * m.scale + 0.06);           // just off the module's face
                    lk.attr.setXYZ(0, ux * startR, uy * startR, uz * startR);
                    lk.attr.setXYZ(1, ux * endR, uy * endR, uz * endR);
                    lk.attr.needsUpdate = true;
                    lk.mat.uniforms.uTime.value = time;
                    lk.mat.uniforms.uFade.value = linkFade;
                }

                renderer.render(scene, camera);
            };

            if (reducedMotion) {
                // One static, fully-assembled frame — the wow stays, the
                // movement goes.
                settleT = 1;
                time = 4.2;
                renderFrame();
            } else {
                const loop = (now: number) => {
                    if (!running) { rafId = null; return; }
                    const dt = Math.min(0.05, (now - last) / 1000);
                    last = now;
                    if (inView) {
                        time += dt;
                        if (settleStarted && settleT < 1) {
                            settleT = Math.min(1, settleT + dt / SETTLE_SECONDS);
                        }
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
