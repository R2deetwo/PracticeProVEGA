
import * as React from 'react';
import { useAloa } from '../../contexts/AloaProvider';
import { AloaChat } from './AloaChat';
import { useUI } from '../../contexts/UIContext';
import { MiniAloa } from './MiniAloa';
import ErrorBoundary from '../ErrorBoundary';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';

const AloaPanel: React.FC = () => {
    const { isPanelOpen, closePanel, isMinimized, setIsMinimized } = useAloa();
    const { dockedModalType } = useUI();
    const { light, medium } = useHapticFeedback();

    React.useEffect(() => {
        if (dockedModalType && window.innerWidth < 1280 && isPanelOpen && !isMinimized) {
            setIsMinimized(true);
        }
    }, [dockedModalType, isPanelOpen, isMinimized, setIsMinimized]);

    const handleMinimize = () => setIsMinimized(true);

    const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isShifted = isPanelOpen && !isMinimized && dockedModalType && window.innerWidth >= 1280;
    const isFullVisible = isPanelOpen && !isMinimized;

    // ── SWIPE-TO-CLOSE ──
    // Clean implementation: track deltaX, apply translateX in real-time,
    // on release: if > threshold → close, else → snap back to 0.
    const [dragX, setDragX] = React.useState(0);
    const [isDragging, setIsDragging] = React.useState(false);
    const startX = React.useRef(0);
    const startY = React.useRef(0);
    const hasMoved = React.useRef(false);
    const SWIPE_THRESHOLD = 100; // px to trigger close

    const onTouchStart = (e: React.TouchEvent) => {
        if (!isFullVisible || !isMobile) return;
        startX.current = e.touches[0].clientX;
        startY.current = e.touches[0].clientY;
        hasMoved.current = false;
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (!isFullVisible || !isMobile) return;
        const dx = e.touches[0].clientX - startX.current;
        const dy = e.touches[0].clientY - startY.current;

        // Only start dragging if horizontal movement dominates
        if (!hasMoved.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
            hasMoved.current = true;
            setIsDragging(true);
        }

        if (hasMoved.current && dx > 0) {
            setDragX(dx);
        }
    };

    const onTouchEnd = () => {
        if (!hasMoved.current) return;

        if (dragX > SWIPE_THRESHOLD) {
            // Close the panel
            medium();
            setDragX(0);
            setIsDragging(false);
            hasMoved.current = false;
            closePanel();
        } else {
            // Snap back
            setDragX(0);
            setIsDragging(false);
            hasMoved.current = false;
        }
    };

    // Compute transform
    const translateX = isFullVisible ? dragX : (isMobile ? window.innerWidth : 500);
    const opacity = isFullVisible ? Math.max(0.4, 1 - dragX / 400) : 1;

    return (
        <>
            {/* Mobile Backdrop */}
            {isFullVisible && isMobile && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-md z-[1999] transition-opacity duration-300"
                    style={{ opacity: isDragging ? opacity : 1 }}
                    onClick={closePanel}
                />
            )}

            {/* Desktop Backdrop */}
            {isFullVisible && !isMobile && !isShifted && (
                <div
                    className="fixed inset-0 bg-black/5 backdrop-blur-[2px] z-[1999] transition-opacity duration-300"
                    onClick={closePanel}
                />
            )}

            {/* Main Panel */}
            <div
                className={`
                    fixed top-0 bottom-0 right-0 h-[100dvh] z-[2000] flex flex-col
                    bg-white dark:bg-zinc-950
                    border-l border-slate-200 dark:border-zinc-800
                    shadow-[-10px_0_30px_rgba(0,0,0,0.1)]
                    ${isMobile ? 'w-full inset-0 rounded-none' : 'w-[480px] max-w-[calc(100vw-40px)] rounded-l-[32px] overflow-hidden'}
                    ${isDragging ? '' : 'transition-all duration-300 ease-out'}
                `}
                style={{
                    transform: `translateX(${translateX}px)`,
                    opacity: opacity,
                    pointerEvents: isFullVisible ? 'auto' : 'none',
                }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {/* Drag handle */}
                {isMobile && isFullVisible && (
                    <div
                        className="flex-shrink-0 flex justify-center pt-2 pb-1.5 bg-slate-50/50 dark:bg-zinc-900/50"
                        style={{ touchAction: 'pan-y' }}
                    >
                        <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-600" />
                    </div>
                )}
                {isPanelOpen && <AloaChat onClose={closePanel} onMinimize={isMobile ? closePanel : handleMinimize} isMobile={isMobile} />}
            </div>

            {/* Mini Floating Mode */}
            {isPanelOpen && isMinimized && (
                <ErrorBoundary fallback={<div className="fixed bottom-24 right-4 bg-red-500 text-white p-2">Mini ARIA Error</div>}>
                    <MiniAloa />
                </ErrorBoundary>
            )}
        </>
    );
};

export default AloaPanel;
