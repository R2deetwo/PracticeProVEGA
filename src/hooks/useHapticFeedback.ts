import { useCallback } from 'react';

/**
 * useHapticFeedback — provides haptic (vibration) feedback on mobile.
 *
 * On Android (Capacitor APK), this uses the native Vibration API.
 * On desktop/web, it's a no-op (no vibration hardware).
 *
 * Usage:
 *   const { light, medium, heavy, success, error } = useHapticFeedback();
 *   <button onClick={light}>Tap me</button>
 *
 * Patterns:
 *   - light: 10ms tap (subtle, for button presses)
 *   - medium: 20ms tap (for toggles, selections)
 *   - heavy: 50ms tap (for destructive actions)
 *   - success: [10, 50, 10] pattern (success feedback)
 *   - error: [50, 30, 50] pattern (error feedback)
 */
export function useHapticFeedback() {
  const vibrate = useCallback((pattern: number | number[]) => {
    try {
      // Only vibrate if the API exists (mobile devices / Capacitor)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {
      // Silently ignore — vibration is a nice-to-have, not critical
    }
  }, []);

  const light = useCallback(() => vibrate(10), [vibrate]);
  const medium = useCallback(() => vibrate(20), [vibrate]);
  const heavy = useCallback(() => vibrate(50), [vibrate]);
  const success = useCallback(() => vibrate([10, 50, 10]), [vibrate]);
  const error = useCallback(() => vibrate([50, 30, 50]), [vibrate]);

  return { light, medium, heavy, success, error };
}

export default useHapticFeedback;
