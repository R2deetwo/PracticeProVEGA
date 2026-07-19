import { useEffect } from 'react';
const FOCUSABLE_SELECTOR = [
    'a[href]', 'button:not([disabled])', 'input:not([type="hidden"]):not([disabled])',
    'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
    '[contenteditable]:not([contenteditable="false"])',
].join(', ');
export function useFocusTrap(containerRef: React.RefObject<HTMLElement>, isActive: boolean) {
    useEffect(() => {
        if (!isActive || !containerRef.current) return;
        const container = containerRef.current;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusable.length > 0) {
            const timer = setTimeout(() => focusable[0].focus(), 50);
            return () => { clearTimeout(timer); if (previouslyFocused?.focus) try { previouslyFocused.focus(); } catch {} };
        }
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;
            const els = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
            if (els.length === 0) return;
            const first = els[0], last = els[els.length - 1];
            if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
            else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
        };
        container.addEventListener('keydown', handleKeyDown);
        return () => { container.removeEventListener('keydown', handleKeyDown); if (previouslyFocused?.focus) try { previouslyFocused.focus(); } catch {} };
    }, [containerRef, isActive]);
}
