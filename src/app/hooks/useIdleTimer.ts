import { useEffect, useRef } from 'react';

interface UseIdleTimerOptions {
  /** Timer only runs while true; flipping to false clears any pending timers. */
  enabled: boolean;
  /** Total inactivity duration before `onTimeout` fires. */
  idleMs: number;
  /** How long before `idleMs` to fire `onWarning`. */
  warningMs: number;
  onWarning: () => void;
  onTimeout: () => void;
}

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;

/**
 * Fires `onWarning` shortly before `onTimeout` on prolonged inactivity.
 * Once the warning has fired, ambient activity is ignored — only an
 * explicit `reset()` call (wired to a "Stay signed in" action) dismisses
 * it, so a stray mouse bump doesn't make the warning flicker.
 */
export function useIdleTimer({ enabled, idleMs, warningMs, onWarning, onTimeout }: UseIdleTimerOptions) {
  const warningTimer = useRef<ReturnType<typeof setTimeout>>();
  const timeoutTimer = useRef<ReturnType<typeof setTimeout>>();
  const warned = useRef(false);
  const callbacks = useRef({ onWarning, onTimeout });
  callbacks.current = { onWarning, onTimeout };

  const clear = () => {
    window.clearTimeout(warningTimer.current);
    window.clearTimeout(timeoutTimer.current);
  };

  const schedule = () => {
    clear();
    warned.current = false;
    warningTimer.current = setTimeout(() => {
      warned.current = true;
      callbacks.current.onWarning();
    }, Math.max(idleMs - warningMs, 0));
    timeoutTimer.current = setTimeout(() => callbacks.current.onTimeout(), idleMs);
  };

  const reset = () => {
    if (!enabled) return;
    schedule();
  };

  useEffect(() => {
    if (!enabled) {
      clear();
      return;
    }

    schedule();
    const handleActivity = () => {
      if (warned.current) return;
      schedule();
    };
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, handleActivity));
    return () => {
      clear();
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, idleMs, warningMs]);

  return { reset };
}
