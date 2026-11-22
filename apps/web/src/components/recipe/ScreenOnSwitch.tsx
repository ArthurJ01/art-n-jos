import { useWakeLock } from '../../lib/useWakeLock';

/** "Håll skärmen tänd": a switch that keeps the phone awake while cooking. */
export function ScreenOnSwitch() {
  const { supported, on, setOn } = useWakeLock();
  // Older browsers can't do this, and a switch that does nothing is worse than none.
  if (!supported) return null;

  return (
    <label className="switch">
      {/* role="switch" makes screen readers say "on/off" instead of "checked". */}
      <input
        type="checkbox"
        role="switch"
        className="switch-input"
        checked={on}
        onChange={(e) => setOn(e.target.checked)}
      />
      <span className="switch-track" aria-hidden="true" />
      Håll skärmen tänd
    </label>
  );
}
