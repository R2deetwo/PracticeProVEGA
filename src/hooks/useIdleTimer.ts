
import { useRef, useCallback, useEffect } from 'react';

export const useIdleTimer = (onIdle: () => void, timeout: number) => {
    const timeoutId = useRef<number | undefined>(undefined);

    const resetTimer = useCallback(() => {
        if (timeoutId.current != null) {
            window.clearTimeout(timeoutId.current);
        }
        timeoutId.current = window.setTimeout(() => onIdle(), timeout);
    }, [onIdle, timeout]);

    useEffect(() => {
        const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
        
        events.forEach(event => window.addEventListener(event, resetTimer));
        resetTimer();

        return () => {
            events.forEach(event => window.removeEventListener(event, resetTimer));
            if (timeoutId.current != null) {
                window.clearTimeout(timeoutId.current);
            }
        };
    }, [resetTimer]);

    return resetTimer;
};
