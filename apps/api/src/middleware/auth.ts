import type { RequestHandler } from 'express';

export const SESSION_COOKIE = 'session';
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Very small auth: after logging in with the shared password, the server sets a
 * *signed* cookie. The signature (made with SESSION_SECRET) means the browser can't
 * forge it. Only routes that change data use this middleware.
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  if (req.signedCookies?.[SESSION_COOKIE] === 'ok') {
    next();
    return;
  }
  res.status(401).json({ error: 'Du måste logga in för att göra det' });
};
