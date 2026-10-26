import { Router } from 'express';
import archiver from 'archiver';
import { z } from 'zod';
import { prisma } from '../../utils/prisma.js';
import { asArray } from '../../utils/json.js';
import { ukToday } from '../../utils/dates.js';
import { agedOutBefore, daysUntilRemoved } from '../../services/jobs/index.js';
import { env } from '../../config/env.js';
import { conflict } from '../../utils/errors.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { generateForMatch } from '../../services/documents.js';
import { loadCandidate } from '../../services/profileData.js';
import { renderPdf } from '../../services/pdf.js';
import type { Block } from '../../types/domain.js';
import { activeApplication, ownedMatch } from './access.js';
import { answerView, applicationBrief, documentView, jobDetailView, matchListView } from './views.js';
import { approveMatch, markAppliedOnSite } from '../applications/service.js';
import { ensureFullDescription } from '../../services/jobs/details.js';

export const matchesRouter = Router();
matchesRouter.use(requireAuth);

/** Today's matches still to review, plus anything saved for later, best first. */
matchesRouter.get('/today', async (req, res) => {
  const user = currentUser(req);
  const today = ukToday();
  const [items, reviewed] = await Promise.all([
    prisma.match.findMany({
      where: {
        userId: user.id,
        OR: [{ matchedOn: today, status: { in: ['new', 'viewed'] } }, { status: 'saved' }],
        // Never show a job that has aged out of the window, even before the morning run marks it.
        job: { postedAt: { gt: agedOutBefore() } },
      },
      include: { job: true },
      orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
    }),
    prisma.match.count({ where: { userId: user.id, matchedOn: today, status: { in: ['skipped', 'applied', 'saved'] } } }),
  ]);
  res.json({ total: items.length, reviewed, items: items.map(matchListView) });
});

export type EarlierStatus = 'not' | 'applied' | 'started' | 'skipped';

/** How a past match stands: applied, started on the employer's site (not confirmed), skipped, or not applied. */
export function earlierStatus(
  m: { status: string; startedAt: Date | null },
  app: { status: string } | undefined,
): EarlierStatus {
  if (m.status === 'applied' || (app && app.status !== 'approved')) return 'applied';
  if (m.startedAt || app) return 'started';
  if (m.status === 'skipped') return 'skipped';
  return 'not';
}

const DAY_MS = 86_400_000;
/** Shown only for matches that will be removed, in their last few days. */
const WARN_DAYS = 3;

/**
 * Earlier: every match from before today, within the retention period, grouped by the day it was found (newest
 * first), each with its status. Counts cover all of them, for the filter chips.
 */
matchesRouter.get('/earlier', async (req, res) => {
  const user = currentUser(req);
  const today = ukToday();
  const since = new Date(today.getTime() - env.JOB_RETENTION_DAYS * DAY_MS);
  const matches = await prisma.match.findMany({
    where: { userId: user.id, matchedOn: { lt: today, gte: since }, status: { not: 'expired' } },
    include: {
      job: { select: { title: true, company: true, location: true, workMode: true, postedAt: true } },
      applications: { where: { undoneAt: null }, select: { id: true, status: true }, orderBy: { approvedAt: 'desc' }, take: 1 },
    },
    orderBy: [{ matchedOn: 'desc' }, { score: 'desc' }],
  });

  const now = new Date();
  const counts = { all: 0, not: 0, applied: 0, started: 0, skipped: 0 };
  const days = new Map<string, unknown[]>();
  for (const m of matches) {
    const app = m.applications[0];
    const status = earlierStatus(m, app);
    const left = daysUntilRemoved(m.job.postedAt, now);
    counts.all++;
    counts[status]++;
    const day = m.matchedOn.toISOString().slice(0, 10);
    if (!days.has(day)) days.set(day, []);
    days.get(day)!.push({
      id: m.id,
      score: m.score,
      status,
      applicationId: status === 'applied' && app ? app.id : null,
      expiresInDays: (status === 'not' || status === 'skipped') && left <= WARN_DAYS ? left : null,
      job: { ...m.job, postedAt: m.job.postedAt.toISOString() },
    });
  }
  res.json({
    retentionDays: env.JOB_RETENTION_DAYS,
    counts,
    days: [...days.entries()].map(([date, items]) => ({ date, items })),
  });
});

/** The person opened the employer's application page: the match counts as Started until they confirm. */
matchesRouter.post('/:id/start', async (req, res) => {
  const match = await ownedMatch(currentUser(req).id, String(req.params.id));
  if (!match.startedAt && match.status !== 'applied') {
    await prisma.match.update({ where: { id: match.id }, data: { startedAt: new Date() } });
  }
  res.json({ ok: true });
});

