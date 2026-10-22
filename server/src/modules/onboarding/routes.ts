import { Router } from 'express';
import { prisma } from '../../utils/prisma.js';
import { badRequest } from '../../utils/errors.js';
import { audit } from '../../utils/audit.js';
import { logger } from '../../utils/logger.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { generateMatchesForUser } from '../../jobs/dailyMatches.js';

export const onboardingRouter = Router();
onboardingRouter.use(requireAuth);

/** Marks onboarding done and creates the first matches straight away. Safe to call twice. */
onboardingRouter.post('/complete', async (req, res) => {
  const user = currentUser(req);
  const [cv, prefs] = await Promise.all([
    prisma.cv.findFirst({ where: { userId: user.id, isActive: true }, select: { id: true } }),
    prisma.preferences.findUnique({ where: { userId: user.id } }),
  ]);
  if (!cv) throw badRequest('cv_missing', 'Upload your CV first.');
  if (!prefs) throw badRequest('preferences_missing', 'Add the roles you are looking for first.');

  if (!user.onboardingCompletedAt) {
    await prisma.user.update({ where: { id: user.id }, data: { onboardingCompletedAt: new Date() } });
    await audit(user.id, 'onboarding.completed');
  }
  // A job API outage must not block onboarding: the morning run will try again.
  let created = 0;
  try {
    created = await generateMatchesForUser(user.id, { notify: false });
  } catch (err) {
    logger.error({ userId: user.id, err: (err as Error).message }, 'first matches failed');
  }
  res.json({ ok: true, matches: created });
});
