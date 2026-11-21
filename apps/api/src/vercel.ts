/**
 * Entry point used on Vercel.
 *
 * Locally, src/index.ts starts a long-running server with app.listen().
 * On Vercel there is no long-running server: Vercel calls the Express app once per
 * request as a serverless function. We build the app once per function instance
 * ("cold start") and Vercel reuses it for the following requests.
 */
import { pino } from 'pino';
import { createApp } from './app.js';
import { createDb } from './db/client.js';
import { loadEnv } from './env.js';

const env = loadEnv({
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? 'production',
  // Set by the deploy pipeline (`vercel deploy --env APP_VERSION=<sha>`),
  // or by Vercel itself for deployments made from its Git integration.
  APP_VERSION: process.env.APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
});

const logger = pino({
  level: env.LOG_LEVEL,
  redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
});

// Use Neon's *pooled* connection string on Vercel: many short-lived function
// instances can then share a small number of real database connections.
const { db } = createDb(env.DATABASE_URL);

export default createApp({ env, db, logger });
