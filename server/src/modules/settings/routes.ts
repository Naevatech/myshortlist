import { Router } from 'express';
import { z } from 'zod';
import type { User } from '@prisma/client';
import { env, MATCHES_PER_DAY_OPTIONS } from '../../config/env.js';
import { prisma } from '../../utils/prisma.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { signInMethod } from '../users/view.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

/** 3, 5, 10, 15, 20, 25 or 30, never above MAX_MATCHES_PER_DAY. */
export const allowedMatchesPerDay = () => MATCHES_PER_DAY_OPTIONS.filter((n) => n <= env.MAX_MATCHES_PER_DAY);

export function matchesPerDaySchema() {
  const literals = allowedMatchesPerDay().map((n) => z.literal(n));
  return literals.length > 1
    ? z.union(literals as unknown as [z.ZodLiteral<number>, z.ZodLiteral<number>, ...z.ZodLiteral<number>[]])
    : literals[0];
}

const view = (u: User) => ({
  email: u.email,
  signInMethod: signInMethod(u),
  hasPassword: Boolean(u.passwordHash),
  passwordChangedAt: u.passwordChangedAt,
  notifyNewMatches: u.notifyNewMatches,
  notifyAppUpdates: u.notifyAppUpdates,
  matchesPerDay: u.matchesPerDay,
  matchesPerDayOptions: allowedMatchesPerDay(),
});

settingsRouter.get('/', (req, res) => {
  res.json(view(currentUser(req)));
});

settingsRouter.patch(
  '/',
  validateBody(
    z
      .object({
        notifyNewMatches: z.boolean(),
        notifyAppUpdates: z.boolean(),
        matchesPerDay: matchesPerDaySchema(),
      })
      .partial(),
  ),
  async (req, res) => {
    const user = await prisma.user.update({ where: { id: currentUser(req).id }, data: req.body });
    res.json(view(user));
  },
);
