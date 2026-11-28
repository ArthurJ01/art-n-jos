import type { Request, RequestHandler } from 'express';

export const SESSION_COOKIE = 'session';
export const SESSION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

/**
 * The email address of whoever is logged in, or null.
 *
 * Logging in sets a *signed* cookie holding the address. The signature (made
 * with SESSION_SECRET) means the browser can't forge or change it. The address
 * is checked against the list on every request, so removing someone from
 * ALLOWED_EMAILS also ends the sessions they already have.
 */
export function sessionEmail(req: Request, allowedEmails: readonly string[]): string | null {
  // cookie-parser gives `false` for a cookie whose signature is wrong.
  const value: unknown = req.signedCookies?.[SESSION_COOKIE];
  return typeof value === 'string' && allowedEmails.includes(value) ? value : null;
}

/** Lets a request through only if it comes from someone who is logged in. */
export function requireAuth(allowedEmails: readonly string[]): RequestHandler {
  return (req, res, next) => {
    if (sessionEmail(req, allowedEmails)) {
      next();
      return;
    }
    res.status(401).json({ error: 'Du måste logga in' });
  };
}
