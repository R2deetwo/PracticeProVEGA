import React from 'react';
import { Button } from '../../../components/ui';
import { CollabPresence } from './CollabPresence';
import { ExpandHint } from './AppShotLightbox';

/**
 * VegaAppShot — a REAL screenshot of the shipping app, framed in the
 * page's light sheet chrome (R38).
 *
 * Owner direction (R28, kept): "The images do not look like what the app
 * looks like — let us use stuff from the app so we are not showing false
 * images." The captures are live from the product; each states what it
 * is in the mono caption; nothing is staged. R38: the old deep-shadow
 * "paper under a desk lamp" chrome (built for the dark register) is
 * replaced by a quiet CREAM SHEET on the ivory ground — one hairline, a
 * soft warm shadow, generous padding. The capture is the exhibit; the
 * frame stays out of the way.
 *
 * R69 — two presentation-layer additions ride the capture (owner
 * direction, this round):
 *   1. CollabPresence: the overlapping team-avatars overlay pinned into
 *      the app header's bell→profile gap — the "built for team
 *      collaboration" signal, visible on every standard-header capture
 *      (card AND lightbox). `collab={false}` opts a capture out — the
 *      DraftPro editor capture has no app header (it is the editor's own
 *      toolbar), so the overlay would float in the wrong place there.
 *   2. The expand affordance: the capture is click-to-expand (a
 *      transparent full-cover ui/Button, with the hover hint and the
 *      touch corner-chip from ExpandHint) opening the host section's
 *      lightbox. The stack overlay sits ABOVE the expand hit-area
 *      (z-20 vs z-10) so presence clicks never open the lightbox.
 *
 * The image wrapper declares container-type: inline-size so the presence
 * overlay's cqw units track the capture at any render width.
 *
 * Presentational chrome only; every interactive element is ui/Button
 * (ADR-0004). The sheet chrome is the shared .vg-shot class.
 */
export const VegaAppShot: React.FC<{
    /** Absolute path under /assets/landing/ */
    src: string;
    alt: string;
    /** Mono caption under the sheet — states WHAT was captured. */
    caption: string;
    className?: string;
    /** R69: render the team-presence overlay (default true; false for
     *  captures without the standard app header, e.g. the editor). */
    collab?: boolean;
    /** R69: opens the lightbox — provided by the host section. */
    onExpand?: () => void;
    /** R69: the exhibit's short label (aria on the expand control). */
    label?: string;
    /** R69: signup hand-off for the presence menu's demo note. */
    onSignup?: () => void;
}> = ({ src, alt, caption, className = '', collab = true, onExpand, label, onSignup }) => (
    <figure className={className}>
        <div className="vg-shot">
            <div
                className={`relative group ${onExpand ? 'cursor-zoom-in' : ''}`}
                style={{ containerType: 'inline-size' }}
            >
                <img
                    src={src}
                    alt={alt}
                    loading="lazy"
                    decoding="async"
                    width={1440}
                    height={900}
                    className="vg-shot__img"
                />
                {collab && <CollabPresence onSignup={onSignup} />}
                {onExpand && (
                    <>
                        <Button
                            variant="bare"
                            onClick={onExpand}
                            aria-label={`Expand the ${label || 'live capture'} view`}
                            className="absolute inset-0 z-10 rounded-[6px] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                        />
                        <ExpandHint />
                    </>
                )}
            </div>
        </div>
        <figcaption className="font-mono text-2xs tracking-widest text-slate-600 mt-4">{caption}</figcaption>
    </figure>
);
