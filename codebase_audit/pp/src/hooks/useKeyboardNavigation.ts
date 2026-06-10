
import { useState, useEffect, useCallback } from 'react';

interface UseKeyboardNavigationProps {
    itemCount: number;
    onEnter: (index: number) => void;
    onSpace?: (index: number) => void;
    isActive?: boolean; // Whether the list has focus/is visible
}

export const useKeyboardNavigation = ({ itemCount, onEnter, onSpace, isActive = true }: UseKeyboardNavigationProps) => {
    const [selectedIndex, setSelectedIndex] = useState<number>(-1);

    useEffect(() => {
        setSelectedIndex(-1); // Reset when list changes (e.g. filtering)
    }, [itemCount]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isActive) return;
        
        // Don't interfere if user is typing in an input
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || (document.activeElement as HTMLElement).isContentEditable)) {
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % itemCount);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + itemCount) % itemCount);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0) onEnter(selectedIndex);
        } else if (e.key === ' ' && onSpace) {
            e.preventDefault();
            if (selectedIndex >= 0) onSpace(selectedIndex);
        } else if (e.key === 'Escape') {
            setSelectedIndex(-1);
        }
    }, [isActive, itemCount, selectedIndex, onEnter, onSpace]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Auto-scroll to selected item
    useEffect(() => {
        if (selectedIndex >= 0) {
            const element = document.getElementById(`list-item-${selectedIndex}`);
            if (element) {
                element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedIndex]);

    return { selectedIndex, setSelectedIndex };
};
