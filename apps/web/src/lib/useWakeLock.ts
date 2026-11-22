import { useEffect, useState } from 'react';

/**
 * "Keep the screen on": stops the phone from dimming and locking while you
 * cook, using the browser's Screen Wake Lock API.
 *
 * Returns `supported` (false in browsers without the API, so the switch can
 * be left out), whether it is `on`, and `setOn` to flip it.
 *
 * The browser drops the lock by itself whenever the page is hidden (another
 * tab or app, or the screen turned off by hand), so it is asked for again each
 * time the page comes back.
 */
export function useWakeLock() {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!on || !supported) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      try {
        const next = await navigator.wakeLock.request('screen');
        // Switched off (or left the page) while the browser was answering.
        if (stopped) void next.release();
        else lock = next;
      } catch {
        // The browser said no, for example in battery saver mode.
        if (!stopped) setOn(false);
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release();
    };
  }, [on, supported]);

  return { supported, on, setOn };
}
