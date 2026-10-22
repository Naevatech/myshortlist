import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, H, lastCodeFor, lastResetTokenFor, PASSWORD, signIn, uniqueEmail } from './helpers.js';
import { outbox } from '../src/services/email/index.js';
import { prisma } from '../src/utils/prisma.js';

const cookieNames = (res: request.Response) => ((res.headers['set-cookie'] as unknown as string[]) ?? []).map((c) => c.split(';')[0]);

describe('sign up and verify', () => {
  it('gives the same response whether or not the email already has an account', async () => {
    const existing = await signIn();
    const a = await request(app).post('/api/auth/signup').set(H).send({ email: uniqueEmail('new'), password: PASSWORD });
    const b = await request(app).post('/api/auth/signup').set(H).send({ email: existing.email, password: 'Another-pass-1' });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(b.body).toEqual(a.body);
    // The existing account's password is not changed.
    await request(app).post('/api/auth/signin').set(H).send({ email: existing.email, password: PASSWORD }).expect(200);
  });

  it('refuses short and common passwords', async () => {
    const short = await request(app).post('/api/auth/signup').set(H).send({ email: uniqueEmail(), password: 'abc123' });
    expect(short.status).toBe(400);
    expect(short.body.error.message).toBe('Use at least 8 characters.');
    const common = await request(app).post('/api/auth/signup').set(H).send({ email: uniqueEmail(), password: 'password123' });
    expect(common.status).toBe(400);
  });

  it('rejects a wrong code, locks the code after the maximum attempts, and sends a new code when expired', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/signup').set(H).send({ email, password: PASSWORD }).expect(200);
    const code = lastCodeFor(email);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const r = await request(app).post('/api/auth/verify-code').set(H).send({ email, code: wrong });
      expect(r.body.error.message).toBe('That code is not right. Try again.');
    }
    await request(app).post('/api/auth/verify-code').set(H).send({ email, code }).expect(400);

    await request(app).post('/api/auth/resend-code').set(H).send({ email }).expect(200);
    await prisma.otpCode.updateMany({ where: { email, consumedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await request(app).post('/api/auth/verify-code').set(H).send({ email, code: lastCodeFor(email) });
    expect(expired.body.error.message).toBe('That code has expired. We sent you a new one.');
    await request(app).post('/api/auth/verify-code').set(H).send({ email, code: lastCodeFor(email) }).expect(200);
  });

  it('never signs in a verified account with a code', async () => {
    const { email } = await signIn();
    await request(app).post('/api/auth/resend-code').set(H).send({ email }).expect(200);
    const r = await request(app).post('/api/auth/verify-code').set(H).send({ email, code: '123456' });
    expect(r.status).toBe(400);
  });

  it('lets an unverified account read only its own status', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/signup').set(H).send({ email, password: PASSWORD });
    const agent = request.agent(app);
    const r = await agent.post('/api/auth/signin').set(H).send({ email, password: PASSWORD }).expect(200);
    expect(r.body.needsVerify).toBe(true);
    expect((await agent.get('/api/me').expect(200)).body.emailVerified).toBe(false);
    expect((await agent.get('/api/profile')).status).toBe(403);
  });
});

describe('sign in', () => {
  it('gives the same error for an unknown email and a wrong password', async () => {
    const { email } = await signIn();
    const unknown = await request(app).post('/api/auth/signin').set(H).send({ email: uniqueEmail('nobody'), password: PASSWORD });
    const wrong = await request(app).post('/api/auth/signin').set(H).send({ email, password: 'Not-the-password-1' });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body.error.message).toBe('That email or password is not right. Try again.');
  });

  it('locks the account for 15 minutes after 5 failures', async () => {
    const { email } = await signIn();
    for (let i = 0; i < 4; i++) {
      await request(app).post('/api/auth/signin').set(H).send({ email, password: 'Wrong-pass-1' }).expect(401);
    }
    const fifth = await request(app).post('/api/auth/signin').set(H).send({ email, password: 'Wrong-pass-1' });
    expect(fifth.status).toBe(429);
    expect(fifth.body.error.message).toBe('Too many attempts. Try again in 15 minutes.');
    // Even the right password is refused while locked.
    await request(app).post('/api/auth/signin').set(H).send({ email, password: PASSWORD }).expect(429);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.lockedUntil!.getTime() - Date.now()).toBeGreaterThan(14 * 60_000);
  });

  it('returns the user and where to go next', async () => {
    const { email } = await signIn();
    const r = await request(app).post('/api/auth/signin').set(H).send({ email, password: PASSWORD }).expect(200);
    expect(r.body).toMatchObject({ needsVerify: false, needsOnboarding: true, user: { email, hasPassword: true } });
    expect(cookieNames(r).map((c) => c.split('=')[0]).sort()).toEqual(['sl_at', 'sl_rt']);
  });
});

