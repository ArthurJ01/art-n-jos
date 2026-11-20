import { pino } from 'pino';
import { createApp } from './app.js';
import { createDb } from './db/client.js';
import { loadEnv } from './env.js';

const env = loadEnv();

// JSON logs in production (easy for log tools to parse), pretty logs locally.
const logger = pino({
  level: env.LOG_LEVEL,
  // Never write session cookies or other secrets to the logs.
  redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
  transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
});

const { db, pool } = createDb(env.DATABASE_URL);
const app = createApp({ env, db, logger });

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.APP_ENV, version: env.APP_VERSION }, 'API listening');
});

// Shut down cleanly when the host stops the container (e.g. during a deploy).
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  });
}