matchesRouter.get('/:id', async (req, res) => {
  const user = currentUser(req);
  const match = await ownedMatch(user.id, String(req.params.id));
  if (match.status === 'new') await prisma.match.update({ where: { id: match.id }, data: { status: 'viewed' } });
  match.job = await ensureFullDescription(match.job);
  const [documents, application] = await Promise.all([
    prisma.document.findMany({ where: { matchId: match.id }, orderBy: { type: 'asc' } }),
    activeApplication(match.id),
  ]);
  res.json({
    id: match.id,
    score: match.score,
    reasons: asArray<string>(match.reasonsJson),
    reasonLine: match.reasonLine,
    status: match.status === 'new' ? 'viewed' : match.status,
    job: jobDetailView(match.job),
    documents: documents.map(documentView),
    application: application ? applicationBrief(application) : null,
  });
});

async function setStatus(userId: string, matchId: string, status: 'skipped' | 'saved') {
  const match = await ownedMatch(userId, matchId);
  if (match.status === 'applied') throw conflict('already_applied', 'You have already applied to this job.');
  await prisma.match.update({ where: { id: match.id }, data: { status } });
}

matchesRouter.post('/:id/skip', async (req, res) => {
  await setStatus(currentUser(req).id, String(req.params.id), 'skipped');
  res.json({ ok: true });
});

matchesRouter.post('/:id/save', async (req, res) => {
  await setStatus(currentUser(req).id, String(req.params.id), 'saved');
  res.json({ ok: true });
});

// ---- Documents ----

matchesRouter.get('/:id/documents', async (req, res) => {
  const match = await ownedMatch(currentUser(req).id, String(req.params.id));
  const docs = await prisma.document.findMany({ where: { matchId: match.id }, orderBy: { type: 'asc' } });
  res.json(docs.map(documentView));
});

matchesRouter.post('/:id/documents/regenerate', async (req, res) => {
  const user = currentUser(req);
  const match = await ownedMatch(user.id, String(req.params.id));
  if (match.status === 'applied') throw conflict('already_applied', 'These documents were already used in an application.');
  const { profile, prefs } = await loadCandidate(user.id);
  await generateForMatch(match.id, match.job, profile, prefs, { answers: false });
  const docs = await prisma.document.findMany({ where: { matchId: match.id }, orderBy: { type: 'asc' } });
  res.json(docs.map(documentView));
});

/** Both PDFs in one zip, for finishing on the employer's site. */
matchesRouter.get('/:id/documents/zip', async (req, res) => {
  const user = currentUser(req);
  const match = await ownedMatch(user.id, String(req.params.id));
  const { profile } = await loadCandidate(user.id);
  const docs = await prisma.document.findMany({ where: { matchId: match.id } });
  const name = (profile.fullName || 'CV').replace(/[^A-Za-z0-9]+/g, '-');
  const files = await Promise.all(
    docs.map(async (d) => ({
      name: d.type === 'cv' ? `${name}-CV.pdf` : `${name}-cover-letter.pdf`,
      data: await renderPdf(asArray<Block>(d.blocksJson), d.type === 'cv' ? 'CV' : 'Cover letter'),
    })),
  );
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${name}-application.zip"`);
  const zip = archiver('zip');
  zip.pipe(res);
  for (const f of files) zip.append(f.data, { name: f.name });
  await zip.finalize();
});

// ---- Form answers ----

matchesRouter.get('/:id/answers', async (req, res) => {
  const match = await ownedMatch(currentUser(req).id, String(req.params.id));
  const answers = await prisma.formAnswer.findMany({ where: { matchId: match.id }, orderBy: { position: 'asc' } });
  res.json({ company: match.job.company, answers: answers.map(answerView) });
});

matchesRouter.put(
  '/:id/answers',
  validateBody(z.object({ answers: z.array(z.object({ key: z.string().max(80), value: z.string().max(4000) })).max(40) })),
  async (req, res) => {
    const match = await ownedMatch(currentUser(req).id, String(req.params.id));
    const existing = await prisma.formAnswer.findMany({ where: { matchId: match.id } });
    for (const { key, value } of req.body.answers as Array<{ key: string; value: string }>) {
      const row = existing.find((a) => a.key === key);
      if (!row || row.value === value) continue;
      await prisma.formAnswer.update({
        where: { id: row.id },
        data: { value, source: 'user', needsAttention: value.trim() === '' },
      });
    }
    const answers = await prisma.formAnswer.findMany({ where: { matchId: match.id }, orderBy: { position: 'asc' } });
    res.json({ company: match.job.company, answers: answers.map(answerView) });
  },
);

// ---- Approval ----

matchesRouter.post(
  '/:id/approve',
  validateBody(z.object({ idempotencyKey: z.string().min(8).max(120) })),
  async (req, res) => {
    const result = await approveMatch(currentUser(req).id, String(req.params.id), req.body.idempotencyKey);
    res.status(result.created ? 201 : 200).json(result.body);
  },
);

matchesRouter.post('/:id/applied-on-site', async (req, res) => {
  const app = await markAppliedOnSite(currentUser(req).id, String(req.params.id));
  res.json(applicationBrief(app));
});
