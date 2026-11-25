/**
 * SplashScreen — two-stage cinematic brand reveal (owner brief 2026-11-25
 * "Splash Screen Sequence & Product-Specific Finale").
 *
 * STAGE 1 — THE PARENt BRAND (PracticePro):
 *   0ms    — clean BLACK (#000000) start. Zero bright-green flash (the
 *            native splash, splash-plugin color and HTML boot overlay all
 *            render black now, so the whole boot chain is black-first).
 *   400ms  — logo morphs to ORANGE / AMBER-GOLD (#EAB308).
 *   900ms  — logo morphs to the PracticePro brand GREEN (rgb(22,163,74))
 *            and holds briefly so the completed state registers cleanly.
 *   1300ms — Stage 2 begins (product known) or the sequence completes
 *            (unauthenticated / product unknown).
 *
 * STAGE 2 — THE PRODUCT FINALE (only when the product is known):
 *   1300ms — clean fade back through BLACK (the Stage-1 content dissolves).
 *   1750ms — reveal of ONLY the single product icon for the active product
 *            (Atrium | Vega | Komplete) with its name + "by PracticePro
 *            Systems" attribution — 350ms opacity/scale ease, then a clean
 *            hold. The 3-icon strip is RETIRED.
 *   2300ms — sequence complete (the app shell takes over via onComplete).
 *
 * UNAUTHENTICATED / PRODUCT UNKNOWN: finish after Stage 1 (~1.7s) straight
 * into the login screen — the post-login product reveal (App.tsx
 * ProductReveal) plays the Stage-2 finale once the plan resolves.
 *
 * The ADMIN / FOUNDER splash (src/admin/FounderSplashScreen.tsx + the
 * admin capacitor config) is deliberately untouched — its sequence is its
 * own.
 *
 * TIMING GUARDRAILS (owner brief): total ~1.8–2.4s; Stage-2 transitions
 * 300–450ms with a clean hold; SPLASH_TIMINGS below is the single source
 * of truth (unit-tested).
 *
 * ROBUSTNESS: CSS transitions + direct state management; the logo is
 * ALWAYS visible once mounted; timers are cleared on unmount; no
 * Framer Motion, no race conditions.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Logo } from '../constants';
import { VegaMark, AtriumMark, KompleteMark } from './marketing/brand/ProductMarks';
import { resolveSplashEndCard, type SplashProduct } from './splashEndCard';
import './SplashScreen.css';

export type { SplashProduct };

interface SplashScreenProps {
    isVisible: boolean;
    statusMessage?: string;
    onReset?: () => void;
    onForceEnter?: () => void;
    product?: SplashProduct;
    onComplete?: () => void;
}

/** The single source of truth for the sequence clock (ms). Unit-tested. */
export const SPLASH_TIMINGS = {
    /** Stage 1 — logo leaves black for amber. */
    amberAt: 400,
    /** Stage 1 — logo reaches the PracticePro green. */
    greenAt: 900,
    /** Stage 1 hold ends; Stage 2 begins (product known). */
    stageTwoAt: 1300,
    /** Stage 2 — the product mark reveal begins. */
    productRevealAt: 1750,
    /** Stage 2 — sequence complete (product known). */
    completeAt: 2300,
    /** Unauthenticated / unknown — complete after the Stage-1 hold. */
    unauthCompleteAt: 1700,
    /** Cinematic exit duration once the app takes over. */
    exitMs: 600,
} as const;

// Cinematic easing curve — smooth deceleration
const EASE_CINEMATIC = 'cubic-bezier(0.16, 1, 0.3, 1)';

// Haptic feedback helper — only fires on native platforms
const hapticImpact = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
        await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
};

type Phase = 'emergence' | 'amber' | 'green' | 'blackout' | 'product';

