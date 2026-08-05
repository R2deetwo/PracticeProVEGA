/**
 * SplashScreen — cinematic brand reveal.
 *
 * CINEMATIC ANIMATION SEQUENCE (~3 seconds total):
 *
 *   1. AMBIENT REVEAL (0ms → 1200ms)
 *      Background fades from pure black to dark zinc (#0e0e11) via CSS
 *      ::after animation. Ambient shimmer (::before) begins breathing.
 *
 *   2. LOGO ENTRY (0ms → 1200ms, staggered)
 *      Logo fades in with micro-scale expansion (92% → 100%) using
 *      cubic-bezier(0.16, 1, 0.3, 1) — a smooth, decelerating curve.
 *
 *   3. COLOR PHASE 1 — BLACK (0ms → 800ms)
 *      Logo starts in black (#000000) on the dark background.
 *
 *   4. COLOR PHASE 2 — AMBER (800ms → 1600ms)
 *      Logo morphs to amber (#EAB308) — the loading signal.
 *      Haptic: soft impact when color settles.
 *
 *   5. COLOR PHASE 3 — GREEN (1600ms → 2400ms)
 *      Logo morphs to brand green (rgb(22, 163, 74)).
 *      "Ready" text fades in with vertical slide-up.
 *      Haptic: soft impact when color settles.
 *
 *   6. SETTLE (2400ms → 2800ms)
 *      Brief hold on the final frame to let the branding sink in.
 *
 *   7. CINEMATIC EXIT (2800ms → 3400ms)
 *      Splash scales outward (1 → 1.08) while cross-fading to the
 *      main app. This creates a smooth scene transition.
 *
 * EASING:
 *   All transitions use cubic-bezier(0.16, 1, 0.3, 1) — a smooth,
 *   decelerating curve that feels intentional and elegant.
 *
 * ROBUSTNESS:
 *   CSS transitions + direct state management. The logo is ALWAYS
 *   visible once mounted (opacity is controlled by CSS animation, not
 *   React state). No Framer Motion, no race conditions.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Logo } from '../constants';
import './SplashScreen.css';

export type SplashProduct = 'practicepro' | 'vega' | 'atrium';

interface SplashScreenProps {
    isVisible: boolean;
    statusMessage?: string;
    onReset?: () => void;
    onForceEnter?: () => void;
    product?: SplashProduct;
    onComplete?: () => void;
}

// Cinematic easing curve — smooth deceleration
const EASE_CINEMATIC = 'cubic-bezier(0.16, 1, 0.3, 1)';

// Haptic feedback helper — only fires on native platforms
const hapticImpact = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
        await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
};

const SplashScreen: React.FC<SplashScreenProps> = ({
    isVisible,
    statusMessage = "Initializing System...",
    onReset,
    onForceEnter,
    onComplete
}) => {
    const [phase, setPhase] = useState<'emergence' | 'amber' | 'green'>('emergence');
    const [isActuallyMounted, setIsActuallyMounted] = useState(isVisible);
    const [isExiting, setIsExiting] = useState(false);
    const hasStarted = useRef(false);
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    const clearAllTimers = () => {
        timersRef.current.forEach(t => clearTimeout(t));
        timersRef.current = [];
    };

    const addTimer = (fn: () => void, delay: number) => {
        const t = setTimeout(fn, delay);
        timersRef.current.push(t);
    };

    useEffect(() => {
        if (isVisible && !hasStarted.current) {
            hasStarted.current = true;
            setIsActuallyMounted(true);
            setIsExiting(false);

            // ── PHASE 1: EMERGENCE — logo in black ────────────────────
            setPhase('emergence');

            // ── PHASE 2: AMBER (after 800ms) ───────────────────────────
            addTimer(() => {
                setPhase('amber');
                hapticImpact(); // Soft haptic when color transitions
            }, 800);

            // ── PHASE 3: GREEN (after 1600ms) ──────────────────────────
            addTimer(() => {
                setPhase('green');
                hapticImpact(); // Soft haptic when color settles
            }, 1600);

            // ── SETTLE + COMPLETE (after 2800ms) ───────────────────────
            // Hold the final frame for ~1.2s after green appears so the
            // branding feels intentional and credible.
            addTimer(() => {
                if (onComplete) onComplete();
            }, 2800);
        } else if (!isVisible && isActuallyMounted && !isExiting) {
            // ── CINEMATIC EXIT ────────────────────────────────────────
            // Scale outward + cross-fade instead of a simple opacity fade.
            setIsExiting(true);
            addTimer(() => {
                setIsActuallyMounted(false);
                setIsExiting(false);
            }, 600);
        }
    }, [isVisible]);

    // Cleanup on unmount
    useEffect(() => {
        return () => clearAllTimers();
    }, []);

    if (!isActuallyMounted) return null;

    // Once we're in the green phase, the "Ready" text near the logo is
    // showing. Hide the bottom status text so "Ready" doesn't appear twice.
    const showBottomStatus = isVisible && phase !== 'green' && !isExiting;

    // Color for the logo based on phase
    const logoColor = phase === 'emergence' ? '#000000'
        : phase === 'amber' ? '#EAB308'
        : 'rgb(22, 163, 74)'; // emerald-600 — brand green

    const logoGlow = phase === 'emergence' ? 'drop-shadow(0 0 15px rgba(255,255,255,0.05))'
        : phase === 'amber' ? 'drop-shadow(0 0 25px rgba(234,179,8,0.25))'
        : 'drop-shadow(0 0 35px rgba(22,163,74,0.4))';

    return (
        <div
            className={`splash-screen ${isExiting ? 'splash-exiting' : ''}`}
            style={{
                backgroundColor: '#0e0e11',
                pointerEvents: isVisible ? 'auto' : 'none',
                zIndex: 9999,
            }}
        >
            {/* Branding Core */}
            <div className="relative z-10 flex flex-col items-center">
                {/* Logo — entry animation handled by CSS .splash-logo class.
                    Color and glow change via inline style transitions. */}
                <div
                    className="splash-logo"
                    style={{
                        color: logoColor,
                        filter: logoGlow,
                        transition: `color 0.8s ${EASE_CINEMATIC}, filter 0.8s ${EASE_CINEMATIC}`,
                    }}
                >
                    <Logo className="w-32 h-32" />
                </div>

                {/* Text — entry animation handled by CSS .splash-text-container.
                    Visibility controlled by phase (appears in green phase). */}
                <div className="splash-text-container">
                    <span
                        className="splash-text"
                        style={{
                            color: 'rgb(22, 163, 74)',
                            opacity: phase === 'green' ? 1 : 0,
                            transform: phase === 'green' ? 'translateY(0)' : 'translateY(8px)',
                            transition: `opacity 0.5s ${EASE_CINEMATIC}, transform 0.5s ${EASE_CINEMATIC}`,
                        }}
                    >
                        Ready
                    </span>
                </div>
            </div>

            {/* Status Feedback — hidden once green "Ready" appears */}
            {showBottomStatus && (
                <div className="absolute bottom-20 flex flex-col items-center gap-4 px-10">
                    <p
                        className="text-2xs font-black uppercase tracking-[0.4em] text-slate-700"
                        style={{
                            animation: 'pulse 2.5s ease-in-out infinite',
                        }}
                    >
                        {statusMessage}
                    </p>
                </div>
            )}
        </div>
    );
};

export default SplashScreen;
