
import * as React from 'react';
import { useAloa } from '../../contexts/AloaProvider';
import Tooltip from '../Tooltip';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useProduct } from '../../contexts/ProductContext';
import { useAuth } from '../../contexts/AuthContext';
import { AloaIcon, LockClosedIcon, MicrophoneIcon } from '../../constants';
import { useFeatures } from '../../hooks/useFeatures';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { stampVoxUsedAt } from '../../utils/voxUsageTracking';
import { VoxUpsellModal } from '../quickcapture/VoxUpsellModal';
import { getAssistantName } from '../../utils/assistantIdentity';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

import { Z_CLASS } from '../../overlays/constants';
const AloaFAB: React.FC = () => {
    const { togglePanel, isPanelOpen, aloaState } = useAloa();
    const { coreState } = useCoreState();
    const { modal, dockedModalType, isMobileSearchOpen, openModal, navigateTo } = useUI();
    const { isProperty } = useProduct();
    const { canUseAI, canUseVox } = useFeatures();
    const { currentUser, bearerToken } = useAuth();
    const { light, medium } = useHapticFeedback();
    const assistantName = getAssistantName(isProperty);

    const aiFeaturesEnabled = coreState.firmDetails.aiSettings?.enableAllAiFeatures ?? true;
    const isAiActive = canUseAI && aiFeaturesEnabled;

    // ── §1.5(b) critical-insight dot ─────────────────────────────────────
    // The same deterministic insight data the chat empty state uses (same
    // query, same args — no new endpoints). Only CRITICAL items raise the
    // red dot; hidden when there are none.
    const showAiSuggestions = (currentUser as any).showAiSuggestions !== false;
    const firmId = currentUser?.firmId || coreState?.firmDetails?.id;
    const proactiveInsights = useQuery(
        api.proactive.getInsights,
        showAiSuggestions && firmId && bearerToken
            ? { firmId, dismissed: false, limit: 10, sessionToken: bearerToken ?? undefined, userEmail: currentUser?.email ?? undefined }
            : 'skip'
    );
    const criticalCount = React.useMemo(
        () => (proactiveInsights ?? []).filter((i: any) => i.severity === 'critical').length,
        [proactiveInsights]
    );

    // ── TAP vs LONG-PRESS (owner brief 2026-11-28) ──────────────────────
    // Tap = open ALOA (the copilot panel). Press-and-hold (≥450ms) = jump
    // straight into ALOA Vox with recording already running — one physical
    // button, two doors. Pointer Events give mouse, touch and pen one code
    // path; the timer is cleared on pointer up / leave / cancel so a scroll
    // that starts on the FAB never misfires Vox. select-none + the
    // callout/style guards stop Android's long-press text-selection and
    // context menus from racing the gesture.
    const [showVoxUpsell, setShowVoxUpsell] = React.useState(false);
    const LONG_PRESS_MS = 450;
    const pressTimerRef = React.useRef<number | null>(null);
    const longPressedRef = React.useRef(false);

    const clearPressTimer = React.useCallback(() => {
        if (pressTimerRef.current !== null) {
            window.clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
        }
    }, []);

    // Safety net: an unmount mid-hold must never leave a pending timer.
    React.useEffect(() => clearPressTimer, [clearPressTimer]);

    const openVoxWithAutorecord = React.useCallback(() => {
        if (!canUseVox) {
            // The same door the locked Vox tab uses — the dedicated Vox
            // upgrade card, never a dead long-press.
            setShowVoxUpsell(true);
            return;
        }
        stampVoxUsedAt();
        // Date.now() nonce: every hold is a fresh auto-start instruction,
        // so holding again later re-arms recording even from the same view.
        navigateTo('quickCapture', null, { voxAutoStart: Date.now() });
    }, [canUseVox, navigateTo]);

    const handlePressStart = React.useCallback(
        (e: React.PointerEvent<HTMLButtonElement>) => {
            // Secondary mouse buttons keep their native context-menu path.
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            longPressedRef.current = false;
            clearPressTimer();
            pressTimerRef.current = window.setTimeout(() => {
                pressTimerRef.current = null;
                longPressedRef.current = true;
                medium();
                openVoxWithAutorecord();
            }, LONG_PRESS_MS);
        },
        [clearPressTimer, medium, openVoxWithAutorecord]
    );

    const handlePressEnd = React.useCallback(() => clearPressTimer(), [clearPressTimer]);

    // HIDE FAB IF ANY MODAL OR SEARCH IS OPEN
    if (modal || dockedModalType || isMobileSearchOpen) return null;

    // ADR-0007 (one door): the FAB no longer self-hides in ANY view.
    // It used to vanish in research/messaging — exactly the views where a
    // user doing legal work needed the assistant door, and where the
    // research notebook chat (a second AI face) lived instead. Aloa is the
    // single user-facing assistant; its door is reachable everywhere.
    const isHidden = false;

    const handleClick = () => {
        // A completed long-press already opened ALOA Vox — swallow the
        // trailing click so the FAB doesn't ALSO open the copilot panel.
        if (longPressedRef.current) {
            longPressedRef.current = false;
            return;
        }
        if (!isAiActive) {
            // 2026-09-23 audit: this used to be a silent no-op, which made
            // the FAB a dead button for every free-tier firm (AI is
            // Growth+) — the exact audience the free-first wizard default
            // now funnels in. Route the click to the upgrade modal instead
            // so the button always explains itself.
            openModal('upgradePlan', null, { featureName: `${assistantName} AI Copilot` });
            return;
        }

        const hasConsent = localStorage.getItem('practicepro_ai_consent') === 'true';
        if (!hasConsent) {
            openModal('aiConsent', null, {
                onConsent: () => togglePanel()
            });
            return;
        }

        togglePanel();
    };

    // Hide FAB when the full panel is open
    if (isPanelOpen) return null;

    const isListening = aloaState === 'listening';
    const isSpeaking = aloaState === 'thinking' || aloaState === 'connecting';

    let bgClass = isAiActive ? 'bg-primary-600 hover:bg-primary-700' : 'bg-slate-700 hover:bg-slate-600';
    if (isListening) bgClass = 'bg-red-600 hover:bg-red-700';

    // ── §1.5(c) recording state: keep the red pulse, but honour
    // prefers-reduced-motion — a STATIC ring carries the same signal
    // (motion-safe:animate-pulse simply doesn't animate under reduce).
    let animationClass = '';
    if (isListening) animationClass = 'ring-4 ring-red-400/50 motion-safe:animate-pulse';
    else if (isSpeaking) animationClass = 'motion-safe:animate-pulse';

    // ── §1.5(a) ONE accessible name per state — tooltip and aria-label
    // always agree (no registered-trademark mark; assistantIdentity.ts
    // mandates none). The 2026-11-28 long-press shortcut is part of the
    // button's contract, so it is named in both.
    let accessibleName = `Open ${assistantName}`;
    if (!isAiActive) accessibleName = `Unlock ${assistantName}`;
    else if (isListening) accessibleName = `Open ${assistantName} — recording in progress`;
    else if (criticalCount > 0) accessibleName = `${assistantName}, ${criticalCount} alert${criticalCount === 1 ? '' : 's'}`;
    else accessibleName = `Open ${assistantName}`;
    const accessibleHint = ' — tap to open, press and hold to record with ALOA Vox';

    // Apply visibility transition — 200ms so the FAB settles with the
    // sheet reveal, not a slow float (Kowalski: snappier in, never sluggish).
    const visibilityClass = isHidden
        ? 'opacity-0 translate-y-4 pointer-events-none'
        : 'opacity-100 translate-y-0 pointer-events-auto';

    return (
        <>
        <div className={`fixed bottom-20 md:bottom-8 right-6 ${Z_CLASS.bottomNavVeil} transition-all duration-200 ease-out ${visibilityClass}`}>
            <Tooltip text={`${accessibleName}${accessibleHint}`}>
                <button
                    onClick={handleClick}
                    onPointerDown={handlePressStart}
                    onPointerUp={handlePressEnd}
                    onPointerLeave={handlePressEnd}
                    onPointerCancel={handlePressEnd}
                    onContextMenu={(e) => e.preventDefault()}
                    data-tour-id="aloa-fab"
                    aria-label={`${accessibleName}${accessibleHint}`}
                    style={{ WebkitTouchCallout: 'none' } as React.CSSProperties}
                    className={`
                        relative w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center
                        transition-all duration-150 active:scale-[0.98] focus:outline-none
                        select-none touch-manipulation [-webkit-touch-callout:none]
                        focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-zinc-900 focus:ring-primary-500
                        ${bgClass}
                        ${animationClass}
                    `}
                >
                    <div className="relative z-10">
                        {isListening ? (
                            <MicrophoneIcon className="w-7 h-7" />
                        ) : (
                            <AloaIcon className="w-8 h-8" />
                        )}
                    </div>

                    {/* §1.5(b): the amber lock badge (locked state) stays. */}
                    {!isAiActive && (
                        <div className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-1 shadow-sm border border-white z-20">
                            <LockClosedIcon className="w-3 h-3" />
                        </div>
                    )}

                    {/* §1.5(b): critical-insight count dot — red only for
                        critical items, hidden when 0. Sits opposite the lock
                        badge so the two never collide. */}
                    {isAiActive && criticalCount > 0 && (
                        <span
                            aria-hidden="true"
                            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 border-2 border-white text-white text-2xs font-black leading-[14px] text-center z-20"
                        >
                            {criticalCount}
                        </span>
                    )}
                </button>
            </Tooltip>
        </div>
        {/* VOX UPSELL (2026-11-28): a long-press on a locked Vox tier opens
            the SAME dedicated upgrade card the locked Vox tab uses. */}
        {showVoxUpsell && <VoxUpsellModal onClose={() => setShowVoxUpsell(false)} />}
        </>
    );
};

export default AloaFAB;
