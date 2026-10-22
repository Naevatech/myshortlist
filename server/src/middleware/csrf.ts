import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { forbidden } from '../utils/errors.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
const allowed = env.CORS_ORIGIN.split(',').map((o) => o.trim());

/**
 * Cookies carry the session, so every state-changing request must send "X-Requested-With: shortlist"
 * (which a cross-site form cannot set) and, when the browser sends an Origin, it must be ours.
 * Cron routes use their own secret header instead.
 */
export function csrf(req: Request, _res: Response, next: NextFunction) {
  if (SAFE.has(req.method) || req.path.startsWith('/cron/')) return next();
  if (req.get('x-requested-with') !== 'shortlist') return next(forbidden('Missing request header.'));
  const origin = req.get('origin');
  if (origin && !allowed.includes(origin)) return next(forbidden('Request origin not allowed.'));
  next();
}
