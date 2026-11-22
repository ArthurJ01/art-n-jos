import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScreenOnSwitch } from './ScreenOnSwitch';

/** jsdom has no Screen Wake Lock API, so the tests put a fake one in its place. */
function fakeWakeLock(request: () => Promise<unknown>) {
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'wakeLock');
});

describe('ScreenOnSwitch', () => {
  it('is left out in browsers that can not keep the screen on', () => {
    render(<ScreenOnSwitch />);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('asks for a wake lock when switched on and gives it back when switched off', async () => {
    const lock = { released: false, release: vi.fn(() => Promise.resolve()) };
    const request = vi.fn(() => Promise.resolve(lock));
    fakeWakeLock(request);
    const user = userEvent.setup();
    render(<ScreenOnSwitch />);

    const toggle = screen.getByRole('switch', { name: 'Håll skärmen tänd' });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);
    expect(toggle).toBeChecked();
    expect(request).toHaveBeenCalledWith('screen');

    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    await waitFor(() => expect(lock.release).toHaveBeenCalled());
  });

  it('switches itself off again when the browser says no', async () => {
    fakeWakeLock(() => Promise.reject(new DOMException('denied', 'NotAllowedError')));
    render(<ScreenOnSwitch />);

    const toggle = screen.getByRole('switch');
    await userEvent.setup().click(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());
  });
});
