import React, { useEffect, useRef } from 'react';

/**
 * MorphScene — the corporate hero's living background (W7).
 *
 * A slowly morphing, simplex-noise-displaced icosphere rendered in the
 * PracticePro brand ramp (moss → emerald, with an amber kiss on the
 * peaks and an amber fresnel rim), wrapped in a sparse particle field.
 *
 * Engineering notes:
 * - three.js is imported DYNAMICALLY so it lands in its own lazy chunk:
 *   visitors to /vega, /atrium or the logged-in app never download it.
 * - All displacement happens in the vertex shader (GPU) — the CPU only
 *   advances a clock and lerps the camera. Cheap on phones.
 * - Pauses (skips rendering) when the hero is offscreen or the tab is
 *   hidden; renders a single static frame under prefers-reduced-motion.
 * - If WebGL is unavailable, the component renders nothing and the CSS
 *   gradient fallback behind it simply shows through.
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
            const camera = new THREE.PerspectiveCamera(42, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 50);
            // Portrait viewports pull the camera back so the orb reads at the same scale.
            camera.position.set(0, 0, isSmall ? 8.2 : 6.4);

            // Brand constants (see src/index.css :root).
            const COLOR_MOSS = new THREE.Color('#16A34A');
            const COLOR_EMERALD = new THREE.Color('#059669');
            const COLOR_AMBER = new THREE.Color('#D97706');

            const blobUniforms = {
                uTime: { value: 0 },
                uAmp: { value: 0.62 },
                uColorA: { value: COLOR_MOSS },
                uColorB: { value: COLOR_EMERALD },
                uColorC: { value: COLOR_AMBER },
            };

            const blobMaterial = new THREE.ShaderMaterial({
                uniforms: blobUniforms,
                vertexShader: `
                    uniform float uTime;
                    uniform float uAmp;
                    varying float vNoise;
                    varying vec3 vNormal;
                    varying vec3 vView;

                    // Ashima Arts 3D simplex noise (public domain).
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

                    void main() {
                        float t = uTime * 0.22;
                        vec3 p = position;
                        // Two octaves: a broad breathing swell + a finer ripple.
                        float n = snoise(p * 0.85 + vec3(t, t * 0.7, 0.0)) * 0.65
                                + snoise(p * 2.1 - vec3(t * 1.35, 0.0, t * 0.9)) * 0.35;
                        p += normal * n * uAmp;
                        vNoise = n;
                        vNormal = normalize(normalMatrix * normal);
                        vec4 mv = modelViewMatrix * vec4(p, 1.0);
                        vView = normalize(-mv.xyz);
                        gl_Position = projectionMatrix * mv;
                    }
                `,
                fragmentShader: `
                    uniform vec3 uColorA;
                    uniform vec3 uColorB;
                    uniform vec3 uColorC;
                    varying float vNoise;
                    varying vec3 vNormal;
                    varying vec3 vView;

                    void main() {
                        // Moss → emerald across the noise field…
                        float g = smoothstep(-0.75, 0.95, vNoise);
                        vec3 col = mix(uColorA, uColorB, g);
                        // …with an amber kiss on the highest crests.
                        col = mix(col, uColorC, smoothstep(0.52, 1.0, vNoise) * 0.8);
                        // Soft top light keeps the sphere reading as 3D.
                        float top = clamp(vNormal.y * 0.5 + 0.5, 0.0, 1.0);
                        col *= 0.42 + top * 0.72;
                        // Amber fresnel rim — the brand's signature edge light.
                        float fres = pow(1.0 - clamp(dot(vNormal, vView), 0.0, 1.0), 2.7);
                        col += uColorC * fres * 0.55;
                        gl_FragColor = vec4(col, 1.0);
                    }
                `,
            });

            const blobGeometry = new THREE.IcosahedronGeometry(1.72, isSmall ? 48 : 64);
            const blob = new THREE.Mesh(blobGeometry, blobMaterial);
            scene.add(blob);

            // ── Particle field (soft round points, brand-tinted) ──────
            const COUNT = isSmall ? 80 : 150;
            const positions = new Float32Array(COUNT * 3);
            const scales = new Float32Array(COUNT);
            const seeds = new Float32Array(COUNT);
            for (let i = 0; i < COUNT; i++) {
                // Spherical shell around the orb.
                const r = 2.5 + Math.random() * 1.9;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
                positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.72;
                positions[i * 3 + 2] = r * Math.cos(phi);
                scales[i] = 0.5 + Math.random() * 1.6;
                seeds[i] = Math.random();
            }
            const particleGeometry = new THREE.BufferGeometry();
            particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            particleGeometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
            particleGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
            const particleMaterial = new THREE.ShaderMaterial({
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                uniforms: {
                    uTime: { value: 0 },
                    uColorA: { value: COLOR_EMERALD },
                    uColorB: { value: COLOR_AMBER },
                },
                vertexShader: `
                    attribute float aScale;
                    attribute float aSeed;
                    uniform float uTime;
                    varying float vSeed;
                    void main() {
                        vSeed = aSeed;
                        vec3 p = position;
                        // Gentle individual drift so the field feels alive.
                        p.y += sin(uTime * 0.3 + aSeed * 12.0) * 0.18;
                        p.x += cos(uTime * 0.24 + aSeed * 9.0) * 0.14;
                        vec4 mv = modelViewMatrix * vec4(p, 1.0);
                        gl_PointSize = aScale * (170.0 / -mv.z);
                        gl_Position = projectionMatrix * mv;
                    }
                `,
                fragmentShader: `
                    uniform vec3 uColorA;
                    uniform vec3 uColorB;
                    varying float vSeed;
                    void main() {
                        float d = distance(gl_PointCoord, vec2(0.5));
                        float alpha = smoothstep(0.5, 0.08, d) * 0.55;
                        vec3 col = mix(uColorA, uColorB, vSeed);
                        gl_FragColor = vec4(col, alpha);
                    }
                `,
            });
            const particles = new THREE.Points(particleGeometry, particleMaterial);
            scene.add(particles);

            // ── Pointer parallax (lerped, never jumpy) ────────────────
            let pointerX = 0, pointerY = 0, curX = 0, curY = 0;
            const onPointerMove = (e: PointerEvent) => {
                pointerX = (e.clientX / window.innerWidth) * 2 - 1;
                pointerY = (e.clientY / window.innerHeight) * 2 - 1;
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
            const BASE_TIME = 14.0; // a pleasing static pose for reduced motion
            let time = reducedMotion ? BASE_TIME : 0;

            const renderFrame = () => {
                blobUniforms.uTime.value = time;
                particleMaterial.uniforms.uTime.value = time;
                curX += (pointerX - curX) * 0.045;
                curY += (pointerY - curY) * 0.045;
                camera.position.x = curX * 0.55;
                camera.position.y = -curY * 0.38;
                camera.lookAt(0, 0, 0);
                blob.rotation.y = time * 0.055 + curX * 0.22;
                blob.rotation.x = Math.sin(time * 0.05) * 0.16 + curY * 0.14;
                particles.rotation.y = time * 0.012;
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
                        time += dt;
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
                blobGeometry.dispose();
                blobMaterial.dispose();
                particleGeometry.dispose();
                particleMaterial.dispose();
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
