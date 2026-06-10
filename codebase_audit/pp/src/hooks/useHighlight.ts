import * as React from 'react';
import { useUI } from '../contexts/UIContext';
import { View } from '../types';

const isElementInViewport = (el: Element): boolean => {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
};

export const useHighlight = (
    containerRef: React.RefObject<HTMLElement>, 
    view: View,
    type: 'bg' | 'ring' = 'bg'
) => {
    const { highlightTarget, setHighlightTarget } = useUI();
    const animationTimeoutRef = React.useRef<number | null>(null);
    const zIndexTimeoutRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        // Cleanup previous timeouts if effect re-runs
        if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
        if (zIndexTimeoutRef.current) clearTimeout(zIndexTimeoutRef.current);

        if (highlightTarget && highlightTarget.view === view && highlightTarget.filter?.id && containerRef.current) {
            const targetId = highlightTarget.filter.id;
            const highlightColor = highlightTarget.color || 'blue';
            
            const isShimmer = highlightColor === 'shimmer';
            const pulseClass = isShimmer ? 'animate-shimmer' : (type === 'bg' ? `animate-pulse-bg-${highlightColor}` : `animate-pulse-ring-${highlightColor}`);
            const animationDuration = isShimmer ? 1500 : 4500;

            const findAndHighlight = () => {
                const element = containerRef.current?.querySelector(`[data-item-id="${targetId}"]`);

                if (element) {
                    const needsScroll = !isElementInViewport(element);
                    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

                    const observer = new IntersectionObserver(
                        (entries) => {
                            if (entries[0].isIntersecting) {
                                if (type === 'ring') {
                                    (element as HTMLElement).style.zIndex = '10';
                                    (element as HTMLElement).style.position = 'relative';
                                }

                                element.classList.add(pulseClass);
                                
                                animationTimeoutRef.current = window.setTimeout(() => {
                                    element.classList.remove(pulseClass);
                                    setHighlightTarget(null);
                                }, animationDuration);
                                
                                if (type === 'ring') {
                                    zIndexTimeoutRef.current = window.setTimeout(() => {
                                        (element as HTMLElement).style.zIndex = '';
                                        (element as HTMLElement).style.position = '';
                                    }, animationDuration + 100);
                                }

                                observer.disconnect();
                            }
                        },
                        { threshold: 0.8 }
                    );
                    observer.observe(element);
                } else {
                    if (highlightTarget.view === view) {
                         setHighlightTarget(null);
                    }
                }
            };
            
            setTimeout(findAndHighlight, 50);
        }

        // Cleanup on unmount
        return () => {
            if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
            if (zIndexTimeoutRef.current) clearTimeout(zIndexTimeoutRef.current);
        };
    }, [highlightTarget, setHighlightTarget, view, containerRef, type]);
};