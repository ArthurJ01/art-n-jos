import nodemailer from 'nodemailer';
import type { Logger } from 'pino';
import type { Env } from '../env.js';
import { CODE_TTL_MINUTES } from './login-codes.js';

/** Sends a login code to an address. Tests pass a fake, so no test sends email. */
export type SendLoginCode = (to: string, code: string) => Promise<void>;

/**
 * Sends the code through an SMTP server (any mail provider has one; Gmail's
 * is smtp.gmail.com). Without SMTP settings, which is the normal case on your
 * own computer, the code is written to the API log instead.
 */
export function createSendLoginCode(env: Env, logger: Logger): SendLoginCode {
  if (!env.SMTP_HOST) {
    return (to, code) => {
      logger.warn({ to, code }, 'SMTP_HOST is not set: the login code is only written here');
      return Promise.resolve();
    };
  }

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // Port 465 is encrypted from the first byte. Other ports (587) start
    // plain and upgrade, which nodemailer does by itself.
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    // Give up well before the Vercel function's own time limit (30 s).
    connectionTimeout: 10_000,
    socketTimeout: 10_000,
  });
  const from = { name: 'Art & Jos', address: env.MAIL_FROM ?? env.SMTP_USER ?? '' };

  return async (to, code) => {
    await transport.sendMail({
      from,
      to,
      // The code is in the subject, so it can be read from the notification.
      subject: `${code} är din inloggningskod till Art & Jos`,
      text: [
        `Din inloggningskod är ${code}`,
        '',
        `Den gäller i ${CODE_TTL_MINUTES} minuter.`,
        'Om du inte försökte logga in kan du strunta i det här mejlet.',
      ].join('\n'),
    });
  };
}
