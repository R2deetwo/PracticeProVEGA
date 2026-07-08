
import * as React from 'react';
import { useAloa } from '../../contexts/AloaProvider';
import { AloaChat } from './AloaChat';
import { useUI } from '../../contexts/UIContext';
import ErrorBoundary from '../ErrorBoundary';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';

const AloaPanel: React.FC = () => {
    const { isPanelOpen, closePanel } = useAloa();
    const { dockedModalType } = useUI();
    const { light } = useHapticFeedback();

    // Mobile detection
    const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isShifted = isPanelOpen && dockedModalType && window.innerWidth >= 1280;

    // ─── Button Handlers ──────────────────────────────────────────────
    // handleClose = DISMISS the panel entirely.
    // The minimize button was removed — the panel is either open or closed.
    //
    // CRITICAL: The handler adds haptic feedback and calls stopPropagation
    // to prevent the backdrop's onClick from also firing.
    const handleClose = React.useCallback((e?: React.MouseEvent | React.TouchEvent) => {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        light();
        closePanel();
    }, [closePanel, light]);

    return (
        <>
            {/* Backdrop — ONLY uses onClick, NOT onTouchEnd.
                The previous onTouchEnd with preventDefault() was intercepting
                touch events meant for the panel's buttons on mobile. */}
            {isPanelOpen && (
                <div
                    className={`fixed inset-0 z-[1999] transition-opacity duration-300 ${isMobile ? 'bg-black/60 backdrop-blur-md' : 'bg-black/5 backdrop-blur-[2px]'}`}
                    onClick={handleClose}
                />
            )}

            {/* Main Side Panel */}
            {isPanelOpen && (
                <div
                    className={`fixed top-0 bottom-0 right-0 h-[100dvh] z-[2000] flex flex-col bg-white dark:bg-zinc-950 border-l border-slate-200 dark:border-zinc-800 shadow-[-10px_0_30px_rgba(0,0,0,0.1)] ${isMobile ? 'w-full inset-0 rounded-none' : 'w-[400px] max-w-[calc(100vw-40px)] rounded-l-[28px] overflow-hidden'}`}
                    style={{ right: isShifted ? '400px' : '0' }}
                    // Only stop click propagation (NOT touch) so the backdrop
                    // doesn't close the panel when clicking inside it. Touch
                    // events are handled by onPointerDown on the buttons.
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Mobile drag handle — visual only. */}
                    {isMobile && (
                        <div className="flex-shrink-0 flex justify-center pt-2 pb-1 bg-slate-50/50 dark:bg-zinc-900/50">
                            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-700" />
                        </div>
                    )}
                    <AloaChat
                        onClose={handleClose}
                        isMobile={isMobile}
                    />
                </div>
            )}
        </>
    );
};

export default AloaPanel;
