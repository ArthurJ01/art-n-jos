import { z } from 'zod';
import { LOGIN_CODE_LENGTH } from '@art-web/shared';

const PIN_FORMAT = new RegExp(`^\\d{${LOGIN_CODE_LENGTH}}$`);

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
     * Optional: a fixed PIN per address, which logs that person in without an
     * emailed code. Written as "address:pin" pairs separated by commas, e.g.
     * "you@example.com:123456,partner@example.com:654321". Someone without a
     * PIN here logs in with emailed codes only.
     */
    LOGIN_PINS: z
      .string()
      .default('')
      .transform((list, ctx) => {
        const pins = new Map<string, string>();
        const entries = list.split(',').filter((entry) => entry.trim());
        entries.forEach((entry, i) => {
          // The last colon, to be safe: a PIN has none, an address could.
          const colon = entry.lastIndexOf(':');
          const email = entry.slice(0, colon).trim().toLowerCase();
          const pin = entry.slice(colon + 1).trim();
          if (colon > 0 && z.email().safeParse(email).success && PIN_FORMAT.test(pin)) {
            pins.set(email, pin);
          } else {
            // Say which entry, but never repeat it: this ends up in the logs.
            ctx.addIssue({
              code: 'custom',
              message: `entry ${i + 1} must look like address:pin, with a PIN of ${LOGIN_CODE_LENGTH} digits`,
            });
          }
        });
        return pins as ReadonlyMap<string, string>;
      }),
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
    // A PIN for an address that can't log in is a typo in one of the two
    // lists. Better to hear about it now than to wonder why the PIN is wrong.
    [...env.LOGIN_PINS.keys()].forEach((email, i) => {
      if (!env.ALLOWED_EMAILS.includes(email)) {
        ctx.addIssue({
          code: 'custom',
          path: ['LOGIN_PINS'],
          message: `entry ${i + 1} is for an address that is not in ALLOWED_EMAILS`,
        });
      }
    });

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
