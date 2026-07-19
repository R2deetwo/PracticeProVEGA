/**
 * useFocusTrap — traps keyboard focus within a container element.
 *
 * When active, Tab/Shift+Tab cycles through focusable elements inside the
 * container only. Focus cannot escape to the page behind the overlay.
 *
 * Also restores focus to the previously-focused element when deactivated.
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useFocusTrap(ref, isOpen);
 *   return <div ref={ref}>...modal content...</div>;
 *
 * Based on the focus-trap pattern from Modal.tsx (which already has this
 * logic inline). This hook extracts it so ConfirmDialog, DockedModal,
 * AloaPanel, CommandPalette, etc. can reuse it.
 */
import { useEffect } from 'react';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([type="hidden"]):not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable]:not([contenteditable="false"])',
].join(', ');

export function useFocusTrap(
    containerRef: React.RefObject<HTMLElement>,
    isActive: boolean,
) {
    useEffect(() => {
        if (!isActive || !containerRef.current) return;

        const container = containerRef.current;

        // Save the previously focused element to restore on unmount
        const previouslyFocused = document.activeElement as HTMLElement | null;

        // Focus the first focusable element (or the container itself)
        const focusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusableElements.length > 0) {
            // Slight delay so the container is fully rendered
            const timer = setTimeout(() => focusableElements[0].focus(), 50);
            // Cleanup on unmount
            return () => {
                clearTimeout(timer);
                // Restore focus to the previously focused element
                if (previouslyFocused && previouslyFocused.focus) {
                    try { previouslyFocused.focus(); } catch { /* ignore */ }
                }
            };
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey) {
                // Shift+Tab — if on first element, wrap to last
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                // Tab — if on last element, wrap to first
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        container.addEventListener('keydown', handleKeyDown);

        return () => {
            container.removeEventListener('keydown', handleKeyDown);
            // Restore focus to the previously focused element
            if (previouslyFocused && previouslyFocused.focus) {
                try { previouslyFocused.focus(); } catch { /* ignore */ }
            }
        };
    }, [containerRef, isActive]);
}
