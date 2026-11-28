import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requestCodeSchema, verifyCodeSchema, type AuthStatus } from '@art-web/shared';
import type { LoginCodes } from '../auth/login-codes.js';
import type { PinLogin } from '../auth/login-pin.js';
import type { SendLoginCode } from '../auth/mailer.js';
import { HttpError } from '../middleware/errors.js';
import { SESSION_COOKIE, SESSION_MAX_AGE_MS, sessionEmail } from '../middleware/auth.js';

interface AuthOptions {
  /** The only addresses that can log in. */
  allowedEmails: readonly string[];
  codes: LoginCodes;
  /** The fixed PINs, if anyone has one. */
  pin?: PinLogin;
  sendLoginCode: SendLoginCode;
  secureCookies: boolean;
}

/**
 * Login: POST /verify-code swaps an email address and a six-digit code for a
 * session cookie. The code is either one that POST /request-code has emailed
 * to the address, or that address's fixed PIN.
 */
export function authRouter({
  allowedEmails,
  codes,
  pin,
  sendLoginCode,
  secureCookies,
}: AuthOptions) {
  const router = Router();
  const status = (authenticated: boolean): AuthStatus => ({ authenticated, pinLogin: !!pin });

  // A first, rough brake per IP address. The limits that really count are per
  // email address and live in the database (see auth/login-codes.ts).
  const tooMany = { error: 'För många försök. Vänta en stund och försök igen.' };
  const requestLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, message: tooMany });
  const verifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: tooMany });

  router.post('/request-code', requestLimiter, async (req, res) => {
    const { email } = requestCodeSchema.parse(req.body);

    if (allowedEmails.includes(email)) {
      const code = await codes.create(email);
      if (code) {
        await sendLoginCode(email, code).catch((err: unknown) => {
          req.log.error({ err }, 'Login: could not send the code');
          throw new HttpError(502, 'Koden gick inte att skicka. Försök igen om en stund.');
        });
      } else {
        req.log.warn('Login: too many codes requested for one address');
      }
    }

    // The answer is the same for every address, so this can't be used to find
    // out which addresses have access.
    res.json({ sent: true });
  });

  router.post('/verify-code', verifyLimiter, async (req, res) => {
    const { email, code } = verifyCodeSchema.parse(req.body);
    const mayLogIn = allowedEmails.includes(email);

    // The page has one box for the code, so try it both ways: first as the
    // emailed code, then as the PIN.
    let ok = mayLogIn && (await codes.verify(email, code));
    if (!ok && pin) {
      const result = await pin.verify(email, code, mayLogIn);
      if (result === 'locked') {
        throw new HttpError(429, 'För många felaktiga koder. Logga in med en kod via e-post.');
      }
      ok = result === 'ok';
    }
    if (!ok) throw new HttpError(401, 'Fel kod, eller så har den gått ut');
    res.cookie(SESSION_COOKIE, email, {
      signed: true,
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookies,
      maxAge: SESSION_MAX_AGE_MS,
    });
    res.json(status(true));
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE);
    res.json(status(false));
  });

  router.get('/me', (req, res) => {
    res.json(status(sessionEmail(req, allowedEmails) !== null));
  });

  return router;
}
