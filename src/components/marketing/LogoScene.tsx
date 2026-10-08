import React, { useEffect, useRef } from 'react';

/**
 * LogoScene — W9 "the living page": the PracticePro mark ASSEMBLES.
 *
 * Owner direction: when the visitor reaches "What can we build for you?",
 * the logo should pop up in 3D — and the squares it forms ride down the
 * rest of the page. This scene is that moment:
 *
 *   1. The mark's three stacked layers (the logo's white blocks at 60%,
 *      80% and 100% presence) fly in and stack — a system being built.
 *   2. The green P rises out of the top layer with an emissive settle.
 *   3. Small brand squares peel off the assembled mark and stream
 *      downward, out of the stage — the modules that become the rest of
 *      the page (the SystemSquares layer carries them on below).
 *
 * The geometry is drawn from the actual logo SVG (public/logo.svg): the
 * three block rectangles and the P path (outer contour + counter hole)
 * are reproduced 1:1 in logo units, so the 3D mark IS the mark.
 *
 * Engineering (carried over from MorphScene): three.js dynamically
 * imported into its own lazy chunk; DPR caps; pauses offscreen and on
 * hidden tabs; one static assembled frame under prefers-reduced-motion;
 * silent CSS fallback when WebGL is unavailable.
 */
const LogoScene: React.FC<{ className?: string }> = ({ className = '' }) => {
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
                return; // CSS fallback shows through.
            }
            if (disposed || !host.isConnected) return;

            let renderer: import('three').WebGLRenderer;
            try {
                renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
            } catch {
                return; // CSS fallback.
            }

            const isSmall = host.clientWidth < 480;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.5 : 1.75));
            renderer.setSize(host.clientWidth, host.clientHeight);
            renderer.domElement.style.width = '100%';
            renderer.domElement.style.height = '100%';
            renderer.domElement.style.display = 'block';
            host.appendChild(renderer.domElement);

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(38, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 60);
            camera.position.set(0, 0.15, 9.4);

            // ── Lights — a product-shot booth: white key, brand fills. ──
            scene.add(new THREE.AmbientLight(0xffffff, 0.85));
            const key = new THREE.DirectionalLight(0xffffff, 1.25);
            key.position.set(4, 7, 6);
            scene.add(key);
            const emeraldFill = new THREE.PointLight(0x34D399, 26, 40);
            emeraldFill.position.set(-6, -2, 5);
            scene.add(emeraldFill);
            const amberRim = new THREE.PointLight(0xF59E0B, 14, 40);
            amberRim.position.set(6.5, 4, 2.5);
            scene.add(amberRim);

            // ── Geometry helpers ─────────────────────────────────────
            /** A rounded rectangle centred on the origin (logo units). */
            const roundedRectShape = (w: number, h: number, r: number) => {
                const s = new THREE.Shape();
                const x = -w / 2, y = -h / 2;
                s.moveTo(x + r, y);
                s.lineTo(x + w - r, y);
                s.quadraticCurveTo(x + w, y, x + w, y + r);
                s.lineTo(x + w, y + h - r);
                s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
                s.lineTo(x + r, y + h);
                s.quadraticCurveTo(x, y + h, x, y + h - r);
                s.lineTo(x, y + r);
                s.quadraticCurveTo(x, y, x + r, y);
                return s;
            };

            /**
             * The P, traced from public/logo.svg (64-unit space, Y flipped
             * for three): outer contour + the counter as a hole.
             */
            const pShape = new THREE.Shape();
            pShape.moveTo(-12, 20);                                   // M20 12
            pShape.lineTo(-12, -2);                                   // V34
            pShape.lineTo(-6, -2);                                    // H26
            pShape.lineTo(-6, 6);                                     // V26
            pShape.lineTo(6, 6);                                      // H38
            pShape.bezierCurveTo(10, 6, 12, 9, 12, 14);               // C42 26 44 23 44 18
            pShape.bezierCurveTo(12, 19, 10, 22, 6, 22);              // C44 13 42 10 38 10
            pShape.lineTo(-12, 22);                                   // H20
            pShape.closePath();
            const counter = new THREE.Path();
            counter.moveTo(-6, 16);                                   // M26 16
            counter.lineTo(6, 16);                                    // H38
            counter.bezierCurveTo(7.5, 16, 8, 14.5, 8, 14);           // C39.5 16 40 17.5 40 18
            counter.bezierCurveTo(8, 13.5, 7.5, 12, 6, 12);           // C40 18.5 39.5 20 38 20
            counter.lineTo(-6, 12);                                   // H26
            counter.lineTo(-6, 16);                                   // V16
            counter.closePath();
            pShape.holes.push(counter);

            const S = 0.056; // logo units → world units
            const logoGroup = new THREE.Group();
            logoGroup.scale.setScalar(S);
            scene.add(logoGroup);

            type FlyIn = {
                mesh: import('three').Mesh;
                mat: import('three').MeshStandardMaterial;
                delay: number;
                fromPos: [number, number, number];
                fromRot: [number, number, number];
                toPos: [number, number, number];
                restOpacity: number;
            };

            const slabs: FlyIn[] = [];
            const slabSpecs: Array<{
                w: number; h: number; y: number; depth: number; opacity: number;
                delay: number; fromPos: [number, number, number]; fromRot: [number, number, number];
            }> = [
                // Bottom layer — widest, thinnest, 60% presence.
                { w: 44, h: 10, y: -19, depth: 2.6, opacity: 0.62, delay: 0.10, fromPos: [-26, -34, -30], fromRot: [1.15, -0.85, 0.55] },
                // Middle layer — 80% presence.
                { w: 40, h: 10, y: -9, depth: 2.8, opacity: 0.84, delay: 0.62, fromPos: [24, -30, -26], fromRot: [-0.95, 0.9, -0.5] },
                // Top layer — the tall block, full presence.
                { w: 36, h: 28, y: 10, depth: 3.2, opacity: 1.0, delay: 1.14, fromPos: [0, 34, -34], fromRot: [0.75, 0.35, -0.65] },
            ];
            for (const spec of slabSpecs) {
                const geo = new THREE.ExtrudeGeometry(roundedRectShape(spec.w, spec.h, 2.4), {
                    depth: spec.depth, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 2,
                });
                geo.translate(0, 0, -spec.depth / 2);
                const mat = new THREE.MeshStandardMaterial({
                    color: 0xffffff, transparent: true, opacity: 0, roughness: 0.3, metalness: 0.06,
                });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(...spec.fromPos);
                mesh.rotation.set(...spec.fromRot);
                logoGroup.add(mesh);
                slabs.push({ mesh, mat, delay: spec.delay, fromPos: spec.fromPos, fromRot: spec.fromRot, toPos: [0, spec.y, 0], restOpacity: spec.opacity });
            }

            // The P — brand green, rising out of the top layer.
            const pGeo = new THREE.ExtrudeGeometry(pShape, {
                depth: 2.0, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 2,
            });
            const pMat = new THREE.MeshStandardMaterial({
                color: 0x16A34A, emissive: 0x16A34A, emissiveIntensity: 0.32,
                transparent: true, opacity: 0, roughness: 0.24, metalness: 0.12,
            });
            const pMesh = new THREE.Mesh(pGeo, pMat);
            pMesh.position.set(0, 10, 0.4); // centred on the top slab, low → rises
            logoGroup.add(pMesh);
            const P_DELAY = 1.95, P_DUR = 0.85;

            // ── The peeling squares — modules streaming down the page ──
            interface Square {
                mesh: import('three').Mesh;
                mat: import('three').MeshBasicMaterial;
                vy: number; swayA: number; swayW: number; phase: number;
                spin: number; life: number; ttl: number; size: number;
            }
            const SQUARE_COLORS = [0x16A34A, 0x059669, 0xD97706, 0x34D399];
            const squares: Square[] = [];
            const SQ_N = isSmall ? 9 : 13;
            const sqGeoCache = new Map<number, import('three').PlaneGeometry>();
            const sqGeo = (size: number) => {
                let g = sqGeoCache.get(size);
                if (!g) { g = new THREE.PlaneGeometry(size, size); sqGeoCache.set(size, g); }
                return g;
            };
            const spawnSquare = (sq: Square, first = false) => {
                sq.size = 0.16 + Math.random() * 0.3;
                sq.mesh.geometry = sqGeo(Number(sq.size.toFixed(2)));
                sq.mat.color.setHex(SQUARE_COLORS[Math.floor(Math.random() * SQUARE_COLORS.length)]);
                sq.mesh.position.set((Math.random() - 0.5) * 2.4, first ? -0.4 - Math.random() * 4.4 : -1.55, (Math.random() - 0.5) * 1.4);
                sq.vy = -(0.55 + Math.random() * 0.85);
                sq.swayA = 0.1 + Math.random() * 0.35;
                sq.swayW = 0.6 + Math.random() * 1.2;
                sq.phase = Math.random() * Math.PI * 2;
                sq.spin = (Math.random() - 0.5) * 1.6;
                sq.ttl = 0;
                sq.mat.opacity = 0;
            };
            for (let i = 0; i < SQ_N; i++) {
                const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide });
                const mesh = new THREE.Mesh(sqGeo(0.2), mat);
                const sq: Square = { mesh, mat, vy: 0, swayA: 0, swayW: 0, phase: 0, spin: 0, life: 0, ttl: 0, size: 0.2 };
                spawnSquare(sq, true);
                scene.add(mesh);
                squares.push(sq);
            }

            // ── Easing + timeline helpers ────────────────────────────
            const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
            const easeOutBack = (x: number) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
            const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
            /** Progress of a [delay, delay+dur] window at time t. */
            const win = (t: number, delay: number, dur: number) => clamp01((t - delay) / dur);

            // ── Pointer parallax (lerped) ────────────────────────────
            let pointerX = 0, pointerY = 0, curX = 0, curY = 0;
            const onPointerMove = (e: PointerEvent) => {
                pointerX = (e.clientX / window.innerWidth) * 2 - 1;
                pointerY = (e.clientY / window.innerHeight) * 2 - 1;
            };
            window.addEventListener('pointermove', onPointerMove, { passive: true });

            // ── Start gate: the assembly begins when the stage is well
            //    inside the viewport (the logo "pops up" on arrival). ──
            let started = reducedMotion; // reduced motion: assemble instantly.
            let inView = true;
            const io = new IntersectionObserver((entries) => {
                inView = entries.some((en) => en.isIntersecting);
                if (!started && entries.some((en) => en.intersectionRatio >= 0.35)) started = true;
            }, { threshold: [0, 0.35, 0.6] });
            io.observe(host);
            const onVis = () => { inView = !document.hidden; };
            document.addEventListener('visibilitychange', onVis);

            const ro = new ResizeObserver(() => {
                const w = host.clientWidth, h = host.clientHeight;
                if (w === 0 || h === 0) return;
                renderer.setSize(w, h);
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
            });
            ro.observe(host);

            // ── The frame ────────────────────────────────────────────
            let rafId: number | null = null;
            let running = true;
            let last = performance.now();
            let t = 0; // seconds since the assembly began
            const renderFrame = () => {
                // Slabs fly in and stack.
                for (const s of slabs) {
                    const p = win(t, s.delay, 0.95);
                    const e = easeOutCubic(p);
                    s.mesh.position.set(
                        s.fromPos[0] + (s.toPos[0] - s.fromPos[0]) * e,
                        s.fromPos[1] + (s.toPos[1] - s.fromPos[1]) * e,
                        s.fromPos[2] + (s.toPos[2] - s.fromPos[2]) * e,
                    );
                    s.mesh.rotation.set(s.fromRot[0] * (1 - e), s.fromRot[1] * (1 - e), s.fromRot[2] * (1 - e));
                    s.mat.opacity = s.restOpacity * clamp01(p * 1.6);
                }
                // The P rises out of the top layer with a settle pulse.
                const pp = win(t, P_DELAY, P_DUR);
                const ppE = easeOutBack(pp);
                pMesh.position.z = 0.4 + 1.35 * ppE;
                pMat.opacity = pp;
                pMat.emissiveIntensity = 0.32 + Math.sin(t * 1.6) * 0.08 * pp + (pp >= 1 ? 0 : 0.35 * (1 - Math.abs(pp - 0.75) * 4) * 0.5);
                // The assembled mark: gentle turn + float + pointer tilt.
                const settle = easeOutCubic(win(t, 0.1, 2.7));
                logoGroup.rotation.y = (1 - settle) * -0.62 + settle * (0.16 + Math.sin(t * 0.3) * 0.1) + curX * 0.22;
                logoGroup.rotation.x = (1 - settle) * 0.42 + settle * (0.1 + Math.sin(t * 0.24) * 0.05) + curY * 0.14;
                logoGroup.position.y = Math.sin(t * 0.5) * 0.14 + 0.18;
                // The peeling squares ride down (only after assembly).
                if (t > P_DELAY + 0.35) {
                    for (const sq of squares) {
                        sq.ttl += 1 / 60;
                        sq.mesh.position.y += sq.vy / 60;
                        sq.mesh.position.x = (sq.mesh.position as import('three').Vector3).x; // no-op for type clarity
                        sq.mesh.position.x += Math.sin(t * sq.swayW + sq.phase) * sq.swayA * (1 / 60);
                        sq.mesh.rotation.z += sq.spin / 60;
                        const fade = sq.ttl < 0.5 ? sq.ttl / 0.5 : sq.mesh.position.y < -3.1 ? Math.max(0, (sq.mesh.position.y + 4.3) / 1.2) : 1;
                        sq.mat.opacity = fade * 0.75;
                        if (sq.mesh.position.y < -4.3) spawnSquare(sq);
                    }
                } else {
                    for (const sq of squares) sq.mat.opacity = 0;
                }
                renderer.render(scene, camera);
            };

            if (reducedMotion) {
                t = 6; renderFrame(); // fully assembled, one static frame.
            } else {
                const loop = (now: number) => {
                    if (!running) { rafId = null; return; }
                    const dt = Math.min(0.05, (now - last) / 1000);
                    last = now;
                    if (inView) {
                        if (started) t += dt;
                        curX += (pointerX - curX) * 0.055;
                        curY += (pointerY - curY) * 0.055;
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
                for (const s of slabs) { s.mesh.geometry.dispose(); s.mat.dispose(); }
                pGeo.dispose();
                pMat.dispose();
                for (const sq of squares) sq.mat.dispose();
                for (const g of sqGeoCache.values()) g.dispose();
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

export default LogoScene;
