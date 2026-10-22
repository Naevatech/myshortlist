import crypto from 'node:crypto';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../utils/prisma.js';
import { badRequest, HttpError, notFound, unauthorized } from '../../utils/errors.js';
import { randomToken } from '../../utils/crypto.js';
import { audit } from '../../utils/audit.js';
import { logger } from '../../utils/logger.js';
import { validateBody } from '../../middleware/validate.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { emailAddressLimiter, emailIpLimiter, signinLimiter, verifyLimiter } from '../../middleware/rateLimit.js';
import { checkCode, normaliseEmail, sendCode } from './otp.js';
import { burnTime, hashPassword, passwordProblem, verifyPassword } from './passwords.js';
import { consumeToken, findUsableToken, sendResetLink } from './resetTokens.js';
import { clearSession, issueSession, revokeRefresh, rotateRefresh } from './sessions.js';
import { meView } from '../users/view.js';

export const authRouter = Router();

const emailSchema = z.string().trim().toLowerCase().email().max(320);
const passwordSchema = z.string().min(1).max(200);

const INVALID_SIGNIN = 'That email or password is not right. Try again.';
const LOCKED = 'Too many attempts. Try again in 15 minutes.';
const LOCK_WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 5;

function checkPassword(password: string) {
  const problem = passwordProblem(password);
  if (problem) throw badRequest('weak_password', problem);
}

// ---------------------------------------------------------------------------
// Sign up and email verification
// ---------------------------------------------------------------------------

/**
 * Creates the account and emails a 6-digit code. The response is the same whether or not the email already
 * has an account, so the endpoint cannot be used to find out who has signed up.
 */
authRouter.post(
  '/signup',
  emailIpLimiter,
  emailAddressLimiter,
  validateBody(z.object({ email: emailSchema, password: passwordSchema })),
  async (req, res) => {
    const address = normaliseEmail(req.body.email);
    checkPassword(req.body.password);
    const existing = await prisma.user.findUnique({ where: { email: address } });
    const passwordHash = await hashPassword(req.body.password);

    if (!existing) {
      await prisma.user.create({ data: { email: address, passwordHash, passwordChangedAt: new Date(), matchesPerDay: env.DEFAULT_MATCHES_PER_DAY } });
      await sendCode(address);
    } else if (!existing.deletedAt && !existing.emailVerifiedAt) {
      // An unfinished sign-up: the newest password wins, and only the inbox owner can verify it.
      await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, passwordChangedAt: new Date() } });
      await sendCode(address);
    } else if (!existing.deletedAt && !existing.passwordHash) {
      // A verified account with no password yet (Google or an older account): send a link to choose one.
      await sendResetLink(existing, req.ip);
    }
    res.json({ ok: true, expiresInMinutes: env.OTP_TTL_MINUTES });
  },
);

/** Only unverified accounts can be verified with a code; it never signs in an existing, verified account. */
authRouter.post(
  '/verify-code',
  verifyLimiter,
  validateBody(z.object({ email: emailSchema, code: z.string().trim().regex(/^\d{6}$/) })),
  async (req, res) => {
    const address = normaliseEmail(req.body.email);
    const user = await prisma.user.findUnique({ where: { email: address } });
    if (!user || user.deletedAt || user.emailVerifiedAt) throw badRequest('code_invalid', 'That code is not right. Try again.');
    const result = await checkCode(address, req.body.code);
    if (result === 'expired') throw badRequest('code_expired', 'That code has expired. We sent you a new one.');
    if (result !== 'ok') throw badRequest('code_invalid', 'That code is not right. Try again.');

    const verified = await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    await issueSession(res, req, verified);
    await audit(user.id, 'auth.email_verified');
    res.json({ ok: true, user: await meView(verified), needsOnboarding: !verified.onboardingCompletedAt });
  },
);

