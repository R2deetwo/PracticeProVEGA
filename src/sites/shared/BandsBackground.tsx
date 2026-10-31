import React, { useEffect, useRef } from 'react';
import {
    createBandsRenderer,
    BandsRenderer,
} from '../../lib/bands/createBandsRenderer';

/**
 * BandsBackground — the marketing hero's flowing-bands layer (R53).
 *
 * Owner direction (Prompt 4, via a reference-look spec): the hero gains
 * the silky, fractal, slowly drifting contour bands of the reference
 * site (bitnomial.com) — NOT the barely-visible thin line overlay of
 * R50, which is retired. On the hub this canvas IS the hero background
 * (the photograph is gone); the shader fades to palette[0] on the left
 * so the copy column sits on clean ground.
 *
 * Thin React wrapper over createBandsRenderer (WebGL2, dependency-free,
 * quality-scaled, reduced-motion aware, CSS fallback when WebGL2 is
 * unavailable — see the renderer for the full contract). The canvas is
 * absolutely positioned inset-0, pointer-events-none, and the CALLER
 * owns the stacking (z-0 behind z-10 image/mask layers and z-20 copy).
 *
 * Palettes are brand hex (marketing surfaces are not token-gated — the
 * same register the site sections and the ProductMarks favicons use).
 */
export interface BandsProps {
    /** hex: [bg, mid, bright, line]. bg MUST equal the section background. */
    palette: [string, string, string, string];
    /** contour band density. Default 14. */
    bandCount?: number;
    /** line half-width in cell units. Default 0.035. */
    lineWidth?: number;
    /** fold intensity — higher = more intricate fractal folding. Default 2.4. */
    warp?: number;
    /** drift speed multiplier. Default 1.0. */
    speed?: number;
    /** pointer subtly warps the field. Default true. */
    pointerReactive?: boolean;
    className?: string;
}

export const BandsBackground: React.FC<BandsProps> = ({
    palette,
    bandCount,
    lineWidth,
    warp,
    speed,
    pointerReactive,
    className = '',
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rendererRef = useRef<BandsRenderer | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        rendererRef.current = createBandsRenderer(canvas, {
            palette,
            bandCount,
            lineWidth,
            warp,
            speed,
            pointerReactive,
        });
        return () => {
            rendererRef.current?.dispose();
            rendererRef.current = null;
        };
        // Re-create only when the visual inputs change — the renderer is
        // self-managing for sizing/visibility/pauses.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [palette.join(','), bandCount, lineWidth, warp, speed, pointerReactive]);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
        />
    );
};
