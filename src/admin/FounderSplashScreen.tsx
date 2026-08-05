/**
 * FounderSplashScreen — cinematic brand reveal for the Founder APK.
 *
 * CINEMATIC ANIMATION SEQUENCE (~3 seconds total):
 *
 * MIRRORS the consumer SplashScreen EXACTLY but with REVERSED colors:
 *
 *   Consumer:  black → amber → green → "Ready"
 *   Founder:   green → amber → black → "FOUNDER"
 *
 * Same timing, same easing, same CSS classes, same haptics.
 * The only differences are the phase colors and the final text.
 *
 * EASING: cubic-bezier(0.16, 1, 0.3, 1) — smooth deceleration
 * HAPTICS: soft impact at each color transition keyframe
 */

import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Logo } from '../constants';
import '../components/SplashScreen.css';

interface FounderSplashScreenProps {
    isVisible: boolean;
    statusMessage?: string;
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

const FounderSplashScreen: React.FC<FounderSplashScreenProps> = ({
    isVisible,
    statusMessage = "Initializing Founder Console...",
    onComplete
}) => {
    // Phase 1: green (brand) — the starting color
    // Phase 2: amber — the transition color (SAME as consumer app)
    // Phase 3: black — the founder brand standard
    const [phase, setPhase] = useState<'green' | 'amber' | 'black'>('green');
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

            // ── PHASE 1: GREEN (0ms) — logo in brand green ────────────
            setPhase('green');

            // ── PHASE 2: AMBER (after 800ms) ───────────────────────────
            addTimer(() => {
                setPhase('amber');
                hapticImpact(); // Soft haptic when color transitions
            }, 800);

            // ── PHASE 3: BLACK (after 1600ms) ──────────────────────────
            addTimer(() => {
                setPhase('black');
                hapticImpact(); // Soft haptic when color settles
            }, 1600);

            // ── SETTLE + COMPLETE (after 2800ms) ───────────────────────
            // Hold the final frame for ~1.2s after black appears so the
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

    // Once we're in the black phase, "FOUNDER" text is showing.
    // Hide the bottom status text so it doesn't appear twice.
    const showBottomStatus = isVisible && phase !== 'black' && !isExiting;

    // Color for the logo based on phase (REVERSED from consumer)
    // Consumer: emergence(black #000) → amber (#EAB308) → green (rgb(22,163,74))
    // Founder:  green (rgb(22,163,74)) → amber (#EAB308) → black (#000)
    const logoColor = phase === 'green' ? 'rgb(22, 163, 74)'
        : phase === 'amber' ? '#EAB308'
        : '#000000';

    const logoGlow = phase === 'green' ? 'drop-shadow(0 0 35px rgba(22,163,74,0.4))'
        : phase === 'amber' ? 'drop-shadow(0 0 25px rgba(234,179,8,0.25))'
        : 'drop-shadow(0 0 15px rgba(255,255,255,0.05))';

    return (
        <div
            className={`splash-screen ${isExiting ? 'splash-exiting' : ''}`}
            style={{
                backgroundColor: '#0e0e11',
                pointerEvents: isVisible ? 'auto' : 'none',
                zIndex: 9999,
            }}
        >
            {/* Branding Core — same structure as consumer SplashScreen */}
            <div className="relative z-10 flex flex-col items-center">
                {/* Logo — entry animation handled by CSS .splash-logo class */}
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

                {/* Text — entry animation handled by CSS .splash-text-container */}
                <div className="splash-text-container">
                    <span
                        className="splash-text"
                        style={{
                            color: '#FFFFFF',
                            opacity: phase === 'black' ? 1 : 0,
                            transform: phase === 'black' ? 'translateY(0)' : 'translateY(8px)',
                            transition: `opacity 0.5s ${EASE_CINEMATIC}, transform 0.5s ${EASE_CINEMATIC}`,
                        }}
                    >
                        FOUNDER
                    </span>
                </div>
            </div>

            {/* Status Feedback — hidden once "FOUNDER" appears */}
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

export default FounderSplashScreen;
