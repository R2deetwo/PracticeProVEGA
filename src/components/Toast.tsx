/**
 * Toast — Unified glassmorphic toast component.
 *
 * DESIGN PRINCIPLES:
 * - Glassmorphic dark container (backdrop-blur-xl) with subtle border
 * - Large rounded-square icon container (left-anchored)
 * - Contextual color + icon mapping (success/error/info/warning)
 * - Top-right [X] close button for quick dismissal
 * - Swipe-to-dismiss on mobile (horizontal swipe)
 * - Smooth Y-axis slide-in/fade-out animation
 * - Golden Ratio spacing (padding follows 1.618 ratio)
 *
 * STACKING:
 * - ToastContainer handles stacking order (newest at bottom)
 * - Max 3 visible simultaneously (enforced in UIContext.addToast)
 * - Debounced within 2s window (identical messages suppressed)
 *
 * The "Update Available" variant (ToastRefreshNotification) is a separate
 * component that does NOT use this Toast — it has its own persistent,
 * non-auto-dismissing behavior with a pulsing green indicator dot.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Toast as ToastType } from '../types';

interface ToastProps {
  toast: ToastType;
  onRemove: (id: number) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startXRef = useRef(0);
  const startTimeRef = useRef(0);

  const handleManualClose = () => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const handleLinkClick = () => {
    if (toast.link) {
      toast.link.onClick();
      handleManualClose();
    }
  };

  // ─── Swipe-to-dismiss (mobile only) ──────────────────────────────
  // Horizontal swipe right dismisses the toast. Only activates on
  // touch devices to avoid interfering with mouse interactions.
  const onTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    startTimeRef.current = Date.now();
    setIsSwiping(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    const deltaX = e.touches[0].clientX - startXRef.current;
    if (deltaX > 0) {
      setSwipeOffset(deltaX);
    }
  };

  const onTouchEnd = () => {
    if (!isSwiping) return;
    const deltaX = swipeOffset;
    const deltaTime = Date.now() - startTimeRef.current;
    setIsSwiping(false);

    // Dismiss if swiped more than 80px OR swiped fast (>0.5px/ms)
    if (deltaX > 80 || (deltaX > 40 && deltaTime < 300)) {
      setSwipeOffset(400); // Animate off-screen
      setTimeout(() => onRemove(toast.id), 200);
    } else {
      setSwipeOffset(0); // Snap back
    }
  };

  // ─── Contextual icon + color mapping ─────────────────────────────
  const config = {
    success: {
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      iconBg: 'bg-gradient-to-br from-emerald-500 to-green-600',
      accent: 'border-emerald-500/30',
    },
    error: {
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      ),
      iconBg: 'bg-gradient-to-br from-rose-500 to-red-600',
      accent: 'border-rose-500/30',
    },
    info: {
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      ),
      iconBg: 'bg-gradient-to-br from-blue-500 to-violet-600',
      accent: 'border-blue-500/30',
    },
    warning: {
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      ),
      iconBg: 'bg-gradient-to-br from-amber-500 to-yellow-600',
      accent: 'border-amber-500/30',
    },
  };

  const style = config[toast.type] || config.info;

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        transform: `translateX(${swipeOffset}px)`,
        transition: isSwiping ? 'none' : 'transform 0.3s ease-out, opacity 0.3s ease-out',
        opacity: swipeOffset > 200 ? 0 : 1,
      }}
      className={`
        group relative w-full max-w-sm pointer-events-auto overflow-hidden
        transition-all duration-300 ease-out
        ${isExiting ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100'}
      `}
    >
      {/* Glassmorphic container */}
      <div className={`relative rounded-2xl border ${style.accent} shadow-2xl overflow-hidden`}>
        {/* Glassmorphic background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 to-slate-800/95 dark:from-slate-900/98 dark:to-zinc-900/98 backdrop-blur-xl" />

        {/* Content */}
        <div className="relative p-4 pr-10">
          <div className="flex items-start gap-3">
            {/* Large rounded-square icon container */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${style.iconBg} flex items-center justify-center shadow-lg`}>
              {style.icon}
            </div>
            {/* Message */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="text-sm font-medium text-white leading-snug">
                {toast.message}
              </div>
              {toast.link && (
                <button
                  onClick={handleLinkClick}
                  className="mt-1.5 text-xs font-bold text-primary-400 hover:text-primary-300 focus:outline-none focus:underline transition-colors"
                >
                  {toast.link.text}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Top-right [X] close button */}
        <button
          onClick={handleManualClose}
          className="absolute top-2 right-2 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Toast;
