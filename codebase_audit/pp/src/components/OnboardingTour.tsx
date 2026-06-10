
import React, { useState, useEffect, useRef } from 'react';
import { useOnboarding } from '../contexts/OnboardingProvider';
import { useUI } from '../contexts/UIContext';
import { tourSteps } from '../onboardingConfig';
import { DismissIcon, ChevronRightIcon, ChevronLeftIcon } from '../constants';

const OnboardingTour: React.FC = () => {
    const { isTourRunning, stepIndex, nextStep, backStep, stopTour } = useOnboarding();
    const { navigateTo, view } = useUI();
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const tourRef = useRef<HTMLDivElement>(null);

    const currentStep = tourSteps[stepIndex];

    useEffect(() => {
        if (!isTourRunning || !currentStep) {
            setIsVisible(false);
            return;
        }

        // Delay to allow any navigation/rendering to complete
        const timer = setTimeout(() => {
            if (currentStep.navigateTo && currentStep.navigateTo !== view) {
                navigateTo(currentStep.navigateTo);
            }

            const updatePosition = () => {
                let target;
                if (currentStep.target === 'body') {
                    target = document.body;
                } else {
                    target = document.querySelector(currentStep.target);
                }

                if (target) {
                    const rect = target.getBoundingClientRect();
                    setTargetRect(rect);
                    setIsVisible(true);

                    // Scroll target into view if not 'body'
                    if (currentStep.target !== 'body') {
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                } else {
                    // If target not found, maybe it's still loading or on another view
                    setIsVisible(false);
                }
            };

            updatePosition();
            window.addEventListener('resize', updatePosition);
            return () => window.removeEventListener('resize', updatePosition);
        }, 300);

        return () => clearTimeout(timer);
    }, [isTourRunning, stepIndex, currentStep, navigateTo, view]);

    if (!isTourRunning || !currentStep || !isVisible) return null;

    const isFirstStep = stepIndex === 0;
    const isLastStep = stepIndex === tourSteps.length - 1;

    // Positioning logic
    let style: React.CSSProperties = {};
    if (currentStep.target === 'body' || currentStep.placement === 'center') {
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

        switch (currentStep.placement) {
            case 'bottom':
                left = targetRect.left + (targetRect.width / 2);
                top = targetRect.bottom + gap;
                transform = 'translateX(-50%)';

                // Horizontal clamping
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

                // Horizontal clamping
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

                // Vertical clamping
                if (top - (cardHeight / 2) < gap) {
                    top = gap + (cardHeight / 2);
                } else if (top + (cardHeight / 2) > viewportHeight - gap) {
                    top = viewportHeight - gap - (cardHeight / 2);
                }
                // Horizontal overflow check - if too far right, flip to left
                if (left + cardWidth > viewportWidth - gap) {
                    left = targetRect.left - gap;
                    transform = 'translate(-100%, -50%)';
                }
                break;

            case 'left':
                left = targetRect.left - gap;
                top = targetRect.top + (targetRect.height / 2);
                transform = 'translate(-100%, -50%)';

                // Vertical clamping
                if (top - (cardHeight / 2) < gap) {
                    top = gap + (cardHeight / 2);
                } else if (top + (cardHeight / 2) > viewportHeight - gap) {
                    top = viewportHeight - gap - (cardHeight / 2);
                }
                // Horizontal overflow check - if too far left, flip to right
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

            {/* Spotlight (optional: could highlight the target area) */}
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
                <button
                    onClick={() => stopTour(true)}
                    className="absolute top-3 right-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                    <DismissIcon className="w-4 h-4" />
                </button>

                <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-[10px] font-bold rounded-full uppercase tracking-wider">
                            Step {stepIndex + 1} of {tourSteps.length}
                        </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                        {currentStep.title}
                    </h3>
                </div>

                <p className="text-sm text-slate-600 dark:text-zinc-400 mb-6 leading-relaxed">
                    {currentStep.content}
                </p>

                <div className="flex items-center justify-between gap-3">
                    <button
                        onClick={() => stopTour(true)}
                        className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                        Skip Tour
                    </button>

                    <div className="flex items-center gap-2">
                        {!isFirstStep && (
                            <button
                                onClick={backStep}
                                className="p-2 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors"
                            >
                                <ChevronLeftIcon className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={isLastStep ? () => stopTour(true) : nextStep}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-primary-700 transition-all transform active:scale-95"
                        >
                            {isLastStep ? 'Complete' : 'Got it'}
                            {!isLastStep && <ChevronRightIcon className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Arrow */}
                {currentStep.target !== 'body' && (
                    <div
                        className={`absolute w-3 h-3 bg-white dark:bg-zinc-800 border-l border-t border-slate-200 dark:border-zinc-700 transform rotate-45 
                            ${currentStep.placement === 'bottom' ? '-top-1.5 left-1/2 -translate-x-1/2 rotate-[45deg]' : ''}
                            ${currentStep.placement === 'top' ? '-bottom-1.5 left-1/2 -translate-x-1/2 rotate-[225deg]' : ''}
                            ${currentStep.placement === 'right' ? '-left-1.5 top-1/2 -translate-y-1/2 rotate-[315deg]' : ''}
                            ${currentStep.placement === 'left' ? '-right-1.5 top-1/2 -translate-y-1/2 rotate-[135deg]' : ''}
                        `}
                    />
                )}
            </div>
        </div>
    );
};

export default OnboardingTour;
