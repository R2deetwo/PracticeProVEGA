
import * as React from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
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

    // ── FRAMER MOTION GESTURE HANDLING ──
    // Framer Motion handles the drag physics natively — no manual transform
    // manipulation, no CSS transition conflicts, no state race conditions.
    // The panel follows the finger in real-time and snaps with spring physics.
    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const SWIPE_THRESHOLD = 100;
        const SWIPE_VELOCITY = 500;

        // Close if: dragged right past threshold OR flicked right with velocity
        if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > SWIPE_VELOCITY) {
            medium(); // Haptic feedback
            closePanel();
        }
        // Otherwise: Framer Motion's spring animation snaps it back to x: 0
    };

    // Panel animation variants
    const panelVariants = {
        hidden: (mobile: boolean) => ({
            x: mobile ? '100%' : 500,
            opacity: 0,
        }),
        visible: {
            x: 0,
            opacity: 1,
            transition: {
                type: 'spring' as const,
                damping: 30,
                stiffness: 300,
            },
        },
        exit: (mobile: boolean) => ({
            x: mobile ? '100%' : 500,
            opacity: 0,
            transition: {
                type: 'spring' as const,
                damping: 30,
                stiffness: 400,
            },
        }),
    };

    return (
        <>
            <AnimatePresence>
                {isFullVisible && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            className={`fixed inset-0 z-[1999] ${isMobile ? 'bg-black/60 backdrop-blur-md' : 'bg-black/5 backdrop-blur-[2px]'}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={closePanel}
                        />

                        {/* Main Panel — draggable with Framer Motion */}
                        <motion.div
                            className={`
                                fixed top-0 bottom-0 right-0 h-[100dvh] z-[2000] flex flex-col
                                bg-white dark:bg-zinc-950
                                border-l border-slate-200 dark:border-zinc-800
                                shadow-[-10px_0_30px_rgba(0,0,0,0.1)]
                                ${isMobile ? 'w-full inset-0 rounded-none' : 'w-[480px] max-w-[calc(100vw-40px)] rounded-l-[32px] overflow-hidden'}
                            `}
                            custom={isMobile}
                            variants={panelVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            // Drag configuration — only on mobile, only horizontal
                            drag={isMobile ? 'x' : false}
                            dragConstraints={{ left: 0, right: 0 }} // Allow overscroll but snap back
                            dragElastic={{ left: 0, right: 0.5 }} // Only allow dragging right
                            onDragEnd={handleDragEnd}
                            style={{
                                right: isShifted ? '480px' : '0',
                            }}
                        >
                            {/* Drag handle — visual affordance for swipe-to-close */}
                            {isMobile && (
                                <div className="flex-shrink-0 flex justify-center pt-2 pb-1.5 bg-slate-50/50 dark:bg-zinc-900/50 cursor-grab active:cursor-grabbing">
                                    <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-600" />
                                </div>
                            )}
                            {isPanelOpen && <AloaChat onClose={closePanel} onMinimize={isMobile ? closePanel : handleMinimize} isMobile={isMobile} />}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Mini Floating Mode */}
            {isPanelOpen && isMinimized && (
                <ErrorBoundary fallback={<div className="fixed bottom-24 right-4 bg-red-500 text-white p-2">Mini ALOA Error</div>}>
                    <MiniAloa />
                </ErrorBoundary>
            )}
        </>
    );
};

export default AloaPanel;
