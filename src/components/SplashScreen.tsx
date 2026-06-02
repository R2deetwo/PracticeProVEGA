
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

const SplashScreen: React.FC<SplashScreenProps> = ({
    isVisible,
    statusMessage = "Initializing System...",
    onReset,
    onForceEnter,
    onComplete
}) => {
    // Phase management for Golden Ratio timing
    const [phase, setPhase] = useState<'emergence' | 'vega' | 'atrium'>('emergence');
    const [isActuallyMounted, setIsActuallyMounted] = useState(isVisible);
    
    const logoControls = useAnimation();
    const textControls = useAnimation();
    const containerControls = useAnimation();
    const bgImageControls = useAnimation();

    // Track initialization to avoid re-running sequence
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
        // PHASE 1: EMERGENCE (600ms) - Stealth Black
        setPhase('emergence');
        await logoControls.start({
            opacity: [0, 1],
            scale: [0.8, 1.0],
            color: '#000000',
            filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.05))',
            transition: { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }
        });

        await new Promise(resolve => setTimeout(resolve, 200));

        // PHASE 2: VEGA MORPH (800ms) - Yellow Brand
        setPhase('vega');
        logoControls.start({
            color: '#EAB308',
            filter: 'drop-shadow(0 0 25px rgba(234,179,8,0.2))',
            transition: { duration: 0.8, ease: [0.65, 0, 0.35, 1] }
        });
        
        await textControls.start({
            opacity: [0, 1],
            y: [10, 0],
            transition: { duration: 0.5, ease: "easeOut" }
        });

        // Signal app-ready here — Atrium phase plays as a branded exit,
        // not as a loading gate. Data can sync in parallel.
        if (onComplete) onComplete();

        await new Promise(resolve => setTimeout(resolve, 400));

        // PHASE 3: ATRIUM MORPH (800ms) - Teal Brand (plays while app loads)
        await textControls.start({ opacity: 0, y: -10, transition: { duration: 0.25 } });
        
        setPhase('atrium');
        logoControls.start({
            color: 'rgb(82, 121, 111)',
            filter: 'drop-shadow(0 0 30px rgba(82,121,111,0.25))',
            scale: [1.0, 1.03, 1.0],
            transition: { 
                duration: 0.8, 
                ease: [0.65, 0, 0.35, 1],
                scale: { duration: 3, repeat: Infinity, ease: "easeInOut" }
            }
        });

        bgImageControls.start({
            opacity: 0.25,
            transition: { duration: 0.8 }
        });

        await textControls.start({
            opacity: [0, 1],
            y: [10, 0],
            transition: { duration: 0.5, ease: "easeOut" }
        });
    };

    const handleExitSequence = async () => {
        // Exit is a clean opacity fade of the whole screen
        await containerControls.start({
            opacity: 0,
            transition: { duration: 0.6, ease: [0.32, 0, 0.67, 0] }
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
                opacity: 1, // Ensure fully opaque during sequence
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
                        key={phase} // Triggers re-animation on word change
                        className="splash-text"
                        animate={textControls}
                        initial={{ opacity: 0 }}
                        style={{ 
                            color: phase === 'atrium' ? 'rgb(82, 121, 111)' : '#EAB308',
                            display: phase === 'emergence' ? 'none' : 'block'
                        }}
                    >
                        {phase === 'vega' ? 'Vega' : phase === 'atrium' ? 'Atrium' : ''}
                    </motion.span>
                </div>
            </div>

            {/* Status Feedback */}
            {isVisible && (
                <div className="absolute bottom-20 flex flex-col items-center gap-4 px-10">
                    <motion.p 
                        className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700"
                        animate={{ opacity: [0.4, 0.7, 0.4] }}
                        transition={{ duration: 2.5, repeat: Infinity }}
                    >
                        {statusMessage}
                    </motion.p>
                </div>
            )}
        </motion.div>
    );
};

export default SplashScreen;
