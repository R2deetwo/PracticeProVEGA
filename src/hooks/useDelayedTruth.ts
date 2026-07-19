import { useState, useEffect } from 'react';
export function useDelayedTruth(value: boolean, delay: number = 200): boolean {
    const [delayedValue, setDelayedValue] = useState(value);
    useEffect(() => {
        if (!value) { setDelayedValue(false); return; }
        const timer = setTimeout(() => setDelayedValue(true), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return delayedValue;
}
