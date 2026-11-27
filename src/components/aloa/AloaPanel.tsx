
import * as React from 'react';
import { useAloa } from '../../contexts/AloaProvider';
import { AloaChat } from './AloaChat';
import { useUI } from '../../contexts/UIContext';
import ErrorBoundary from '../ErrorBoundary';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
// Owner addendum (2026-11-18): "House Quick Capture inside the ALOA
// section" — the panel is one unified home for voice, dictation and AI.
// ROUND 24 (§1.1 one navigation model): the panel owns EXACTLY ONE top row
// in every mode — [ALOA mark] · [segmented: Ask | Vox | Court] · [Close].
// 'chat' renders the ALOA assistant pane ("Ask"), 'capture' the Vox
// Consultation/Note pane, 'court' the Court Mode pane. Pane headers keep
// only pane-specific actions; mode-level nav lives in this row alone.
import { QuickCaptureView } from '../quickcapture/QuickCaptureView';
import { AloaCourtMode } from './AloaCourtMode';
import { SegmentedToggle } from './court/SegmentedToggle';
// 7-day Vox-card rule (owner brief 2026-11-24): entering capture mode =
// "launched Aloa Vox" — stamp the usage timestamp.
import { stampVoxUsedAt } from '../../utils/voxUsageTracking';
// ROUND 24 (§1.2 no accidental loss): Close/backdrop/Escape open the shared
// ConfirmDialog while a take is live — never a silent discard.
import { useConfirm } from '../ui/ConfirmDialog';
// ROUND 24 (§1.4 close semantics): Tab is trapped inside the panel while
// open; focus returns to the FAB on close (useFocusTrap restores it).
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { AloaIcon, XMarkIcon } from '../../constants';
import { Button } from '../ui/Button';

