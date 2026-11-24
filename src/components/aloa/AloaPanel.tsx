
import * as React from 'react';
import { useAloa } from '../../contexts/AloaProvider';
import { AloaChat } from './AloaChat';
import { useUI } from '../../contexts/UIContext';
import ErrorBoundary from '../ErrorBoundary';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
// Owner addendum (2026-11-18): "House Quick Capture inside the ALOA
// section" — the panel is one unified home for voice, dictation and AI:
// 'chat' renders the main ALOA assistant, 'capture' renders the same
// Quick Capture surface used full-screen (embedded, with a back-to-chat
// button and the persistent Full Office button).
import { QuickCaptureView } from '../quickcapture/QuickCaptureView';
// 7-day Vox-card rule (owner brief 2026-11-24): entering capture mode =
// "launched Aloa Vox" — stamp the usage timestamp.
import { stampVoxUsedAt } from '../../utils/voxUsageTracking';

import { Z_CLASS } from '../../overlays/constants';
const AloaPanel: React.FC = () => {
    const { isPanelOpen, closePanel, panelInitialMode } = useAloa();
    const { dockedModalType } = useUI();
    const { light } = useHapticFeedback();

    // Mobile detection
    const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ── Top-level panel mode: Chat | Quick Capture ──────────────────────
    // Initialized from the requested mode when the panel opens (the Header
    // mic button / Dashboard card call openPanel('capture')), reset to chat
    // when it closes so the next open starts fresh.
    const [mode, setMode] = React.useState<'chat' | 'capture'>('chat');
    const wasOpenRef = React.useRef(false);
    React.useEffect(() => {
        if (isPanelOpen && !wasOpenRef.current) {
            setMode(panelInitialMode);
            // Launching straight into capture = launching Aloa Vox.
            if (panelInitialMode === 'capture') stampVoxUsedAt();
        }
        if (!isPanelOpen && wasOpenRef.current) {
            setMode('chat');
        }
        wasOpenRef.current = isPanelOpen;
    }, [isPanelOpen, panelInitialMode]);

    // AloaChat's "use voice instead" hand-off also enters Vox — stamp
    // that as a launch too (7-day card rule).
    const openCaptureMode = React.useCallback(() => {
        stampVoxUsedAt();
        setMode('capture');
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
                    className={`fixed inset-0 ${Z_CLASS.panelVeil} transition-opacity duration-200 ${isMobile ? 'bg-black/40' : 'bg-black/5'}`}
                    onClick={handleClose}
                />
            )}

            {/* Main Side Panel */}
            {isPanelOpen && (
                <div
                    className={`fixed top-0 bottom-0 right-0 h-[100dvh] ${Z_CLASS.sidePanel} flex flex-col bg-white dark:bg-zinc-950 border-l border-slate-200 dark:border-zinc-800 animate-in slide-in-from-right duration-200 ${isMobile ? 'w-full inset-0 rounded-none' : 'w-[520px] max-w-[calc(100vw-40px)] rounded-l-2xl overflow-hidden'}`}
                    style={{ right: isShifted ? '520px' : '0' }}
                    // Only stop click propagation (NOT touch) so the backdrop
                    // doesn't close the panel when clicking inside it. Touch
                    // events are handled by onPointerDown on the buttons.
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Mobile drag handle — visual only. */}
                    {isMobile && mode === 'chat' && (
                        <div className="flex-shrink-0 flex justify-center pt-2 pb-1 bg-slate-50/50 dark:bg-zinc-900/50">
                            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-700" />
                        </div>
                    )}
                    {mode === 'capture' ? (
                        // Quick Capture renders its own header inside the
                        // panel: back-to-ALOA-chat, "Start in Quick Capture
                        // on mobile" toggle, and the persistent Full Office
                        // button (which exits the panel for the dashboard).
                        <ErrorBoundary>
                            <QuickCaptureView
                                embedded
                                onBackToChat={() => setMode('chat')}
                                onExitEmbedded={closePanel}
                            />
                        </ErrorBoundary>
                    ) : (
                        <AloaChat
                            onClose={handleClose}
                            isMobile={isMobile}
                            onOpenCapture={openCaptureMode}
                        />
                    )}
                </div>
            )}
        </>
    );
};

export default AloaPanel;
