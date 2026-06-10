
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

const Tooltip: React.FC<TooltipProps> = ({ text, children, className, checkForTruncation = false, allowWrap = false }) => {
  const [isVisible, setIsVisible] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [flipped, setFlipped] = useState(false);
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

        // Default: Bottom Center
        let top = rect.bottom + 8;
        let left = rect.left + (rect.width / 2);
        let shouldFlip = false;

        // If too close to bottom, flip to top
        if (top + estHeight > viewportHeight - 8) {
            top = rect.top - estHeight - 8;
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
        setFlipped(shouldFlip);
    }
  }, [text, allowWrap]);

  const handleMouseEnter = () => {
    if (checkForTruncation && !isTruncated) return;
    if (!text) return;
    updatePosition();
    setIsVisible(true);
  };

  return (
    <>
      <div 
        ref={anchorRef}
        className={`relative inline-block ${className || ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={handleMouseEnter}
        onBlur={() => setIsVisible(false)}
      >
        <div ref={contentRef}>{children}</div>
      </div>
      {isVisible && createPortal(
        <div 
          ref={portalRef}
          className={`fixed z-[9999] pointer-events-none px-3 py-2 text-[11px] font-medium text-white bg-slate-800 dark:bg-zinc-600 rounded-lg shadow-xl animate-fade-in border border-white/10 dark:border-white/5 ${allowWrap ? 'max-w-[260px] whitespace-normal' : 'whitespace-nowrap max-w-[260px]'}`}
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