authRouter.post(
  '/resend-code',
  emailIpLimiter,
  emailAddressLimiter,
  validateBody(z.object({ email: emailSchema })),
  async (req, res) => {
    const address = normaliseEmail(req.body.email);
    const user = await prisma.user.findUnique({ where: { email: address } });
    if (user && !user.deletedAt && !user.emailVerifiedAt) await sendCode(address);
    res.json({ ok: true, expiresInMinutes: env.OTP_TTL_MINUTES });
  },
);

// ---------------------------------------------------------------------------
// Sign in with email and password
// ---------------------------------------------------------------------------

authRouter.post(
  '/signin',
  signinLimiter,
  validateBody(z.object({ email: emailSchema, password: passwordSchema })),
  async (req, res) => {
    const address = normaliseEmail(req.body.email);
    const user = await prisma.user.findUnique({ where: { email: address } });
    const now = new Date();

    if (!user || !user.passwordHash || user.deletedAt) {
      await burnTime(req.body.password);
      throw new HttpError(401, 'invalid_credentials', INVALID_SIGNIN);
    }
    if (user.lockedUntil && user.lockedUntil > now) {
      await burnTime(req.body.password);
      throw new HttpError(429, 'locked', LOCKED);
    }

    if (!(await verifyPassword(req.body.password, user.passwordHash))) {
      const recent = user.lastFailedSigninAt && now.getTime() - user.lastFailedSigninAt.getTime() < LOCK_WINDOW_MS;
      const failures = (recent ? user.failedSignins : 0) + 1;
      const lock = failures >= MAX_FAILURES;
      await prisma.user.update({
        where: { id: user.id },
        data: lock
          ? { failedSignins: 0, lastFailedSigninAt: null, lockedUntil: new Date(now.getTime() + LOCK_WINDOW_MS) }
          : { failedSignins: failures, lastFailedSigninAt: now },
      });
      if (lock) {
        await audit(user.id, 'auth.locked');
        throw new HttpError(429, 'locked', LOCKED);
      }
      throw new HttpError(401, 'invalid_credentials', INVALID_SIGNIN);
    }

    const signedIn = await prisma.user.update({
      where: { id: user.id },
      data: { failedSignins: 0, lastFailedSigninAt: null, lockedUntil: null },
    });
    await issueSession(res, req, signedIn);
    await audit(user.id, 'auth.sign_in', { method: 'password' });
    res.json({
      user: await meView(signedIn),
      needsVerify: !signedIn.emailVerifiedAt,
      needsOnboarding: !signedIn.onboardingCompletedAt,
    });
  },
);

// ---------------------------------------------------------------------------
// Forgot and reset password
// ---------------------------------------------------------------------------

/** Always 202 with the same body, whether or not the account exists. */
authRouter.post(
  '/forgot',
  emailIpLimiter,
  emailAddressLimiter,
  validateBody(z.object({ email: emailSchema })),
  async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: normaliseEmail(req.body.email) } });
    if (user && !user.deletedAt) await sendResetLink(user, req.ip);
    res.status(202).json({ ok: true, expiresInMinutes: env.PASSWORD_RESET_TTL_MINUTES });
  },
);

const expired = () => new HttpError(410, 'link_expired', 'This link has expired.');

authRouter.get('/reset/validate', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!(await findUsableToken(token))) throw expired();
  res.json({ ok: true });
});

/** Sets the new password, uses up the link and signs the user out everywhere. It does not sign in. */
authRouter.post(
  '/reset',
  validateBody(z.object({ token: z.string().min(10).max(200), password: passwordSchema })),
  async (req, res) => {
    const row = await findUsableToken(req.body.token);
    if (!row) throw expired();
    checkPassword(req.body.password);
    const passwordHash = await hashPassword(req.body.password);
    if (!(await consumeToken(row.id))) throw expired();

    const now = new Date();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: row.userId } });
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordChangedAt: now,
          failedSignins: 0,
          lastFailedSigninAt: null,
          lockedUntil: null,
          // Following the emailed link proves the address.
          emailVerifiedAt: user.emailVerifiedAt ?? now,
        },
      }),
      prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } }),
      prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } }),
    ]);
    await audit(user.id, 'auth.password_reset');
    clearSession(res);
    res.json({ ok: true });
  },
);

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