import { Z_CLASS } from '../../overlays/constants';
const AloaPanel: React.FC = () => {
    const { isPanelOpen, closePanel, panelInitialMode, panelInitialMatterId } = useAloa();
    const { dockedModalType } = useUI();
    const { light } = useHapticFeedback();
    const { confirm, ConfirmDialog } = useConfirm();

    // Mobile detection
    const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ── Top-level panel mode: Ask (chat) | Vox (capture) | Court ──────────
    // Initialized from the requested mode when the panel opens (deep links
    // still land directly in Court Mode), reset to chat when it closes so
    // the next open starts fresh.
    const [mode, setMode] = React.useState<'chat' | 'capture' | 'court'>('chat');
    // Each Vox pane reports whether a take is live so the switcher and the
    // close path never silently drop one (mirrors Court Mode's own leave
    // guard).
    const [captureBusy, setCaptureBusy] = React.useState(false);
    const [courtBusy, setCourtBusy] = React.useState(false);
    const wasOpenRef = React.useRef(false);
    React.useEffect(() => {
        if (isPanelOpen && !wasOpenRef.current) {
            setMode(panelInitialMode);
            // Launching straight into capture = launching Aloa Vox.
            if (panelInitialMode === 'capture') stampVoxUsedAt();
        }
        if (!isPanelOpen && wasOpenRef.current) {
            setMode('chat');
            setCaptureBusy(false);
            setCourtBusy(false);
        }
        wasOpenRef.current = isPanelOpen;
    }, [isPanelOpen, panelInitialMode]);

    const openCaptureMode = React.useCallback(() => {
        stampVoxUsedAt();
        setMode('capture');
    }, []);

    const openCourtMode = React.useCallback(() => {
        setMode('court');
    }, []);

    const isShifted = isPanelOpen && dockedModalType && window.innerWidth >= 1280;

    // ── §1.2 No accidental loss ──────────────────────────────────────────
    // A live take on either Vox pane: the busy pane registers how to STOP
    // the take while KEEPING what was recorded (Vox flushes its segments to
    // the on-device queue; Court Mode stops dictation and keeps the draft).
    const stopAndKeepRef = React.useRef<(() => Promise<unknown> | void) | null>(null);
    const registerStopAndKeep = React.useCallback((fn: (() => Promise<unknown> | void) | null) => {
        stopAndKeepRef.current = fn;
    }, []);

    const anyBusy = captureBusy || courtBusy;

    const handleClose = React.useCallback((e?: React.MouseEvent) => {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        light();
        closePanel();
    }, [closePanel, light]);

    // Close/backdrop/Escape while busy → ConfirmDialog, then stop-and-keep.
    const requestClose = React.useCallback(async () => {
        if (anyBusy) {
            const stop = await confirm({
                title: "Stop and keep what you've recorded?",
                message: 'Your recording is safe on this device. Stop it now and close ALOA?',
                confirmLabel: 'Stop and close',
                cancelLabel: 'Keep recording',
            });
            if (!stop) return;
            try { await stopAndKeepRef.current?.(); } catch { /* segments already flushed to the on-device queue */ }
        }
        handleClose();
    }, [anyBusy, confirm, handleClose]);

    // Escape closes only when not busy (§1.2). Sub-menus (Vox callout, gear
    // popover) keep their own Escape handling — this listener is on the
    // window only while the panel is open, and the busy case routes through
    // the same confirm as Close/backdrop.
    React.useEffect(() => {
        if (!isPanelOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            void requestClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isPanelOpen, requestClose]);

    // §1.1 segment switching: entering the Vox pane is a Vox launch
    // (7-day card rule); a live take locks every other segment.
    const switchMode = React.useCallback((next: string) => {
        const value = next as 'chat' | 'capture' | 'court';
        if (value === mode) return;
        if (value === 'capture') stampVoxUsedAt();
        setMode(value);
    }, [mode]);

    const disabledValues =
        mode === 'court' && courtBusy ? ['chat', 'capture']
        : mode === 'capture' && captureBusy ? ['chat', 'court']
        : [];

    // §1.4: Tab trapped inside the panel; focus returns to the FAB on close.
    const panelRef = React.useRef<HTMLDivElement>(null);
    useFocusTrap(panelRef, isPanelOpen);

    return (
        <>
            {/* Backdrop — ONLY uses onClick, NOT onTouchEnd (the previous
                onTouchEnd with preventDefault() was intercepting touch
                events meant for the panel's buttons on mobile). §1.2: the
                click routes through requestClose so a live take is never
                silently discarded — in ANY mode, desktop included. */}
            {isPanelOpen && (
                <div
                    className={`fixed inset-0 ${Z_CLASS.panelVeil} transition-opacity duration-200 ${isMobile ? 'bg-black/40' : 'bg-black/5'}`}
                    onClick={() => void requestClose()}
                />
            )}

            {/* Main Side Panel */}
            {isPanelOpen && (
                <div
                    ref={panelRef}
                    role="dialog"
                    aria-modal={isMobile ? true : undefined}
                    aria-label="ALOA"
                    className={`fixed top-0 bottom-0 right-0 h-[100dvh] ${Z_CLASS.sidePanel} flex flex-col bg-white dark:bg-zinc-950 border-l border-slate-200 dark:border-zinc-800 animate-in slide-in-from-right duration-200 ${isMobile ? 'w-full inset-0 rounded-none pt-[max(env(safe-area-inset-top,0px),var(--native-safe-top,0px))] pb-[max(env(safe-area-inset-bottom,0px),var(--native-safe-bottom,0px))]' : 'w-[520px] max-w-[calc(100vw-40px)] rounded-l-2xl overflow-hidden'}`}
                    style={{ right: isShifted ? '520px' : '0' }}
                    // Only stop click propagation (NOT touch) so the backdrop
                    // doesn't close the panel when clicking inside it.
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* §1.1 THE one top row, owned by AloaPanel, in every
                        mode: ALOA mark · Ask | Vox | Court · Close. The old
                        visual-only drag handle is deleted (§1.3) and the old
                        per-pane mode navigation (chat Close/mic, Vox `< ALOA`
                        back, Court mode-level Back) lives here instead. */}
                    <div className="flex flex-shrink-0 items-center gap-2 border-b border-slate-200 dark:border-zinc-800 bg-white px-3 py-2 dark:bg-zinc-950">
                        <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0" aria-hidden="true">
                            <AloaIcon className="w-6 h-6 text-primary-600" />
                            <span className="text-sm font-extrabold text-slate-900 dark:text-white hidden sm:inline">ALOA</span>
                        </div>
                        <div className="flex-1 flex justify-center min-w-0">
                            <SegmentedToggle
                                label="ALOA pane"
                                options={[
                                    { value: 'chat', label: 'Ask' },
                                    { value: 'capture', label: 'Vox' },
                                    { value: 'court', label: 'Court' },
                                ]}
                                value={mode}
                                onChange={switchMode}
                                disabledValues={disabledValues}
                                disabledReason="Finish or discard the dictation first."
                            />
                        </div>
                        {/* §1.4 Close semantics: onClick (not pointerdown),
                            44x44 target, label shown ≥sm. */}
                        <Button
                            variant="ghost"
                            size="md"
                            icon={XMarkIcon}
                            onClick={(e) => { e.stopPropagation(); void requestClose(); }}
                            aria-label="Close"
                            title="Close"
                            className="flex-shrink-0"
                        >
                            <span className="hidden sm:inline">Close</span>
                        </Button>
                    </div>

                    {mode === 'court' ? (
                        <ErrorBoundary>
                            <AloaCourtMode
                                onClose={() => handleClose()}
                                initialMatterId={panelInitialMatterId ?? undefined}
                                onCaptureBusyChange={setCourtBusy}
                                registerStopAndKeep={registerStopAndKeep}
                            />
                        </ErrorBoundary>
                    ) : mode === 'capture' ? (
                        // Vox: the embedded pane keeps only pane-specific
                        // chrome (the thin Vox sub-row + the bottom mode
                        // bar); the panel top row owns navigation.
                        <ErrorBoundary>
                            <QuickCaptureView
                                embedded
                                onExitEmbedded={closePanel}
                                onCaptureBusyChange={setCaptureBusy}
                                registerStopAndKeep={registerStopAndKeep}
                            />
                        </ErrorBoundary>
                    ) : (
                        <AloaChat
                            isMobile={isMobile}
                            onOpenCapture={openCaptureMode}
                            onOpenCourt={openCourtMode}
                            onClosePanel={() => handleClose()}
                        />
                    )}
                </div>
            )}
            {ConfirmDialog}
        </>
    );
};

export default AloaPanel;
