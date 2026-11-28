import { pino } from 'pino';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { loadEnv } from '../src/env.js';
import type { FetchPage } from '../src/import/fetch-page.js';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://artweb:artweb@localhost:5432/artweb_test';

/** The addresses that can log in to a test app, unless the test says otherwise. */
export const TEST_EMAIL = 'art@example.com';
export const OTHER_TEST_EMAIL = 'jos@example.com';

/** Tests must never reach out to the internet by accident. */
const noInternet: FetchPage = () => Promise.reject(new Error('fetchPage was called in a test'));

interface TestAppOptions {
  fetchPage?: FetchPage;
  allowedEmails?: string[];
  /** The fixed PIN. Left out, the app only has emailed codes. */
  pin?: string;
}

export function createTestApp({
  fetchPage = noInternet,
  allowedEmails = [TEST_EMAIL, OTHER_TEST_EMAIL],
  pin,
}: TestAppOptions = {}) {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    ALLOWED_EMAILS: allowedEmails.join(','),
    LOGIN_PIN: pin,
    SESSION_SECRET: 'x'.repeat(32),
    APP_ENV: 'test',
  });
  const { db, pool } = createDb(env.DATABASE_URL);

  /** Every "email" the app has sent. Nothing is really sent in a test. */
  const sentCodes: { to: string; code: string }[] = [];
  const app = createApp({
    env,
    db,
    logger: pino({ level: 'silent' }),
    fetchPage,
    sendLoginCode: (to, code) => {
      sentCodes.push({ to, code });
      return Promise.resolve();
    },
  });

  /** Logs in the real way, with an emailed code, and returns the session cookie. */
  async function logIn(email = TEST_EMAIL) {
    await request(app).post('/api/auth/request-code').send({ email }).expect(200);
    const code = sentCodes.at(-1)!.code;
    const res = await request(app).post('/api/auth/verify-code').send({ email, code }).expect(200);
    // "session=...; Max-Age=...; Path=/": the part before the first ";" is the cookie.
    return res.get('Set-Cookie')![0]!.split(';')[0]!;
  }

  let sessionCookie: Promise<string> | undefined;

  /**
   * Returns an agent that is logged in. The login itself happens once per
   * app and the cookie is reused, so a long test file doesn't run into the
   * login rate limit.
   */
  async function loggedInAgent() {
    sessionCookie ??= logIn();
    const agent = request.agent(app);
    agent.set('Cookie', await sessionCookie);
    return agent;
  }

  return { app, db, pool, sentCodes, logIn, loggedInAgent };
}
