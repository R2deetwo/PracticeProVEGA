
import * as React from 'react';
import { motion, AnimatePresence, PanInfo, useDragControls } from 'framer-motion';
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
    const dragControls = useDragControls();

    // Auto-minimize when a modal opens on narrow screens
    React.useEffect(() => {
        if (dockedModalType && window.innerWidth < 1280 && isPanelOpen && !isMinimized) {
            setIsMinimized(true);
        }
    }, [dockedModalType, isPanelOpen, isMinimized, setIsMinimized]);

    const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isShifted = isPanelOpen && !isMinimized && dockedModalType && window.innerWidth >= 1280;
    const isFullVisible = isPanelOpen && !isMinimized;

    // ─── Close handler ──────────────────────────────────────────────────
    // Wraps closePanel with haptic feedback. This is the DISMISS action —
    // the panel disappears entirely (both isPanelOpen and isMinimized go false).
    const handleClose = React.useCallback(() => {
        light();
        closePanel();
    }, [closePanel, light]);

    // ─── Minimize handler ───────────────────────────────────────────────
    // Wraps setIsMinimized(true) with haptic feedback. This is the MINIMIZE
    // action — the panel shrinks to MiniAloa (isPanelOpen stays true,
    // isMinimized goes true). The full panel unmounts, MiniAloa mounts.
    const handleMinimize = React.useCallback(() => {
        light();
        setIsMinimized(true);
    }, [setIsMinimized, light]);

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (info.offset.x > 100 || info.velocity.x > 500) {
            medium();
            closePanel();
        }
    };

    const panelVariants = {
        hidden: (mobile: boolean) => ({ x: mobile ? '100%' : 500, opacity: 0 }),
        visible: { x: 0, opacity: 1, transition: { type: 'spring' as const, damping: 30, stiffness: 300 } },
        exit: (mobile: boolean) => ({ x: mobile ? '100%' : 500, opacity: 0, transition: { type: 'spring' as const, damping: 30, stiffness: 400 } }),
    };

    return (
        <>
            <AnimatePresence>
                {isFullVisible && (
                    <>
                        {/* Backdrop — clicking it dismisses the panel entirely */}
                        <motion.div
                            className={`fixed inset-0 z-[1999] ${isMobile ? 'bg-black/60 backdrop-blur-md' : 'bg-black/5 backdrop-blur-[2px]'}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={handleClose}
                        />

                        <motion.div
                            className={`fixed top-0 bottom-0 right-0 h-[100dvh] z-[2000] flex flex-col bg-white dark:bg-zinc-950 border-l border-slate-200 dark:border-zinc-800 shadow-[-10px_0_30px_rgba(0,0,0,0.1)] ${isMobile ? 'w-full inset-0 rounded-none' : 'w-[480px] max-w-[calc(100vw-40px)] rounded-l-[32px] overflow-hidden'}`}
                            custom={isMobile}
                            variants={panelVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            drag={isMobile ? 'x' : false}
                            dragControls={dragControls}
                            dragListener={false}
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={{ left: 0, right: 0.5 }}
                            onDragEnd={handleDragEnd}
                            style={{ right: isShifted ? '480px' : '0' }}
                        >
                            {/* Drag handle — the ONLY element that starts the drag.
                                The close button, minimize button, and chat content
                                below remain fully tappable. */}
                            {isMobile && (
                                <div
                                    onPointerDown={(e) => dragControls.start(e)}
                                    className="flex-shrink-0 flex justify-center pt-2.5 pb-2 bg-slate-50/50 dark:bg-zinc-900/50 cursor-grab active:cursor-grabbing"
                                    style={{ touchAction: 'none' }}
                                >
                                    <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-600" />
                                </div>
                            )}
                            {isPanelOpen && (
                                <AloaChat
                                    onClose={handleClose}
                                    onMinimize={handleMinimize}
                                    isMobile={isMobile}
                                />
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {isPanelOpen && isMinimized && (
                <ErrorBoundary fallback={<div className="fixed bottom-24 right-4 bg-red-500 text-white p-2">Mini Assistant Error</div>}>
                    <MiniAloa />
                </ErrorBoundary>
            )}
        </>
    );
};

export default AloaPanel;
