import { createHash, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginSchema } from '@art-web/shared';
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from '../middleware/auth.js';

/** Compare secrets in constant time so response timing doesn't leak the password. */
function safeEqual(a: string, b: string) {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function authRouter(opts: { password: string; secureCookies: boolean }) {
  const router = Router();

  // Slow down password guessing: max 10 attempts per 15 minutes per IP.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: { error: 'För många försök. Vänta en stund och försök igen.' },
  });

  router.post('/login', loginLimiter, (req, res) => {
    const { password } = loginSchema.parse(req.body);
    if (!safeEqual(password, opts.password)) {
      res.status(401).json({ error: 'Fel lösenord' });
      return;
    }
    res.cookie(SESSION_COOKIE, 'ok', {
      signed: true,
      httpOnly: true,
      sameSite: 'lax',
      secure: opts.secureCookies,
      maxAge: SESSION_MAX_AGE_MS,
    });
    res.json({ authenticated: true });
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE);
    res.json({ authenticated: false });
  });

  router.get('/me', (req, res) => {
    res.json({ authenticated: req.signedCookies?.[SESSION_COOKIE] === 'ok' });
  });

  return router;
}
