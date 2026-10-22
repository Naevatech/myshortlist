import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../utils/prisma.js';
import { asArray } from '../../utils/json.js';
import { badRequest, conflict } from '../../utils/errors.js';
import { audit } from '../../utils/audit.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { emailAddressLimiter, emailIpLimiter, verifyLimiter } from '../../middleware/rateLimit.js';
import { sendResetLink } from '../auth/resetTokens.js';
import { meView } from './view.js';
import { checkCode, normaliseEmail, sendCode } from '../auth/otp.js';
import { clearSession } from '../auth/sessions.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get('/', async (req, res) => {
  res.json(await meView(currentUser(req)));
});

/** Settings › Password › Change: emails a reset link to the user's own address. */
usersRouter.post('/password/reset-link', emailIpLimiter, emailAddressLimiter, async (req, res) => {
  const user = currentUser(req);
  await sendResetLink(user, req.ip);
  res.status(202).json({ ok: true, email: user.email, expiresInMinutes: env.PASSWORD_RESET_TTL_MINUTES });
});

/** Change of email: a code goes to the new address, and the change happens once it is entered. */
usersRouter.post(
  '/email/request',
  emailIpLimiter,
  emailAddressLimiter,
  validateBody(z.object({ email: z.string().trim().toLowerCase().email().max(320) })),
  async (req, res) => {
    const user = currentUser(req);
    const address = normaliseEmail(req.body.email);
    if (address === user.email) throw badRequest('same_email', 'That is already your email address.');
    if (await prisma.user.findUnique({ where: { email: address } })) {
      throw conflict('email_taken', 'That email address is already used by another account.');
    }
    await sendCode(address);
    res.json({ ok: true });
  },
);

usersRouter.post(
  '/email/verify',
  verifyLimiter,
  validateBody(z.object({ email: z.string().trim().toLowerCase().email(), code: z.string().regex(/^\d{6}$/) })),
  async (req, res) => {
    const user = currentUser(req);
    const address = normaliseEmail(req.body.email);
    const result = await checkCode(address, req.body.code);
    if (result === 'expired') throw badRequest('code_expired', 'That code has expired. We sent you a new one.');
    if (result !== 'ok') throw badRequest('code_invalid', 'That code is not right. Try again.');
    await prisma.user.update({ where: { id: user.id }, data: { email: address, emailVerifiedAt: new Date() } });
    await audit(user.id, 'account.email_changed');
    res.json({ ok: true, email: address });
  },
);

/** Everything we hold about the user, as one JSON file. */
usersRouter.get('/export', async (req, res) => {
  const user = currentUser(req);
  const [profile, preferences, cvs, matches, applications] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: user.id } }),
    prisma.preferences.findUnique({ where: { userId: user.id } }),
    prisma.cv.findMany({ where: { userId: user.id }, select: { fileName: true, createdAt: true, rawText: true, parsedJson: true, isActive: true } }),
    prisma.match.findMany({
      where: { userId: user.id },
      include: { job: { select: { title: true, company: true, location: true } }, documents: true, answers: true },
    }),
    prisma.application.findMany({ where: { userId: user.id }, include: { events: true, job: { select: { title: true, company: true } } } }),
  ]);
  await audit(user.id, 'account.export');
  const data = {
    exportedAt: new Date().toISOString(),
    account: {
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      matchesPerDay: user.matchesPerDay,
      notifyNewMatches: user.notifyNewMatches,
      notifyAppUpdates: user.notifyAppUpdates,
    },
    profile: profile && {
      ...profile,
      experience: asArray(profile.experienceJson),
      education: asArray(profile.educationJson),
      skills: asArray(profile.skillsJson),
    },
    preferences,
    cvs,
    matches: matches.map((m) => ({
      job: m.job,
      score: m.score,
      reasons: asArray(m.reasonsJson),
      status: m.status,
      matchedOn: m.matchedOn,
      documents: m.documents.map((d) => ({ type: d.type, blocks: asArray(d.blocksJson), editedByUser: d.editedByUser })),
      answers: m.answers.map((a) => ({ label: a.label, value: a.value, source: a.source })),
    })),
    applications: applications.map((a) => ({
      job: a.job,
      route: a.route,
      status: a.status,
      approvedAt: a.approvedAt,
      sentAt: a.sentAt,
      notes: a.notes,
      events: a.events.map((e) => ({ label: e.label, detail: e.detail, occurredAt: e.occurredAt })),
    })),
  };
  res.setHeader('Content-Disposition', 'attachment; filename="shortlist-data.json"');
  res.type('application/json').send(JSON.stringify(data, null, 2));
});

/** Soft-deletes now (sign-in is blocked at once); the purge job removes rows and files later. */
usersRouter.delete('/', validateBody(z.object({ confirm: z.literal(true) })), async (req, res) => {
  const user = currentUser(req);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.application.updateMany({
      where: { userId: user.id, status: 'approved', sentAt: null, undoneAt: null },
      data: { undoneAt: new Date(), scheduledSendAt: null },
    }),
  ]);
  await audit(user.id, 'account.deleted');
  clearSession(res);
  res.json({ ok: true });
});
