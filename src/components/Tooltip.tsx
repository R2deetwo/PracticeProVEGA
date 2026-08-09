
import React, { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  className?: string;
  checkForTruncation?: boolean;
  /** Allow text to wrap for longer contextual messages */
  allowWrap?: boolean;
}

/**
 * Tooltip — clean detached popover via React Portal to document.body.
 *
 * SPEC COMPLIANCE — Pixel-Perfect Refactor §4:
 *   - Renders as a clean, detached popover attached to document.body
 *   - Appears ONLY on mouse hover (not on focus/touch) so it never
 *     gets stuck visible on mobile/touch devices
 *   - Positioned ABOVE the anchor by default (flips below only if
 *     there isn't enough room above)
 *   - Styling: z-50 shadow-xl bg-slate-900 border border-slate-700
 *     text-white text-xs px-2.5 py-1 rounded-md
 */
const Tooltip: React.FC<TooltipProps> = ({ text, children, className, checkForTruncation = false, allowWrap = false }) => {
  const [isVisible, setIsVisible] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [isTruncated, setIsTruncated] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
      if (checkForTruncation && contentRef.current) {
          const el = contentRef.current.firstChild as HTMLElement;
          if (el && el.scrollWidth > el.clientWidth) {
              setIsTruncated(true);
          } else {
              setIsTruncated(false);
          }
      }
  }, [children, checkForTruncation]);

  const updatePosition = useCallback(() => {
    if (anchorRef.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Estimate tooltip dimensions
        const estWidth = allowWrap ? 260 : Math.min(text.length * 7 + 16, 260);
        const estHeight = allowWrap ? 60 : 32;

        // SPEC: prefer ABOVE the anchor. Default: top center, above.
        // The tooltip appears directly above the metric value, not below.
        let top = rect.top - estHeight - 8;
        let left = rect.left + (rect.width / 2);
        let shouldFlip = false;

        // If not enough room above, flip to below
        if (top < 8) {
            top = rect.bottom + 8;
            shouldFlip = true;
        }

        // If too close to right edge, shift left
        if (left + estWidth / 2 > viewportWidth - 8) {
            left = viewportWidth - estWidth / 2 - 8;
        }

        // If too close to left edge, shift right
        if (left - estWidth / 2 < 8) {
            left = estWidth / 2 + 8;
        }

        setCoords({ top, left });
        // flipped is currently unused but kept for potential future arrow rendering
        void shouldFlip;
    }
  }, [text, allowWrap]);

  const handleMouseEnter = () => {
    if (checkForTruncation && !isTruncated) return;
    if (!text) return;
    updatePosition();
    setIsVisible(true);
  };

  // SPEC §4.2: "appearing only on mouse hover" — NO onFocus/onBlur handlers.
  // Previously, onFocus/onBlur caused the tooltip to get stuck visible on
  // touch devices (tap → focus → tooltip shows, but no blur event fires
  // because there's no mouse leaving). Removing focus handlers ensures the
  // tooltip is purely mouse-driven and never gets stuck.
  // Keyboard users still get the text via the anchor element's own title
  // attribute or aria-label, set by the parent component.

  return (
    <>
      <div
        ref={anchorRef}
        className={`relative inline-block ${className || ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsVisible(false)}
      >
        <div ref={contentRef}>{children}</div>
      </div>
      {isVisible && createPortal(
        <div
          ref={portalRef}
          className={`fixed z-50 pointer-events-none px-2.5 py-1 text-xs font-medium text-white bg-slate-900 dark:bg-slate-900 border border-slate-700 dark:border-slate-700 rounded-md shadow-xl animate-fade-in ${allowWrap ? 'max-w-[260px] whitespace-normal' : 'whitespace-nowrap max-w-[260px]'}`}
          style={{
            top: coords.top,
            left: coords.left,
            transform: 'translateX(-50%)'
          }}
        >
          {text}
        </div>,
        document.body
      )}
    </>
  );
};

export default Tooltip;
