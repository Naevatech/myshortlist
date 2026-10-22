import type { Request } from 'express';
import rateLimit, { type Options } from 'express-rate-limit';
import { env } from '../config/env.js';

const message = (text: string) => ({ error: { code: 'rate_limited', message: text } });
const base: Partial<Options> = { standardHeaders: 'draft-7', legacyHeaders: false, skip: () => env.isTest };

export const apiLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 300,
  message: message('Too many requests. Wait a few minutes and try again.'),
});

/** Verification and reset emails: 20 per IP per hour. */
export const emailIpLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60_000,
  limit: 20,
  message: message('Too many emails requested. Try again later.'),
});

/** Verification and reset emails: 5 per address per hour. Keyed on the normalised address, never logged. */
const addressOf = (req: Request) => String(req.body?.email ?? req.user?.email ?? '').trim().toLowerCase();
export const emailAddressLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60_000,
  limit: 5,
  keyGenerator: (req) => `email:${addressOf(req)}`,
  message: message('Too many emails requested for this address. Try again later.'),
});

/** 10 sign-in attempts per IP per 15 minutes (the account lockout is separate). */
export const signinLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 10,
  message: message('Too many attempts. Try again in 15 minutes.'),
});

export const verifyLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 10,
  message: message('Too many attempts. Wait a few minutes and try again.'),
});
