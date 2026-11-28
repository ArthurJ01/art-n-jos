import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MAX_ATTEMPTS, MAX_CODES_PER_HOUR } from '../src/auth/login-codes.js';
import { MAX_PIN_ATTEMPTS_PER_HOUR } from '../src/auth/login-pin.js';
import { loginCodes, pinAttempts } from '../src/db/schema.js';
import { createTestApp, OTHER_TEST_EMAIL, TEST_EMAIL } from './helpers.js';

type TestApp = ReturnType<typeof createTestApp>;

// A fresh app for every test, so each one starts with untouched rate limits.
const apps: TestApp[] = [];
function newApp(options?: Parameters<typeof createTestApp>[0]) {
  const testApp = createTestApp(options);
  apps.push(testApp);
  return testApp;
}

let t: TestApp;

beforeEach(async () => {
  t = newApp();
  await t.db.delete(loginCodes);
  await t.db.delete(pinAttempts);
});

afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.pool.end()));
});

const requestCode = (email: string, { app } = t) =>
  request(app).post('/api/auth/request-code').send({ email });
const verifyCode = (email: string, code: string, { app } = t) =>
  request(app).post('/api/auth/verify-code').send({ email, code });

/** Asks for a code and returns the one that was "emailed". */
async function emailedCode(email = TEST_EMAIL) {
  await requestCode(email).expect(200);
  return t.sentCodes.at(-1)!.code;
}

/** A code that is certainly not `code`. */
const wrong = (code: string) => (code === '000000' ? '111111' : '000000');

describe('login', () => {
  it('keeps everything except the health check and the login behind the login', async () => {
    await request(t.app).get('/api/recipes').expect(401);
    await request(t.app).get('/api/meal-plan?from=2026-11-16&to=2026-11-22').expect(401);
    await request(t.app).get('/api/no-such-thing').expect(401);

    await request(t.app).get('/api/health').expect(200);
    const me = await request(t.app).get('/api/auth/me').expect(200);
    expect(me.body).toEqual({ authenticated: false, pinLogin: false });
  });

  it('logs in with the code that was sent to the address', async () => {
    const code = await emailedCode();
    expect(t.sentCodes).toEqual([{ to: TEST_EMAIL, code }]);
    expect(code).toMatch(/^\d{6}$/);

    const agent = request.agent(t.app);
    await agent.post('/api/auth/verify-code').send({ email: TEST_EMAIL, code }).expect(200);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body).toEqual({ authenticated: true, pinLogin: false });
    await agent.get('/api/recipes').expect(200);
  });

  it('does not care how the address is typed', async () => {
    await requestCode('  ART@Example.com ').expect(200);
    const { to, code } = t.sentCodes.at(-1)!;
    expect(to).toBe(TEST_EMAIL);
    await verifyCode('Art@example.COM', ` ${code} `).expect(200);
  });

  it('sends nothing to an address without access, but answers the same', async () => {
    const known = await requestCode(TEST_EMAIL).expect(200);
    const unknown = await requestCode('someone-else@example.com').expect(200);

    expect(unknown.body).toEqual(known.body);
    expect(t.sentCodes.map((sent) => sent.to)).toEqual([TEST_EMAIL]);
    await verifyCode('someone-else@example.com', '123456').expect(401);
  });

  it('rejects malformed input', async () => {
    await requestCode('not-an-address').expect(400);
    await verifyCode(TEST_EMAIL, '12345').expect(400);
    await verifyCode(TEST_EMAIL, 'abcdef').expect(400);
  });

  it('rejects a wrong code, and a code meant for the other address', async () => {
    const code = await emailedCode(TEST_EMAIL);
    await verifyCode(TEST_EMAIL, wrong(code)).expect(401);
    await verifyCode(OTHER_TEST_EMAIL, code).expect(401);
    // A wrong guess does not spoil the code.
    await verifyCode(TEST_EMAIL, code).expect(200);
  });

  it('lets a code be used only once', async () => {
    const code = await emailedCode();
    await verifyCode(TEST_EMAIL, code).expect(200);
    await verifyCode(TEST_EMAIL, code).expect(401);
  });

  it('gives up on a code after too many wrong guesses', async () => {
    const code = await emailedCode();
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await verifyCode(TEST_EMAIL, wrong(code)).expect(401);
    }
    await verifyCode(TEST_EMAIL, code).expect(401);
  });

  it('rejects a code that has expired', async () => {
    const code = await emailedCode();
    await t.db
      .update(loginCodes)
      .set({ expiresAt: sql`now() - interval '1 second'` })
      .where(eq(loginCodes.email, TEST_EMAIL));
    await verifyCode(TEST_EMAIL, code).expect(401);
  });

  it('retires the old code when a new one is sent', async () => {
    const first = await emailedCode();
    const second = await emailedCode();
    // In the one-in-a-million case that both are the same, there is nothing to tell apart.
    if (first !== second) await verifyCode(TEST_EMAIL, first).expect(401);
    await verifyCode(TEST_EMAIL, second).expect(200);
  });

  it('stops sending codes to an address that has had too many', async () => {
    // Each app has its own per-IP limit, like visitors from different places.
    // The per-address limit is in the database, which they share.
    for (let i = 0; i < MAX_CODES_PER_HOUR; i++) {
      await requestCode(TEST_EMAIL, newApp()).expect(200);
    }
    const oneTooMany = newApp();
    await requestCode(TEST_EMAIL, oneTooMany).expect(200);
    expect(oneTooMany.sentCodes).toEqual([]);

    // The other address is not affected.
    await requestCode(OTHER_TEST_EMAIL, oneTooMany).expect(200);
    expect(oneTooMany.sentCodes.map((sent) => sent.to)).toEqual([OTHER_TEST_EMAIL]);
  });

  it('slows down one visitor who keeps asking for codes', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await requestCode(`visitor-${i}@example.com`)).status);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it('logs out', async () => {
    const agent = request.agent(t.app);
    const code = await emailedCode();
    await agent.post('/api/auth/verify-code').send({ email: TEST_EMAIL, code }).expect(200);
    await agent.get('/api/recipes').expect(200);

    await agent.post('/api/auth/logout').expect(200);
    await agent.get('/api/recipes').expect(401);
  });

  it('ends the session of someone who is taken off the list', async () => {
    const cookie = await t.logIn(OTHER_TEST_EMAIL);
    await request(t.app).get('/api/recipes').set('Cookie', cookie).expect(200);

    const withoutThem = newApp({ allowedEmails: [TEST_EMAIL] });
    await request(withoutThem.app).get('/api/recipes').set('Cookie', cookie).expect(401);
  });

  it('does not accept a cookie it did not sign', async () => {
    await request(t.app).get('/api/recipes').set('Cookie', `session=${TEST_EMAIL}`).expect(401);
    await request(t.app)
      .get('/api/recipes')
      .set('Cookie', `session=s%3A${encodeURIComponent(TEST_EMAIL)}.forged`)
      .expect(401);
  });
});

