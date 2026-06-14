
import * as React from 'react';
import { useAloa } from '../../contexts/AloaProvider';
import { AloaChat } from './AloaChat';
import { useUI } from '../../contexts/UIContext';
import { MiniAloa } from './MiniAloa';
import ErrorBoundary from '../ErrorBoundary';

const AloaPanel: React.FC = () => {
    const { isPanelOpen, togglePanel, closePanel, isMinimized, setIsMinimized } = useAloa();
    const { dockedModalType } = useUI();

    // Auto-minimize on small screens when other modals open
    React.useEffect(() => {
        if (dockedModalType && window.innerWidth < 1280 && isPanelOpen && !isMinimized) {
            setIsMinimized(true);
        }
    }, [dockedModalType, isPanelOpen, isMinimized, setIsMinimized]);

    const handleMinimize = () => {
        setIsMinimized(true);
    };

    // Mobile detection
    const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // On large screens, shift left if a docked modal is open to show both side-by-side
    const isShifted = isPanelOpen && !isMinimized && dockedModalType && window.innerWidth >= 1280;

    // Use transform for smooth slide-in/out visibility of the MAIN panel
    // Allow main panel on mobile if NOT minimized
    const isFullVisible = isPanelOpen && !isMinimized;

    return (
        <>
            {/* Mobile Backdrop - only if fully open and on mobile (overlay mode) */}
            {isFullVisible && isMobile && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-md z-[1999] transition-opacity duration-300"
                    onClick={closePanel}
                />
            )}

            {/* Backdrop for desktop if not shifted */}
            {isFullVisible && !isMobile && !isShifted && (
                <div
                    className="fixed inset-0 bg-black/5 backdrop-blur-[2px] z-[1999] transition-opacity duration-300"
                    onClick={closePanel}
                />
            )}

            {/* Main Side Panel - Now supports mobile as an overlay */}
            <div
                className={`
                    fixed top-0 bottom-0 right-0 h-[100dvh] z-[2000] flex flex-col 
                    bg-white dark:bg-zinc-950
                    border-l border-slate-200 dark:border-zinc-800 shadow-[-10px_0_30px_rgba(0,0,0,0.1)]
                    transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]
                    ${isMobile ? 'w-full inset-0 rounded-none' : 'w-[480px] max-w-[calc(100vw-40px)] rounded-l-[32px] overflow-hidden'}
                    ${!isFullVisible ? 'pointer-events-none' : 'pointer-events-auto'}
                `}
                style={{
                    right: isShifted ? '480px' : '0',
                    transform: isFullVisible ? 'translateX(0)' : 'translateX(105%)',
                }}
            >
                {isPanelOpen && <AloaChat onClose={closePanel} onMinimize={isMobile ? closePanel : handleMinimize} isMobile={isMobile} />}
            </div>

            {/* Mini Floating Mode - Shown when minimized (on Desktop or Mobile) */}
            {isPanelOpen && isMinimized && (
                <ErrorBoundary fallback={<div className="fixed bottom-24 right-4 bg-red-500 text-white p-2">Mini ARIA Error</div>}>
                    <MiniAloa />
                </ErrorBoundary>
            )}
        </>
    );
};

export default AloaPanel;
