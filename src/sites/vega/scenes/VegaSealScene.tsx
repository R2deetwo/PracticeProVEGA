import React, { useEffect, useRef } from 'react';

/**
 * VegaSealScene — /vega's signature 3D moment (R32): THE SEAL.
 *
 * The Vega mark is a notary coin with the four-point steer-star of Lyra
 * cut through it in negative space. This scene makes that mark PHYSICAL:
 * the coin extruded in gilt metal (bevelled edges that catch the light),
 * floating over the espresso ground, turning slowly — the seal that
 * certifies the Record band it lives in. Gold dust drifts around it; a
 * claret rim light warms the dark side; the coin leans a few degrees
 * toward the pointer.
 *
 * Engineering notes (the MorphScene disciplines, followed exactly):
 * - three.js is imported DYNAMICALLY so it lands in the shared lazy
 *   chunk: visitors to /, /atrium or the logged-in app never download it.
 * - The metal needs reflections: a tiny procedural studio environment
 *   (gradient dome + warm softboxes) is baked through PMREMGenerator —
 *   core three only, no addons, no network.
 * - Pauses when offscreen or the tab is hidden; one static frame under
 *   prefers-reduced-motion; the SVG seal fallback shows until the first
 *   frame renders (and forever if WebGL is unavailable).
 */
