import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { and, count, desc, eq, gt, lt, sql } from 'drizzle-orm';
import { LOGIN_CODE_LENGTH } from '@art-web/shared';
import type { Db } from '../db/client.js';
import { loginCodes } from '../db/schema.js';

/** How long a code can be used after it was sent. */
export const CODE_TTL_MINUTES = 10;
/** Wrong guesses allowed per code. After that, a new code is needed. */
export const MAX_ATTEMPTS = 5;
/** Codes one address can be sent per hour, so nobody can fill an inbox. */
export const MAX_CODES_PER_HOUR = 5;

/**
 * The emailed login codes: making them and checking them.
 *
 * A six-digit code has only a million possibilities, so the two limits above
 * are what make it safe: five guesses per code and five codes per hour is at
 * most 25 guesses an hour. The limits are kept in the database, because on
 * Vercel each request can land on a different server with its own memory.
 *
 * All times use the database's clock (`now()`), so they agree with each other.
 */
export function createLoginCodes(db: Db, secret: string) {
  // The code is stored as a keyed hash (HMAC). A plain hash of six digits
  // could be reversed by trying all million codes; this one also needs the
  // secret, which is not in the database.
  const hash = (email: string, code: string) =>
    createHmac('sha256', secret).update(`${email}:${code}`).digest();

  return {
    /** Makes a new code for the address. Returns null if it has had too many. */
    async create(email: string): Promise<string | null> {
      // Old rows are no use to anyone. Clearing them here keeps the table tiny.
      await db.delete(loginCodes).where(lt(loginCodes.createdAt, sql`now() - interval '1 hour'`));

      const [sent] = await db
        .select({ count: count() })
        .from(loginCodes)
        .where(eq(loginCodes.email, email));
      if ((sent?.count ?? 0) >= MAX_CODES_PER_HOUR) return null;

      // randomInt is the cryptographically secure one (Math.random is not).
      const code = randomInt(0, 10 ** LOGIN_CODE_LENGTH)
        .toString()
        .padStart(LOGIN_CODE_LENGTH, '0');
      await db.insert(loginCodes).values({
        email,
        codeHash: hash(email, code).toString('hex'),
        expiresAt: sql`now() + make_interval(mins => ${CODE_TTL_MINUTES})`,
      });
      return code;
    },

    /** Is this the code that was last sent to the address? A code works once. */
    async verify(email: string, code: string): Promise<boolean> {
      // Only the newest code counts: asking for a new one retires the old ones.
      const [latest] = await db
        .select({ id: loginCodes.id })
        .from(loginCodes)
        .where(eq(loginCodes.email, email))
        .orderBy(desc(loginCodes.id))
        .limit(1);
      if (!latest) return false;

      // Count the guess before looking at it, in a single statement. Counting
      // afterwards would let many requests sent at the same moment all get
      // their guess in before the limit is noticed.
      const [row] = await db
        .update(loginCodes)
        .set({ attempts: sql`${loginCodes.attempts} + 1` })
        .where(
          and(
            eq(loginCodes.id, latest.id),
            lt(loginCodes.attempts, MAX_ATTEMPTS),
            gt(loginCodes.expiresAt, sql`now()`),
          ),
        )
        .returning({ codeHash: loginCodes.codeHash });
      if (!row) return false;

      // Compare in constant time, so the response time says nothing about
      // how much of the code was right.
      if (!timingSafeEqual(hash(email, code), Buffer.from(row.codeHash, 'hex'))) return false;

      await db.delete(loginCodes).where(eq(loginCodes.email, email));
      return true;
    },
  };
}

export type LoginCodes = ReturnType<typeof createLoginCodes>;
