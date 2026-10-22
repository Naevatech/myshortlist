import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { env } from '../../config/env.js';
import { safeEqual } from '../../utils/crypto.js';
import { forbidden } from '../../utils/errors.js';
import { runDailyMatches } from '../../jobs/dailyMatches.js';
import { processScheduledSends } from '../../jobs/processScheduledSends.js';

export const cronRouter = Router();

function requireCronSecret(req: Request, _res: Response, next: NextFunction) {
  const given = req.get('x-cron-secret') ?? '';
  if (!safeEqual(given, env.CRON_SECRET)) return next(forbidden());
  next();
}

cronRouter.post('/daily-matches', requireCronSecret, async (_req, res) => {
  res.json(await runDailyMatches());
});

cronRouter.post('/process-sends', requireCronSecret, async (_req, res) => {
  res.json(await processScheduledSends());
});
