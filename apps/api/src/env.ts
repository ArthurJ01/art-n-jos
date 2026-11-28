import { z } from 'zod';
import { LOGIN_CODE_LENGTH } from '@art-web/shared';

/**
 * All configuration comes from environment variables (12-factor style).
 * We validate them once at startup so the app fails fast with a clear message
 * instead of crashing later with a confusing error.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    /** Which deployment this is: local, dev or prod. Shown in the UI and health check. */
    APP_ENV: z.string().default('local'),
    /** Git commit SHA of the deployed code, set by the deploy pipeline. */
    APP_VERSION: z.string().default('dev'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url(),
    /**
     * The email addresses that can log in, separated by commas. They live here
     * and not in the code because the repo is public.
     */
    ALLOWED_EMAILS: z
      .string()
      .transform((list) =>
        list
          .split(',')
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      )
      .pipe(z.array(z.email()).min(1, 'ALLOWED_EMAILS needs at least one address')),
    /**
     * Optional: a fixed PIN that also logs you in, instead of an emailed code.
     * The same one for everyone on the list.
     */
    LOGIN_PIN: z
      .string()
      .regex(
        new RegExp(`^\\d{${LOGIN_CODE_LENGTH}}$`),
        `LOGIN_PIN must be exactly ${LOGIN_CODE_LENGTH} digits`,
      )
      .optional(),
    /** Random string used to sign the session cookie and to hash login codes. */
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    /**
     * The mail server that sends the login codes. Without SMTP_HOST the code is
     * written to the log instead, which is fine locally but not when deployed.
     */
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(465),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    /** The address the codes come from. Defaults to SMTP_USER. */
    MAIL_FROM: z.email().optional(),
    /** Folder with the built React app. If set, the API also serves the website. */
    STATIC_DIR: z.string().optional(),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .superRefine((env, ctx) => {
    // A deployed site that can't send codes is a site nobody can log in to,
    // so refuse to start instead of finding out at the login page.
    if (env.NODE_ENV !== 'production') return;
    for (const name of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'] as const) {
      if (!env[name]) {
        ctx.addIssue({ code: 'custom', path: [name], message: 'is required in production' });
      }
    }
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
