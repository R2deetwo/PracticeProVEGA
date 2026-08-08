
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOnboarding } from '../contexts/OnboardingProvider';
import { useUI } from '../contexts/UIContext';
import { getTourStepsForProduct, isMobileViewport, TourStep } from '../onboardingConfig';
import { useProduct } from '../contexts/ProductContext';
import { DismissIcon, ChevronRightIcon, ChevronLeftIcon } from '../constants';

const OnboardingTour: React.FC = () => {
    const { isTourRunning, stepIndex, nextStep, backStep, stopTour } = useOnboarding();
    const { navigateTo, view } = useUI();
    const { product } = useProduct();
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(isMobileViewport());
    const tourRef = useRef<HTMLDivElement>(null);
    const targetObserverRef = useRef<MutationObserver | null>(null);

    // Get the list of tour steps, filtered for the current viewport.
    // Steps marked `skipOnMobile` are removed on small screens so the tour
    // flows naturally between visible targets only.
    const tourSteps = React.useMemo(() => {
        const all = getTourStepsForProduct(product);
        return isMobile ? all.filter(s => !s.skipOnMobile) : all;
    }, [product, isMobile]);

    const currentStep = tourSteps[stepIndex];

    // Track viewport changes — if the user rotates or resizes mid-tour, we
    // need to recompute the active target selector and reposition the card.
    useEffect(() => {
        const handler = () => {
            const next = isMobileViewport();
            setIsMobile(prev => prev !== next ? next : prev);
        };
        window.addEventListener('resize', handler);
        window.addEventListener('orientationchange', handler);
        return () => {
            window.removeEventListener('resize', handler);
            window.removeEventListener('orientationchange', handler);
        };
    }, []);

    // Recompute isMobile whenever the tour starts — the initial useState was
    // set at component mount which could be long before the user actually
    // starts the tour (e.g. they log in on desktop, then resize, then start
    // the tour, or they're in a Capacitor APK that was launched in landscape
    // and rotated to portrait).
    useEffect(() => {
        if (isTourRunning) {
            const next = isMobileViewport();
            setIsMobile(prev => prev !== next ? next : prev);
        }
    }, [isTourRunning]);

    // Resolve which CSS selector to use for the current step. On mobile we
    // prefer the mobileTarget if defined; otherwise fall back to the desktop
    // target. This lets us gracefully anchor to either the side panel or the
    // bottom nav depending on which is visible.
    const resolveTargetSelector = useCallback((step: TourStep): string => {
        if (isMobile && step.mobileTarget) return step.mobileTarget;
        return step.target;
    }, [isMobile]);

    // Smoothly scroll the target into the safe-area view before rendering
    // the tooltip. We use 'block: 'center'' for desktop targets and
    // 'block: 'nearest'' for mobile bottom-nav targets to avoid pushing the
    // nav off-screen.
    const scrollTargetIntoView = useCallback((el: Element, selector: string) => {
        const isBottomNav = selector.startsWith('[data-tour-id="nav-');
        try {
            el.scrollIntoView({
                behavior: 'smooth',
                block: isBottomNav ? 'nearest' : 'center',
                inline: 'center',
            });
        } catch {
            // Fallback for older WebView engines
            el.scrollIntoView({ behavior: 'smooth' });
        }
    }, []);

    useEffect(() => {
        if (!isTourRunning || !currentStep) {
            setIsVisible(false);
            return;
        }

        // Cleanup any previous observer
        if (targetObserverRef.current) {
            targetObserverRef.current.disconnect();
            targetObserverRef.current = null;
        }

        // Delay to allow any navigation/rendering to complete. Mobile may need
        // slightly longer because the bottom nav re-mounts on view changes.
        const delay = isMobile ? 450 : 300;
        const timer = setTimeout(() => {
            if (currentStep.navigateTo && currentStep.navigateTo !== view) {
                navigateTo(currentStep.navigateTo);
            }

            const selector = resolveTargetSelector(currentStep);

            const updatePosition = () => {
                let target: Element | null = null;
                if (selector === 'body') {
                    target = document.body;
                } else {
                    target = document.querySelector(selector);
                }

                if (target) {
                    const rect = (target as Element).getBoundingClientRect();
                    setTargetRect(rect);
                    setIsVisible(true);

                    if (selector !== 'body') {
                        scrollTargetIntoView(target, selector);
                    }
                } else {
                    // Target not found yet — watch for it appearing in the DOM
                    // (useful when the bottom nav re-renders after navigation)
                    if (!targetObserverRef.current) {
                        const observer = new MutationObserver(() => {
                            const retry = document.querySelector(selector);
                            if (retry) {
                                const rect = retry.getBoundingClientRect();
                                setTargetRect(rect);
                                setIsVisible(true);
                                scrollTargetIntoView(retry, selector);
                                observer.disconnect();
                                targetObserverRef.current = null;
                            }
                        });
                        observer.observe(document.body, { childList: true, subtree: true });
                        targetObserverRef.current = observer;
                    }
                    setIsVisible(false);
                }
            };

            updatePosition();
            window.addEventListener('resize', updatePosition);
            return () => window.removeEventListener('resize', updatePosition);
        }, delay);

        return () => {
            clearTimeout(timer);
            if (targetObserverRef.current) {
                targetObserverRef.current.disconnect();
                targetObserverRef.current = null;
            }
        };
    }, [isTourRunning, stepIndex, currentStep, navigateTo, view, isMobile, resolveTargetSelector, scrollTargetIntoView]);

    if (!isTourRunning || !currentStep || !isVisible) return null;

    const isFirstStep = stepIndex === 0;
    const isLastStep = stepIndex === tourSteps.length - 1;

    // Determine placement: mobile steps default to 'top' when targeting the
    // bottom nav so the card sits above the bar.
    const effectivePlacement = isMobile
        ? (currentStep.mobilePlacement || (currentStep.target === 'body' ? 'center' : 'top'))
        : (currentStep.placement || 'bottom');

    // ─── Mobile rendering: bottom-sheet / centered overlay ──────────────
    // On small viewports we render either a full-screen centered card (for
    // 'center' placement) or a bottom sheet (anchored above the bottom nav)
    // with thumb-friendly tap targets. This guarantees the card never
    // overflows or obscures the nav bar.
    if (isMobile) {
        const isCenter = effectivePlacement === 'center' || currentStep.target === 'body';
        // NOTE: We do NOT use `md:hidden` here. In a Capacitor APK running on
        // a tablet or BlueStacks landscape, `window.innerWidth` can be >= 768
        // even though the app is fundamentally mobile. We rely on the JS
        // `isMobile` state (which considers isNativePlatform()) to decide
        // which branch to render — CSS classes would hide the wrong branch.
        return (
            <div className="fixed inset-0 z-[9999] pointer-events-none">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px] transition-opacity duration-500 pointer-events-auto"
                    onClick={() => stopTour(false)}
                />

                {/* Spotlight on target (if any) */}
                {targetRect && currentStep.target !== 'body' && (
                    <div
                        className="absolute border-2 border-primary-500 bg-primary-500/10 rounded-lg transition-all duration-300 shadow-[0_0_0_9999px_rgba(15,23,42,0.55)]"
                        style={{
                            top: targetRect.top - 4,
                            left: targetRect.left - 4,
                            width: targetRect.width + 8,
                            height: targetRect.height + 8,
                        }}
                    />
                )}

                {/* Bottom sheet OR centered card */}
                {isCenter ? (
                    <div
                        ref={tourRef}
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-[400px] bg-white dark:bg-zinc-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-700 p-5 pointer-events-auto animate-in zoom-in-95 fade-in duration-300"
                    >
                        {renderCardContent({
                            step: currentStep,
                            stepIndex,
                            total: tourSteps.length,
                            isFirstStep,
                            isLastStep,
                            onSkip: () => stopTour(true),
                            onClose: () => stopTour(false),
                            onBack: backStep,
                            onNext: isLastStep ? () => stopTour(true) : nextStep,
                        })}
                    </div>
                ) : (
                    <div
                        ref={tourRef}
                        className="absolute left-2 right-2 bottom-[calc(env(safe-area-inset-bottom,0px)+88px)] bg-white dark:bg-zinc-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-700 p-5 pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-300"
                    >
                        {renderCardContent({
                            step: currentStep,
                            stepIndex,
                            total: tourSteps.length,
                            isFirstStep,
                            isLastStep,
                            onSkip: () => stopTour(true),
                            onClose: () => stopTour(false),
                            onBack: backStep,
                            onNext: isLastStep ? () => stopTour(true) : nextStep,
                        })}
                    </div>
                )}
            </div>
        );
    }

    // ─── Desktop rendering (unchanged original positioning logic) ────────
    let style: React.CSSProperties = {};
    if (currentStep.target === 'body' || effectivePlacement === 'center') {
        style = {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            position: 'fixed'
        };
    } else if (targetRect) {
        const gap = 12;
        const cardWidth = 320;
        const cardHeight = 200; // Approximate height for boundary calculation
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let left = 0;
        let top = 0;
        let transform = '';

        switch (effectivePlacement) {
            case 'bottom':
                left = targetRect.left + (targetRect.width / 2);
                top = targetRect.bottom + gap;
                transform = 'translateX(-50%)';
                if (left - (cardWidth / 2) < gap) {
                    left = gap + (cardWidth / 2);
                } else if (left + (cardWidth / 2) > viewportWidth - gap) {
                    left = viewportWidth - gap - (cardWidth / 2);
                }
                break;

            case 'top':
                left = targetRect.left + (targetRect.width / 2);
                top = targetRect.top - gap;
                transform = 'translate(-50%, -100%)';
                if (left - (cardWidth / 2) < gap) {
                    left = gap + (cardWidth / 2);
                } else if (left + (cardWidth / 2) > viewportWidth - gap) {
                    left = viewportWidth - gap - (cardWidth / 2);
                }
                break;

            case 'right':
                left = targetRect.right + gap;
                top = targetRect.top + (targetRect.height / 2);
                transform = 'translateY(-50%)';
                if (top - (cardHeight / 2) < gap) {
                    top = gap + (cardHeight / 2);
                } else if (top + (cardHeight / 2) > viewportHeight - gap) {
                    top = viewportHeight - gap - (cardHeight / 2);
                }
                if (left + cardWidth > viewportWidth - gap) {
                    left = targetRect.left - gap;
                    transform = 'translate(-100%, -50%)';
                }
                break;

            case 'left':
                left = targetRect.left - gap;
                top = targetRect.top + (targetRect.height / 2);
                transform = 'translate(-100%, -50%)';
                if (top - (cardHeight / 2) < gap) {
                    top = gap + (cardHeight / 2);
                } else if (top + (cardHeight / 2) > viewportHeight - gap) {
                    top = viewportHeight - gap - (cardHeight / 2);
                }
                if (left - cardWidth < gap) {
                    left = targetRect.right + gap;
                    transform = 'translateY(-50%)';
                }
                break;

            default:
                left = targetRect.left + (targetRect.width / 2);
                top = targetRect.bottom + gap;
                transform = 'translateX(-50%)';
        }

        style = {
            top,
            left,
            transform,
            position: 'absolute'
        };
    }

    return (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] transition-opacity duration-500 pointer-events-auto"
                onClick={() => stopTour(false)}
            />

            {/* Spotlight */}
            {targetRect && currentStep.target !== 'body' && (
                <div
                    className="absolute border-2 border-primary-500 bg-primary-500/10 rounded-lg transition-all duration-300 shadow-[0_0_0_9999px_rgba(15,23,42,0.5)]"
                    style={{
                        top: targetRect.top - 4,
                        left: targetRect.left - 4,
                        width: targetRect.width + 8,
                        height: targetRect.height + 8,
                    }}
                />
            )}

            {/* Tour Card */}
            <div
                ref={tourRef}
                className="absolute w-[320px] bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-700 p-5 pointer-events-auto animate-in zoom-in-95 fade-in duration-300"
                style={style}
            >
                {renderCardContent({
                    step: currentStep,
                    stepIndex,
                    total: tourSteps.length,
                    isFirstStep,
                    isLastStep,
                    onSkip: () => stopTour(true),
                    onClose: () => stopTour(false),
                    onBack: backStep,
                    onNext: isLastStep ? () => stopTour(true) : nextStep,
                })}

                {/* Arrow */}
                {currentStep.target !== 'body' && (
                    <div
                        className={`absolute w-3 h-3 bg-white dark:bg-zinc-800 border-l border-t border-slate-200 dark:border-zinc-700 transform rotate-45 
                            ${effectivePlacement === 'bottom' ? '-top-1.5 left-1/2 -translate-x-1/2 rotate-[45deg]' : ''}
                            ${effectivePlacement === 'top' ? '-bottom-1.5 left-1/2 -translate-x-1/2 rotate-[225deg]' : ''}
                            ${effectivePlacement === 'right' ? '-left-1.5 top-1/2 -translate-y-1/2 rotate-[315deg]' : ''}
                            ${effectivePlacement === 'left' ? '-right-1.5 top-1/2 -translate-y-1/2 rotate-[135deg]' : ''}
                        `}
                    />
                )}
            </div>
        </div>
    );
};

