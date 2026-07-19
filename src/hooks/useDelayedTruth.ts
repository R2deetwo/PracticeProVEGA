/**
 * useDelayedTruth — delays a boolean becoming `true` by a specified ms.
 *
 * Purpose: prevents loading-state flicker on fast network requests.
 * If a Convex query resolves in <200ms, showing a skeleton for 200ms
 * then immediately hiding it causes a visual flash. This hook only
 * returns `true` if the input has been `true` for at least `delay` ms.
 *
 * Usage:
 *   const isLoading = useQuery(...) === undefined;
 *   const showLoading = useDelayedTruth(isLoading, 200);
 *   return showLoading ? <Skeleton /> : <Content />;
 *
 * The fallback to `false` is immediate (no delay) — only the truthy
 * transition is delayed.
 */
import { useState, useEffect } from 'react';

export function useDelayedTruth(value: boolean, delay: number = 200): boolean {
    const [delayedValue, setDelayedValue] = useState(value);

    useEffect(() => {
        if (!value) {
            // Immediately clear — no delay needed for hiding loading
            setDelayedValue(false);
            return;
        }
        // Delay setting to true
        const timer = setTimeout(() => setDelayedValue(true), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return delayedValue;
}