const VegaSealScene: React.FC<{ className?: string }> = ({ className = '' }) => {
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
                return; // no three — the SVG seal fallback stays.
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

            // ── The studio environment (gilt needs reflections) ────────
            // A tiny procedural dome — warm espresso below, a bright
            // studio band above — plus three softboxes, baked through
            // PMREM. Core three only.
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
            softbox(-7, 3, 3, 5, 4, 0xf3a66a);   // gilt fill
            softbox(-3, -2, -7, 6, 4, 0x5e2a1a); // claret kicker from behind

            const pmrem = new THREE.PMREMGenerator(renderer);
            const envRT = pmrem.fromScene(envScene, 0.06);
            const scene = new THREE.Scene();
            scene.environment = envRT.texture;

            // ── Camera ────────────────────────────────────────────────
            const camera = new THREE.PerspectiveCamera(
                38, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 60
            );
            camera.position.set(0, 0.55, 6.1);
            camera.lookAt(0, 0, 0);

            // ── The Seal — the coin with the star cut through it ──────
            // Geometry lifted from the 2D mark: disc r=17, star outer
            // 12/17, waist 6.43/17 (ProductMarks.tsx, viewBox 48).
            const R = 1.7;
            const shape = new THREE.Shape();
            shape.absarc(0, 0, R, 0, Math.PI * 2, false);
            const hole = new THREE.Path();
            const outer = (12 / 17) * R;
            const waist = (6.43 / 17) * R;
            for (let i = 0; i < 8; i++) {
                const ang = Math.PI / 2 + (i * Math.PI) / 4; // start at the top point
                const r = i % 2 === 0 ? outer : waist;
                const x = Math.cos(ang) * r;
                const y = Math.sin(ang) * r;
                if (i === 0) hole.moveTo(x, y); else hole.lineTo(x, y);
            }
            hole.closePath();
            shape.holes.push(hole);

            const coinGeo = new THREE.ExtrudeGeometry(shape, {
                depth: 0.26,
                bevelEnabled: true,
                bevelThickness: 0.05,
                bevelSize: 0.05,
                bevelSegments: 3,
                curveSegments: 96,
            });
            coinGeo.center();
            const coinMat = new THREE.MeshStandardMaterial({
                color: 0xe07a3f,        // the register's burnt-orange gilt
                metalness: 0.94,
                roughness: 0.24,
                envMapIntensity: 1.35,
            });
            const coin = new THREE.Mesh(coinGeo, coinMat);

            const sealGroup = new THREE.Group();
            sealGroup.add(coin);
            scene.add(sealGroup);

            // ── The ground shadow — a soft warm-dark bloom under the coin ──
            const shadowCanvas = document.createElement('canvas');
            shadowCanvas.width = shadowCanvas.height = 128;
            const sctx = shadowCanvas.getContext('2d')!;
            const sgrad = sctx.createRadialGradient(64, 64, 4, 64, 64, 62);
            sgrad.addColorStop(0, 'rgba(10, 5, 2, 0.62)');
            sgrad.addColorStop(1, 'rgba(10, 5, 2, 0)');
            sctx.fillStyle = sgrad;
            sctx.fillRect(0, 0, 128, 128);
            const shadowTex = new THREE.CanvasTexture(shadowCanvas);
            const shadow = new THREE.Mesh(
                new THREE.PlaneGeometry(4.6, 4.6),
                new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
            );
            shadow.rotation.x = -Math.PI / 2;
            shadow.position.y = -1.62;
            scene.add(shadow);

            // ── Gold dust — fine motes drifting in the lamp light ─────
            const DUST = 150;
            const dustPos = new Float32Array(DUST * 3);
            for (let i = 0; i < DUST; i++) {
                // a flattened shell around the coin
                const a = Math.random() * Math.PI * 2;
                const rr = 1.9 + Math.random() * 1.5;
                dustPos[i * 3] = Math.cos(a) * rr;
                dustPos[i * 3 + 1] = (Math.random() - 0.5) * 3.0;
                dustPos[i * 3 + 2] = Math.sin(a) * rr * 0.6;
            }
            const dustGeo = new THREE.BufferGeometry();
            dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
            const dustMat = new THREE.PointsMaterial({
                color: 0xf3a66a,
                size: 0.022,
                sizeAttenuation: true,
                transparent: true,
                opacity: 0.65,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });
            const dust = new THREE.Points(dustGeo, dustMat);
            scene.add(dust);

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
                const fb = host.querySelector('.vg-seal-fallback');
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

            const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

            const drawFrame = (now: number) => {
                const t = now / 1000;
                // Entrance — the coin rises and settles (1.15s, cubic-out).
                const e = entered ? Math.min(1, (now - bootedAt) / 1150) : 0;
                const ease = easeOutCubic(e);
                const scale = 0.82 + 0.18 * ease;
                const enterSpin = (1 - ease) * -0.9;

                pointerX += (pointerTX - pointerX) * 0.05;
                pointerY += (pointerTY - pointerY) * 0.05;

                sealGroup.scale.setScalar(scale);
                sealGroup.rotation.y = t * 0.22 + enterSpin + pointerX;
                sealGroup.rotation.x = 0.1 + Math.sin(t * 0.4) * 0.05 + pointerY;
                sealGroup.position.y = Math.sin(t * 0.8) * 0.06 + (1 - ease) * -0.35;

                dust.rotation.y = t * 0.03;
                dust.position.y = Math.sin(t * 0.35) * 0.1;
                dustMat.opacity = 0.5 + Math.sin(t * 0.9) * 0.14;

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
                // One composed static frame — the coin at a 3/4 turn.
                sealGroup.scale.setScalar(1);
                sealGroup.rotation.set(0.12, -0.55, 0);
                dustMat.opacity = 0.55;
                renderer.render(scene, camera);
                hideFallback();
            } else {
                const onPointerMove = (e: PointerEvent) => {
                    const r = host.getBoundingClientRect();
                    pointerTX = (((e.clientX - r.left) / r.width) - 0.5) * 0.44;
                    pointerTY = -(((e.clientY - r.top) / r.height) - 0.5) * 0.3;
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

                // Prime one frame immediately so the seal is never blank.
                if (host.clientWidth > 0) {
                    entered = true;
                    bootedAt = performance.now() - 400; // part-way through the entrance
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
                coinGeo.dispose();
                coinMat.dispose();
                dustGeo.dispose();
                dustMat.dispose();
                shadow.geometry.dispose();
                (shadow.material as import('three').Material).dispose();
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
            {/* The SVG seal fallback — shows until WebGL paints (and stays
                if it never can). Same geometry as the 3D coin. The host is
                positioned by the caller (absolute inset-x), so inset-0
                children anchor to it. */}
            <svg
                className="vg-seal-fallback absolute inset-0 w-full h-full"
                viewBox="0 0 48 48"
            >
                <defs>
                    <linearGradient id="vgsealfb" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#F3A66A" />
                        <stop offset="1" stopColor="#B4532A" />
                    </linearGradient>
                    <radialGradient id="vgsealfbg" cx="0.5" cy="0.42" r="0.62">
                        <stop offset="0" stopColor="rgb(62 43 28 / 0.9)" />
                        <stop offset="1" stopColor="rgb(34 23 15 / 0)" />
                    </radialGradient>
                </defs>
                <rect width="48" height="48" fill="url(#vgsealfbg)" />
                <path
                    fillRule="evenodd"
                    d="M24 7 A17 17 0 1 0 24 41 A17 17 0 1 0 24 7 Z
                       M24 12 L28.55 19.45 L36 24 L28.55 28.55 L24 36 L19.45 28.55 L12 24 L19.45 19.45 Z"
                    fill="url(#vgsealfb)"
                    transform="translate(24 24) rotate(-18) translate(-24 -24)"
                />
            </svg>
        </div>
    );
};

export default VegaSealScene;
