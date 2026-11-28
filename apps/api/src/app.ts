import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { sv } from 'zod/locales';
import type { HealthResponse } from '@art-web/shared';
import type { Env } from './env.js';
import type { Db } from './db/client.js';
import { authRouter } from './routes/auth.js';
import { recipesRouter } from './routes/recipes.js';
import { mealPlanRouter } from './routes/meal-plan.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { createLoginCodes } from './auth/login-codes.js';
import { createSendLoginCode, type SendLoginCode } from './auth/mailer.js';
import { fetchPage as fetchPageFromWeb, type FetchPage } from './import/fetch-page.js';

// The site is in Swedish, so Zod's built-in validation messages should be too.
z.config(sv());

interface AppDeps {
  env: Env;
  db: Db;
  logger: Logger;
  /** Downloads a page for the recipe import. Tests pass a fake, to stay off the internet. */
  fetchPage?: FetchPage;
  /** Emails a login code. Tests pass a fake here too. */
  sendLoginCode?: SendLoginCode;
}

/**
 * Builds the Express app. Kept separate from index.ts (which starts listening)
 * so tests can create an app without opening a port.
 */
export function createApp({
  env,
  db,
  logger,
  fetchPage = fetchPageFromWeb,
  sendLoginCode = createSendLoginCode(env, logger),
}: AppDeps) {
  const app = express();
  const isProd = env.NODE_ENV === 'production';

  // On Render (and most hosts) we sit behind a proxy; this makes req.ip and
  // secure cookies work correctly.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser(env.SESSION_SECRET));

  // ---- API routes ----
  const api = express.Router();

  api.get('/health', async (_req, res) => {
    let dbStatus: HealthResponse['db'] = 'up';
    try {
      await db.execute(sql`select 1`);
    } catch {
      dbStatus = 'down';
    }
    const body: HealthResponse = {
      status: dbStatus === 'up' ? 'ok' : 'degraded',
      env: env.APP_ENV,
      version: env.APP_VERSION,
      db: dbStatus,
    };
    res.status(dbStatus === 'up' ? 200 : 503).json(body);
  });

  api.use(
    '/auth',
    authRouter({
      allowedEmails: env.ALLOWED_EMAILS,
      codes: createLoginCodes(db, env.SESSION_SECRET),
      sendLoginCode,
      secureCookies: isProd,
    }),
  );

  // Everything below this line needs a login: the whole site is private.
  // Only the health check and the login routes above are open.
  api.use(requireAuth(env.ALLOWED_EMAILS));
  api.use('/recipes', recipesRouter(db, { fetchPage }));
  api.use('/meal-plan', mealPlanRouter(db));
  api.use(notFound);

  app.use('/api', api);

  // ---- Website (the built React app) ----
  // Optional: if STATIC_DIR is set, this server also serves the built frontend.
  // On Vercel the CDN serves the frontend, and locally Vite's dev server does.
  if (env.STATIC_DIR && fs.existsSync(env.STATIC_DIR)) {
    const staticDir = path.resolve(env.STATIC_DIR);
    // Hashed asset files never change, so browsers can cache them for a long time.
    app.use(
      '/assets',
      express.static(path.join(staticDir, 'assets'), { immutable: true, maxAge: '1y' }),
    );
    app.use(express.static(staticDir, { index: false }));
    // Any other GET returns index.html so React Router can handle the URL.
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