authRouter.post('/refresh', async (req, res) => {
  const user = await rotateRefresh(req, res);
  if (!user) {
    clearSession(res);
    throw unauthorized();
  }
  res.json({ ok: true });
});

authRouter.post('/logout', async (req, res) => {
  await revokeRefresh(req);
  clearSession(res);
  res.json({ ok: true });
});

authRouter.post('/logout-all', requireAuth, async (req, res) => {
  const user = currentUser(req);
  await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  await audit(user.id, 'auth.logout_all');
  clearSession(res);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Google sign-in (authorisation code flow with PKCE and a signed state cookie)
// ---------------------------------------------------------------------------

const GOOGLE_COOKIE = 'sl_g';

function googleClient() {
  return new OAuth2Client({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI ?? `${env.API_URL}/api/auth/google/callback`,
  });
}

authRouter.get('/google', async (req, res) => {
  if (!env.googleEnabled) throw notFound();
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  // Where to return after sign-in. Only same-site paths are accepted.
  const next = typeof req.query.next === 'string' && /^\/[A-Za-z0-9/_?=&.-]*$/.test(req.query.next) ? req.query.next : '';
  const signed = jwt.sign({ state, verifier, next }, env.JWT_ACCESS_SECRET, { algorithm: 'HS256', expiresIn: 600 });
  res.cookie(GOOGLE_COOKIE, signed, { httpOnly: true, secure: env.isProd, sameSite: 'lax', maxAge: 600_000, path: '/api/auth/google' });
  const url = googleClient().generateAuthUrl({
    scope: ['openid', 'email', 'profile'],
    state,
    code_challenge: challenge,
    code_challenge_method: CodeChallengeMethod.S256,
    prompt: 'select_account',
  });
  res.redirect(url);
});

authRouter.get('/google/callback', async (req, res) => {
  if (!env.googleEnabled) throw notFound();
  const fail = () => res.redirect(`${env.APP_URL}/signin?google=failed`);
  try {
    const cookie = req.cookies?.[GOOGLE_COOKIE];
    res.clearCookie(GOOGLE_COOKIE, { path: '/api/auth/google' });
    const saved = jwt.verify(cookie ?? '', env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as {
      state: string;
      verifier: string;
      next?: string;
    };
    const { code, state } = z.object({ code: z.string(), state: z.string() }).parse(req.query);
    if (state !== saved.state) return fail();

    const client = googleClient();
    const { tokens } = await client.getToken({ code, codeVerifier: saved.verifier });
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token!, audience: env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified || !payload.sub) return fail();

    const address = normaliseEmail(payload.email);
    let user =
      (await prisma.user.findUnique({ where: { googleId: payload.sub } })) ??
      (await prisma.user.findUnique({ where: { email: address } }));
    if (user?.deletedAt) return fail();
    user = user
      ? await prisma.user.update({
          where: { id: user.id },
          data: { googleId: payload.sub, emailVerifiedAt: user.emailVerifiedAt ?? new Date(), name: user.name ?? payload.name },
        })
      : await prisma.user.create({
          data: {
            email: address,
            googleId: payload.sub,
            name: payload.name,
            emailVerifiedAt: new Date(),
            matchesPerDay: env.DEFAULT_MATCHES_PER_DAY,
          },
        });
    await issueSession(res, req, user);
    await audit(user.id, 'auth.sign_in', { method: 'google' });
    const dest = !user.onboardingCompletedAt ? '/onboarding' : saved.next || '/today';
    res.redirect(`${env.APP_URL}${dest}`);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'google sign-in failed');
    fail();
  }
});
