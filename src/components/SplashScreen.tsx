/**
 * SplashScreen — cinematic brand reveal.
 *
 * THREE-PHASE ANIMATION:
 *   1. EMERGENCE (600ms) — black logo fades in on dark background
 *   2. AMBER     (600ms) — logo morphs to amber (loading signal)
 *   3. GREEN     (500ms) — logo morphs to brand green + "Ready" text appears
 *   4. EXIT      (400ms) — clean fade-out
 *
 * ROBUSTNESS NOTE:
 *   Previously this used Framer Motion's `useAnimation` + `logoControls.start()`.
 *   If the animation controller failed to start (which happened when React
 *   StrictMode double-mounted the component, or when the `isVisible` prop
 *   changed in certain orders), the logo stayed at `opacity: 0` forever —
 *   the user saw a blank screen with only the bottom status text.
 *
 *   NOW we use CSS transitions + direct state management. The logo is
 *   ALWAYS visible (opacity: 1 by default), and we just change the color
 *   via a CSS class. No animation controller, no race conditions.
 */
import React, { useState, useEffect, useRef } from 'react';
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

    // Clear all timers on unmount
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

            // ── PHASE 1: EMERGENCE — logo visible in black ──────────
            setPhase('emergence');

            // ── PHASE 2: AMBER (after 750ms) ────────────────────────
            addTimer(() => {
                setPhase('amber');
            }, 750);

            // ── PHASE 3: GREEN (after 1350ms) ───────────────────────
            addTimer(() => {
                setPhase('green');
            }, 1350);

            // ── Call onComplete (after 1900ms) ──────────────────────
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
            className="splash-screen"
            style={{
                backgroundColor: '#0e0e11',
                opacity: isExiting ? 0 : 1,
                transition: 'opacity 0.4s ease',
                pointerEvents: isVisible ? 'auto' : 'none',
                zIndex: 9999
            }}
        >
            {/* Branding Core */}
            <div className="relative z-10 flex flex-col items-center">
                {/* Logo — ALWAYS visible (opacity 1). Color changes via CSS transition. */}
                <div
                    className="splash-logo"
                    style={{
                        color: logoColor,
                        filter: logoGlow,
                        transition: 'color 0.6s ease, filter 0.6s ease',
                        opacity: 1, // ALWAYS visible — no animation controller dependency
                    }}
                >
                    <Logo className="w-32 h-32" />
                </div>

                <div className="splash-text-container">
                    <span
                        className="splash-text"
                        style={{
                            color: 'rgb(22, 163, 74)',
                            opacity: phase === 'green' ? 1 : 0,
                            transform: phase === 'green' ? 'translateY(0)' : 'translateY(8px)',
                            transition: 'opacity 0.3s ease, transform 0.3s ease',
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
                        className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700"
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

export default SplashScreen;