describe('forgot and reset password', () => {
  it('returns the same 202 for unknown and known emails', async () => {
    const { email } = await signIn();
    const before = outbox.length;
    const known = await request(app).post('/api/auth/forgot').set(H).send({ email });
    const unknown = await request(app).post('/api/auth/forgot').set(H).send({ email: uniqueEmail('nobody') });
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(unknown.body).toEqual(known.body);
    expect(outbox.slice(before).filter((m) => m.subject.startsWith('Reset'))).toHaveLength(1);
  });

  it('works once, signs out every session, and does not sign in', async () => {
    const { email, agent } = await signIn();
    const other = request.agent(app);
    await other.post('/api/auth/signin').set(H).send({ email, password: PASSWORD }).expect(200);

    await request(app).post('/api/auth/forgot').set(H).send({ email }).expect(202);
    const token = lastResetTokenFor(email);
    await request(app).get('/api/auth/reset/validate').query({ token }).expect(200);
    const reset = await request(app).post('/api/auth/reset').set(H).send({ token, password: 'Brand-new-pass-7' }).expect(200);
    expect(cookieNames(reset).every((c) => c.endsWith('='))).toBe(true);

    // Used once only.
    await request(app).get('/api/auth/reset/validate').query({ token }).expect(410);
    await request(app).post('/api/auth/reset').set(H).send({ token, password: 'Another-pass-8' }).expect(410);

    // Every session is gone, including access tokens still in date.
    await agent.get('/api/profile').expect(401);
    await other.get('/api/profile').expect(401);
    await other.post('/api/auth/refresh').set(H).expect(401);

    await request(app).post('/api/auth/signin').set(H).send({ email, password: PASSWORD }).expect(401);
    await request(app).post('/api/auth/signin').set(H).send({ email, password: 'Brand-new-pass-7' }).expect(200);
  });

  it('expires after 30 minutes', async () => {
    const { email } = await signIn();
    await request(app).post('/api/auth/forgot').set(H).send({ email });
    const token = lastResetTokenFor(email);
    const row = await prisma.passwordResetToken.findFirstOrThrow({ where: { user: { email } }, orderBy: { createdAt: 'desc' } });
    expect(Math.abs(row.expiresAt.getTime() - row.createdAt.getTime() - 30 * 60_000)).toBeLessThan(5_000);
    await prisma.passwordResetToken.update({ where: { id: row.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await request(app).get('/api/auth/reset/validate').query({ token }).expect(410);
    await request(app).post('/api/auth/reset').set(H).send({ token, password: 'Brand-new-pass-7' }).expect(410);
  });

  it('sends a reset link to a signed-in user from Settings', async () => {
    const { agent, email } = await signIn();
    const r = await agent.post('/api/me/password/reset-link').set(H).expect(202);
    expect(r.body.email).toBe(email);
    expect(lastResetTokenFor(email)).toBeTruthy();
  });
});

describe('sessions', () => {
  it('rotates the refresh token and revokes all sessions when an old token is reused', async () => {
    const { agent } = await signIn();
    const cookies = (await agent.post('/api/auth/refresh').set(H).expect(200)).headers['set-cookie'] as unknown as string[];
    const rotated = cookies.find((c) => c.startsWith('sl_rt='))!.split(';')[0];
    await agent.post('/api/auth/refresh').set(H).expect(200);
    await request(app).post('/api/auth/refresh').set(H).set('Cookie', rotated).expect(401);
    await agent.post('/api/auth/refresh').set(H).expect(401);
  });

  it('logout clears both cookies and revokes the refresh token', async () => {
    const { agent, user } = await signIn();
    const r = await agent.post('/api/auth/logout').set(H).expect(200);
    expect(cookieNames(r).sort()).toEqual(['sl_at=', 'sl_rt=']);
    expect(await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
    await agent.get('/api/me').expect(401);
  });

  it('logout-all revokes every refresh token', async () => {
    const { agent, user, email } = await signIn();
    await request(app).post('/api/auth/signin').set(H).send({ email, password: PASSWORD }).expect(200);
    expect(await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(2);
    await agent.post('/api/auth/logout-all').set(H).expect(200);
    expect(await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
  });

  it('requires the CSRF header on state-changing requests', async () => {
    await request(app).post('/api/auth/signin').send({ email: uniqueEmail(), password: PASSWORD }).expect(403);
    await request(app)
      .post('/api/auth/signin')
      .set(H)
      .set('Origin', 'https://elsewhere.example')
      .send({ email: uniqueEmail(), password: PASSWORD })
      .expect(403);
  });
});
