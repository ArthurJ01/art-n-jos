import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';

/** How long a finger has to stay down. Close to what phones use for their own long-press. */
const HOLD_MS = 500;
/** A finger wobbles a little; moving further than this means scrolling, not holding. */
const MOVE_TOLERANCE_PX = 10;

interface Options {
  onLongPress: () => void;
  /** Checked on touch-down; return false to ignore this touch (for example on a button). */
  shouldStart: (e: PointerEvent) => boolean;
}

/**
 * "Press and hold" for touch screens: calls `onLongPress` when a finger stays
 * on the element for HOLD_MS without moving. Mouse and pen are ignored.
 *
 * Built on pointer events, which cover mouse, pen and touch with one API.
 * When the browser takes the touch over for scrolling it sends
 * `pointercancel`, which stops the timer.
 *
 * `takeLongPress()` tells the `touchend` handler whether this touch was a
 * long-press (and resets that), so it can do things that phones only allow
 * while a finger is lifting, such as focusing a text box so the keyboard opens.
 */
export function useLongPress({ onLongPress, shouldStart }: Options) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const didFire = useRef(false);

  const cancel = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    start.current = null;
  };

  // Don't fire after the element has gone away.
  useEffect(() => cancel, []);

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !e.isPrimary || !shouldStart(e)) return;
      didFire.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        cancel();
        didFire.current = true;
        onLongPress();
      }, HOLD_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      if (!start.current) return;
      const moved = Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y);
      if (moved > MOVE_TOLERANCE_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    // Android shows a context menu or starts selecting text on a long-press.
    onContextMenu: (e: MouseEvent) => {
      if (timer.current !== undefined || didFire.current) e.preventDefault();
    },
  };

  const takeLongPress = () => {
    const fired = didFire.current;
    didFire.current = false;
    return fired;
  };

  return { handlers, takeLongPress };
}
