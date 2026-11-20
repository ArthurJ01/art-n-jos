import { pino } from 'pino';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { loadEnv } from '../src/env.js';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/artweb_test';

export const TEST_PASSWORD = 'test-password-123';

export function createTestApp() {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    APP_PASSWORD: TEST_PASSWORD,
    SESSION_SECRET: 'x'.repeat(32),
    APP_ENV: 'test',
  });
  const { db, pool } = createDb(env.DATABASE_URL);
  const app = createApp({ env, db, logger: pino({ level: 'silent' }) });
  return { app, db, pool };
}
