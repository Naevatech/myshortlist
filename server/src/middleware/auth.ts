import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../utils/prisma.js';
import { HttpError, unauthorized } from '../utils/errors.js';

export const ACCESS_COOKIE = 'sl_at';
export const REFRESH_COOKIE = 'sl_rt';

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
  }
}

/** Unverified accounts may only read their own status, so the app can send them to "Check your email". */
const allowedUnverified = (req: Request) => req.method === 'GET' && req.originalUrl.split('?')[0] === '/api/me';

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return next(unauthorized());
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
  } catch {
    return next(unauthorized());
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub as string } });
  if (!user || user.deletedAt) return next(unauthorized());
  // A password change signs out every session issued before it, including access tokens still in date.
  const issuedAt = typeof payload.ims === 'number' ? payload.ims : (payload.iat ?? 0) * 1000;
  if (user.passwordChangedAt && issuedAt < user.passwordChangedAt.getTime()) {
    return next(unauthorized());
  }
  if (!user.emailVerifiedAt && !allowedUnverified(req)) {
    return next(new HttpError(403, 'verify_required', 'Verify your email address first.'));
  }
  req.user = user;
  next();
}

/** For handlers behind requireAuth. */
export function currentUser(req: Request): User {
  if (!req.user) throw unauthorized();
  return req.user;
}
