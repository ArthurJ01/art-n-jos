import { z } from 'zod';

/**
 * All configuration comes from environment variables (12-factor style).
 * We validate them once at startup so the app fails fast with a clear message
 * instead of crashing later with a confusing error.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Which deployment this is: local, dev or prod. Shown in the UI and health check. */
  APP_ENV: z.string().default('local'),
  /** Git commit SHA baked into the Docker image at build time. */
  APP_VERSION: z.string().default('dev'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  /** Shared password that you and your girlfriend use to add/edit recipes. */
  APP_PASSWORD: z.string().min(8, 'APP_PASSWORD must be at least 8 characters'),
  /** Random string used to sign the session cookie. */
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  /** Folder with the built React app. If set, the API also serves the website. */
  STATIC_DIR: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment variables:\n${issues.join('\n')}`);
  }
  return result.data;
}
