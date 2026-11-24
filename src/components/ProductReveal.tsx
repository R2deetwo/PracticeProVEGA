/**
 * ProductReveal — the post-login Stage-2 finale (owner brief 2026-11-25
 * "Splash Screen Sequence & Product-Specific Finale").
 *
 * WHEN THIS RENDERS: right after a fresh login resolves the user's plan —
 * the boot splash completed on the PARENT brand (PracticePro) because the
 * product was unknown, so the product-specific reveal plays HERE: a clean
 * black overlay, the single product mark (Atrium | Vega | Komplete), its
 * name and the "by PracticePro Systems" attribution — then it fades out
 * into the workspace.
 *
 * It also fires when a returning user's plan CHANGED since their last
 * boot (e.g. upgraded Vega → Komplete: the cached product said Vega, the
 * live resolution says Komplete — the Komplete reveal is the reward).
 *
 * WHAT THIS IS NOT: it never renders on top of the boot splash (the boot
 * splash with a cached product already plays Stage 2), never renders for
 * the demo user, and never duplicates the mark that was already revealed
 * this boot. App.tsx owns the gating logic; this component is presentation
 * only.
 *
 * TIMING: 350ms opacity/scale entry, a clean ~1.1s hold, 350ms exit —
 * ~1.8s total, matching the splash's Stage-2 guardrails.
 */

import React, { useEffect, useState } from 'react';
import { VegaMark, AtriumMark, KompleteMark } from './marketing/brand/ProductMarks';
import { resolveSplashEndCard, type SplashProduct } from './splashEndCard';
// UX-18 z-index governance: the reveal rides the toastSub rung — a
// transient full-screen moment UNDER the toast stack.
import { Z_CLASS } from '../overlays/constants';

const EASE_CINEMATIC = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** The reveal clock (ms) — exported for unit tests. */
export const REVEAL_TIMINGS = {
    entryMs: 350,
    holdMs: 1100,
    exitMs: 350,
} as const;

const ProductReveal: React.FC<{ product: SplashProduct }> = ({ product }) => {
    const endCard = resolveSplashEndCard(product);
    const [stage, setStage] = useState<'enter' | 'hold' | 'exit'>('enter');

    useEffect(() => {
        const t1 = window.setTimeout(() => setStage('hold'), REVEAL_TIMINGS.entryMs);
        const t2 = window.setTimeout(() => setStage('exit'), REVEAL_TIMINGS.entryMs + REVEAL_TIMINGS.holdMs);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
    }, []);

    const opacity = stage === 'exit' ? 0 : 1;
    const scale = stage === 'enter' ? 0.96 : 1;
    const translateY = stage === 'enter' ? 12 : 0;

    return (
        <div
            className={`fixed inset-0 ${Z_CLASS.toastSub} bg-black flex flex-col items-center justify-center pointer-events-none`}
            style={{
                opacity,
                transition: `opacity ${REVEAL_TIMINGS.exitMs}ms ${EASE_CINEMATIC}`,
            }}
            aria-live="polite"
        >
            <div
                className="flex flex-col items-center"
                style={{
                    opacity,
                    transform: `translateY(${translateY}px) scale(${scale})`,
                    transition: `opacity ${REVEAL_TIMINGS.entryMs}ms ${EASE_CINEMATIC}, transform ${REVEAL_TIMINGS.entryMs}ms ${EASE_CINEMATIC}`,
                }}
            >
                {endCard.mark === 'vega' ? (
                    <VegaMark className="w-24 h-24" title="PracticePro Vega" />
                ) : endCard.mark === 'atrium' ? (
                    <AtriumMark className="w-24 h-24" title="PracticePro Atrium" />
                ) : (
                    <KompleteMark className="w-24 h-24" title="PracticePro Komplete" />
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
        </div>
    );
};

export default ProductReveal;
