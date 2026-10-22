import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../utils/prisma.js';
import { toJson } from '../../utils/json.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { toProfileData } from '../../services/profileData.js';
import { educationSchema, experienceSchema } from '../../types/domain.js';

export const profileRouter = Router();
profileRouter.use(requireAuth);

const text = (max: number) => z.string().trim().max(max);

profileRouter.get('/', async (req, res) => {
  const user = currentUser(req);
  const [profile, cv] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: user.id } }),
    prisma.cv.findFirst({ where: { userId: user.id, isActive: true }, select: { fileName: true } }),
  ]);
  const data = toProfileData(profile);
  res.json({ ...data, email: data.email || user.email, cvFileName: cv?.fileName ?? null });
});

const patchSchema = z
  .object({
    fullName: text(200),
    email: z.string().trim().email().max(320).or(z.literal('')),
    phone: text(40).nullable(),
    location: text(200),
    headline: text(200),
    summary: text(3000),
    experience: z
      .array(
        experienceSchema.extend({
          title: text(200),
          company: text(200),
          start: text(40),
          end: text(40),
          bullets: z.array(text(600)).max(20),
        }),
      )
      .max(20),
    education: z.array(educationSchema.extend({ qualification: text(200), institution: text(200) })).max(10),
    skills: z.array(text(60)).max(60),
  })
  .partial();

profileRouter.patch('/', validateBody(patchSchema), async (req, res) => {
  const user = currentUser(req);
  const b = req.body as z.infer<typeof patchSchema>;
  const data = {
    fullName: b.fullName,
    email: b.email,
    phone: b.phone === undefined ? undefined : b.phone || null,
    location: b.location,
    headline: b.headline,
    summary: b.summary,
    experienceJson: b.experience && toJson(b.experience),
    educationJson: b.education && toJson(b.education),
    skillsJson: b.skills && toJson([...new Set(b.skills.filter(Boolean))]),
  };
  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      ...data,
      experienceJson: data.experienceJson ?? toJson([]),
      educationJson: data.educationJson ?? toJson([]),
      skillsJson: data.skillsJson ?? toJson([]),
    },
    update: data,
  });
  res.json(toProfileData(profile));
});
