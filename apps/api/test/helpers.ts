import { pino } from 'pino';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { loadEnv } from '../src/env.js';
import type { FetchPage } from '../src/import/fetch-page.js';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://artweb:artweb@localhost:5432/artweb_test';

export const TEST_PASSWORD = 'test-password-123';

/** Tests must never reach out to the internet by accident. */
const noInternet: FetchPage = () => Promise.reject(new Error('fetchPage was called in a test'));

export function createTestApp({ fetchPage = noInternet }: { fetchPage?: FetchPage } = {}) {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    APP_PASSWORD: TEST_PASSWORD,
    SESSION_SECRET: 'x'.repeat(32),
    APP_ENV: 'test',
  });
  const { db, pool } = createDb(env.DATABASE_URL);
  const app = createApp({ env, db, logger: pino({ level: 'silent' }), fetchPage });
  return { app, db, pool };
}
