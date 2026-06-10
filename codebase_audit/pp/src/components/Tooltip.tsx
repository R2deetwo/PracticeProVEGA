
import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  className?: string;
  checkForTruncation?: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({ text, children, className, checkForTruncation = false }) => {
  const [isVisible, setIsVisible] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
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

  const updatePosition = () => {
    if (anchorRef.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        
        // Default: Bottom Center
        let top = rect.bottom + 8;
        let left = rect.left + (rect.width / 2);

        // Boundary checks
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // If too close to right edge, shift left
        if (left + 150 > viewportWidth) {
            left = rect.right - 20; 
        }
        
        // If too close to bottom, flip to top
        if (top + 40 > viewportHeight) {
            top = rect.top - 35;
        }

        setCoords({ top, left });
    }
  };

  const handleMouseEnter = () => {
    if (checkForTruncation && !isTruncated) return;
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
          className="fixed z-[9999] pointer-events-none px-2 py-1.5 text-xs font-medium text-white bg-slate-800 dark:bg-zinc-700 rounded shadow-lg animate-fade-in whitespace-nowrap max-w-xs truncate"
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
