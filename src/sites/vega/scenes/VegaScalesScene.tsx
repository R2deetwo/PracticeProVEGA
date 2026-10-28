import React, { useEffect, useRef } from 'react';

/**
 * VegaScalesScene — /vega's signature 3D moment: THE BALANCE.
 *
 * The practice's own instrument, drafted in pure geometry: a hairline
 * balance beam on a pyramid fulcrum, two pans hanging level on three
 * chains each (they stay level whatever the beam does — hanging pans
 * are honest), a plumb line through the pivot, and two dark-bronze
 * gimbal rings precessing slowly around the whole. No coin, no emblem —
 * an INSTRUMENT, the register of measured counsel.
 *
 * It LIVES: the beam runs on a damped spring — the pointer's horizontal
 * position sets the tilt target, and on release the beam overshoots
 * once, gently, and settles back to equilibrium. Idle, it breathes in a
 * slow ±2.5° sway so it is never dead. The entrance plays the story in
 * miniature: the instrument arrives off-balance and rights itself.
 *
 * Engineering notes (the MorphScene disciplines, followed exactly):
 * - three.js is imported DYNAMICALLY so it lands in the shared lazy
 *   chunk: visitors to /, /atrium or the logged-in app never download it.
 * - Thin metal needs reflections: a tiny procedural studio environment
 *   (gradient dome + warm softboxes) is baked through PMREMGenerator —
 *   core three only, no addons, no network.
 * - Pauses when offscreen or the tab is hidden; one composed static
 *   frame under prefers-reduced-motion; the SVG fallback shows until
 *   the first frame renders (and forever if WebGL is unavailable).
 * - All per-frame updates are transform-only (position / rotation /
 *   quaternion) — no geometry rebuilds, no allocations in the loop.
 */

/* ── Geometry constants (instrument proportions) ────────────────────────── */
const BEAM_HALF = 1.32;      // beam half-length (chain anchors at the ends)
const PAN_DROP = 0.98;       // chain length: beam end → pan ring plane
const PAN_R = 0.5;           // pan ring radius (a level torus, not a dish)
const GIMBAL_OUTER = 2.06;   // outer precessing ring
const GIMBAL_INNER = 1.7;    // inner precessing ring (counter-rotating)
const PLUMB_BOTTOM = -1.92;  // the plumb bob's rest depth

