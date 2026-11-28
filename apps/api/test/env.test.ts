import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env.js';

const base = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  ALLOWED_EMAILS: 'art@example.com, Jos@Example.com',
  SESSION_SECRET: 'x'.repeat(32),
};

describe('LOGIN_PINS', () => {
  it('is optional', () => {
    expect(loadEnv(base).LOGIN_PINS.size).toBe(0);
    expect(loadEnv({ ...base, LOGIN_PINS: '' }).LOGIN_PINS.size).toBe(0);
  });

  it('reads one PIN per address, forgiving spaces and capitals', () => {
    const env = loadEnv({
      ...base,
      LOGIN_PINS: ' Art@example.com:123456 , jos@example.com: 000042 ',
    });
    expect([...env.LOGIN_PINS]).toEqual([
      ['art@example.com', '123456'],
      ['jos@example.com', '000042'],
    ]);
  });

  it.each([
    ['a PIN that is too short', 'art@example.com:12345'],
    ['a PIN with letters', 'art@example.com:12345a'],
    ['a PIN without an address', '123456'],
    ['an address without a PIN', 'art@example.com'],
    ['something that is not an address', 'art:123456'],
  ])('refuses %s, without repeating it', (_what, pins) => {
    const load = () => loadEnv({ ...base, LOGIN_PINS: `jos@example.com:654321,${pins}` });
    expect(load).toThrow(/LOGIN_PINS: entry 2 must look like address:pin/);
    // The message goes to the logs, so it must not contain the PINs.
    expect(load).not.toThrow(/654321|12345/);
  });

  it('refuses a PIN for an address that is not allowed to log in', () => {
    const load = () => loadEnv({ ...base, LOGIN_PINS: 'stranger@example.com:123456' });
    expect(load).toThrow(/LOGIN_PINS: entry 1 is for an address that is not in ALLOWED_EMAILS/);
  });
});