describe('login with the fixed PIN', () => {
  const PIN = '424242';
  const WRONG_PIN = '000000';

  // The same as in the tests above, but for an app that has a PIN.
  beforeEach(() => {
    t = newApp({ pin: PIN });
  });

  it('logs in with the PIN, without any email', async () => {
    const before = await request(t.app).get('/api/auth/me').expect(200);
    expect(before.body).toEqual({ authenticated: false, pinLogin: true });

    const agent = request.agent(t.app);
    const res = await agent
      .post('/api/auth/verify-code')
      .send({ email: TEST_EMAIL, code: PIN })
      .expect(200);
    expect(res.body).toEqual({ authenticated: true, pinLogin: true });
    await agent.get('/api/recipes').expect(200);
    expect(t.sentCodes).toEqual([]);
  });

  it('still logs in with an emailed code', async () => {
    const code = await emailedCode();
    await verifyCode(TEST_EMAIL, code).expect(200);
  });

  it('does not work for an address that is not on the list', async () => {
    await verifyCode('someone-else@example.com', PIN).expect(401);
  });

  it('does not exist on a site without a PIN', async () => {
    await verifyCode(TEST_EMAIL, PIN, newApp()).expect(401);
  });

  it('locks the PIN after too many wrong guesses, but not the emailed codes', async () => {
    for (let i = 0; i < MAX_PIN_ATTEMPTS_PER_HOUR; i++) {
      await verifyCode(TEST_EMAIL, WRONG_PIN).expect(401);
    }
    // Now even the right PIN is refused...
    await verifyCode(TEST_EMAIL, PIN).expect(429);
    // ...for this address only...
    await verifyCode(OTHER_TEST_EMAIL, PIN).expect(200);
    // ...and a code by email still gets you in.
    const code = await emailedCode(TEST_EMAIL);
    await verifyCode(TEST_EMAIL, code).expect(200);
  });

  it('forgets your wrong guesses once you get it right', async () => {
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < MAX_PIN_ATTEMPTS_PER_HOUR - 2; i++) {
        await verifyCode(TEST_EMAIL, WRONG_PIN).expect(401);
      }
      await verifyCode(TEST_EMAIL, PIN).expect(200);
    }
  });

  it('answers the same for an address that is not on the list', async () => {
    // Otherwise the lock would show which addresses have access.
    const stranger = 'someone-else@example.com';
    for (let i = 0; i < MAX_PIN_ATTEMPTS_PER_HOUR; i++) {
      await verifyCode(stranger, WRONG_PIN).expect(401);
    }
    await verifyCode(stranger, WRONG_PIN).expect(429);
  });

  it('does not let a made-up address test whether a PIN guess is right', async () => {
    // A right guess must not reset the count for an address that can't log
    // in: the lock arriving later would give the PIN away.
    const stranger = 'someone-else@example.com';
    await verifyCode(stranger, PIN).expect(401);
    for (let i = 1; i < MAX_PIN_ATTEMPTS_PER_HOUR; i++) {
      await verifyCode(stranger, WRONG_PIN).expect(401);
    }
    await verifyCode(stranger, WRONG_PIN).expect(429);
  });
});