export const VegaScalesScene: React.FC<{ className?: string }> = ({ className = '' }) => {
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
                return; // no three — the SVG fallback stays.
            }
            if (disposed || !host.isConnected) return;

            // ── WebGL availability ────────────────────────────────────
            let renderer: import('three').WebGLRenderer;
            try {
                renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            } catch {
                return; // fallback stays.
            }

            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
            renderer.setSize(host.clientWidth, Math.max(1, host.clientHeight));
            renderer.domElement.style.width = '100%';
            renderer.domElement.style.height = '100%';
            renderer.domElement.style.display = 'block';
            host.appendChild(renderer.domElement);

            // ── The studio environment (hairline metal needs gleam) ───
            // A tiny procedural dome — dark roast above and below, one
            // warm studio band at the equator — plus three softboxes,
            // baked through PMREM. Core three only.
            const envScene = new THREE.Scene();
            const domeCanvas = document.createElement('canvas');
            domeCanvas.width = 16; domeCanvas.height = 256;
            const dctx = domeCanvas.getContext('2d')!;
            const grad = dctx.createLinearGradient(0, 0, 0, 256);
            grad.addColorStop(0.0, '#241609');   // top — dark roast
            grad.addColorStop(0.34, '#f3a66a');  // the warm studio band
            grad.addColorStop(0.46, '#7a4a28');  // falloff
            grad.addColorStop(1.0, '#1c1108');   // bottom — espresso
            dctx.fillStyle = grad;
            dctx.fillRect(0, 0, 16, 256);
            const domeTex = new THREE.CanvasTexture(domeCanvas);
            domeTex.mapping = THREE.EquirectangularReflectionMapping;
            domeTex.colorSpace = THREE.SRGBColorSpace;
            const dome = new THREE.Mesh(
                new THREE.SphereGeometry(20, 24, 24),
                new THREE.MeshBasicMaterial({ map: domeTex, side: THREE.BackSide })
            );
            envScene.add(dome);
            const softbox = (x: number, y: number, z: number, w: number, h: number, c: number) => {
                const m = new THREE.Mesh(
                    new THREE.PlaneGeometry(w, h),
                    new THREE.MeshBasicMaterial({ color: c })
                );
                m.position.set(x, y, z);
                m.lookAt(0, 0, 0);
                envScene.add(m);
            };
            softbox(6, 7, 5, 7, 5, 0xffe7cf);    // key softbox — warm white
            softbox(-7, 3, 3, 5, 4, 0xe8b48e);   // warm sand fill (R37 claret-bronze studio)
            softbox(-3, -2, -7, 6, 4, 0x5e2a1a); // claret kicker from behind

            const pmrem = new THREE.PMREMGenerator(renderer);
            const envRT = pmrem.fromScene(envScene, 0.06);
            const scene = new THREE.Scene();
            scene.environment = envRT.texture;

            // ── Camera ────────────────────────────────────────────────
            const camera = new THREE.PerspectiveCamera(
                38, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 60
            );
            camera.position.set(0, 0.32, 6.9);
            camera.lookAt(0, -0.08, 0);

            // ── Materials ─────────────────────────────────────────────
            const gilt = new THREE.MeshStandardMaterial({
                color: 0x8e3a28,        // R37: claret bronze — the instrument's metal
                metalness: 0.92,
                roughness: 0.26,
                envMapIntensity: 1.45,
            });
            const bronze = new THREE.MeshStandardMaterial({
                color: 0x8a4a24,        // dark bronze — the rings recede
                metalness: 0.9,
                roughness: 0.34,
                envMapIntensity: 1.15,
            });
            const hairMat = new THREE.MeshStandardMaterial({
                color: 0xd08a62,        // bright bronze for chains + plumb
                metalness: 0.85,
                roughness: 0.35,
                envMapIntensity: 1.3,
            });

            // Every mesh + material created below is collected here so
            // dispose can walk it once (no leaks, no double-dispose).
            const geos: Array<import('three').BufferGeometry> = [];
            const mats: Array<import('three').Material> = [gilt, bronze, hairMat];
            const track = <T extends import('three').BufferGeometry>(g: T): T => {
                geos.push(g); return g;
            };

            // ── The instrument ────────────────────────────────────────
            const instrument = new THREE.Group();
            scene.add(instrument);

            // Two precessing gimbal rings — dark bronze, slow, opposite
            // directions. Each ring sits in its own pivot so the pivot's
            // Y-rotation precesses the tilt around the vertical axis.
            const ringPivots: Array<{ pivot: import('three').Group; speed: number }> = [];
            const addGimbal = (radius: number, tube: number, tilt: number, speed: number) => {
                const pivot = new THREE.Group();
                const ring = new THREE.Mesh(track(new THREE.TorusGeometry(radius, tube, 10, 128)), bronze);
                ring.rotation.x = tilt;
                pivot.add(ring);
                instrument.add(pivot);
                ringPivots.push({ pivot, speed });
            };
            addGimbal(GIMBAL_OUTER, 0.016, 1.12, 0.11);   // leans back, precesses forward
            addGimbal(GIMBAL_INNER, 0.013, 2.02, -0.075); // steeper, counter-precesses

            // The beam assembly — beam, fulcrum, pivot, anchors. The
            // chains + pans live in the same local space and are updated
            // per-frame from the beam's angle.
            const beamAssembly = new THREE.Group();
            instrument.add(beamAssembly);

            const beam = new THREE.Mesh(
                track(new THREE.BoxGeometry(BEAM_HALF * 2, 0.055, 0.055)),
                gilt
            );
            beamAssembly.add(beam);

            // The fulcrum — a pyramid pointing down through the pivot.
            const fulcrum = new THREE.Mesh(
                track(new THREE.ConeGeometry(0.17, 0.4, 4)),
                gilt
            );
            fulcrum.rotation.x = Math.PI;   // point down
            fulcrum.rotation.y = Math.PI / 4; // square to the beam
            fulcrum.position.y = -0.2;
            beamAssembly.add(fulcrum);

            // The pivot sphere — where the beam turns.
            const pivot = new THREE.Mesh(track(new THREE.SphereGeometry(0.075, 20, 20)), gilt);
            beamAssembly.add(pivot);

            // Beam-end anchor spheres (the chains' upper termini).
            const anchorGeo = track(new THREE.SphereGeometry(0.05, 14, 14));
            const anchors: Array<import('three').Mesh> = [];
            for (const sx of [-1, 1]) {
                const a = new THREE.Mesh(anchorGeo, gilt);
                a.position.set(sx * BEAM_HALF, 0, 0);
                beamAssembly.add(a);
                anchors.push(a);
            }

            // The plumb line — verticality, made physical. A hairline
            // from below the fulcrum to a small bob, always plumb.
            // Runs from y = -0.42 (clear of the fulcrum) to PLUMB_BOTTOM.
            const plumbLen = -PLUMB_BOTTOM - 0.42;
            const plumbLine = new THREE.Mesh(
                track(new THREE.CylinderGeometry(0.008, 0.008, plumbLen, 6)),
                hairMat
            );
            plumbLine.position.y = (PLUMB_BOTTOM - 0.42) / 2;
            beamAssembly.add(plumbLine);
            const plumbBob = new THREE.Mesh(track(new THREE.SphereGeometry(0.062, 16, 16)), hairMat);
            plumbBob.position.y = PLUMB_BOTTOM;
            beamAssembly.add(plumbBob);

            // ── The pans — level rings on three chains each ───────────
            // A chain is a hairline cylinder between two points; a small
            // helper orients the cylinder along the segment. The pans
            // never rotate — hanging pans stay level (they are honest).
            const chainGeo = track(new THREE.CylinderGeometry(0.0085, 0.0085, 1, 5));
            chainGeo.translate(0, 0.5, 0);   // base at origin → scale to length
            const UP = new THREE.Vector3(0, 1, 0);
            const tmpA = new THREE.Vector3();
            const tmpB = new THREE.Vector3();
            const tmpDir = new THREE.Vector3();
            const tmpQ = new THREE.Quaternion();

            type Pan = {
                ring: import('three').Mesh;
                chains: Array<import('three').Mesh>;
                rimAngles: Array<number>;
                side: number;
            };
            const pans: Pan[] = [];
            const panRingGeo = track(new THREE.TorusGeometry(PAN_R, 0.026, 10, 72));
            const chainCount = 3;
            for (const side of [-1, 1]) {
                const ring = new THREE.Mesh(panRingGeo, gilt);
                ring.rotation.x = Math.PI / 2;   // level — horizontal ring
                beamAssembly.add(ring);
                const chains: Array<import('three').Mesh> = [];
                const rimAngles: Array<number> = [];
                for (let i = 0; i < chainCount; i++) {
                    const c = new THREE.Mesh(chainGeo, hairMat);
                    beamAssembly.add(c);
                    chains.push(c);
                    // Three rim points evenly spaced; one faces the
                    // viewer (+z), two sit behind — a triangle of chains.
                    rimAngles.push(Math.PI / 2 + (i * 2 * Math.PI) / chainCount);
                }
                pans.push({ ring, chains, rimAngles, side });
            }

            // Place a chain cylinder from A to B (transform-only update).
            const stretchChain = (
                mesh: import('three').Mesh,
                ax: number, ay: number, az: number,
                bx: number, by: number, bz: number
            ) => {
                tmpA.set(ax, ay, az);
                tmpB.set(bx, by, bz);
                tmpDir.subVectors(tmpB, tmpA);
                const len = tmpDir.length();
                mesh.position.copy(tmpA);
                mesh.scale.set(1, len, 1);
                tmpDir.normalize();
                tmpQ.setFromUnitVectors(UP, tmpDir);
                mesh.quaternion.copy(tmpQ);
            };

            // Recompute pan + chain transforms for a beam angle θ
            // (rotation about z). Beam end: (s·L·cosθ, s·L·sinθ, 0).
            const layPans = (theta: number) => {
                const ct = Math.cos(theta), st = Math.sin(theta);
                for (const pan of pans) {
                    const ex = pan.side * BEAM_HALF * ct;
                    const ey = BEAM_HALF * st;
                    const py = ey - PAN_DROP;
                    pan.ring.position.set(ex, py, 0);
                    for (let i = 0; i < pan.chains.length; i++) {
                        const a = pan.rimAngles[i];
                        stretchChain(
                            pan.chains[i],
                            ex, ey, 0,
                            ex + Math.cos(a) * PAN_R, py, Math.sin(a) * PAN_R
                        );
                    }
                }
            };

            // ── The ground shadow — a soft warm-dark bloom below ──────
            const shadowCanvas = document.createElement('canvas');
            shadowCanvas.width = shadowCanvas.height = 128;
            const sctx = shadowCanvas.getContext('2d')!;
            const sgrad = sctx.createRadialGradient(64, 64, 4, 64, 64, 62);
            sgrad.addColorStop(0, 'rgba(42, 33, 24, 0.38)');
            sgrad.addColorStop(1, 'rgba(42, 33, 24, 0)');
            sctx.fillStyle = sgrad;
            sctx.fillRect(0, 0, 128, 128);
            const shadowTex = new THREE.CanvasTexture(shadowCanvas);
            const shadow = new THREE.Mesh(
                new THREE.PlaneGeometry(4.8, 4.8),
                new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
            );
            shadow.rotation.x = -Math.PI / 2;
            shadow.position.y = -2.3;
            scene.add(shadow);

            // ── Lights (the env carries the metal; these carve it) ────
            const key = new THREE.DirectionalLight(0xffd9b3, 1.15);
            key.position.set(3.2, 4.4, 4.6);
            scene.add(key);
            const rim = new THREE.PointLight(0x7b1e1e, 9, 14, 2); // claret rim
            rim.position.set(-4.2, -1.4, -3.4);
            scene.add(rim);
            scene.add(new THREE.AmbientLight(0x241812, 0.55));

            // ── The SVG fallback retires once a real frame exists ─────
            let fallbackHidden = false;
            const hideFallback = () => {
                if (fallbackHidden) return;
                fallbackHidden = true;
                const fb = host.querySelector('.vg-scales-fallback');
                if (fb) (fb as HTMLElement).style.display = 'none';
            };

            // ── Motion ────────────────────────────────────────────────
            let rafId: number | null = null;
            let running = false;
            let visible = false;
            let bootedAt = 0;           // first on-screen timestamp
            let entered = false;
            let pointerTX = 0, pointerTY = 0;   // parallax targets
            let pointerX = 0, pointerY = 0;     // lerped

            // Beam spring state — θ (rad), ω (rad/s). Underdamped so the
            // settle overshoots once, like a real beam arrest.
            let theta = -0.5;           // arrives off-balance…
            let omega = 0;
            const SPRING_K = 26;        // stiffness
            const SPRING_C = 3.4;       // damping (ζ≈0.33 — gentle overshoot)
            const MAX_TILT = 0.17;      // pointer influence clamp

            const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

            let lastNow = 0;
            const drawFrame = (now: number) => {
                const t = now / 1000;
                const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
                lastNow = now;

                // Entrance — the instrument rises and settles (1.15s).
                const e = entered ? Math.min(1, (now - bootedAt) / 1150) : 0;
                const ease = easeOutCubic(e);
                const scale = 0.84 + 0.16 * ease;
                instrument.scale.setScalar(scale);
                instrument.position.y = (1 - ease) * -0.3;

                pointerX += (pointerTX - pointerX) * 0.05;
                pointerY += (pointerTY - pointerY) * 0.05;

                // The slow turn + the pointer's gentle lean.
                instrument.rotation.y = t * 0.16 + pointerX * 0.5;
                instrument.rotation.x = 0.04 + Math.sin(t * 0.4) * 0.03 + pointerY;

                // The gimbal rings precess — opposite, unhurried.
                for (const { pivot, speed } of ringPivots) {
                    pivot.rotation.y = t * speed;
                }

                // The beam: damped spring to its target — the pointer
                // sets the tilt, idle breathes ±2.5°, release settles.
                const target =
                    pointerTX * MAX_TILT * 2 + Math.sin(t * 0.5) * 0.045;
                omega += (SPRING_K * (target - theta) - SPRING_C * omega) * dt;
                theta += omega * dt;
                beamAssembly.rotation.z = theta;
                layPans(theta);

                // The plumb never swings — it is the vertical the beam
                // is measured against (already level by construction).

                renderer.render(scene, camera);
            };

            const loop = (now: number) => {
                if (!running) return;
                drawFrame(now);
                rafId = requestAnimationFrame(loop);
            };

            const start = (now: number) => {
                if (!entered) {
                    entered = true;
                    bootedAt = now;
                    lastNow = now;
                }
                if (running) return;
                running = true;
                rafId = requestAnimationFrame(loop);
            };
            const stop = () => {
                running = false;
                if (rafId !== null) cancelAnimationFrame(rafId);
                rafId = null;
            };

            if (reducedMotion) {
                // One composed static frame — level, at rest, dignified.
                instrument.scale.setScalar(1);
                instrument.rotation.set(0.05, 0.35, 0);
                beamAssembly.rotation.z = 0;
                layPans(0);
                renderer.render(scene, camera);
                hideFallback();
            } else {
                const onPointerMove = (e: PointerEvent) => {
                    const r = host.getBoundingClientRect();
                    pointerTX = (((e.clientX - r.left) / r.width) - 0.5) * 0.9;
                    pointerTY = -(((e.clientY - r.top) / r.height) - 0.5) * 0.28;
                };
                const onPointerLeave = () => { pointerTX = 0; pointerTY = 0; };
                host.addEventListener('pointermove', onPointerMove);
                host.addEventListener('pointerleave', onPointerLeave);

                const io = new IntersectionObserver(
                    (entries) => {
                        visible = entries.some((en) => en.isIntersecting);
                        if (visible && !document.hidden) start(performance.now());
                        else stop();
                    },
                    { threshold: 0.05 }
                );
                io.observe(host);
                const onVis = () => { if (document.hidden) stop(); else if (visible) start(performance.now()); };
                document.addEventListener('visibilitychange', onVis);

                const resize = () => {
                    const w = host.clientWidth, h = Math.max(1, host.clientHeight);
                    renderer.setSize(w, h);
                    camera.aspect = w / h;
                    camera.updateProjectionMatrix();
                };
                const ro = new ResizeObserver(resize);
                ro.observe(host);

                // Prime one frame immediately so the instrument is never blank.
                if (host.clientWidth > 0) {
                    entered = true;
                    bootedAt = performance.now() - 400; // part-way through the entrance
                    lastNow = performance.now() - 416;
                    drawFrame(performance.now() - 400);
                    hideFallback();
                }

                teardown = () => {
                    stop();
                    io.disconnect();
                    ro.disconnect();
                    document.removeEventListener('visibilitychange', onVis);
                    host.removeEventListener('pointermove', onPointerMove);
                    host.removeEventListener('pointerleave', onPointerLeave);
                };
            }

            const disposeAll = () => {
                teardown?.();
                for (const g of geos) g.dispose();
                for (const m of mats) m.dispose();
                (shadow.material as import('three').Material).dispose();
                shadow.geometry.dispose();
                shadowTex.dispose();
                dome.geometry.dispose();
                (dome.material as import('three').Material).dispose();
                domeTex.dispose();
                envScene.traverse((o) => {
                    const mesh = o as import('three').Mesh;
                    if (mesh.isMesh) {
                        mesh.geometry?.dispose?.();
                        (mesh.material as import('three').Material)?.dispose?.();
                    }
                });
                envRT.dispose();
                pmrem.dispose();
                renderer.dispose();
                renderer.domElement.remove();
            };
            teardown = disposeAll;
        };

        boot();
        return () => {
            disposed = true;
            teardown?.();
        };
    }, []);

    return (
        <div ref={hostRef} className={className} aria-hidden="true" role="presentation">
            {/* The SVG fallback — the same instrument, drafted flat.
                Shows until WebGL paints (and stays if it never can).
                Pure geometry: rings, beam, chains, pans, plumb line. */}
            <svg
                className="vg-scales-fallback absolute inset-0 w-full h-full"
                viewBox="0 0 48 48"
            >
                <defs>
                    <linearGradient id="vgscalesfb" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#C4745A" />
                        <stop offset="1" stopColor="#7B2E1E" />
                    </linearGradient>
                </defs>
                <g stroke="url(#vgscalesfb)" fill="none" strokeLinecap="round">
                    {/* gimbal rings */}
                    <circle cx="24" cy="24" r="21.5" strokeWidth="0.7" opacity="0.5" />
                    <ellipse cx="24" cy="24" rx="17.5" ry="21" strokeWidth="0.55" opacity="0.35" />
                    {/* the beam + fulcrum + pivot */}
                    <line x1="8" y1="20" x2="40" y2="20" strokeWidth="1.1" />
                    <path d="M22 20 L24 24.5 L26 20 Z" strokeWidth="1.1" fill="url(#vgscalesfb)" />
                    {/* chains + pans (level rings, drawn as ellipses) */}
                    <g strokeWidth="0.55" opacity="0.9">
                        <line x1="8" y1="20" x2="5.2" y2="30" />
                        <line x1="8" y1="20" x2="10.8" y2="30" />
                        <line x1="8" y1="20" x2="8" y2="30.6" />
                        <line x1="40" y1="20" x2="37.2" y2="30" />
                        <line x1="40" y1="20" x2="42.8" y2="30" />
                        <line x1="40" y1="20" x2="40" y2="30.6" />
                    </g>
                    <ellipse cx="8" cy="31.5" rx="4.6" ry="1.5" strokeWidth="1.1" />
                    <ellipse cx="40" cy="31.5" rx="4.6" ry="1.5" strokeWidth="1.1" />
                    {/* the plumb line + bob */}
                    <line x1="24" y1="24.5" x2="24" y2="38" strokeWidth="0.55" opacity="0.8" />
                    <circle cx="24" cy="38.8" r="1.1" strokeWidth="0.9" fill="url(#vgscalesfb)" />
                </g>
            </svg>
        </div>
    );
};

export default VegaScalesScene;
