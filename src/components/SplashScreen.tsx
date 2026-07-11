
import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
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

/**
 * SplashScreen — cinematic brand reveal.
 *
 * SIMPLIFIED TWO-PHASE ANIMATION (per user request):
 *   1. EMERGENCE (600ms) — black logo fades in on dark background
 *   2. GREEN     (500ms) — logo morphs directly to brand green
 *   3. EXIT      (400ms) — clean fade-out
 *
 * No amber. No intermediate color. Black → Green. Done.
 */
const SplashScreen: React.FC<SplashScreenProps> = ({
    isVisible,
    statusMessage = "Initializing System...",
    onReset,
    onForceEnter,
    onComplete
}) => {
    const [isActuallyMounted, setIsActuallyMounted] = useState(isVisible);

    const logoControls = useAnimation();
    const textControls = useAnimation();
    const containerControls = useAnimation();

    const hasStarted = useRef(false);

    useEffect(() => {
        if (isVisible && !hasStarted.current) {
            hasStarted.current = true;
            setIsActuallyMounted(true);
            orchestrateSequence();
        } else if (!isVisible && isActuallyMounted) {
            handleExitSequence();
        }
    }, [isVisible]);

    const orchestrateSequence = async () => {
        // ── PHASE 1: EMERGENCE (600ms) — Black logo fades in ──────────
        await logoControls.start({
            opacity: [0, 1],
            scale: [0.85, 1.0],
            color: '#000000',
            filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.05))',
            transition: { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }
        });

        // Brief hold on black
        await new Promise(resolve => setTimeout(resolve, 200));

        // ── PHASE 2: GREEN (500ms) — Morph directly to brand green ────
        // No amber. Black goes straight to green.
        await logoControls.start({
            color: 'rgb(22, 163, 74)', // emerald-600 — brand green
            filter: 'drop-shadow(0 0 35px rgba(22,163,74,0.4))',
            transition: {
                color: { duration: 0.5, ease: [0.65, 0, 0.35, 1] },
                filter: { duration: 0.5, ease: [0.65, 0, 0.35, 1] },
            }
        });

        // Show "Ready" text in green
        await textControls.start({
            opacity: [0, 1],
            y: [8, 0],
            transition: { duration: 0.3, ease: "easeOut" }
        });

        // Hold green briefly
        await new Promise(resolve => setTimeout(resolve, 300));

        if (onComplete) onComplete();

        // Gentle breathing loop until exit
        logoControls.start({
            scale: [1.0, 1.04, 1.0],
            transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
        });
    };

    const handleExitSequence = async () => {
        await containerControls.start({
            opacity: 0,
            transition: { duration: 0.4, ease: [0.32, 0, 0.67, 0] }
        });
        setIsActuallyMounted(false);
    };

    if (!isActuallyMounted) return null;

    return (
        <motion.div
            className="splash-screen"
            animate={containerControls}
            style={{
                backgroundColor: '#0e0e11',
                opacity: 1,
                pointerEvents: isVisible ? 'auto' : 'none',
                zIndex: 9999
            }}
        >
            {/* Branding Core */}
            <div className="relative z-10 flex flex-col items-center">
                <motion.div
                    className="splash-logo"
                    animate={logoControls}
                    initial={{ opacity: 0 }}
                    style={{ willChange: 'transform, opacity, color, filter' }}
                >
                    <Logo className="w-32 h-32" />
                </motion.div>

                <div className="splash-text-container">
                    <motion.span
                        className="splash-text"
                        animate={textControls}
                        initial={{ opacity: 0 }}
                        style={{
                            color: 'rgb(22, 163, 74)',
                        }}
                    >
                        Ready
                    </motion.span>
                </div>
            </div>

            {/* Status Feedback */}
            {isVisible && (
                <div className="absolute bottom-20 flex flex-col items-center gap-4 px-10">
                    <motion.p
                        className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700"
                        animate={{ opacity: [0.4, 0.7, 0.4] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        {statusMessage}
                    </motion.p>
                </div>
            )}
        </motion.div>
    );
};

export default SplashScreen;
