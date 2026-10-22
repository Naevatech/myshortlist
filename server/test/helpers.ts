import request from 'supertest';
import { createApp } from '../src/app.js';
import { outbox } from '../src/services/email/index.js';
import { prisma } from '../src/utils/prisma.js';
import { toJson } from '../src/utils/json.js';
import { generateMatchesForUser } from '../src/jobs/dailyMatches.js';

export const app = createApp();
export const H = { 'X-Requested-With': 'shortlist' };

let n = 0;
export const uniqueEmail = (tag = 'user') => `${tag}.${Date.now()}.${n++}@example.com`;

export function lastCodeFor(email: string): string {
  const msg = [...outbox].reverse().find((m) => m.to === email);
  const code = msg?.text.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`No code emailed to ${email}`);
  return code;
}

export const PASSWORD = 'Correct-horse-9';

/** Signs up and verifies through the real flow, and returns an agent holding the session cookies. */
export async function signIn(email = uniqueEmail(), password = PASSWORD) {
  const agent = request.agent(app);
  await agent.post('/api/auth/signup').set(H).send({ email, password }).expect(200);
  await agent.post('/api/auth/verify-code').set(H).send({ email, code: lastCodeFor(email) }).expect(200);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { agent, user, email, password };
}

/** The reset token from the latest reset email sent to the address. */
export function lastResetTokenFor(email: string): string {
  const msg = [...outbox].reverse().find((m) => m.to === email && m.subject.startsWith('Reset'));
  const token = msg?.text.match(/token=([^\s]+)/)?.[1];
  if (!token) throw new Error(`No reset link emailed to ${email}`);
  return decodeURIComponent(token);
}

/** A signed-in user with a profile, preferences and today's six placeholder matches. */
export async function onboardedUser() {
  const s = await signIn();
  const id = s.user.id;
  await prisma.user.update({ where: { id }, data: { onboardingCompletedAt: new Date(), matchesPerDay: 10, name: 'Sam Carter' } });
  await prisma.profile.create({
    data: {
      userId: id,
      fullName: 'Sam Carter',
      email: s.email,
      phone: '07700 900123',
      location: 'Belfast',
      headline: 'Full-stack developer',
      summary: 'Full-stack developer with three years of experience.',
      experienceJson: toJson([
        { title: 'Full-Stack Developer', company: 'Brightwater Studio', start: '2024', end: '2025', bullets: ['Built a React and TypeScript component library'] },
      ]),
      educationJson: toJson([]),
      skillsJson: toJson(['React', 'TypeScript', 'Node.js', 'MongoDB']),
    },
  });
  await prisma.preferences.create({
    data: {
      userId: id,
      rolesJson: toJson(['Frontend Engineer']),
      location: 'Belfast',
      radiusMiles: 15,
      workStylesJson: toJson(['hybrid']),
      minSalary: 45000,
    },
  });
  await prisma.cv.create({
    data: { userId: id, fileKey: `cv/${id}/x.pdf`, fileName: 'cv.pdf', mime: 'application/pdf', size: 1, rawText: 'x', parsedJson: toJson({}) },
  });
  await generateMatchesForUser(id);
  const matches = await prisma.match.findMany({ where: { userId: id }, include: { job: true } });
  const byRoute = (r: 'email' | 'form' | 'site') => matches.find((m) => m.job.applyRoute === r)!;
  return { ...s, matches, email_: byRoute('email'), form: byRoute('form'), site: byRoute('site') };
}
