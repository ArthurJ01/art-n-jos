import { createHash, timingSafeEqual } from 'node:crypto';
import { count, eq, lt, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { pinAttempts } from '../db/schema.js';

/** Guesses at the PIN one address gets per hour. After that, only an emailed code works. */
export const MAX_PIN_ATTEMPTS_PER_HOUR = 5;

export type PinResult = 'ok' | 'wrong' | 'locked';

/** Compares in constant time, so the response time says nothing about the PIN. */
function safeEqual(a: string, b: string) {
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(a), hash(b));
}

/**
 * The fixed PIN (LOGIN_PIN): the other way to log in, for when you'd rather
 * type six digits you know than wait for an email.
 *
 * Unlike an emailed code, the PIN never changes, so the only thing between it
 * and someone guessing is the limit above. Like the limits for emailed codes
 * it is kept in the database, because memory is not shared between Vercel's
 * servers.
 */
export function createPinLogin(db: Db, pin: string) {
  return {
    /**
     * Checks one guess for one address. `mayLogIn` says whether the address
     * is on the list. An address that isn't can never get 'ok', but its
     * guesses are counted all the same, so the answers don't give away which
     * addresses have access, or whether a guess from a made-up address was right.
     */
    async verify(email: string, guess: string, mayLogIn: boolean): Promise<PinResult> {
      await db.delete(pinAttempts).where(lt(pinAttempts.createdAt, sql`now() - interval '1 hour'`));

      // Write the guess down first and count afterwards. Counting first would
      // let many requests sent at the same moment all slip under the limit.
      await db.insert(pinAttempts).values({ email });
      const [made] = await db
        .select({ count: count() })
        .from(pinAttempts)
        .where(eq(pinAttempts.email, email));
      if ((made?.count ?? 0) > MAX_PIN_ATTEMPTS_PER_HOUR) return 'locked';

      if (!mayLogIn || !safeEqual(guess, pin)) return 'wrong';

      // A successful login wipes the slate, so your own typos don't add up.
      await db.delete(pinAttempts).where(eq(pinAttempts.email, email));
      return 'ok';
    },
  };
}

export type PinLogin = ReturnType<typeof createPinLogin>;