const SplashScreen: React.FC<SplashScreenProps> = ({
    isVisible,
    statusMessage = "Initializing System...",
    onReset,
    onForceEnter,
    product,
    onComplete
}) => {
    const [phase, setPhase] = useState<Phase>('emergence');
    const [isActuallyMounted, setIsActuallyMounted] = useState(isVisible);
    const [isExiting, setIsExiting] = useState(false);
    const hasStarted = useRef(false);
    const hasDismissed = useRef(false);
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    // ── OWNER BRIEF 2026-11-25 — the two-stage end-card ────────────────
    // Stage 2 exists ONLY when the product is known (from the live
    // ProductContext resolution OR the locally cached activeProduct);
    // unauthenticated/unknown finishes on the completed PracticePro state.
    const endCard = resolveSplashEndCard(product);
    const isProductCard = endCard.mark !== 'practicepro';

    const clearAllTimers = () => {
        timersRef.current.forEach(t => clearTimeout(t));
        timersRef.current = [];
    };

    const addTimer = (fn: () => void, delay: number) => {
        const t = setTimeout(fn, delay);
        timersRef.current.push(t);
    };

    useEffect(() => {
        if (isVisible && !hasStarted.current && !hasDismissed.current) {
            hasStarted.current = true;
            setIsActuallyMounted(true);
            setIsExiting(false);

            // ── STAGE 1: EMERGENCE — logo in black ─────────────────────
            setPhase('emergence');

            // ── STAGE 1: AMBER (after 400ms) ───────────────────────────
            addTimer(() => {
                setPhase('amber');
                hapticImpact(); // Soft haptic when color transitions
            }, SPLASH_TIMINGS.amberAt);

            // ── STAGE 1: GREEN (after 900ms) + brief hold ──────────────
            addTimer(() => {
                setPhase('green');
                hapticImpact(); // Soft haptic when color settles
            }, SPLASH_TIMINGS.greenAt);

            if (isProductCard) {
                // ── STAGE 2: fade back through BLACK ───────────────────
                addTimer(() => {
                    setPhase('blackout');
                }, SPLASH_TIMINGS.stageTwoAt);

                // ── STAGE 2: the single product mark reveal ────────────
                addTimer(() => {
                    setPhase('product');
                    hapticImpact(); // Soft haptic when the product lands
                }, SPLASH_TIMINGS.productRevealAt);

                // ── COMPLETE — hold the finale, then hand off ───────────
                addTimer(() => {
                    if (onComplete) onComplete();
                }, SPLASH_TIMINGS.completeAt);
            } else {
                // ── UNAUTH / UNKNOWN: finish after the Stage-1 hold ────
                addTimer(() => {
                    if (onComplete) onComplete();
                }, SPLASH_TIMINGS.unauthCompleteAt);
            }
        } else if (!isVisible && isActuallyMounted && !isExiting) {
            // ── CINEMATIC EXIT ────────────────────────────────────────
            // Scale outward + cross-fade instead of a simple opacity fade.
            // Dismissal is one-way: a later parent render must not revive the
            // startup overlay over an already-mounted app shell.
            hasDismissed.current = true;
            clearAllTimers();
            setIsExiting(true);
            addTimer(() => {
                setIsActuallyMounted(false);
                setIsExiting(false);
            }, SPLASH_TIMINGS.exitMs);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isVisible]);

    // Cleanup on unmount
    useEffect(() => {
        return () => clearAllTimers();
    }, []);

    if (!isActuallyMounted) return null;

    // Once we're in the green phase, the "Ready" text near the logo is
    // showing. Hide the bottom status text so "Ready" doesn't appear twice.
    const showBottomStatus = isVisible && phase === 'emergence' && !isExiting;

    // Stage-1 logo color: black → amber → the PracticePro green. The green
    // phase keeps the company color even when Stage 2 follows.
    const logoColor = phase === 'emergence' ? '#000000'
        : phase === 'amber' ? '#EAB308'
        : 'rgb(22, 163, 74)';

    const logoGlow = phase === 'emergence' ? 'drop-shadow(0 0 15px rgba(255,255,255,0.05))'
        : phase === 'amber' ? 'drop-shadow(0 0 25px rgba(234,179,8,0.25))'
        : 'drop-shadow(0 0 35px rgba(22,163,74,0.4))';

    // ── STAGE 2 geometry ──────────────────────────────────────────────
    // blackout: the whole Stage-1 column (logo + text) dissolves to black
    // (color → black + opacity 0) — "transition cleanly back through
    // black". product: the company logo stays hidden and ONLY the single
    // product mark heroes the finale.
    const stageOneVisible = phase !== 'blackout' && phase !== 'product';
    const stageOneOpacity = stageOneVisible ? 1 : 0;
    const stageOneColor = phase === 'blackout' || phase === 'product' ? '#000000' : logoColor;

    const productCardOpacity = phase === 'product' ? 1 : 0;
    const productCardTransform = phase === 'product' ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.96)';

    return (
        <div
            className={`splash-screen ${isExiting ? 'splash-exiting' : ''}`}
            style={{
                backgroundColor: '#000000',
                pointerEvents: isVisible ? 'auto' : 'none',
                zIndex: 9999,
            }}
        >
            {/* Branding Core */}
            <div className="relative z-10 flex flex-col items-center">
                {/* ── STAGE 1 — the PracticePro logo (black → amber → green) ── */}
                <div
                    className="splash-logo"
                    style={{
                        color: stageOneColor,
                        filter: logoGlow,
                        opacity: stageOneOpacity,
                        transform: stageOneVisible ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(0)',
                        transition: `color 0.8s ${EASE_CINEMATIC}, filter 0.8s ${EASE_CINEMATIC}, opacity 0.45s ${EASE_CINEMATIC}, transform 0.45s ${EASE_CINEMATIC}`,
                    }}
                >
                    <Logo className="w-32 h-32" />
                </div>

                {/* Text — appears with the green phase, dissolves with Stage 2. */}
                <div className="splash-text-container">
                    <span
                        className="splash-text"
                        style={{
                            color: endCard.readyColor,
                            opacity: phase === 'green' ? 1 : 0,
                            transform: phase === 'green' ? 'translateY(0)' : 'translateY(8px)',
                            transition: `opacity 0.5s ${EASE_CINEMATIC}, transform 0.5s ${EASE_CINEMATIC}, color 0.5s ${EASE_CINEMATIC}`,
                        }}
                    >
                        Ready
                    </span>
                </div>
            </div>

            {/* ── STAGE 2 — THE PRODUCT FINALE. ONLY the single product mark
                (plus name + attribution) — the multi-icon strip is retired
                (owner brief 2026-11-25). The unauthenticated/company splash
                never renders this block. */}
            {isProductCard && (
                <div
                    className="splash-endcard absolute inset-0 flex flex-col items-center justify-center gap-0"
                    style={{
                        opacity: productCardOpacity,
                        transform: productCardTransform,
                        transition: `opacity 0.35s ${EASE_CINEMATIC}, transform 0.35s ${EASE_CINEMATIC}`,
                    }}
                >
                    {endCard.mark === 'vega' ? (
                        <VegaMark className="w-28 h-28" title="PracticePro Vega" />
                    ) : endCard.mark === 'atrium' ? (
                        <AtriumMark className="w-28 h-28" title="PracticePro Atrium" />
                    ) : (
                        <KompleteMark className="w-28 h-28" title="PracticePro Komplete" />
                    )}
                    <span
                        className="mt-4 text-2xl font-bold tracking-tight"
                        style={{ color: endCard.readyColor }}
                    >
                        {endCard.name}
                    </span>
                    <span className="mt-1 text-xs font-medium uppercase tracking-[0.3em] text-slate-500">
                        {endCard.attribution}
                    </span>
                </div>
            )}

            {/* Status Feedback — only during the black emergence phase */}
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