// ─── Shared card content renderer ─────────────────────────────────────────
// Extracted so the desktop and mobile layouts share the same inner markup.
// Mobile gets larger tap targets (min-h-[44px]) and a more prominent CTA.
function renderCardContent({
    step,
    stepIndex,
    total,
    isFirstStep,
    isLastStep,
    onSkip,
    onClose,
    onBack,
    onNext,
}: {
    step: TourStep;
    stepIndex: number;
    total: number;
    isFirstStep: boolean;
    isLastStep: boolean;
    onSkip: () => void;
    onClose: () => void;
    onBack: () => void;
    onNext: () => void;
}) {
    return (
        <>
            <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                aria-label="Close tour"
            >
                <DismissIcon className="w-4 h-4" />
            </button>

            <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-2xs font-bold rounded-full uppercase tracking-wider">
                        Step {stepIndex + 1} of {total}
                    </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                    {step.title}
                </h3>
            </div>

            <p className="text-sm text-slate-600 dark:text-zinc-400 mb-6 leading-relaxed">
                {step.content}
            </p>

            <div className="flex items-center justify-between gap-3">
                <button
                    onClick={onSkip}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 min-h-[36px] px-2"
                >
                    Skip Tour
                </button>

                <div className="flex items-center gap-2">
                    {!isFirstStep && (
                        <button
                            onClick={onBack}
                            className="p-2.5 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                            aria-label="Previous step"
                        >
                            <ChevronLeftIcon className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={onNext}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-bold rounded-lg shadow-lg hover:bg-primary-700 transition-all transform active:scale-95 min-h-[44px]"
                    >
                        {isLastStep ? 'Complete' : 'Got it'}
                        {!isLastStep && <ChevronRightIcon className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </>
    );
}

export default OnboardingTour;
