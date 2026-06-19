
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
    const { light } = useHapticFeedback();

    // Auto-minimize on small screens when other modals open
    React.useEffect(() => {
        if (dockedModalType && window.innerWidth < 1280 && isPanelOpen && !isMinimized) {
            setIsMinimized(true);
        }
    }, [dockedModalType, isPanelOpen, isMinimized, setIsMinimized]);

    // Mobile detection
    const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isShifted = isPanelOpen && !isMinimized && dockedModalType && window.innerWidth >= 1280;
    const isFullVisible = isPanelOpen && !isMinimized;

    // ─── Button Handlers ──────────────────────────────────────────────
    // handleClose = DISMISS entirely (panel + mini both disappear)
    // handleMinimize = SHRINK to MiniAloa (full panel unmounts, mini shows)
    //
    // CRITICAL: Both handlers add haptic feedback and call stopPropagation
    // to prevent the backdrop's onClick from also firing.
    const handleClose = React.useCallback((e?: React.MouseEvent | React.TouchEvent) => {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        light();
        closePanel();
    }, [closePanel, light]);

    const handleMinimize = React.useCallback((e?: React.MouseEvent | React.TouchEvent) => {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        light();
        setIsMinimized(true);
    }, [setIsMinimized, light]);

    return (
        <>
            {/* Backdrop — ONLY uses onClick, NOT onTouchEnd.
                The previous onTouchEnd with preventDefault() was intercepting
                touch events meant for the panel's buttons on mobile. */}
            {isFullVisible && (
                <div
                    className={`fixed inset-0 z-[1999] transition-opacity duration-300 ${isMobile ? 'bg-black/60 backdrop-blur-md' : 'bg-black/5 backdrop-blur-[2px]'}`}
                    onClick={handleClose}
                />
            )}

            {/* Main Side Panel */}
            {isFullVisible && (
                <div
                    className={`fixed top-0 bottom-0 right-0 h-[100dvh] z-[2000] flex flex-col bg-white dark:bg-zinc-950 border-l border-slate-200 dark:border-zinc-800 shadow-[-10px_0_30px_rgba(0,0,0,0.1)] ${isMobile ? 'w-full inset-0 rounded-none' : 'w-[480px] max-w-[calc(100vw-40px)] rounded-l-[32px] overflow-hidden'}`}
                    style={{ right: isShifted ? '480px' : '0' }}
                    // CRITICAL: Stop propagation so clicks inside the panel
                    // don't bubble to the backdrop and trigger closePanel.
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                >
                    {/* Mobile drag handle — visual only, NOT a drag starter.
                        The previous version used onPointerDown to start a
                        Framer Motion drag, which intercepted button taps. */}
                    {isMobile && (
                        <div className="flex-shrink-0 flex justify-center pt-2 pb-1 bg-slate-50/50 dark:bg-zinc-900/50">
                            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-700" />
                        </div>
                    )}
                    <AloaChat
                        onClose={handleClose}
                        onMinimize={handleMinimize}
                        isMobile={isMobile}
                    />
                </div>
            )}

            {/* Mini Floating Mode — shown when minimized */}
            {isPanelOpen && isMinimized && (
                <ErrorBoundary fallback={<div className="fixed bottom-24 right-4 bg-red-500 text-white p-2">Mini Assistant Error</div>}>
                    <MiniAloa />
                </ErrorBoundary>
            )}
        </>
    );
};

export default AloaPanel;
