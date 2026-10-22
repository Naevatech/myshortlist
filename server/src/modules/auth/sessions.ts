import type { CookieOptions, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../utils/prisma.js';
import { hashSecret, randomToken } from '../../utils/crypto.js';
import { durationMs } from '../../utils/dates.js';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../../middleware/auth.js';

const REFRESH_PATH = '/api/auth';

function cookieBase(): CookieOptions {
  return { httpOnly: true, secure: env.isProd, sameSite: 'lax', domain: env.COOKIE_DOMAIN };
}

export async function issueSession(res: Response, req: Request, user: User) {
  // `ims`: issue time in milliseconds, so a password change can end sessions issued even a moment earlier.
  const access = jwt.sign({ ims: Date.now() }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    algorithm: 'HS256',
    expiresIn: Math.floor(durationMs(env.ACCESS_TOKEN_TTL) / 1000),
  });
  const refresh = randomToken(48);
  const refreshMs = durationMs(env.REFRESH_TOKEN_TTL);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashSecret(refresh),
      expiresAt: new Date(Date.now() + refreshMs),
      userAgent: req.get('user-agent')?.slice(0, 400),
      ip: req.ip?.slice(0, 64),
    },
  });
  res.cookie(ACCESS_COOKIE, access, { ...cookieBase(), path: '/', maxAge: durationMs(env.ACCESS_TOKEN_TTL) });
  res.cookie(REFRESH_COOKIE, refresh, { ...cookieBase(), path: REFRESH_PATH, maxAge: refreshMs });
}

export function clearSession(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...cookieBase(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...cookieBase(), path: REFRESH_PATH });
}

/** Rotates a refresh token. Reusing a revoked token revokes every session for that user. */
export async function rotateRefresh(req: Request, res: Response): Promise<User | null> {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) return null;
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashSecret(raw) }, include: { user: true } });
  if (!row) return null;
  if (row.revokedAt) {
    await prisma.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return null;
  }
  if (row.expiresAt < new Date() || row.user.deletedAt) return null;
  const claimed = await prisma.refreshToken.updateMany({
    where: { id: row.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (claimed.count !== 1) return null;
  await issueSession(res, req, row.user);
  return row.user;
}

export async function revokeRefresh(req: Request) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) return;
  await prisma.refreshToken.updateMany({ where: { tokenHash: hashSecret(raw), revokedAt: null }, data: { revokedAt: new Date() } });
}
