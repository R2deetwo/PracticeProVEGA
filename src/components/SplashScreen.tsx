
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
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
 * PHASES (Golden Ratio timing):
 *   1. EMERGENCE  (500ms) — black logo fades in (stealth, premium)
 *   2. AMBER      (600ms) — logo morphs to amber/yellow (loading signal)
 *   3. GREEN      (400ms) — logo morphs to brand green (the "green light"
 *                            signal — waiting is over, app is ready)
 *   4. EXIT       (300ms) — clean fade-out
 *
 * The green phase is the psychological "go" signal. The app becomes
 * interactive immediately when green appears — the exit animation plays
 * in parallel with the app loading underneath, so there's no dead time
 * between green and the app being usable.
 *
 * Total visible duration: ~1.8s (down from ~2.8s previously).
 */
const SplashScreen: React.FC<SplashScreenProps> = ({
    isVisible,
    statusMessage = "Initializing System...",
    onReset,
    onForceEnter,
    onComplete
}) => {
    const [phase, setPhase] = useState<'emergence' | 'amber' | 'green'>('emergence');
    const [isActuallyMounted, setIsActuallyMounted] = useState(isVisible);

    const logoControls = useAnimation();
    const textControls = useAnimation();
    const containerControls = useAnimation();
    const bgImageControls = useAnimation();

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
        // ── PHASE 1: EMERGENCE (500ms) — Stealth Black ──────────────────
        setPhase('emergence');
        await logoControls.start({
            opacity: [0, 1],
            scale: [0.8, 1.0],
            color: '#000000',
            filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.05))',
            transition: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }
        });

        await new Promise(resolve => setTimeout(resolve, 150));

        // ── PHASE 2: AMBER (600ms) — Loading Signal ─────────────────────
        setPhase('amber');
        logoControls.start({
            color: '#EAB308',
            filter: 'drop-shadow(0 0 25px rgba(234,179,8,0.25))',
            transition: { duration: 0.6, ease: [0.65, 0, 0.35, 1] }
        });

        await textControls.start({
            opacity: [0, 1],
            y: [10, 0],
            transition: { duration: 0.4, ease: "easeOut" }
        });

        // Hold amber briefly so the color registers
        await new Promise(resolve => setTimeout(resolve, 300));

        // ── PHASE 3: GREEN (400ms) — The "Green Light" ──────────────────
        // This is the psychological "go" signal. The app is ready.
        // We signal onComplete HERE so the app starts loading underneath
        // the green phase — no dead time between green and usability.
        if (onComplete) onComplete();

        setPhase('green');
        await textControls.start({ opacity: 0, y: -8, transition: { duration: 0.2 } });

        logoControls.start({
            color: 'rgb(22, 163, 74)', // emerald-600 — brand green
            filter: 'drop-shadow(0 0 35px rgba(22,163,74,0.35))',
            scale: [1.0, 1.04, 1.0],
            transition: {
                color: { duration: 0.4, ease: [0.65, 0, 0.35, 1] },
                filter: { duration: 0.4, ease: [0.65, 0, 0.35, 1] },
                scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
            }
        });

        await textControls.start({
            opacity: [0, 1],
            y: [8, 0],
            transition: { duration: 0.3, ease: "easeOut" }
        });

        // Green phase plays while the app loads underneath. The exit
        // animation is triggered by isVisible becoming false (when
        // isDataLoaded is true in App.tsx).
    };

    const handleExitSequence = async () => {
        // Exit is a clean opacity fade of the whole screen
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
            {/* Cinematic Background Layer */}
            <motion.div
                className="splash-bg-image"
                animate={bgImageControls}
                initial={{ opacity: 0 }}
            />

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
                        key={phase}
                        className="splash-text"
                        animate={textControls}
                        initial={{ opacity: 0 }}
                        style={{
                            color: phase === 'green' ? 'rgb(22, 163, 74)' : '#EAB308',
                            display: phase === 'emergence' ? 'none' : 'block'
                        }}
                    >
                        {phase === 'amber' ? 'Vega' : phase === 'green' ? 'Ready' : ''}
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
