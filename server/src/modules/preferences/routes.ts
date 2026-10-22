import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../utils/prisma.js';
import { toJson } from '../../utils/json.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { toPreferencesData } from '../../services/profileData.js';

export const preferencesRouter = Router();
preferencesRouter.use(requireAuth);

preferencesRouter.get('/', async (req, res) => {
  const user = currentUser(req);
  const prefs = await prisma.preferences.findUnique({ where: { userId: user.id } });
  res.json(prefs ? toPreferencesData(prefs) : null);
});

/** Accepts the full set or a part of it (onboarding saves one step at a time). */
const putSchema = z
  .object({
    roles: z.array(z.string().trim().min(1).max(120)).max(20),
    location: z.string().trim().max(200),
    radiusMiles: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(25), z.literal(50)]),
    workStyles: z.array(z.enum(['remote', 'hybrid', 'onsite'])).max(3),
    minSalary: z.number().int().min(0).max(1_000_000).nullable(),
    rightToWorkUk: z.boolean(),
    needsSponsorship: z.boolean(),
  })
  .partial();

preferencesRouter.put('/', validateBody(putSchema), async (req, res) => {
  const user = currentUser(req);
  const b = req.body as z.infer<typeof putSchema>;
  const data = {
    rolesJson: b.roles && toJson([...new Set(b.roles)]),
    location: b.location,
    radiusMiles: b.radiusMiles,
    workStylesJson: b.workStyles && toJson([...new Set(b.workStyles)]),
    minSalary: b.minSalary,
    rightToWorkUk: b.rightToWorkUk,
    needsSponsorship: b.needsSponsorship,
  };
  const prefs = await prisma.preferences.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data, rolesJson: data.rolesJson ?? toJson([]), workStylesJson: data.workStylesJson ?? toJson([]) },
    update: data,
  });
  res.json(toPreferencesData(prefs));
});
