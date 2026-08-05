/**
 * FounderSplashScreen — cinematic brand reveal for the Founder APK.
 *
 * MIRRORS the consumer app's SplashScreen.tsx EXACTLY but with REVERSED
 * color phases:
 *
 *   Consumer:  black → amber → green → "Ready"
 *   Founder:   green → orange → black → "FOUNDER"
 *
 * Same structure, same CSS classes (SplashScreen.css), same Logo
 * component, same timing (750ms / 600ms / 550ms), same dark background
 * (#0e0e11). The only differences are the phase colors and the final
 * text.
 *
 * ROBUSTNESS:
 *   Uses CSS transitions + direct state management (same approach as the
 *   consumer SplashScreen). No Framer Motion, no race conditions. The
 *   logo is ALWAYS visible (opacity: 1) — we just change the color via
 *   a CSS class.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Logo } from '../constants';
import '../components/SplashScreen.css';

interface FounderSplashScreenProps {
    isVisible: boolean;
    statusMessage?: string;
    onComplete?: () => void;
}

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

            // ── PHASE 1: GREEN (0ms) — logo visible in brand green ────
            setPhase('green');

            // ── PHASE 2: AMBER (after 750ms) — same color as consumer app ─
            addTimer(() => {
                setPhase('amber');
            }, 750);

            // ── PHASE 3: BLACK (after 1350ms) ─────────────────────────
            addTimer(() => {
                setPhase('black');
            }, 1350);

            // ── Call onComplete (after 1900ms) ────────────────────────
            addTimer(() => {
                if (onComplete) onComplete();
            }, 1900);
        } else if (!isVisible && isActuallyMounted && !isExiting) {
            // Exit sequence
            setIsExiting(true);
            addTimer(() => {
                setIsActuallyMounted(false);
                setIsExiting(false);
            }, 400);
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
    // The middle color is the EXACT SAME amber as the consumer app.
    const logoColor = phase === 'green' ? 'rgb(22, 163, 74)'   // emerald-600 — brand green
        : phase === 'amber' ? '#EAB308'                        // amber — same as consumer app
        : '#000000';                                            // black — founder brand

    const logoGlow = phase === 'green' ? 'drop-shadow(0 0 35px rgba(22,163,74,0.4))'
        : phase === 'amber' ? 'drop-shadow(0 0 25px rgba(234,179,8,0.25))'
        : 'drop-shadow(0 0 15px rgba(255,255,255,0.05))';

    return (
        <div
            className="splash-screen"
            style={{
                backgroundColor: '#0e0e11',
                opacity: isExiting ? 0 : 1,
                transition: 'opacity 0.4s ease',
                pointerEvents: isVisible ? 'auto' : 'none',
                zIndex: 9999
            }}
        >
            {/* Branding Core — same structure as consumer SplashScreen */}
            <div className="relative z-10 flex flex-col items-center">
                {/* Logo — ALWAYS visible (opacity 1). Color changes via CSS transition. */}
                <div
                    className="splash-logo"
                    style={{
                        color: logoColor,
                        filter: logoGlow,
                        transition: 'color 0.6s ease, filter 0.6s ease',
                        opacity: 1,
                    }}
                >
                    <Logo className="w-32 h-32" />
                </div>

                <div className="splash-text-container">
                    <span
                        className="splash-text"
                        style={{
                            color: '#FFFFFF',
                            opacity: phase === 'black' ? 1 : 0,
                            transform: phase === 'black' ? 'translateY(0)' : 'translateY(8px)',
                            transition: 'opacity 0.3s ease, transform 0.3s ease',
                        }}
                    >
                        FOUNDER
                    </span>
                </div>
            </div>

            {/* Status Feedback — hidden once "FOUNDER" appears (same as consumer) */}
            {showBottomStatus && (
                <div className="absolute bottom-20 flex flex-col items-center gap-4 px-10">
                    <p
                        className="text-2xs font-black uppercase tracking-[0.4em] text-slate-700"
                        style={{
                            animation: 'pulse 2s ease-in-out infinite',
                        }}
                    >
                        {statusMessage}
                    </p>
                </div>
            )}

            {/* Hidden style tag for the pulse animation */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 0.7; }
                }
            `}</style>
        </div>
    );
};

export default FounderSplashScreen;
